import { getSupabase } from '../db.js';
import { authenticateRequest } from '../_config.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Database not available' });

  if (req.method === 'GET') {
    const { projectId, platform } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId required' });

    let query = supabase
      .from('ad_creatives')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (platform) query = query.eq('platform', platform);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data: data || [] });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const { data, error } = await supabase
      .from('ad_creatives')
      .insert({
        project_id: body.projectId,
        site_url: body.siteUrl,
        platform: body.platform,
        creative_type: body.creativeType || 'static',
        objective: body.objective || '',
        target_audience: body.targetAudience || '',
        value_proposition: body.valueProposition || '',
        landing_page_url: body.landingPageUrl || '',
        additional_context: body.additionalContext || '',
        result: body.result,
        generated_images: body.generatedImages || {},
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === 'PUT') {
    const { id, ...updates } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });

    const updateData = {};
    if (updates.generatedImages !== undefined) updateData.generated_images = updates.generatedImages;
    if (updates.result !== undefined) updateData.result = updates.result;

    const { data, error } = await supabase
      .from('ad_creatives')
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

    const { error } = await supabase.from('ad_creatives').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
