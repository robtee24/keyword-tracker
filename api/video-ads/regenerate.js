import { authenticateRequest } from '../_config.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const { currentPrompt, sceneDescription, reason, voiceStyle, videoStyle, characterBibles, colorGrading } = req.body || {};
  if (!currentPrompt || !reason) {
    return res.status(400).json({ error: 'currentPrompt and reason required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });

  let characterContext = '';
  if (characterBibles?.length) {
    characterContext = '\n\nCHARACTER BIBLES (these descriptions MUST remain VERBATIM in the prompt — do NOT change any character description words):\n';
    for (const cb of characterBibles) {
      characterContext += `- ${cb.name}: ${cb.description}\n`;
    }
  }

  const systemPrompt = `You are a VEO 3.1 video prompt expert. The user generated a video but is unhappy with the result. Based on their feedback, modify the prompt to fix the issue while maintaining character consistency.

RULES:
- Analyze the user's complaint and make targeted changes
- Maintain the layered VEO 3.1 prompt structure: Identity + Cinematography + Environment + Performance + Audio + Negatives
- Keep prompt density at 60-100 words
- CRITICAL: If the prompt contains a character description from the Character Bible, do NOT alter those exact words. Character identity text must remain verbatim for cross-scene consistency.
- Preserve elements the user didn't complain about
- Explain exactly what you changed and why
${colorGrading ? `- Maintain the locked color grading: "${colorGrading}"` : ''}
${characterContext}
Respond with ONLY valid JSON.`;

  const userMessage = `CURRENT PROMPT:
${currentPrompt}

SCENE CONTEXT: ${sceneDescription || 'Not provided'}
VOICE STYLE: ${voiceStyle || 'professional'}
VIDEO STYLE: ${videoStyle || 'cinematic'}

USER'S REASON FOR REGENERATING:
${reason}

Fix the prompt based on the user's feedback. Keep all character bible descriptions EXACTLY as they are.

{
  "updatedPrompt": "the modified VEO 3.1 prompt that addresses the user's complaint",
  "changesMade": "We changed [specific changes] to [fix the user's issue]",
  "changesExplanation": "Detailed explanation of what was changed and why it should fix the problem"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => 'unknown');
      throw new Error(`Claude API error (${response.status}): ${detail}`);
    }

    const data = await response.json();
    let raw = data.content?.[0]?.text || '';
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
      else throw new Error('Failed to parse AI response');
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('[Regenerate] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
