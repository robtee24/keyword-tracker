import { API_ENDPOINTS } from '../config/api';

/**
 * Log an activity to the completed_tasks table for display in Activity Logs.
 * Uses a unique task_id with status='completed' so it shows as a completed action.
 */
export async function logActivity(
  siteUrl: string,
  scope: 'organic' | 'seo' | 'ad' | 'blog' | 'build',
  action: string,
  detail: string,
) {
  const prefixMap = { organic: '', seo: 'audit:', ad: 'ad-', blog: 'blog:', build: 'build:' };
  const keyword = `${prefixMap[scope]}${action}`;

  try {
    await fetch(API_ENDPOINTS.db.completedTasks, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteUrl,
        keyword,
        taskId: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        taskText: detail,
        category: 'activity',
        status: 'completed',
      }),
    });
  } catch {
    // Activity logging is best-effort
  }
}
