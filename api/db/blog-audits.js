import { getSupabase } from '../db.js';

/**
 * GET /api/db/blog-audits?siteUrl=...
 * Returns all saved blog audit results.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabase();
  if (!supabase) return res.status(200).json({ audits: [] });

  const { siteUrl } = req.query;
  if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });

  const { data, error } = await supabase
    .from('blog_audits')
    .select('blog_url, audit_mode, score, summary, strengths, recommendations, audited_at')
    .eq('site_url', siteUrl)
    .order('audited_at', { ascending: false });

  if (error) {
    console.error('[BlogAudits] Fetch error:', error.message);
    return res.status(200).json({ audits: [] });
  }

  return res.status(200).json({ audits: data || [] });
}
