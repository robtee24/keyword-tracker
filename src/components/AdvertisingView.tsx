import { useState, useEffect, useMemo, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { logActivity } from '../utils/activityLog';

type MatchTab = 'broad' | 'phrase' | 'exact' | 'negative';

interface MatchKeyword {
  keyword: string;
  source: 'ranking' | 'suggested';
  volume: number;
  conversionScore: number;
}

interface NegativeKeyword {
  keyword: string;
  category: string;
}

interface AdData {
  broad: MatchKeyword[];
  phrase: MatchKeyword[];
  exact: MatchKeyword[];
  negative: NegativeKeyword[];
  summary: string;
  generatedAt: string;
}

interface AdvertisingViewProps {
  siteUrl: string;
  projectId: string;
}

const TABS: { id: MatchTab; label: string; desc: string }[] = [
  { id: 'broad', label: 'Broad Match', desc: 'High-reach keywords that allow Google to show ads for related searches' },
  { id: 'phrase', label: 'Phrase Match', desc: 'Multi-word phrases that trigger ads when the meaning is included' },
  { id: 'exact', label: 'Exact Match', desc: 'Precise keywords that trigger ads only for that specific search' },
  { id: 'negative', label: 'Negative Keywords', desc: 'Terms excluded from campaigns to prevent wasted ad spend' },
];

const STORAGE_KEY = (id: string) => `kt_objectives_${id}`;

function getScoreColor(score: number) {
  if (score >= 8) return 'text-green-600';
  if (score >= 5) return 'text-amber-600';
  return 'text-red-500';
}
function getScoreBg(score: number) {
  if (score >= 8) return 'bg-green-100';
  if (score >= 5) return 'bg-amber-100';
  return 'bg-red-100';
}

export default function AdvertisingView({ siteUrl, projectId }: AdvertisingViewProps) {
  const [data, setData] = useState<AdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MatchTab>('broad');
  const [sortBy, setSortBy] = useState<'conversionScore' | 'volume'>('conversionScore');
  const [sourceFilter, setSourceFilter] = useState<'' | 'ranking' | 'suggested'>('');
  const [negCategoryFilter, setNegCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  // Load saved data on mount
  useEffect(() => {
    if (!siteUrl) return;
    setLoading(true);
    fetch(`${API_ENDPOINTS.db.adKeywords}?siteUrl=${encodeURIComponent(siteUrl)}`)
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((d) => { if (d && d.broad) setData(d); })
      .catch((err) => { console.error('[Advertising] Load error:', err); })
      .finally(() => setLoading(false));
  }, [siteUrl]);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      let objectives = null;
      try {
        const stored = localStorage.getItem(STORAGE_KEY(projectId));
        if (stored) objectives = JSON.parse(stored);
      } catch { /* */ }

      const resp = await fetch(API_ENDPOINTS.advertising.generate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, objectives }),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(body?.error || `Server error (${resp.status})`);
      }
      if (!body || (!body.broad && !body.phrase && !body.exact)) {
        throw new Error('Server returned empty results. Check that your site has tracked keywords.');
      }
      setData(body);
      const totalKw = (body.broad?.length || 0) + (body.phrase?.length || 0) + (body.exact?.length || 0) + (body.negative?.length || 0);
      logActivity(siteUrl, 'ad', 'keywords-generated', `Generated ${totalKw} advertising keywords (broad, phrase, exact, negative)`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }, [siteUrl, projectId]);

  // Match type keywords: filtered + sorted
  const matchKeywords = useMemo(() => {
    if (!data || activeTab === 'negative') return [];
    let list = data[activeTab] as MatchKeyword[];
    if (sourceFilter) list = list.filter((k) => k.source === sourceFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((k) => k.keyword.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) =>
      sortBy === 'conversionScore' ? b.conversionScore - a.conversionScore : (b.volume || 0) - (a.volume || 0)
    );
  }, [data, activeTab, sourceFilter, searchQuery, sortBy]);

  // Negative keywords: filtered
  const negativeKeywords = useMemo(() => {
    if (!data) return [];
    let list = data.negative;
    if (negCategoryFilter) list = list.filter((k) => k.category === negCategoryFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((k) => k.keyword.toLowerCase().includes(q));
    }
    return list;
  }, [data, negCategoryFilter, searchQuery]);

  // Negative keyword categories
  const negCategories = useMemo(() => {
    if (!data) return [];
    const cats = new Map<string, number>();
    for (const k of data.negative) cats.set(k.category, (cats.get(k.category) || 0) + 1);
    return [...cats.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  // Stats for each match type
  const tabStats = useMemo(() => {
    if (!data) return {};
    const stats: Record<string, { total: number; ranking: number; suggested: number }> = {};
    for (const tab of ['broad', 'phrase', 'exact'] as const) {
      const list = data[tab];
      stats[tab] = { total: list.length, ranking: list.filter((k) => k.source === 'ranking').length, suggested: list.filter((k) => k.source === 'suggested').length };
    }
    stats.negative = { total: data.negative.length, ranking: 0, suggested: 0 };
    return stats;
  }, [data]);

  const copyToClipboard = (tab: MatchTab) => {
    if (!data) return;
    let text = '';
    if (tab === 'negative') {
      text = data.negative.map((k) => k.keyword).join('\n');
    } else {
      const list = data[tab] as MatchKeyword[];
      text = list.map((k) => k.keyword).join('\n');
    }
    navigator.clipboard.writeText(text).then(() => {
      setCopiedTab(tab);
      setTimeout(() => setCopiedTab(null), 2000);
    });
  };

  const copyFormatted = (tab: MatchTab) => {
    if (!data || tab === 'negative') return copyToClipboard(tab);
    const list = data[tab] as MatchKeyword[];
    const format: Record<string, (kw: string) => string> = {
      broad: (kw) => kw,
      phrase: (kw) => `"${kw}"`,
      exact: (kw) => `[${kw}]`,
    };
    const text = list.map((k) => format[tab](k.keyword)).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedTab(`${tab}-fmt`);
      setTimeout(() => setCopiedTab(null), 2000);
    });
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-apple-text">Advertising Keywords</h2>
          <p className="text-apple-sm text-apple-text-secondary mt-0.5">
            AI-generated Google Ads keyword lists based on your ranking keywords, search volumes, and site objectives.
          </p>
        </div>
        <button onClick={generate} disabled={generating}
          className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-60 shrink-0 flex items-center gap-2">
          {generating && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {generating ? 'Generating…' : data ? 'Regenerate' : 'Generate Keywords'}
        </button>
      </div>

      {error && (
        <div className="rounded-apple border border-apple-red/20 bg-red-50/30 px-4 py-3 mb-6 text-apple-sm text-apple-red">{error}</div>
      )}

      {/* Loading state */}
      {loading && !data && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-apple-sm text-apple-text-secondary">Loading saved keywords…</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && !data && !generating && (
        <div className="rounded-apple border border-apple-divider bg-white p-12 text-center">
          <div className="text-4xl mb-3">📢</div>
          <h3 className="text-apple-body font-semibold text-apple-text mb-2">No Ad Keywords Yet</h3>
          <p className="text-apple-sm text-apple-text-secondary max-w-md mx-auto mb-6">
            Click "Generate Keywords" to analyze your site's ranking data and generate optimized Google Ads keyword lists with broad match, phrase match, exact match, and negative keywords.
          </p>
          <button onClick={generate}
            className="px-5 py-2.5 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors">
            Generate Keywords
          </button>
        </div>
      )}

      {/* Generating state */}
      {generating && !data && (
        <div className="rounded-apple border border-apple-divider bg-white p-12 text-center">
          <div className="w-8 h-8 border-2 border-apple-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-apple-sm text-apple-text-secondary">Analyzing your keywords and generating optimized ad lists…</p>
          <p className="text-apple-xs text-apple-text-tertiary mt-1">This typically takes 15-30 seconds.</p>
        </div>
      )}

      {/* ═══════ RESULTS ═══════ */}
      {data && (
        <>
          {/* Strategy summary */}
          {data.summary && (
            <div className="rounded-apple border border-apple-blue/20 bg-apple-blue/5 p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-apple-blue mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <div>
                  <span className="text-apple-xs font-semibold text-apple-blue uppercase tracking-wider">Strategy Overview</span>
                  <p className="text-apple-sm text-apple-text mt-1">{data.summary}</p>
                </div>
              </div>
            </div>
          )}

          {/* Quick stats row */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {TABS.map((tab) => {
              const stat = tabStats[tab.id];
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearchQuery(''); setSourceFilter(''); setNegCategoryFilter(''); }}
                  className={`rounded-apple border p-3.5 text-left transition-all ${isActive ? 'border-apple-blue bg-apple-blue/5 ring-1 ring-apple-blue' : 'border-apple-divider bg-white hover:border-apple-blue/40'}`}>
                  <div className="text-lg font-bold text-apple-text">{stat?.total || 0}</div>
                  <div className="text-apple-xs font-semibold text-apple-text mt-0.5">{tab.label}</div>
                  {tab.id !== 'negative' && stat && (
                    <div className="text-[10px] text-apple-text-tertiary mt-1">
                      {stat.ranking} ranking · {stat.suggested} suggested
                    </div>
                  )}
                  {tab.id === 'negative' && negCategories.length > 0 && (
                    <div className="text-[10px] text-apple-text-tertiary mt-1">{negCategories.length} categories</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active tab header */}
          <div className="rounded-apple border border-apple-divider bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-apple-divider bg-apple-fill-secondary/50 flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-apple-sm font-semibold text-apple-text">{TABS.find((t) => t.id === activeTab)?.label}</span>
                <span className="text-apple-xs text-apple-text-tertiary ml-2">{TABS.find((t) => t.id === activeTab)?.desc}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => copyToClipboard(activeTab)}
                  className="px-2.5 py-1 rounded-apple-sm border border-apple-border text-apple-xs text-apple-text-secondary hover:bg-apple-fill-secondary transition-colors">
                  {copiedTab === activeTab ? '✓ Copied' : 'Copy List'}
                </button>
                {activeTab !== 'negative' && (
                  <button onClick={() => copyFormatted(activeTab)}
                    className="px-2.5 py-1 rounded-apple-sm border border-apple-border text-apple-xs text-apple-text-secondary hover:bg-apple-fill-secondary transition-colors">
                    {copiedTab === `${activeTab}-fmt` ? '✓ Copied' : 'Copy Formatted'}
                  </button>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="px-4 py-2.5 border-b border-apple-divider flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search keywords…"
                  className="w-full pl-8 pr-3 py-1.5 rounded-apple-sm border border-apple-border text-apple-xs focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue" />
              </div>
              {activeTab !== 'negative' && (
                <>
                  <span className="text-apple-xs text-apple-text-tertiary">Source:</span>
                  {(['ranking', 'suggested'] as const).map((s) => (
                    <button key={s} onClick={() => setSourceFilter(sourceFilter === s ? '' : s)}
                      className={`px-2 py-1 rounded-apple-pill text-apple-xs font-medium transition-colors border ${
                        sourceFilter === s
                          ? (s === 'ranking' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-purple-50 text-purple-700 border-purple-200')
                          : 'bg-apple-fill-secondary text-apple-text-secondary border-transparent hover:bg-gray-200'
                      }`}>
                      {s === 'ranking' ? 'Ranking' : 'Suggested'}
                    </button>
                  ))}
                  <span className="text-apple-xs text-apple-text-tertiary ml-1">Sort:</span>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-2 py-1 rounded-apple-sm border border-apple-border text-apple-xs bg-white">
                    <option value="conversionScore">Conversion Score</option>
                    <option value="volume">Volume</option>
                  </select>
                </>
              )}
              {activeTab === 'negative' && negCategories.length > 0 && (
                <>
                  <span className="text-apple-xs text-apple-text-tertiary">Category:</span>
                  <select value={negCategoryFilter} onChange={(e) => setNegCategoryFilter(e.target.value)}
                    className="px-2 py-1 rounded-apple-sm border border-apple-border text-apple-xs bg-white">
                    <option value="">All ({data.negative.length})</option>
                    {negCategories.map(([cat, count]) => (
                      <option key={cat} value={cat}>{cat} ({count})</option>
                    ))}
                  </select>
                </>
              )}
            </div>

            {/* ─── Match type keyword table ─── */}
            {activeTab !== 'negative' && (
              <div className="divide-y divide-apple-divider">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_80px_80px_90px] gap-2 px-4 py-2 bg-apple-fill-secondary/30 text-apple-xs font-semibold text-apple-text-secondary uppercase tracking-wider">
                  <div>Keyword</div>
                  <div className="text-right">Volume</div>
                  <div className="text-center">Score</div>
                  <div className="text-center">Source</div>
                </div>
                {matchKeywords.length === 0 && (
                  <div className="px-4 py-8 text-center text-apple-sm text-apple-text-tertiary">No keywords match your filters.</div>
                )}
                {matchKeywords.map((kw, i) => (
                  <div key={`${kw.keyword}-${i}`} className="grid grid-cols-[1fr_80px_80px_90px] gap-2 px-4 py-2.5 hover:bg-apple-fill-secondary/30 transition-colors items-center">
                    <div className="text-apple-sm text-apple-text font-medium truncate">
                      {activeTab === 'phrase' ? `"${kw.keyword}"` : activeTab === 'exact' ? `[${kw.keyword}]` : kw.keyword}
                    </div>
                    <div className="text-apple-xs text-apple-text-secondary text-right tabular-nums">
                      {kw.volume != null ? kw.volume.toLocaleString() : '—'}
                    </div>
                    <div className="text-center">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-apple-xs font-bold ${getScoreBg(kw.conversionScore)} ${getScoreColor(kw.conversionScore)}`}>
                        {kw.conversionScore}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className={`px-2 py-0.5 rounded-apple-pill text-[10px] font-bold ${
                        kw.source === 'ranking' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {kw.source === 'ranking' ? 'Ranking' : 'Suggested'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ─── Negative keywords ─── */}
            {activeTab === 'negative' && (
              <div>
                {negCategories.length > 0 && !negCategoryFilter && (
                  /* Grouped view when no filter is active */
                  <div className="divide-y divide-apple-divider">
                    {negCategories.map(([cat, count]) => (
                      <NegativeGroup key={cat} category={cat} keywords={data.negative.filter((k) => k.category === cat)} searchQuery={searchQuery} />
                    ))}
                  </div>
                )}
                {negCategoryFilter && (
                  /* Flat list when a category filter is active */
                  <div className="divide-y divide-apple-divider">
                    {negativeKeywords.length === 0 && (
                      <div className="px-4 py-8 text-center text-apple-sm text-apple-text-tertiary">No keywords match.</div>
                    )}
                    {negativeKeywords.map((kw, i) => (
                      <div key={`${kw.keyword}-${i}`} className="px-4 py-2 hover:bg-apple-fill-secondary/30 transition-colors">
                        <span className="text-apple-sm text-apple-text">{kw.keyword}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {data.generatedAt && (
            <p className="text-apple-xs text-apple-text-tertiary mt-3 text-right">
              Generated {new Date(data.generatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// Collapsible negative keyword category group
function NegativeGroup({ category, keywords, searchQuery }: { category: string; keywords: NegativeKeyword[]; searchQuery: string }) {
  const [expanded, setExpanded] = useState(false);
  const filtered = searchQuery
    ? keywords.filter((k) => k.keyword.toLowerCase().includes(searchQuery.toLowerCase()))
    : keywords;

  if (filtered.length === 0) return null;

  return (
    <div>
      <button onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-apple-fill-secondary/30 transition-colors">
        <div className="flex items-center gap-2">
          <svg className={`w-3.5 h-3.5 text-apple-text-tertiary transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-apple-sm font-medium text-apple-text">{category}</span>
        </div>
        <span className="text-apple-xs text-apple-text-tertiary">{filtered.length} keywords</span>
      </button>
      {expanded && (
        <div className="pl-10 pr-4 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {filtered.map((kw, i) => (
              <span key={i} className="px-2 py-1 rounded-apple-pill bg-red-50 border border-red-100 text-apple-xs text-red-700">{kw.keyword}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
