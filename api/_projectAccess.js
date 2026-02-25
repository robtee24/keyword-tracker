import { getSupabase } from './db.js';

/**
 * Check if a user has access to a project with the given site_url.
 * The site_url is matched against the project's gsc_property or domain.
 * Returns the project row if access is granted, null otherwise.
 */
export async function validateProjectAccess(userId, siteUrl) {
  const supabase = getSupabase();
  if (!supabase || !userId || !siteUrl) return null;

  const { data, error } = await supabase
    .from('projects')
    .select('id, owner_id, name, domain, gsc_property')
    .or(`gsc_property.eq.${siteUrl},domain.eq.${siteUrl}`)
    .limit(50);

  if (error || !data || data.length === 0) return null;

  for (const project of data) {
    const { data: member } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', project.id)
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (member) return project;
  }

  return null;
}

/**
 * Check if a user is the owner of a specific project.
 */
export async function isProjectOwner(userId, projectId) {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { data } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('owner_id', userId)
    .maybeSingle();

  return !!data;
}
