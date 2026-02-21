import { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/api';

interface StoredRecommendation {
  keyword: string;
  scannedAt: string;
  scanResult: {
    strategy?: { priority: string; summary: string };
    audit?: Array<{
      category: string;
      status: string;
      grade: string;
      currentValue?: string;
      recommendation?: string;
    }>;
    checklist?: Array<{
      task: string;
      priority: string;
      impact: string;
      category: string;
    }>;
  };
}

interface RankedItem {
  keyword: string;
  task: string;
  priority: string;
  impact: string;
  category: string;
  scannedAt: string;
}

interface RecommendationsViewProps {
  siteUrl: string;
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const IMPACT_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export default function RecommendationsView({ siteUrl }: RecommendationsViewProps) {
  const [items, setItems] = useState<RankedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!siteUrl) return;

    const fetchAll = async () => {
      setLoading(true);
      try {
        const [recsResp, tasksResp] = await Promise.all([
          fetch(`${API_ENDPOINTS.db.recommendations}?site_url=${encodeURIComponent(siteUrl)}`),
          fetch(`${API_ENDPOINTS.db.completedTasks}?site_url=${encodeURIComponent(siteUrl)}`),
        ]);

        // Completed tasks
        if (tasksResp.ok) {
          const tasksData = await tasksResp.json();
          const completed = new Set<string>();
          for (const t of tasksData.tasks || []) {
            completed.add(`${t.keyword}::${t.task_description}`);
          }
          setCompletedTasks(completed);
        }

        // Recommendations
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

          ranked.sort((a, b) => {
            const pA = PRIORITY_ORDER[a.priority] ?? 3;
            const pB = PRIORITY_ORDER[b.priority] ?? 3;
            if (pA !== pB) return pA - pB;
            const iA = IMPACT_ORDER[a.impact] ?? 3;
            const iB = IMPACT_ORDER[b.impact] ?? 3;
            return iA - iB;
          });

          setItems(ranked);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchAll();
  }, [siteUrl]);

  const categories = [...new Set(items.map((i) => i.category))].sort();

  const filtered = items.filter((item) => {
    if (filterPriority && item.priority !== filterPriority) return false;
    if (filterCategory && item.category !== filterCategory) return false;
    return true;
  });

  const pending = filtered.filter((i) => !completedTasks.has(`${i.keyword}::${i.task}`));
  const completed = filtered.filter((i) => completedTasks.has(`${i.keyword}::${i.task}`));

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-apple-title1 font-bold text-apple-text tracking-tight">
            Recommendations
          </h2>
          <p className="text-apple-base text-apple-text-secondary mt-1">
            All SEO recommendations ranked by priority and impact
          </p>
        </div>
      </div>

      {loading ? (
        <div className="card p-16 text-center">
          <div className="w-6 h-6 border-2 border-apple-blue border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-apple-sm text-apple-text-tertiary">Loading recommendations...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-apple-fill-secondary mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-apple-title3 font-semibold text-apple-text mb-2">No recommendations yet</h3>
          <p className="text-apple-base text-apple-text-secondary max-w-md mx-auto">
            Scan keywords from the Keywords section to generate SEO recommendations.
          </p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-6">
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-2 text-apple-sm rounded-apple-sm border border-apple-border bg-white text-apple-text-secondary cursor-pointer"
            >
              <option value="">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 text-apple-sm rounded-apple-sm border border-apple-border bg-white text-apple-text-secondary cursor-pointer"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <div className="ml-auto text-apple-sm text-apple-text-tertiary">
              {pending.length} pending · {completed.length} completed
            </div>
          </div>

          {/* Pending Recommendations */}
          {pending.length > 0 && (
            <div className="card overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-apple-divider bg-apple-fill-secondary">
                <h3 className="text-apple-sm font-semibold text-apple-text">
                  Pending ({pending.length})
                </h3>
              </div>
              <div className="divide-y divide-apple-divider">
                {pending.map((item, i) => (
                  <RecommendationRow key={i} item={item} isCompleted={false} />
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <div className="card overflow-hidden opacity-75">
              <div className="px-5 py-4 border-b border-apple-divider bg-apple-fill-secondary">
                <h3 className="text-apple-sm font-semibold text-apple-text-secondary">
                  Completed ({completed.length})
                </h3>
              </div>
              <div className="divide-y divide-apple-divider">
                {completed.map((item, i) => (
                  <RecommendationRow key={i} item={item} isCompleted />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RecommendationRow({ item, isCompleted }: { item: RankedItem; isCompleted: boolean }) {
  const priorityStyles: Record<string, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-green-100 text-green-700',
  };

  return (
    <div className={`px-5 py-4 flex items-start gap-4 ${isCompleted ? 'opacity-60' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className={`text-apple-sm font-medium text-apple-text ${isCompleted ? 'line-through' : ''}`}>
          {item.task}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`inline-flex px-2 py-0.5 rounded-apple-pill text-[10px] font-bold uppercase ${priorityStyles[item.priority] || 'bg-gray-100 text-gray-600'}`}>
            {item.priority}
          </span>
          <span className="text-apple-xs text-apple-text-tertiary">
            {item.category}
          </span>
          <span className="text-apple-xs text-apple-text-tertiary">·</span>
          <span className="text-apple-xs text-apple-text-tertiary">
            {item.keyword}
          </span>
        </div>
      </div>
      <div className="text-apple-xs text-apple-text-tertiary shrink-0">
        Impact: <span className="font-medium capitalize">{item.impact}</span>
      </div>
    </div>
  );
}
