export const config = { maxDuration: 60 };

/**
 * GET /api/audit/sitemap?siteUrl=https://example.com
 * Fetches and parses the sitemap to extract all page URLs.
 * Handles regular sitemaps, sitemap index files, and nested sitemap indexes.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let { siteUrl } = req.query;
  if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });

  if (!siteUrl.endsWith('/')) siteUrl += '/';

  const sitemapCandidates = [
    `${siteUrl}sitemap.xml`,
    `${siteUrl}sitemap_index.xml`,
    `${siteUrl}sitemap-index.xml`,
    `${siteUrl}wp-sitemap.xml`,
  ];

  let urls = [];

  for (const candidate of sitemapCandidates) {
    try {
      const resp = await fetch(candidate, {
        headers: { 'User-Agent': 'SEAUTO-AuditBot/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) continue;

      const xml = await resp.text();
      if (!xml.includes('<urlset') && !xml.includes('<sitemapindex')) continue;

      urls = await resolveAllUrls(xml);
      if (urls.length > 0) break;
    } catch {
      continue;
    }
  }

  urls = [...new Set(urls)].sort();

  console.log(`[Sitemap] Found ${urls.length} URLs for ${siteUrl}`);
  return res.status(200).json({ urls, count: urls.length });
}

async function resolveAllUrls(xml) {
  if (xml.includes('<sitemapindex')) {
    const childSitemapUrls = extractLocs(xml);
    const allPageUrls = [];

    const batchSize = 10;
    for (let i = 0; i < childSitemapUrls.length; i += batchSize) {
      const batch = childSitemapUrls.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (url) => {
          try {
            const resp = await fetch(url, {
              headers: { 'User-Agent': 'SEAUTO-AuditBot/1.0' },
              signal: AbortSignal.timeout(15000),
            });
            if (!resp.ok) return [];
            const childXml = await resp.text();

            if (childXml.includes('<sitemapindex')) {
              return await resolveAllUrls(childXml);
            }
            return extractLocs(childXml);
          } catch {
            return [];
          }
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled') allPageUrls.push(...r.value);
      }
    }
    return allPageUrls;
  }

  return extractLocs(xml);
}

function extractLocs(xml) {
  const locs = [];
  const regex = /<loc>\s*(.*?)\s*<\/loc>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const url = match[1].trim();
    if (url.startsWith('http') && !url.endsWith('.xml')) locs.push(url);
  }
  return locs;
}
