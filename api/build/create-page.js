export const config = { maxDuration: 120 };

/**
 * POST /api/build/create-page
 * { siteUrl, title, slug, purpose, targetKeyword, outline, objectives, style }
 *
 * Generates a complete new page using AI + marketing skills.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { siteUrl, title, slug, purpose, targetKeyword, outline, objectives, style } = req.body || {};
  if (!siteUrl || !title) return res.status(400).json({ error: 'siteUrl and title required' });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });

  const prompt = `You are an expert web developer, copywriter, SEO specialist, and conversion optimizer. Build a complete, publish-ready web page.

WEBSITE: ${siteUrl}
BUSINESS OBJECTIVES: ${objectives || 'Maximize organic traffic and conversions'}

PAGE DETAILS:
Title: ${title}
URL Slug: ${slug || 'auto-generate'}
Purpose: ${purpose || 'Drive traffic and conversions'}
Target Keyword: ${targetKeyword || 'Infer from title'}
${style ? `Design Style: ${style}` : ''}
${outline ? `Page Sections: ${Array.isArray(outline) ? outline.join(', ') : outline}` : ''}

REQUIREMENTS:
1. Write complete, compelling page content (not placeholder text)
2. Apply SEO best practices (keyword placement, heading hierarchy, meta tags)
3. Apply conversion optimization (clear CTAs, trust signals, benefit-driven copy)
4. Apply marketing psychology (social proof, urgency, authority)
5. Include proper HTML structure with semantic elements
6. Suggest image placements with descriptions
7. Include schema markup recommendations
8. Write for the target audience based on the business objectives
9. Make the content scannable (short paragraphs, bullets, subheadings)

Respond with ONLY valid JSON:
{
  "title": "<optimized page title>",
  "metaDescription": "<compelling meta description under 155 chars>",
  "slug": "<url-friendly-slug>",
  "htmlContent": "<complete page HTML content (body section only)>",
  "schemaMarkup": "<JSON-LD schema markup>",
  "suggestedImages": ["<image description and placement>"],
  "internalLinkSuggestions": ["<pages to link to/from>"],
  "summary": "<what was built and why>"
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: `Build this page: "${title}"` },
        ],
        temperature: 0.4,
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

    let page;
    try {
      page = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) page = JSON.parse(jsonMatch[0]);
      else throw new Error('Failed to parse AI response');
    }

    return res.status(200).json({ page });
  } catch (err) {
    console.error('[CreatePage] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
