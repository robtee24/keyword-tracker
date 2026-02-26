import { getSupabase } from '../db.js';

/**
 * GET  /api/db/recommendations?siteUrl=X&keyword=Y  → saved scan result
 * POST /api/db/recommendations { siteUrl, keyword, scanResult }  → upsert
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  if (req.method === 'GET') {
    const { siteUrl, projectId, keyword } = req.query;
    if (!siteUrl || !keyword) {
      return res.status(400).json({ error: 'siteUrl and keyword are required' });
    }

    let query = supabase
      .from('recommendations')
      .select('*')
      .eq('site_url', siteUrl)
      .eq('keyword', keyword);
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') {
      console.error('DB error fetching recommendation:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(200).json({ recommendation: null });
    }

    return res.status(200).json({
      recommendation: {
        scanResult: data.scan_result,
        scannedAt: data.scanned_at,
      },
    });
  }

  if (req.method === 'POST') {
    const { siteUrl, projectId, keyword, scanResult } = req.body || {};
    if (!siteUrl || !keyword || !scanResult) {
      return res.status(400).json({ error: 'siteUrl, keyword, and scanResult are required' });
    }

    const { data, error } = await supabase
      .from('recommendations')
      .upsert(
        {
          site_url: siteUrl,
          project_id: projectId || null,
          keyword,
          scan_result: scanResult,
          scanned_at: new Date().toISOString(),
        },
        { onConflict: 'site_url,keyword' }
      )
      .select()
      .single();

    if (error) {
      console.error('DB error saving recommendation:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ saved: true, scannedAt: data.scanned_at });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
