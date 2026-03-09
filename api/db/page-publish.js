import { getSupabase } from '../db.js';
import { authenticateRequest } from '../_config.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Database not available' });

  if (req.method === 'GET') {
    const { projectId, status } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId required' });

    let query = supabase
      .from('page_publish')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data: data || [] });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const { data, error } = await supabase
      .from('page_publish')
      .insert({
        project_id: body.projectId,
        site_url: body.siteUrl,
        source_type: body.sourceType || 'new',
        source_id: body.sourceId || null,
        title: body.title,
        slug: body.slug || '',
        meta_description: body.metaDescription || '',
        og_image: body.ogImage || '',
        html_content: body.htmlContent || '',
        schema_markup: body.schemaMarkup || '',
        page_url: body.pageUrl || '',
        status: body.status || 'queued',
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === 'PUT') {
    const { id, ...updates } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });

    const updateData = { updated_at: new Date().toISOString() };
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.slug !== undefined) updateData.slug = updates.slug;
    if (updates.metaDescription !== undefined) updateData.meta_description = updates.metaDescription;
    if (updates.ogImage !== undefined) updateData.og_image = updates.ogImage;
    if (updates.htmlContent !== undefined) updateData.html_content = updates.htmlContent;
    if (updates.schemaMarkup !== undefined) updateData.schema_markup = updates.schemaMarkup;
    if (updates.publishedAt !== undefined) updateData.published_at = updates.publishedAt;
    if (updates.rejectedAt !== undefined) updateData.rejected_at = updates.rejectedAt;
    if (updates.rejectionReason !== undefined) updateData.rejection_reason = updates.rejectionReason;
    if (updates.publishMethod !== undefined) updateData.publish_method = updates.publishMethod;
    if (updates.publishResult !== undefined) updateData.publish_result = updates.publishResult;

    const { data, error } = await supabase
      .from('page_publish')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });

    const { error } = await supabase.from('page_publish').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
