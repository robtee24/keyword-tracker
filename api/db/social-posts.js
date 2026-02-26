import { getSupabase } from '../db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();
  if (!supabase) return res.status(200).json({ posts: [] });

  if (req.method === 'GET') {
    const { siteUrl, projectId, platform } = req.query;
    if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });

    let query = supabase
      .from('social_posts')
      .select('*')
      .eq('site_url', siteUrl)
      .order('created_at', { ascending: false })
      .limit(50);
    if (projectId) query = query.eq('project_id', projectId);
    if (platform) query = query.eq('platform', platform);

    const { data, error } = await query;
    if (error) {
      console.error('[SocialPosts] Fetch error:', error.message);
      return res.status(200).json({ posts: [] });
    }
    return res.status(200).json({ posts: data || [] });
  }

  if (req.method === 'DELETE') {
    const { id, projectId } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    let query = supabase.from('social_posts').delete().eq('id', id);
    if (projectId) query = query.eq('project_id', projectId);
    await query;
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
