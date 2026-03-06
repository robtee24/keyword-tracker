import { getSupabase } from '../db.js';
import { authenticateRequest } from '../_config.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const supabase = getSupabase();
  if (!supabase) return res.status(200).json({ articles: [] });

  if (req.method === 'GET') {
    const { projectId, source } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    let query = supabase
      .from('blog_articles')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (source) query = query.eq('source', source);

    const { data, error } = await query;
    if (error) {
      console.error('[BlogArticles] Fetch error:', error.message);
      return res.status(200).json({ articles: [] });
    }
    return res.status(200).json({ articles: data || [] });
  }

  if (req.method === 'PUT') {
    const { id, content, previous_content, title, meta_description, images, status, word_count } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });

    const updates = { updated_at: new Date().toISOString() };
    if (content !== undefined) updates.content = content;
    if (previous_content !== undefined) updates.previous_content = previous_content;
    if (title !== undefined) updates.title = title;
    if (meta_description !== undefined) updates.meta_description = meta_description;
    if (images !== undefined) updates.images = images;
    if (status !== undefined) updates.status = status;
    if (word_count !== undefined) updates.word_count = word_count;

    const { data, error } = await supabase
      .from('blog_articles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[BlogArticles] Update error:', error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ article: data });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || req.query;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const { error } = await supabase
      .from('blog_articles')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[BlogArticles] Delete error:', error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
