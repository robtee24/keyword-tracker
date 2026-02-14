import { API_CONFIG, getAccessTokenFromRequest } from '../../_config.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const accessToken = getAccessTokenFromRequest(req);

    if (!accessToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { keyword, siteUrl } = req.body;

    if (!keyword || !siteUrl) {
      return res.status(400).json({ error: 'keyword and siteUrl are required' });
    }

    // Calculate trailing 24 months
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 24);

    const formatDate = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const response = await fetch(
      `${API_CONFIG.googleSearchConsole.baseUrl}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          dimensions: ['date'],
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
          rowLimit: 25000,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Keyword history error:', response.status, errorText);

      if (response.status === 401 || response.status === 403) {
        return res.status(401).json({ error: 'Authentication error' });
      }

      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const dailyRows = data.rows || [];

    // Aggregate daily data into monthly buckets
    const monthlyMap = {};
    dailyRows.forEach((row) => {
      const dateStr = row.keys[0]; // YYYY-MM-DD
      const monthKey = dateStr.substring(0, 7); // YYYY-MM

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = {
          positions: [],
          clicks: 0,
          impressions: 0,
        };
      }

      monthlyMap[monthKey].positions.push(row.position || 0);
      monthlyMap[monthKey].clicks += row.clicks || 0;
      monthlyMap[monthKey].impressions += row.impressions || 0;
    });

    // Convert to sorted array with average position per month
    const monthly = Object.keys(monthlyMap)
      .sort()
      .map((month) => {
        const bucket = monthlyMap[month];
        const avgPosition =
          bucket.positions.length > 0
            ? bucket.positions.reduce((s, v) => s + v, 0) / bucket.positions.length
            : null;

        return {
          month,
          position: avgPosition !== null ? Math.round(avgPosition * 10) / 10 : null,
          clicks: bucket.clicks,
          impressions: bucket.impressions,
        };
      });

    res.status(200).json({ monthly });
  } catch (error) {
    console.error('Keyword history API error:', error);
    res.status(500).json({
      error: 'Failed to fetch keyword history',
      details: error.message,
    });
  }
}
