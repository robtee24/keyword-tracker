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
  howToFix?: string;
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

const AUDIT_TYPE_LABELS: Record<AuditType, string> = { seo: 'SEO Audit', content: 'Content Audit', aeo: 'AEO Audit', schema: 'Schema Audit' };

const PRIORITY_COLORS = {
  high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  low: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
};

function getScoreColor(s: number) { return s >= 80 ? 'text-green-600' : s >= 60 ? 'text-amber-600' : 'text-red-600'; }
function getScoreBg(s: number) { return s >= 80 ? 'bg-green-50 border-green-200' : s >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'; }
function getScoreLabel(s: number) { return s >= 80 ? 'Good' : s >= 60 ? 'Needs Work' : 'Poor'; }
function getBarColor(s: number) { return s >= 80 ? 'bg-green-500' : s >= 60 ? 'bg-amber-500' : 'bg-red-500'; }

const MODE_INFO: Record<AuditMode, { label: string; icon: string; desc: string }> = {
  page: { label: 'By Page', icon: '📄', desc: 'Audit a specific URL' },
  keyword: { label: 'By Keyword', icon: '🔑', desc: 'Audit pages ranking for a keyword' },
  group: { label: 'By Group', icon: '📁', desc: 'Audit all pages in a keyword group' },
  site: { label: 'Full Site', icon: '🌐', desc: 'Audit every page in your sitemap' },
};

const PAGES_PER_PAGE = 20;
const RECS_PER_PAGE = 30;
const BATCH_SIZE = 5;

// Unique key for a rec so we can track completion
function recKey(pageUrl: string, idx: number) { return `${pageUrl}::${idx}`; }

export default function AuditView({ siteUrl, auditType, title, description }: AuditViewProps) {
  const [mode, setMode] = useState<AuditMode | null>(null);
  const [pageUrlInput, setPageUrlInput] = useState('');
  const [keywordSearch, setKeywordSearch] = useState('');
  const [allKeywords, setAllKeywords] = useState<string[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [keywordPages, setKeywordPages] = useState<string[]>([]);
  const [loadingKeywordPages, setLoadingKeywordPages] = useState(false);
  const [groups, setGroups] = useState<KeywordGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<KeywordGroup | null>(null);
  const [groupPages, setGroupPages] = useState<string[]>([]);
  const [loadingGroupPages, setLoadingGroupPages] = useState(false);
  const [results, setResults] = useState<PageResult[]>([]);
  const [targetUrls, setTargetUrls] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [loadingResults, setLoadingResults] = useState(true);
  const [loadingSitemap, setLoadingSitemap] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);
  const completedUrlsRef = useRef<Set<string>>(new Set());

  const [resultsTab, setResultsTab] = useState<ResultsTab>('summary');
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [expandedRecs, setExpandedRecs] = useState<Set<string>>(new Set());
  const [pageSearch, setPageSearch] = useState('');
  const [scoreFilter, setScoreFilter] = useState<'' | 'poor' | 'needs-work' | 'good'>('');
  const [priorityFilter, setPriorityFilter] = useState<'' | 'high' | 'medium' | 'low'>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [pagesPage, setPagesPage] = useState(1);
  const [recsPage, setRecsPage] = useState(1);
  const [summaryExpanded, setSummaryExpanded] = useState(true);

  // Task status tracking: pending (on tasklist), completed, rejected
  const [pendingRecs, setPendingRecs] = useState<Set<string>>(new Set());
  const [completedRecs, setCompletedRecs] = useState<Set<string>>(new Set());
  const [rejectedRecs, setRejectedRecs] = useState<Set<string>>(new Set());
  const [selectedForTasklist, setSelectedForTasklist] = useState<Set<string>>(new Set());
  const [addingToTasklist, setAddingToTasklist] = useState(false);

  // Load saved results
  useEffect(() => {
    if (!siteUrl) return;
    setLoadingResults(true);
    fetch(`${API_ENDPOINTS.db.pageAudits}?siteUrl=${encodeURIComponent(siteUrl)}&auditType=${auditType}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.results) {
          const mapped = data.results.map((r: any) => ({ ...r, strengths: Array.isArray(r.strengths) ? r.strengths : [] }));
          setResults(mapped);
          completedUrlsRef.current = new Set(mapped.map((r: PageResult) => r.page_url));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingResults(false));
  }, [siteUrl, auditType]);

  // Load all task statuses for this audit type
  useEffect(() => {
    if (!siteUrl) return;
    fetch(`${API_ENDPOINTS.db.completedTasks}?siteUrl=${encodeURIComponent(siteUrl)}&keyword=${encodeURIComponent(`audit:${auditType}`)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.tasks) {
          const pending = new Set<string>();
          const done = new Set<string>();
          const rejected = new Set<string>();
          for (const t of data.tasks) {
            if (t.status === 'rejected') rejected.add(t.task_id);
            else if (t.status === 'completed') done.add(t.task_id);
            else pending.add(t.task_id);
          }
          setPendingRecs(pending);
          setCompletedRecs(done);
          setRejectedRecs(rejected);
        }
      })
      .catch(() => {});
  }, [siteUrl, auditType]);

  useEffect(() => {
    if (!siteUrl) return;
    fetch(`${API_ENDPOINTS.db.keywords}?siteUrl=${encodeURIComponent(siteUrl)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.keywords) setAllKeywords(data.keywords.map((k: any) => k.keyword)); })
      .catch(() => {});
  }, [siteUrl]);

  useEffect(() => {
    if (!siteUrl) return;
    fetch(`${API_ENDPOINTS.db.keywordGroups}?siteUrl=${encodeURIComponent(siteUrl)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.groups) setGroups(data.groups); })
      .catch(() => {});
  }, [siteUrl]);

  const filteredKeywords = keywordSearch.length >= 2
    ? allKeywords.filter((kw) => kw.toLowerCase().includes(keywordSearch.toLowerCase())).slice(0, 10)
    : [];

  const fetchPagesForKeyword = useCallback(async (keyword: string) => {
    setLoadingKeywordPages(true); setKeywordPages([]);
    try {
      const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 90);
      const resp = await authenticatedFetch(API_ENDPOINTS.google.searchConsole.keywordPages, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, keyword, startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const pages: string[] = (data.rows || []).map((r: any) => r.keys?.[1] || '').filter(Boolean);
        setKeywordPages([...new Set(pages)]);
      }
    } catch { /* */ }
    setLoadingKeywordPages(false);
  }, [siteUrl]);

  const fetchPagesForGroup = useCallback(async (group: KeywordGroup) => {
    setLoadingGroupPages(true); setGroupPages([]);
    const allPages = new Set<string>();
    const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 90);
    for (const keyword of group.keywords.slice(0, 20)) {
      try {
        const resp = await authenticatedFetch(API_ENDPOINTS.google.searchConsole.keywordPages, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl, keyword, startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] }),
        });
        if (resp.ok) { const data = await resp.json(); for (const r of data.rows || []) { const p = r.keys?.[1]; if (p) allPages.add(p); } }
      } catch { /* */ }
    }
    setGroupPages([...allPages]);
    setLoadingGroupPages(false);
  }, [siteUrl]);

  const fetchSitemap = useCallback(async () => {
    setLoadingSitemap(true); setError(null);
    try {
      const resp = await fetch(`${API_ENDPOINTS.audit.sitemap}?siteUrl=${encodeURIComponent(siteUrl)}`);
      if (!resp.ok) throw new Error('Failed to fetch sitemap');
      const data = await resp.json();
      if (!data.urls || data.urls.length === 0) throw new Error('No URLs found in sitemap');
      return data.urls as string[];
    } catch (err: any) { setError(err.message); return []; }
    finally { setLoadingSitemap(false); }
  }, [siteUrl]);

  // Parallel batch audit runner
  const runAuditOnUrls = useCallback(async (urls: string[], clearPrevious: boolean) => {
    if (urls.length === 0) return;
    abortRef.current = false;
    setIsRunning(true);
    setError(null);
    setTargetUrls(urls);
    if (clearPrevious) { setResults([]); completedUrlsRef.current = new Set(); }
    const remaining = urls.filter((u) => !completedUrlsRef.current.has(u));

    for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
      if (abortRef.current) break;
      const batch = remaining.slice(i, i + BATCH_SIZE);
      setCurrentBatch(batch);

      try {
        const resp = await fetch(API_ENDPOINTS.audit.runBatch, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl, pageUrls: batch, auditType }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const batchResults: PageResult[] = (data.results || []).map((r: any) => ({
            page_url: r.pageUrl || r.page_url || '',
            score: r.score || 0,
            summary: r.summary || '',
            strengths: Array.isArray(r.strengths) ? r.strengths : [],
            recommendations: (r.recommendations || []).map((rec: any) => ({ ...rec, howToFix: rec.howToFix || rec.how_to_fix || '' })),
            audited_at: new Date().toISOString(),
            error: r.error,
          }));
          for (const r of batchResults) completedUrlsRef.current.add(r.page_url);
          setResults((prev) => [...prev, ...batchResults]);
        } else {
          // Fallback: run individually
          for (const pageUrl of batch) {
            if (abortRef.current) break;
            try {
              const r2 = await fetch(API_ENDPOINTS.audit.run, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteUrl, pageUrl, auditType }) });
              if (r2.ok) {
                const result = await r2.json();
                completedUrlsRef.current.add(pageUrl);
                setResults((prev) => [...prev, { page_url: result.pageUrl, score: result.score, summary: result.summary || '', strengths: Array.isArray(result.strengths) ? result.strengths : [], recommendations: (result.recommendations || []).map((rec: any) => ({ ...rec, howToFix: rec.howToFix || '' })), audited_at: new Date().toISOString(), error: result.error }]);
              }
            } catch (err: any) {
              completedUrlsRef.current.add(pageUrl);
              setResults((prev) => [...prev, { page_url: pageUrl, score: 0, summary: '', strengths: [], recommendations: [], audited_at: new Date().toISOString(), error: err.message }]);
            }
          }
        }
      } catch {
        // If batch endpoint fails entirely, run sequentially
        for (const pageUrl of batch) {
          if (abortRef.current) break;
          try {
            const r2 = await fetch(API_ENDPOINTS.audit.run, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteUrl, pageUrl, auditType }) });
            if (r2.ok) {
              const result = await r2.json();
              completedUrlsRef.current.add(pageUrl);
              setResults((prev) => [...prev, { page_url: result.pageUrl, score: result.score, summary: result.summary || '', strengths: Array.isArray(result.strengths) ? result.strengths : [], recommendations: (result.recommendations || []).map((rec: any) => ({ ...rec, howToFix: rec.howToFix || '' })), audited_at: new Date().toISOString(), error: result.error }]);
            }
          } catch (err: any) {
            completedUrlsRef.current.add(pageUrl);
            setResults((prev) => [...prev, { page_url: pageUrl, score: 0, summary: '', strengths: [], recommendations: [], audited_at: new Date().toISOString(), error: err.message }]);
          }
        }
      }
    }
    setIsRunning(false);
    setCurrentBatch([]);
  }, [siteUrl, auditType]);

  const handleStartPage = () => { const url = pageUrlInput.trim(); if (!url) return; const fullUrl = url.startsWith('http') ? url : `${siteUrl}${url.startsWith('/') ? '' : '/'}${url}`; runAuditOnUrls([fullUrl], true); };
  const handleStartKeyword = () => { if (keywordPages.length > 0) runAuditOnUrls(keywordPages, true); };
  const handleStartGroup = () => { if (groupPages.length > 0) runAuditOnUrls(groupPages, true); };
  const handleStartSite = async () => { const urls = await fetchSitemap(); if (urls.length > 0) { try { await fetch(API_ENDPOINTS.db.pageAudits, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteUrl, auditType, action: 'clear' }) }); } catch { /* */ } runAuditOnUrls(urls, true); } };
  const handleResume = () => runAuditOnUrls(targetUrls, false);
  const stopAudit = () => { abortRef.current = true; };

  const toggleRecDone = useCallback(async (key: string, taskText: string) => {
    const isDone = completedRecs.has(key);
    if (isDone) {
      // Uncomplete: if it was on tasklist, go back to pending; otherwise remove entirely
      const wasPending = pendingRecs.has(key);
      setCompletedRecs((prev) => { const n = new Set(prev); n.delete(key); return n; });
      if (wasPending) {
        setPendingRecs((prev) => new Set(prev).add(key));
        try { await fetch(API_ENDPOINTS.db.completedTasks, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteUrl, keyword: `audit:${auditType}`, taskId: key, taskText, category: auditType, status: 'pending' }) }); } catch { /* */ }
      } else {
        try { await fetch(API_ENDPOINTS.db.completedTasks, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteUrl, keyword: `audit:${auditType}`, taskId: key }) }); } catch { /* */ }
      }
    } else {
      setCompletedRecs((prev) => new Set(prev).add(key));
      setPendingRecs((prev) => { const n = new Set(prev); n.delete(key); return n; });
      try { await fetch(API_ENDPOINTS.db.completedTasks, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteUrl, keyword: `audit:${auditType}`, taskId: key, taskText, category: auditType, status: 'completed' }) }); } catch { /* */ }
    }
  }, [siteUrl, auditType, completedRecs, pendingRecs]);

  const rejectRec = useCallback(async (key: string, taskText: string) => {
    const isRejected = rejectedRecs.has(key);
    if (isRejected) {
      setRejectedRecs((prev) => { const n = new Set(prev); n.delete(key); return n; });
      try { await fetch(API_ENDPOINTS.db.completedTasks, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteUrl, keyword: `audit:${auditType}`, taskId: key }) }); } catch { /* */ }
    } else {
      setRejectedRecs((prev) => new Set(prev).add(key));
      setCompletedRecs((prev) => { const n = new Set(prev); n.delete(key); return n; });
      setPendingRecs((prev) => { const n = new Set(prev); n.delete(key); return n; });
      try { await fetch(API_ENDPOINTS.db.completedTasks, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteUrl, keyword: `audit:${auditType}`, taskId: key, taskText, category: auditType, status: 'rejected' }) }); } catch { /* */ }
    }
  }, [siteUrl, auditType, rejectedRecs]);

  const addSelectedToTasklist = useCallback(async () => {
    if (selectedForTasklist.size === 0) return;
    setAddingToTasklist(true);
    for (const key of selectedForTasklist) {
      if (completedRecs.has(key) || pendingRecs.has(key)) continue;
      const [pageUrl, idxStr] = key.split('::');
      const idx = parseInt(idxStr, 10);
      const page = results.find((r) => r.page_url === pageUrl);
      const rec = page?.recommendations[idx];
      if (!rec) continue;
      setPendingRecs((prev) => new Set(prev).add(key));
      try {
        await fetch(API_ENDPOINTS.db.completedTasks, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteUrl, keyword: `audit:${auditType}`, taskId: key, taskText: `[${AUDIT_TYPE_LABELS[auditType]}] ${rec.issue} — ${rec.recommendation}`, category: rec.category, status: 'pending' }) });
      } catch { /* */ }
    }
    setSelectedForTasklist(new Set());
    setAddingToTasklist(false);
  }, [selectedForTasklist, completedRecs, pendingRecs, results, siteUrl, auditType]);

  const toggleRecExpanded = (key: string) => setExpandedRecs((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const totalPages = targetUrls.length || results.length;
  const completedCount = results.length;
  const progressPct = totalPages > 0 ? Math.round((completedCount / totalPages) * 100) : 0;
  const hasResumable = completedCount > 0 && completedCount < totalPages && !isRunning;

  const avgScore = useMemo(() => results.length > 0 ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0, [results]);
  const scoreBuckets = useMemo(() => ({ poor: results.filter((r) => r.score < 60).length, mid: results.filter((r) => r.score >= 60 && r.score < 80).length, good: results.filter((r) => r.score >= 80).length }), [results]);

  const allRecs = useMemo(() => {
    const flat: Array<Recommendation & { page_url: string; recIdx: number }> = [];
    for (const r of results) r.recommendations.forEach((rec, i) => {
      if (!rejectedRecs.has(recKey(r.page_url, i))) flat.push({ ...rec, page_url: r.page_url, recIdx: i });
    });
    return flat;
  }, [results, rejectedRecs]);

  const totalRecsCount = allRecs.length;
  const completedRecsCount = useMemo(() => {
    let count = 0;
    for (const rec of allRecs) { if (completedRecs.has(recKey(rec.page_url, rec.recIdx))) count++; }
    return count;
  }, [allRecs, completedRecs]);

  const topIssues = useMemo(() => {
    const map = new Map<string, { count: number; priority: string; example: string }>();
    for (const rec of allRecs) { const e = map.get(rec.category); if (e) e.count++; else map.set(rec.category, { count: 1, priority: rec.priority, example: rec.issue }); }
    return [...map.entries()].map(([cat, v]) => ({ category: cat, ...v })).sort((a, b) => b.count - a.count);
  }, [allRecs]);

  const allCategories = useMemo(() => { const c = new Set<string>(); for (const rec of allRecs) c.add(rec.category); return [...c].sort(); }, [allRecs]);

  const filteredPageResults = useMemo(() => {
    let list = results;
    if (pageSearch) { const q = pageSearch.toLowerCase(); list = list.filter((r) => r.page_url.toLowerCase().includes(q)); }
    if (scoreFilter === 'poor') list = list.filter((r) => r.score < 60);
    else if (scoreFilter === 'needs-work') list = list.filter((r) => r.score >= 60 && r.score < 80);
    else if (scoreFilter === 'good') list = list.filter((r) => r.score >= 80);
    return list.sort((a, b) => a.score - b.score);
  }, [results, pageSearch, scoreFilter]);

  const paginatedPages = useMemo(() => filteredPageResults.slice((pagesPage - 1) * PAGES_PER_PAGE, pagesPage * PAGES_PER_PAGE), [filteredPageResults, pagesPage]);
  const totalPagesPages = Math.ceil(filteredPageResults.length / PAGES_PER_PAGE);

  const filteredRecs = useMemo(() => {
    let list = allRecs;
    if (priorityFilter) list = list.filter((r) => r.priority === priorityFilter);
    if (categoryFilter) list = list.filter((r) => r.category === categoryFilter);
    return list.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] || 2) - ({ high: 0, medium: 1, low: 2 }[b.priority] || 2));
  }, [allRecs, priorityFilter, categoryFilter]);

  const paginatedRecs = useMemo(() => filteredRecs.slice((recsPage - 1) * RECS_PER_PAGE, recsPage * RECS_PER_PAGE), [filteredRecs, recsPage]);
  const totalRecsPages = Math.ceil(filteredRecs.length / RECS_PER_PAGE);

  useEffect(() => { setPagesPage(1); }, [pageSearch, scoreFilter]);
  useEffect(() => { setRecsPage(1); }, [priorityFilter, categoryFilter]);

  const latestAuditDate = useMemo(() => { if (results.length === 0) return ''; return results.reduce((latest, r) => r.audited_at > latest ? r.audited_at : latest, results[0].audited_at); }, [results]);

  const recProgressPct = totalRecsCount > 0 ? Math.round((completedRecsCount / totalRecsCount) * 100) : 0;

  const pageCompletedRecs = useCallback((page: PageResult) => {
    let done = 0;
    page.recommendations.forEach((_, i) => { if (completedRecs.has(recKey(page.page_url, i))) done++; });
    return done;
  }, [completedRecs]);

  const pageActiveRecs = useCallback((page: PageResult) => {
    return page.recommendations.filter((_, i) => !rejectedRecs.has(recKey(page.page_url, i)));
  }, [rejectedRecs]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-apple-text mb-1">{title}</h2>
        <p className="text-apple-sm text-apple-text-secondary">{description}</p>
      </div>

      {/* Mode Selection */}
      {!isRunning && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {(Object.keys(MODE_INFO) as AuditMode[]).map((m) => {
            const info = MODE_INFO[m]; const isActive = mode === m;
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

      {/* Mode panels (same as before, compressed) */}
      {mode === 'page' && !isRunning && (
        <div className="rounded-apple border border-apple-divider bg-white p-4 mb-6">
          <label className="block text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider mb-2">Page URL</label>
          <div className="flex gap-2">
            <input type="text" value={pageUrlInput} onChange={(e) => setPageUrlInput(e.target.value)} placeholder={`${siteUrl}/page-path or full URL`}
              className="flex-1 px-3 py-2 rounded-apple-sm border border-apple-border text-apple-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue" onKeyDown={(e) => e.key === 'Enter' && handleStartPage()} />
            <button onClick={handleStartPage} disabled={!pageUrlInput.trim()} className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50">Audit Page</button>
          </div>
        </div>
      )}
      {mode === 'keyword' && !isRunning && (
        <div className="rounded-apple border border-apple-divider bg-white p-4 mb-6">
          <label className="block text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider mb-2">Search Keyword</label>
          <div className="relative">
            <input type="text" value={keywordSearch} onChange={(e) => { setKeywordSearch(e.target.value); setSelectedKeyword(null); setKeywordPages([]); }} placeholder="Type to search your tracked keywords…"
              className="w-full px-3 py-2 rounded-apple-sm border border-apple-border text-apple-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue" />
            {filteredKeywords.length > 0 && !selectedKeyword && (
              <div className="absolute z-50 mt-1 w-full bg-white rounded-apple-sm border border-apple-divider shadow-lg max-h-48 overflow-y-auto">
                {filteredKeywords.map((kw) => (<button key={kw} onClick={() => { setSelectedKeyword(kw); setKeywordSearch(kw); fetchPagesForKeyword(kw); }} className="w-full text-left px-3 py-2 text-apple-sm hover:bg-apple-fill-secondary transition-colors">{kw}</button>))}
              </div>
            )}
          </div>
          {selectedKeyword && (
            <div className="mt-3">
              {loadingKeywordPages ? <div className="flex items-center gap-2 text-apple-sm text-apple-text-secondary"><div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />Finding pages…</div>
              : keywordPages.length > 0 ? <div><p className="text-apple-sm text-apple-text-secondary mb-2">{keywordPages.length} page{keywordPages.length !== 1 ? 's' : ''} found</p><button onClick={handleStartKeyword} className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors">Audit {keywordPages.length} Page{keywordPages.length !== 1 ? 's' : ''}</button></div>
              : <p className="text-apple-sm text-apple-text-tertiary">No pages found.</p>}
            </div>
          )}
        </div>
      )}
      {mode === 'group' && !isRunning && (
        <div className="rounded-apple border border-apple-divider bg-white p-4 mb-6">
          <label className="block text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider mb-2">Select Group</label>
          {groups.length === 0 ? <p className="text-apple-sm text-apple-text-tertiary">No keyword groups found.</p> : (
            <div className="space-y-2">
              {groups.map((group) => { const isSel = selectedGroup?.id === group.id; return (
                <button key={group.id} onClick={() => { if (isSel) { setSelectedGroup(null); setGroupPages([]); } else { setSelectedGroup(group); fetchPagesForGroup(group); } }}
                  className={`w-full text-left px-3 py-2.5 rounded-apple-sm border transition-all flex items-center justify-between ${isSel ? 'border-apple-blue bg-apple-blue/5' : 'border-apple-divider hover:border-apple-blue/40'}`}>
                  <div><span className="text-apple-sm font-medium text-apple-text">{group.name}</span><span className="text-apple-xs text-apple-text-tertiary ml-2">{group.keywords.length} keywords</span></div>
                  {isSel && <svg className="w-4 h-4 text-apple-blue" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                </button>); })}
            </div>
          )}
          {selectedGroup && (
            <div className="mt-3">{loadingGroupPages ? <div className="flex items-center gap-2 text-apple-sm text-apple-text-secondary"><div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />Finding pages…</div>
            : groupPages.length > 0 ? <div><p className="text-apple-sm text-apple-text-secondary mb-2">{groupPages.length} unique pages found</p><button onClick={handleStartGroup} className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors">Audit {groupPages.length} Page{groupPages.length !== 1 ? 's' : ''}</button></div>
            : <p className="text-apple-sm text-apple-text-tertiary">No pages found.</p>}</div>
          )}
        </div>
      )}
      {mode === 'site' && !isRunning && (
        <div className="rounded-apple border border-apple-divider bg-white p-4 mb-6 flex items-center justify-between">
          <div><p className="text-apple-sm font-medium text-apple-text">Full Site Audit</p><p className="text-apple-xs text-apple-text-tertiary mt-0.5">Crawls your entire sitemap and audits every page.</p></div>
          <button onClick={handleStartSite} disabled={loadingSitemap} className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50 shrink-0">{loadingSitemap ? 'Loading…' : 'Start Full Audit'}</button>
        </div>
      )}

      {/* Progress bar */}
      {isRunning && (
        <div className="rounded-apple border border-apple-divider bg-white p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-apple-sm font-medium text-apple-text">Auditing {BATCH_SIZE} pages at a time…</span>
            <button onClick={stopAudit} className="px-3 py-1.5 rounded-apple-sm border border-apple-red text-apple-red text-apple-xs font-medium hover:bg-red-50 transition-colors">Stop</button>
          </div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-apple-xs text-apple-text-secondary">{completedCount} / {totalPages} pages</span>
            <span className="text-apple-xs text-apple-text-tertiary">{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-apple-fill-secondary rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-apple-blue transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          {currentBatch.length > 0 && <p className="mt-1.5 text-apple-xs text-apple-text-tertiary truncate">Batch: {currentBatch.map((u) => u.replace(/^https?:\/\/[^/]+/, '')).join(', ')}</p>}
        </div>
      )}
      {hasResumable && !isRunning && (
        <div className="rounded-apple border border-amber-200 bg-amber-50/40 px-4 py-3 mb-6 flex items-center justify-between">
          <span className="text-apple-sm text-amber-800">Audit paused — {totalPages - completedCount} remaining</span>
          <button onClick={handleResume} className="px-3 py-1.5 rounded-apple-sm border border-apple-blue text-apple-blue text-apple-xs font-medium hover:bg-apple-blue/5 transition-colors">Resume</button>
        </div>
      )}
      {loadingResults && results.length === 0 && (<div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" /><span className="ml-3 text-apple-sm text-apple-text-secondary">Loading saved results…</span></div>)}
      {error && <div className="rounded-apple border border-apple-red/20 bg-red-50/30 px-4 py-3 mb-6 text-apple-sm text-apple-red">{error}</div>}

      {/* ═══════ RESULTS ═══════ */}
      {results.length > 0 && (
        <>
          <div className="flex border-b border-apple-divider mb-6">
            {([{ id: 'summary' as const, label: 'Summary' }, { id: 'pages' as const, label: `By Page (${results.length})` }, { id: 'recommendations' as const, label: `All Recommendations (${allRecs.length})` }]).map((tab) => (
              <button key={tab.id} onClick={() => setResultsTab(tab.id)}
                className={`px-4 py-2.5 text-apple-sm font-medium border-b-2 transition-colors -mb-px ${resultsTab === tab.id ? 'border-apple-blue text-apple-blue' : 'border-transparent text-apple-text-secondary hover:text-apple-text'}`}>{tab.label}</button>
            ))}
          </div>

          {/* ─── Summary Tab ─── */}
          {resultsTab === 'summary' && (
            <div className="space-y-4">
              {/* Collapsible report card */}
              <button onClick={() => setSummaryExpanded(!summaryExpanded)}
                className="w-full rounded-apple border border-apple-divider bg-white p-4 text-left hover:bg-apple-fill-secondary/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-2xl font-bold ${getScoreColor(avgScore)}`}>{avgScore}</span>
                    <div>
                      <div className="text-apple-sm font-semibold text-apple-text">{AUDIT_TYPE_LABELS[auditType]}</div>
                      <div className="text-apple-xs text-apple-text-tertiary">{latestAuditDate ? new Date(latestAuditDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''} · {results.length} pages</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-apple-xs text-apple-text-tertiary">{completedRecsCount}/{totalRecsCount} implemented</div>
                      <div className="w-32 h-1.5 bg-apple-fill-secondary rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${recProgressPct}%` }} />
                      </div>
                    </div>
                    <svg className={`w-4 h-4 text-apple-text-tertiary transition-transform ${summaryExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </button>

              {summaryExpanded && (
                <div className="space-y-4 pl-2">
                  {/* Score distribution */}
                  <div className="grid grid-cols-3 gap-3">
                    {[{ label: 'Poor (<60)', count: scoreBuckets.poor, color: 'red', filter: 'poor' as const }, { label: 'Needs Work (60-79)', count: scoreBuckets.mid, color: 'amber', filter: 'needs-work' as const }, { label: 'Good (80+)', count: scoreBuckets.good, color: 'green', filter: 'good' as const }].map((b) => (
                      <div key={b.filter} onClick={() => { setScoreFilter(b.filter); setResultsTab('pages'); }} className={`rounded-apple border border-${b.color}-200 bg-${b.color}-50 p-3 text-center cursor-pointer hover:ring-1 hover:ring-${b.color}-300 transition-all`}>
                        <div className={`text-xl font-bold text-${b.color}-600`}>{b.count}</div>
                        <div className="text-apple-xs text-apple-text-secondary mt-0.5">{b.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Top issues — expandable in place */}
                  {topIssues.length > 0 && (
                    <div className="rounded-apple border border-apple-divider bg-white overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-apple-divider bg-apple-fill-secondary/50">
                        <span className="text-apple-xs font-semibold text-apple-text-secondary uppercase tracking-wider">Most Common Issues</span>
                      </div>
                      <div className="divide-y divide-apple-divider">
                        {topIssues.slice(0, 10).map((issue) => {
                          const pc = PRIORITY_COLORS[issue.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.low;
                          const issueKey = `issue:${issue.category}`;
                          const isExpanded = expandedRecs.has(issueKey);
                          const issueRecs = allRecs.filter((r) => r.category === issue.category);
                          return (
                            <div key={issue.category}>
                              <button onClick={() => toggleRecExpanded(issueKey)} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-apple-fill-secondary/30 transition-colors text-left">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${pc.dot}`} />
                                <span className="text-apple-sm font-medium text-apple-text flex-1">{issue.category}</span>
                                <span className="text-apple-xs text-apple-text-tertiary">{issue.count} page{issue.count !== 1 ? 's' : ''}</span>
                                <svg className={`w-3.5 h-3.5 text-apple-text-tertiary transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                              </button>
                              {isExpanded && (
                                <div className="px-4 pb-3 space-y-2">
                                  {issueRecs.slice(0, 10).map((rec, i) => (
                                    <div key={i} className={`rounded-apple-sm border ${pc.border} ${pc.bg} p-2.5 text-apple-xs`}>
                                      <div className="font-medium text-apple-text">{rec.issue}</div>
                                      <div className="text-apple-text-secondary mt-1">{rec.recommendation}</div>
                                      <div className="text-apple-text-tertiary mt-0.5 truncate">{rec.page_url.replace(/^https?:\/\/[^/]+/, '')}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Strengths */}
                  {(() => {
                    const allStr: string[] = []; for (const r of results) for (const s of r.strengths || []) allStr.push(s);
                    const freq = new Map<string, number>(); for (const s of allStr) freq.set(s, (freq.get(s) || 0) + 1);
                    const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
                    if (top.length === 0) return null;
                    return (
                      <div className="rounded-apple border border-green-200 bg-green-50/40 p-4">
                        <h4 className="text-apple-xs font-semibold text-green-800 uppercase tracking-wider mb-2">What Your Site Does Well</h4>
                        <ul className="space-y-1">
                          {top.map(([str, count]) => (
                            <li key={str} className="flex items-start gap-2 text-apple-sm text-green-700">
                              <svg className="w-4 h-4 mt-0.5 shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                              <span>{str} <span className="text-green-600/60">({count})</span></span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ─── By Page Tab ─── */}
          {resultsTab === 'pages' && (
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input type="text" value={pageSearch} onChange={(e) => setPageSearch(e.target.value)} placeholder="Search pages…"
                    className="w-full pl-9 pr-3 py-2 rounded-apple-sm border border-apple-border text-apple-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue" />
                </div>
                {(['poor', 'needs-work', 'good'] as const).map((f) => (
                  <button key={f} onClick={() => setScoreFilter(scoreFilter === f ? '' : f)}
                    className={`px-2.5 py-1.5 rounded-apple-pill text-apple-xs font-medium transition-colors border ${scoreFilter === f ? ({ poor: 'text-red-700 bg-red-50 border-red-200', 'needs-work': 'text-amber-700 bg-amber-50 border-amber-200', good: 'text-green-700 bg-green-50 border-green-200' })[f] : 'bg-apple-fill-secondary text-apple-text-secondary border-transparent hover:bg-gray-200'}`}>
                    {{ poor: 'Poor', 'needs-work': 'Needs Work', good: 'Good' }[f]}
                  </button>
                ))}
              </div>
              <div className="text-apple-xs text-apple-text-tertiary mb-3">Showing {paginatedPages.length} of {filteredPageResults.length} pages</div>
              <div className="space-y-3">
                {paginatedPages.map((result) => {
                  const isExp = expandedPage === result.page_url;
                  const activeRecs = pageActiveRecs(result);
                  const pageDone = pageCompletedRecs(result);
                  const pageTotal = activeRecs.length;
                  const pagePct = pageTotal > 0 ? Math.round((pageDone / pageTotal) * 100) : 100;
                  return (
                    <div key={result.page_url} className="rounded-apple border border-apple-divider bg-white overflow-hidden">
                      <button className="w-full p-4 text-left hover:bg-apple-fill-secondary/30 transition-colors"
                        onClick={() => setExpandedPage(isExp ? null : result.page_url)}>
                        <div className="flex items-center gap-4">
                          <span className={`text-xl font-bold w-12 text-center shrink-0 ${getScoreColor(result.score)}`}>{result.score}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-apple-xs text-apple-text-tertiary">{AUDIT_TYPE_LABELS[auditType]}</span>
                              <span className="text-apple-xs text-apple-text-tertiary">·</span>
                              <span className="text-apple-xs text-apple-text-tertiary">{new Date(result.audited_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                            </div>
                            <a href={result.page_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-apple-sm font-medium text-apple-blue hover:underline truncate block mt-0.5">
                              {result.page_url.replace(/^https?:\/\/[^/]+/, '') || '/'}
                            </a>
                            {result.summary && <p className="text-apple-xs text-apple-text-tertiary truncate mt-0.5">{result.summary}</p>}
                          </div>
                          <div className="shrink-0 w-28">
                            <div className="text-apple-xs text-apple-text-tertiary text-right">{pageDone}/{pageTotal}</div>
                            <div className="w-full h-1.5 bg-apple-fill-secondary rounded-full mt-1 overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${getBarColor(pagePct)}`} style={{ width: `${pagePct}%` }} />
                            </div>
                          </div>
                          <svg className={`w-4 h-4 text-apple-text-tertiary transition-transform shrink-0 ${isExp ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </button>
                      {isExp && (
                        <div className="px-4 pb-4 border-t border-apple-divider/50 bg-apple-fill-secondary/20">
                          {result.summary && <div className={`rounded-apple-sm border p-3 mt-3 mb-3 ${getScoreBg(result.score)}`}><p className="text-apple-sm text-apple-text">{result.summary}</p></div>}
                          {result.strengths?.length > 0 && (
                            <div className="rounded-apple-sm border border-green-200 bg-green-50/40 p-3 mb-3">
                              <p className="text-apple-xs font-semibold text-green-800 mb-1">Doing Well</p>
                              <ul className="space-y-0.5">{result.strengths.map((s, i) => (<li key={i} className="flex items-start gap-1.5 text-apple-xs text-green-700"><svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>{s}</li>))}</ul>
                            </div>
                          )}
                          {activeRecs.length > 0 && (
                            <div className="space-y-2">
                              {result.recommendations.map((rec, i) => {
                                const key = recKey(result.page_url, i);
                                if (rejectedRecs.has(key)) return null;
                                const pc = PRIORITY_COLORS[rec.priority] || PRIORITY_COLORS.low;
                                const isDone = completedRecs.has(key);
                                const isRecExp = expandedRecs.has(key);
                                return (
                                  <div key={i} className={`rounded-apple-sm border ${pc.border} ${isDone ? 'opacity-50' : ''} ${pc.bg} overflow-hidden`}>
                                    <div className="p-3 flex items-start gap-2">
                                      <input type="checkbox" checked={isDone} onChange={() => toggleRecDone(key, `${rec.issue} — ${rec.recommendation}`)} className="mt-1 shrink-0 rounded" />
                                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleRecExpanded(key)}>
                                        <div className="flex items-center gap-2 mb-0.5">
                                          <span className={`text-apple-xs font-bold uppercase ${pc.text}`}>{rec.priority}</span>
                                          <span className="text-apple-xs text-apple-text-tertiary">{rec.category}</span>
                                        </div>
                                        <p className={`text-apple-sm font-medium ${isDone ? 'line-through text-apple-text-tertiary' : 'text-apple-text'}`}>{rec.issue}</p>
                                        {!isRecExp && <p className="text-apple-xs text-apple-text-secondary mt-0.5">{rec.recommendation}</p>}
                                      </div>
                                      <button onClick={() => rejectRec(key, `${rec.issue} — ${rec.recommendation}`)} title="Reject & archive" className="mt-0.5 p-1 rounded hover:bg-red-100 text-apple-text-tertiary hover:text-red-500 transition-colors shrink-0">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                      </button>
                                      <svg className={`w-3.5 h-3.5 mt-1 text-apple-text-tertiary transition-transform shrink-0 cursor-pointer ${isRecExp ? 'rotate-180' : ''}`} onClick={() => toggleRecExpanded(key)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                    {isRecExp && (
                                      <div className="px-3 pb-3 border-t border-apple-divider/30 pt-2 space-y-2">
                                        <div><p className="text-apple-xs font-semibold text-apple-text-secondary">Recommendation</p><p className="text-apple-sm text-apple-text mt-0.5">{rec.recommendation}</p></div>
                                        {rec.howToFix && <div><p className="text-apple-xs font-semibold text-apple-text-secondary">How to Fix</p><p className="text-apple-sm text-apple-text mt-0.5 whitespace-pre-wrap">{rec.howToFix}</p></div>}
                                        {rec.impact && <div><p className="text-apple-xs font-semibold text-apple-text-secondary">Impact</p><p className="text-apple-sm text-apple-text-secondary mt-0.5">{rec.impact}</p></div>}
                                      </div>
                                    )}
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
              {totalPagesPages > 1 && <Pagination current={pagesPage} total={totalPagesPages} onChange={setPagesPage} />}
            </div>
          )}

          {/* ─── All Recommendations Tab ─── */}
          {resultsTab === 'recommendations' && (
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-apple-xs text-apple-text-tertiary">Priority:</span>
                {(['high', 'medium', 'low'] as const).map((p) => (
                  <button key={p} onClick={() => setPriorityFilter(priorityFilter === p ? '' : p)}
                    className={`px-2.5 py-1 rounded-apple-pill text-apple-xs font-medium transition-colors border ${priorityFilter === p ? `${PRIORITY_COLORS[p].bg} ${PRIORITY_COLORS[p].text} ${PRIORITY_COLORS[p].border}` : 'bg-apple-fill-secondary text-apple-text-secondary border-transparent hover:bg-gray-200'}`}>
                    {p.charAt(0).toUpperCase() + p.slice(1)} ({allRecs.filter((r) => r.priority === p).length})
                  </button>
                ))}
                <span className="text-apple-xs text-apple-text-tertiary ml-2">Category:</span>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-2 py-1 rounded-apple-sm border border-apple-border text-apple-xs bg-white">
                  <option value="">All ({allRecs.length})</option>
                  {allCategories.map((cat) => (<option key={cat} value={cat}>{cat} ({allRecs.filter((r) => r.category === cat).length})</option>))}
                </select>
                {(priorityFilter || categoryFilter) && <button onClick={() => { setPriorityFilter(''); setCategoryFilter(''); }} className="text-apple-xs text-apple-text-tertiary hover:text-apple-text ml-1">Clear all</button>}
                {selectedForTasklist.size > 0 && (
                  <button onClick={addSelectedToTasklist} disabled={addingToTasklist}
                    className="ml-auto px-3 py-1 rounded-apple-sm bg-apple-blue text-white text-apple-xs font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50">
                    {addingToTasklist ? 'Adding…' : `Add ${selectedForTasklist.size} to Tasklist`}
                  </button>
                )}
              </div>
              <div className="text-apple-xs text-apple-text-tertiary mb-3">Showing {paginatedRecs.length} of {filteredRecs.length} recommendations</div>
              <div className="rounded-apple border border-apple-divider bg-white overflow-hidden divide-y divide-apple-divider">
                {paginatedRecs.map((rec) => {
                  const pc = PRIORITY_COLORS[rec.priority] || PRIORITY_COLORS.low;
                  const key = recKey(rec.page_url, rec.recIdx);
                  const isDone = completedRecs.has(key);
                  const isPending = pendingRecs.has(key);
                  const isExp = expandedRecs.has(key);
                  const isSelected = selectedForTasklist.has(key);
                  const isActioned = isDone || isPending;
                  return (
                    <div key={key} className={`${isDone ? 'opacity-50' : ''}`}>
                      <div className="p-4 flex items-start gap-2">
                        <input type="checkbox" checked={isSelected || isActioned} disabled={isActioned}
                          onChange={() => { if (isActioned) return; setSelectedForTasklist((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; }); }}
                          className="mt-1 shrink-0 rounded" />
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleRecExpanded(key)}>
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className={`text-apple-xs font-bold uppercase ${pc.text}`}>{rec.priority}</span>
                            <span className="text-apple-xs font-medium text-apple-text-secondary">{rec.category}</span>
                            {isPending && <span className="px-1.5 py-0.5 rounded-apple-pill text-[10px] font-bold bg-blue-100 text-blue-700">On Tasklist</span>}
                            {isDone && <span className="px-1.5 py-0.5 rounded-apple-pill text-[10px] font-bold bg-green-100 text-green-700">Done</span>}
                            <span className="text-apple-xs text-apple-text-tertiary">·</span>
                            <a href={rec.page_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-apple-xs text-apple-blue hover:underline truncate">{rec.page_url.replace(/^https?:\/\/[^/]+/, '') || '/'}</a>
                          </div>
                          <p className={`text-apple-sm font-medium ${isDone ? 'line-through text-apple-text-tertiary' : 'text-apple-text'}`}>{rec.issue}</p>
                          {!isExp && <p className="text-apple-xs text-apple-text-secondary mt-0.5">{rec.recommendation}</p>}
                        </div>
                        <button onClick={() => rejectRec(key, `${rec.issue} — ${rec.recommendation}`)} title="Reject & archive" className="mt-0.5 p-1 rounded hover:bg-red-100 text-apple-text-tertiary hover:text-red-500 transition-colors shrink-0">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        </button>
                        <svg className={`w-3.5 h-3.5 mt-1 text-apple-text-tertiary transition-transform shrink-0 cursor-pointer ${isExp ? 'rotate-180' : ''}`} onClick={() => toggleRecExpanded(key)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                      {isExp && (
                        <div className="px-4 pb-4 border-t border-apple-divider/30 pt-2 space-y-2 bg-apple-fill-secondary/20">
                          <div><p className="text-apple-xs font-semibold text-apple-text-secondary">Recommendation</p><p className="text-apple-sm text-apple-text mt-0.5">{rec.recommendation}</p></div>
                          {rec.howToFix && <div><p className="text-apple-xs font-semibold text-apple-text-secondary">How to Fix</p><p className="text-apple-sm text-apple-text mt-0.5 whitespace-pre-wrap">{rec.howToFix}</p></div>}
                          {rec.impact && <div><p className="text-apple-xs font-semibold text-apple-text-secondary">Impact</p><p className="text-apple-sm text-apple-text-secondary mt-0.5">{rec.impact}</p></div>}
                        </div>
                      )}
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

function Pagination({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) {
  const pages: (number | '…')[] = [];
  if (total <= 7) { for (let i = 1; i <= total; i++) pages.push(i); }
  else { pages.push(1); if (current > 3) pages.push('…'); for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i); if (current < total - 2) pages.push('…'); pages.push(total); }
  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      <button onClick={() => onChange(Math.max(1, current - 1))} disabled={current === 1} className="px-2.5 py-1.5 rounded-apple-sm text-apple-xs text-apple-text-secondary hover:bg-apple-fill-secondary disabled:opacity-30 transition-colors">← Prev</button>
      {pages.map((p, i) => p === '…' ? <span key={`e${i}`} className="px-2 text-apple-xs text-apple-text-tertiary">…</span> : <button key={p} onClick={() => onChange(p)} className={`w-8 h-8 rounded-apple-sm text-apple-xs font-medium transition-colors ${current === p ? 'bg-apple-blue text-white' : 'text-apple-text-secondary hover:bg-apple-fill-secondary'}`}>{p}</button>)}
      <button onClick={() => onChange(Math.min(total, current + 1))} disabled={current === total} className="px-2.5 py-1.5 rounded-apple-sm text-apple-xs text-apple-text-secondary hover:bg-apple-fill-secondary disabled:opacity-30 transition-colors">Next →</button>
    </div>
  );
}
