import { getSupabase } from '../db.js';

/**
 * POST   /api/db/keyword-group-members { groupId, siteUrl, keywords[] } → add keywords
 * DELETE /api/db/keyword-group-members { groupId, keyword }             → remove keyword
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  if (req.method === 'POST') {
    const { groupId, siteUrl, keywords } = req.body || {};
    if (!groupId || !siteUrl || !keywords?.length) {
      return res.status(400).json({ error: 'groupId, siteUrl, and keywords are required' });
    }

    const rows = keywords.map((kw) => ({
      group_id: groupId,
      site_url: siteUrl,
      keyword: kw,
    }));

    const { data, error } = await supabase
      .from('keyword_group_members')
      .upsert(rows, { onConflict: 'group_id,keyword' })
      .select();

    if (error) {
      console.error('DB error adding group members:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ added: data?.length || 0 });
  }

  if (req.method === 'DELETE') {
    const { groupId, keyword } = req.body || {};
    if (!groupId || !keyword) {
      return res.status(400).json({ error: 'groupId and keyword are required' });
    }

    const { error } = await supabase
      .from('keyword_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('keyword', keyword);

    if (error) {
      console.error('DB error removing group member:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
