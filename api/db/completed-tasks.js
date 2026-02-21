import { getSupabase } from '../db.js';

/**
 * GET  /api/db/completed-tasks?siteUrl=X&keyword=Y  → completed tasks for a keyword
 * GET  /api/db/completed-tasks?siteUrl=X              → all completed tasks for a site
 * POST /api/db/completed-tasks { siteUrl, keyword, taskId, taskText, category }
 * DELETE /api/db/completed-tasks { siteUrl, keyword, taskId }  → uncomplete a task
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  if (req.method === 'GET') {
    const { siteUrl, keyword } = req.query;
    if (!siteUrl) {
      return res.status(400).json({ error: 'siteUrl is required' });
    }

    let query = supabase
      .from('completed_tasks')
      .select('*')
      .eq('site_url', siteUrl)
      .order('completed_at', { ascending: false });

    if (keyword) {
      query = query.eq('keyword', keyword);
    }

    const { data, error } = await query;
    if (error) {
      console.error('DB error fetching completed tasks:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ tasks: data || [] });
  }

  if (req.method === 'POST') {
    const { siteUrl, keyword, taskId, taskText, category } = req.body || {};
    if (!siteUrl || !keyword || !taskId || !taskText) {
      return res.status(400).json({ error: 'siteUrl, keyword, taskId, and taskText are required' });
    }

    const { data, error } = await supabase
      .from('completed_tasks')
      .insert({
        site_url: siteUrl,
        keyword,
        task_id: taskId,
        task_text: taskText,
        category: category || null,
      })
      .select()
      .single();

    if (error) {
      console.error('DB error logging completed task:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ task: data });
  }

  if (req.method === 'DELETE') {
    const { siteUrl, keyword, taskId } = req.body || {};
    if (!siteUrl || !keyword || !taskId) {
      return res.status(400).json({ error: 'siteUrl, keyword, and taskId are required' });
    }

    const { error } = await supabase
      .from('completed_tasks')
      .delete()
      .eq('site_url', siteUrl)
      .eq('keyword', keyword)
      .eq('task_id', taskId);

    if (error) {
      console.error('DB error removing completed task:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
