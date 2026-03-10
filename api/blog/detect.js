import { authenticateRequest, API_CONFIG } from '../_config.js';
import { getSupabase } from '../db.js';
import { getServiceToken } from '../_connections.js';

export const config = { maxDuration: 120 };

const KNOWN_BLOG_PATTERNS = [
  '/blog', '/blogs', '/articles', '/news', '/posts',
  '/resources/blog', '/resources/articles', '/insights',
  '/learn', '/journal', '/stories', '/updates',
  '/press', '/media', '/content', '/tips',
];

const EXCLUDED_PREFIXES = [
  '/api', '/admin', '/auth', '/login', '/signup', '/register',
  '/account', '/dashboard', '/app', '/static', '/assets',
  '/wp-admin', '/wp-content', '/wp-includes', '/wp-json',
  '/cdn-cgi', '/_next', '/.well-known',
];

// Two-letter codes for language/country prefixes to ignore
const I18N_PREFIXES = new Set([
  'en','es','fr','de','it','pt','pl','nl','ru','ja','ko','zh',
  'ar','sv','da','fi','no','tr','cs','hu','ro','sk','bg','hr',
  'el','he','th','vi','id','ms','uk','ca','eu','gl','sr','sl',
]);

function normalizeSiteUrl(siteUrl) {
  if (siteUrl.startsWith('sc-domain:')) {
    const domain = siteUrl.replace('sc-domain:', '').replace(/\/+$/, '');
    return `https://www.${domain.replace(/^www\./, '')}/`;
  }
  if (!siteUrl.startsWith('http')) siteUrl = `https://${siteUrl}`;
  if (!siteUrl.endsWith('/')) siteUrl += '/';
  return siteUrl;
}

/**
 * POST /api/blog/detect
 * Body: { siteUrl, projectId }
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  let { siteUrl, projectId } = req.body || {};
  if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });

  const crawlUrl = normalizeSiteUrl(siteUrl);
  if (!crawlUrl) return res.status(400).json({ error: 'Invalid siteUrl format' });

  try {
    // 1. Collect URLs from sitemaps
    const allUrls = await collectAllSitemapUrls(crawlUrl);
    if (allUrls.length === 0) {
      return res.status(200).json({ blogs: [], totalUrls: 0 });
    }

    const baseHostname = new URL(crawlUrl).hostname;
    const bareHostname = baseHostname.replace(/^www\./, '');
    const acceptedHostnames = new Set([bareHostname, `www.${bareHostname}`]);

    // 2. Filter and parse URLs
    const parsedUrls = [];
    for (const url of allUrls) {
      try {
        const parsed = new URL(url);
        if (!acceptedHostnames.has(parsed.hostname)) continue;
        const path = parsed.pathname;
        if (EXCLUDED_PREFIXES.some(p => path.toLowerCase().startsWith(p))) continue;
        parsedUrls.push({ url, path });
      } catch { continue; }
    }

    // 3. Identify blog clusters
    const clusters = identifyBlogClusters(parsedUrls);

    // 4. Sample-crawl unknown clusters IN PARALLEL
    const verifiedBlogs = clusters.filter(c => c.isKnownBlog);
    const unknownClusters = clusters.filter(c => !c.isKnownBlog);

    if (unknownClusters.length > 0) {
      const verifyResults = await Promise.allSettled(
        unknownClusters.map(async (cluster) => {
          const isBlog = await verifySampleIsBlog(cluster.sampleUrl);
          return { cluster, isBlog };
        })
      );
      for (const r of verifyResults) {
        if (r.status === 'fulfilled' && r.value.isBlog) {
          verifiedBlogs.push(r.value.cluster);
        }
      }
    }

    // 5. Build blog objects with meta data (limit meta fetches for speed)
    const blogs = [];
    for (const blog of verifiedBlogs) {
      const postsWithMeta = [];
      const metaBatch = blog.posts.slice(0, 50);
      const META_BATCH = 10;
      for (let mi = 0; mi < metaBatch.length; mi += META_BATCH) {
        const slice = metaBatch.slice(mi, mi + META_BATCH);
        const metaResults = await Promise.allSettled(
          slice.map(p => fetchMetaData(p.url))
        );
        for (let i = 0; i < slice.length; i++) {
          const r = metaResults[i];
          postsWithMeta.push(r.status === 'fulfilled' && r.value
            ? { url: slice[i].url, ...r.value }
            : { url: slice[i].url, title: '', metaDescription: '' });
        }
      }
      for (let i = 50; i < blog.posts.length; i++) {
        postsWithMeta.push({ url: blog.posts[i].url, title: '', metaDescription: '' });
      }
      blogs.push({ rootPath: blog.rootPath, name: blog.name, postCount: blog.posts.length, posts: postsWithMeta });
    }

    // 6. Fetch GSC data for discovered blog posts
    let gscData = {};
    try {
      const accessToken = await getServiceToken(auth.user.id, siteUrl, 'google_search_console');
      if (accessToken) {
        const endDate = new Date().toISOString().slice(0, 10);
        const startDate = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);
        for (const blog of blogs) {
          const urls = blog.posts.slice(0, 100).map(p => p.url);
          const batchGsc = await fetchBatchGscData(accessToken, siteUrl, urls, startDate, endDate);
          Object.assign(gscData, batchGsc);
          // Merge GSC data into posts
          blog.posts = blog.posts.map(p => ({
            ...p,
            gscData: batchGsc[p.url] || { totalClicks: 0, totalImpressions: 0, keywords: [] },
          }));
        }

        // Build overviews
        for (const blog of blogs) {
          const totalClicks = blog.posts.reduce((s, p) => s + (p.gscData?.totalClicks || 0), 0);
          const sorted = [...blog.posts].sort((a, b) => (b.gscData?.totalClicks || 0) - (a.gscData?.totalClicks || 0));
          blog.overview = {
            summary: `${blog.name} contains ${blog.posts.length} posts with ${totalClicks.toLocaleString()} total monthly clicks.`,
            totalClicks,
            top5: sorted.slice(0, 5).map(p => ({ url: p.url, title: p.title, clicks: p.gscData?.totalClicks || 0 })),
          };
        }
      }
    } catch (gscErr) {
      console.error('[BlogDetect] GSC fetch failed (non-fatal):', gscErr.message);
    }

    // 7. Save to database
    const supabase = getSupabase();
    if (supabase && projectId) {
      for (const blog of blogs) {
        await supabase
          .from('blog_discoveries')
          .upsert({
            project_id: projectId,
            site_url: siteUrl,
            root_path: blog.rootPath,
            blog_name: blog.name,
            posts: blog.posts,
            overview: blog.overview || null,
            gsc_data: gscData,
            crawled_at: new Date().toISOString(),
          }, { onConflict: 'project_id,site_url,root_path' });
      }
    }

    return res.status(200).json({ blogs, totalUrls: parsedUrls.length, crawledAt: new Date().toISOString() });
  } catch (error) {
    console.error('[BlogDetect] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to detect blogs' });
  }
}

/* ------------------------------------------------------------------ */
/*  GSC Batch Fetch                                                    */
/* ------------------------------------------------------------------ */

async function fetchBatchGscData(accessToken, siteUrl, urls, startDate, endDate) {
  const result = {};
  const BATCH = 10;
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async (url) => {
        const response = await fetch(
          `${API_CONFIG.googleSearchConsole.baseUrl}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startDate, endDate, dimensions: ['query'],
              dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'equals', expression: url }] }],
              rowLimit: 25,
            }),
          }
        );
        if (!response.ok) return { url, data: { totalClicks: 0, totalImpressions: 0, keywords: [] } };
        const data = await response.json();
        let totalClicks = 0, totalImpressions = 0;
        const keywords = [];
        for (const row of (data.rows || [])) {
          const clicks = row.clicks || 0;
          const impressions = row.impressions || 0;
          totalClicks += clicks;
          totalImpressions += impressions;
          keywords.push({ keyword: row.keys?.[0] || '', clicks, impressions, position: Math.round((row.position || 0) * 10) / 10 });
        }
        keywords.sort((a, b) => b.clicks - a.clicks);
        return { url, data: { totalClicks, totalImpressions, keywords } };
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled') result[r.value.url] = r.value.data;
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  Sitemap Crawling                                                   */
/* ------------------------------------------------------------------ */

async function collectAllSitemapUrls(siteUrl) {
  const mainHost = new URL(siteUrl).hostname;
  const bases = [siteUrl];
  if (mainHost.startsWith('www.')) {
    bases.push(siteUrl.replace('://www.', '://'));
  } else {
    bases.push(siteUrl.replace('://', '://www.'));
  }

  const suffixes = ['sitemap.xml', 'sitemap_index.xml', 'sitemap-index.xml', 'wp-sitemap.xml'];

  for (const base of bases) {
    for (const suffix of suffixes) {
      try {
        const resp = await fetch(base + suffix, {
          headers: { 'User-Agent': 'SEAUTO-BlogBot/1.0' },
          signal: AbortSignal.timeout(20000),
        });
        if (!resp.ok) continue;
        const xml = await resp.text();
        if (!xml.includes('<urlset') && !xml.includes('<sitemapindex')) continue;
        const urls = await resolveAllUrls(xml, mainHost);
        if (urls.length > 0) return [...new Set(urls)];
      } catch { continue; }
    }
  }
  return [];
}

async function resolveAllUrls(xml, mainHost) {
  if (xml.includes('<sitemapindex')) {
    const childSitemapUrls = extractLocs(xml, true);
    const allPageUrls = [];
    const sameDomain = [];
    const crossDomain = [];
    const bareHost = mainHost.replace(/^www\./, '');

    for (const url of childSitemapUrls) {
      try {
        const h = new URL(url).hostname;
        if (h === mainHost || h === bareHost || h === `www.${bareHost}`) sameDomain.push(url);
        else crossDomain.push(url);
      } catch { sameDomain.push(url); }
    }

    const fetchBatch = async (urls, timeout) => {
      const batchSize = 5;
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async (url) => {
            try {
              const resp = await fetch(url, { headers: { 'User-Agent': 'SEAUTO-BlogBot/1.0' }, signal: AbortSignal.timeout(timeout) });
              if (!resp.ok) return [];
              const childXml = await resp.text();
              if (childXml.includes('<sitemapindex')) return await resolveAllUrls(childXml, mainHost);
              return extractLocs(childXml, false);
            } catch { return []; }
          })
        );
        for (const r of results) {
          if (r.status === 'fulfilled') allPageUrls.push(...r.value);
        }
      }
    };

    await fetchBatch(sameDomain, 15000);
    if (allPageUrls.length < 100 && crossDomain.length > 0) {
      await fetchBatch(crossDomain, 10000);
    }
    return allPageUrls;
  }
  return extractLocs(xml, false);
}

function extractLocs(xml, includeSitemapXml = false) {
  const locs = [];
  const regex = /<loc>\s*(.*?)\s*<\/loc>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const url = match[1].trim();
    if (!url.startsWith('http')) continue;
    if (!includeSitemapXml && url.endsWith('.xml')) continue;
    locs.push(url);
  }
  return locs;
}

/* ------------------------------------------------------------------ */
/*  Blog Cluster Identification                                        */
/* ------------------------------------------------------------------ */

function identifyBlogClusters(parsedUrls) {
  const prefixGroups = new Map();

  for (const { url, path } of parsedUrls) {
    const segments = path.split('/').filter(Boolean);
    if (segments.length < 2) continue;
    const prefix = '/' + segments[0];
    if (!prefixGroups.has(prefix)) prefixGroups.set(prefix, []);
    prefixGroups.get(prefix).push({ url, path });
  }

  // Two-level prefixes for nested blogs like /resources/blog
  for (const { url, path } of parsedUrls) {
    const segments = path.split('/').filter(Boolean);
    if (segments.length < 3) continue;
    const prefix = '/' + segments[0] + '/' + segments[1];
    if (!prefixGroups.has(prefix)) prefixGroups.set(prefix, []);
    prefixGroups.get(prefix).push({ url, path });
  }

  const clusters = [];
  const usedUrls = new Set();

  // Pass 1: known blog patterns
  for (const pattern of KNOWN_BLOG_PATTERNS) {
    if (prefixGroups.has(pattern)) {
      const posts = prefixGroups.get(pattern)
        .filter(p => p.path !== pattern && p.path !== pattern + '/')
        .filter(p => !usedUrls.has(p.url));
      if (posts.length >= 2) {
        posts.forEach(p => usedUrls.add(p.url));
        const name = pattern.split('/').filter(Boolean).pop();
        clusters.push({ rootPath: pattern, name: name.charAt(0).toUpperCase() + name.slice(1), posts, sampleUrl: posts[0]?.url, isKnownBlog: true });
      }
    }
  }

  // Pass 2: unknown clusters with 5+ child URLs
  for (const [prefix, items] of prefixGroups) {
    if (KNOWN_BLOG_PATTERNS.includes(prefix)) continue;
    if (EXCLUDED_PREFIXES.some(ex => prefix.toLowerCase().startsWith(ex))) continue;

    // Skip i18n locale prefixes (e.g. /fr, /de, /es)
    const firstSeg = prefix.replace('/', '').toLowerCase();
    if (I18N_PREFIXES.has(firstSeg)) continue;

    const posts = items
      .filter(p => p.path !== prefix && p.path !== prefix + '/')
      .filter(p => !usedUrls.has(p.url));

    if (posts.length >= 5) {
      const avgSegments = posts.reduce((sum, p) => sum + p.path.split('/').filter(Boolean).length, 0) / posts.length;
      if (avgSegments <= 4) {
        posts.forEach(p => usedUrls.add(p.url));
        const name = prefix.split('/').filter(Boolean).pop();
        clusters.push({
          rootPath: prefix,
          name: name.charAt(0).toUpperCase() + name.slice(1),
          posts,
          sampleUrl: posts[Math.floor(posts.length / 2)]?.url,
          isKnownBlog: false,
        });
      }
    }
  }

  return clusters;
}

/* ------------------------------------------------------------------ */
/*  Sample Crawl Verification                                          */
/* ------------------------------------------------------------------ */

async function verifySampleIsBlog(url) {
  if (!url) return false;
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(12000),
      redirect: 'follow',
    });
    if (!resp.ok) return false;
    const html = await resp.text();
    return detectContentSignals(html);
  } catch {
    return false;
  }
}

/**
 * Broader content detection: identifies pages with substantial written content
 * (blog articles, guides, resource pages, location pages with editorial content).
 * Lower threshold than strict "blog post" detection.
 */
function detectContentSignals(html) {
  let score = 0;

  // Strong signals (2 points)
  if (/<article[\s>]/i.test(html)) score += 2;
  if (/"@type"\s*:\s*"(BlogPosting|Article|NewsArticle|WebPage)"/i.test(html)) score += 2;

  // Medium signals (1 point each)
  if (/class=["'][^"']*(?:post|article|blog|entry|content)[\s-"']/i.test(html)) score += 1;
  if (/<time[\s>]/i.test(html)) score += 1;
  if (/(?:published|posted|written|updated)\s*(?:on|at|:)/i.test(html.toLowerCase())) score += 1;
  if (/(?:author|by)\s*[:]/i.test(html.toLowerCase())) score += 1;
  if (/class=["'][^"']*author/i.test(html)) score += 1;

  // Content structure signals
  const h2Count = (html.match(/<h2[\s>]/gi) || []).length;
  if (h2Count >= 2) score += 1;
  if (h2Count >= 5) score += 1;

  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ');
  const wordCount = bodyText.split(' ').filter(w => w.length > 1).length;

  if (wordCount > 200) score += 1;
  if (wordCount > 500) score += 1;
  if (wordCount > 1000) score += 1;

  // Has an H1 (editorial content typically has a clear headline)
  if (/<h1[\s>]/i.test(html)) score += 1;

  // Tables or lists (data-rich content pages)
  if ((html.match(/<table[\s>]/gi) || []).length >= 1) score += 1;
  if ((html.match(/<(?:ul|ol)[\s>]/gi) || []).length >= 2) score += 1;

  // Threshold of 2 — very permissive: if a page has substantial text + any structure, include it
  return score >= 2;
}

/* ------------------------------------------------------------------ */
/*  Meta Data Fetching                                                 */
/* ------------------------------------------------------------------ */

async function fetchMetaData(url) {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });
    if (!resp.ok) return null;
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let html = '';
    while (html.length < 50000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    reader.cancel().catch(() => {});

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';
    const metaDescMatch =
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i) ||
      html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i);
    const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : '';
    return { title, metaDescription };
  } catch {
    return null;
  }
}
