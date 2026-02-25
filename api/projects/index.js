import { authenticateRequest } from '../_config.js';
import { getSupabase } from '../db.js';

export default async function handler(req, res) {
  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const userId = auth.user.id;
  const userEmail = auth.user.email;

  if (req.method === 'GET') {
    const { data: memberships, error: memErr } = await supabase
      .from('project_members')
      .select('project_id, role')
      .eq('user_id', userId);

    if (memErr) return res.status(500).json({ error: 'Failed to fetch memberships' });
    if (!memberships || memberships.length === 0) return res.json({ projects: [] });

    const projectIds = memberships.map((m) => m.project_id);
    const roleMap = Object.fromEntries(memberships.map((m) => [m.project_id, m.role]));

    const { data: projects, error: projErr } = await supabase
      .from('projects')
      .select('*')
      .in('id', projectIds)
      .order('created_at', { ascending: false });

    if (projErr) return res.status(500).json({ error: 'Failed to fetch projects' });

    const enriched = (projects || []).map((p) => ({
      ...p,
      role: roleMap[p.id] || 'viewer',
    }));

    return res.json({ projects: enriched });
  }

  if (req.method === 'POST') {
    const { name, domain } = req.body || {};
    if (!name || !domain) {
      return res.status(400).json({ error: 'name and domain are required' });
    }

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();

    const { data: project, error } = await supabase
      .from('projects')
      .insert({ owner_id: userId, name: name.trim(), domain: cleanDomain })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'You already have a project for this domain' });
      }
      return res.status(500).json({ error: 'Failed to create project', details: error.message });
    }

    return res.status(201).json({ project: { ...project, role: 'owner' } });
  }

  if (req.method === 'PUT') {
    const { id, name, gsc_property } = req.body || {};
    if (!id) return res.status(400).json({ error: 'project id is required' });

    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('owner_id', userId)
      .maybeSingle();

    if (!existing) return res.status(403).json({ error: 'Not authorized to update this project' });

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (gsc_property !== undefined) updates.gsc_property = gsc_property || null;

    const { data: updated, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'Failed to update project' });
    return res.json({ project: updated });
  }

  if (req.method === 'DELETE') {
    const id = req.query?.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'project id is required' });

    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('owner_id', userId)
      .maybeSingle();

    if (!existing) return res.status(403).json({ error: 'Not authorized to delete this project' });

    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Failed to delete project' });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
