import { API_CONFIG, getAccessTokenFromRequest } from '../../_config.js';
import { getSupabase } from '../../db.js';

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Batch-fetch keyword positions across 3 time windows for alert detection.
 *
 * Returns average position per keyword for:
 *   - period1: 12–6 months ago
 *   - period2: 6–3 months ago
 *   - period3: last 3 months (recent)
 *
 * The frontend uses these to compute Fire / Smoking / Hot alerts.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = getAccessTokenFromRequest(req);
  if (!accessToken) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { siteUrl } = req.body || {};
  if (!siteUrl) {
    return res.status(400).json({ error: 'siteUrl is required' });
  }

  // Check Supabase cache (valid for the current calendar day)
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data: cached } = await supabase
        .from('gsc_cache')
        .select('response_data')
        .eq('site_url', siteUrl)
        .eq('start_date', 'alerts')
        .eq('end_date', 'alerts')
        .eq('query_type', 'alerts')
        .eq('fetched_date', todayUTC())
        .maybeSingle();

      if (cached?.response_data) {
        return res.status(200).json({ ...cached.response_data, fromCache: true });
      }
    } catch (cacheErr) {
      console.error('Alert cache read error (continuing):', cacheErr.message);
    }
  }

  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const now = new Date();
  const months = (n) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - n);
    return d;
  };

  // 3 time windows
  const windows = [
    { key: 'period1', start: fmt(months(12)), end: fmt(months(6)) },
    { key: 'period2', start: fmt(months(6)),  end: fmt(months(3)) },
    { key: 'period3', start: fmt(months(3)),  end: fmt(now) },
  ];

  try {
    const results = {};

    // Run the 3 queries in parallel
    const responses = await Promise.all(
      windows.map((w) =>
        fetch(
          `${API_CONFIG.googleSearchConsole.baseUrl}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              startDate: w.start,
              endDate: w.end,
              dimensions: ['query'],
              rowLimit: 5000,
            }),
          }
        ).then(async (r) => {
          if (!r.ok) {
            console.error(`Alert query ${w.key} failed: ${r.status}`);
            return { key: w.key, rows: [] };
          }
          const data = await r.json();
          return { key: w.key, rows: data.rows || [] };
        })
      )
    );

    // Merge into per-keyword structure
    for (const { key, rows } of responses) {
      for (const row of rows) {
        const kw = row.keys[0];
        if (!results[kw]) results[kw] = {};
        results[kw][key] = {
          position: Math.round((row.position || 0) * 10) / 10,
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
        };
      }
    }

    const responseData = { alerts: results };

    // Save to cache (best-effort)
    if (supabase) {
      try {
        await supabase.from('gsc_cache').upsert({
          site_url: siteUrl,
          start_date: 'alerts',
          end_date: 'alerts',
          query_type: 'alerts',
          fetched_date: todayUTC(),
          response_data: responseData,
          fetched_at: new Date().toISOString(),
        }, { onConflict: 'site_url,start_date,end_date,query_type' });
      } catch (saveErr) {
        console.error('Alert cache write error (non-fatal):', saveErr.message);
      }
    }

    return res.status(200).json(responseData);
  } catch (error) {
    console.error('Keyword alerts API error:', error);
    return res.status(500).json({ error: 'Failed to fetch alert data' });
  }
}
