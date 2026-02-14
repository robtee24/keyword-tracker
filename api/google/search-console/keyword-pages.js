import { API_CONFIG, getAccessTokenFromRequest } from '../../_config.js';

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

    const { startDate, endDate, keyword, siteUrl } = req.body;

    if (!siteUrl) {
      return res.status(400).json({ error: 'siteUrl is required' });
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
          dimensions: ['query', 'page'],
          dimensionFilterGroups: [
            {
              filters: [
                {
                  dimension: 'query',
                  operator: 'equals',
                  expression: keyword,
                },
              ],
            },
          ],
          rowLimit: 100,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Search Console keyword-pages error:', response.status, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    const rows = (data.rows || []).map((row) => ({
      keys: row.keys,
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: (row.ctr || 0) * 100,
      position: row.position || 0,
    }));

    res.status(200).json({ rows });
  } catch (error) {
    console.error('Search Console keyword-pages API error:', error);
    res.status(500).json({
      error: 'Failed to fetch keyword pages',
      details: error.message,
      pages: [],
    });
  }
}
