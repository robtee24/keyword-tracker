import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { authenticatedFetch } from '../services/authService';

type AuditType = 'seo' | 'content' | 'aeo' | 'schema';
type AuditMode = 'page' | 'keyword' | 'group' | 'site';
type ResultsTab = 'summary' | 'pages' | 'recommendations';

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
  strengths: string[];
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
function getScoreLabel(score: number) {
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Needs Work';
  return 'Poor';
}

const MODE_INFO: Record<AuditMode, { label: string; icon: string; desc: string }> = {
  page: { label: 'By Page', icon: '📄', desc: 'Audit a specific URL' },
  keyword: { label: 'By Keyword', icon: '🔑', desc: 'Audit pages ranking for a keyword' },
  group: { label: 'By Group', icon: '📁', desc: 'Audit all pages in a keyword group' },
  site: { label: 'Full Site', icon: '🌐', desc: 'Audit every page in your sitemap' },
};

const PAGES_PER_PAGE = 20;
const RECS_PER_PAGE = 30;

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
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);
  const completedUrlsRef = useRef<Set<string>>(new Set());

  // Results view state
  const [resultsTab, setResultsTab] = useState<ResultsTab>('summary');
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [pageSearch, setPageSearch] = useState('');
  const [scoreFilter, setScoreFilter] = useState<'' | 'poor' | 'needs-work' | 'good'>('');
  const [priorityFilter, setPriorityFilter] = useState<'' | 'high' | 'medium' | 'low'>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [pagesPage, setPagesPage] = useState(1);
  const [recsPage, setRecsPage] = useState(1);

  // Load saved results from Supabase on mount
  useEffect(() => {
    if (!siteUrl) return;
    setLoadingResults(true);
    fetch(`${API_ENDPOINTS.db.pageAudits}?siteUrl=${encodeURIComponent(siteUrl)}&auditType=${auditType}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.results) {
          const mapped = data.results.map((r: any) => ({
            ...r,
            strengths: Array.isArray(r.strengths) ? r.strengths : [],
          }));
          setResults(mapped);
          completedUrlsRef.current = new Set(mapped.map((r: PageResult) => r.page_url));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingResults(false));
  }, [siteUrl, auditType]);

  // Load keywords for suggestions
  useEffect(() => {
    if (!siteUrl) return;
    fetch(`${API_ENDPOINTS.db.keywords}?siteUrl=${encodeURIComponent(siteUrl)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.keywords) setAllKeywords(data.keywords.map((k: any) => k.keyword)); })
      .catch(() => {});
  }, [siteUrl]);

  // Load keyword groups
  useEffect(() => {
    if (!siteUrl) return;
    fetch(`${API_ENDPOINTS.db.keywordGroups}?siteUrl=${encodeURIComponent(siteUrl)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.groups) setGroups(data.groups); })
      .catch(() => {});
  }, [siteUrl]);

  const filteredKeywords = keywordSearch.length >= 2
    ? allKeywords.filter((kw) => kw.toLowerCase().includes(keywordSearch.toLowerCase())).slice(0, 10)
    : [];

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
        body: JSON.stringify({ siteUrl, keyword, startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const pages: string[] = (data.rows || []).map((r: any) => r.keys?.[1] || '').filter(Boolean);
        setKeywordPages([...new Set(pages)]);
      }
    } catch { /* ignore */ }
    setLoadingKeywordPages(false);
  }, [siteUrl]);

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
          body: JSON.stringify({ siteUrl, keyword, startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] }),
        });
        if (resp.ok) {
          const data = await resp.json();
          for (const r of data.rows || []) { const p = r.keys?.[1]; if (p) allPages.add(p); }
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
      const resp = await fetch(`${API_ENDPOINTS.audit.sitemap}?siteUrl=${encodeURIComponent(siteUrl)}`);
      if (!resp.ok) throw new Error('Failed to fetch sitemap');
      const data = await resp.json();
      if (!data.urls || data.urls.length === 0) throw new Error('No URLs found in sitemap');
      return data.urls as string[];
    } catch (err: any) { setError(err.message); return []; }
    finally { setLoadingSitemap(false); }
  }, [siteUrl]);

  const runAuditOnUrls = useCallback(async (urls: string[], clearPrevious: boolean) => {
    if (urls.length === 0) return;
    abortRef.current = false;
    setIsRunning(true);
    setError(null);
    setTargetUrls(urls);
    if (clearPrevious) { setResults([]); completedUrlsRef.current = new Set(); }
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
          completedUrlsRef.current.add(pageUrl);
          setResults((prev) => [...prev, {
            page_url: result.pageUrl,
            score: result.score,
            summary: result.summary || '',
            strengths: Array.isArray(result.strengths) ? result.strengths : [],
            recommendations: result.recommendations || [],
            audited_at: new Date().toISOString(),
            error: result.error,
          }]);
        }
      } catch (err: any) {
        completedUrlsRef.current.add(pageUrl);
        setResults((prev) => [...prev, { page_url: pageUrl, score: 0, summary: '', strengths: [], recommendations: [], audited_at: new Date().toISOString(), error: err.message || 'Network error' }]);
      }
    }
    setIsRunning(false);
    setCurrentPage('');
  }, [siteUrl, auditType]);

  const handleStartPage = () => {
    const url = pageUrlInput.trim();
    if (!url) return;
    const fullUrl = url.startsWith('http') ? url : `${siteUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    runAuditOnUrls([fullUrl], true);
  };
  const handleStartKeyword = () => { if (keywordPages.length > 0) runAuditOnUrls(keywordPages, true); };
  const handleStartGroup = () => { if (groupPages.length > 0) runAuditOnUrls(groupPages, true); };
  const handleStartSite = async () => {
    const urls = await fetchSitemap();
    if (urls.length > 0) {
      try { await fetch(API_ENDPOINTS.db.pageAudits, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteUrl, auditType, action: 'clear' }) }); } catch { /* */ }
      runAuditOnUrls(urls, true);
    }
  };
  const handleResume = () => runAuditOnUrls(targetUrls, false);
  const stopAudit = () => { abortRef.current = true; };

  const totalPages = targetUrls.length || results.length;
  const completedCount = results.length;
  const progressPct = totalPages > 0 ? Math.round((completedCount / totalPages) * 100) : 0;
  const hasResumable = completedCount > 0 && completedCount < totalPages && !isRunning;

  // ─── Computed data for results tabs ───
  const avgScore = useMemo(() =>
    results.length > 0 ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0,
  [results]);

  const scoreBuckets = useMemo(() => {
    const poor = results.filter((r) => r.score < 60).length;
    const mid = results.filter((r) => r.score >= 60 && r.score < 80).length;
    const good = results.filter((r) => r.score >= 80).length;
    return { poor, mid, good };
  }, [results]);

  // Top issues: group all recommendations by category, count occurrences
  const topIssues = useMemo(() => {
    const map = new Map<string, { count: number; priority: string; example: string }>();
    for (const r of results) {
      for (const rec of r.recommendations) {
        const key = rec.category;
        const existing = map.get(key);
        if (existing) { existing.count++; }
        else { map.set(key, { count: 1, priority: rec.priority, example: rec.issue }); }
      }
    }
    return [...map.entries()]
      .map(([cat, v]) => ({ category: cat, ...v }))
      .sort((a, b) => b.count - a.count);
  }, [results]);

  // All categories for the category filter
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const r of results) for (const rec of r.recommendations) cats.add(rec.category);
    return [...cats].sort();
  }, [results]);

  // Pages tab: filtered, searched, paginated
  const filteredPageResults = useMemo(() => {
    let list = results;
    if (pageSearch) {
      const q = pageSearch.toLowerCase();
      list = list.filter((r) => r.page_url.toLowerCase().includes(q));
    }
    if (scoreFilter === 'poor') list = list.filter((r) => r.score < 60);
    else if (scoreFilter === 'needs-work') list = list.filter((r) => r.score >= 60 && r.score < 80);
    else if (scoreFilter === 'good') list = list.filter((r) => r.score >= 80);
    return list.sort((a, b) => a.score - b.score);
  }, [results, pageSearch, scoreFilter]);

  const paginatedPages = useMemo(() => {
    const start = (pagesPage - 1) * PAGES_PER_PAGE;
    return filteredPageResults.slice(start, start + PAGES_PER_PAGE);
  }, [filteredPageResults, pagesPage]);

  const totalPagesPages = Math.ceil(filteredPageResults.length / PAGES_PER_PAGE);

  // Recs tab: flatten all recs with page context, filter, paginate
  const allRecs = useMemo(() => {
    const flat: Array<Recommendation & { page_url: string }> = [];
    for (const r of results) {
      for (const rec of r.recommendations) {
        flat.push({ ...rec, page_url: r.page_url });
      }
    }
    return flat;
  }, [results]);

  const filteredRecs = useMemo(() => {
    let list = allRecs;
    if (priorityFilter) list = list.filter((r) => r.priority === priorityFilter);
    if (categoryFilter) list = list.filter((r) => r.category === categoryFilter);
    const order = { high: 0, medium: 1, low: 2 };
    return list.sort((a, b) => order[a.priority] - order[b.priority]);
  }, [allRecs, priorityFilter, categoryFilter]);

  const paginatedRecs = useMemo(() => {
    const start = (recsPage - 1) * RECS_PER_PAGE;
    return filteredRecs.slice(start, start + RECS_PER_PAGE);
  }, [filteredRecs, recsPage]);

  const totalRecsPages = Math.ceil(filteredRecs.length / RECS_PER_PAGE);

  // Reset pagination when filters change
  useEffect(() => { setPagesPage(1); }, [pageSearch, scoreFilter]);
  useEffect(() => { setRecsPage(1); }, [priorityFilter, categoryFilter]);

  // ─── Render ───
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
          {(Object.keys(MODE_INFO) as AuditMode[]).map((m) => {
            const info = MODE_INFO[m];
            const isActive = mode === m;
            return (
              <button key={m} onClick={() => { setMode(isActive ? null : m); setError(null); }}
                className={`rounded-apple border p-4 text-left transition-all ${isActive ? 'border-apple-blue bg-apple-blue/5 ring-1 ring-apple-blue' : 'border-apple-divider bg-white hover:border-apple-blue/40'}`}>
                <div className="text-lg mb-1">{info.icon}</div>
                <div className="text-apple-sm font-semibold text-apple-text">{info.label}</div>
                <div className="text-apple-xs text-apple-text-tertiary mt-0.5">{info.desc}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Mode-specific panels */}
      {mode === 'page' && !isRunning && (
        <div className="rounded-apple border border-apple-divider bg-white p-4 mb-6">
          <label className="block text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider mb-2">Page URL</label>
          <div className="flex gap-2">
            <input type="text" value={pageUrlInput} onChange={(e) => setPageUrlInput(e.target.value)}
              placeholder={`${siteUrl}/page-path or full URL`}
              className="flex-1 px-3 py-2 rounded-apple-sm border border-apple-border text-apple-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue"
              onKeyDown={(e) => e.key === 'Enter' && handleStartPage()} />
            <button onClick={handleStartPage} disabled={!pageUrlInput.trim()}
              className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50">
              Audit Page
            </button>
          </div>
        </div>
      )}

      {mode === 'keyword' && !isRunning && (
        <div className="rounded-apple border border-apple-divider bg-white p-4 mb-6">
          <label className="block text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider mb-2">Search Keyword</label>
          <div className="relative">
            <input type="text" value={keywordSearch}
              onChange={(e) => { setKeywordSearch(e.target.value); setSelectedKeyword(null); setKeywordPages([]); }}
              placeholder="Type to search your tracked keywords…"
              className="w-full px-3 py-2 rounded-apple-sm border border-apple-border text-apple-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue" />
            {filteredKeywords.length > 0 && !selectedKeyword && (
              <div className="absolute z-50 mt-1 w-full bg-white rounded-apple-sm border border-apple-divider shadow-lg max-h-48 overflow-y-auto">
                {filteredKeywords.map((kw) => (
                  <button key={kw} onClick={() => { setSelectedKeyword(kw); setKeywordSearch(kw); fetchPagesForKeyword(kw); }}
                    className="w-full text-left px-3 py-2 text-apple-sm hover:bg-apple-fill-secondary transition-colors">{kw}</button>
                ))}
              </div>
            )}
          </div>
          {selectedKeyword && (
            <div className="mt-3">
              {loadingKeywordPages ? (
                <div className="flex items-center gap-2 text-apple-sm text-apple-text-secondary">
                  <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
                  Finding pages for "{selectedKeyword}"…
                </div>
              ) : keywordPages.length > 0 ? (
                <div>
                  <p className="text-apple-sm text-apple-text-secondary mb-2">{keywordPages.length} page{keywordPages.length !== 1 ? 's' : ''} found</p>
                  <button onClick={handleStartKeyword}
                    className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors">
                    Audit {keywordPages.length} Page{keywordPages.length !== 1 ? 's' : ''}
                  </button>
                </div>
              ) : <p className="text-apple-sm text-apple-text-tertiary">No pages found.</p>}
            </div>
          )}
        </div>
      )}

      {mode === 'group' && !isRunning && (
        <div className="rounded-apple border border-apple-divider bg-white p-4 mb-6">
          <label className="block text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider mb-2">Select Group</label>
          {groups.length === 0 ? <p className="text-apple-sm text-apple-text-tertiary">No keyword groups found.</p> : (
            <div className="space-y-2">
              {groups.map((group) => {
                const isSel = selectedGroup?.id === group.id;
                return (
                  <button key={group.id} onClick={() => { if (isSel) { setSelectedGroup(null); setGroupPages([]); } else { setSelectedGroup(group); fetchPagesForGroup(group); } }}
                    className={`w-full text-left px-3 py-2.5 rounded-apple-sm border transition-all flex items-center justify-between ${isSel ? 'border-apple-blue bg-apple-blue/5' : 'border-apple-divider hover:border-apple-blue/40'}`}>
                    <div>
                      <span className="text-apple-sm font-medium text-apple-text">{group.name}</span>
                      <span className="text-apple-xs text-apple-text-tertiary ml-2">{group.keywords.length} keywords</span>
                    </div>
                    {isSel && <svg className="w-4 h-4 text-apple-blue" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
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
                  Finding pages…
                </div>
              ) : groupPages.length > 0 ? (
                <div>
                  <p className="text-apple-sm text-apple-text-secondary mb-2">{groupPages.length} unique pages found</p>
                  <button onClick={handleStartGroup}
                    className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors">
                    Audit {groupPages.length} Page{groupPages.length !== 1 ? 's' : ''}
                  </button>
                </div>
              ) : <p className="text-apple-sm text-apple-text-tertiary">No pages found.</p>}
            </div>
          )}
        </div>
      )}

      {mode === 'site' && !isRunning && (
        <div className="rounded-apple border border-apple-divider bg-white p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-apple-sm font-medium text-apple-text">Full Site Audit</p>
            <p className="text-apple-xs text-apple-text-tertiary mt-0.5">Crawls your entire sitemap and audits every page.</p>
          </div>
          <button onClick={handleStartSite} disabled={loadingSitemap}
            className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50 shrink-0">
            {loadingSitemap ? 'Loading…' : 'Start Full Audit'}
          </button>
        </div>
      )}

      {/* Progress bar */}
      {isRunning && (
        <div className="rounded-apple border border-apple-divider bg-white p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-apple-sm font-medium text-apple-text">Audit in progress…</span>
            <button onClick={stopAudit} className="px-3 py-1.5 rounded-apple-sm border border-apple-red text-apple-red text-apple-xs font-medium hover:bg-red-50 transition-colors">Stop</button>
          </div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-apple-xs text-apple-text-secondary">{completedCount} / {totalPages} pages</span>
            <span className="text-apple-xs text-apple-text-tertiary">{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-apple-fill-secondary rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-apple-blue animate-pulse transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          {currentPage && <p className="mt-1.5 text-apple-xs text-apple-text-tertiary truncate">Analyzing: {currentPage}</p>}
        </div>
      )}

      {hasResumable && !isRunning && (
        <div className="rounded-apple border border-amber-200 bg-amber-50/40 px-4 py-3 mb-6 flex items-center justify-between">
          <span className="text-apple-sm text-amber-800">Audit paused — {totalPages - completedCount} remaining</span>
          <button onClick={handleResume} className="px-3 py-1.5 rounded-apple-sm border border-apple-blue text-apple-blue text-apple-xs font-medium hover:bg-apple-blue/5 transition-colors">Resume</button>
        </div>
      )}

      {/* Loading */}
      {loadingResults && results.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-apple-sm text-apple-text-secondary">Loading saved results…</span>
        </div>
      )}

      {error && <div className="rounded-apple border border-apple-red/20 bg-red-50/30 px-4 py-3 mb-6 text-apple-sm text-apple-red">{error}</div>}

      {/* ═══════ RESULTS SECTION ═══════ */}
      {results.length > 0 && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-apple-divider mb-6">
            {([
              { id: 'summary' as const, label: 'Summary' },
              { id: 'pages' as const, label: `By Page (${results.length})` },
              { id: 'recommendations' as const, label: `All Recommendations (${allRecs.length})` },
            ]).map((tab) => (
              <button key={tab.id} onClick={() => setResultsTab(tab.id)}
                className={`px-4 py-2.5 text-apple-sm font-medium border-b-2 transition-colors -mb-px ${
                  resultsTab === tab.id ? 'border-apple-blue text-apple-blue' : 'border-transparent text-apple-text-secondary hover:text-apple-text'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ─── Summary Tab ─── */}
          {resultsTab === 'summary' && (
            <div className="space-y-6">
              {/* Overall score + status */}
              <div className={`rounded-apple border p-6 ${getScoreBg(avgScore)}`}>
                <div className="flex items-start gap-6">
                  <div className="text-center">
                    <div className={`text-4xl font-bold ${getScoreColor(avgScore)}`}>{avgScore}</div>
                    <div className={`text-apple-sm font-medium mt-1 ${getScoreColor(avgScore)}`}>{getScoreLabel(avgScore)}</div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-apple-body font-semibold text-apple-text mb-2">Overall {title} Status</h3>
                    <p className="text-apple-sm text-apple-text-secondary">
                      Audited {results.length} page{results.length !== 1 ? 's' : ''} with an average score of {avgScore}/100.
                      {scoreBuckets.poor > 0 && ` ${scoreBuckets.poor} page${scoreBuckets.poor !== 1 ? 's' : ''} need${scoreBuckets.poor === 1 ? 's' : ''} urgent attention (score below 60).`}
                      {scoreBuckets.good > 0 && ` ${scoreBuckets.good} page${scoreBuckets.good !== 1 ? 's are' : ' is'} performing well (score 80+).`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Score distribution */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-apple border border-red-200 bg-red-50 p-4 text-center cursor-pointer hover:ring-1 hover:ring-red-300 transition-all"
                  onClick={() => { setScoreFilter('poor'); setResultsTab('pages'); }}>
                  <div className="text-2xl font-bold text-red-600">{scoreBuckets.poor}</div>
                  <div className="text-apple-xs text-apple-text-secondary mt-1">Poor (&lt;60)</div>
                  <div className="w-full h-1.5 bg-red-200 rounded-full mt-2">
                    <div className="h-full bg-red-500 rounded-full" style={{ width: `${results.length > 0 ? (scoreBuckets.poor / results.length) * 100 : 0}%` }} />
                  </div>
                </div>
                <div className="rounded-apple border border-amber-200 bg-amber-50 p-4 text-center cursor-pointer hover:ring-1 hover:ring-amber-300 transition-all"
                  onClick={() => { setScoreFilter('needs-work'); setResultsTab('pages'); }}>
                  <div className="text-2xl font-bold text-amber-600">{scoreBuckets.mid}</div>
                  <div className="text-apple-xs text-apple-text-secondary mt-1">Needs Work (60-79)</div>
                  <div className="w-full h-1.5 bg-amber-200 rounded-full mt-2">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${results.length > 0 ? (scoreBuckets.mid / results.length) * 100 : 0}%` }} />
                  </div>
                </div>
                <div className="rounded-apple border border-green-200 bg-green-50 p-4 text-center cursor-pointer hover:ring-1 hover:ring-green-300 transition-all"
                  onClick={() => { setScoreFilter('good'); setResultsTab('pages'); }}>
                  <div className="text-2xl font-bold text-green-600">{scoreBuckets.good}</div>
                  <div className="text-apple-xs text-apple-text-secondary mt-1">Good (80+)</div>
                  <div className="w-full h-1.5 bg-green-200 rounded-full mt-2">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${results.length > 0 ? (scoreBuckets.good / results.length) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>

              {/* Top issues by frequency */}
              {topIssues.length > 0 && (
                <div className="rounded-apple border border-apple-divider bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b border-apple-divider bg-apple-fill-secondary">
                    <span className="text-apple-sm font-semibold text-apple-text-secondary">Most Common Issues</span>
                  </div>
                  <div className="divide-y divide-apple-divider">
                    {topIssues.slice(0, 10).map((issue) => {
                      const pc = PRIORITY_COLORS[issue.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.low;
                      return (
                        <button key={issue.category}
                          onClick={() => { setCategoryFilter(issue.category); setResultsTab('recommendations'); }}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-apple-fill-secondary/50 transition-colors text-left">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${pc.dot}`} />
                          <div className="flex-1 min-w-0">
                            <span className="text-apple-sm font-medium text-apple-text">{issue.category}</span>
                            <span className="text-apple-xs text-apple-text-tertiary ml-2">{issue.example}</span>
                          </div>
                          <span className="text-apple-sm font-bold text-apple-text-secondary shrink-0">
                            {issue.count} page{issue.count !== 1 ? 's' : ''}
                          </span>
                          <svg className="w-3.5 h-3.5 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Common strengths */}
              {(() => {
                const allStr: string[] = [];
                for (const r of results) for (const s of r.strengths || []) allStr.push(s);
                const freq = new Map<string, number>();
                for (const s of allStr) freq.set(s, (freq.get(s) || 0) + 1);
                const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
                if (top.length === 0) return null;
                return (
                  <div className="rounded-apple border border-green-200 bg-green-50/40 p-4">
                    <h4 className="text-apple-sm font-semibold text-green-800 mb-2">What Your Site Does Well</h4>
                    <ul className="space-y-1.5">
                      {top.map(([str, count]) => (
                        <li key={str} className="flex items-start gap-2 text-apple-sm text-green-700">
                          <svg className="w-4 h-4 mt-0.5 shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span>{str} <span className="text-green-600/60">({count} page{count !== 1 ? 's' : ''})</span></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ─── By Page Tab ─── */}
          {resultsTab === 'pages' && (
            <div>
              {/* Search + filters */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input type="text" value={pageSearch} onChange={(e) => setPageSearch(e.target.value)}
                    placeholder="Search pages…"
                    className="w-full pl-9 pr-3 py-2 rounded-apple-sm border border-apple-border text-apple-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue" />
                </div>
                {(['poor', 'needs-work', 'good'] as const).map((f) => {
                  const labels = { poor: 'Poor', 'needs-work': 'Needs Work', good: 'Good' };
                  const colors = { poor: 'text-red-700 bg-red-50 border-red-200', 'needs-work': 'text-amber-700 bg-amber-50 border-amber-200', good: 'text-green-700 bg-green-50 border-green-200' };
                  return (
                    <button key={f} onClick={() => setScoreFilter(scoreFilter === f ? '' : f)}
                      className={`px-2.5 py-1.5 rounded-apple-pill text-apple-xs font-medium transition-colors border ${scoreFilter === f ? colors[f] : 'bg-apple-fill-secondary text-apple-text-secondary border-transparent hover:bg-gray-200'}`}>
                      {labels[f]}
                    </button>
                  );
                })}
              </div>

              {/* Page count */}
              <div className="text-apple-xs text-apple-text-tertiary mb-3">
                Showing {paginatedPages.length} of {filteredPageResults.length} pages
              </div>

              {/* Page rows */}
              <div className="rounded-apple border border-apple-divider bg-white overflow-hidden divide-y divide-apple-divider">
                {paginatedPages.map((result) => {
                  const isExp = expandedPage === result.page_url;
                  return (
                    <div key={result.page_url}>
                      <button className="w-full px-4 py-3 flex items-center gap-4 hover:bg-apple-fill-secondary/50 transition-colors text-left"
                        onClick={() => setExpandedPage(isExp ? null : result.page_url)}>
                        <span className={`text-lg font-bold w-12 text-center shrink-0 ${getScoreColor(result.score)}`}>{result.score}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-apple-sm font-medium text-apple-text truncate">{result.page_url.replace(/^https?:\/\/[^/]+/, '') || '/'}</p>
                          {result.summary && <p className="text-apple-xs text-apple-text-tertiary truncate mt-0.5">{result.summary}</p>}
                          {result.error && <p className="text-apple-xs text-red-500 truncate mt-0.5">Error: {result.error}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {result.recommendations.filter((r) => r.priority === 'high').length > 0 && (
                            <span className="px-1.5 py-0.5 rounded-apple-pill text-[10px] font-bold bg-red-100 text-red-700">
                              {result.recommendations.filter((r) => r.priority === 'high').length}H
                            </span>
                          )}
                          {result.recommendations.filter((r) => r.priority === 'medium').length > 0 && (
                            <span className="px-1.5 py-0.5 rounded-apple-pill text-[10px] font-bold bg-amber-100 text-amber-700">
                              {result.recommendations.filter((r) => r.priority === 'medium').length}M
                            </span>
                          )}
                          {result.recommendations.filter((r) => r.priority === 'low').length > 0 && (
                            <span className="px-1.5 py-0.5 rounded-apple-pill text-[10px] font-bold bg-blue-100 text-blue-700">
                              {result.recommendations.filter((r) => r.priority === 'low').length}L
                            </span>
                          )}
                        </div>
                        <svg className={`w-4 h-4 text-apple-text-tertiary transition-transform shrink-0 ${isExp ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {isExp && (
                        <div className="px-4 pb-4 pt-2 bg-apple-fill-secondary/30 border-t border-apple-divider/50">
                          {/* Page summary */}
                          {result.summary && (
                            <div className={`rounded-apple-sm border p-3 mb-3 ${getScoreBg(result.score)}`}>
                              <p className="text-apple-sm text-apple-text">{result.summary}</p>
                            </div>
                          )}
                          {/* Strengths */}
                          {result.strengths?.length > 0 && (
                            <div className="rounded-apple-sm border border-green-200 bg-green-50/40 p-3 mb-3">
                              <p className="text-apple-xs font-semibold text-green-800 mb-1.5">Doing Well</p>
                              <ul className="space-y-1">
                                {result.strengths.map((s, i) => (
                                  <li key={i} className="flex items-start gap-1.5 text-apple-xs text-green-700">
                                    <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {/* Recommendations */}
                          {result.recommendations.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-apple-xs font-semibold text-apple-text-secondary">Needs Improvement</p>
                              {result.recommendations.map((rec, i) => {
                                const pc = PRIORITY_COLORS[rec.priority] || PRIORITY_COLORS.low;
                                return (
                                  <div key={i} className={`rounded-apple-sm border ${pc.border} ${pc.bg} p-3`}>
                                    <div className="flex items-start gap-2">
                                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${pc.dot}`} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                          <span className={`text-apple-xs font-bold uppercase ${pc.text}`}>{rec.priority}</span>
                                          <span className="text-apple-xs text-apple-text-tertiary">{rec.category}</span>
                                        </div>
                                        <p className="text-apple-sm font-medium text-apple-text">{rec.issue}</p>
                                        <p className="text-apple-sm text-apple-text-secondary mt-1">{rec.recommendation}</p>
                                        {rec.impact && <p className="text-apple-xs text-apple-text-tertiary mt-1">Impact: {rec.impact}</p>}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPagesPages > 1 && <Pagination current={pagesPage} total={totalPagesPages} onChange={setPagesPage} />}
            </div>
          )}

          {/* ─── All Recommendations Tab ─── */}
          {resultsTab === 'recommendations' && (
            <div>
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-apple-xs text-apple-text-tertiary">Priority:</span>
                {(['high', 'medium', 'low'] as const).map((p) => (
                  <button key={p} onClick={() => setPriorityFilter(priorityFilter === p ? '' : p)}
                    className={`px-2.5 py-1 rounded-apple-pill text-apple-xs font-medium transition-colors border ${
                      priorityFilter === p
                        ? `${PRIORITY_COLORS[p].bg} ${PRIORITY_COLORS[p].text} ${PRIORITY_COLORS[p].border}`
                        : 'bg-apple-fill-secondary text-apple-text-secondary border-transparent hover:bg-gray-200'
                    }`}>
                    {p.charAt(0).toUpperCase() + p.slice(1)} ({allRecs.filter((r) => r.priority === p).length})
                  </button>
                ))}
                <span className="text-apple-xs text-apple-text-tertiary ml-2">Category:</span>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-2 py-1 rounded-apple-sm border border-apple-border text-apple-xs bg-white focus:outline-none focus:ring-2 focus:ring-apple-blue/30">
                  <option value="">All ({allRecs.length})</option>
                  {allCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat} ({allRecs.filter((r) => r.category === cat).length})</option>
                  ))}
                </select>
                {(priorityFilter || categoryFilter) && (
                  <button onClick={() => { setPriorityFilter(''); setCategoryFilter(''); }}
                    className="text-apple-xs text-apple-text-tertiary hover:text-apple-text ml-1">Clear all</button>
                )}
              </div>

              <div className="text-apple-xs text-apple-text-tertiary mb-3">
                Showing {paginatedRecs.length} of {filteredRecs.length} recommendations
              </div>

              <div className="rounded-apple border border-apple-divider bg-white overflow-hidden divide-y divide-apple-divider">
                {paginatedRecs.map((rec, i) => {
                  const pc = PRIORITY_COLORS[rec.priority] || PRIORITY_COLORS.low;
                  return (
                    <div key={`${rec.page_url}-${i}`} className={`p-4 ${pc.bg}/30`}>
                      <div className="flex items-start gap-2">
                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${pc.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className={`text-apple-xs font-bold uppercase ${pc.text}`}>{rec.priority}</span>
                            <span className="text-apple-xs font-medium text-apple-text-secondary">{rec.category}</span>
                            <span className="text-apple-xs text-apple-text-tertiary">·</span>
                            <span className="text-apple-xs text-apple-text-tertiary truncate">{rec.page_url.replace(/^https?:\/\/[^/]+/, '') || '/'}</span>
                          </div>
                          <p className="text-apple-sm font-medium text-apple-text">{rec.issue}</p>
                          <p className="text-apple-sm text-apple-text-secondary mt-1">{rec.recommendation}</p>
                          {rec.impact && <p className="text-apple-xs text-apple-text-tertiary mt-1">Impact: {rec.impact}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalRecsPages > 1 && <Pagination current={recsPage} total={totalRecsPages} onChange={setRecsPage} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Pagination component ───
function Pagination({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) {
  const pages: (number | '…')[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push('…');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push('…');
    pages.push(total);
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      <button onClick={() => onChange(Math.max(1, current - 1))} disabled={current === 1}
        className="px-2.5 py-1.5 rounded-apple-sm text-apple-xs text-apple-text-secondary hover:bg-apple-fill-secondary disabled:opacity-30 transition-colors">
        ← Prev
      </button>
      {pages.map((p, i) => p === '…'
        ? <span key={`e${i}`} className="px-2 text-apple-xs text-apple-text-tertiary">…</span>
        : <button key={p} onClick={() => onChange(p)}
            className={`w-8 h-8 rounded-apple-sm text-apple-xs font-medium transition-colors ${current === p ? 'bg-apple-blue text-white' : 'text-apple-text-secondary hover:bg-apple-fill-secondary'}`}>
            {p}
          </button>
      )}
      <button onClick={() => onChange(Math.min(total, current + 1))} disabled={current === total}
        className="px-2.5 py-1.5 rounded-apple-sm text-apple-xs text-apple-text-secondary hover:bg-apple-fill-secondary disabled:opacity-30 transition-colors">
        Next →
      </button>
    </div>
  );
}
