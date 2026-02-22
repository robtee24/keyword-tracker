import { getSupabase } from '../db.js';

/**
 * GET  /api/db/page-audits?siteUrl=X&auditType=Y
 *   Returns all saved audit results for a site + audit type.
 *
 * POST /api/db/page-audits  { siteUrl, auditType, action: 'clear' }
 *   Clears all audit results for a site + audit type (for re-auditing).
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  if (req.method === 'GET') {
    const { siteUrl, auditType } = req.query;
    if (!siteUrl || !auditType) {
      return res.status(400).json({ error: 'siteUrl and auditType are required' });
    }

    const { data, error } = await supabase
      .from('page_audits')
      .select('page_url, audit_type, score, summary, strengths, standards, recommendations, audited_at')
      .eq('site_url', siteUrl)
      .eq('audit_type', auditType)
      .order('score', { ascending: true });

    if (error) {
      console.error('[DB/PageAudits] GET error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ results: data || [], count: (data || []).length });
  }

  if (req.method === 'POST') {
    const { siteUrl, auditType, action } = req.body || {};
    if (!siteUrl || !auditType) {
      return res.status(400).json({ error: 'siteUrl and auditType are required' });
    }

    if (action === 'clear') {
      const { error } = await supabase
        .from('page_audits')
        .delete()
        .eq('site_url', siteUrl)
        .eq('audit_type', auditType);

      if (error) {
        console.error('[DB/PageAudits] Clear error:', error.message);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ cleared: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
