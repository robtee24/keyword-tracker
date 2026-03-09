import { authenticateRequest } from '../_config.js';
import { getBrandContext } from '../_brand.js';
import { getSupabase } from '../db.js';

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

const SYSTEM_PROMPT = `You are the world's best video advertising creative director AND an expert VEO 3.1 prompt engineer. You have decades of experience at Wieden+Kennedy, Droga5, and 72andSunny. Your ads have won Cannes Lions, D&AD, and Effies. You deeply understand persuasion psychology, visual storytelling, and what makes people stop scrolling.

=== MARKETING PSYCHOLOGY (MANDATORY — APPLY IN EVERY SCENE) ===

ATTENTION & HOOKS (Scene 1 must use one):
- Pattern Interrupt: Something visually unexpected that breaks the scroll — a sudden camera movement, an object appearing from an unexpected angle, a close-up of something textured or unusual
- Curiosity Gap: Start mid-action or mid-story so viewers NEED to see what happens
- Bold Visual Claim: Show a transformation, before/after, or dramatic result in the first 2 seconds
- Identity Trigger: Show someone the viewer identifies with, in a situation they recognize

PERSUASION FRAMEWORKS (weave into the narrative):
- Loss Aversion: Frame what the viewer is LOSING by not acting (e.g., show the painful status quo vividly)
- Social Proof: Show real-world evidence — busy environments, satisfied expressions, results on screen
- Authority: Professional environments, expert-looking presenters, polished product shots
- Reciprocity: Offer value before asking (education, entertainment, a useful insight)
- Scarcity/Urgency: Time-limited framing, exclusive access, "while supplies last"
- Anchoring: Show the expensive/hard way first, then your solution

EMOTIONAL DRIVERS (choose ONE primary emotion per ad):
- Aspiration: "This could be your life"
- Relief: "Finally, the problem is solved"
- Belonging: "Join the community"
- Fear of missing out: "Everyone else already..."
- Pride: "You deserve better"
- Curiosity: "Wait, how does that work?"

SPECIFICITY RULES:
- NEVER say "save time" → say "save 4 hours every week"
- NEVER say "easy to use" → SHOW someone using it effortlessly in 3 seconds
- NEVER say "trusted by thousands" → say "47,000 teams switched this quarter"
- NEVER describe generic stock footage → describe SPECIFIC scenes with SPECIFIC details
- Every visual must have a PURPOSE — what emotion or message does it convey?

=== VEO 3.1 PROMPT ENGINEERING ===

CORE FORMULA: [Cinematography] + [Subject with specific details] + [Specific Action] + [Environment with mood] + [Audio/Sound Design]

PROMPT DENSITY: 50-80 words per prompt. Under 30 = too vague (stock footage territory). Over 120 = confusing.

SHOT COMPOSITION: Specify exactly — "extreme close-up of hands typing on a MacBook keyboard, shallow depth of field, warm overhead lighting" NOT "someone using a computer"

CAMERA MOVEMENT: Be precise — "slow dolly-in from medium shot to close-up" or "tracking shot following subject left to right at eye level" NOT "camera moves"

LIGHTING: Always specify — "golden hour backlight with lens flare", "cool fluorescent office lighting", "high-key studio lighting with soft shadows"

AUDIO DIRECTION (VEO generates synchronized sound):
- Dialogue: Use exact quotes → "A woman in her 30s says, 'I used to spend hours on this.'"
- SFX: Label precisely → "SFX: crisp keyboard clicks, soft notification chime"
- Ambient: → "Ambient: distant city traffic, air conditioning hum"
- Music: → "Upbeat indie folk track with acoustic guitar, building energy"

TIMESTAMP PROMPTING for multi-beat scenes:
[00:00-00:02] Opening beat + audio
[00:02-00:04] Development + audio
[00:04-00:06] Escalation + audio
[00:06-00:08] Resolution + audio

SCENE TRANSITIONS FOR CHARACTER CONSISTENCY:
- Between scenes: use DIFFERENT camera angles, DIFFERENT locations, or scene changes (cut to new environment)
- NEVER require the same character in a different pose across scenes — this breaks consistency
- Use visual anchors: consistent color grading, recurring props, matching wardrobe pieces
- End each scene at a natural cut point: camera movement ending, subject exiting frame, scene change

TEXT OVERLAYS: Specify position, size, animation → "Bold white text appears center-screen: 'Stop wasting time.' — text scales up with a subtle bounce"

WHAT MAKES A BAD PROMPT (AVOID):
- "A person uses the product" → VAGUE, stock footage
- "Beautiful scenery" → MEANINGLESS, no emotion or purpose
- "Professional business setting" → GENERIC, could be anything
- "Happy customer testimonial" → LAZY, no specific visual direction

WHAT MAKES A GREAT PROMPT:
- "Close-up tracking shot of a woman's hands sliding a product box open on a marble countertop, revealing the device inside with a satisfying click. Warm side-lighting creates long shadows. SFX: cardboard sliding, magnetic latch clicking open. She whispers, 'Finally.'"
- "Aerial drone shot pulling back from a laptop screen showing analytics dashboard with green arrows, revealing a sunlit home office with floor-to-ceiling windows overlooking a garden. Ambient: birdsong, soft typing. Uplifting piano melody begins."

=== AD STRUCTURE RULES ===
- Scene 1 MUST contain the hook — visual pattern interrupt within first 2 seconds
- Show the product/service within first 5 seconds — not abstractly, but specifically
- Build emotional momentum: each scene should escalate engagement
- The final scene MUST have a clear, compelling CTA with urgency
- Sound-off friendly: all key information must be reinforced visually with text overlays
- Match the selected voice style and video style EXACTLY throughout

NEVER mention competitors. Always position the brand as the undisputed leader.
Respond with ONLY valid JSON — no markdown, no explanation.`;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const { projectId, siteUrl, idea, platforms, aspectRatio, voiceStyle, videoStyle, objectives } = req.body || {};
  if (!projectId || !idea) return res.status(400).json({ error: 'projectId and idea required' });

  let brandContext = '';
  try {
    brandContext = await getBrandContext(projectId);
  } catch { /* non-critical */ }

  // Fetch business objectives from DB if not passed from frontend
  let objectivesContext = '';
  if (objectives && typeof objectives === 'string' && objectives.trim()) {
    try {
      const parsed = JSON.parse(objectives);
      const parts = ['=== BUSINESS CONTEXT (USE THIS TO MAKE THE AD SPECIFIC) ==='];
      if (parsed.siteType) parts.push(`Business Type: ${parsed.siteType}`);
      if (parsed.primaryObjective) parts.push(`Primary Goal: ${parsed.primaryObjective}`);
      if (parsed.targetAudience) parts.push(`Target Audience: ${parsed.targetAudience}`);
      if (parsed.uniqueValue) parts.push(`Unique Value Proposition: ${parsed.uniqueValue}`);
      if (parsed.conversionGoals) parts.push(`Conversion Goals: ${parsed.conversionGoals}`);
      if (parsed.competitors) parts.push(`Competitors (NEVER mention positively): ${parsed.competitors}`);
      if (parsed.coreOfferings?.length) {
        parts.push('Products/Services:');
        for (const o of parsed.coreOfferings) {
          if (o.name) parts.push(`  - ${o.name}: ${o.description || ''} (keyword: ${o.topKeyword || 'n/a'})`);
        }
      }
      if (parsed.geographicFocus) parts.push(`Geographic Focus: ${parsed.geographicFocus}`);
      parts.push('USE these specifics in the ad — mention real product names, real benefits, real numbers where possible. NO GENERIC LANGUAGE.');
      objectivesContext = parts.join('\n');
    } catch { /* not valid JSON, use as-is */ }
  }

  // Also try to crawl the site for specific product/business details
  let siteContext = '';
  try {
    const siteResp = await fetch(siteUrl, {
      headers: { 'User-Agent': 'SEAUTO-VideoBot/1.0', Accept: 'text/html' },
      signal: AbortSignal.timeout(8000),
    });
    if (siteResp.ok) {
      const html = await siteResp.text();
      const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || '';
      const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || [])[1] || '';
      const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean).slice(0, 3);
      const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean).slice(0, 5);
      siteContext = `\n=== WEBSITE DETAILS (for specificity) ===\nSite: ${siteUrl}\nTitle: ${title}\nDescription: ${desc}\nMain Headlines: ${h1s.join(' | ')}\nSubheadlines: ${h2s.join(' | ')}`;
    }
  } catch { /* non-critical */ }

  const selectedPlatforms = (platforms || ['meta']).map(p => PLATFORM_SPECS[p]?.name || p).join(', ');
  const ratio = aspectRatio || '16:9';
  const totalLength = idea.estimatedLength || 30;
  const sceneCount = Math.ceil(totalLength / 8);

  const userMessage = `Create a complete video ad with scene-by-scene VEO 3.1 prompts for this brand.

AD CONCEPT:
Title: ${idea.title}
Hook: ${idea.hook || '(generate a powerful hook based on the concept)'}
Full Concept: ${idea.concept}
Target Audience: ${idea.targetAudience}
Emotional Angle: ${idea.emotionalAngle}
CTA: ${idea.cta}
Total Length: ${totalLength} seconds

PRODUCTION SETTINGS:
Platforms: ${selectedPlatforms}
Aspect Ratio: ${ratio}
Voice Style: ${voiceStyle || 'professional'}
Video Style: ${videoStyle || 'cinematic'}

${objectivesContext ? objectivesContext + '\n' : ''}${brandContext ? brandContext + '\n' : ''}${siteContext ? siteContext + '\n' : ''}

CRITICAL REQUIREMENTS:
1. Break the ad into ${sceneCount} scenes (each scene = one VEO generation, max 8 seconds each)
2. Each scene prompt MUST be 50-80 words — dense, specific, cinematic. NO VAGUE LANGUAGE.
3. Scene 1 MUST contain a SPECIFIC visual hook — not "something eye-catching" but the EXACT visual (e.g., "extreme close-up of coffee being poured into a ceramic mug, steam rising in slow motion, golden morning light streaming through a window")
4. Show the ACTUAL product/service by name within first 5 seconds — reference the real product, real UI, real features
5. Include SPECIFIC audio direction in each scene — exact dialogue quotes, specific SFX, named music genres
6. The emotional arc must BUILD: intrigue → problem/desire → solution/demonstration → proof → CTA
7. Final scene MUST have a compelling CTA with urgency framing
8. Text overlays should contain SPECIFIC claims with numbers when possible
9. For character consistency: use scene changes, different angles, different environments rather than the same character repositioning
10. Every visual choice must serve the persuasion framework — no decorative shots
11. Reference the brand's actual colors, style, and tone from the brand guidelines if provided
12. Apply ${voiceStyle} voice — this affects dialogue tone, music energy, and pacing
13. Apply ${videoStyle} style — this affects cinematography, lighting, color grading, and overall aesthetic

Respond with ONLY valid JSON:
{
  "overallConcept": "2-3 sentence summary explaining the psychological strategy behind the ad — what emotion it targets, what persuasion framework it uses, and why the structure works",
  "scenes": [
    {
      "sceneNumber": 1,
      "durationSeconds": 8,
      "description": "Plain English description of what happens, WHY this visual was chosen, and what psychological effect it achieves",
      "prompt": "The complete VEO 3.1 prompt — 50-80 words, HYPER-SPECIFIC cinematography + subject + action + environment + audio. NO VAGUE LANGUAGE.",
      "audioDirection": "Exact audio: specific dialogue in quotes, named SFX, music genre and energy level",
      "textOverlays": ["Specific text with numbers/claims that appears on screen"],
      "transitionToNext": "Exact transition type (hard cut, match cut, whip pan, dissolve)"
    }
  ],
  "productionNotes": "Assembly notes: color grading consistency, audio mixing, pacing rhythm, and overall emotional arc"
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

    return res.status(200).json(result);
  } catch (err) {
    console.error('[CreatePrompts] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
