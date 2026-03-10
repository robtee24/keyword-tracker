import { getSupabase } from '../db.js';
import { authenticateRequest } from '../_config.js';
import { getBrandContext } from '../_brand.js';

export const config = { maxDuration: 120 };

async function callClaude(systemPrompt, userMessage, maxTokens = 16000, retries = 2) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) console.log(`[BlogRewrite] Retry attempt ${attempt}/${retries}`);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 100000);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const detail = await response.text().catch(() => 'unknown');
        throw new Error(`Claude API error (${response.status}): ${detail}`);
      }

      const data = await response.json();
      return data.content?.[0]?.text || '';
    } catch (err) {
      lastError = err;
      const msg = err.name === 'AbortError' ? 'Claude API timed out after 100s' : err.message;
      console.error(`[BlogRewrite] Attempt ${attempt + 1} failed: ${msg}`);
      if (attempt < retries && (err.name === 'AbortError' || /fetch failed|ECONNRESET|ETIMEDOUT/i.test(err.message))) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      throw new Error(msg);
    }
  }
  throw lastError;
}

async function crawlPage(url) {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    if (!resp.ok) return null;
    const html = await resp.text();

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

    const metaDescMatch =
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i) ||
      html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i);
    const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : '';

    const bodyHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '');

    const headings = [];
    const hRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
    let hMatch;
    while ((hMatch = hRegex.exec(bodyHtml)) !== null) {
      headings.push({ level: parseInt(hMatch[1]), text: hMatch[2].replace(/<[^>]*>/g, '').trim() });
    }

    const bodyText = bodyHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = bodyText.split(' ').filter(w => w.length > 1).length;

    return { title, metaDescription, headings, bodyText: bodyText.slice(0, 12000), wordCount, html: bodyHtml.slice(0, 30000) };
  } catch {
    return null;
  }
}

const REWRITE_SYSTEM_PROMPT = `You are an elite content rewriter and SEO strategist. Your job is to take an existing blog post and completely rewrite it to be dramatically better in every dimension: content quality, SEO, AI search optimization, conversion, and engagement.

You combine expertise in: content strategy, conversion copywriting, SEO, AI search optimization (AEO/GEO), marketing psychology, and page CRO.

═══════════════════════════════════════════════════
REWRITING PRINCIPLES
═══════════════════════════════════════════════════
- PRESERVE the core topic and intent but ELEVATE the quality dramatically
- ADD original insights, frameworks, statistics, and expert-level depth the original lacks
- IMPROVE structure: clear H2/H3 hierarchy, scannable formatting, logical flow
- ENHANCE SEO: better keyword usage, internal linking, featured snippet optimization
- BOOST engagement: stronger hooks, better storytelling, psychology-driven copywriting
- OPTIMIZE for AI citation: self-contained answer blocks, definition paragraphs, data-rich sections

═══════════════════════════════════════════════════
INTERLINKING STRATEGY (CRITICAL)
═══════════════════════════════════════════════════
- Link to OTHER blog posts from the same site where contextually relevant
- Link to relevant website pages (pricing, features, product pages)
- Use natural, descriptive anchor text — never "click here"
- Distribute 5-10 internal links throughout the article
- Every link should genuinely help the reader find related information
- Prioritize links that keep readers on-site and guide them toward conversion

═══════════════════════════════════════════════════
HARD RULES
═══════════════════════════════════════════════════
- NEVER mention a competitor in a positive or neutral-positive light
- ALWAYS include real internal links in the HTML content
- Every section must earn its place — zero filler content
- Write 2000-3000 words of substantive, original content
- The rewrite must be SIGNIFICANTLY better than the original — not just rephrased`;

/**
 * POST /api/blog/rewrite
 * Crawls an existing blog post and completely rewrites it.
 *
 * Body: { siteUrl, projectId, postUrl, blogRootPath, sitePages?, otherPostUrls? }
 * Returns: { blog: { title, subtitle, author, ... } }
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const { siteUrl, projectId, postUrl, blogRootPath, sitePages: providedPages, otherPostUrls } = req.body || {};
  if (!siteUrl || !postUrl) return res.status(400).json({ error: 'siteUrl and postUrl are required' });

  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });

  try {
    const crawled = await crawlPage(postUrl);
    if (!crawled) {
      return res.status(400).json({ error: 'Failed to crawl the blog post. The page may be inaccessible.' });
    }

    let sitePages = providedPages || [];
    if (sitePages.length === 0) {
      try {
        const base = siteUrl.endsWith('/') ? siteUrl : siteUrl + '/';
        for (const path of ['sitemap.xml', 'sitemap_index.xml', 'wp-sitemap.xml']) {
          const sitemapResp = await fetch(`${base}${path}`, {
            headers: { 'User-Agent': 'SEAUTO-AuditBot/1.0' },
            signal: AbortSignal.timeout(8000),
          });
          if (!sitemapResp.ok) continue;
          const xml = await sitemapResp.text();
          const locs = [...xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)].map(m => m[1]);
          if (locs.length > 0) { sitePages = locs.slice(0, 150); break; }
        }
      } catch { /* non-critical */ }
    }

    const blogPostLinks = otherPostUrls?.slice(0, 50) || [];
    const nonBlogPages = sitePages.filter(p => !blogRootPath || !new URL(p).pathname.startsWith(blogRootPath));

    const brandContext = await getBrandContext(projectId);

    const userMessage = `COMPLETELY REWRITE this blog post. Make it dramatically better in every way.

WEBSITE: ${siteUrl}
POST URL: ${postUrl}
${brandContext ? `\nBRAND CONTEXT:\n${brandContext}\n` : ''}
═══════════════════════════════════════════════════
ORIGINAL POST CONTENT
═══════════════════════════════════════════════════
Title: ${crawled.title}
Meta Description: ${crawled.metaDescription}
Word Count: ${crawled.wordCount}
Headings: ${crawled.headings.map(h => `${'#'.repeat(h.level)} ${h.text}`).join('\n')}

Body Text:
${crawled.bodyText}

═══════════════════════════════════════════════════
INTERLINKING RESOURCES
═══════════════════════════════════════════════════
OTHER BLOG POSTS ON THIS SITE (link to relevant ones):
${blogPostLinks.length > 0 ? blogPostLinks.join('\n') : 'None available — suggest link targets in internalLinkSuggestions'}

WEBSITE PAGES (link to relevant product/feature/pricing pages):
${nonBlogPages.slice(0, 80).join('\n') || 'None available'}

═══════════════════════════════════════════════════
REQUIREMENTS
═══════════════════════════════════════════════════
1. Completely rewrite — don't just rephrase. Add depth, insights, data, and expert analysis.
2. 2000-3000 words of substantive content.
3. Include 5-10 internal links to blog posts AND website pages listed above.
4. Optimize for both traditional SEO and AI search citation.
5. Strong hook, compelling structure, clear CTAs.
6. FAQ section at the end with 4-6 questions.

Respond with ONLY valid JSON:
{
  "title": "<SEO-optimized title>",
  "subtitle": "<supporting subtitle under 120 chars>",
  "author": "<infer from site or use 'Editorial Team'>",
  "metaDescription": "<under 155 chars with keyword + benefit>",
  "slug": "<url-friendly-slug>",
  "content": "<full rewritten blog in clean semantic HTML — no <h1>, no <html>/<head>/<body> wrappers>",
  "wordCount": <number>,
  "suggestedImages": [{"description": "<detailed image description>", "caption": "<caption>", "placement": "<after which H2>"}],
  "internalLinkSuggestions": ["<pages that should link back to this article>"],
  "changes": "<brief summary of what was changed and improved>"
}`;

    let raw = await callClaude(REWRITE_SYSTEM_PROMPT, userMessage, 16000);
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let blog;
    try {
      blog = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) blog = JSON.parse(jsonMatch[0]);
      else throw new Error('Failed to parse AI response');
    }

    const supabase = getSupabase();
    if (supabase && projectId) {
      const { data: article } = await supabase.from('blog_articles')
        .insert({
          project_id: projectId,
          site_url: siteUrl,
          title: blog.title || crawled.title,
          subtitle: blog.subtitle || '',
          author: blog.author || 'Editorial Team',
          slug: blog.slug || '',
          meta_description: blog.metaDescription || '',
          content: blog.content || '',
          word_count: blog.wordCount || 0,
          internal_link_suggestions: blog.internalLinkSuggestions || [],
          suggested_images: blog.suggestedImages || [],
          images: [],
          source: 'rewrite',
          status: 'draft',
        })
        .select()
        .single();

      blog.articleId = article?.id || null;

      // Mark the post as rewritten in blog_discoveries
      const { data: discovery } = await supabase
        .from('blog_discoveries')
        .select('posts')
        .eq('project_id', projectId)
        .eq('site_url', siteUrl)
        .eq('root_path', blogRootPath || '')
        .maybeSingle();

      if (discovery?.posts) {
        const updatedPosts = discovery.posts.map(p => {
          if (p.url === postUrl) {
            return { ...p, rewrittenAt: new Date().toISOString(), articleId: article?.id };
          }
          return p;
        });
        await supabase
          .from('blog_discoveries')
          .update({ posts: updatedPosts })
          .eq('project_id', projectId)
          .eq('site_url', siteUrl)
          .eq('root_path', blogRootPath || '');
      }
    }

    return res.status(200).json({ blog });
  } catch (err) {
    console.error('[BlogRewrite] Error:', err.message);
    const friendly = /fetch failed|ECONNRESET|ETIMEDOUT/i.test(err.message)
      ? 'Connection to AI service failed. Please try again.'
      : err.message;
    return res.status(500).json({ error: friendly });
  }
}
