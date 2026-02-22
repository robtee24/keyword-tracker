import { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/api';

interface ActivityItem {
  type: 'scan' | 'task_completed';
  keyword: string;
  description: string;
  timestamp: string;
}

export type ActivityScope = 'organic' | 'seo' | 'ad' | 'blog' | 'build' | 'all';

interface ActivityLogViewProps {
  siteUrl: string;
  scope: ActivityScope;
}

function matchesScope(keyword: string, scope: ActivityScope) {
  if (scope === 'all') return true;
  if (scope === 'organic') return !keyword.startsWith('audit:') && !keyword.startsWith('ad-') && !keyword.startsWith('blog:') && !keyword.startsWith('build:');
  if (scope === 'seo') return keyword.startsWith('audit:');
  if (scope === 'ad') return keyword.startsWith('ad-');
  if (scope === 'blog') return keyword.startsWith('blog:');
  if (scope === 'build') return keyword.startsWith('build:');
  return true;
}

function getScopeLabel(keyword: string): string {
  if (keyword.startsWith('audit:')) return 'SEO';
  if (keyword.startsWith('ad-')) return 'Advertising';
  if (keyword.startsWith('blog:')) return 'Blog';
  if (keyword.startsWith('build:')) return 'Build';
  return 'Organic';
}

const SCOPE_DESCRIPTIONS: Record<ActivityScope, string> = {
  organic: 'Timeline of keyword scan actions',
  seo: 'Timeline of SEO audit actions',
  ad: 'Timeline of advertising audit actions',
  blog: 'Timeline of blog audit and generation actions',
  build: 'Timeline of page build actions',
  all: 'All activities across every section',
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function ActivityLogView({ siteUrl, scope }: ActivityLogViewProps) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('');
  const [filterScope, setFilterScope] = useState<string>('all');

  useEffect(() => {
    if (!siteUrl) return;

    const fetchAll = async () => {
      setLoading(true);
      try {
        const [tasksResp, recsResp] = await Promise.all([
          fetch(`${API_ENDPOINTS.db.completedTasks}?site_url=${encodeURIComponent(siteUrl)}`),
          fetch(`${API_ENDPOINTS.db.recommendations}?site_url=${encodeURIComponent(siteUrl)}`),
        ]);

        const activities: ActivityItem[] = [];

        if (tasksResp.ok) {
          const data = await tasksResp.json();
          for (const task of data.tasks || []) {
            const isActivity = task.category === 'activity';
            activities.push({
              type: isActivity ? 'scan' : 'task_completed',
              keyword: task.keyword,
              description: task.task_text || task.task_description || '',
              timestamp: task.completed_at,
            });
          }
        }

        if (recsResp.ok) {
          const data = await recsResp.json();
          for (const rec of data.recommendations || []) {
            activities.push({
              type: 'scan',
              keyword: rec.keyword,
              description: 'Recommendation scan completed',
              timestamp: rec.scanned_at || rec.created_at,
            });
          }
        }

        const scoped = activities.filter((a) => matchesScope(a.keyword, scope));
        scoped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setItems(scoped);
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchAll();
  }, [siteUrl, scope]);

  const filtered = items.filter((i) => {
    if (filterType && i.type !== filterType) return false;
    if (scope === 'all' && filterScope !== 'all' && !matchesScope(i.keyword, filterScope as ActivityScope)) return false;
    return true;
  });

  // Group by date
  const grouped = new Map<string, ActivityItem[]>();
  for (const item of filtered) {
    const dateKey = new Date(item.timestamp).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!grouped.has(dateKey)) grouped.set(dateKey, []);
    grouped.get(dateKey)!.push(item);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-apple-title1 font-bold text-apple-text tracking-tight">
            Activity Log
          </h2>
          <p className="text-apple-base text-apple-text-secondary mt-1">
            {SCOPE_DESCRIPTIONS[scope]}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="card p-16 text-center">
          <div className="w-6 h-6 border-2 border-apple-blue border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-apple-sm text-apple-text-tertiary">Loading activity log...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-apple-fill-secondary mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-apple-title3 font-semibold text-apple-text mb-2">No activity yet</h3>
          <p className="text-apple-base text-apple-text-secondary max-w-md mx-auto">
            Activity will appear here as you scan keywords and complete recommendations.
          </p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-6">
            {scope === 'all' && (
              <select
                value={filterScope}
                onChange={(e) => setFilterScope(e.target.value)}
                className="px-3 py-2 text-apple-sm rounded-apple-sm border border-apple-border bg-white text-apple-text-secondary cursor-pointer"
              >
                <option value="all">All Sections</option>
                <option value="organic">Organic</option>
                <option value="seo">SEO</option>
                <option value="ad">Advertising</option>
                <option value="blog">Blog</option>
                <option value="build">Build</option>
              </select>
            )}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 text-apple-sm rounded-apple-sm border border-apple-border bg-white text-apple-text-secondary cursor-pointer"
            >
              <option value="">All Activity</option>
              <option value="scan">Actions & Scans</option>
              <option value="task_completed">Task Updates</option>
            </select>
            <span className="text-apple-sm text-apple-text-tertiary ml-auto">
              {filtered.length} {filtered.length === 1 ? 'event' : 'events'}
            </span>
          </div>

          {/* Timeline */}
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([dateLabel, dayItems]) => (
              <div key={dateLabel}>
                <div className="text-apple-xs font-semibold text-apple-text-tertiary uppercase tracking-wider mb-3 px-1">
                  {dateLabel}
                </div>
                <div className="card overflow-hidden divide-y divide-apple-divider">
                  {dayItems.map((item, i) => (
                    <div key={i} className="px-5 py-4 flex items-start gap-4">
                      {/* Icon */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        item.type === 'scan'
                          ? 'bg-blue-100 text-apple-blue'
                          : 'bg-green-100 text-apple-green'
                      }`}>
                        {item.type === 'scan' ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="text-apple-sm font-medium text-apple-text">
                          {item.description}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {scope === 'all' && (
                            <span className="inline-flex px-2 py-0.5 rounded-apple-pill text-[10px] font-bold uppercase bg-blue-50 text-blue-600">
                              {getScopeLabel(item.keyword)}
                            </span>
                          )}
                          <span className="inline-flex px-2 py-0.5 rounded-apple-pill text-[10px] font-medium bg-apple-fill-secondary text-apple-text-secondary">
                            {item.keyword}
                          </span>
                          <span className="text-apple-xs text-apple-text-tertiary">
                            {timeAgo(item.timestamp)} · {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
