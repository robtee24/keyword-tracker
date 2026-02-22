import { getSupabase } from '../db.js';

/**
 * GET  /api/db/page-audits?siteUrl=X&auditType=Y  → results for a specific audit type
 * GET  /api/db/page-audits?siteUrl=X               → ALL audit results for a site
 * POST /api/db/page-audits  { siteUrl, auditType, action: 'clear' }
 * DELETE /api/db/page-audits  { id } or { siteUrl, pageUrl, auditType, auditedAt }
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  if (req.method === 'GET') {
    const { siteUrl, auditType } = req.query;
    if (!siteUrl) {
      return res.status(400).json({ error: 'siteUrl is required' });
    }

    let query = supabase
      .from('page_audits')
      .select('id, page_url, audit_type, score, summary, strengths, standards, recommendations, audited_at')
      .eq('site_url', siteUrl)
      .order('audited_at', { ascending: false });

    if (auditType) {
      query = query.eq('audit_type', auditType);
    }

    const { data, error } = await query;

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

  if (req.method === 'DELETE') {
    const { id, siteUrl, pageUrl, auditType, auditedAt } = req.body || {};

    if (id) {
      const { error } = await supabase
        .from('page_audits')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[DB/PageAudits] DELETE by id error:', error.message);
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ deleted: true });
    }

    if (siteUrl && pageUrl && auditType) {
      let query = supabase
        .from('page_audits')
        .delete()
        .eq('site_url', siteUrl)
        .eq('page_url', pageUrl)
        .eq('audit_type', auditType);

      if (auditedAt) {
        query = query.eq('audited_at', auditedAt);
      }

      const { error } = await query;
      if (error) {
        console.error('[DB/PageAudits] DELETE error:', error.message);
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ deleted: true });
    }

    return res.status(400).json({ error: 'id or (siteUrl, pageUrl, auditType) required' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
