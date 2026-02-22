import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { authenticatedFetch } from '../services/authService';
import { logActivity } from '../utils/activityLog';

type AuditType = 'seo' | 'content' | 'aeo' | 'schema' | 'compliance' | 'speed';
type AuditMode = 'page' | 'keyword' | 'group' | 'site';

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  issue: string;
  recommendation: string;
  howToFix?: string;
  impact: string;
}

interface PageAuditResult {
  id?: number;
  page_url: string;
  audit_type: AuditType;
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

interface AuditMainViewProps {
  siteUrl: string;
}

const ALL_AUDIT_TYPES: { id: AuditType; label: string; desc: string }[] = [
  { id: 'seo', label: 'SEO', desc: 'Title tags, meta descriptions, headings, links, images' },
  { id: 'content', label: 'Content', desc: 'Copy quality, conversion optimization, psychology' },
  { id: 'aeo', label: 'AEO', desc: 'AI search visibility, featured snippets, entity coverage' },
  { id: 'schema', label: 'Schema', desc: 'Structured data, rich snippets, schema.org markup' },
  { id: 'compliance', label: 'Compliance', desc: 'GDPR, CCPA, ADA/WCAG, security headers' },
  { id: 'speed', label: 'Page Speed', desc: 'Core Web Vitals, resource loading, image optimization' },
];

const AUDIT_TYPE_LABELS: Record<AuditType, string> = {
  seo: 'SEO', content: 'Content', aeo: 'AEO', schema: 'Schema', compliance: 'Compliance', speed: 'Page Speed',
};

const PRIORITY_COLORS = {
  high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  low: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
};

const AUDIT_TYPE_COLORS: Record<AuditType, string> = {
  seo: 'bg-indigo-100 text-indigo-700',
  content: 'bg-purple-100 text-purple-700',
  aeo: 'bg-cyan-100 text-cyan-700',
  schema: 'bg-orange-100 text-orange-700',
  compliance: 'bg-emerald-100 text-emerald-700',
  speed: 'bg-rose-100 text-rose-700',
};

function getScoreColor(s: number) { return s >= 80 ? 'text-green-600' : s >= 60 ? 'text-amber-600' : 'text-red-600'; }
function getScoreBg(s: number) { return s >= 80 ? 'bg-green-50 border-green-200' : s >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'; }

const MODE_INFO: Record<AuditMode, { label: string; icon: string; desc: string }> = {
  page: { label: 'By Page', icon: '📄', desc: 'Audit a specific URL' },
  keyword: { label: 'By Keyword', icon: '🔑', desc: 'Audit pages ranking for a keyword' },
  group: { label: 'By Group', icon: '📁', desc: 'Audit all pages in a keyword group' },
  site: { label: 'Full Site', icon: '🌐', desc: 'Audit every page in your sitemap' },
};

function recKey(pageUrl: string, auditType: string, idx: number) { return `${auditType}::${pageUrl}::${idx}`; }

// Group audit results into "runs" by clustering timestamps within 5 minutes of each other
function groupIntoRuns(results: PageAuditResult[]): PageAuditResult[][] {
  if (results.length === 0) return [];
  const sorted = [...results].sort((a, b) => new Date(b.audited_at).getTime() - new Date(a.audited_at).getTime());
  const runs: PageAuditResult[][] = [];
  let currentRun: PageAuditResult[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prevTime = new Date(sorted[i - 1].audited_at).getTime();
    const currTime = new Date(sorted[i].audited_at).getTime();
    if (prevTime - currTime < 5 * 60 * 1000) {
      currentRun.push(sorted[i]);
    } else {
      runs.push(currentRun);
      currentRun = [sorted[i]];
    }
  }
  runs.push(currentRun);
  return runs;
}

export default function AuditMainView({ siteUrl }: AuditMainViewProps) {
  const [selectedTypes, setSelectedTypes] = useState<Set<AuditType>>(new Set(['seo', 'content', 'aeo', 'schema', 'compliance', 'speed']));
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

  const [results, setResults] = useState<PageAuditResult[]>([]);
  const [targetUrls, setTargetUrls] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [loadingResults, setLoadingResults] = useState(true);
  const [loadingSitemap, setLoadingSitemap] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);
  const completedUrlsRef = useRef<Set<string>>(new Set());

  const [expandedRun, setExpandedRun] = useState<number | null>(null);
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [expandedRecs, setExpandedRecs] = useState<Set<string>>(new Set());
  const [deletingRun, setDeletingRun] = useState<number | null>(null);

  // Task tracking
  const [pendingRecs, setPendingRecs] = useState<Set<string>>(new Set());
  const [completedRecs, setCompletedRecs] = useState<Set<string>>(new Set());
  const [rejectedRecs, setRejectedRecs] = useState<Set<string>>(new Set());

  const loadResults = useCallback(async () => {
    if (!siteUrl) return;
    setLoadingResults(true);
    try {
      const resp = await fetch(`${API_ENDPOINTS.db.pageAudits}?siteUrl=${encodeURIComponent(siteUrl)}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data?.results) {
          const mapped = data.results.map((r: any) => ({
            ...r,
            strengths: Array.isArray(r.strengths) ? r.strengths : [],
          }));
          setResults(mapped);
          const urls = new Set<string>();
          for (const r of mapped) urls.add(r.page_url);
          completedUrlsRef.current = urls;
        }
      }
    } catch { /* ignore */ }
    setLoadingResults(false);
  }, [siteUrl]);

  useEffect(() => { loadResults(); }, [loadResults]);

  useEffect(() => {
    if (!siteUrl) return;
    const loadTasks = async () => {
      const pending = new Set<string>();
      const done = new Set<string>();
      const rejected = new Set<string>();
      for (const auditType of ALL_AUDIT_TYPES.map((t) => t.id)) {
        try {
          const resp = await fetch(`${API_ENDPOINTS.db.completedTasks}?siteUrl=${encodeURIComponent(siteUrl)}&keyword=${encodeURIComponent(`audit:${auditType}`)}`);
          if (resp.ok) {
            const data = await resp.json();
            if (data?.tasks) {
              for (const t of data.tasks) {
                if (t.status === 'rejected') rejected.add(t.task_id);
                else if (t.status === 'completed') done.add(t.task_id);
                else pending.add(t.task_id);
              }
            }
          }
        } catch { /* ignore */ }
      }
      setPendingRecs(pending);
      setCompletedRecs(done);
      setRejectedRecs(rejected);
    };
    loadTasks();
  }, [siteUrl]);

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

  const toggleAuditType = (type: AuditType) => {
    setSelectedTypes((prev) => {
      const n = new Set(prev);
      if (n.has(type)) { if (n.size > 1) n.delete(type); }
      else n.add(type);
      return n;
    });
  };

  const selectAllTypes = () => setSelectedTypes(new Set(ALL_AUDIT_TYPES.map((t) => t.id)));
  const allSelected = selectedTypes.size === ALL_AUDIT_TYPES.length;

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

  const runMultiAudit = useCallback(async (urls: string[], clearPrevious: boolean) => {
    if (urls.length === 0 || selectedTypes.size === 0) return;
    abortRef.current = false;
    setIsRunning(true);
    setError(null);
    setTargetUrls(urls);
    if (clearPrevious) { completedUrlsRef.current = new Set(); }

    const typesArray = [...selectedTypes];
    const remaining = urls.filter((u) => !completedUrlsRef.current.has(u));
    const newResults: PageAuditResult[] = [];

    for (let i = 0; i < remaining.length; i += 3) {
      if (abortRef.current) break;
      const batch = remaining.slice(i, i + 3);
      setCurrentBatch(batch);

      const batchPromises = batch.map(async (pageUrl) => {
        try {
          const resp = await fetch(API_ENDPOINTS.audit.runMulti, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteUrl, pageUrl, auditTypes: typesArray }),
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = await resp.json();
          return (data.results || []).map((r: any) => ({
            id: r.id,
            page_url: r.pageUrl || r.page_url || pageUrl,
            audit_type: r.auditType || r.audit_type,
            score: r.score || 0,
            summary: r.summary || '',
            strengths: Array.isArray(r.strengths) ? r.strengths : [],
            recommendations: (r.recommendations || []).map((rec: any) => ({ ...rec, howToFix: rec.howToFix || rec.how_to_fix || '' })),
            audited_at: new Date().toISOString(),
            error: r.error,
          } as PageAuditResult));
        } catch (err: any) {
          return typesArray.map((auditType) => ({
            page_url: pageUrl,
            audit_type: auditType,
            score: 0,
            summary: '',
            strengths: [],
            recommendations: [],
            audited_at: new Date().toISOString(),
            error: err.message,
          } as PageAuditResult));
        }
      });

      const batchResults = await Promise.all(batchPromises);
      const flat = batchResults.flat();
      for (const r of flat) completedUrlsRef.current.add(r.page_url);
      newResults.push(...flat);
      setResults((prev) => [...flat, ...prev]);
    }

    setIsRunning(false);
    setCurrentBatch([]);
    const totalAudited = completedUrlsRef.current.size;
    const typesStr = [...selectedTypes].join(', ');
    logActivity(siteUrl, 'seo', 'full-audit', `Full audit completed: ${totalAudited} pages, types: ${typesStr}`);
  }, [siteUrl, selectedTypes]);

  const handleStartPage = () => {
    const url = pageUrlInput.trim();
    if (!url) return;
    const fullUrl = url.startsWith('http') ? url : `${siteUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    runMultiAudit([fullUrl], false);
  };
  const handleStartKeyword = () => { if (keywordPages.length > 0) runMultiAudit(keywordPages, false); };
  const handleStartGroup = () => { if (groupPages.length > 0) runMultiAudit(groupPages, false); };
  const handleStartSite = async () => {
    const urls = await fetchSitemap();
    if (urls.length > 0) runMultiAudit(urls, false);
  };
  const handleResume = () => runMultiAudit(targetUrls, false);
  const stopAudit = () => { abortRef.current = true; };

  const deleteRun = useCallback(async (runResults: PageAuditResult[], runIdx: number) => {
    setDeletingRun(runIdx);
    for (const r of runResults) {
      try {
        if (r.id) {
          await fetch(API_ENDPOINTS.db.pageAudits, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: r.id }),
          });
        } else {
          await fetch(API_ENDPOINTS.db.pageAudits, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteUrl, pageUrl: r.page_url, auditType: r.audit_type, auditedAt: r.audited_at }),
          });
        }
      } catch { /* */ }
    }
    setResults((prev) => {
      const idsToRemove = new Set(runResults.map((r) => `${r.page_url}::${r.audit_type}::${r.audited_at}`));
      return prev.filter((r) => !idsToRemove.has(`${r.page_url}::${r.audit_type}::${r.audited_at}`));
    });
    setDeletingRun(null);
    if (expandedRun === runIdx) setExpandedRun(null);
    logActivity(siteUrl, 'seo', 'delete-audit', `Deleted audit run with ${runResults.length} results`);
  }, [siteUrl, expandedRun]);

  const toggleRecDone = useCallback(async (key: string, taskText: string, auditType: AuditType) => {
    const isDone = completedRecs.has(key);
    if (isDone) {
      setCompletedRecs((prev) => { const n = new Set(prev); n.delete(key); return n; });
      try { await fetch(API_ENDPOINTS.db.completedTasks, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteUrl, keyword: `audit:${auditType}`, taskId: key }) }); } catch { /* */ }
    } else {
      setCompletedRecs((prev) => new Set(prev).add(key));
      setPendingRecs((prev) => { const n = new Set(prev); n.delete(key); return n; });
      try { await fetch(API_ENDPOINTS.db.completedTasks, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteUrl, keyword: `audit:${auditType}`, taskId: key, taskText, category: auditType, status: 'completed' }) }); } catch { /* */ }
    }
  }, [siteUrl, completedRecs]);

  const rejectRec = useCallback(async (key: string, taskText: string, auditType: AuditType) => {
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
  }, [siteUrl, rejectedRecs]);

  const toggleRecExpanded = (key: string) => setExpandedRecs((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const auditRuns = useMemo(() => groupIntoRuns(results), [results]);

  const runningPageCount = completedUrlsRef.current.size;
  const totalPages = targetUrls.length || runningPageCount;
  const progressPct = totalPages > 0 ? Math.round((runningPageCount / totalPages) * 100) : 0;
  const hasResumable = runningPageCount > 0 && runningPageCount < totalPages && !isRunning;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-apple-text mb-1">Full Audit</h2>
        <p className="text-apple-sm text-apple-text-secondary">
          Run comprehensive audits across multiple frameworks. Each page is crawled once and analyzed for all selected audit types simultaneously.
        </p>
      </div>

      {/* Audit Type Checklist */}
      {!isRunning && (
        <div className="rounded-apple border border-apple-divider bg-white p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-apple-sm font-semibold text-apple-text">Select Audit Types</h3>
            <button onClick={allSelected ? () => setSelectedTypes(new Set(['seo'])) : selectAllTypes}
              className="text-apple-xs text-apple-blue hover:underline font-medium">
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {ALL_AUDIT_TYPES.map((type) => {
              const isChecked = selectedTypes.has(type.id);
              return (
                <button key={type.id} onClick={() => toggleAuditType(type.id)}
                  className={`flex items-start gap-2.5 p-3 rounded-apple-sm border transition-all text-left ${
                    isChecked ? 'border-apple-blue bg-apple-blue/5 ring-1 ring-apple-blue/30' : 'border-apple-divider hover:border-apple-blue/40'
                  }`}>
                  <div className={`w-4 h-4 rounded border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors ${
                    isChecked ? 'border-apple-blue bg-apple-blue' : 'border-gray-300'
                  }`}>
                    {isChecked && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                  </div>
                  <div>
                    <div className="text-apple-sm font-medium text-apple-text">{type.label}</div>
                    <div className="text-[11px] text-apple-text-tertiary mt-0.5 leading-tight">{type.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

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

      {/* Mode panels */}
      {mode === 'page' && !isRunning && (
        <div className="rounded-apple border border-apple-divider bg-white p-4 mb-6">
          <label className="block text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider mb-2">Page URL</label>
          <div className="flex gap-2">
            <input type="text" value={pageUrlInput} onChange={(e) => setPageUrlInput(e.target.value)} placeholder={`${siteUrl}/page-path or full URL`}
              className="flex-1 px-3 py-2 rounded-apple-sm border border-apple-border text-apple-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue" onKeyDown={(e) => e.key === 'Enter' && handleStartPage()} />
            <button onClick={handleStartPage} disabled={!pageUrlInput.trim()} className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50">
              Audit Page ({selectedTypes.size} type{selectedTypes.size !== 1 ? 's' : ''})
            </button>
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
              : keywordPages.length > 0 ? <div><p className="text-apple-sm text-apple-text-secondary mb-2">{keywordPages.length} page{keywordPages.length !== 1 ? 's' : ''} found</p><button onClick={handleStartKeyword} className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors">Audit {keywordPages.length} Page{keywordPages.length !== 1 ? 's' : ''} ({selectedTypes.size} types)</button></div>
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
            : groupPages.length > 0 ? <div><p className="text-apple-sm text-apple-text-secondary mb-2">{groupPages.length} unique pages found</p><button onClick={handleStartGroup} className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors">Audit {groupPages.length} Page{groupPages.length !== 1 ? 's' : ''} ({selectedTypes.size} types)</button></div>
            : <p className="text-apple-sm text-apple-text-tertiary">No pages found.</p>}</div>
          )}
        </div>
      )}
      {mode === 'site' && !isRunning && (
        <div className="rounded-apple border border-apple-divider bg-white p-4 mb-6 flex items-center justify-between">
          <div><p className="text-apple-sm font-medium text-apple-text">Full Site Audit</p><p className="text-apple-xs text-apple-text-tertiary mt-0.5">Crawls your entire sitemap and runs {selectedTypes.size} audit type{selectedTypes.size !== 1 ? 's' : ''} on every page.</p></div>
          <button onClick={handleStartSite} disabled={loadingSitemap} className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50 shrink-0">{loadingSitemap ? 'Loading…' : 'Start Full Audit'}</button>
        </div>
      )}

      {/* Progress bar */}
      {isRunning && (
        <div className="rounded-apple border border-apple-divider bg-white p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-apple-sm font-medium text-apple-text">Running {selectedTypes.size} audit type{selectedTypes.size !== 1 ? 's' : ''} per page…</span>
              <div className="flex gap-1.5 mt-1.5">
                {[...selectedTypes].map((t) => (
                  <span key={t} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${AUDIT_TYPE_COLORS[t]}`}>{AUDIT_TYPE_LABELS[t]}</span>
                ))}
              </div>
            </div>
            <button onClick={stopAudit} className="px-3 py-1.5 rounded-apple-sm border border-apple-red text-apple-red text-apple-xs font-medium hover:bg-red-50 transition-colors">Stop</button>
          </div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-apple-xs text-apple-text-secondary">{runningPageCount} / {totalPages} pages</span>
            <span className="text-apple-xs text-apple-text-tertiary">{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-apple-fill-secondary rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-apple-blue transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          {currentBatch.length > 0 && <p className="mt-1.5 text-apple-xs text-apple-text-tertiary truncate">Current: {currentBatch.map((u) => u.replace(/^https?:\/\/[^/]+/, '')).join(', ')}</p>}
        </div>
      )}
      {hasResumable && !isRunning && (
        <div className="rounded-apple border border-amber-200 bg-amber-50/40 px-4 py-3 mb-6 flex items-center justify-between">
          <span className="text-apple-sm text-amber-800">Audit paused — {totalPages - runningPageCount} remaining</span>
          <button onClick={handleResume} className="px-3 py-1.5 rounded-apple-sm border border-apple-blue text-apple-blue text-apple-xs font-medium hover:bg-apple-blue/5 transition-colors">Resume</button>
        </div>
      )}
      {loadingResults && results.length === 0 && (<div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" /><span className="ml-3 text-apple-sm text-apple-text-secondary">Loading saved results…</span></div>)}
      {error && <div className="rounded-apple border border-apple-red/20 bg-red-50/30 px-4 py-3 mb-6 text-apple-sm text-apple-red">{error}</div>}

      {/* ═══════ AUDIT RUN CARDS ═══════ */}
      {auditRuns.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-apple-sm font-semibold text-apple-text-secondary uppercase tracking-wider">
              Audit History ({auditRuns.length} audit{auditRuns.length !== 1 ? 's' : ''})
            </h3>
          </div>

          {auditRuns.map((run, runIdx) => {
            const isExp = expandedRun === runIdx;
            const latestDate = run[0].audited_at;
            const uniquePages = [...new Set(run.map((r) => r.page_url))];
            const uniqueTypes = [...new Set(run.map((r) => r.audit_type))];
            const avgScore = Math.round(run.reduce((s, r) => s + r.score, 0) / run.length);
            const totalRecs = run.reduce((s, r) => s + r.recommendations.length, 0);
            const isDeleting = deletingRun === runIdx;

            // Group by page within this run
            const pageMap = new Map<string, PageAuditResult[]>();
            for (const r of run) {
              const list = pageMap.get(r.page_url) || [];
              list.push(r);
              pageMap.set(r.page_url, list);
            }
            const pageEntries = [...pageMap.entries()].sort((a, b) => {
              const scoreA = Math.round(a[1].reduce((s, r) => s + r.score, 0) / a[1].length);
              const scoreB = Math.round(b[1].reduce((s, r) => s + r.score, 0) / b[1].length);
              return scoreA - scoreB;
            });

            return (
              <div key={runIdx} className="rounded-apple border border-apple-divider bg-white overflow-hidden shadow-sm">
                {/* Card Header */}
                <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-apple-fill-secondary/30 transition-colors"
                  onClick={() => setExpandedRun(isExp ? null : runIdx)}>
                  <div className={`w-14 h-14 rounded-apple-sm border-2 flex items-center justify-center shrink-0 ${getScoreBg(avgScore)}`}>
                    <span className={`text-xl font-bold ${getScoreColor(avgScore)}`}>{avgScore}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {uniqueTypes.map((t) => (
                        <span key={t} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${AUDIT_TYPE_COLORS[t]}`}>{AUDIT_TYPE_LABELS[t]}</span>
                      ))}
                    </div>
                    <div className="text-apple-sm font-medium text-apple-text">
                      {uniquePages.length} page{uniquePages.length !== 1 ? 's' : ''} audited · {totalRecs} recommendation{totalRecs !== 1 ? 's' : ''}
                    </div>
                    <div className="text-apple-xs text-apple-text-tertiary mt-0.5">
                      {new Date(latestDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(latestDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this entire audit run?')) deleteRun(run, runIdx); }}
                      disabled={isDeleting}
                      className="p-2 rounded-apple-sm hover:bg-red-50 text-apple-text-tertiary hover:text-red-500 transition-colors disabled:opacity-50"
                      title="Delete audit run">
                      {isDeleting ? (
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      )}
                    </button>
                    <svg className={`w-4 h-4 text-apple-text-tertiary transition-transform ${isExp ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExp && (
                  <div className="border-t border-apple-divider bg-apple-fill-secondary/20">
                    {/* Per-type score bar */}
                    {uniqueTypes.length > 1 && (
                      <div className="px-4 py-3 flex gap-3 flex-wrap border-b border-apple-divider/50">
                        {uniqueTypes.map((t) => {
                          const typeResults = run.filter((r) => r.audit_type === t);
                          const typeAvg = Math.round(typeResults.reduce((s, r) => s + r.score, 0) / typeResults.length);
                          return (
                            <div key={t} className={`rounded-apple-sm border px-3 py-2 text-center min-w-[80px] ${getScoreBg(typeAvg)}`}>
                              <div className={`text-lg font-bold ${getScoreColor(typeAvg)}`}>{typeAvg}</div>
                              <div className="text-[10px] font-medium text-apple-text-secondary">{AUDIT_TYPE_LABELS[t]}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Pages within this run */}
                    <div className="divide-y divide-apple-divider/50">
                      {pageEntries.map(([pageUrl, audits]) => {
                        const pageAvg = Math.round(audits.reduce((s, a) => s + a.score, 0) / audits.length);
                        const isPageExp = expandedPage === `${runIdx}::${pageUrl}`;
                        const pageKey = `${runIdx}::${pageUrl}`;
                        return (
                          <div key={pageUrl}>
                            <button className="w-full px-4 py-3 text-left hover:bg-apple-fill-secondary/50 transition-colors flex items-center gap-3"
                              onClick={() => setExpandedPage(isPageExp ? null : pageKey)}>
                              <span className={`text-lg font-bold w-10 text-center shrink-0 ${getScoreColor(pageAvg)}`}>{pageAvg}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                  {audits.map((a) => (
                                    <span key={a.audit_type} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${AUDIT_TYPE_COLORS[a.audit_type]}`}>
                                      {AUDIT_TYPE_LABELS[a.audit_type]} {a.score}
                                    </span>
                                  ))}
                                </div>
                                <a href={pageUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-apple-sm text-apple-blue hover:underline truncate block">
                                  {pageUrl.replace(/^https?:\/\/[^/]+/, '') || '/'}
                                </a>
                              </div>
                              <span className="text-apple-xs text-apple-text-tertiary shrink-0">{audits.reduce((s, a) => s + a.recommendations.length, 0)} recs</span>
                              <svg className={`w-3.5 h-3.5 text-apple-text-tertiary transition-transform shrink-0 ${isPageExp ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            </button>

                            {isPageExp && (
                              <div className="px-4 pb-4 space-y-4 bg-white/50">
                                {audits.map((audit) => (
                                  <div key={audit.audit_type} className="mt-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className={`px-2 py-0.5 rounded text-apple-xs font-bold ${AUDIT_TYPE_COLORS[audit.audit_type]}`}>{AUDIT_TYPE_LABELS[audit.audit_type]}</span>
                                      <span className={`text-apple-sm font-bold ${getScoreColor(audit.score)}`}>{audit.score}/100</span>
                                    </div>
                                    {audit.summary && <div className={`rounded-apple-sm border p-3 mb-2 ${getScoreBg(audit.score)}`}><p className="text-apple-xs text-apple-text">{audit.summary}</p></div>}
                                    {audit.recommendations.filter((_, i) => !rejectedRecs.has(recKey(audit.page_url, audit.audit_type, i))).map((rec, i) => {
                                      const key = recKey(audit.page_url, audit.audit_type, i);
                                      const pc = PRIORITY_COLORS[rec.priority] || PRIORITY_COLORS.low;
                                      const isDone = completedRecs.has(key);
                                      const isRecExp = expandedRecs.has(key);
                                      return (
                                        <div key={i} className={`rounded-apple-sm border ${pc.border} ${isDone ? 'opacity-50' : ''} ${pc.bg} overflow-hidden mb-2`}>
                                          <div className="p-2.5 flex items-start gap-2">
                                            <input type="checkbox" checked={isDone} onChange={() => toggleRecDone(key, `${rec.issue} — ${rec.recommendation}`, audit.audit_type)} className="mt-1 shrink-0 rounded" />
                                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleRecExpanded(key)}>
                                              <div className="flex items-center gap-2 mb-0.5">
                                                <span className={`text-[10px] font-bold uppercase ${pc.text}`}>{rec.priority}</span>
                                                <span className="text-[10px] text-apple-text-tertiary">{rec.category}</span>
                                              </div>
                                              <p className={`text-apple-xs font-medium ${isDone ? 'line-through text-apple-text-tertiary' : 'text-apple-text'}`}>{rec.issue}</p>
                                            </div>
                                            <button onClick={() => rejectRec(key, `${rec.issue} — ${rec.recommendation}`, audit.audit_type)} title="Reject" className="p-1 rounded hover:bg-red-100 text-apple-text-tertiary hover:text-red-500 transition-colors shrink-0">
                                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                            </button>
                                            <svg className={`w-3 h-3 mt-1 text-apple-text-tertiary transition-transform shrink-0 cursor-pointer ${isRecExp ? 'rotate-180' : ''}`} onClick={() => toggleRecExpanded(key)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                          </div>
                                          {isRecExp && (
                                            <div className="px-2.5 pb-2.5 border-t border-apple-divider/30 pt-2 space-y-1.5">
                                              <div><p className="text-[10px] font-semibold text-apple-text-secondary">Recommendation</p><p className="text-apple-xs text-apple-text mt-0.5">{rec.recommendation}</p></div>
                                              {rec.howToFix && <div><p className="text-[10px] font-semibold text-apple-text-secondary">How to Fix</p><p className="text-apple-xs text-apple-text mt-0.5 whitespace-pre-wrap">{rec.howToFix}</p></div>}
                                              {rec.impact && <div><p className="text-[10px] font-semibold text-apple-text-secondary">Impact</p><p className="text-apple-xs text-apple-text-secondary mt-0.5">{rec.impact}</p></div>}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
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
              </div>
            );
          })}
        </div>
      )}

      {!loadingResults && results.length === 0 && !isRunning && (
        <div className="card p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-apple-fill-secondary mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-apple-title3 font-semibold text-apple-text mb-2">No audits yet</h3>
          <p className="text-apple-base text-apple-text-secondary max-w-md mx-auto">
            Select audit types and a mode above to run your first audit.
          </p>
        </div>
      )}
    </div>
  );
}
