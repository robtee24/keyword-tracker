import { getSupabase } from '../db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database not configured' });

  if (req.method === 'GET') {
    const { siteUrl } = req.query;
    if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });

    const { data, error } = await supabase
      .from('ad_keywords')
      .select('data, generated_at')
      .eq('site_url', siteUrl)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data?.data || null);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
