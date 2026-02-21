import { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../../config/api';

interface ActivityItem {
  type: 'scan' | 'task_completed';
  timestamp: string;
  description: string;
  category?: string;
}

interface ActivityLogProps {
  keyword: string;
  siteUrl: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  'title-tag': 'Title Tags',
  'meta-description': 'Meta Descriptions',
  'heading-structure': 'Heading Structure',
  content: 'Content',
  'internal-linking': 'Internal Links',
  'schema-markup': 'Schema Markup',
  'technical-seo': 'Technical SEO',
  backlinks: 'Backlinks',
  images: 'Images',
  'featured-snippet': 'Featured Snippet',
  'topical-authority': 'Topical Authority',
  eeat: 'E-E-A-T',
};

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let relative: string;
  if (diffMins < 1) relative = 'Just now';
  else if (diffMins < 60) relative = `${diffMins}m ago`;
  else if (diffHours < 24) relative = `${diffHours}h ago`;
  else if (diffDays < 7) relative = `${diffDays}d ago`;
  else if (diffDays < 30) relative = `${Math.floor(diffDays / 7)}w ago`;
  else relative = `${Math.floor(diffDays / 30)}mo ago`;

  const absolute = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${relative} · ${absolute}`;
}

export default function ActivityLog({ keyword, siteUrl }: ActivityLogProps) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const fetchAll = async () => {
      const activities: ActivityItem[] = [];

      const [tasksResp, recsResp] = await Promise.allSettled([
        fetch(
          `${API_ENDPOINTS.db.completedTasks}?siteUrl=${encodeURIComponent(siteUrl)}&keyword=${encodeURIComponent(keyword)}`
        ),
        fetch(
          `${API_ENDPOINTS.db.recommendations}?siteUrl=${encodeURIComponent(siteUrl)}&keyword=${encodeURIComponent(keyword)}`
        ),
      ]);

      if (cancelled) return;

      if (tasksResp.status === 'fulfilled' && tasksResp.value.ok) {
        try {
          const { tasks } = await tasksResp.value.json();
          if (tasks?.length) {
            for (const t of tasks) {
              activities.push({
                type: 'task_completed',
                timestamp: t.completed_at,
                description: t.task_text,
                category: t.category,
              });
            }
          }
        } catch { /* ignore */ }
      }

      if (recsResp.status === 'fulfilled' && recsResp.value.ok) {
        try {
          const data = await recsResp.value.json();
          if (data.recommendation?.scannedAt) {
            activities.push({
              type: 'scan',
              timestamp: data.recommendation.scannedAt,
              description: 'Scanned for SEO recommendations',
            });
          }
        } catch { /* ignore */ }
      }

      if (!cancelled) {
        activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setItems(activities);
        setLoading(false);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [siteUrl, keyword]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center">
        <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
        <span className="text-apple-sm text-apple-text-tertiary">Loading activity...</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <svg className="w-10 h-10 mx-auto text-apple-text-tertiary mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-apple-sm text-apple-text-tertiary">No activity recorded yet</p>
        <p className="text-apple-xs text-apple-text-tertiary mt-1">
          Scan for recommendations and complete tasks to start tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 mb-2">
      <div className="rounded-apple-sm border border-apple-divider bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-apple-divider bg-apple-fill-secondary">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-apple-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-apple-xs font-semibold text-apple-text-secondary uppercase tracking-wider">
              Activity Timeline
            </span>
            <span className="text-apple-xs text-apple-text-tertiary">
              ({items.length} {items.length === 1 ? 'event' : 'events'})
            </span>
          </div>
        </div>

        <div className="divide-y divide-apple-divider">
          {items.map((item, index) => (
            <div key={index} className="flex items-start gap-3 px-5 py-3">
              <div className="pt-0.5 flex-shrink-0">
                {item.type === 'scan' ? (
                  <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-apple-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-apple-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-apple-xs font-medium px-2 py-0.5 rounded-apple-pill ${
                    item.type === 'scan' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                  }`}>
                    {item.type === 'scan' ? 'Scan' : 'Task Completed'}
                  </span>
                  {item.category && (
                    <span className="text-apple-xs text-apple-text-tertiary">
                      {CATEGORY_LABELS[item.category] || item.category}
                    </span>
                  )}
                </div>
                <p className="text-apple-sm text-apple-text mt-1 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="flex-shrink-0 text-right">
                <div className="text-apple-xs text-apple-text-tertiary whitespace-nowrap">
                  {formatTimestamp(item.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
