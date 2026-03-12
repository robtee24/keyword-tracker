import { authenticateRequest } from '../_config.js';
import { deductCredits } from '../_credits.js';

export const config = { maxDuration: 120 };

async function callClaude(systemPrompt, userMessage) {
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
      max_tokens: 8000,
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

const SYSTEM_PROMPT = `You are an elite creative director and advertising strategist who has worked at top agencies (Wieden+Kennedy, Droga5, 72andSunny). You generate breakthrough video ad concepts.

MARKETING PSYCHOLOGY YOU MUST APPLY:
- Hook in first 2 seconds (pattern interrupt, surprise, question, bold claim)
- Emotional resonance over feature lists
- Social proof and authority signals
- Loss aversion framing when relevant
- Specificity beats vagueness ("save 4 hours/week" not "save time")
- One clear CTA per ad
- Benefits > features > specs

AD CREATIVE BEST PRACTICES:
- UGC-style often outperforms polished on Meta/TikTok
- Text overlays boost retention 40%+
- Vertical video (9:16) for TikTok/Reels/Stories
- First 3 seconds determine skip vs watch
- Stories with emotional arcs outperform product demos
- Contrast and movement grab attention in feeds
- Sound-off captions critical for feed placement

COMPETITOR RULE: NEVER mention competitors positively. Always position the brand as the superior choice.

You MUST respond with ONLY valid JSON — no markdown, no explanation.`;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const { projectId, siteUrl, inputType, inputText } = req.body || {};
  if (!projectId || !siteUrl) return res.status(400).json({ error: 'projectId and siteUrl required' });

  let contextBlock = '';

  if (inputType === 'website_analysis') {
    try {
      const resp = await fetch(siteUrl, {
        headers: { 'User-Agent': 'SEAUTO-VideoBot/1.0', Accept: 'text/html' },
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const html = await resp.text();
        const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || '';
        const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || [])[1] || '';
        const bodyText = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 4000);
        contextBlock = `\nWEBSITE ANALYSIS:\nTitle: ${title}\nDescription: ${desc}\nContent: ${bodyText}`;
      }
    } catch { /* non-critical */ }
  }

  const userMessage = `Generate 10 unique, creative video ad ideas for this brand.

SITE: ${siteUrl}
INPUT TYPE: ${inputType || 'general_idea'}
${inputText ? `USER INPUT: ${inputText}` : ''}
${contextBlock}

For each idea, provide:
- title: catchy internal name for the concept
- hook: the first 2-3 seconds that grabs attention (the most critical part)
- concept: 2-3 sentence overview of the full ad
- targetAudience: who this ad is for
- emotionalAngle: the core emotion being leveraged
- cta: the call to action
- estimatedLength: suggested length in seconds (15, 30, or 60)
- platform: best platform for this concept (Meta, TikTok, LinkedIn, or All)

Make ideas DIVERSE: mix UGC-style, cinematic, testimonial, product demo, storytelling, problem-solution, before/after, and trend-based approaches. Each idea should feel genuinely different.

Respond with ONLY valid JSON:
{
  "ideas": [
    {
      "title": "...",
      "hook": "...",
      "concept": "...",
      "targetAudience": "...",
      "emotionalAngle": "...",
      "cta": "...",
      "estimatedLength": 30,
      "platform": "All"
    }
  ]
}`;

  try {
    let raw = await callClaude(SYSTEM_PROMPT, userMessage);
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
      else throw new Error('Failed to parse AI response');
    }

    if (!result.ideas || !Array.isArray(result.ideas)) {
      throw new Error('Invalid response format');
    }

    await deductCredits(auth.user.id, 0.03 * 1.3, 'claude-sonnet-4', 'Video idea generation', projectId || null);

    return res.status(200).json(result);
  } catch (err) {
    console.error('[GenerateIdeas] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
