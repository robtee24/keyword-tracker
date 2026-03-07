import { getSupabase } from '../db.js';
import { authenticateRequest } from '../_config.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const supabase = getSupabase();
  if (!supabase) return res.status(200).json({ profile: null });

  if (req.method === 'GET') {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const { data, error } = await supabase
      .from('brand_profiles')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) {
      console.error('[Brand] Fetch error:', error.message);
      return res.status(200).json({ profile: null });
    }
    return res.status(200).json({ profile: data });
  }

  if (req.method === 'PUT') {
    const { projectId, site_url, brand_style, logos, fonts, font_styling, colors, tagline, mission_statement, button_styles, spacing, voice_and_tone, additional_notes, raw_crawl_data } = req.body || {};
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const updates = { updated_at: new Date().toISOString() };
    if (site_url !== undefined) updates.site_url = site_url;
    if (brand_style !== undefined) updates.brand_style = brand_style;
    if (logos !== undefined) updates.logos = logos;
    if (fonts !== undefined) updates.fonts = fonts;
    if (font_styling !== undefined) updates.font_styling = font_styling;
    if (colors !== undefined) updates.colors = colors;
    if (tagline !== undefined) updates.tagline = tagline;
    if (mission_statement !== undefined) updates.mission_statement = mission_statement;
    if (button_styles !== undefined) updates.button_styles = button_styles;
    if (spacing !== undefined) updates.spacing = spacing;
    if (voice_and_tone !== undefined) updates.voice_and_tone = voice_and_tone;
    if (additional_notes !== undefined) updates.additional_notes = additional_notes;
    if (raw_crawl_data !== undefined) updates.raw_crawl_data = raw_crawl_data;

    const { data: existing } = await supabase
      .from('brand_profiles')
      .select('id')
      .eq('project_id', projectId)
      .maybeSingle();

    let data, error;
    if (existing) {
      ({ data, error } = await supabase
        .from('brand_profiles')
        .update(updates)
        .eq('project_id', projectId)
        .select()
        .single());
    } else {
      ({ data, error } = await supabase
        .from('brand_profiles')
        .insert({ project_id: projectId, site_url: site_url || '', ...updates })
        .select()
        .single());
    }

    if (error) {
      console.error('[Brand] Upsert error:', error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ profile: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
