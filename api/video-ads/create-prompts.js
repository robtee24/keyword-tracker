import { authenticateRequest } from '../_config.js';
import { getBrandContext } from '../_brand.js';

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
      max_tokens: 12000,
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

const PLATFORM_SPECS = {
  meta: { name: 'Meta (Facebook/Instagram)', ratios: ['9:16', '1:1', '16:9'], maxDuration: 60 },
  tiktok: { name: 'TikTok', ratios: ['9:16'], maxDuration: 60 },
  linkedin: { name: 'LinkedIn', ratios: ['16:9', '1:1', '9:16'], maxDuration: 60 },
};

const VEO_PROMPT_SYSTEM = `You are an expert video prompt engineer specializing in Google Veo 3.1 and AI video generation. You create prompts that produce professional, cinematic video ads.

=== VEO 3.1 CORE PROMPT FORMULA ===
[Cinematography] + [Subject] + [Action] + [Context] + [Style & Audio]

=== PROMPT DENSITY RULES ===
TIER 1 (MUST INCLUDE): Shot size, subject identity, primary action, dominant mood
TIER 2 (SHOULD INCLUDE): Camera movement OR angle, lighting quality, one audio layer, setting
TIER 3 (1-2 MAX): Secondary audio, lens type, color palette, film grain, background action

OPTIMAL prompt = 50-80 words. Under 30 = too sparse. Over 120 = too dense.

=== SHOT COMPOSITION ===
Wide shot, medium shot, close-up, extreme close-up, over-the-shoulder, two shot, bird's eye, worm's eye, POV

=== CAMERA MOVEMENT ===
Dolly in/out, tracking shot, crane shot, pan left/right, tilt up/down, steadicam, handheld, aerial, zoom

=== AUDIO DIRECTION (Veo generates synchronized sound) ===
- Dialogue: Use quotes → "A woman says, 'Try it free.'"
- SFX: Label with SFX → "SFX: keyboard typing, notification ping"
- Ambient: → "Ambient: busy café chatter, soft background music"
- Music: → "A upbeat electronic track plays"

=== TIMESTAMP PROMPTING (for multi-beat scenes) ===
[00:00-00:02] Shot description + audio
[00:02-00:04] Next beat + audio
[00:04-00:06] Next beat + audio
[00:06-00:08] Final beat + audio

=== SCENE CONSISTENCY RULES ===
- Each scene should end with a natural transition point (camera movement, scene change, or cut)
- Use consistent lighting and color grading descriptions across scenes
- Reference subject details identically across prompts for consistency
- Specify camera transitions between scenes (cut to, dissolve to, match cut)
- Avoid requiring the same character in different positions between scenes — use camera angles and scene changes instead

=== AD CREATIVE RULES ===
- Hook in first 2 seconds: pattern interrupt, surprising visual, bold text overlay
- Show the product/service within first 5 seconds
- Text overlays for key messages (specify in prompt: "Text overlay appears: '...'")
- End with clear CTA frame
- Match the voice/style settings exactly
- Sound-off friendly: key info should be visual

NEVER mention competitors. Always position the brand as the clear leader.

Respond with ONLY valid JSON.`;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const { projectId, siteUrl, idea, platforms, aspectRatio, voiceStyle, videoStyle } = req.body || {};
  if (!projectId || !idea) return res.status(400).json({ error: 'projectId and idea required' });

  let brandContext = '';
  try {
    brandContext = await getBrandContext(projectId);
  } catch { /* non-critical */ }

  const selectedPlatforms = (platforms || ['meta']).map(p => PLATFORM_SPECS[p]?.name || p).join(', ');
  const ratio = aspectRatio || '16:9';
  const totalLength = idea.estimatedLength || 30;
  const sceneCount = Math.ceil(totalLength / 8);

  const userMessage = `Create a complete video ad with scene-by-scene VEO 3.1 prompts.

AD CONCEPT:
Title: ${idea.title}
Hook: ${idea.hook}
Full Concept: ${idea.concept}
Target Audience: ${idea.targetAudience}
Emotional Angle: ${idea.emotionalAngle}
CTA: ${idea.cta}
Total Length: ${totalLength} seconds

SETTINGS:
Platforms: ${selectedPlatforms}
Aspect Ratio: ${ratio}
Voice Style: ${voiceStyle || 'professional'}
Video Style: ${videoStyle || 'cinematic'}

${brandContext ? `\n${brandContext}\n` : ''}

REQUIREMENTS:
1. Break the ad into ${sceneCount} scenes (each scene = one VEO generation, max 8 seconds)
2. Each scene prompt must be a complete, standalone VEO 3.1 prompt (50-80 words)
3. Scene 1 MUST contain the hook — the first 2-3 seconds that grab attention
4. The final scene MUST contain the CTA
5. Each scene should flow naturally into the next
6. Include audio direction in each scene (dialogue, SFX, ambient, or music)
7. Match the "${voiceStyle}" voice and "${videoStyle}" video style throughout
8. For character consistency: use scene changes, different angles, or different subjects rather than the same character in different poses across scenes
9. Include text overlay instructions where key messages need visual reinforcement

Respond with ONLY valid JSON:
{
  "overallConcept": "2-3 sentence summary of the complete ad",
  "scenes": [
    {
      "sceneNumber": 1,
      "durationSeconds": 8,
      "description": "What happens in this scene (plain English for the user)",
      "prompt": "The complete VEO 3.1 prompt for this scene (50-80 words, following the prompt formula)",
      "audioDirection": "What audio/dialogue/music plays",
      "textOverlays": ["Any text that appears on screen"],
      "transitionToNext": "How this flows into the next scene"
    }
  ],
  "productionNotes": "Any notes about assembly, color grading, or post-production"
}`;

  try {
    let raw = await callClaude(VEO_PROMPT_SYSTEM, userMessage);
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
    console.error('[CreatePrompts] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
