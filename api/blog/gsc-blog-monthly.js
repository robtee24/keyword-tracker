import { authenticateRequest, API_CONFIG } from '../_config.js';
import { getServiceToken } from '../_connections.js';

export const config = { maxDuration: 30 };

/**
 * POST /api/blog/gsc-blog-monthly
 * Body: { siteUrl, rootPath }
 * Returns monthly clicks/impressions for ALL pages under a blog root path over the last 12 months.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const { siteUrl, rootPath } = req.body || {};
  if (!siteUrl || !rootPath) {
    return res.status(400).json({ error: 'siteUrl and rootPath are required' });
  }

  try {
    const accessToken = await getServiceToken(auth.user.id, siteUrl, 'google_search_console');
    if (!accessToken) {
      return res.status(401).json({ error: 'Google Search Console not connected' });
    }

    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
    const startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().slice(0, 10);

    let domain = siteUrl;
    if (domain.startsWith('sc-domain:')) {
      domain = domain.replace('sc-domain:', '');
    }
    domain = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');

    const pageFilter = `https://${domain.replace(/^www\./, '')}${rootPath}`;
    const pageFilterWww = `https://www.${domain.replace(/^www\./, '')}${rootPath}`;

    const fetchMonthly = async (expression) => {
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
              filters: [{ dimension: 'page', operator: 'includingRegex', expression }],
            }],
            rowLimit: 25000,
          }),
        }
      );
      if (!response.ok) return [];
      const data = await response.json();
      return data.rows || [];
    };

    const regex = `^https?://(www\\.)?${domain.replace(/^www\./, '').replace(/\./g, '\\.')}${rootPath.replace(/\//g, '\\/')}`;
    const rows = await fetchMonthly(regex);

    const monthlyMap = new Map();
    for (const row of rows) {
      const date = row.keys?.[0] || '';
      const monthKey = date.slice(0, 7);
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
    console.error('[BlogGscBlogMonthly] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch blog monthly data' });
  }
}
