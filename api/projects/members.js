import { authenticateRequest } from '../_config.js';
import { getSupabase } from '../db.js';
import { isProjectOwner } from '../_projectAccess.js';

export default async function handler(req, res) {
  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const userId = auth.user.id;

  if (req.method === 'GET') {
    const projectId = req.query?.project_id;
    if (!projectId) return res.status(400).json({ error: 'project_id is required' });

    const { data: membership } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) return res.status(403).json({ error: 'Not a member of this project' });

    const { data: members, error } = await supabase
      .from('project_members')
      .select('id, email, role, invited_at, user_id')
      .eq('project_id', projectId)
      .order('invited_at', { ascending: true });

    if (error) return res.status(500).json({ error: 'Failed to fetch members' });
    return res.json({ members: members || [] });
  }

  if (req.method === 'POST') {
    const { project_id, email, role } = req.body || {};
    if (!project_id || !email) {
      return res.status(400).json({ error: 'project_id and email are required' });
    }

    const ownerCheck = await isProjectOwner(userId, project_id);
    if (!ownerCheck) return res.status(403).json({ error: 'Only the project owner can add members' });

    const validRoles = ['editor', 'viewer'];
    const memberRole = validRoles.includes(role) ? role : 'viewer';
    const cleanEmail = email.trim().toLowerCase();

    // Look up user by email to set user_id if they already exist
    let matchedUserId = null;
    const { data: existingUser } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingUser) {
      matchedUserId = existingUser.id;
    } else {
      // Try the admin API to find user by email
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const found = users?.find((u) => u.email?.toLowerCase() === cleanEmail);
      if (found) matchedUserId = found.id;
    }

    const { data: member, error } = await supabase
      .from('project_members')
      .insert({
        project_id,
        user_id: matchedUserId,
        email: cleanEmail,
        role: memberRole,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'This user is already a member of the project' });
      }
      return res.status(500).json({ error: 'Failed to add member', details: error.message });
    }

    return res.status(201).json({ member });
  }

  if (req.method === 'DELETE') {
    const { project_id, member_id } = req.body || {};
    if (!project_id || !member_id) {
      return res.status(400).json({ error: 'project_id and member_id are required' });
    }

    const ownerCheck = await isProjectOwner(userId, project_id);
    if (!ownerCheck) return res.status(403).json({ error: 'Only the project owner can remove members' });

    // Prevent removing the owner
    const { data: target } = await supabase
      .from('project_members')
      .select('role')
      .eq('id', member_id)
      .maybeSingle();

    if (target?.role === 'owner') {
      return res.status(400).json({ error: 'Cannot remove the project owner' });
    }

    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('id', member_id)
      .eq('project_id', project_id);

    if (error) return res.status(500).json({ error: 'Failed to remove member' });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
