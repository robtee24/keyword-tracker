import { getSupabase } from '../db.js';

/**
 * POST /api/db/keywords  { siteUrl, keywords: string[] }
 *   Upserts keywords: new ones get first_seen_at = now(), existing ones get last_seen_at = now().
 *   Returns { newKeywords, lostKeywords } compared to previous data.
 *
 * GET  /api/db/keywords?siteUrl=X
 *   Returns all stored keywords with first_seen_at / last_seen_at timestamps.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  if (req.method === 'GET') {
    const { siteUrl } = req.query;
    if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });

    const { data, error } = await supabase
      .from('keywords')
      .select('keyword, first_seen_at, last_seen_at')
      .eq('site_url', siteUrl);

    if (error) {
      console.error('DB error fetching keywords:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ keywords: data || [] });
  }

  if (req.method === 'POST') {
    const { siteUrl, keywords } = req.body || {};
    if (!siteUrl || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ error: 'siteUrl and keywords array are required' });
    }

    const now = new Date().toISOString();

    // 1. Fetch all previously stored keywords for this site
    const { data: existing, error: fetchErr } = await supabase
      .from('keywords')
      .select('keyword, last_seen_at')
      .eq('site_url', siteUrl);

    if (fetchErr) {
      console.error('DB error fetching existing keywords:', fetchErr);
      return res.status(500).json({ error: fetchErr.message });
    }

    // Build a case-insensitive map so GSC casing variations don't cause false "new" tags
    const existingMap = new Map(
      (existing || []).map((k) => [k.keyword.toLowerCase(), k.last_seen_at])
    );
    const currentSet = new Set(keywords.map((kw) => kw.toLowerCase()));

    // 2. Identify new keywords — only if we already have stored keywords
    //    (first run seeds the DB; nothing is "new" on the initial setup)
    const isFirstRun = existingMap.size === 0;
    const newKeywords = isFirstRun
      ? []
      : keywords.filter((kw) => !existingMap.has(kw.toLowerCase()));

    // 3. Identify lost keywords (in DB but not in current GSC data)
    const lostKeywords = [];
    for (const [kwLower, lastSeen] of existingMap) {
      if (!currentSet.has(kwLower)) {
        // Use the original-case keyword from DB for display
        const original = (existing || []).find((k) => k.keyword.toLowerCase() === kwLower);
        lostKeywords.push({ keyword: original?.keyword || kwLower, lastSeenAt: lastSeen });
      }
    }

    // 4. Upsert current keywords (batch in groups of 50)
    const rows = keywords.map((kw) => ({
      site_url: siteUrl,
      keyword: kw,
      last_seen_at: now,
      ...(existingMap.has(kw.toLowerCase()) ? {} : { first_seen_at: now }),
    }));

    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { error: upsertErr } = await supabase
        .from('keywords')
        .upsert(batch, { onConflict: 'site_url,keyword', ignoreDuplicates: false });

      if (upsertErr) {
        console.error('Keyword upsert batch error:', upsertErr.message);
      }
    }

    return res.status(200).json({
      stored: keywords.length,
      newKeywords,
      lostKeywords: lostKeywords.sort(
        (a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
      ),
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
