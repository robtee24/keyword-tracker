import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';

type TasklistTab = 'current' | 'completed' | 'rejected';

interface TaskItem {
  id: string;
  keyword: string;
  taskId: string;
  taskText: string;
  category: string;
  status: string;
  completedAt: string;
  source: 'keyword' | 'audit';
  priority?: string;
  impact?: string;
}

interface RecommendationsViewProps {
  siteUrl: string;
}

interface RankedItem {
  keyword: string;
  task: string;
  priority: string;
  impact: string;
  category: string;
  scannedAt: string;
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export default function RecommendationsView({ siteUrl }: RecommendationsViewProps) {
  const [activeTab, setActiveTab] = useState<TasklistTab>('current');
  const [loading, setLoading] = useState(true);

  // Keyword-based recommendations (from scans)
  const [keywordItems, setKeywordItems] = useState<RankedItem[]>([]);

  // All tasks from DB (completed + rejected, both keyword and audit)
  const [dbTasks, setDbTasks] = useState<TaskItem[]>([]);

  const [filterPriority, setFilterPriority] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const loadData = useCallback(async () => {
    if (!siteUrl) return;
    setLoading(true);
    try {
      const [recsResp, tasksResp] = await Promise.all([
        fetch(`${API_ENDPOINTS.db.recommendations}?site_url=${encodeURIComponent(siteUrl)}`),
        fetch(`${API_ENDPOINTS.db.completedTasks}?siteUrl=${encodeURIComponent(siteUrl)}`),
      ]);

      if (tasksResp.ok) {
        const tasksData = await tasksResp.json();
        setDbTasks((tasksData.tasks || []).map((t: any) => ({
          id: t.id,
          keyword: t.keyword || '',
          taskId: t.task_id || '',
          taskText: t.task_text || t.task_description || '',
          category: t.category || 'general',
          status: t.status || 'completed',
          completedAt: t.completed_at || '',
          source: (t.keyword || '').startsWith('audit:') ? 'audit' as const : 'keyword' as const,
          priority: undefined,
          impact: undefined,
        })));
      }

      if (recsResp.ok) {
        const recsData = await recsResp.json();
        const allRecs = recsData.recommendations || [];
        const ranked: RankedItem[] = [];
        for (const rec of allRecs) {
          const sr = rec.scan_result || rec.scanResult;
          if (!sr?.checklist) continue;
          for (const item of sr.checklist) {
            ranked.push({
              keyword: rec.keyword,
              task: item.task,
              priority: (item.priority || 'medium').toLowerCase(),
              impact: (item.impact || 'medium').toLowerCase(),
              category: item.category || 'general',
              scannedAt: rec.scanned_at || rec.scannedAt || '',
            });
          }
        }
        ranked.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3));
        setKeywordItems(ranked);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [siteUrl]);

  useEffect(() => { loadData(); }, [loadData]);

  // Build task key sets for quick lookup
  const completedKeys = new Set(dbTasks.filter((t) => t.status === 'completed').map((t) => `${t.keyword}::${t.taskId || t.taskText}`));
  const rejectedKeys = new Set(dbTasks.filter((t) => t.status === 'rejected').map((t) => `${t.keyword}::${t.taskId || t.taskText}`));

  // Current keyword tasks: not completed and not rejected
  const currentKeywordTasks = keywordItems.filter((item) => {
    const key = `${item.keyword}::${item.task}`;
    return !completedKeys.has(key) && !rejectedKeys.has(key);
  });

  // Audit tasks that are in "current" state (in DB but status is neither completed nor rejected — these are "added to tasklist")
  // For audit tasks, "current" means they exist in DB with no special status (they were added via "Add to Tasklist")
  // Actually, the flow is: audit recs are added to DB when user clicks "Add to Tasklist" with status='completed'.
  // Let me re-think: the DB stores completed and rejected. "Current" keyword tasks are those NOT in DB.
  // For audit tasks added to tasklist, they go in as 'completed'. So we show them under completed.

  const completedTasks = dbTasks.filter((t) => t.status === 'completed');
  const rejectedTasks = dbTasks.filter((t) => t.status === 'rejected');

  // All categories from all sources
  const allCategories = [...new Set([
    ...keywordItems.map((i) => i.category),
    ...dbTasks.map((t) => t.category),
  ])].filter(Boolean).sort();

  // Filter current tasks
  const filteredCurrent = currentKeywordTasks.filter((item) => {
    if (filterPriority && item.priority !== filterPriority) return false;
    if (filterCategory && item.category !== filterCategory) return false;
    return true;
  });

  const filteredCompleted = completedTasks.filter((t) => {
    if (filterCategory && t.category !== filterCategory) return false;
    return true;
  });

  const filteredRejected = rejectedTasks.filter((t) => {
    if (filterCategory && t.category !== filterCategory) return false;
    return true;
  });

  const markComplete = useCallback(async (keyword: string, taskId: string, taskText: string, category: string) => {
    setDbTasks((prev) => [...prev, { id: '', keyword, taskId, taskText, category, status: 'completed', completedAt: new Date().toISOString(), source: keyword.startsWith('audit:') ? 'audit' : 'keyword' }]);
    try {
      await fetch(API_ENDPOINTS.db.completedTasks, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteUrl, keyword, taskId, taskText, category, status: 'completed' }) });
    } catch { /* */ }
  }, [siteUrl]);

  const rejectTask = useCallback(async (keyword: string, taskId: string, taskText: string, category: string) => {
    setDbTasks((prev) => {
      const existing = prev.find((t) => t.keyword === keyword && (t.taskId === taskId || t.taskText === taskText));
      if (existing) return prev.map((t) => t === existing ? { ...t, status: 'rejected' } : t);
      return [...prev, { id: '', keyword, taskId, taskText, category, status: 'rejected', completedAt: new Date().toISOString(), source: keyword.startsWith('audit:') ? 'audit' : 'keyword' }];
    });
    try {
      await fetch(API_ENDPOINTS.db.completedTasks, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteUrl, keyword, taskId: taskId || taskText, taskText, category, status: 'rejected' }) });
    } catch { /* */ }
  }, [siteUrl]);

  const restoreTask = useCallback(async (task: TaskItem) => {
    setDbTasks((prev) => prev.filter((t) => !(t.keyword === task.keyword && t.taskId === task.taskId)));
    try {
      await fetch(API_ENDPOINTS.db.completedTasks, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteUrl, keyword: task.keyword, taskId: task.taskId || task.taskText }) });
    } catch { /* */ }
  }, [siteUrl]);

  const tabs: { id: TasklistTab; label: string; count: number }[] = [
    { id: 'current', label: 'Current', count: currentKeywordTasks.length },
    { id: 'completed', label: 'Completed', count: completedTasks.length },
    { id: 'rejected', label: 'Rejected', count: rejectedTasks.length },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-apple-text tracking-tight">Tasklist</h2>
        <p className="text-apple-sm text-apple-text-secondary mt-1">All recommendations from keyword scans and page audits</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-apple-divider mb-6">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-apple-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === tab.id ? 'border-apple-blue text-apple-blue' : 'border-transparent text-apple-text-secondary hover:text-apple-text'}`}>
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-16 text-center">
          <div className="w-6 h-6 border-2 border-apple-blue border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-apple-sm text-apple-text-tertiary">Loading tasklist...</p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4">
            {activeTab === 'current' && (
              <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
                className="px-3 py-2 text-apple-sm rounded-apple-sm border border-apple-border bg-white text-apple-text-secondary cursor-pointer">
                <option value="">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            )}
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 text-apple-sm rounded-apple-sm border border-apple-border bg-white text-apple-text-secondary cursor-pointer">
              <option value="">All Categories</option>
              {allCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          {/* ─── Current Tab ─── */}
          {activeTab === 'current' && (
            filteredCurrent.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="w-14 h-14 rounded-full bg-green-50 mx-auto mb-3 flex items-center justify-center">
                  <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="text-apple-sm font-semibold text-apple-text mb-1">All caught up</h3>
                <p className="text-apple-xs text-apple-text-tertiary">No pending tasks. Run keyword scans or page audits to generate recommendations.</p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="divide-y divide-apple-divider">
                  {filteredCurrent.map((item, i) => (
                    <div key={`${item.keyword}-${i}`} className="px-5 py-4 flex items-start gap-3 group">
                      <button onClick={() => markComplete(item.keyword, item.task, item.task, item.category)}
                        className="mt-0.5 w-5 h-5 rounded border-2 border-apple-border shrink-0 hover:border-green-500 hover:bg-green-50 transition-colors flex items-center justify-center">
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-apple-sm font-medium text-apple-text">{item.task}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`inline-flex px-2 py-0.5 rounded-apple-pill text-[10px] font-bold uppercase ${
                            item.priority === 'high' ? 'bg-red-100 text-red-700' :
                            item.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            {item.priority}
                          </span>
                          <span className="text-apple-xs text-apple-text-tertiary">{item.category}</span>
                          <span className="text-apple-xs text-apple-text-tertiary">·</span>
                          <span className="text-apple-xs text-apple-text-tertiary">{item.keyword}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => rejectTask(item.keyword, item.task, item.task, item.category)} title="Reject"
                          className="p-1.5 rounded hover:bg-red-50 text-apple-text-tertiary hover:text-red-500 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {/* ─── Completed Tab ─── */}
          {activeTab === 'completed' && (
            filteredCompleted.length === 0 ? (
              <div className="card p-12 text-center">
                <p className="text-apple-sm text-apple-text-tertiary">No completed tasks yet.</p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="divide-y divide-apple-divider">
                  {filteredCompleted.map((task, i) => (
                    <div key={`${task.keyword}-${task.taskId}-${i}`} className="px-5 py-4 flex items-start gap-3 group">
                      <div className="mt-0.5 w-5 h-5 rounded bg-green-500 shrink-0 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-apple-sm text-apple-text-secondary line-through">{task.taskText}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {task.category && <span className="text-apple-xs text-apple-text-tertiary">{task.category}</span>}
                          <span className="text-apple-xs text-apple-text-tertiary">·</span>
                          <span className="text-apple-xs text-apple-text-tertiary">{task.source === 'audit' ? task.keyword.replace('audit:', '') + ' audit' : task.keyword}</span>
                          {task.completedAt && (
                            <><span className="text-apple-xs text-apple-text-tertiary">·</span><span className="text-apple-xs text-apple-text-tertiary">{new Date(task.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></>
                          )}
                        </div>
                      </div>
                      <button onClick={() => restoreTask(task)} title="Undo" className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-apple-fill-secondary text-apple-text-tertiary hover:text-apple-text transition-all shrink-0">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {/* ─── Rejected Tab ─── */}
          {activeTab === 'rejected' && (
            filteredRejected.length === 0 ? (
              <div className="card p-12 text-center">
                <p className="text-apple-sm text-apple-text-tertiary">No rejected tasks.</p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="divide-y divide-apple-divider">
                  {filteredRejected.map((task, i) => (
                    <div key={`${task.keyword}-${task.taskId}-${i}`} className="px-5 py-4 flex items-start gap-3 group">
                      <div className="mt-0.5 w-5 h-5 rounded bg-red-100 shrink-0 flex items-center justify-center">
                        <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-apple-sm text-apple-text-tertiary">{task.taskText}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {task.category && <span className="text-apple-xs text-apple-text-tertiary">{task.category}</span>}
                          <span className="text-apple-xs text-apple-text-tertiary">·</span>
                          <span className="text-apple-xs text-apple-text-tertiary">{task.source === 'audit' ? task.keyword.replace('audit:', '') + ' audit' : task.keyword}</span>
                        </div>
                      </div>
                      <button onClick={() => restoreTask(task)} title="Restore" className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-apple-fill-secondary text-apple-text-tertiary hover:text-apple-text transition-all shrink-0">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
