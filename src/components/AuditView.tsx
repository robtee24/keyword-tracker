import { useState, useEffect, useRef, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { authenticatedFetch } from '../services/authService';

type AuditType = 'seo' | 'content' | 'aeo' | 'schema';
type AuditMode = 'page' | 'keyword' | 'group' | 'site';

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  issue: string;
  recommendation: string;
  impact: string;
}

interface PageResult {
  page_url: string;
  score: number;
  summary: string;
  recommendations: Recommendation[];
  audited_at: string;
  error?: string;
}

interface KeywordGroup {
  id: number;
  name: string;
  keywords: string[];
}

interface AuditViewProps {
  siteUrl: string;
  auditType: AuditType;
  title: string;
  description: string;
}

const PRIORITY_COLORS = {
  high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  low: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
};

function getScoreColor(score: number) {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function getScoreBg(score: number) {
  if (score >= 80) return 'bg-green-50 border-green-200';
  if (score >= 60) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

const MODE_LABELS: Record<AuditMode, { label: string; icon: string; desc: string }> = {
  page: { label: 'By Page', icon: '📄', desc: 'Audit a specific URL' },
  keyword: { label: 'By Keyword', icon: '🔑', desc: 'Audit pages ranking for a keyword' },
  group: { label: 'By Group', icon: '📁', desc: 'Audit all pages in a keyword group' },
  site: { label: 'Full Site', icon: '🌐', desc: 'Audit every page in your sitemap' },
};

export default function AuditView({ siteUrl, auditType, title, description }: AuditViewProps) {
  // Mode selection
  const [mode, setMode] = useState<AuditMode | null>(null);

  // Page mode
  const [pageUrlInput, setPageUrlInput] = useState('');

  // Keyword mode
  const [keywordSearch, setKeywordSearch] = useState('');
  const [allKeywords, setAllKeywords] = useState<string[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [keywordPages, setKeywordPages] = useState<string[]>([]);
  const [loadingKeywordPages, setLoadingKeywordPages] = useState(false);

  // Group mode
  const [groups, setGroups] = useState<KeywordGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<KeywordGroup | null>(null);
  const [groupPages, setGroupPages] = useState<string[]>([]);
  const [loadingGroupPages, setLoadingGroupPages] = useState(false);

  // Audit state
  const [results, setResults] = useState<PageResult[]>([]);
  const [targetUrls, setTargetUrls] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [loadingResults, setLoadingResults] = useState(true);
  const [loadingSitemap, setLoadingSitemap] = useState(false);
  const [currentPage, setCurrentPage] = useState('');
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<'' | 'high' | 'medium' | 'low'>('');
  const abortRef = useRef(false);
  const completedUrlsRef = useRef<Set<string>>(new Set());

  // Load saved results from Supabase on mount
  useEffect(() => {
    if (!siteUrl) return;
    setLoadingResults(true);
    fetch(`${API_ENDPOINTS.db.pageAudits}?siteUrl=${encodeURIComponent(siteUrl)}&auditType=${auditType}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.results) {
          setResults(data.results);
          completedUrlsRef.current = new Set(data.results.map((r: PageResult) => r.page_url));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingResults(false));
  }, [siteUrl, auditType]);

  // Load keywords from DB for suggestions
  useEffect(() => {
    if (!siteUrl) return;
    fetch(`${API_ENDPOINTS.db.keywords}?siteUrl=${encodeURIComponent(siteUrl)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.keywords) {
          setAllKeywords(data.keywords.map((k: any) => k.keyword));
        }
      })
      .catch(() => {});
  }, [siteUrl]);

  // Load keyword groups
  useEffect(() => {
    if (!siteUrl) return;
    fetch(`${API_ENDPOINTS.db.keywordGroups}?siteUrl=${encodeURIComponent(siteUrl)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.groups) setGroups(data.groups);
      })
      .catch(() => {});
  }, [siteUrl]);

  // Keyword suggestions
  const filteredKeywords = keywordSearch.length >= 2
    ? allKeywords.filter((kw) => kw.toLowerCase().includes(keywordSearch.toLowerCase())).slice(0, 10)
    : [];

  // Fetch pages for a keyword via GSC
  const fetchPagesForKeyword = useCallback(async (keyword: string) => {
    setLoadingKeywordPages(true);
    setKeywordPages([]);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 90);
      const resp = await authenticatedFetch(API_ENDPOINTS.google.searchConsole.keywordPages, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          keyword,
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const pages = (data.rows || []).map((r: any) => r.keys?.[1] || '').filter(Boolean);
        setKeywordPages([...new Set(pages)]);
      }
    } catch { /* ignore */ }
    setLoadingKeywordPages(false);
  }, [siteUrl]);

  // Fetch pages for all keywords in a group
  const fetchPagesForGroup = useCallback(async (group: KeywordGroup) => {
    setLoadingGroupPages(true);
    setGroupPages([]);
    const allPages = new Set<string>();
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 90);

    for (const keyword of group.keywords.slice(0, 20)) {
      try {
        const resp = await authenticatedFetch(API_ENDPOINTS.google.searchConsole.keywordPages, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteUrl,
            keyword,
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          for (const r of data.rows || []) {
            const page = r.keys?.[1];
            if (page) allPages.add(page);
          }
        }
      } catch { /* ignore */ }
    }
    setGroupPages([...allPages]);
    setLoadingGroupPages(false);
  }, [siteUrl]);

  const fetchSitemap = useCallback(async () => {
    setLoadingSitemap(true);
    setError(null);
    try {
      const resp = await fetch(
        `${API_ENDPOINTS.audit.sitemap}?siteUrl=${encodeURIComponent(siteUrl)}`
      );
      if (!resp.ok) throw new Error('Failed to fetch sitemap');
      const data = await resp.json();
      if (!data.urls || data.urls.length === 0) {
        throw new Error('No URLs found in sitemap');
      }
      return data.urls as string[];
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoadingSitemap(false);
    }
  }, [siteUrl]);

  const runAuditOnUrls = useCallback(async (urls: string[], clearPrevious: boolean) => {
    if (urls.length === 0) return;
    abortRef.current = false;
    setIsRunning(true);
    setError(null);
    setTargetUrls(urls);

    if (clearPrevious) {
      setResults([]);
      completedUrlsRef.current = new Set();
    }

    const remaining = urls.filter((u) => !completedUrlsRef.current.has(u));

    for (const pageUrl of remaining) {
      if (abortRef.current) break;
      setCurrentPage(pageUrl);

      try {
        const resp = await fetch(API_ENDPOINTS.audit.run, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl, pageUrl, auditType }),
        });

        if (resp.ok) {
          const result = await resp.json();
          const pageResult: PageResult = {
            page_url: result.pageUrl,
            score: result.score,
            summary: result.summary || '',
            recommendations: result.recommendations || [],
            audited_at: new Date().toISOString(),
            error: result.error,
          };
          completedUrlsRef.current.add(pageUrl);
          setResults((prev) => [...prev, pageResult]);
        }
      } catch (err: any) {
        completedUrlsRef.current.add(pageUrl);
        setResults((prev) => [
          ...prev,
          {
            page_url: pageUrl,
            score: 0,
            summary: '',
            recommendations: [],
            audited_at: new Date().toISOString(),
            error: err.message || 'Network error',
          },
        ]);
      }
    }

    setIsRunning(false);
    setCurrentPage('');
  }, [siteUrl, auditType]);

  // Mode-specific start handlers
  const handleStartPage = () => {
    const url = pageUrlInput.trim();
    if (!url) return;
    const fullUrl = url.startsWith('http') ? url : `${siteUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    runAuditOnUrls([fullUrl], true);
  };

  const handleStartKeyword = () => {
    if (keywordPages.length === 0) return;
    runAuditOnUrls(keywordPages, true);
  };

  const handleStartGroup = () => {
    if (groupPages.length === 0) return;
    runAuditOnUrls(groupPages, true);
  };

  const handleStartSite = async () => {
    const urls = await fetchSitemap();
    if (urls.length > 0) {
      try {
        await fetch(API_ENDPOINTS.db.pageAudits, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl, auditType, action: 'clear' }),
        });
      } catch { /* non-critical */ }
      runAuditOnUrls(urls, true);
    }
  };

  const handleResume = () => {
    runAuditOnUrls(targetUrls, false);
  };

  const stopAudit = () => {
    abortRef.current = true;
  };

  const totalPages = targetUrls.length || results.length;
  const completedPages = results.length;
  const progressPct = totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0;
  const avgScore =
    results.length > 0 ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0;
  const hasResumable = completedPages > 0 && completedPages < totalPages && !isRunning;

  const filteredResults = filterPriority
    ? results.filter((r) => r.recommendations.some((rec) => rec.priority === filterPriority))
    : results;

  const sortedResults = [...filteredResults].sort((a, b) => a.score - b.score);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-apple-text mb-1">{title}</h2>
        <p className="text-apple-sm text-apple-text-secondary">{description}</p>
      </div>

      {/* Mode Selection */}
      {!isRunning && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {(Object.keys(MODE_LABELS) as AuditMode[]).map((m) => {
            const info = MODE_LABELS[m];
            const isActive = mode === m;
            return (
              <button
                key={m}
                onClick={() => { setMode(isActive ? null : m); setError(null); }}
                className={`rounded-apple border p-4 text-left transition-all ${
                  isActive
                    ? 'border-apple-blue bg-apple-blue/5 ring-1 ring-apple-blue'
                    : 'border-apple-divider bg-white hover:border-apple-blue/40'
                }`}
              >
                <div className="text-lg mb-1">{info.icon}</div>
                <div className="text-apple-sm font-semibold text-apple-text">{info.label}</div>
                <div className="text-apple-xs text-apple-text-tertiary mt-0.5">{info.desc}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Mode-specific Input Panels */}
      {mode === 'page' && !isRunning && (
        <div className="rounded-apple border border-apple-divider bg-white p-4 mb-6">
          <label className="block text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider mb-2">
            Page URL
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={pageUrlInput}
              onChange={(e) => setPageUrlInput(e.target.value)}
              placeholder={`${siteUrl}/page-path or full URL`}
              className="flex-1 px-3 py-2 rounded-apple-sm border border-apple-border text-apple-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue"
              onKeyDown={(e) => e.key === 'Enter' && handleStartPage()}
            />
            <button
              onClick={handleStartPage}
              disabled={!pageUrlInput.trim()}
              className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
            >
              Audit Page
            </button>
          </div>
        </div>
      )}

      {mode === 'keyword' && !isRunning && (
        <div className="rounded-apple border border-apple-divider bg-white p-4 mb-6">
          <label className="block text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider mb-2">
            Search Keyword
          </label>
          <div className="relative">
            <input
              type="text"
              value={keywordSearch}
              onChange={(e) => { setKeywordSearch(e.target.value); setSelectedKeyword(null); setKeywordPages([]); }}
              placeholder="Type to search your tracked keywords…"
              className="w-full px-3 py-2 rounded-apple-sm border border-apple-border text-apple-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue"
            />
            {filteredKeywords.length > 0 && !selectedKeyword && (
              <div className="absolute z-50 mt-1 w-full bg-white rounded-apple-sm border border-apple-divider shadow-lg max-h-48 overflow-y-auto">
                {filteredKeywords.map((kw) => (
                  <button
                    key={kw}
                    onClick={() => {
                      setSelectedKeyword(kw);
                      setKeywordSearch(kw);
                      fetchPagesForKeyword(kw);
                    }}
                    className="w-full text-left px-3 py-2 text-apple-sm hover:bg-apple-fill-secondary transition-colors"
                  >
                    {kw}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedKeyword && (
            <div className="mt-3">
              {loadingKeywordPages ? (
                <div className="flex items-center gap-2 text-apple-sm text-apple-text-secondary">
                  <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
                  Finding pages ranking for "{selectedKeyword}"…
                </div>
              ) : keywordPages.length > 0 ? (
                <div>
                  <p className="text-apple-sm text-apple-text-secondary mb-2">
                    {keywordPages.length} page{keywordPages.length !== 1 ? 's' : ''} found for "{selectedKeyword}"
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-1 mb-3">
                    {keywordPages.map((url) => (
                      <div key={url} className="text-apple-xs text-apple-text-tertiary truncate px-2 py-1 bg-apple-fill-secondary rounded-apple-sm">
                        {url.replace(/^https?:\/\/[^/]+/, '')}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleStartKeyword}
                    className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors"
                  >
                    Audit {keywordPages.length} Page{keywordPages.length !== 1 ? 's' : ''}
                  </button>
                </div>
              ) : (
                <p className="text-apple-sm text-apple-text-tertiary">No pages found for this keyword.</p>
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'group' && !isRunning && (
        <div className="rounded-apple border border-apple-divider bg-white p-4 mb-6">
          <label className="block text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider mb-2">
            Select Group
          </label>
          {groups.length === 0 ? (
            <p className="text-apple-sm text-apple-text-tertiary">
              No keyword groups found. Create groups in the Keywords view first.
            </p>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => {
                const isSelected = selectedGroup?.id === group.id;
                return (
                  <button
                    key={group.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedGroup(null);
                        setGroupPages([]);
                      } else {
                        setSelectedGroup(group);
                        fetchPagesForGroup(group);
                      }
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-apple-sm border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-apple-blue bg-apple-blue/5'
                        : 'border-apple-divider hover:border-apple-blue/40'
                    }`}
                  >
                    <div>
                      <span className="text-apple-sm font-medium text-apple-text">{group.name}</span>
                      <span className="text-apple-xs text-apple-text-tertiary ml-2">
                        {group.keywords.length} keyword{group.keywords.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {isSelected && (
                      <svg className="w-4 h-4 text-apple-blue" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {selectedGroup && (
            <div className="mt-3">
              {loadingGroupPages ? (
                <div className="flex items-center gap-2 text-apple-sm text-apple-text-secondary">
                  <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
                  Finding pages for {selectedGroup.keywords.length} keywords…
                </div>
              ) : groupPages.length > 0 ? (
                <div>
                  <p className="text-apple-sm text-apple-text-secondary mb-2">
                    {groupPages.length} unique page{groupPages.length !== 1 ? 's' : ''} found
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-1 mb-3">
                    {groupPages.map((url) => (
                      <div key={url} className="text-apple-xs text-apple-text-tertiary truncate px-2 py-1 bg-apple-fill-secondary rounded-apple-sm">
                        {url.replace(/^https?:\/\/[^/]+/, '')}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleStartGroup}
                    className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors"
                  >
                    Audit {groupPages.length} Page{groupPages.length !== 1 ? 's' : ''}
                  </button>
                </div>
              ) : (
                <p className="text-apple-sm text-apple-text-tertiary">No pages found for this group's keywords.</p>
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'site' && !isRunning && (
        <div className="rounded-apple border border-apple-divider bg-white p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-apple-sm font-medium text-apple-text">Full Site Audit</p>
              <p className="text-apple-xs text-apple-text-tertiary mt-0.5">
                Crawls your entire sitemap.xml and audits every page. This may take a while for large sites.
              </p>
            </div>
            <button
              onClick={handleStartSite}
              disabled={loadingSitemap}
              className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50 shrink-0"
            >
              {loadingSitemap ? 'Loading Sitemap…' : 'Start Full Audit'}
            </button>
          </div>
        </div>
      )}

      {/* Running / Resume Controls */}
      {isRunning && (
        <div className="rounded-apple border border-apple-divider bg-white p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-apple-sm font-medium text-apple-text">Audit in progress…</span>
            <button
              onClick={stopAudit}
              className="px-3 py-1.5 rounded-apple-sm border border-apple-red text-apple-red text-apple-xs font-medium hover:bg-red-50 transition-colors"
            >
              Stop
            </button>
          </div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-apple-xs text-apple-text-secondary">
              {completedPages} / {totalPages} pages
            </span>
            <span className="text-apple-xs text-apple-text-tertiary">{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-apple-fill-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-apple-blue animate-pulse transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {currentPage && (
            <p className="mt-1.5 text-apple-xs text-apple-text-tertiary truncate">
              Analyzing: {currentPage}
            </p>
          )}
        </div>
      )}

      {hasResumable && !isRunning && (
        <div className="rounded-apple border border-amber-200 bg-amber-50/40 px-4 py-3 mb-6 flex items-center justify-between">
          <div className="text-apple-sm text-amber-800">
            Audit paused — {totalPages - completedPages} page{totalPages - completedPages !== 1 ? 's' : ''} remaining
          </div>
          <button
            onClick={handleResume}
            className="px-3 py-1.5 rounded-apple-sm border border-apple-blue text-apple-blue text-apple-xs font-medium hover:bg-apple-blue/5 transition-colors"
          >
            Resume
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className={`rounded-apple border p-4 text-center ${getScoreBg(avgScore)}`}>
            <div className={`text-2xl font-bold ${getScoreColor(avgScore)}`}>{avgScore}</div>
            <div className="text-apple-xs text-apple-text-secondary mt-1">Avg Score</div>
          </div>
          <div className="rounded-apple border border-apple-divider bg-white p-4 text-center">
            <div className="text-2xl font-bold text-apple-text">{completedPages}</div>
            <div className="text-apple-xs text-apple-text-secondary mt-1">Pages Audited</div>
          </div>
          <div className="rounded-apple border border-red-200 bg-red-50 p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {results.reduce((n, r) => n + r.recommendations.filter((rec) => rec.priority === 'high').length, 0)}
            </div>
            <div className="text-apple-xs text-apple-text-secondary mt-1">High Priority</div>
          </div>
          <div className="rounded-apple border border-amber-200 bg-amber-50 p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">
              {results.reduce((n, r) => n + r.recommendations.length, 0)}
            </div>
            <div className="text-apple-xs text-apple-text-secondary mt-1">Total Recs</div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      {results.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-apple-xs text-apple-text-tertiary">Filter by priority:</span>
          {(['high', 'medium', 'low'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setFilterPriority(filterPriority === p ? '' : p)}
              className={`px-2.5 py-1 rounded-apple-pill text-apple-xs font-medium transition-colors ${
                filterPriority === p
                  ? `${PRIORITY_COLORS[p].bg} ${PRIORITY_COLORS[p].text} border ${PRIORITY_COLORS[p].border}`
                  : 'bg-apple-fill-secondary text-apple-text-secondary hover:bg-gray-200'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
          {filterPriority && (
            <button
              onClick={() => setFilterPriority('')}
              className="text-apple-xs text-apple-text-tertiary hover:text-apple-text"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Loading State */}
      {loadingResults && results.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-apple-sm text-apple-text-secondary">Loading saved results…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-apple border border-apple-red/20 bg-red-50/30 px-4 py-3 mb-6 text-apple-sm text-apple-red">
          {error}
        </div>
      )}

      {/* Results Table */}
      {sortedResults.length > 0 && (
        <div className="rounded-apple border border-apple-divider bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-apple-divider bg-apple-fill-secondary flex items-center justify-between">
            <span className="text-apple-sm font-semibold text-apple-text-secondary">
              {filteredResults.length} page{filteredResults.length !== 1 ? 's' : ''}
              {filterPriority && ` with ${filterPriority} priority issues`}
            </span>
          </div>

          <div className="divide-y divide-apple-divider">
            {sortedResults.map((result) => {
              const isExpanded = expandedPage === result.page_url;
              const highCount = result.recommendations.filter((r) => r.priority === 'high').length;
              const medCount = result.recommendations.filter((r) => r.priority === 'medium').length;
              const lowCount = result.recommendations.filter((r) => r.priority === 'low').length;

              return (
                <div key={result.page_url}>
                  <button
                    className="w-full px-4 py-3 flex items-center gap-4 hover:bg-apple-fill-secondary/50 transition-colors text-left"
                    onClick={() => setExpandedPage(isExpanded ? null : result.page_url)}
                  >
                    <span className={`text-lg font-bold w-12 text-center ${getScoreColor(result.score)}`}>
                      {result.score}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-apple-sm font-medium text-apple-text truncate">
                        {result.page_url.replace(/^https?:\/\/[^/]+/, '')}
                      </p>
                      {result.summary && (
                        <p className="text-apple-xs text-apple-text-tertiary truncate mt-0.5">
                          {result.summary}
                        </p>
                      )}
                      {result.error && (
                        <p className="text-apple-xs text-red-500 truncate mt-0.5">Error: {result.error}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {highCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-apple-pill text-[10px] font-bold bg-red-100 text-red-700">
                          {highCount} high
                        </span>
                      )}
                      {medCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-apple-pill text-[10px] font-bold bg-amber-100 text-amber-700">
                          {medCount} med
                        </span>
                      )}
                      {lowCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-apple-pill text-[10px] font-bold bg-blue-100 text-blue-700">
                          {lowCount} low
                        </span>
                      )}
                    </div>
                    <svg
                      className={`w-4 h-4 text-apple-text-tertiary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isExpanded && result.recommendations.length > 0 && (
                    <div className="px-4 pb-4 pt-1 bg-apple-fill-secondary/30">
                      <div className="ml-12 space-y-2">
                        {result.recommendations
                          .filter((rec) => !filterPriority || rec.priority === filterPriority)
                          .map((rec, i) => {
                            const pc = PRIORITY_COLORS[rec.priority] || PRIORITY_COLORS.low;
                            return (
                              <div key={i} className={`rounded-apple-sm border ${pc.border} ${pc.bg} p-3`}>
                                <div className="flex items-start gap-2">
                                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${pc.dot}`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className={`text-apple-xs font-bold uppercase ${pc.text}`}>
                                        {rec.priority}
                                      </span>
                                      <span className="text-apple-xs text-apple-text-tertiary">{rec.category}</span>
                                    </div>
                                    <p className="text-apple-sm font-medium text-apple-text">{rec.issue}</p>
                                    <p className="text-apple-sm text-apple-text-secondary mt-1">{rec.recommendation}</p>
                                    {rec.impact && (
                                      <p className="text-apple-xs text-apple-text-tertiary mt-1">Impact: {rec.impact}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
