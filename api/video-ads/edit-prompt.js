import { authenticateRequest } from '../_config.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const { currentPrompt, editInstruction, sceneDescription, voiceStyle, videoStyle, characterBibles, colorGrading } = req.body || {};
  if (!currentPrompt || !editInstruction) {
    return res.status(400).json({ error: 'currentPrompt and editInstruction required' });
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

  const systemPrompt = `You are a VEO 3.1 video prompt editor. You modify existing video generation prompts based on user instructions while maintaining prompt quality and character consistency.

RULES:
- Apply ONLY the user's requested change
- Maintain the optimal prompt density (60-100 words)
- Keep the layered prompt structure: Identity + Cinematography + Environment + Performance + Audio + Negatives
- CRITICAL: If the prompt contains a character description from the Character Bible, do NOT alter those exact words. The character identity text must remain verbatim.
- Preserve audio direction unless the user explicitly changes it
- Keep the same voice style (${voiceStyle || 'professional'}) and video style (${videoStyle || 'cinematic'})
${colorGrading ? `- Maintain the locked color grading: "${colorGrading}"` : ''}
- Return the updated prompt, nothing else
${characterContext}
Respond with ONLY valid JSON.`;

  const userMessage = `CURRENT PROMPT:
${currentPrompt}

${sceneDescription ? `SCENE CONTEXT: ${sceneDescription}` : ''}

USER EDIT REQUEST: ${editInstruction}

Apply the user's edit to the prompt. Keep all character bible descriptions EXACTLY as they are. Return the updated prompt.

{
  "updatedPrompt": "the modified VEO 3.1 prompt incorporating the user's change",
  "changesMade": "brief description of what was changed"
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
    console.error('[EditPrompt] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
