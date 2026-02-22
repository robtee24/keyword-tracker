export const config = { maxDuration: 120 };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { siteUrl, pageUrl, currentHtml, modifications, currentTitle, currentMeta } = req.body || {};

  if (!currentHtml || !modifications) {
    return res.status(400).json({ error: 'currentHtml and modifications are required' });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });
  }

  const systemPrompt = `You are an expert web developer and designer. You will receive the current HTML of a web page and the user's requested modifications. Apply the modifications while preserving the overall structure, style, and quality of the page.

RULES:
- Apply ONLY the changes the user requests — do not rewrite or restructure unrelated sections.
- Preserve all existing CSS, classes, styles, colors, fonts, and layout unless the user specifically asks to change them.
- Maintain responsive design patterns.
- Keep all existing schema markup unless told to change it.
- If the user asks to add a section, match the style of existing sections.
- If the user asks to change copy, follow best copywriting practices (clarity, benefits over features, strong CTAs).
- Return complete, production-ready HTML.

Respond with ONLY valid JSON in this format:
{
  "title": "<updated page title>",
  "metaDescription": "<updated meta description>",
  "htmlContent": "<the full modified HTML content>",
  "schemaMarkup": "<any schema markup, or empty string if unchanged>",
  "changesSummary": "<brief description of what was changed>"
}`;

  const userMessage = `CURRENT PAGE TITLE: ${currentTitle || '(not provided)'}
CURRENT META DESCRIPTION: ${currentMeta || '(not provided)'}
${siteUrl ? `SITE URL: ${siteUrl}` : ''}
${pageUrl ? `PAGE URL: ${pageUrl}` : ''}

CURRENT HTML CONTENT:
${currentHtml.substring(0, 30000)}

USER'S REQUESTED MODIFICATIONS:
${modifications}

Apply the requested modifications to the HTML above and return the updated page.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => 'unknown');
      return res.status(500).json({ error: `Claude API error (${response.status}): ${detail}` });
    }

    const data = await response.json();
    let raw = data.content?.[0]?.text || '{}';
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const parsed = JSON.parse(cleaned);
    return res.status(200).json({
      result: {
        title: parsed.title || currentTitle || '',
        metaDescription: parsed.metaDescription || currentMeta || '',
        htmlContent: parsed.htmlContent || currentHtml,
        schemaMarkup: parsed.schemaMarkup || '',
        changesSummary: parsed.changesSummary || 'Modifications applied',
        recommendations: [],
        summary: parsed.changesSummary || 'Page modified based on your instructions.',
      },
    });
  } catch (err) {
    console.error('[ModifyPage] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to modify page' });
  }
}
