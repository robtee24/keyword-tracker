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
          .eq('query_type', 'daily')
          .eq('fetched_date', todayUTC())
          .maybeSingle();

        if (cached?.response_data) {
          return res.status(200).json({ ...cached.response_data, fromCache: true });
        }
      } catch (cacheErr) {
        console.error('Cache read error (continuing):', cacheErr.message);
      }
    }

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
          dimensions: ['date'],
          rowLimit: 500,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Search Console daily error:', response.status, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const dailyData = (data.rows || []).map((row) => ({
      date: row.keys[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: (row.ctr || 0) * 100,
      position: row.position || 0,
    }));

    const responseData = {
      rows: dailyData,
      dailyData,
    };

    // Save to cache (best-effort)
    if (supabase) {
      try {
        await supabase.from('gsc_cache').upsert({
          site_url: siteUrl,
          start_date: startDate,
          end_date: endDate,
          query_type: 'daily',
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
    console.error('Search Console daily API error:', error);
    res.status(500).json({
      error: 'Failed to fetch daily data',
      details: error.message,
      dailyData: [],
    });
  }
}
