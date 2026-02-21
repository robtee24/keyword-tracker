import { API_CONFIG, getAccessTokenFromRequest } from '../../_config.js';
import { getSupabase } from '../../db.js';

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const accessToken = getAccessTokenFromRequest(req);

    if (!accessToken) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please sign in with Google.',
      });
    }

    const { startDate, endDate, siteUrl } = req.body;

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
          .eq('start_date', startDate)
          .eq('end_date', endDate)
          .eq('query_type', 'keywords')
          .eq('fetched_date', todayUTC())
          .maybeSingle();

        if (cached?.response_data) {
          return res.status(200).json({ ...cached.response_data, fromCache: true });
        }
      } catch (cacheErr) {
        console.error('Cache read error (continuing):', cacheErr.message);
      }
    }

    // Fetch keywords with pagination
    let allRows = [];
    let startRow = 0;
    const rowLimit = 25000;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${API_CONFIG.googleSearchConsole.baseUrl}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            startDate,
            endDate,
            dimensions: ['query'],
            rowLimit,
            startRow,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Search Console error:', response.status, errorText);

        if (response.status === 401 || response.status === 403) {
          return res.status(401).json({
            error: 'Authentication error',
            message: 'Please sign in again.',
          });
        }

        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const rows = data.rows || [];
      allRows = allRows.concat(rows);

      if (rows.length < rowLimit) {
        hasMore = false;
      } else {
        startRow += rowLimit;
      }
    }

    // Parse keywords
    const keywords = allRows.map((row, index) => ({
      id: `kw-${index}`,
      keyword: row.keys[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: (row.ctr || 0) * 100,
      position: row.position || 0,
    }));

    // Calculate totals
    const totalClicks = keywords.reduce((sum, k) => sum + k.clicks, 0);
    const totalImpressions = keywords.reduce((sum, k) => sum + k.impressions, 0);

    const responseData = {
      rows: keywords,
      keywords,
      totalClicks,
      totalImpressions,
      totalKeywords: keywords.length,
    };

    // Save to cache (best-effort)
    if (supabase) {
      try {
        await supabase.from('gsc_cache').upsert({
          site_url: siteUrl,
          start_date: startDate,
          end_date: endDate,
          query_type: 'keywords',
          fetched_date: todayUTC(),
          response_data: responseData,
          fetched_at: new Date().toISOString(),
        }, { onConflict: 'site_url,start_date,end_date,query_type' });
      } catch (saveErr) {
        console.error('Cache write error (non-fatal):', saveErr.message);
      }
    }

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Search Console API error:', error);
    res.status(500).json({
      error: 'Failed to fetch Search Console data',
      details: error.message,
    });
  }
}
