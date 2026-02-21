export const config = { maxDuration: 30 };

/**
 * GET /api/audit/sitemap?siteUrl=https://example.com
 * Fetches and parses the sitemap to extract all page URLs.
 * Handles both regular sitemaps and sitemap index files.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let { siteUrl } = req.query;
  if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });

  // Normalize: ensure trailing slash
  if (!siteUrl.endsWith('/')) siteUrl += '/';

  const sitemapCandidates = [
    `${siteUrl}sitemap.xml`,
    `${siteUrl}sitemap_index.xml`,
    `${siteUrl}sitemap-index.xml`,
  ];

  let urls = [];

  for (const candidate of sitemapCandidates) {
    try {
      const resp = await fetch(candidate, {
        headers: { 'User-Agent': 'KeywordTracker-AuditBot/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) continue;

      const xml = await resp.text();
      if (!xml.includes('<urlset') && !xml.includes('<sitemapindex')) continue;

      if (xml.includes('<sitemapindex')) {
        // Sitemap index — extract child sitemap URLs and fetch each
        const sitemapUrls = extractLocs(xml);
        const childResults = await Promise.allSettled(
          sitemapUrls.slice(0, 20).map((u) => fetchSitemapUrls(u))
        );
        for (const r of childResults) {
          if (r.status === 'fulfilled') urls.push(...r.value);
        }
      } else {
        urls = extractLocs(xml);
      }

      if (urls.length > 0) break;
    } catch {
      continue;
    }
  }

  // Deduplicate and sort
  urls = [...new Set(urls)].sort();

  console.log(`[Sitemap] Found ${urls.length} URLs for ${siteUrl}`);
  return res.status(200).json({ urls, count: urls.length });
}

function extractLocs(xml) {
  const locs = [];
  const regex = /<loc>\s*(.*?)\s*<\/loc>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const url = match[1].trim();
    if (url.startsWith('http')) locs.push(url);
  }
  return locs;
}

async function fetchSitemapUrls(sitemapUrl) {
  const resp = await fetch(sitemapUrl, {
    headers: { 'User-Agent': 'KeywordTracker-AuditBot/1.0' },
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) return [];
  const xml = await resp.text();
  return extractLocs(xml);
}
