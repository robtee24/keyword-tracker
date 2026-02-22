import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { authenticatedFetch } from '../services/authService';
import { logActivity } from '../utils/activityLog';

type AdAuditType = 'google' | 'meta' | 'linkedin' | 'reddit' | 'budget' | 'performance' | 'creative' | 'attribution' | 'structure';

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  issue: string;
  recommendation: string;
  howToFix?: string;
  impact: string;
}

interface AuditResult {
  score: number;
  summary: string;
  strengths: string[];
  recommendations: Recommendation[];
  audited_at: string;
  file_name?: string;
  error?: string;
}

interface AdAuditViewProps {
  siteUrl: string;
  adAuditType: AdAuditType;
  title: string;
  description: string;
  isVisible?: boolean;
}

const AD_AUDIT_TYPE_LABELS: Record<AdAuditType, string> = {
  google: 'Google Ads', meta: 'Meta Ads', linkedin: 'LinkedIn Ads', reddit: 'Reddit Ads',
  budget: 'Budget & Spend', performance: 'Performance', creative: 'Creative & Copy',
  attribution: 'Attribution', structure: 'Account Structure',
};

const PRIORITY_COLORS = {
  high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  low: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
};

function getScoreColor(s: number) { return s >= 80 ? 'text-green-600' : s >= 60 ? 'text-amber-600' : 'text-red-600'; }
function getScoreBg(s: number) { return s >= 80 ? 'bg-green-50 border-green-200' : s >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'; }
function getBarColor(s: number) { return s >= 80 ? 'bg-green-500' : s >= 60 ? 'bg-amber-500' : 'bg-red-500'; }

function recKey(auditType: string, idx: number) { return `ad::${auditType}::${idx}`; }

const RECS_PER_PAGE = 30;

export default function AdAuditView({ siteUrl, adAuditType, title, description, isVisible }: AdAuditViewProps) {
  const [result, setResult] = useState<AuditResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedRecs, setExpandedRecs] = useState<Set<string>>(new Set());
  const [checkedRecs, setCheckedRecs] = useState<Set<string>>(new Set());
  const [doneRecs, setDoneRecs] = useState<Set<string>>(new Set());
  const [rejectedRecs, setRejectedRecs] = useState<Set<string>>(new Set());
  const [filterPriority, setFilterPriority] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [recPage, setRecPage] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevVisibleRef = useRef(isVisible);

  const loadResult = useCallback(async () => {
    try {
      const r = await authenticatedFetch(`${API_ENDPOINTS.db.pageAudits}?site_url=${encodeURIComponent(siteUrl)}&audit_type=ad-${adAuditType}`);
      if (r.ok) {
        const data = await r.json();
        if (data.audits?.length) {
          const latest = data.audits[0];
          setResult({
            score: latest.score || 0,
            summary: latest.summary || '',
            strengths: latest.strengths || [],
            recommendations: latest.recommendations || [],
            audited_at: latest.audited_at || latest.created_at || '',
            file_name: latest.page_url || '',
          });
        }
      }
    } catch { /* skip */ }
  }, [siteUrl, adAuditType]);

  const loadTasks = useCallback(async () => {
    try {
      const r = await authenticatedFetch(`${API_ENDPOINTS.db.completedTasks}?site_url=${encodeURIComponent(siteUrl)}&keyword=ad-${adAuditType}`);
      if (r.ok) {
        const data = await r.json();
        const done = new Set<string>();
        const rejected = new Set<string>();
        (data.tasks || []).forEach((t: { task_id: string; status: string }) => {
          if (t.status === 'completed') done.add(t.task_id);
          else if (t.status === 'rejected') rejected.add(t.task_id);
        });
        setDoneRecs(done);
        setRejectedRecs(rejected);
      }
    } catch { /* skip */ }
  }, [siteUrl, adAuditType]);

  useEffect(() => { loadResult(); }, [loadResult]);
  useEffect(() => { loadTasks(); }, [loadTasks]);

  useEffect(() => {
    if (isVisible && !prevVisibleRef.current && !isRunning) {
      loadResult();
      loadTasks();
    }
    prevVisibleRef.current = isVisible;
  }, [isVisible, isRunning, loadResult, loadTasks]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const runAudit = async () => {
    if (!uploadedFile) return;
    setIsRunning(true);
    try {
      const fileContent = await uploadedFile.text();
      const res = await authenticatedFetch(API_ENDPOINTS.audit.runAdAudit, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          auditType: adAuditType,
          fileName: uploadedFile.name,
          csvData: fileContent,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult({
          score: data.score || 0,
          summary: data.summary || '',
          strengths: data.strengths || [],
          recommendations: data.recommendations || [],
          audited_at: new Date().toISOString(),
          file_name: uploadedFile.name,
        });
      }
      logActivity(siteUrl, 'ad', `audit-${adAuditType}`, `${adAuditType} ad audit completed: ${uploadedFile.name}`);
    } catch (err) {
      console.error('Ad audit failed:', err);
    }
    setIsRunning(false);
  };

  const toggleRec = useCallback(async (key: string) => {
    const wasDone = doneRecs.has(key);
    const newStatus = wasDone ? 'pending' : 'completed';
    if (wasDone) {
      setDoneRecs(prev => { const n = new Set(prev); n.delete(key); return n; });
    } else {
      setDoneRecs(prev => new Set(prev).add(key));
      setRejectedRecs(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
    try {
      await authenticatedFetch(API_ENDPOINTS.db.completedTasks, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_url: siteUrl, keyword: `ad-${adAuditType}`, task_id: key, status: newStatus }),
      });
    } catch { /* skip */ }
  }, [siteUrl, adAuditType, doneRecs]);

  const rejectRec = useCallback(async (key: string, taskText: string) => {
    setRejectedRecs(prev => new Set(prev).add(key));
    setDoneRecs(prev => { const n = new Set(prev); n.delete(key); return n; });
    try {
      await authenticatedFetch(API_ENDPOINTS.db.completedTasks, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_url: siteUrl, keyword: `ad-${adAuditType}`, task_id: key, task_text: taskText, status: 'rejected' }),
      });
    } catch { /* skip */ }
  }, [siteUrl, adAuditType]);

  const addToTasklist = useCallback(async (key: string, taskText: string) => {
    try {
      await authenticatedFetch(API_ENDPOINTS.db.completedTasks, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_url: siteUrl, keyword: `ad-${adAuditType}`, task_id: key, task_text: taskText, status: 'pending' }),
      });
      setCheckedRecs(prev => { const n = new Set(prev); n.delete(key); return n; });
    } catch { /* skip */ }
  }, [siteUrl, adAuditType]);

  const visibleRecs = useMemo(() => {
    if (!result) return [];
    let list = result.recommendations.map((r, i) => ({ ...r, idx: i }));
    list = list.filter((_, i) => {
      const key = recKey(adAuditType, i);
      return !rejectedRecs.has(key);
    });
    if (filterPriority !== 'all') list = list.filter(r => r.priority === filterPriority);
    return list;
  }, [result, filterPriority, rejectedRecs, adAuditType]);

  const pagedRecs = visibleRecs.slice(recPage * RECS_PER_PAGE, (recPage + 1) * RECS_PER_PAGE);
  const totalRecPages = Math.ceil(visibleRecs.length / RECS_PER_PAGE);

  return (
    <div className="space-y-6 max-w-5xl">
      <input ref={fileInputRef} type="file" accept=".csv,.tsv,.xlsx,.xls,.json" className="hidden" onChange={handleFileChange} />

      <div>
        <h2 className="text-xl font-semibold text-apple-text mb-1">{title}</h2>
        <p className="text-apple-sm text-apple-text-secondary">{description}</p>
      </div>

      {/* Upload & Run */}
      <div className="card p-5">
        <h3 className="text-apple-sm font-semibold text-apple-text mb-3">Upload Data</h3>
        <div className="flex items-center gap-3">
          {uploadedFile ? (
            <div className="flex items-center gap-2 text-apple-sm">
              <span className="text-green-600 font-medium">{uploadedFile.name}</span>
              <button onClick={() => setUploadedFile(null)} className="text-apple-red text-apple-xs hover:underline">Remove</button>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()} className="btn-secondary text-apple-sm">
              Choose CSV/TSV File
            </button>
          )}
          <button
            onClick={runAudit}
            disabled={!uploadedFile || isRunning}
            className="btn-primary text-apple-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? 'Analyzing...' : 'Run Audit'}
          </button>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-apple-xs bg-amber-50 text-amber-700 border border-amber-200">
            Connect Account — Coming Soon
          </span>
        </div>
      </div>

      {isRunning && (
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
            <span className="text-apple-sm text-apple-text-secondary">Analyzing your {AD_AUDIT_TYPE_LABELS[adAuditType]} data...</span>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !result.error && (
        <>
          <div className={`card p-5 border ${getScoreBg(result.score)}`}>
            <div className="flex items-center gap-4 mb-3">
              <div className={`text-3xl font-bold ${getScoreColor(result.score)}`}>{result.score}</div>
              <div>
                <div className="text-apple-sm font-semibold text-apple-text">{title}</div>
                <div className="text-apple-xs text-apple-text-secondary">
                  {new Date(result.audited_at).toLocaleDateString()} · {result.file_name}
                </div>
              </div>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
              <div className={`h-full rounded-full ${getBarColor(result.score)}`} style={{ width: `${result.score}%` }} />
            </div>
            <p className="text-apple-sm text-apple-text-secondary">{result.summary}</p>
          </div>

          {result.strengths?.length > 0 && (
            <div className="card p-4">
              <div className="text-apple-xs font-semibold text-green-700 mb-2">Strengths</div>
              <ul className="list-disc list-inside text-apple-xs text-apple-text-secondary space-y-1">
                {result.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-apple-sm font-semibold text-apple-text">
                Recommendations ({visibleRecs.length})
              </h3>
              <select value={filterPriority} onChange={e => { setFilterPriority(e.target.value as typeof filterPriority); setRecPage(0); }} className="input text-apple-xs">
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="space-y-2">
              {pagedRecs.map(rec => {
                const key = recKey(adAuditType, rec.idx);
                const isDone = doneRecs.has(key);
                const isExpanded = expandedRecs.has(key);
                const isChecked = checkedRecs.has(key);
                return (
                  <div key={key} className={`rounded border transition-all ${isDone ? 'opacity-50' : ''} ${PRIORITY_COLORS[rec.priority].bg} ${PRIORITY_COLORS[rec.priority].border}`}>
                    <div className="flex items-start gap-2 p-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => setCheckedRecs(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; })}
                        className="mt-0.5 accent-apple-blue"
                      />
                      <button onClick={() => setExpandedRecs(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; })} className="flex-1 text-left min-w-0">
                        <div className="text-apple-xs font-medium text-apple-text">{rec.issue}</div>
                        <div className="text-apple-xs text-apple-text-secondary mt-0.5">{rec.recommendation}</div>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        {isChecked && (
                          <button onClick={() => addToTasklist(key, rec.recommendation)} className="px-2 py-0.5 text-apple-xs bg-apple-blue text-white rounded hover:bg-apple-blue-hover">
                            Add to Tasklist
                          </button>
                        )}
                        <button onClick={() => toggleRec(key)} className={`px-2 py-0.5 text-apple-xs rounded ${isDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-apple-text-secondary hover:bg-gray-200'}`}>
                          {isDone ? '✓ Done' : 'Mark Done'}
                        </button>
                        <button onClick={() => rejectRec(key, rec.recommendation)} className="px-2 py-0.5 text-apple-xs rounded bg-gray-100 text-apple-text-tertiary hover:bg-red-50 hover:text-apple-red">
                          Reject
                        </button>
                      </div>
                    </div>
                    {isExpanded && rec.howToFix && (
                      <div className="px-3 pb-3 border-t border-apple-divider/50 pt-2">
                        <div className="text-apple-xs font-semibold text-apple-text mb-1">How to Fix</div>
                        <div className="text-apple-xs text-apple-text-secondary whitespace-pre-line">{rec.howToFix}</div>
                        {rec.impact && (
                          <div className="mt-2 text-apple-xs text-apple-text-tertiary"><strong>Impact:</strong> {rec.impact}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {totalRecPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-3">
                <button onClick={() => setRecPage(p => Math.max(0, p - 1))} disabled={recPage === 0} className="px-3 py-1 text-apple-xs rounded border border-apple-border disabled:opacity-40">Prev</button>
                <span className="text-apple-xs text-apple-text-tertiary">Page {recPage + 1} of {totalRecPages}</span>
                <button onClick={() => setRecPage(p => Math.min(totalRecPages - 1, p + 1))} disabled={recPage >= totalRecPages - 1} className="px-3 py-1 text-apple-xs rounded border border-apple-border disabled:opacity-40">Next</button>
              </div>
            )}
          </div>
        </>
      )}

      {!isRunning && !result && (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">📊</div>
          <h3 className="text-apple-sm font-semibold text-apple-text mb-1">No {title.toLowerCase()} results yet</h3>
          <p className="text-apple-xs text-apple-text-secondary max-w-md mx-auto">
            Upload a CSV/TSV export from your {AD_AUDIT_TYPE_LABELS[adAuditType]} account and click "Run Audit" to get AI-powered recommendations.
          </p>
        </div>
      )}
    </div>
  );
}
