import { getSupabase } from '../db.js';

/**
 * POST /api/db/keyword-intents  { siteUrl, overrides: { keyword: intent } }
 *   Save user intent overrides to the keyword_intents table.
 *   These take priority over AI classifications on future loads.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  const { siteUrl, overrides } = req.body || {};
  if (!siteUrl || !overrides || typeof overrides !== 'object') {
    return res.status(400).json({ error: 'siteUrl and overrides object required' });
  }

  const rows = Object.entries(overrides).map(([keyword, intent]) => ({
    site_url: siteUrl,
    keyword: keyword.toLowerCase(),
    intent,
    classified_at: new Date().toISOString(),
  }));

  let saved = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase
      .from('keyword_intents')
      .upsert(batch, { onConflict: 'site_url,keyword' });

    if (error) {
      console.error('[DB/KeywordIntents] upsert error:', error.message);
      errors.push(error.message);
    } else {
      saved += batch.length;
    }
  }

  console.log(`[DB/KeywordIntents] Saved ${saved}/${rows.length} overrides for ${siteUrl}`);
  return res.status(200).json({ saved, total: rows.length, errors: errors.length > 0 ? errors : undefined });
}
