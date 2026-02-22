export const config = { maxDuration: 120 };

/**
 * POST /api/build/rebuild
 * { siteUrl, pageUrl, improvements: string[], objectives }
 *
 * Fetches the page, gathers all existing recommendations,
 * and generates an improved version of the page using AI + marketing skills.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { siteUrl, pageUrl, improvements, objectives } = req.body || {};
  if (!siteUrl || !pageUrl) return res.status(400).json({ error: 'siteUrl and pageUrl required' });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });

  let pageContent;
  try {
    pageContent = await fetchPageContent(pageUrl);
  } catch (err) {
    return res.status(200).json({ error: `Failed to fetch page: ${err.message}` });
  }

  const improvementAreas = (improvements || []).length > 0
    ? improvements.join(', ')
    : 'SEO, content quality, conversion optimization, technical performance, user experience';

  const prompt = `You are an expert web developer, SEO specialist, copywriter, and conversion rate optimizer. You have been given a page to rebuild and improve.

WEBSITE: ${siteUrl}
PAGE URL: ${pageUrl}
BUSINESS OBJECTIVES: ${objectives || 'Improve organic traffic, conversions, and user engagement'}

AREAS TO IMPROVE: ${improvementAreas}

CURRENT PAGE ANALYSIS:
Title: ${pageContent.title || '(none)'}
Meta Description: ${pageContent.metaDescription || '(none)'}
H1: ${pageContent.headings.filter(h => h.level === 'H1').map(h => h.text).join(', ') || '(none)'}
Word Count: ~${pageContent.bodyText.split(/\s+/).length}
Images: ${pageContent.imageCount} total, ${pageContent.imagesWithoutAlt} missing alt text
Internal Links: ${pageContent.internalLinkCount}

HEADINGS:
${pageContent.headings.map(h => `${h.level}: ${h.text}`).join('\n') || '(none)'}

BODY TEXT (first 4000 chars):
${pageContent.bodyText.substring(0, 4000)}

REBUILD INSTRUCTIONS:
1. Analyze every weakness of the current page
2. Generate a COMPLETE rebuilt version addressing all improvement areas
3. Apply marketing psychology, SEO best practices, and conversion optimization
4. Write compelling, specific copy (not generic filler)
5. Include proper heading hierarchy, meta tags, schema markup suggestions
6. Optimize for both users and search engines
7. Include specific calls-to-action
8. Suggest image placements with descriptions

Respond with ONLY valid JSON:
{
  "title": "<optimized page title>",
  "metaDescription": "<compelling meta description under 155 chars>",
  "recommendations": [
    {
      "area": "<improvement area>",
      "current": "<what's wrong now>",
      "improved": "<what was changed>",
      "reason": "<why this improves the page>"
    }
  ],
  "htmlContent": "<complete rebuilt page HTML content (body only, no head/html tags)>",
  "schemaMarkup": "<suggested JSON-LD schema markup>",
  "summary": "<2-3 sentence summary of all changes made>"
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: `Rebuild this page with improvements to: ${improvementAreas}` },
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => 'unknown');
      throw new Error(`OpenAI error (${response.status}): ${detail}`);
    }

    const data = await response.json();
    let raw = data.choices?.[0]?.message?.content || '';
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
      else throw new Error('Failed to parse AI response');
    }

    return res.status(200).json({ result });
  } catch (err) {
    console.error('[BuildRebuild] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function fetchPageContent(url) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'SEAUTO-BuildBot/1.0', Accept: 'text/html' },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const html = await resp.text();

  return {
    title: extractTag(html, 'title'),
    metaDescription: extractMeta(html, 'description'),
    headings: extractHeadings(html),
    bodyText: extractBodyText(html),
    imageCount: (html.match(/<img[\s>]/gi) || []).length,
    imagesWithoutAlt: (html.match(/<img(?![^>]*alt=)[^>]*>/gi) || []).length,
    internalLinkCount: extractInternalLinks(html, url).length,
    htmlLength: html.length,
  };
}

function extractTag(html, tag) {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

function extractMeta(html, name) {
  const m = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, 'i'));
  return m ? m[1].trim() : '';
}

function extractHeadings(html) {
  const headings = [];
  const regex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    headings.push({ level: match[1].toUpperCase(), text: match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() });
  }
  return headings.slice(0, 30);
}

function extractBodyText(html) {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
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
