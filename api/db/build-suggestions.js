import { getSupabase } from '../db.js';

/**
 * GET /api/db/build-suggestions?siteUrl=...
 * POST /api/db/build-suggestions { siteUrl, suggestions }
 * PUT /api/db/build-suggestions { id, built, builtContent }
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();
  if (!supabase) return res.status(200).json({ suggestions: [] });

  if (req.method === 'GET') {
    const { siteUrl, projectId } = req.query;
    if (!siteUrl) return res.status(400).json({ error: 'siteUrl required' });

    let query = supabase
      .from('build_suggestions')
      .select('*')
      .eq('site_url', siteUrl)
      .order('created_at', { ascending: false })
      .limit(1);
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;

    if (error) {
      console.error('[BuildSuggestions] Fetch error:', error.message);
      return res.status(200).json({ suggestions: [] });
    }

    if (data && data.length > 0) {
      return res.status(200).json({ suggestions: data[0].suggestions || [], id: data[0].id });
    }
    return res.status(200).json({ suggestions: [] });
  }

  if (req.method === 'POST') {
    const { siteUrl, projectId, suggestions } = req.body || {};
    if (!siteUrl) return res.status(400).json({ error: 'siteUrl required' });

    const { error } = await supabase.from('build_suggestions').insert({
      site_url: siteUrl,
      project_id: projectId || null,
      suggestions: suggestions || [],
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[BuildSuggestions] Insert error:', error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ success: true });
  }

  if (req.method === 'PUT') {
    const { id, projectId, suggestionIndex, built, builtContent } = req.body || {};
    if (!id || suggestionIndex === undefined) return res.status(400).json({ error: 'id and suggestionIndex required' });

    const { data: existing, error: fetchErr } = await supabase
      .from('build_suggestions')
      .select('suggestions')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ error: 'Not found' });
    }

    const suggestions = existing.suggestions || [];
    if (suggestionIndex < suggestions.length) {
      suggestions[suggestionIndex] = {
        ...suggestions[suggestionIndex],
        built: built !== undefined ? built : suggestions[suggestionIndex].built,
        builtContent: builtContent !== undefined ? builtContent : suggestions[suggestionIndex].builtContent,
      };
    }

    let updateQuery = supabase
      .from('build_suggestions')
      .update({ suggestions })
      .eq('id', id);
    if (projectId) updateQuery = updateQuery.eq('project_id', projectId);
    const { error } = await updateQuery;

    if (error) {
      console.error('[BuildSuggestions] Update error:', error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
