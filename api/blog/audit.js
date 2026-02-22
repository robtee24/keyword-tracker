import { getSupabase } from '../db.js';

export const config = { maxDuration: 120 };

const BLOG_AUDIT_PROMPT = `You are an expert blog and content marketing strategist. Analyze this blog post holistically for quality, SEO, engagement, and conversion potential.

EVALUATE CONTENT QUALITY:
- Headline effectiveness (curiosity, clarity, benefit, emotional pull, SEO keyword placement)
- Introduction hook (does it grab attention in the first 2 sentences?)
- Content depth and originality (unique insights, data, expert opinion vs generic advice)
- Structure and readability (subheadings, short paragraphs, bullet points, white space)
- Writing quality (grammar, flow, voice consistency, jargon level for target audience)
- Content length appropriateness (too thin for topic? unnecessarily padded?)
- Call-to-action presence and strength

EVALUATE BLOG SEO:
- Title tag and H1 optimization for target keyword
- Meta description quality (compelling, keyword-rich, within 155 chars)
- URL slug quality (short, keyword-rich, no dates or IDs)
- Header hierarchy (H2s, H3s with keyword variations)
- Internal linking (links to related posts, pillar pages, product/service pages)
- External linking (authoritative sources, data citations)
- Image optimization (alt text, file names, compression, featured image)
- Schema markup (Article/BlogPosting schema)
- Keyword density and natural usage

EVALUATE ENGAGEMENT:
- Visual elements (images, infographics, embedded videos, charts)
- Interactive elements (polls, quizzes, calculators, expandable sections)
- Social sharing enablement (share buttons, tweetable quotes)
- Comment section availability
- Related posts / recommended reading

EVALUATE CONVERSION:
- Lead capture opportunities (content upgrades, newsletter signup, gated content)
- Product/service mentions (natural integration, not forced)
- Trust signals within content (testimonials, case studies, data points)
- Next-step clarity (what should the reader do after reading?)

SCORING: Rate 0-100 based on overall blog post effectiveness.`;

const BLOG_OVERVIEW_PROMPT = `You are an expert blog strategist and content marketing consultant. Analyze this blog as a whole and provide strategic recommendations.

EVALUATE BLOG STRATEGY:
- Content pillar coverage (are topics organized around key themes?)
- Publishing frequency and consistency
- Topic diversity vs focus balance
- Content funnel coverage (awareness → consideration → decision)
- Keyword coverage gaps (topics not yet covered that should be)

EVALUATE BLOG ARCHITECTURE:
- Category/tag structure effectiveness
- Internal linking between posts (content cluster strategy)
- Navigation and discoverability
- Archive and pagination usability
- Featured/pinned content strategy

EVALUATE CONTENT MIX:
- Post types (how-to, listicle, case study, comparison, opinion, data-driven)
- Content length distribution (mix of short and long-form)
- Evergreen vs time-sensitive content ratio
- User-generated content or guest posts

EVALUATE GROWTH POTENTIAL:
- SEO opportunities (keywords with ranking potential)
- Content gap analysis (what competitors cover that this blog doesn't)
- Repurposing opportunities (posts that could become videos, infographics, etc.)
- Content update candidates (outdated posts worth refreshing)

Provide both individual post-level and blog-wide recommendations.

SCORING: Rate 0-100 based on overall blog strategy and execution.`;

const RESPONSE_FORMAT = `
Respond with ONLY valid JSON in this format:
{
  "score": <number 0-100>,
  "summary": "<2-3 sentence overview>",
  "strengths": ["<3-5 bullet points>"],
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "category": "<short category name>",
      "issue": "<EXACT problem — reference specific element/text/code>",
      "recommendation": "<EXACT fix — specific text, code, or action>",
      "howToFix": "<step-by-step implementation instructions>",
      "impact": "<expected improvement>"
    }
  ]
}

CRITICAL RULES:
- Every recommendation MUST reference a specific element (e.g., "The H1 'Our Blog' is generic" not "Improve headings")
- Every recommendation MUST provide an exact fix
- howToFix MUST contain step-by-step instructions
- NEVER give vague advice like "post more often" or "improve SEO"
- Return 5-15 recommendations sorted by priority (high first)
- Return 3-5 strengths`;

/**
 * POST /api/blog/audit
 * { siteUrl, blogUrl, mode: 'single' | 'full' }
 *
 * single: audits a single blog post
 * full: crawls all posts under blogUrl and audits each + overall blog strategy
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { siteUrl, blogUrl, mode = 'single' } = req.body || {};
  if (!siteUrl || !blogUrl) {
    return res.status(400).json({ error: 'siteUrl and blogUrl are required' });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
  }

  if (mode === 'single') {
    return await auditSinglePost(req, res, siteUrl, blogUrl, openaiKey);
  }

  return await auditFullBlog(req, res, siteUrl, blogUrl, openaiKey);
}

async function auditSinglePost(req, res, siteUrl, blogUrl, apiKey) {
  let content;
  try {
    content = await fetchBlogContent(blogUrl);
  } catch (err) {
    return res.status(200).json({
      blogUrl, mode: 'single', score: 0, recommendations: [],
      error: `Failed to fetch: ${err.message}`,
    });
  }

  const result = await runBlogAudit(apiKey, blogUrl, content, BLOG_AUDIT_PROMPT);

  const supabase = getSupabase();
  if (supabase) {
    await saveBlogAudit(supabase, siteUrl, blogUrl, 'single', result);
  }

  return res.status(200).json({
    blogUrl, mode: 'single', ...result,
  });
}

async function auditFullBlog(req, res, siteUrl, blogRootUrl, apiKey) {
  let blogPostUrls = [];
  try {
    blogPostUrls = await discoverBlogPosts(siteUrl, blogRootUrl);
  } catch (err) {
    return res.status(200).json({
      blogUrl: blogRootUrl, mode: 'full', score: 0, recommendations: [],
      error: `Failed to discover blog posts: ${err.message}`,
    });
  }

  if (blogPostUrls.length === 0) {
    return res.status(200).json({
      blogUrl: blogRootUrl, mode: 'full', score: 0,
      recommendations: [],
      error: 'No blog posts found under this URL.',
    });
  }

  const maxPosts = Math.min(blogPostUrls.length, 20);
  const postsToAudit = blogPostUrls.slice(0, maxPosts);

  const postResults = [];
  const batchSize = 5;
  for (let i = 0; i < postsToAudit.length; i += batchSize) {
    const batch = postsToAudit.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(async (url) => {
        try {
          const content = await fetchBlogContent(url);
          const result = await runBlogAudit(apiKey, url, content, BLOG_AUDIT_PROMPT);
          return { url, ...result };
        } catch (err) {
          return { url, score: 0, summary: '', strengths: [], recommendations: [], error: err.message };
        }
      })
    );
    for (const r of batchResults) {
      postResults.push(r.status === 'fulfilled' ? r.value : { url: '', score: 0, error: 'Promise rejected' });
    }
  }

  let overviewResult = { score: 0, summary: '', strengths: [], recommendations: [] };
  try {
    const overviewContext = buildOverviewContext(blogRootUrl, postResults);
    overviewResult = await runBlogAudit(apiKey, blogRootUrl, overviewContext, BLOG_OVERVIEW_PROMPT, true);
  } catch (err) {
    console.error('[BlogAudit] Overview audit failed:', err.message);
  }

  const supabase = getSupabase();
  if (supabase) {
    for (const post of postResults) {
      if (post.url && !post.error) {
        await saveBlogAudit(supabase, siteUrl, post.url, 'single', post);
      }
    }
    await saveBlogAudit(supabase, siteUrl, blogRootUrl, 'overview', overviewResult);
  }

  return res.status(200).json({
    blogUrl: blogRootUrl,
    mode: 'full',
    overview: overviewResult,
    posts: postResults,
    totalPosts: blogPostUrls.length,
    auditedPosts: maxPosts,
  });
}

async function discoverBlogPosts(siteUrl, blogRootUrl) {
  if (!siteUrl.endsWith('/')) siteUrl += '/';
  const sitemapCandidates = [
    `${siteUrl}sitemap.xml`, `${siteUrl}sitemap_index.xml`, `${siteUrl}sitemap-index.xml`,
  ];
  let allUrls = [];
  for (const candidate of sitemapCandidates) {
    try {
      const resp = await fetch(candidate, {
        headers: { 'User-Agent': 'SEAUTO-BlogBot/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) continue;
      const xml = await resp.text();
      if (xml.includes('<sitemapindex')) {
        const sitemapUrls = extractLocs(xml);
        const childResults = await Promise.allSettled(
          sitemapUrls.slice(0, 20).map(async (u) => {
            const r = await fetch(u, { headers: { 'User-Agent': 'SEAUTO-BlogBot/1.0' }, signal: AbortSignal.timeout(10000) });
            return r.ok ? extractLocs(await r.text()) : [];
          })
        );
        for (const r of childResults) {
          if (r.status === 'fulfilled') allUrls.push(...r.value);
        }
      } else {
        allUrls = extractLocs(xml);
      }
      if (allUrls.length > 0) break;
    } catch { continue; }
  }

  const normalizedRoot = blogRootUrl.replace(/\/$/, '');
  return allUrls.filter((u) => {
    if (u === blogRootUrl || u === normalizedRoot) return false;
    return u.startsWith(normalizedRoot + '/') || u.startsWith(normalizedRoot + '?');
  });
}

function buildOverviewContext(blogRootUrl, postResults) {
  const summaries = postResults
    .filter((p) => !p.error)
    .map((p, i) => `Post ${i + 1}: ${p.url}\n  Score: ${p.score}/100\n  Summary: ${p.summary}\n  Top issues: ${(p.recommendations || []).slice(0, 3).map((r) => r.issue).join('; ')}`)
    .join('\n\n');

  return {
    url: blogRootUrl,
    bodyText: `BLOG OVERVIEW ANALYSIS\n\nBlog root: ${blogRootUrl}\nTotal posts audited: ${postResults.length}\nAverage score: ${Math.round(postResults.reduce((s, p) => s + (p.score || 0), 0) / (postResults.length || 1))}/100\n\nINDIVIDUAL POST SUMMARIES:\n${summaries}`,
    title: 'Blog Overview',
    isOverview: true,
  };
}

async function fetchBlogContent(url) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'SEAUTO-BlogBot/1.0', Accept: 'text/html' },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const html = await resp.text();

  return {
    url,
    title: extractTag(html, 'title'),
    metaDescription: extractMeta(html, 'description'),
    headings: extractHeadings(html),
    bodyText: extractBodyText(html).substring(0, 4000),
    imageCount: (html.match(/<img[\s>]/gi) || []).length,
    imagesWithoutAlt: (html.match(/<img(?![^>]*alt=)[^>]*>/gi) || []).length,
    wordCount: extractBodyText(html).split(/\s+/).filter(Boolean).length,
    internalLinkCount: extractInternalLinks(html, url).length,
    externalLinkCount: extractExternalLinks(html, url).length,
    hasSchema: html.includes('BlogPosting') || html.includes('Article'),
    publishDate: extractMeta(html, 'article:published_time', 'property') || '',
    author: extractMeta(html, 'author') || '',
    htmlLength: html.length,
  };
}

async function runBlogAudit(apiKey, url, content, prompt, isOverview = false) {
  const pageContext = isOverview ? content.bodyText : `
BLOG POST URL: ${url}
TITLE: ${content.title || '(none)'}
META DESCRIPTION: ${content.metaDescription || '(none)'}
AUTHOR: ${content.author || '(none)'}
PUBLISH DATE: ${content.publishDate || '(none)'}
WORD COUNT: ${content.wordCount || 'unknown'}

HEADINGS:
${(content.headings || []).map((h) => `${h.level}: ${h.text}`).join('\n') || '(none)'}

BODY TEXT (first 4000 chars):
${content.bodyText || '(empty)'}

IMAGES: ${content.imageCount} total, ${content.imagesWithoutAlt} without alt text
INTERNAL LINKS: ${content.internalLinkCount}
EXTERNAL LINKS: ${content.externalLinkCount}
SCHEMA (BlogPosting/Article): ${content.hasSchema ? 'found' : 'not found'}
HTML SIZE: ${Math.round((content.htmlLength || 0) / 1024)}KB`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `${prompt}\n${RESPONSE_FORMAT}` },
        { role: 'user', content: pageContext },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => 'unknown');
    throw new Error(`OpenAI error (${response.status}): ${detail}`);
  }

  const data = await response.json();
  let raw = data.choices?.[0]?.message?.content || '';
  raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try {
    return JSON.parse(raw);
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
    }
    return { score: 0, summary: 'Failed to parse audit result', strengths: [], recommendations: [] };
  }
}

async function saveBlogAudit(supabase, siteUrl, blogUrl, auditMode, result) {
  const row = {
    site_url: siteUrl,
    blog_url: blogUrl,
    audit_mode: auditMode,
    score: result.score || 0,
    summary: result.summary || '',
    strengths: result.strengths || [],
    recommendations: result.recommendations || [],
    audited_at: new Date().toISOString(),
  };
  try {
    const { error: upsertErr } = await supabase
      .from('blog_audits')
      .upsert(row, { onConflict: 'site_url,blog_url,audit_mode' });
    if (upsertErr) {
      console.error('[BlogAudit] Upsert failed:', upsertErr.message);
      await supabase.from('blog_audits').delete()
        .eq('site_url', siteUrl).eq('blog_url', blogUrl).eq('audit_mode', auditMode);
      const { error: insertErr } = await supabase.from('blog_audits').insert(row);
      if (insertErr) console.error('[BlogAudit] Insert failed:', insertErr.message);
    }
  } catch (err) {
    console.error('[BlogAudit] DB save error:', err.message);
  }
}

function extractTag(html, tag) {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

function extractMeta(html, name, attr = 'name') {
  const m = html.match(new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${name}["']`, 'i'));
  return m ? m[1].trim() : '';
}

function extractHeadings(html) {
  const headings = [];
  const regex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    headings.push({
      level: match[1].toUpperCase(),
      text: match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    });
  }
  return headings.slice(0, 30);
}

function extractBodyText(html) {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function extractInternalLinks(html, pageUrl) {
  const base = new URL(pageUrl);
  const links = [];
  const regex = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const u = new URL(match[1], pageUrl);
      if (u.hostname === base.hostname) links.push(u.href);
    } catch { /* skip */ }
  }
  return links;
}

function extractExternalLinks(html, pageUrl) {
  const base = new URL(pageUrl);
  const links = [];
  const regex = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const u = new URL(match[1], pageUrl);
      if (u.hostname !== base.hostname && u.protocol.startsWith('http')) links.push(u.href);
    } catch { /* skip */ }
  }
  return links;
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
