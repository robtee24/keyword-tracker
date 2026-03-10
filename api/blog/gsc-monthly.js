import { authenticateRequest, API_CONFIG } from '../_config.js';
import { getServiceToken } from '../_connections.js';

export const config = { maxDuration: 30 };

/**
 * POST /api/blog/gsc-monthly
 * Body: { siteUrl, pageUrl }
 * Returns monthly clicks/impressions for a specific page over the last 12 months.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const { siteUrl, pageUrl } = req.body || {};
  if (!siteUrl || !pageUrl) {
    return res.status(400).json({ error: 'siteUrl and pageUrl are required' });
  }

  try {
    const accessToken = await getServiceToken(auth.user.id, siteUrl, 'google_search_console');
    if (!accessToken) {
      return res.status(401).json({ error: 'Google Search Console not connected' });
    }

    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10); // last day of prev month
    const startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().slice(0, 10); // 12 months ago

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
          dimensionFilterGroups: [{
            filters: [{ dimension: 'page', operator: 'equals', expression: pageUrl }],
          }],
          rowLimit: 25000,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('[BlogGscMonthly] GSC API error:', response.status, err);
      return res.status(200).json({ months: [] });
    }

    const data = await response.json();

    // Aggregate daily data into monthly buckets
    const monthlyMap = new Map();
    for (const row of (data.rows || [])) {
      const date = row.keys?.[0] || '';
      const monthKey = date.slice(0, 7); // "YYYY-MM"
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { month: monthKey, clicks: 0, impressions: 0 });
      }
      const m = monthlyMap.get(monthKey);
      m.clicks += row.clicks || 0;
      m.impressions += row.impressions || 0;
    }

    const months = [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month));

    return res.status(200).json({ months });
  } catch (error) {
    console.error('[BlogGscMonthly] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch monthly data' });
  }
}
