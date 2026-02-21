import { getSupabase } from '../db.js';

/**
 * GET  /api/db/completed-tasks?siteUrl=X&keyword=Y&status=Z  → tasks filtered by keyword and/or status
 * GET  /api/db/completed-tasks?siteUrl=X                      → all tasks for a site
 * POST /api/db/completed-tasks { siteUrl, keyword, taskId, taskText, category, status }
 *      status defaults to 'completed'. Use 'rejected' for archived/rejected items.
 * PATCH /api/db/completed-tasks { siteUrl, keyword, taskId, status }  → update status only
 * DELETE /api/db/completed-tasks { siteUrl, keyword, taskId }  → remove a task entirely
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  if (req.method === 'GET') {
    const { siteUrl, keyword, status } = req.query;
    if (!siteUrl) {
      return res.status(400).json({ error: 'siteUrl is required' });
    }

    let query = supabase
      .from('completed_tasks')
      .select('*')
      .eq('site_url', siteUrl)
      .order('completed_at', { ascending: false });

    if (keyword) query = query.eq('keyword', keyword);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      console.error('DB error fetching completed tasks:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ tasks: data || [] });
  }

  if (req.method === 'POST') {
    const { siteUrl, keyword, taskId, taskText, category, status } = req.body || {};
    if (!siteUrl || !keyword || !taskId || !taskText) {
      return res.status(400).json({ error: 'siteUrl, keyword, taskId, and taskText are required' });
    }

    const row = {
      site_url: siteUrl,
      keyword,
      task_id: taskId,
      task_text: taskText,
      category: category || null,
      status: status || 'pending',
      completed_at: new Date().toISOString(),
    };

    // Try upsert first, fallback to delete+insert
    let { data, error } = await supabase
      .from('completed_tasks')
      .upsert(row, { onConflict: 'site_url,keyword,task_id' })
      .select()
      .single();

    if (error) {
      console.error('Upsert failed, trying delete+insert:', error.message);
      await supabase.from('completed_tasks')
        .delete()
        .eq('site_url', siteUrl)
        .eq('keyword', keyword)
        .eq('task_id', taskId);
      const result = await supabase.from('completed_tasks').insert(row).select().single();
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('DB error saving task:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ task: data });
  }

  if (req.method === 'PATCH') {
    const { siteUrl, keyword, taskId, status } = req.body || {};
    if (!siteUrl || !keyword || !taskId || !status) {
      return res.status(400).json({ error: 'siteUrl, keyword, taskId, and status are required' });
    }

    const { data, error } = await supabase
      .from('completed_tasks')
      .update({ status, completed_at: new Date().toISOString() })
      .eq('site_url', siteUrl)
      .eq('keyword', keyword)
      .eq('task_id', taskId)
      .select()
      .single();

    if (error) {
      console.error('DB error updating task status:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ task: data });
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
      console.error('DB error removing task:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
