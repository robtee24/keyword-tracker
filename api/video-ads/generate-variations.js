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

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const { projectId, siteUrl, sourceIdea, existingVariations } = req.body || {};
  if (!projectId || !sourceIdea) return res.status(400).json({ error: 'projectId and sourceIdea required' });

  const systemPrompt = `You are an elite creative director specializing in ad creative iteration. You take a strong ad concept and generate meaningfully different variations — not just rewording, but genuinely different angles, hooks, emotional approaches, and execution styles.

VARIATION STRATEGIES:
- Change the hook style (question, statistic, bold claim, visual shock, story opening)
- Shift the emotional angle (fear → aspiration, logic → emotion, humor → urgency)
- Change the format (UGC → cinematic, testimonial → problem-solution, demo → story)
- Alter the target audience segment
- Change the CTA approach (direct → soft, urgency → value, free → exclusive)
- Flip the narrative structure (problem-first → solution-first, chronological → reverse)
- Change the visual style (dark/moody → bright/clean, fast-paced → slow)

Each variation must feel like a genuinely different ad, not a minor rewrite. NEVER mention competitors positively.

Respond with ONLY valid JSON.`;

  const existingContext = existingVariations?.length
    ? `\nALREADY GENERATED (do NOT repeat similar concepts):\n${existingVariations.map((v, i) => `${i + 1}. ${v.title}: ${v.hook}`).join('\n')}`
    : '';

  const userMessage = `Generate 10 unique variations of this ad concept.

ORIGINAL IDEA:
Title: ${sourceIdea.title}
Hook: ${sourceIdea.hook}
Concept: ${sourceIdea.concept}
Target Audience: ${sourceIdea.targetAudience}
Emotional Angle: ${sourceIdea.emotionalAngle}
CTA: ${sourceIdea.cta}
Length: ${sourceIdea.estimatedLength}s
Platform: ${sourceIdea.platform}
${existingContext}

Generate 10 FRESH variations. Each must have a different hook style, emotional approach, or execution format. Maintain the core value proposition but explore it from completely different angles.

Respond with ONLY valid JSON:
{
  "variations": [
    {
      "title": "...",
      "hook": "...",
      "concept": "...",
      "targetAudience": "...",
      "emotionalAngle": "...",
      "cta": "...",
      "estimatedLength": 30,
      "platform": "All",
      "variationStrategy": "brief note on what makes this different from the original"
    }
  ]
}`;

  try {
    let raw = await callClaude(systemPrompt, userMessage);
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
      else throw new Error('Failed to parse AI response');
    }

    await deductCredits(auth.user.id, 0.03 * 1.3, 'claude-sonnet-4', 'Video variation generation', projectId || null);

    return res.status(200).json(result);
  } catch (err) {
    console.error('[GenerateVariations] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
