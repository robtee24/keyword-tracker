export const config = { maxDuration: 60 };

/**
 * POST /api/build/suggest-pages
 * { siteUrl, objectives, existingPages }
 *
 * AI-generates 20 suggested new pages that would benefit the site.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { siteUrl, objectives, existingPages } = req.body || {};
  if (!siteUrl) return res.status(400).json({ error: 'siteUrl required' });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });

  const existingList = (existingPages || []).slice(0, 100).map(u => {
    try { return new URL(u).pathname; } catch { return u; }
  }).join('\n');

  const prompt = `You are an expert website strategist, SEO specialist, and conversion optimizer. Analyze this website and suggest 20 new pages that would significantly improve the site's performance.

WEBSITE: ${siteUrl}
BUSINESS OBJECTIVES: ${objectives || 'Improve organic traffic, conversions, and user experience'}

EXISTING PAGES (paths only, first 100):
${existingList || 'No existing pages provided'}

REQUIREMENTS:
1. Suggest exactly 20 new pages the site DOES NOT already have
2. Each page should serve a clear purpose (traffic, conversion, trust, or user experience)
3. Mix of page types: landing pages, service pages, resource pages, comparison pages, FAQ pages, case studies, tools/calculators
4. Consider the full conversion funnel: awareness → consideration → decision
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
      "pageType": "landing" | "service" | "resource" | "comparison" | "faq" | "case-study" | "tool" | "about" | "legal" | "other",
      "purpose": "<2-3 sentences explaining why this page is needed and what it accomplishes>",
      "targetKeyword": "<primary keyword>",
      "estimatedMonthlySearches": <number>,
      "funnelStage": "awareness" | "consideration" | "decision",
      "priority": "high" | "medium" | "low",
      "outline": ["<3-5 key sections the page should include>"]
    }
  ]
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: `Suggest 20 new pages for ${siteUrl}` },
        ],
        temperature: 0.4,
        max_tokens: 6000,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => 'unknown');
      throw new Error(`OpenAI error (${response.status}): ${detail}`);
    }

    const data = await response.json();
    let raw = data.choices?.[0]?.message?.content || '';
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
