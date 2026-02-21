import { getSupabase } from '../db.js';

/**
 * GET    /api/db/keyword-groups?siteUrl=X           → list groups with member count
 * POST   /api/db/keyword-groups { siteUrl, name }   → create group
 * DELETE /api/db/keyword-groups { id }               → delete group (cascades members)
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  if (req.method === 'GET') {
    const { siteUrl } = req.query;
    if (!siteUrl) {
      return res.status(400).json({ error: 'siteUrl is required' });
    }

    const { data: groups, error } = await supabase
      .from('keyword_groups')
      .select('*, keyword_group_members(keyword)')
      .eq('site_url', siteUrl)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('DB error fetching groups:', error);
      return res.status(500).json({ error: error.message });
    }

    const result = (groups || []).map((g) => ({
      id: g.id,
      name: g.name,
      createdAt: g.created_at,
      keywords: (g.keyword_group_members || []).map((m) => m.keyword),
    }));

    return res.status(200).json({ groups: result });
  }

  if (req.method === 'POST') {
    const { siteUrl, name } = req.body || {};
    if (!siteUrl || !name) {
      return res.status(400).json({ error: 'siteUrl and name are required' });
    }

    const { data, error } = await supabase
      .from('keyword_groups')
      .insert({ site_url: siteUrl, name })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A group with this name already exists' });
      }
      console.error('DB error creating group:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ group: { id: data.id, name: data.name, createdAt: data.created_at, keywords: [] } });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }

    const { error } = await supabase
      .from('keyword_groups')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('DB error deleting group:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
