import { getSupabase } from '../db.js';

/**
 * GET /api/db/build-results?siteUrl=...
 * POST /api/db/build-results { siteUrl, pageUrl, buildType, result }
 *
 * buildType: 'rebuild' | 'new' | 'wizard'
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();
  if (!supabase) return res.status(200).json({ results: [] });

  if (req.method === 'GET') {
    const { siteUrl, buildType } = req.query;
    if (!siteUrl) return res.status(400).json({ error: 'siteUrl required' });

    let query = supabase
      .from('build_results')
      .select('*')
      .eq('site_url', siteUrl)
      .order('created_at', { ascending: false });

    if (buildType) query = query.eq('build_type', buildType);

    const { data, error } = await query;
    if (error) {
      console.error('[BuildResults] Fetch error:', error.message);
      return res.status(200).json({ results: [] });
    }
    return res.status(200).json({ results: data || [] });
  }

  if (req.method === 'POST') {
    const { siteUrl, pageUrl, buildType, result } = req.body || {};
    if (!siteUrl || !buildType) return res.status(400).json({ error: 'siteUrl and buildType required' });

    const row = {
      site_url: siteUrl,
      page_url: pageUrl || '',
      build_type: buildType,
      result: result || {},
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('build_results').insert(row);
    if (error) {
      console.error('[BuildResults] Insert error:', error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
