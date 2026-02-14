import { getAccessTokenFromRequest } from '../../_config.js';

export const config = {
  maxDuration: 60,
};

/**
 * Crawl ranking pages for a keyword, extract SEO signals, and generate
 * improvement recommendations via OpenAI GPT-4.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = getAccessTokenFromRequest(req);
  if (!accessToken) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { keyword, pages, siteUrl } = req.body || {};

  if (!keyword || !pages || !siteUrl) {
    return res.status(400).json({ error: 'keyword, pages, and siteUrl are required' });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return res.status(500).json({
      error: 'OPENAI_API_KEY is not configured. Add it in your Vercel project Settings → Environment Variables.',
    });
  }

  try {
    // 1. Crawl each page and extract SEO signals (max 3 pages to stay within time limits)
    const pagesToCrawl = pages.slice(0, 3);
    const pageAnalyses = [];

    for (const page of pagesToCrawl) {
      try {
        const analysis = await crawlAndAnalyze(page.url, keyword, siteUrl);
        pageAnalyses.push(analysis);
      } catch (crawlErr) {
        pageAnalyses.push({
          url: page.url,
          crawlSuccess: false,
          error: crawlErr.message || 'Crawl failed',
        });
      }
    }

    // 2. Build the prompt for OpenAI
    const prompt = buildPrompt(keyword, siteUrl, pages, pageAnalyses);

    // 3. Call OpenAI
    const recommendations = await callOpenAI(openaiKey, prompt);

    return res.status(200).json({ recommendations });
  } catch (error) {
    console.error('Recommendations API error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate recommendations',
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Page Crawler & SEO Signal Extraction                              */
/* ------------------------------------------------------------------ */

async function crawlAndAnalyze(url, keyword, siteUrl) {
  const analysis = {
    url,
    crawlSuccess: false,
    title: null,
    metaDescription: null,
    h1: [],
    h2: [],
    h3: [],
    wordCount: 0,
    keywordInTitle: false,
    keywordInH1: false,
    keywordInMetaDescription: false,
    keywordMentions: 0,
    keywordInFirstParagraph: false,
    internalLinks: [],
    internalLinkCount: 0,
    externalLinkCount: 0,
    imageCount: 0,
    imagesWithAlt: 0,
    imagesWithoutAlt: 0,
    hasSchema: false,
    schemaTypes: [],
    canonicalUrl: null,
    hasCanonical: false,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      analysis.error = `HTTP ${response.status}`;
      return analysis;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      analysis.error = `Non-HTML content: ${contentType}`;
      return analysis;
    }

    const html = await response.text();
    analysis.crawlSuccess = true;

    // Extract domain from siteUrl for internal link detection
    let siteDomain = '';
    try {
      siteDomain = new URL(siteUrl.replace(/\/$/, '')).hostname;
    } catch {
      siteDomain = siteUrl.replace(/https?:\/\//, '').replace(/\/$/, '');
    }

    const kw = keyword.toLowerCase();

    // Title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      analysis.title = titleMatch[1].trim();
      analysis.keywordInTitle = analysis.title.toLowerCase().includes(kw);
    }

    // Meta description
    const metaDescMatch =
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i) ||
      html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i);
    if (metaDescMatch) {
      analysis.metaDescription = metaDescMatch[1].trim();
      analysis.keywordInMetaDescription = analysis.metaDescription.toLowerCase().includes(kw);
    }

    // Headings
    const h1Matches = html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi);
    for (const m of h1Matches) {
      const text = stripTags(m[1]).trim();
      if (text) analysis.h1.push(text);
    }
    analysis.keywordInH1 = analysis.h1.some((h) => h.toLowerCase().includes(kw));

    const h2Matches = html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi);
    for (const m of h2Matches) {
      const text = stripTags(m[1]).trim();
      if (text) analysis.h2.push(text);
    }

    const h3Matches = html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi);
    for (const m of h3Matches) {
      const text = stripTags(m[1]).trim();
      if (text) analysis.h3.push(text);
    }

    // Body text content
    let bodyContent = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    bodyContent = bodyContent.replace(/<style[\s\S]*?<\/style>/gi, '');
    bodyContent = bodyContent.replace(/<nav[\s\S]*?<\/nav>/gi, '');
    bodyContent = bodyContent.replace(/<footer[\s\S]*?<\/footer>/gi, '');
    bodyContent = bodyContent.replace(/<header[\s\S]*?<\/header>/gi, '');
    const textContent = stripTags(bodyContent);
    const words = textContent.split(/\s+/).filter((w) => w.length > 0);
    analysis.wordCount = words.length;

    // Keyword mentions in body
    const bodyLower = textContent.toLowerCase();
    let idx = 0;
    while (true) {
      idx = bodyLower.indexOf(kw, idx);
      if (idx === -1) break;
      analysis.keywordMentions++;
      idx += kw.length;
    }

    // Keyword in first paragraph
    const firstPMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (firstPMatch) {
      analysis.keywordInFirstParagraph = stripTags(firstPMatch[1]).toLowerCase().includes(kw);
    }

    // Links
    const linkMatches = html.matchAll(/<a[^>]*href=["']([^"']*?)["'][^>]*>/gi);
    for (const m of linkMatches) {
      const href = m[1];
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;

      try {
        const linkUrl = new URL(href, url);
        if (linkUrl.hostname === siteDomain || linkUrl.hostname.endsWith('.' + siteDomain)) {
          analysis.internalLinkCount++;
          if (analysis.internalLinks.length < 20) {
            analysis.internalLinks.push(linkUrl.pathname);
          }
        } else {
          analysis.externalLinkCount++;
        }
      } catch {
        // Relative URL
        analysis.internalLinkCount++;
      }
    }

    // Images
    const imgMatches = html.matchAll(/<img[^>]*>/gi);
    for (const m of imgMatches) {
      analysis.imageCount++;
      if (/alt=["'][^"']+["']/i.test(m[0])) {
        analysis.imagesWithAlt++;
      } else {
        analysis.imagesWithoutAlt++;
      }
    }

    // Schema / structured data
    const schemaMatches = html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    );
    for (const m of schemaMatches) {
      analysis.hasSchema = true;
      try {
        const schema = JSON.parse(m[1]);
        if (schema['@type']) analysis.schemaTypes.push(schema['@type']);
        if (Array.isArray(schema['@graph'])) {
          schema['@graph'].forEach((item) => {
            if (item['@type']) analysis.schemaTypes.push(item['@type']);
          });
        }
      } catch {
        /* ignore parse errors */
      }
    }

    // Canonical
    const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*?)["']/i);
    if (canonicalMatch) {
      analysis.canonicalUrl = canonicalMatch[1];
      analysis.hasCanonical = true;
    }
  } catch (err) {
    analysis.error = err.name === 'AbortError' ? 'Timeout (page took too long to respond)' : err.message;
  }

  return analysis;
}

function stripTags(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ------------------------------------------------------------------ */
/*  OpenAI Prompt Builder                                             */
/* ------------------------------------------------------------------ */

function buildPrompt(keyword, siteUrl, pages, pageAnalyses) {
  let prompt = `You are an expert SEO consultant. Analyze the following data for the keyword "${keyword}" on the domain ${siteUrl} and provide specific, actionable recommendations to improve rankings.\n\n`;

  prompt += `## Search Console Performance\n`;
  pages.forEach((p) => {
    prompt += `- ${p.url}: ${p.clicks || 0} clicks, ${p.impressions || 0} impressions\n`;
  });

  prompt += `\n## Page-Level SEO Analysis\n`;
  pageAnalyses.forEach((a) => {
    if (!a.crawlSuccess) {
      prompt += `\n### ${a.url}\nCould not crawl: ${a.error || 'unknown error'}\n`;
      return;
    }

    prompt += `\n### ${a.url}\n`;
    prompt += `- Title: "${a.title || 'MISSING'}"\n`;
    prompt += `- Meta Description: "${a.metaDescription || 'MISSING'}" (${a.metaDescription ? a.metaDescription.length : 0} chars)\n`;
    prompt += `- H1 tags: ${a.h1.length > 0 ? a.h1.map((h) => `"${h}"`).join(', ') : 'NONE'}\n`;
    prompt += `- H2 tags: ${a.h2.length} found${a.h2.length > 0 ? ' — ' + a.h2.slice(0, 5).map((h) => `"${h}"`).join(', ') : ''}\n`;
    prompt += `- H3 tags: ${a.h3.length} found\n`;
    prompt += `- Word count: ${a.wordCount}\n`;
    prompt += `- Keyword "${keyword}" found in: ${[a.keywordInTitle && 'title', a.keywordInH1 && 'H1', a.keywordInMetaDescription && 'meta description', a.keywordInFirstParagraph && 'first paragraph'].filter(Boolean).join(', ') || 'NONE of the key positions'}\n`;
    prompt += `- Keyword mentions in body: ${a.keywordMentions}\n`;
    prompt += `- Internal links: ${a.internalLinkCount}, External links: ${a.externalLinkCount}\n`;
    prompt += `- Images: ${a.imageCount} total, ${a.imagesWithAlt} with alt text, ${a.imagesWithoutAlt} without\n`;
    prompt += `- Schema markup: ${a.hasSchema ? 'Yes (' + a.schemaTypes.join(', ') + ')' : 'None'}\n`;
    prompt += `- Canonical: ${a.hasCanonical ? a.canonicalUrl : 'Not set'}\n`;
  });

  prompt += `\n## Instructions\n`;
  prompt += `Provide exactly 5-10 specific, actionable recommendations. For each recommendation, provide:\n`;
  prompt += `1. "category" — one of: "on-page", "content", "internal-linking", "technical", "backlinks"\n`;
  prompt += `2. "priority" — one of: "high", "medium", "low"\n`;
  prompt += `3. "title" — a short, clear title (under 80 chars)\n`;
  prompt += `4. "description" — detailed explanation of what to do and why (2-4 sentences)\n`;
  prompt += `5. "action" — the specific, concrete next step to take (1-2 sentences)\n\n`;
  prompt += `Respond with ONLY a valid JSON array of recommendation objects. No markdown, no explanation outside the JSON.\n`;
  prompt += `Example: [{"category":"on-page","priority":"high","title":"Add keyword to title tag","description":"The title tag...","action":"Update the title to..."}]\n`;

  return prompt;
}

/* ------------------------------------------------------------------ */
/*  OpenAI API Call                                                   */
/* ------------------------------------------------------------------ */

async function callOpenAI(apiKey, prompt) {
  let response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert SEO consultant who provides specific, data-driven recommendations. Always respond with valid JSON only.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 3000,
      }),
    });
  } catch (fetchErr) {
    throw new Error(`Failed to reach OpenAI API: ${fetchErr.message}`);
  }

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errorBody = await response.json();
      errorDetail = errorBody.error?.message || JSON.stringify(errorBody);
    } catch {
      errorDetail = await response.text().catch(() => 'unknown');
    }

    if (response.status === 401) {
      throw new Error('OpenAI API key is invalid or expired. Check your OPENAI_API_KEY in Vercel settings.');
    }
    if (response.status === 429) {
      throw new Error('OpenAI rate limit exceeded. Please wait a moment and try again.');
    }
    if (response.status === 402 || response.status === 403) {
      throw new Error('OpenAI API access denied — check billing/quota on your OpenAI account.');
    }

    throw new Error(`OpenAI API error (${response.status}): ${errorDetail}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '[]';

  // Parse the JSON response — handle markdown code fences if GPT wraps it
  let cleaned = content.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to parse OpenAI response:', cleaned.substring(0, 500));
    throw new Error('Failed to parse AI recommendations — the AI returned invalid JSON');
  }
}
