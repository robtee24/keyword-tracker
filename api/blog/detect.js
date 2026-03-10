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
    const functionStart = Date.now();
    const timeLeft = () => 110000 - (Date.now() - functionStart);

    // 1. Collect URLs from sitemaps
    const allUrls = await collectAllSitemapUrls(crawlUrl);
    console.log(`[BlogDetect] Sitemap crawl done in ${Date.now() - functionStart}ms, found ${allUrls.length} URLs`);
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
    console.log(`[BlogDetect] Found ${clusters.length} clusters: ${clusters.map(c => `${c.rootPath}(${c.posts.length},known=${c.isKnownBlog})`).join(', ')}`);

    // 4. Sample-crawl unknown clusters IN PARALLEL
    const verifiedBlogs = clusters.filter(c => c.isKnownBlog);
    const unknownClusters = clusters.filter(c => !c.isKnownBlog);

    if (unknownClusters.length > 0 && timeLeft() > 15000) {
      const verifyResults = await Promise.allSettled(
        unknownClusters.map(async (cluster) => {
          const isBlog = await verifySampleIsBlog(cluster.sampleUrl);
          console.log(`[BlogDetect] Verify ${cluster.rootPath}: ${isBlog ? 'IS blog' : 'NOT blog'} (sample: ${cluster.sampleUrl})`);
          return { cluster, isBlog };
        })
      );
      for (const r of verifyResults) {
        if (r.status === 'fulfilled' && r.value.isBlog) {
          verifiedBlogs.push(r.value.cluster);
        }
      }
    }
    console.log(`[BlogDetect] Verified blogs: ${verifiedBlogs.map(b => b.rootPath).join(', ')} | timeLeft=${timeLeft()}ms`);

    // 5. Build blog objects — fetch meta data for ALL blogs in PARALLEL
    const metaLimit = (postCount) => postCount > 100 ? 15 : postCount > 50 ? 25 : 40;
    const blogResults = await Promise.allSettled(
      verifiedBlogs.map(async (blog) => {
        const limit = metaLimit(blog.posts.length);
        const postsWithMeta = [];
        const metaBatch = blog.posts.slice(0, limit);

        // Fetch meta in concurrent batches of 10
        for (let mi = 0; mi < metaBatch.length; mi += 10) {
          if (timeLeft() < 20000) break; // stop fetching meta if running low on time
          const slice = metaBatch.slice(mi, mi + 10);
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
        // Add remaining posts without meta
        for (let i = postsWithMeta.length; i < blog.posts.length; i++) {
          postsWithMeta.push({ url: blog.posts[i].url, title: '', metaDescription: '' });
        }
        return { rootPath: blog.rootPath, name: blog.name, postCount: blog.posts.length, posts: postsWithMeta };
      })
    );

    const blogs = blogResults
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    // 6. Fetch GSC data for ALL blogs in PARALLEL
    let gscData = {};
    const gscTimeLeft = timeLeft();
    console.log(`[BlogDetect] GSC phase starting, timeLeft=${gscTimeLeft}ms, blogs=${blogs.length}`);
    if (gscTimeLeft > 10000) {
      try {
        const accessToken = await getServiceToken(auth.user.id, siteUrl, 'google_search_console');
        console.log(`[BlogDetect] GSC accessToken: ${accessToken ? 'found' : 'NOT FOUND'}`);
        if (accessToken) {
          const endDate = new Date().toISOString().slice(0, 10);
          const startDate = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);

          const gscResults = await Promise.allSettled(
            blogs.map(blog => fetchBlogGscBulk(accessToken, siteUrl, blog.rootPath, blog.posts, startDate, endDate))
          );

          for (let bi = 0; bi < blogs.length; bi++) {
            const r = gscResults[bi];
            if (r.status !== 'fulfilled') {
              console.error(`[BlogDetect] GSC for ${blogs[bi].rootPath} rejected:`, r.reason?.message || r.reason);
              continue;
            }
            const blogGsc = r.value;
            const gscUrlCount = Object.keys(blogGsc).length;
            console.log(`[BlogDetect] GSC for ${blogs[bi].rootPath}: ${gscUrlCount} URLs with data`);
            Object.assign(gscData, blogGsc);

            blogs[bi].posts = blogs[bi].posts.map(p => {
              const normalized = normalizeUrlForMatch(p.url);
              const match = blogGsc[p.url] || blogGsc[normalized];
              const byPath = !match ? findByPath(blogGsc, p.url) : null;
              return { ...p, gscData: match || byPath || { totalClicks: 0, totalImpressions: 0, keywords: [] } };
            });
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
        console.error('[BlogDetect] GSC fetch failed (non-fatal):', gscErr.message, gscErr.stack);
      }
    } else {
      console.warn(`[BlogDetect] SKIPPING GSC — only ${gscTimeLeft}ms left (need >10000)`);
    }

    // 7. Save to database
    const supabase = getSupabase();
    if (supabase && projectId) {
      await Promise.allSettled(
        blogs.map(blog =>
          supabase
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
            }, { onConflict: 'project_id,site_url,root_path' })
        )
      );
    }

    const gscPostsWithData = blogs.reduce((sum, b) => sum + b.posts.filter(p => p.gscData?.totalClicks > 0 || p.gscData?.totalImpressions > 0).length, 0);
    const totalPosts = blogs.reduce((sum, b) => sum + b.posts.length, 0);
    console.log(`[BlogDetect] Done. ${blogs.length} blogs, ${totalPosts} posts, ${gscPostsWithData} with GSC data. Took ${Date.now() - functionStart}ms`);

    return res.status(200).json({ blogs, totalUrls: parsedUrls.length, crawledAt: new Date().toISOString() });
  } catch (error) {
    console.error('[BlogDetect] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to detect blogs' });
  }
}

/* ------------------------------------------------------------------ */
/*  GSC Bulk Fetch — tries 'contains' filter, falls back to per-URL   */
/* ------------------------------------------------------------------ */

async function fetchBlogGscBulk(accessToken, siteUrl, rootPath, posts, startDate, endDate) {
  const apiUrl = `${API_CONFIG.googleSearchConsole.baseUrl}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const pageData = {};
  const fetchStart = Date.now();
  const MAX_GSC_TIME = 30000;

  // Strategy 1: Bulk fetch using 'contains' filter (simpler, more reliable than regex)
  console.log(`[GSC Bulk] Fetching for rootPath="${rootPath}" using 'contains' filter`);
  let bulkSuccess = false;
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate, endDate,
        dimensions: ['page', 'query'],
        dimensionFilterGroups: [{
          filters: [{ dimension: 'page', operator: 'contains', expression: rootPath }],
        }],
        rowLimit: 25000,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error(`[GSC Bulk] 'contains' API error ${response.status}: ${errBody.substring(0, 500)}`);
    } else {
      const data = await response.json();
      const rows = data.rows || [];
      console.log(`[GSC Bulk] 'contains' returned ${rows.length} rows for rootPath="${rootPath}"`);

      for (const row of rows) {
        const pageUrl = row.keys?.[0] || '';
        const keyword = row.keys?.[1] || '';
        if (!pageUrl) continue;
        if (!pageData[pageUrl]) {
          pageData[pageUrl] = { totalClicks: 0, totalImpressions: 0, keywords: [] };
        }
        pageData[pageUrl].totalClicks += row.clicks || 0;
        pageData[pageUrl].totalImpressions += row.impressions || 0;
        pageData[pageUrl].keywords.push({
          keyword, clicks: row.clicks || 0, impressions: row.impressions || 0,
          position: Math.round((row.position || 0) * 10) / 10,
        });
      }

      if (rows.length > 0) bulkSuccess = true;

      // Paginate if needed
      if (rows.length === 25000 && (Date.now() - fetchStart) < MAX_GSC_TIME) {
        try {
          const resp2 = await fetch(apiUrl, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startDate, endDate,
              dimensions: ['page', 'query'],
              dimensionFilterGroups: [{
                filters: [{ dimension: 'page', operator: 'contains', expression: rootPath }],
              }],
              rowLimit: 25000,
              startRow: 25000,
            }),
            signal: AbortSignal.timeout(20000),
          });
          if (resp2.ok) {
            const d2 = await resp2.json();
            for (const row of (d2.rows || [])) {
              const pageUrl = row.keys?.[0] || '';
              const keyword = row.keys?.[1] || '';
              if (!pageUrl) continue;
              if (!pageData[pageUrl]) {
                pageData[pageUrl] = { totalClicks: 0, totalImpressions: 0, keywords: [] };
              }
              pageData[pageUrl].totalClicks += row.clicks || 0;
              pageData[pageUrl].totalImpressions += row.impressions || 0;
              pageData[pageUrl].keywords.push({
                keyword, clicks: row.clicks || 0, impressions: row.impressions || 0,
                position: Math.round((row.position || 0) * 10) / 10,
              });
            }
          }
        } catch (e) {
          console.error('[GSC Bulk] Pagination error:', e.message);
        }
      }
    }
  } catch (err) {
    console.error('[GSC Bulk] contains fetch error:', err.message);
  }

  // Strategy 2: If bulk returned nothing, try per-URL fetches for first 20 posts
  if (!bulkSuccess && posts.length > 0 && (Date.now() - fetchStart) < MAX_GSC_TIME) {
    console.log(`[GSC Bulk] Falling back to per-URL fetch for ${Math.min(posts.length, 20)} posts`);
    const subset = posts.slice(0, 20);
    const perUrlResults = await Promise.allSettled(
      subset.map(p => fetchSinglePageGsc(accessToken, apiUrl, p.url, startDate, endDate))
    );
    for (let i = 0; i < subset.length; i++) {
      const r = perUrlResults[i];
      if (r.status === 'fulfilled' && r.value) {
        pageData[subset[i].url] = r.value;
      }
    }
    console.log(`[GSC Bulk] Per-URL fallback got data for ${Object.keys(pageData).length} URLs`);
  }

  for (const url of Object.keys(pageData)) {
    pageData[url].keywords.sort((a, b) => b.clicks - a.clicks);
  }

  console.log(`[GSC Bulk] Final: ${Object.keys(pageData).length} URLs with data for rootPath="${rootPath}" (${Date.now() - fetchStart}ms)`);
  return pageData;
}

async function fetchSinglePageGsc(accessToken, apiUrl, pageUrl, startDate, endDate) {
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate, endDate,
        dimensions: ['query'],
        dimensionFilterGroups: [{
          filters: [{ dimension: 'page', operator: 'equals', expression: pageUrl }],
        }],
        rowLimit: 5000,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const rows = data.rows || [];
    if (rows.length === 0) return null;

    const result = { totalClicks: 0, totalImpressions: 0, keywords: [] };
    for (const row of rows) {
      result.totalClicks += row.clicks || 0;
      result.totalImpressions += row.impressions || 0;
      result.keywords.push({
        keyword: row.keys?.[0] || '', clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        position: Math.round((row.position || 0) * 10) / 10,
      });
    }
    return result;
  } catch { return null; }
}

function normalizeUrlForMatch(url) {
  try {
    const u = new URL(url);
    // Toggle www
    if (u.hostname.startsWith('www.')) {
      u.hostname = u.hostname.replace(/^www\./, '');
    } else {
      u.hostname = 'www.' + u.hostname;
    }
    return u.href;
  } catch { return url; }
}

function findByPath(gscData, postUrl) {
  try {
    const targetPath = new URL(postUrl).pathname.replace(/\/+$/, '');
    for (const [gscUrl, data] of Object.entries(gscData)) {
      const gscPath = new URL(gscUrl).pathname.replace(/\/+$/, '');
      if (gscPath === targetPath) return data;
    }
  } catch { /* ignore */ }
  return null;
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
