import { getSupabase } from '../db.js';

/**
 * GET  /api/db/blog-discoveries?siteUrl=...&projectId=...
 * POST /api/db/blog-discoveries { projectId, siteUrl, rootPath, blogName, posts, overview, gscData }
 * PUT  /api/db/blog-discoveries { projectId, siteUrl, rootPath, updates }
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();
  if (!supabase) return res.status(200).json({ discoveries: [] });

  if (req.method === 'GET') {
    const { siteUrl, projectId } = req.query;
    if (!siteUrl || !projectId) {
      return res.status(400).json({ error: 'siteUrl and projectId required' });
    }

    const { data, error } = await supabase
      .from('blog_discoveries')
      .select('*')
      .eq('project_id', projectId)
      .eq('site_url', siteUrl)
      .order('crawled_at', { ascending: false });

    if (error) {
      console.error('[BlogDiscoveries] Fetch error:', error.message);
      return res.status(200).json({ discoveries: [] });
    }
    return res.status(200).json({ discoveries: data || [] });
  }

  if (req.method === 'POST') {
    const { projectId, siteUrl, rootPath, blogName, posts, overview, gscData } = req.body || {};
    if (!projectId || !siteUrl || !rootPath) {
      return res.status(400).json({ error: 'projectId, siteUrl, rootPath required' });
    }

    const { data, error } = await supabase
      .from('blog_discoveries')
      .upsert({
        project_id: projectId,
        site_url: siteUrl,
        root_path: rootPath,
        blog_name: blogName || null,
        posts: posts || [],
        overview: overview || null,
        gsc_data: gscData || {},
        crawled_at: new Date().toISOString(),
      }, { onConflict: 'project_id,site_url,root_path' })
      .select()
      .single();

    if (error) {
      console.error('[BlogDiscoveries] Upsert error:', error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ discovery: data });
  }

  if (req.method === 'PUT') {
    const { projectId, siteUrl, rootPath, updates } = req.body || {};
    if (!projectId || !siteUrl || !rootPath) {
      return res.status(400).json({ error: 'projectId, siteUrl, rootPath required' });
    }

    const allowed = {};
    if (updates.posts !== undefined) allowed.posts = updates.posts;
    if (updates.overview !== undefined) allowed.overview = updates.overview;
    if (updates.gscData !== undefined) allowed.gsc_data = updates.gscData;
    if (updates.blogName !== undefined) allowed.blog_name = updates.blogName;

    const { data, error } = await supabase
      .from('blog_discoveries')
      .update(allowed)
      .eq('project_id', projectId)
      .eq('site_url', siteUrl)
      .eq('root_path', rootPath)
      .select()
      .single();

    if (error) {
      console.error('[BlogDiscoveries] Update error:', error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ discovery: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
