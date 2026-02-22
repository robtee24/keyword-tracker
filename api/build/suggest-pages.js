export const config = { maxDuration: 60 };

async function callClaude(systemPrompt, userMessage, maxTokens = 8000) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

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
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => 'unknown');
    throw new Error(`Claude API error (${response.status}): ${detail}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { siteUrl, objectives, existingPages } = req.body || {};
  if (!siteUrl) return res.status(400).json({ error: 'siteUrl required' });

  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });

  const existingList = (existingPages || []).slice(0, 100).map(u => {
    try { return new URL(u).pathname; } catch { return u; }
  }).join('\n');

  const systemPrompt = `You are an expert website strategist, SEO specialist, and conversion optimizer. You analyze sites and recommend high-impact new pages that will drive organic traffic, build authority, and convert visitors.`;

  const userMessage = `Analyze this website and suggest 20 new WEBSITE PAGES that would significantly improve the site's performance.

WEBSITE: ${siteUrl}
BUSINESS OBJECTIVES: ${objectives || 'Improve organic traffic, conversions, and user experience'}

EXISTING PAGES (paths only, first 100):
${existingList || 'No existing pages provided'}

CRITICAL RULES:
- DO NOT suggest blog posts, articles, or any blog-type content. Blog content is handled separately.
- ONLY suggest structural website pages and landing pages: service pages, product pages, landing pages, comparison pages, pricing pages, about/team pages, FAQ pages, case study pages, tool/calculator pages, resource hub pages, testimonial/review pages, contact pages, location pages, industry-specific pages, integration pages, partner pages, etc.
- Every suggestion must be a standalone website PAGE, not a blog article or news post.

REQUIREMENTS:
1. Suggest exactly 20 new pages the site DOES NOT already have
2. Each page should serve a clear purpose (traffic, conversion, trust, or user experience)
3. Mix of page types: landing pages, service pages, product pages, comparison pages, FAQ pages, case studies, tools/calculators, pricing pages, industry pages, location pages, integration pages
4. Consider the full conversion funnel: awareness > consideration > decision
5. Prioritize pages with highest potential impact
6. Each suggestion must explain WHY this page would help and WHAT its purpose is
7. Include target keywords for each page
8. Estimate monthly search potential

Respond with ONLY valid JSON:
{
  "suggestions": [
    {
      "title": "<page title>",
      "slug": "<url-friendly-slug>",
      "pageType": "landing" | "service" | "product" | "comparison" | "faq" | "case-study" | "tool" | "pricing" | "about" | "industry" | "location" | "integration" | "testimonial" | "legal" | "other",
      "purpose": "<2-3 sentences explaining why this page is needed>",
      "targetKeyword": "<primary keyword>",
      "estimatedMonthlySearches": <number>,
      "funnelStage": "awareness" | "consideration" | "decision",
      "priority": "high" | "medium" | "low",
      "outline": ["<3-5 key sections the page should include>"]
    }
  ]
}`;

  try {
    let raw = await callClaude(systemPrompt, userMessage, 8000);
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      else throw new Error('Failed to parse AI response');
    }

    return res.status(200).json({ suggestions: parsed.suggestions || [] });
  } catch (err) {
    console.error('[SuggestPages] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
