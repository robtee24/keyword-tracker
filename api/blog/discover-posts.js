import { API_CONFIG, authenticateRequest } from '../_config.js';
import { getServiceToken } from '../_connections.js';

export const config = { maxDuration: 60 };

/**
 * POST /api/blog/discover-posts
 * Fetches GSC performance data for a batch of blog post URLs.
 *
 * Body: { siteUrl, urls: string[] }
 * Returns: { data: { [url]: { totalClicks, totalImpressions, keywords: [{ keyword, clicks, impressions, position }] } } }
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const { siteUrl, urls } = req.body || {};
  if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'urls array is required' });
  }

  try {
    const accessToken = await getServiceToken(auth.user.id, siteUrl, 'google_search_console');
    if (!accessToken) {
      return res.status(401).json({ error: 'Google Search Console not connected' });
    }

    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);

    const result = {};
    const BATCH_SIZE = 25;

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const batch = urls.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(url => fetchPageGSCData(accessToken, siteUrl, url, startDate, endDate))
      );
      for (let j = 0; j < batch.length; j++) {
        const r = batchResults[j];
        if (r.status === 'fulfilled') {
          result[batch[j]] = r.value;
        } else {
          result[batch[j]] = { totalClicks: 0, totalImpressions: 0, keywords: [] };
        }
      }
    }

    return res.status(200).json({ data: result });
  } catch (error) {
    console.error('[DiscoverPosts] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch GSC data' });
  }
}

async function fetchPageGSCData(accessToken, siteUrl, pageUrl, startDate, endDate) {
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
        dimensionFilterGroups: [{
          filters: [{
            dimension: 'page',
            operator: 'equals',
            expression: pageUrl,
          }],
        }],
        rowLimit: 50,
      }),
    }
  );

  if (!response.ok) {
    return { totalClicks: 0, totalImpressions: 0, keywords: [] };
  }

  const data = await response.json();
  const rows = data.rows || [];

  let totalClicks = 0;
  let totalImpressions = 0;
  const keywords = [];

  for (const row of rows) {
    const clicks = row.clicks || 0;
    const impressions = row.impressions || 0;
    totalClicks += clicks;
    totalImpressions += impressions;
    keywords.push({
      keyword: row.keys?.[0] || '',
      clicks,
      impressions,
      position: Math.round((row.position || 0) * 10) / 10,
    });
  }

  keywords.sort((a, b) => b.clicks - a.clicks);

  return { totalClicks, totalImpressions, keywords };
}
