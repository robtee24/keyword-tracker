import { getSupabase } from '../db.js';

/**
 * GET  /api/db/search-volumes?siteUrl=X
 *   Returns ALL stored search volumes for a site. No freshness filter —
 *   volumes are permanent once fetched. Fast DB read, no Google Ads API.
 *
 * POST /api/db/search-volumes  { siteUrl, volumes: { keyword: { avgMonthlySearches, competition, competitionIndex } } }
 *   Bulk-save search volumes for a site (called after Google Ads fetch).
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
      .from('search_volumes')
      .select('keyword, avg_monthly_searches, competition, competition_index, fetched_at')
      .eq('site_url', siteUrl);

    if (error) {
      console.error('DB error fetching search volumes:', error.message);
      return res.status(500).json({ error: error.message });
    }

    const volumes = {};
    for (const row of (data || [])) {
      const key = (row.keyword || '').toLowerCase();
      volumes[key] = {
        avgMonthlySearches: typeof row.avg_monthly_searches === 'number'
          ? row.avg_monthly_searches
          : parseNum(row.avg_monthly_searches),
        competition: row.competition,
        competitionIndex: row.competition_index,
        fetchedAt: row.fetched_at,
      };
    }

    return res.status(200).json({ volumes, count: Object.keys(volumes).length });
  }

  if (req.method === 'POST') {
    const { siteUrl, volumes } = req.body || {};
    if (!siteUrl || !volumes || typeof volumes !== 'object') {
      return res.status(400).json({ error: 'siteUrl and volumes object are required' });
    }

    const rows = Object.entries(volumes).map(([kw, vol]) => ({
      site_url: siteUrl,
      keyword: kw.toLowerCase(),
      avg_monthly_searches: vol.avgMonthlySearches,
      competition: vol.competition,
      competition_index: vol.competitionIndex,
      fetched_at: new Date().toISOString(),
    }));

    let saved = 0;
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { error: upsertErr } = await supabase
        .from('search_volumes')
        .upsert(batch, { onConflict: 'site_url,keyword' });

      if (upsertErr) {
        console.error('Volume upsert error:', upsertErr.message);
      } else {
        saved += batch.length;
      }
    }

    return res.status(200).json({ saved });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

function parseNum(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  const n = parseInt(String(value), 10);
  return isNaN(n) ? null : n;
}
