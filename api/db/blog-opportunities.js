import { getSupabase } from '../db.js';

/**
 * GET /api/db/blog-opportunities?siteUrl=...&projectId=...
 * PUT /api/db/blog-opportunities { id, status, generated_blog }
 * DELETE /api/db/blog-opportunities { batchId, projectId } or { id, projectId }
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();
  if (!supabase) return res.status(200).json({ opportunities: [] });

  if (req.method === 'GET') {
    const { siteUrl, projectId } = req.query;
    if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });

    let query = supabase
      .from('blog_opportunities')
      .select('*')
      .eq('site_url', siteUrl)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false });
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;

    if (error) {
      console.error('[BlogOpps] Fetch error:', error.message);
      return res.status(200).json({ opportunities: [], dbError: error.message });
    }
    return res.status(200).json({ opportunities: data || [] });
  }

  if (req.method === 'POST') {
    const { opportunities, projectId, siteUrl } = req.body || {};
    if (!opportunities?.length || !projectId || !siteUrl) {
      return res.status(400).json({ error: 'opportunities, projectId, and siteUrl are required' });
    }

    // Quick table check
    const { error: tableErr } = await supabase.from('blog_opportunities').select('id').limit(1);
    if (tableErr) {
      console.error('[BlogOpps] Table check failed:', tableErr.message);
      return res.status(500).json({
        error: `Database table "blog_opportunities" is not accessible: ${tableErr.message}. Run migration 007_blog_opportunities.sql in your Supabase SQL Editor.`,
      });
    }

    const now = new Date().toISOString();
    let batchId;
    try { batchId = crypto.randomUUID(); } catch { batchId = `batch_${Date.now()}`; }
    const inserted = [];
    const errors = [];

    for (const opp of opportunities) {
      const fullRow = {
        site_url: siteUrl, project_id: projectId, batch_id: batchId,
        title: opp.title || '', target_keyword: opp.targetKeyword || opp.target_keyword || '',
        related_keywords: opp.relatedKeywords || opp.related_keywords || [],
        search_volume: opp.searchVolume || opp.search_volume || 'medium',
        estimated_searches: opp.estimatedMonthlySearches || opp.estimated_searches || 0,
        difficulty: opp.difficulty || 'medium',
        funnel_stage: opp.funnelStage || opp.funnel_stage || 'awareness',
        description: opp.description || '',
        content_type: opp.contentType || opp.content_type || 'guide',
        status: opp.status === 'completed' ? 'completed' : 'pending',
        created_at: opp.created_at || now,
      };

      const coreRow = {
        site_url: siteUrl, project_id: projectId,
        title: fullRow.title, target_keyword: fullRow.target_keyword,
        description: fullRow.description, status: fullRow.status,
        created_at: fullRow.created_at,
      };

      const minRow = {
        site_url: siteUrl, project_id: projectId,
        title: fullRow.title, status: fullRow.status,
        created_at: fullRow.created_at,
      };

      let saved = false;
      for (const [label, payload] of [['full', fullRow], ['core', coreRow], ['minimal', minRow]]) {
        const { data: d, error: e } = await supabase.from('blog_opportunities').insert(payload).select().single();
        if (!e && d) { inserted.push(d); saved = true; break; }
        console.warn(`[BlogOpps] POST insert (${label}) failed for "${fullRow.title}":`, e?.message);
      }
      if (!saved) errors.push(fullRow.title);
    }

    if (inserted.length === 0) {
      return res.status(500).json({ error: `Failed to save any of ${opportunities.length} ideas. The blog_opportunities table may be missing columns. Check Supabase logs.` });
    }

    return res.status(200).json({
      opportunities: inserted, batchId,
      saved: inserted.length, total: opportunities.length,
      ...(errors.length > 0 ? { warning: `${errors.length} ideas could not be saved` } : {}),
    });
  }

  if (req.method === 'PUT') {
    const { id, projectId, status, generated_blog } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });

    const updates = {};
    if (status) updates.status = status;
    if (generated_blog) updates.generated_blog = generated_blog;
    if (status === 'completed') updates.completed_at = new Date().toISOString();

    let updateQuery = supabase
      .from('blog_opportunities')
      .update(updates)
      .eq('id', id);
    if (projectId) updateQuery = updateQuery.eq('project_id', projectId);
    const { error } = await updateQuery;

    if (error) {
      console.error('[BlogOpps] Update error:', error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ success: true });
  }

  if (req.method === 'PATCH') {
    const { id, projectId: pid, status } = req.body || {};
    if (!id || !status) return res.status(400).json({ error: 'id and status are required' });

    let q = supabase.from('blog_opportunities').update({ status }).eq('id', id);
    if (pid) q = q.eq('project_id', pid);
    const { error } = await q;
    if (error) {
      console.error('[BlogOpps] Patch error:', error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { batchId, id, projectId } = req.body || {};

    if (batchId) {
      let delQuery = supabase
        .from('blog_opportunities')
        .delete()
        .eq('batch_id', batchId);
      if (projectId) delQuery = delQuery.eq('project_id', projectId);
      const { error } = await delQuery;
      if (error) {
        console.error('[BlogOpps] Batch delete error:', error.message);
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ success: true });
    }

    if (id) {
      let delQuery = supabase
        .from('blog_opportunities')
        .delete()
        .eq('id', id);
      if (projectId) delQuery = delQuery.eq('project_id', projectId);
      const { error } = await delQuery;
      if (error) {
        console.error('[BlogOpps] Delete error:', error.message);
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'batchId or id is required' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
