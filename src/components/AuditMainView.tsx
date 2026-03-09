import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { logActivity } from '../utils/activityLog';
import { InfoTooltip } from './Tooltip';
import { useBackgroundTasks } from '../contexts/BackgroundTaskContext';

type AuditType = 'seo' | 'content' | 'aeo' | 'schema' | 'compliance' | 'speed';
type AuditMode = 'page' | 'pages' | 'site';

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


interface AuditMainViewProps {
  siteUrl: string;
  projectId: string;
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

const MODE_INFO: Record<AuditMode, { label: string; icon: string; desc: string; tip: string }> = {
  page: { label: 'Single Page', icon: '📄', desc: 'Audit a specific URL', tip: 'Enter any URL to run all selected audit types on that single page.' },
  pages: { label: 'Multiple Pages', icon: '📑', desc: 'Select up to 10 pages to audit', tip: 'Manually add URLs or pick from your sitemap. Max 10 pages per audit run.' },
  site: { label: 'Full Site', icon: '🌐', desc: 'Audit every unique page in your sitemap', tip: 'Fetches your sitemap, detects dynamic/template pages, and audits only unique page structures.' },
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

export default function AuditMainView({ siteUrl, projectId }: AuditMainViewProps) {
  const { startTask } = useBackgroundTasks();
  const [selectedTypes, setSelectedTypes] = useState<Set<AuditType>>(new Set(['seo', 'content', 'aeo', 'schema', 'compliance', 'speed']));
  const [mode, setMode] = useState<AuditMode | null>(null);
  const [pageUrlInput, setPageUrlInput] = useState('');
  const [multiPages, setMultiPages] = useState<string[]>([]);
  const [multiPageInput, setMultiPageInput] = useState('');
  const [showSitemapPicker, setShowSitemapPicker] = useState(false);
  const [sitemapUrls, setSitemapUrls] = useState<string[]>([]);
  const [sitemapSearch, setSitemapSearch] = useState('');
  const [loadingSitemapPicker, setLoadingSitemapPicker] = useState(false);

  const [templateGroups, setTemplateGroups] = useState<any[] | null>(null);
  const [templateSummary, setTemplateSummary] = useState<any>(null);
  const [classifying, setClassifying] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [disabledTemplates, setDisabledTemplates] = useState<Set<string>>(new Set());

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
  const [selectedForTasklist, setSelectedForTasklist] = useState<Set<string>>(new Set());
  const [addingToTasklist, setAddingToTasklist] = useState(false);

  const loadResults = useCallback(async () => {
    if (!siteUrl) return;
    setLoadingResults(true);
    try {
      const resp = await fetch(`${API_ENDPOINTS.db.pageAudits}?siteUrl=${encodeURIComponent(siteUrl)}&projectId=${projectId}`);
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
          const resp = await fetch(`${API_ENDPOINTS.db.completedTasks}?siteUrl=${encodeURIComponent(siteUrl)}&keyword=${encodeURIComponent(`audit:${auditType}`)}&projectId=${projectId}`);
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

  const addMultiPage = (url: string) => {
    const full = url.startsWith('http') ? url : `${siteUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    if (multiPages.length >= 10 || multiPages.includes(full)) return;
    setMultiPages((prev) => [...prev, full]);
    setMultiPageInput('');
  };

  const removeMultiPage = (url: string) => {
    setMultiPages((prev) => prev.filter((p) => p !== url));
  };

  const loadSitemapForPicker = useCallback(async () => {
    setLoadingSitemapPicker(true);
    try {
      const resp = await fetch(`${API_ENDPOINTS.audit.sitemap}?siteUrl=${encodeURIComponent(siteUrl)}`);
      if (resp.ok) {
        const data = await resp.json();
        setSitemapUrls(data.urls || []);
      }
    } catch { /* */ }
    setLoadingSitemapPicker(false);
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
    const typesStr = typesArray.join(', ');
    const taskId = `audit-multi-${projectId}-${Date.now()}`;

    startTask(taskId, 'site-audit', `Site Audit: ${urls.length} page${urls.length > 1 ? 's' : ''}`, async () => {
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
              body: JSON.stringify({ siteUrl, projectId, pageUrl, auditTypes: typesArray }),
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
      logActivity(siteUrl, 'seo', 'full-audit', `Full audit completed: ${totalAudited} pages, types: ${typesStr}`);
    });
  }, [siteUrl, projectId, selectedTypes, startTask]);

  const handleStartPage = () => {
    const url = pageUrlInput.trim();
    if (!url) return;
    const fullUrl = url.startsWith('http') ? url : `${siteUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    runMultiAudit([fullUrl], false);
  };
  const handleStartMultiPages = () => { if (multiPages.length > 0) runMultiAudit(multiPages, false); };
  const handleClassifySite = async () => {
    setClassifying(true); setError(null);
    const urls = await fetchSitemap();
    if (urls.length === 0) { setClassifying(false); return; }
    startTask(`classify-site-${projectId}`, 'site-audit', 'Classifying site pages', async () => {
      try {
        const resp = await fetch(API_ENDPOINTS.audit.classifyPages, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls }),
        });
        if (resp.ok) {
          const data = await resp.json();
          setTemplateGroups(data.groups || []);
          setTemplateSummary({ totalPages: data.totalPages, uniqueTemplates: data.uniqueTemplates, dynamicGroups: data.dynamicGroups, auditablePages: data.auditablePages, blogGroups: data.blogGroups });
        }
      } catch { setError('Failed to classify pages'); }
      setClassifying(false);
    });
  };
  const handleStartSiteFromTemplates = () => {
    if (!templateGroups) return;
    const auditUrls: string[] = [];
    for (const g of templateGroups) {
      if (disabledTemplates.has(g.templateId)) continue;
      if (g.isBlog) auditUrls.push(...g.urls);
      else auditUrls.push(g.representative);
    }
    if (auditUrls.length > 0) runMultiAudit(auditUrls, false);
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
            body: JSON.stringify({ id: r.id, projectId }),
          });
        } else {
          await fetch(API_ENDPOINTS.db.pageAudits, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteUrl, projectId, pageUrl: r.page_url, auditType: r.audit_type, auditedAt: r.audited_at }),
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
      try { await fetch(API_ENDPOINTS.db.completedTasks, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteUrl, projectId, keyword: `audit:${auditType}`, taskId: key }) }); } catch { /* */ }
    } else {
      setCompletedRecs((prev) => new Set(prev).add(key));
      setPendingRecs((prev) => { const n = new Set(prev); n.delete(key); return n; });
      try { await fetch(API_ENDPOINTS.db.completedTasks, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteUrl, projectId, keyword: `audit:${auditType}`, taskId: key, taskText, category: auditType, status: 'completed' }) }); } catch { /* */ }
    }
  }, [siteUrl, completedRecs]);

  const rejectRec = useCallback(async (key: string, taskText: string, auditType: AuditType) => {
    const isRejected = rejectedRecs.has(key);
    if (isRejected) {
      setRejectedRecs((prev) => { const n = new Set(prev); n.delete(key); return n; });
      try { await fetch(API_ENDPOINTS.db.completedTasks, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteUrl, projectId, keyword: `audit:${auditType}`, taskId: key }) }); } catch { /* */ }
    } else {
      setRejectedRecs((prev) => new Set(prev).add(key));
      setCompletedRecs((prev) => { const n = new Set(prev); n.delete(key); return n; });
      setPendingRecs((prev) => { const n = new Set(prev); n.delete(key); return n; });
      try { await fetch(API_ENDPOINTS.db.completedTasks, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteUrl, projectId, keyword: `audit:${auditType}`, taskId: key, taskText, category: auditType, status: 'rejected' }) }); } catch { /* */ }
    }
  }, [siteUrl, rejectedRecs]);

  const toggleSelected = useCallback((key: string) => {
    setSelectedForTasklist((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }, []);

  const addSelectedToTasklist = useCallback(async () => {
    if (selectedForTasklist.size === 0) return;
    setAddingToTasklist(true);
    for (const key of selectedForTasklist) {
      if (completedRecs.has(key) || pendingRecs.has(key)) continue;
      const [auditType, pageUrl, idxStr] = key.split('::');
      const idx = parseInt(idxStr, 10);
      const result = results.find((r) => r.page_url === pageUrl && r.audit_type === auditType);
      const rec = result?.recommendations[idx];
      if (!rec) continue;
      setPendingRecs((prev) => new Set(prev).add(key));
      try {
        await fetch(API_ENDPOINTS.db.completedTasks, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl, projectId, keyword: `audit:${auditType}`, taskId: key, taskText: `[${AUDIT_TYPE_LABELS[auditType as AuditType]}] ${rec.issue} — ${rec.recommendation}`, category: rec.category, status: 'pending' }),
        });
      } catch { /* */ }
    }
    setSelectedForTasklist(new Set());
    setAddingToTasklist(false);
  }, [selectedForTasklist, completedRecs, pendingRecs, results, siteUrl, projectId]);

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
        <div className="grid grid-cols-3 gap-3 mb-6">
          {(Object.keys(MODE_INFO) as AuditMode[]).map((m) => {
            const info = MODE_INFO[m]; const isActive = mode === m;
            return (
              <button key={m} onClick={() => { setMode(isActive ? null : m); setError(null); setTemplateGroups(null); setTemplateSummary(null); }}
                className={`rounded-apple border p-4 text-left transition-all ${isActive ? 'border-apple-blue bg-apple-blue/5 ring-1 ring-apple-blue' : 'border-apple-divider bg-white hover:border-apple-blue/40'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-lg">{info.icon}</span>
                  <InfoTooltip text={info.tip} position="top" />
                </div>
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
      {mode === 'pages' && !isRunning && (
        <div className="rounded-apple border border-apple-divider bg-white p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider">Select Pages</label>
            <span className="text-apple-xs text-apple-text-tertiary">{multiPages.length}/10 selected</span>
          </div>
          <div className="flex gap-2 mb-3">
            <input type="text" value={multiPageInput} onChange={(e) => setMultiPageInput(e.target.value)} placeholder={`${siteUrl}/page-path or full URL`}
              className="flex-1 px-3 py-2 rounded-apple-sm border border-apple-border text-apple-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue"
              onKeyDown={(e) => { if (e.key === 'Enter' && multiPageInput.trim()) addMultiPage(multiPageInput.trim()); }} disabled={multiPages.length >= 10} />
            <button onClick={() => { if (multiPageInput.trim()) addMultiPage(multiPageInput.trim()); }} disabled={!multiPageInput.trim() || multiPages.length >= 10}
              className="px-3 py-2 rounded-apple-sm border border-apple-border text-apple-sm text-apple-text-secondary hover:bg-apple-fill-secondary transition-colors disabled:opacity-50">Add</button>
            <button onClick={() => { setShowSitemapPicker(true); if (sitemapUrls.length === 0) loadSitemapForPicker(); }} disabled={multiPages.length >= 10}
              className="px-3 py-2 rounded-apple-sm border border-apple-border text-apple-sm text-apple-text-secondary hover:bg-apple-fill-secondary transition-colors disabled:opacity-50 shrink-0">Import from Sitemap</button>
          </div>
          {multiPages.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {multiPages.map((url) => (
                <span key={url} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-apple-pill bg-apple-blue/10 text-apple-blue text-apple-xs font-medium max-w-[300px]">
                  <span className="truncate">{url.replace(/^https?:\/\/[^/]+/, '')}</span>
                  <button onClick={() => removeMultiPage(url)} className="shrink-0 hover:text-apple-red transition-colors">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              ))}
            </div>
          )}
          {multiPages.length > 0 && (
            <button onClick={handleStartMultiPages} className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors">
              Audit {multiPages.length} Page{multiPages.length !== 1 ? 's' : ''} ({selectedTypes.size} types)
            </button>
          )}
          {showSitemapPicker && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
              <div className="bg-white rounded-apple shadow-apple-lg w-full max-w-lg mx-4 p-6 max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-apple-base font-semibold text-apple-text">Select from Sitemap</h3>
                  <button onClick={() => setShowSitemapPicker(false)} className="p-1 rounded hover:bg-apple-fill-secondary transition-colors">
                    <svg className="w-5 h-5 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                {loadingSitemapPicker ? (
                  <div className="flex items-center justify-center py-8"><div className="w-5 h-5 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" /><span className="ml-2 text-apple-sm text-apple-text-secondary">Loading sitemap...</span></div>
                ) : (
                  <>
                    <input type="text" value={sitemapSearch} onChange={(e) => setSitemapSearch(e.target.value)} placeholder="Filter URLs..."
                      className="px-3 py-2 rounded-apple-sm border border-apple-border text-apple-sm mb-3 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue" />
                    <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
                      {sitemapUrls.filter((u) => !sitemapSearch || u.toLowerCase().includes(sitemapSearch.toLowerCase())).slice(0, 100).map((url) => {
                        const isSelected = multiPages.includes(url);
                        return (<button key={url} onClick={() => { if (isSelected) removeMultiPage(url); else addMultiPage(url); }} disabled={!isSelected && multiPages.length >= 10}
                          className={`w-full text-left px-3 py-2 rounded-apple-sm text-apple-xs transition-colors truncate ${isSelected ? 'bg-apple-blue/10 text-apple-blue font-medium' : 'hover:bg-apple-fill-secondary text-apple-text disabled:opacity-40'}`}>
                          {isSelected && <span className="mr-1.5">✓</span>}{url.replace(/^https?:\/\/[^/]+/, '')}
                        </button>);
                      })}
                      {sitemapUrls.length === 0 && <p className="text-apple-sm text-apple-text-tertiary text-center py-4">No URLs found in sitemap.</p>}
                    </div>
                    <div className="flex justify-end mt-4 pt-3 border-t border-apple-divider"><button onClick={() => setShowSitemapPicker(false)} className="btn-primary">Done</button></div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {mode === 'site' && !isRunning && !templateGroups && (
        <div className="rounded-apple border border-apple-divider bg-white p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-apple-sm font-medium text-apple-text">Full Site Audit</p>
            <p className="text-apple-xs text-apple-text-tertiary mt-0.5">Analyzes your sitemap, detects dynamic templates, and runs {selectedTypes.size} audit type{selectedTypes.size !== 1 ? 's' : ''} on unique pages.</p>
          </div>
          <button onClick={handleClassifySite} disabled={loadingSitemap || classifying} className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50 shrink-0">
            {classifying ? 'Analyzing...' : loadingSitemap ? 'Loading...' : 'Analyze Site'}
          </button>
        </div>
      )}
      {mode === 'site' && !isRunning && templateGroups && templateSummary && (
        <div className="rounded-apple border border-apple-divider bg-white p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-apple-base font-semibold text-apple-text">Site Analysis Complete</p>
              <p className="text-apple-xs text-apple-text-tertiary mt-0.5">{templateSummary.totalPages} pages · {templateSummary.uniqueTemplates} templates · {templateSummary.auditablePages} to audit · {selectedTypes.size} type{selectedTypes.size !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={handleStartSiteFromTemplates} className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors shrink-0">Start Audit</button>
          </div>
          {templateSummary.dynamicGroups > 0 && (
            <div className="px-3 py-2 rounded-apple-sm bg-amber-50 border border-amber-200 text-apple-xs text-amber-800 mb-4">
              {templateSummary.dynamicGroups} dynamic template{templateSummary.dynamicGroups !== 1 ? 's' : ''} detected — only 1 representative page per template will be audited.
            </div>
          )}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {templateGroups.map((g) => {
              const isDisabled = disabledTemplates.has(g.templateId);
              const isExpanded = expandedTemplate === g.templateId;
              return (
                <div key={g.templateId} className={`rounded-apple-sm border transition-all ${isDisabled ? 'border-apple-divider bg-apple-fill-secondary opacity-60' : 'border-apple-divider bg-white'}`}>
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <button onClick={() => setDisabledTemplates((prev) => { const n = new Set(prev); if (n.has(g.templateId)) n.delete(g.templateId); else n.add(g.templateId); return n; })}
                      className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${isDisabled ? 'border-apple-text-tertiary' : 'border-apple-blue bg-apple-blue'}`}>
                      {!isDisabled && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-apple-sm font-medium text-apple-text truncate">{g.pattern}</span>
                        {g.isDynamic && <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">Template · {g.count} pages</span>}
                        {g.isBlog && <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 shrink-0">Blog · {g.count} posts</span>}
                        {!g.isDynamic && !g.isBlog && g.count === 1 && <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">Unique</span>}
                      </div>
                      <p className="text-apple-xs text-apple-text-tertiary truncate mt-0.5">{g.isDynamic ? `Auditing: ${g.representative.replace(/^https?:\/\/[^/]+/, '')}` : g.representative.replace(/^https?:\/\/[^/]+/, '')}</p>
                    </div>
                    {g.count > 1 && <button onClick={() => setExpandedTemplate(isExpanded ? null : g.templateId)} className="text-apple-xs text-apple-blue hover:underline shrink-0">{isExpanded ? 'Hide' : `${g.count} URLs`}</button>}
                  </div>
                  {isExpanded && g.count > 1 && (
                    <div className="px-3 pb-2.5 ml-7 space-y-0.5 max-h-[200px] overflow-y-auto border-t border-apple-divider pt-2">
                      {g.urls.slice(0, 50).map((u: string) => (<p key={u} className="text-apple-xs text-apple-text-tertiary truncate">{u.replace(/^https?:\/\/[^/]+/, '')}</p>))}
                      {g.urls.length > 50 && <p className="text-apple-xs text-apple-text-tertiary italic">...and {g.urls.length - 50} more</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
                  <div className="relative w-14 h-14 shrink-0">
                    <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4" className="text-apple-fill-secondary" />
                      <circle cx="28" cy="28" r="24" fill="none" strokeWidth="4" strokeLinecap="round"
                        className={avgScore >= 80 ? 'text-green-500' : avgScore >= 60 ? 'text-amber-500' : 'text-red-500'}
                        strokeDasharray={`${avgScore * 1.508} 150.8`} />
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center text-apple-sm font-bold ${getScoreColor(avgScore)}`}>{avgScore}</span>
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
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-apple-xs text-apple-text-tertiary">
                        {new Date(latestDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(latestDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {totalRecs > 0 && (() => {
                        const doneCount = run.reduce((sum, r) => sum + r.recommendations.filter((_, ri) => completedRecs.has(recKey(r.page_url, r.audit_type, ri))).length, 0);
                        const pct = Math.round((doneCount / totalRecs) * 100);
                        return (
                          <span className="flex items-center gap-1.5">
                            <span className="text-apple-xs text-apple-text-tertiary">{doneCount}/{totalRecs}</span>
                            <span className="w-16 h-1.5 bg-apple-fill-secondary rounded-full overflow-hidden">
                              <span className="block h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </span>
                          </span>
                        );
                      })()}
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

                            {isPageExp && (() => {
                              const allPageRecKeys: string[] = [];
                              for (const audit of audits) {
                                audit.recommendations.forEach((_, i) => {
                                  const key = recKey(audit.page_url, audit.audit_type, i);
                                  if (!rejectedRecs.has(key) && !completedRecs.has(key) && !pendingRecs.has(key)) {
                                    allPageRecKeys.push(key);
                                  }
                                });
                              }
                              const allPageSelected = allPageRecKeys.length > 0 && allPageRecKeys.every((k) => selectedForTasklist.has(k));
                              const somePageSelected = allPageRecKeys.some((k) => selectedForTasklist.has(k));
                              const pageSelectedCount = allPageRecKeys.filter((k) => selectedForTasklist.has(k)).length;

                              return (
                              <div className="px-4 pb-4 space-y-4 bg-white/50">
                                {allPageRecKeys.length > 0 && (
                                  <div className="flex items-center gap-3 pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={allPageSelected}
                                        ref={(el) => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                                        onChange={() => {
                                          setSelectedForTasklist((prev) => {
                                            const n = new Set(prev);
                                            if (allPageSelected) { for (const k of allPageRecKeys) n.delete(k); }
                                            else { for (const k of allPageRecKeys) n.add(k); }
                                            return n;
                                          });
                                        }}
                                        className="rounded"
                                      />
                                      <span className="text-apple-xs font-medium text-apple-text-secondary">Select All</span>
                                    </label>
                                    {pageSelectedCount > 0 && (
                                      <button onClick={addSelectedToTasklist} disabled={addingToTasklist}
                                        className="px-3 py-1 rounded-apple-sm bg-apple-blue text-white text-apple-xs font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50">
                                        {addingToTasklist ? 'Adding…' : `Add ${pageSelectedCount} to Tasklist`}
                                      </button>
                                    )}
                                  </div>
                                )}
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
                                      const isPending = pendingRecs.has(key);
                                      const isActioned = isDone || isPending;
                                      const isSelected = selectedForTasklist.has(key);
                                      const isRecExp = expandedRecs.has(key);
                                      return (
                                        <div key={i} className={`rounded-apple-sm border ${pc.border} ${isDone ? 'opacity-50' : ''} ${pc.bg} overflow-hidden mb-2`}>
                                          <div className="p-2.5 flex items-start gap-2">
                                            <input type="checkbox" checked={isSelected || isActioned} disabled={isActioned}
                                              onChange={() => { if (!isActioned) toggleSelected(key); }}
                                              className="mt-1 shrink-0 rounded" />
                                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleRecExpanded(key)}>
                                              <div className="flex items-center gap-2 mb-0.5">
                                                <span className={`text-[10px] font-bold uppercase ${pc.text}`}>{rec.priority}</span>
                                                <span className="text-[10px] text-apple-text-tertiary">{rec.category}</span>
                                                {isPending && <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">On Tasklist</span>}
                                                {isDone && <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Completed</span>}
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
                              );
                            })()}
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

      {selectedForTasklist.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white border border-apple-divider shadow-apple-lg rounded-apple px-5 py-3 flex items-center gap-4">
          <span className="text-apple-sm font-medium text-apple-text">{selectedForTasklist.size} recommendation{selectedForTasklist.size !== 1 ? 's' : ''} selected</span>
          <button onClick={addSelectedToTasklist} disabled={addingToTasklist}
            className="px-4 py-1.5 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50">
            {addingToTasklist ? 'Adding…' : 'Add to Tasklist'}
          </button>
          <button onClick={() => setSelectedForTasklist(new Set())}
            className="text-apple-xs text-apple-text-tertiary hover:text-apple-text transition-colors">
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
