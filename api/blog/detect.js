export const config = { maxDuration: 30 };

const BLOG_PATH_PATTERNS = [
  '/blog', '/blogs', '/articles', '/news', '/posts',
  '/resources/blog', '/resources/articles', '/insights',
  '/learn', '/journal', '/stories', '/updates',
];

/**
 * GET /api/blog/detect?siteUrl=https://example.com
 * Scans the sitemap to find root blog URLs.
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
  ];

  let urls = [];

  for (const candidate of sitemapCandidates) {
    try {
      const resp = await fetch(candidate, {
        headers: { 'User-Agent': 'SEAUTO-BlogBot/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) continue;
      const xml = await resp.text();
      if (!xml.includes('<urlset') && !xml.includes('<sitemapindex')) continue;

      if (xml.includes('<sitemapindex')) {
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

  const baseUrl = new URL(siteUrl);
  const blogRoots = new Set();

  for (const pageUrl of urls) {
    try {
      const parsed = new URL(pageUrl);
      if (parsed.hostname !== baseUrl.hostname) continue;
      const path = parsed.pathname.toLowerCase();

      for (const pattern of BLOG_PATH_PATTERNS) {
        if (path.startsWith(pattern + '/') || path === pattern) {
          const rootUrl = `${parsed.origin}${pattern}/`;
          blogRoots.add(rootUrl);
        }
      }
    } catch {
      continue;
    }
  }

  const blogUrls = [...blogRoots].sort();
  const blogPages = {};
  for (const root of blogUrls) {
    blogPages[root] = urls.filter((u) => u.startsWith(root) && u !== root).length;
  }

  return res.status(200).json({
    blogUrls,
    blogPages,
    totalSitemapUrls: urls.length,
  });
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
    headers: { 'User-Agent': 'SEAUTO-BlogBot/1.0' },
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) return [];
  const xml = await resp.text();
  return extractLocs(xml);
}
