import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { logActivity } from '../utils/activityLog';

interface Schedule {
  id: string;
  site_url: string;
  frequency: string;
  posts_per_batch: number;
  active: boolean;
  created_at: string;
}

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'twice-weekly', label: 'Twice a Week' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 Weeks' },
  { value: 'monthly', label: 'Monthly' },
];

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  'twice-weekly': 'Twice a Week',
  weekly: 'Weekly',
  biweekly: 'Every 2 Weeks',
  monthly: 'Monthly',
};

interface BlogAutomateViewProps {
  siteUrl: string;
}

export default function BlogAutomateView({ siteUrl }: BlogAutomateViewProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [newFrequency, setNewFrequency] = useState('weekly');
  const [newPostsPerBatch, setNewPostsPerBatch] = useState(1);

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_ENDPOINTS.db.blogSchedules}?siteUrl=${encodeURIComponent(siteUrl)}`);
      const data = await resp.json();
      setSchedules(data.schedules || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [siteUrl]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const createSchedule = async () => {
    setCreating(true);
    try {
      await fetch(API_ENDPOINTS.db.blogSchedules, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          frequency: newFrequency,
          postsPerBatch: newPostsPerBatch,
          active: true,
        }),
      });
      await loadSchedules();
      logActivity(siteUrl, 'blog', 'schedule-created', `Created blog schedule: ${newPostsPerBatch} posts ${newFrequency}`);
    } catch (err) {
      console.error('Failed to create schedule:', err);
    }
    setCreating(false);
  };

  const toggleActive = async (schedule: Schedule) => {
    try {
      await fetch(API_ENDPOINTS.db.blogSchedules, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: schedule.id, active: !schedule.active }),
      });
      setSchedules((prev) =>
        prev.map((s) => (s.id === schedule.id ? { ...s, active: !s.active } : s))
      );
      logActivity(siteUrl, 'blog', 'schedule-toggled', `Blog schedule ${!schedule.active ? 'activated' : 'paused'}`);
    } catch (err) {
      console.error('Failed to toggle schedule:', err);
    }
  };

  const deleteSchedule = async (id: string) => {
    try {
      await fetch(API_ENDPOINTS.db.blogSchedules, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      logActivity(siteUrl, 'blog', 'schedule-deleted', `Deleted blog schedule`);
    } catch (err) {
      console.error('Failed to delete schedule:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-apple-text">Blog Automation</h1>
        <p className="text-apple-sm text-apple-text-secondary mt-1">
          Schedule automatic blog generation. Set the frequency and number of posts to generate on each run.
        </p>
      </div>

      {/* Create New Schedule */}
      <div className="bg-white rounded-apple border border-apple-border p-5">
        <h2 className="text-base font-semibold text-apple-text mb-4">Create Schedule</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1.5 uppercase tracking-wider">
              Frequency
            </label>
            <select
              value={newFrequency}
              onChange={(e) => setNewFrequency(e.target.value)}
              className="input text-apple-sm w-full"
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1.5 uppercase tracking-wider">
              Posts per Batch
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={newPostsPerBatch}
              onChange={(e) => setNewPostsPerBatch(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
              className="input text-apple-sm w-full"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={createSchedule}
              disabled={creating}
              className="w-full px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Schedule'}
            </button>
          </div>
        </div>
        <p className="text-apple-xs text-apple-text-tertiary mt-3">
          Blog posts will be auto-generated from your opportunity queue. Topics are selected based on priority and search volume.
        </p>
      </div>

      {/* Existing Schedules */}
      <div className="bg-white rounded-apple border border-apple-border p-5">
        <h2 className="text-base font-semibold text-apple-text mb-4">Active Schedules</h2>

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-apple-text-secondary text-apple-sm">
            <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
            Loading...
          </div>
        ) : schedules.length === 0 ? (
          <p className="text-apple-sm text-apple-text-tertiary py-4">
            No schedules created yet. Create one above to automate blog generation.
          </p>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className={`flex items-center gap-4 p-4 rounded-apple-sm border ${
                  schedule.active ? 'border-green-200 bg-green-50/30' : 'border-apple-border bg-apple-fill-secondary'
                }`}
              >
                <button
                  onClick={() => toggleActive(schedule)}
                  className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${
                    schedule.active ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      schedule.active ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>

                <div className="flex-1">
                  <div className="text-apple-sm font-medium text-apple-text">
                    {FREQUENCY_LABELS[schedule.frequency] || schedule.frequency}
                  </div>
                  <div className="text-apple-xs text-apple-text-secondary">
                    {schedule.posts_per_batch} post{schedule.posts_per_batch > 1 ? 's' : ''} per batch
                  </div>
                </div>

                <div className="text-apple-xs text-apple-text-tertiary shrink-0">
                  Created {new Date(schedule.created_at).toLocaleDateString()}
                </div>

                <span className={`text-apple-xs px-2 py-0.5 rounded-apple-pill shrink-0 ${
                  schedule.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {schedule.active ? 'Active' : 'Paused'}
                </span>

                <button
                  onClick={() => deleteSchedule(schedule.id)}
                  className="text-apple-text-tertiary hover:text-apple-red text-apple-xs shrink-0"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="bg-blue-50/50 rounded-apple border border-blue-100 p-5">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">How Blog Automation Works</h3>
        <ul className="text-apple-sm text-blue-700 space-y-1.5">
          <li className="flex gap-2">
            <span className="shrink-0">1.</span>
            Topics are pulled from your Opportunity queue, prioritized by search volume and business relevance.
          </li>
          <li className="flex gap-2">
            <span className="shrink-0">2.</span>
            AI generates a full, SEO-optimized blog post for each selected topic.
          </li>
          <li className="flex gap-2">
            <span className="shrink-0">3.</span>
            Generated posts are saved and marked as completed in the Opportunity section.
          </li>
          <li className="flex gap-2">
            <span className="shrink-0">4.</span>
            Review and publish generated content from the Opportunity tab.
          </li>
        </ul>
      </div>
    </div>
  );
}
