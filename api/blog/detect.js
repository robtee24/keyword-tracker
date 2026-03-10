import { authenticateRequest } from '../_config.js';
import { getSupabase } from '../db.js';

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

const BLOG_LIKE_SIGNALS_THRESHOLD = 3;

/**
 * POST /api/blog/detect
 * Deep-crawls sitemaps, groups URLs into blog sections using path frequency
 * analysis, and sample-crawls ambiguous paths to verify they are blogs.
 *
 * Body: { siteUrl, projectId }
 * Returns: { blogs: [{ rootPath, name, postCount, posts: [{ url, title, metaDescription }] }] }
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  let { siteUrl, projectId } = req.body || {};
  if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });
  if (!siteUrl.endsWith('/')) siteUrl += '/';

  try {
    // 1. Collect ALL URLs from sitemaps (recursive)
    const allUrls = await collectAllSitemapUrls(siteUrl);
    if (allUrls.length === 0) {
      return res.status(200).json({ blogs: [], totalUrls: 0 });
    }

    const baseHostname = new URL(siteUrl).hostname;

    // 2. Parse all URLs into path segments
    const parsedUrls = [];
    for (const url of allUrls) {
      try {
        const parsed = new URL(url);
        if (parsed.hostname !== baseHostname) continue;
        const path = parsed.pathname;
        if (EXCLUDED_PREFIXES.some(p => path.toLowerCase().startsWith(p))) continue;
        parsedUrls.push({ url, path });
      } catch { continue; }
    }

    // 3. Group URLs by path prefix and identify blog clusters
    const clusters = identifyBlogClusters(parsedUrls, siteUrl);

    // 4. For ambiguous clusters, sample-crawl to verify blog-like content
    const verifiedBlogs = [];
    for (const cluster of clusters) {
      if (cluster.isKnownBlog) {
        verifiedBlogs.push(cluster);
      } else {
        const isBlog = await verifySampleIsBlog(cluster.sampleUrl);
        if (isBlog) {
          verifiedBlogs.push(cluster);
        }
      }
    }

    // 5. For each verified blog, extract meta data from a few posts
    const blogs = [];
    for (const blog of verifiedBlogs) {
      const postsWithMeta = [];
      const metaBatch = blog.posts.slice(0, 100);
      const metaResults = await Promise.allSettled(
        metaBatch.map(p => fetchMetaData(p.url))
      );
      for (let i = 0; i < metaBatch.length; i++) {
        const r = metaResults[i];
        if (r.status === 'fulfilled' && r.value) {
          postsWithMeta.push({ url: metaBatch[i].url, ...r.value });
        } else {
          postsWithMeta.push({ url: metaBatch[i].url, title: '', metaDescription: '' });
        }
      }
      // Add remaining posts without meta (they'll be fetched lazily)
      for (let i = 100; i < blog.posts.length; i++) {
        postsWithMeta.push({ url: blog.posts[i].url, title: '', metaDescription: '' });
      }

      blogs.push({
        rootPath: blog.rootPath,
        name: blog.name,
        postCount: blog.posts.length,
        posts: postsWithMeta,
      });
    }

    // 6. Save to database
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
            crawled_at: new Date().toISOString(),
          }, { onConflict: 'project_id,site_url,root_path' });
      }
    }

    return res.status(200).json({
      blogs,
      totalUrls: parsedUrls.length,
      crawledAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[BlogDetect] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to detect blogs' });
  }
}

/* ------------------------------------------------------------------ */
/*  Sitemap Crawling (recursive, handles indexes)                     */
/* ------------------------------------------------------------------ */

async function collectAllSitemapUrls(siteUrl) {
  const candidates = [
    `${siteUrl}sitemap.xml`,
    `${siteUrl}sitemap_index.xml`,
    `${siteUrl}sitemap-index.xml`,
    `${siteUrl}wp-sitemap.xml`,
  ];

  for (const candidate of candidates) {
    try {
      const resp = await fetch(candidate, {
        headers: { 'User-Agent': 'SEAUTO-BlogBot/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) continue;
      const xml = await resp.text();
      if (!xml.includes('<urlset') && !xml.includes('<sitemapindex')) continue;

      const urls = await resolveAllUrls(xml);
      if (urls.length > 0) return [...new Set(urls)];
    } catch { continue; }
  }
  return [];
}

async function resolveAllUrls(xml) {
  if (xml.includes('<sitemapindex')) {
    const childSitemapUrls = extractLocs(xml, true);
    const allPageUrls = [];

    const batchSize = 10;
    for (let i = 0; i < childSitemapUrls.length; i += batchSize) {
      const batch = childSitemapUrls.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (url) => {
          try {
            const resp = await fetch(url, {
              headers: { 'User-Agent': 'SEAUTO-BlogBot/1.0' },
              signal: AbortSignal.timeout(15000),
            });
            if (!resp.ok) return [];
            const childXml = await resp.text();
            if (childXml.includes('<sitemapindex')) {
              return await resolveAllUrls(childXml);
            }
            return extractLocs(childXml, false);
          } catch { return []; }
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled') allPageUrls.push(...r.value);
      }
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
/*  Blog Cluster Identification (path frequency analysis)             */
/* ------------------------------------------------------------------ */

function identifyBlogClusters(parsedUrls, siteUrl) {
  const prefixGroups = new Map();

  for (const { url, path } of parsedUrls) {
    const segments = path.split('/').filter(Boolean);
    if (segments.length < 2) continue;

    const prefix = '/' + segments[0];
    if (!prefixGroups.has(prefix)) {
      prefixGroups.set(prefix, []);
    }
    prefixGroups.get(prefix).push({ url, path });
  }

  // Also check two-level prefixes for nested blogs like /resources/blog
  for (const { url, path } of parsedUrls) {
    const segments = path.split('/').filter(Boolean);
    if (segments.length < 3) continue;

    const prefix = '/' + segments[0] + '/' + segments[1];
    if (!prefixGroups.has(prefix)) {
      prefixGroups.set(prefix, []);
    }
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
        clusters.push({
          rootPath: pattern,
          name: name.charAt(0).toUpperCase() + name.slice(1),
          posts,
          sampleUrl: posts[0]?.url,
          isKnownBlog: true,
        });
      }
    }
  }

  // Pass 2: unknown clusters with 5+ child URLs (potential blogs)
  for (const [prefix, items] of prefixGroups) {
    if (KNOWN_BLOG_PATTERNS.includes(prefix)) continue;
    if (EXCLUDED_PREFIXES.some(ex => prefix.toLowerCase().startsWith(ex))) continue;

    const posts = items
      .filter(p => p.path !== prefix && p.path !== prefix + '/')
      .filter(p => !usedUrls.has(p.url));

    if (posts.length >= 5) {
      // Check if URLs follow a content-like pattern (not deep nesting, no query params in path)
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
/*  Sample Crawl Verification                                         */
/* ------------------------------------------------------------------ */

async function verifySampleIsBlog(url) {
  if (!url) return false;
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });
    if (!resp.ok) return false;
    const html = await resp.text();
    return detectBlogSignals(html);
  } catch {
    return false;
  }
}

function detectBlogSignals(html) {
  let score = 0;
  const lower = html.toLowerCase();

  if (/<article[\s>]/i.test(html)) score += 2;
  if (/"@type"\s*:\s*"(BlogPosting|Article|NewsArticle)"/i.test(html)) score += 2;
  if (/class=["'][^"']*(?:post|article|blog|entry)[\s-]/i.test(html)) score += 1;
  if (/<time[\s>]/i.test(html)) score += 1;
  if (/(?:published|posted|written|updated)\s*(?:on|at|:)/i.test(lower)) score += 1;
  if (/(?:author|by)\s*[:]/i.test(lower)) score += 1;
  if (/class=["'][^"']*author/i.test(html)) score += 1;

  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ');
  const wordCount = bodyText.split(' ').filter(w => w.length > 1).length;
  if (wordCount > 300) score += 1;
  if (wordCount > 800) score += 1;

  return score >= BLOG_LIKE_SIGNALS_THRESHOLD;
}

/* ------------------------------------------------------------------ */
/*  Meta Data Fetching                                                */
/* ------------------------------------------------------------------ */

async function fetchMetaData(url) {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(6000),
      redirect: 'follow',
    });
    if (!resp.ok) return null;
    // Only read the first 50KB for meta extraction
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
