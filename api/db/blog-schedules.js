import { getSupabase } from '../db.js';

/**
 * GET /api/db/blog-schedules?siteUrl=...
 * POST /api/db/blog-schedules { siteUrl, frequency, postsPerBatch, active }
 * PUT /api/db/blog-schedules { id, active, frequency, postsPerBatch }
 * DELETE /api/db/blog-schedules { id }
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();
  if (!supabase) return res.status(200).json({ schedules: [] });

  if (req.method === 'GET') {
    const { siteUrl } = req.query;
    if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });

    const { data, error } = await supabase
      .from('blog_schedules')
      .select('*')
      .eq('site_url', siteUrl)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[BlogSchedules] Fetch error:', error.message);
      return res.status(200).json({ schedules: [] });
    }
    return res.status(200).json({ schedules: data || [] });
  }

  if (req.method === 'POST') {
    const { siteUrl, frequency, postsPerBatch, active } = req.body || {};
    if (!siteUrl || !frequency) return res.status(400).json({ error: 'siteUrl and frequency required' });

    const { data, error } = await supabase.from('blog_schedules').insert({
      site_url: siteUrl,
      frequency,
      posts_per_batch: postsPerBatch || 1,
      active: active !== false,
      created_at: new Date().toISOString(),
    }).select();

    if (error) {
      console.error('[BlogSchedules] Insert error:', error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ schedule: data?.[0] || null });
  }

  if (req.method === 'PUT') {
    const { id, active, frequency, postsPerBatch } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });

    const updates = {};
    if (active !== undefined) updates.active = active;
    if (frequency) updates.frequency = frequency;
    if (postsPerBatch) updates.posts_per_batch = postsPerBatch;

    const { error } = await supabase.from('blog_schedules').update(updates).eq('id', id);
    if (error) {
      console.error('[BlogSchedules] Update error:', error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });

    const { error } = await supabase.from('blog_schedules').delete().eq('id', id);
    if (error) {
      console.error('[BlogSchedules] Delete error:', error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
