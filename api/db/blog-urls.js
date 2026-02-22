import { getSupabase } from '../db.js';

/**
 * GET /api/db/blog-urls?siteUrl=...
 * POST /api/db/blog-urls { siteUrl, blogUrl }
 * DELETE /api/db/blog-urls { siteUrl, blogUrl }
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();
  if (!supabase) return res.status(200).json({ urls: [] });

  if (req.method === 'GET') {
    const { siteUrl } = req.query;
    if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });

    const { data, error } = await supabase
      .from('blog_urls')
      .select('*')
      .eq('site_url', siteUrl)
      .order('added_at', { ascending: true });

    if (error) {
      console.error('[BlogUrls] Fetch error:', error.message);
      return res.status(200).json({ urls: [] });
    }
    return res.status(200).json({ urls: data || [] });
  }

  if (req.method === 'POST') {
    const { siteUrl, blogUrl } = req.body || {};
    if (!siteUrl || !blogUrl) return res.status(400).json({ error: 'siteUrl and blogUrl required' });

    const { error } = await supabase.from('blog_urls').upsert({
      site_url: siteUrl,
      blog_url: blogUrl,
      added_at: new Date().toISOString(),
    }, { onConflict: 'site_url,blog_url' });

    if (error) {
      console.error('[BlogUrls] Insert error:', error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { siteUrl, blogUrl } = req.body || {};
    if (!siteUrl || !blogUrl) return res.status(400).json({ error: 'siteUrl and blogUrl required' });

    const { error } = await supabase.from('blog_urls')
      .delete()
      .eq('site_url', siteUrl)
      .eq('blog_url', blogUrl);

    if (error) {
      console.error('[BlogUrls] Delete error:', error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
