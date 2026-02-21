export const config = {
  maxDuration: 60,
};

/**
 * POST /api/ai/analyze-site { siteUrl }
 *
 * Crawls the site homepage + up to 5 internal links (1 level deep),
 * extracts text content, then asks GPT-4o to fill out the website
 * objectives questionnaire.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { siteUrl } = req.body || {};
  if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
  }

  try {
    // 1. Crawl homepage
    const homepage = normalizeUrl(siteUrl);
    const homeResult = await crawlPage(homepage);

    if (!homeResult.success) {
      return res.status(400).json({ error: `Failed to crawl homepage: ${homeResult.error}` });
    }

    // 2. Extract internal links and crawl up to 5 unique pages
    const internalLinks = extractInternalLinks(homeResult.html, homepage);
    const pagesToCrawl = internalLinks.slice(0, 5);

    const subResults = await Promise.all(
      pagesToCrawl.map(async (url) => {
        try {
          return await crawlPage(url);
        } catch {
          return { success: false, url, text: '', error: 'crawl failed' };
        }
      })
    );

    // 3. Build a text summary of the site
    const allPages = [
      { url: homepage, text: homeResult.text, title: homeResult.title, meta: homeResult.meta },
      ...subResults
        .filter((r) => r.success)
        .map((r) => ({ url: r.url, text: r.text, title: r.title, meta: r.meta })),
    ];

    const siteText = allPages
      .map((p) => `--- PAGE: ${p.url} ---\nTitle: ${p.title || 'N/A'}\nMeta: ${p.meta || 'N/A'}\n\n${p.text.substring(0, 3000)}`)
      .join('\n\n');

    // 4. Ask GPT to fill out objectives
    const prompt = buildObjectivesPrompt(siteUrl, siteText);
    const result = await callOpenAI(openaiKey, prompt);

    return res.status(200).json({ objectives: result });
  } catch (err) {
    console.error('AI site analysis error:', err);
    return res.status(500).json({ error: err.message || 'Failed to analyze site' });
  }
}

function normalizeUrl(siteUrl) {
  let url = siteUrl.replace(/\/$/, '');
  if (url.startsWith('sc-domain:')) {
    url = `https://${url.replace('sc-domain:', '')}`;
  }
  if (!url.startsWith('http')) {
    url = `https://${url}`;
  }
  return url;
}

async function crawlPage(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { success: false, url, text: '', error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || '';
    const metaMatch =
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i) ||
      html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i);
    const meta = metaMatch?.[1]?.trim() || '';

    // Extract visible text
    let bodyHtml = html;
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) bodyHtml = bodyMatch[1];

    // Remove scripts, styles, nav, footer
    bodyHtml = bodyHtml
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '');

    const text = bodyHtml
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim();

    return { success: true, url, html, text, title, meta };
  } catch (err) {
    return { success: false, url, text: '', error: err.message || 'Fetch failed' };
  }
}

function extractInternalLinks(html, baseUrl) {
  const links = new Set();
  let baseDomain = '';
  try {
    baseDomain = new URL(baseUrl).hostname;
  } catch {
    return [];
  }

  const linkRegex = /<a[^>]*href=["']([^"'#]+)["'][^>]*>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const href = new URL(match[1], baseUrl);
      if (href.hostname === baseDomain && href.pathname !== '/' && href.pathname !== '') {
        const clean = href.origin + href.pathname.replace(/\/$/, '');
        if (!links.has(clean)) links.add(clean);
      }
    } catch { /* skip invalid URLs */ }
  }

  return [...links];
}

const SITE_TYPES = [
  'E-commerce / Online Store', 'Service-based Business', 'SaaS / Software Product',
  'Blog / Content Site', 'News / Media Publication', 'Portfolio / Personal Brand',
  'Agency / Consultancy', 'Marketplace', 'Community / Forum',
  'Educational / Course Platform', 'Non-profit / Organization', 'Local Business',
  'Lead Generation', 'Affiliate / Review Site', 'Other',
];

const OBJECTIVES = [
  'Generate qualified leads', 'Sell products online', 'Drive brand awareness',
  'Educate and inform audience', 'Generate recurring subscriptions',
  'Build community engagement', 'Drive ad revenue / monetize traffic',
  'Establish thought leadership', 'Support existing customers',
  'Drive foot traffic to physical locations', 'Build email list', 'Promote events',
];

const GEO_OPTIONS = [
  'Local (single city/region)', 'Regional (multi-city/state)',
  'National (single country)', 'Multi-country', 'Global / International',
];

function buildObjectivesPrompt(siteUrl, siteText) {
  return `You are analyzing a website to fill out a business objectives questionnaire. Based on the crawled page content below, answer each question as accurately as possible.

WEBSITE: ${siteUrl}

CRAWLED CONTENT:
${siteText.substring(0, 12000)}

---

Fill out this JSON structure. For fields with predefined options, pick THE EXACT matching string from the options list. For free-text fields, write concise, informative answers.

SITE TYPE OPTIONS: ${JSON.stringify(SITE_TYPES)}
OBJECTIVE OPTIONS: ${JSON.stringify(OBJECTIVES)}
GEO OPTIONS: ${JSON.stringify(GEO_OPTIONS)}

Return ONLY valid JSON with this structure:
{
  "siteType": "<exact match from SITE TYPE OPTIONS>",
  "primaryObjective": "<exact match from OBJECTIVE OPTIONS>",
  "secondaryObjectives": ["<exact matches from OBJECTIVE OPTIONS>"],
  "coreOfferings": [
    {
      "name": "<offering name>",
      "description": "<1-2 sentence description>",
      "topKeyword": "<the single most important search keyword for this offering>"
    }
  ],
  "targetAudience": "<describe the target audience based on the site content>",
  "geographicFocus": "<exact match from GEO OPTIONS>",
  "competitors": "<list likely competitors, one per line>",
  "uniqueValue": "<what makes this business unique based on the content>",
  "conversionGoals": "<what likely counts as a conversion on this site>",
  "contentStrategy": "<describe the content approach based on what you see>"
}

Be specific and base everything on the actual content you see. For coreOfferings, identify 2-5 distinct offerings/services/products. For topKeyword, choose the search term a user would type into Google to find that specific offering.`;
}

async function callOpenAI(apiKey, prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
          content: 'You are a business analyst who examines websites and determines their purpose, offerings, and target market. Always respond with valid JSON only — no markdown fences, no explanation outside the JSON structure.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const err = await response.json();
      detail = err.error?.message || JSON.stringify(err);
    } catch {
      detail = await response.text().catch(() => 'unknown');
    }
    throw new Error(`OpenAI error (${response.status}): ${detail}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';

  let cleaned = content.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    console.error('Failed to parse AI response:', cleaned.substring(0, 500));
    throw new Error('AI returned invalid response — please retry');
  }
}
