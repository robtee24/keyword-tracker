import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { authenticatedFetch } from '../services/authService';

type AdAuditType = 'google' | 'meta' | 'linkedin' | 'reddit' | 'budget' | 'performance' | 'creative' | 'attribution' | 'structure';
type ResultsTab = 'summary' | 'audits' | 'recommendations';

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  issue: string;
  recommendation: string;
  howToFix?: string;
  impact: string;
}

interface AdAuditResult {
  audit_type: AdAuditType;
  score: number;
  summary: string;
  strengths: string[];
  recommendations: Recommendation[];
  audited_at: string;
  file_name?: string;
  error?: string;
}

interface AdAuditMainViewProps {
  siteUrl: string;
}

const ALL_AD_AUDIT_TYPES: { id: AdAuditType; label: string; desc: string }[] = [
  { id: 'google', label: 'Google Ads', desc: 'Wasted spend, Quality Score, bid strategy, extensions' },
  { id: 'meta', label: 'Meta Ads', desc: 'Creative fatigue, audience overlap, frequency caps' },
  { id: 'linkedin', label: 'LinkedIn Ads', desc: 'B2B benchmarks, audience quality, lead gen forms' },
  { id: 'reddit', label: 'Reddit Ads', desc: 'Community targeting, subreddit performance, bids' },
  { id: 'budget', label: 'Budget & Spend', desc: 'Cross-channel budget optimization, ROAS forecasting' },
  { id: 'performance', label: 'Performance', desc: 'CPA diagnostics, anomaly detection, geo/device splits' },
  { id: 'creative', label: 'Creative & Copy', desc: 'Ad copy variants, landing page conversion audit' },
  { id: 'attribution', label: 'Attribution', desc: 'Attribution models, conversion paths, UTM tracking' },
  { id: 'structure', label: 'Account Structure', desc: 'Campaign structure review, naming conventions' },
];

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

const AD_TYPE_COLORS: Record<AdAuditType, string> = {
  google: 'bg-blue-100 text-blue-700',
  meta: 'bg-indigo-100 text-indigo-700',
  linkedin: 'bg-sky-100 text-sky-700',
  reddit: 'bg-orange-100 text-orange-700',
  budget: 'bg-emerald-100 text-emerald-700',
  performance: 'bg-purple-100 text-purple-700',
  creative: 'bg-pink-100 text-pink-700',
  attribution: 'bg-cyan-100 text-cyan-700',
  structure: 'bg-amber-100 text-amber-700',
};

function getScoreColor(s: number) { return s >= 80 ? 'text-green-600' : s >= 60 ? 'text-amber-600' : 'text-red-600'; }
function getScoreBg(s: number) { return s >= 80 ? 'bg-green-50 border-green-200' : s >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'; }
function getBarColor(s: number) { return s >= 80 ? 'bg-green-500' : s >= 60 ? 'bg-amber-500' : 'bg-red-500'; }

function recKey(auditType: string, idx: number) { return `ad::${auditType}::${idx}`; }

const RECS_PER_PAGE = 30;

export default function AdAuditMainView({ siteUrl }: AdAuditMainViewProps) {
  const [selectedTypes, setSelectedTypes] = useState<Set<AdAuditType>>(new Set(ALL_AD_AUDIT_TYPES.map(t => t.id)));
  const [results, setResults] = useState<AdAuditResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '' });
  const [resultsTab, setResultsTab] = useState<ResultsTab>('summary');
  const [expandedRecs, setExpandedRecs] = useState<Set<string>>(new Set());
  const [checkedRecs, setCheckedRecs] = useState<Set<string>>(new Set());
  const [doneRecs, setDoneRecs] = useState<Set<string>>(new Set());
  const [rejectedRecs, setRejectedRecs] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<AdAuditType | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [recPage, setRecPage] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<Map<AdAuditType, File>>(new Map());

  const stopRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<AdAuditType | null>(null);

  // Load saved results on mount
  useEffect(() => {
    const loadAll = async () => {
      try {
        const res = await authenticatedFetch(`${API_ENDPOINTS.db.pageAudits}?site_url=${encodeURIComponent(siteUrl)}&audit_type=ad-google`);
        if (!res.ok) return;
        // Load all ad audit types
        const allResults: AdAuditResult[] = [];
        for (const t of ALL_AD_AUDIT_TYPES) {
          try {
            const r = await authenticatedFetch(`${API_ENDPOINTS.db.pageAudits}?site_url=${encodeURIComponent(siteUrl)}&audit_type=ad-${t.id}`);
            if (r.ok) {
              const data = await r.json();
              if (data.audits?.length) {
                const latest = data.audits[0];
                allResults.push({
                  audit_type: t.id,
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
        }
        if (allResults.length) setResults(allResults);
      } catch { /* skip */ }
    };
    loadAll();
  }, [siteUrl]);

  // Load task statuses
  useEffect(() => {
    const loadTasks = async () => {
      for (const t of ALL_AD_AUDIT_TYPES) {
        try {
          const r = await authenticatedFetch(`${API_ENDPOINTS.db.completedTasks}?site_url=${encodeURIComponent(siteUrl)}&keyword=ad-${t.id}`);
          if (r.ok) {
            const data = await r.json();
            const tasks = data.tasks || [];
            tasks.forEach((task: { task_id: string; status: string }) => {
              if (task.status === 'completed') setDoneRecs(prev => new Set(prev).add(task.task_id));
              else if (task.status === 'rejected') setRejectedRecs(prev => new Set(prev).add(task.task_id));
            });
          }
        } catch { /* skip */ }
      }
    };
    loadTasks();
  }, [siteUrl]);

  const toggleType = (id: AdAuditType) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleFileSelect = (type: AdAuditType) => {
    setUploadTarget(type);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadTarget) {
      setUploadedFiles(prev => new Map(prev).set(uploadTarget, file));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploadTarget(null);
  };

  const removeFile = (type: AdAuditType) => {
    setUploadedFiles(prev => {
      const next = new Map(prev);
      next.delete(type);
      return next;
    });
  };

  const runAudit = useCallback(async () => {
    const typesWithFiles = [...selectedTypes].filter(t => uploadedFiles.has(t));
    if (typesWithFiles.length === 0) return;
    stopRef.current = false;
    setIsRunning(true);
    setProgress({ done: 0, total: typesWithFiles.length, current: '' });
    setResults([]);

    for (let i = 0; i < typesWithFiles.length; i++) {
      if (stopRef.current) break;
      const auditType = typesWithFiles[i];
      const file = uploadedFiles.get(auditType)!;
      setProgress({ done: i, total: typesWithFiles.length, current: AD_AUDIT_TYPE_LABELS[auditType] });

      try {
        const fileContent = await file.text();
        const res = await authenticatedFetch(API_ENDPOINTS.audit.runAdAudit, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteUrl,
            auditType,
            fileName: file.name,
            csvData: fileContent,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setResults(prev => [...prev, {
            audit_type: auditType,
            score: data.score || 0,
            summary: data.summary || '',
            strengths: data.strengths || [],
            recommendations: data.recommendations || [],
            audited_at: new Date().toISOString(),
            file_name: file.name,
          }]);
        }
      } catch (err) {
        console.error(`Ad audit failed for ${auditType}:`, err);
        setResults(prev => [...prev, {
          audit_type: auditType,
          score: 0,
          summary: '',
          strengths: [],
          recommendations: [],
          audited_at: new Date().toISOString(),
          file_name: file.name,
          error: String(err),
        }]);
      }
    }
    setProgress(prev => ({ ...prev, done: typesWithFiles.length, current: '' }));
    setIsRunning(false);
  }, [siteUrl, selectedTypes, uploadedFiles]);

  const stopAudit = () => { stopRef.current = true; };

  const toggleRec = useCallback(async (key: string, auditType: string) => {
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
        body: JSON.stringify({ site_url: siteUrl, keyword: `ad-${auditType}`, task_id: key, status: newStatus }),
      });
    } catch { /* skip */ }
  }, [siteUrl, doneRecs]);

  const rejectRec = useCallback(async (key: string, auditType: string, taskText: string) => {
    setRejectedRecs(prev => new Set(prev).add(key));
    setDoneRecs(prev => { const n = new Set(prev); n.delete(key); return n; });
    try {
      await authenticatedFetch(API_ENDPOINTS.db.completedTasks, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_url: siteUrl, keyword: `ad-${auditType}`, task_id: key, task_text: taskText, status: 'rejected' }),
      });
    } catch { /* skip */ }
  }, [siteUrl]);

  const addToTasklist = useCallback(async (key: string, auditType: string, taskText: string) => {
    try {
      await authenticatedFetch(API_ENDPOINTS.db.completedTasks, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_url: siteUrl, keyword: `ad-${auditType}`, task_id: key, task_text: taskText, status: 'pending' }),
      });
      setCheckedRecs(prev => { const n = new Set(prev); n.delete(key); return n; });
    } catch { /* skip */ }
  }, [siteUrl]);

  const avgScore = useMemo(() => {
    const valid = results.filter(r => !r.error && r.score > 0);
    return valid.length ? Math.round(valid.reduce((s, r) => s + r.score, 0) / valid.length) : 0;
  }, [results]);

  const allRecs = useMemo(() => {
    const out: Array<Recommendation & { auditType: AdAuditType; idx: number }> = [];
    results.forEach(r => {
      if (r.error) return;
      r.recommendations.forEach((rec, i) => {
        const key = recKey(r.audit_type, i);
        if (!doneRecs.has(key) && !rejectedRecs.has(key)) {
          out.push({ ...rec, auditType: r.audit_type, idx: i });
        }
      });
    });
    return out;
  }, [results, doneRecs, rejectedRecs]);

  const filteredRecs = useMemo(() => {
    let list = allRecs;
    if (filterType !== 'all') list = list.filter(r => r.auditType === filterType);
    if (filterPriority !== 'all') list = list.filter(r => r.priority === filterPriority);
    return list;
  }, [allRecs, filterType, filterPriority]);

  const pagedRecs = filteredRecs.slice(recPage * RECS_PER_PAGE, (recPage + 1) * RECS_PER_PAGE);
  const totalRecPages = Math.ceil(filteredRecs.length / RECS_PER_PAGE);

  const hasFiles = uploadedFiles.size > 0;
  const canRun = hasFiles && [...selectedTypes].some(t => uploadedFiles.has(t)) && !isRunning;

  return (
    <div className="space-y-6 max-w-6xl">
      <input ref={fileInputRef} type="file" accept=".csv,.tsv,.xlsx,.xls,.json" className="hidden" onChange={handleFileChange} />

      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-apple-text mb-1">Ad Audit</h2>
        <p className="text-apple-sm text-apple-text-secondary">
          Upload your advertising platform exports (CSV/TSV) and run AI-powered audits. Select which audit types to perform, upload your data files, and get actionable recommendations.
        </p>
      </div>

      {/* Audit Type Checklist */}
      <div className="card p-5">
        <h3 className="text-apple-sm font-semibold text-apple-text mb-3">Select Audits & Upload Data</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ALL_AD_AUDIT_TYPES.map(t => {
            const isSelected = selectedTypes.has(t.id);
            const file = uploadedFiles.get(t.id);
            return (
              <div
                key={t.id}
                className={`rounded-apple border p-3 transition-all duration-150 ${
                  isSelected ? 'border-apple-blue bg-apple-blue/5' : 'border-apple-border bg-white'
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleType(t.id)}
                    className="mt-0.5 accent-apple-blue"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-apple-sm font-medium text-apple-text">{t.label}</div>
                    <div className="text-apple-xs text-apple-text-tertiary mt-0.5">{t.desc}</div>
                    {isSelected && (
                      <div className="mt-2">
                        {file ? (
                          <div className="flex items-center gap-2 text-apple-xs">
                            <span className="text-green-600 font-medium truncate flex-1">{file.name}</span>
                            <button onClick={() => removeFile(t.id)} className="text-apple-red hover:underline shrink-0">Remove</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleFileSelect(t.id)}
                            className="text-apple-xs text-apple-blue hover:underline"
                          >
                            Upload CSV/TSV export →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={runAudit}
            disabled={!canRun}
            className="btn-primary text-apple-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Run Audit
          </button>
          {isRunning && (
            <button onClick={stopAudit} className="text-apple-sm text-apple-red hover:underline">
              Stop
            </button>
          )}
          <div className="flex items-center gap-2 text-apple-xs text-apple-text-tertiary">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
              Connect Account — Coming Soon
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {isRunning && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-apple-sm font-medium text-apple-text">
              Auditing: {progress.current}
            </span>
            <span className="text-apple-xs text-apple-text-tertiary">
              {progress.done}/{progress.total}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-apple-blue rounded-full transition-all duration-500"
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <>
          {/* Tab Bar */}
          <div className="flex gap-1 border-b border-apple-divider">
            {(['summary', 'audits', 'recommendations'] as ResultsTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => { setResultsTab(tab); setRecPage(0); }}
                className={`px-4 py-2 text-apple-sm font-medium border-b-2 transition-colors ${
                  resultsTab === tab
                    ? 'border-apple-blue text-apple-blue'
                    : 'border-transparent text-apple-text-secondary hover:text-apple-text'
                }`}
              >
                {tab === 'summary' ? 'Summary' : tab === 'audits' ? 'By Audit Type' : `All Recommendations (${allRecs.length})`}
              </button>
            ))}
          </div>

          {/* Summary Tab */}
          {resultsTab === 'summary' && (
            <div className="space-y-4">
              <div className={`card p-5 border ${getScoreBg(avgScore)}`}>
                <div className="flex items-center gap-4">
                  <div className={`text-3xl font-bold ${getScoreColor(avgScore)}`}>{avgScore}</div>
                  <div>
                    <div className="text-apple-sm font-semibold text-apple-text">Overall Ad Health Score</div>
                    <div className="text-apple-xs text-apple-text-secondary">
                      {results.filter(r => !r.error).length} audit{results.filter(r => !r.error).length !== 1 ? 's' : ''} completed · {allRecs.length} recommendations
                    </div>
                  </div>
                </div>
              </div>

              {results.filter(r => !r.error).map(r => (
                <details key={r.audit_type} className="card">
                  <summary className="p-4 cursor-pointer flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-apple-xs font-medium ${AD_TYPE_COLORS[r.audit_type]}`}>
                      {AD_AUDIT_TYPE_LABELS[r.audit_type]}
                    </span>
                    <span className={`text-lg font-bold ${getScoreColor(r.score)}`}>{r.score}</span>
                    <span className="text-apple-xs text-apple-text-tertiary">
                      {new Date(r.audited_at).toLocaleDateString()}
                    </span>
                    <div className="flex-1" />
                    <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${getBarColor(r.score)}`} style={{ width: `${r.score}%` }} />
                    </div>
                  </summary>
                  <div className="px-4 pb-4 border-t border-apple-divider pt-3">
                    <p className="text-apple-sm text-apple-text-secondary mb-3">{r.summary}</p>
                    {r.strengths?.length > 0 && (
                      <div className="mb-3">
                        <div className="text-apple-xs font-semibold text-green-700 mb-1">Strengths</div>
                        <ul className="list-disc list-inside text-apple-xs text-apple-text-secondary space-y-0.5">
                          {r.strengths.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    <div className="text-apple-xs font-semibold text-apple-text mb-1">
                      {r.recommendations.length} Recommendations
                    </div>
                    {r.recommendations.slice(0, 5).map((rec, i) => {
                      const key = recKey(r.audit_type, i);
                      return (
                        <div key={i} className={`p-2 rounded border mb-1 ${PRIORITY_COLORS[rec.priority].bg} ${PRIORITY_COLORS[rec.priority].border}`}>
                          <div className="flex items-start gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${PRIORITY_COLORS[rec.priority].dot}`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-apple-xs font-medium text-apple-text">{rec.issue}</div>
                              <div className="text-apple-xs text-apple-text-secondary mt-0.5">{rec.recommendation}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {r.recommendations.length > 5 && (
                      <div className="text-apple-xs text-apple-text-tertiary mt-1">
                        +{r.recommendations.length - 5} more — see All Recommendations tab
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}

          {/* By Audit Type Tab */}
          {resultsTab === 'audits' && (
            <div className="space-y-4">
              {results.filter(r => !r.error).map(r => (
                <div key={r.audit_type} className="card p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-2 py-0.5 rounded text-apple-xs font-medium ${AD_TYPE_COLORS[r.audit_type]}`}>
                      {AD_AUDIT_TYPE_LABELS[r.audit_type]}
                    </span>
                    <span className={`text-xl font-bold ${getScoreColor(r.score)}`}>{r.score}/100</span>
                    <span className="text-apple-xs text-apple-text-tertiary ml-auto">
                      {new Date(r.audited_at).toLocaleDateString()} · {r.file_name}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full ${getBarColor(r.score)}`} style={{ width: `${r.score}%` }} />
                  </div>
                  <p className="text-apple-sm text-apple-text-secondary mb-4">{r.summary}</p>
                  <div className="space-y-2">
                    {r.recommendations.map((rec, i) => {
                      const key = recKey(r.audit_type, i);
                      const isDone = doneRecs.has(key);
                      const isRejected = rejectedRecs.has(key);
                      const isExpanded = expandedRecs.has(key);
                      const isChecked = checkedRecs.has(key);
                      if (isRejected) return null;
                      return (
                        <div key={i} className={`rounded border transition-all ${isDone ? 'opacity-50' : ''} ${PRIORITY_COLORS[rec.priority].bg} ${PRIORITY_COLORS[rec.priority].border}`}>
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
                                <button onClick={() => addToTasklist(key, r.audit_type, rec.recommendation)} className="px-2 py-0.5 text-apple-xs bg-apple-blue text-white rounded hover:bg-apple-blue-hover">
                                  Add to Tasklist
                                </button>
                              )}
                              <button onClick={() => toggleRec(key, r.audit_type)} className={`px-2 py-0.5 text-apple-xs rounded ${isDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-apple-text-secondary hover:bg-gray-200'}`}>
                                {isDone ? '✓ Done' : 'Mark Done'}
                              </button>
                              <button onClick={() => rejectRec(key, r.audit_type, rec.recommendation)} className="px-2 py-0.5 text-apple-xs rounded bg-gray-100 text-apple-text-tertiary hover:bg-red-50 hover:text-apple-red">
                                Reject
                              </button>
                            </div>
                          </div>
                          {isExpanded && rec.howToFix && (
                            <div className="px-3 pb-3 border-t border-apple-divider/50 pt-2">
                              <div className="text-apple-xs font-semibold text-apple-text mb-1">How to Fix</div>
                              <div className="text-apple-xs text-apple-text-secondary whitespace-pre-line">{rec.howToFix}</div>
                              {rec.impact && (
                                <div className="mt-2 text-apple-xs text-apple-text-tertiary">
                                  <strong>Impact:</strong> {rec.impact}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* All Recommendations Tab */}
          {resultsTab === 'recommendations' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <select value={filterType} onChange={e => { setFilterType(e.target.value as AdAuditType | 'all'); setRecPage(0); }} className="input text-apple-xs">
                  <option value="all">All Types</option>
                  {ALL_AD_AUDIT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <select value={filterPriority} onChange={e => { setFilterPriority(e.target.value as 'all' | 'high' | 'medium' | 'low'); setRecPage(0); }} className="input text-apple-xs">
                  <option value="all">All Priorities</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <span className="text-apple-xs text-apple-text-tertiary self-center ml-2">
                  {filteredRecs.length} recommendation{filteredRecs.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-2">
                {pagedRecs.map((rec) => {
                  const key = recKey(rec.auditType, rec.idx);
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
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${AD_TYPE_COLORS[rec.auditType]}`}>
                              {AD_AUDIT_TYPE_LABELS[rec.auditType]}
                            </span>
                            <span className="text-apple-xs font-medium text-apple-text">{rec.issue}</span>
                          </div>
                          <div className="text-apple-xs text-apple-text-secondary mt-0.5">{rec.recommendation}</div>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          {isChecked && (
                            <button onClick={() => addToTasklist(key, rec.auditType, rec.recommendation)} className="px-2 py-0.5 text-apple-xs bg-apple-blue text-white rounded hover:bg-apple-blue-hover">
                              Add to Tasklist
                            </button>
                          )}
                          <button onClick={() => toggleRec(key, rec.auditType)} className={`px-2 py-0.5 text-apple-xs rounded ${isDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-apple-text-secondary hover:bg-gray-200'}`}>
                            {isDone ? '✓ Done' : 'Mark Done'}
                          </button>
                          <button onClick={() => rejectRec(key, rec.auditType, rec.recommendation)} className="px-2 py-0.5 text-apple-xs rounded bg-gray-100 text-apple-text-tertiary hover:bg-red-50 hover:text-apple-red">
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
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button onClick={() => setRecPage(p => Math.max(0, p - 1))} disabled={recPage === 0} className="px-3 py-1 text-apple-xs rounded border border-apple-border disabled:opacity-40">Prev</button>
                  <span className="text-apple-xs text-apple-text-tertiary">Page {recPage + 1} of {totalRecPages}</span>
                  <button onClick={() => setRecPage(p => Math.min(totalRecPages - 1, p + 1))} disabled={recPage >= totalRecPages - 1} className="px-3 py-1 text-apple-xs rounded border border-apple-border disabled:opacity-40">Next</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!isRunning && results.length === 0 && (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">📊</div>
          <h3 className="text-apple-sm font-semibold text-apple-text mb-1">No audit results yet</h3>
          <p className="text-apple-xs text-apple-text-secondary max-w-md mx-auto">
            Select the audit types above, upload your advertising platform CSV exports, and click "Run Audit" to get AI-powered recommendations for your ad accounts.
          </p>
        </div>
      )}
    </div>
  );
}
