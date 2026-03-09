import { getSupabase } from '../db.js';
import { authenticateRequest } from '../_config.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Database not available' });

  const { table } = req.query;

  // GET — list records
  if (req.method === 'GET') {
    const { projectId, ideaId, videoProjectId } = req.query;
    if (!projectId && !ideaId && !videoProjectId) {
      return res.status(400).json({ error: 'projectId, ideaId, or videoProjectId required' });
    }

    try {
      if (table === 'ideas') {
        const { data, error } = await supabase
          .from('video_ad_ideas')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return res.status(200).json({ data: data || [] });
      }

      if (table === 'variations') {
        let query = supabase.from('video_ad_variations').select('*');
        if (ideaId) query = query.eq('idea_id', ideaId);
        else query = query.eq('project_id', projectId);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return res.status(200).json({ data: data || [] });
      }

      if (table === 'projects') {
        let query = supabase.from('video_projects').select('*');
        if (videoProjectId) query = query.eq('id', videoProjectId);
        else query = query.eq('project_id', projectId);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return res.status(200).json({ data: data || [] });
      }

      if (table === 'generated') {
        const { data, error } = await supabase
          .from('video_generated')
          .select('*')
          .eq('video_project_id', videoProjectId)
          .order('scene_index', { ascending: true });
        if (error) throw error;
        return res.status(200).json({ data: data || [] });
      }

      return res.status(400).json({ error: 'Invalid table parameter' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST — create record
  if (req.method === 'POST') {
    const body = req.body || {};

    try {
      if (table === 'ideas') {
        const { data, error } = await supabase
          .from('video_ad_ideas')
          .insert({
            project_id: body.projectId,
            site_url: body.siteUrl,
            input_type: body.inputType,
            input_text: body.inputText,
            ideas: body.ideas,
          })
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ data });
      }

      if (table === 'variations') {
        const { data, error } = await supabase
          .from('video_ad_variations')
          .insert({
            idea_id: body.ideaId,
            project_id: body.projectId,
            source_idea: body.sourceIdea,
            batch_number: body.batchNumber || 1,
            variations: body.variations,
          })
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ data });
      }

      if (table === 'projects') {
        const { data, error } = await supabase
          .from('video_projects')
          .insert({
            project_id: body.projectId,
            site_url: body.siteUrl,
            idea: body.idea,
            source_type: body.sourceType || 'ad-tized',
            platforms: body.platforms || [],
            aspect_ratio: body.aspectRatio || '16:9',
            voice_style: body.voiceStyle || 'professional',
            video_style: body.videoStyle || 'cinematic',
            overall_concept: body.overallConcept,
            scenes: body.scenes || [],
            status: body.status || 'draft',
          })
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ data });
      }

      return res.status(400).json({ error: 'Invalid table parameter' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // PUT — update record
  if (req.method === 'PUT') {
    const { id, ...updates } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });

    try {
      if (table === 'projects') {
        const updateData = {};
        if (updates.scenes !== undefined) updateData.scenes = updates.scenes;
        if (updates.status !== undefined) updateData.status = updates.status;
        if (updates.overallConcept !== undefined) updateData.overall_concept = updates.overallConcept;
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
          .from('video_projects')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ data });
      }

      return res.status(400).json({ error: 'Invalid table parameter' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });

    try {
      const tableMap = {
        ideas: 'video_ad_ideas',
        variations: 'video_ad_variations',
        projects: 'video_projects',
        generated: 'video_generated',
      };
      const tableName = tableMap[table];
      if (!tableName) return res.status(400).json({ error: 'Invalid table parameter' });

      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
