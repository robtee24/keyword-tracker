import { getSupabase } from '../db.js';

/**
 * GET /api/db/blog-opportunities?siteUrl=...
 * PUT /api/db/blog-opportunities { id, status, generated_blog }
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();
  if (!supabase) return res.status(200).json({ opportunities: [] });

  if (req.method === 'GET') {
    const { siteUrl, projectId } = req.query;
    if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });

    let query = supabase
      .from('blog_opportunities')
      .select('*')
      .eq('site_url', siteUrl)
      .order('created_at', { ascending: false });
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;

    if (error) {
      console.error('[BlogOpps] Fetch error:', error.message);
      return res.status(200).json({ opportunities: [] });
    }
    return res.status(200).json({ opportunities: data || [] });
  }

  if (req.method === 'PUT') {
    const { id, projectId, status, generated_blog } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });

    const updates = {};
    if (status) updates.status = status;
    if (generated_blog) updates.generated_blog = generated_blog;
    if (status === 'completed') updates.completed_at = new Date().toISOString();

    let updateQuery = supabase
      .from('blog_opportunities')
      .update(updates)
      .eq('id', id);
    if (projectId) updateQuery = updateQuery.eq('project_id', projectId);
    const { error } = await updateQuery;

    if (error) {
      console.error('[BlogOpps] Update error:', error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
