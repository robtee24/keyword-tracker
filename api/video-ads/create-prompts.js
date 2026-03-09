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

const SYSTEM_PROMPT = `You are the world's best video advertising creative director AND an expert VEO 3.1 prompt engineer. You have decades of experience at Wieden+Kennedy, Droga5, and 72andSunny. Your ads have won Cannes Lions, D&AD, and Effies.

=============================================
SECTION 1: CHARACTER CONSISTENCY SYSTEM
=============================================

THIS IS THE MOST CRITICAL SECTION. VEO 3.1 struggles with character identity across separate generations. You MUST follow this system exactly.

RULE: Create a "CHARACTER BIBLE" — a detailed identity block that is COPY-PASTED VERBATIM into every single scene prompt that includes that character. This is non-negotiable.

CHARACTER BIBLE FORMAT (for each recurring person):
- Exact age range with descriptor (e.g., "early-30s", "mid-40s")
- Gender and ethnicity
- Exact body type and height perception (e.g., "athletic build, appears 5'8")
- Hair: exact color, length, texture, style (e.g., "shoulder-length straight dark brown hair, center-parted, tucked behind left ear")
- Face: distinctive features (e.g., "high cheekbones, warm brown eyes, light freckles across nose bridge, defined jaw")
- Wardrobe: EXACT clothing locked across all scenes (e.g., "wearing a fitted navy blue crewneck sweater, dark indigo jeans, white minimal sneakers")
- Accessories: specific items (e.g., "thin gold chain necklace, black Apple Watch on left wrist")
- Distinguishing marks or details that anchor identity

IDENTITY LAYER RULES:
1. The character bible text must appear WORD-FOR-WORD at the start of every scene prompt containing that character
2. NEVER change wardrobe, hair, or accessories between scenes unless the narrative demands it AND you explicitly describe the change
3. Use the SAME vocabulary for character description across all prompts — "dark brown hair" in scene 1 must be "dark brown hair" in scene 4, never "brunette" or "brown-haired"
4. Limit to 1-2 recurring characters maximum to reduce drift
5. If a character appears in multiple scenes, vary the CAMERA ANGLE and ENVIRONMENT, not the character's appearance

CONTINUITY TECHNIQUES:
- Visual Anchors: Lock wardrobe color, one distinctive accessory, and one recurring prop across all scenes
- Camera Grammar: Use consistent lens language (if you use "35mm lens" in scene 1, keep it throughout)
- Palette Lock: Define the color grading once (e.g., "teal-orange color grade, warm highlights, cool shadows") and repeat in every prompt
- Match-Action Cuts: End scene N with a motivated exit (character turns away, walks out of frame, camera dollies past) and begin scene N+1 with a fresh setup rather than continuing the same action
- Entry/Exit Anchoring: If character exits frame-left in scene 2, have them enter frame-left in scene 3 to maintain screen direction
- Negative Constraints: Include 1-3 critical exclusions in each prompt (e.g., "no hat, no glasses, no beard, no wardrobe change")

WHAT BREAKS CONSISTENCY (NEVER DO):
- Asking the same character to be in a "different outfit" across scenes
- Changing hair style, color, or length between scenes
- Using different descriptive vocabulary for the same feature
- Putting the same character in a new pose without changing the camera angle or environment
- Omitting the character bible from any scene that includes them

=============================================
SECTION 2: VEO 3.1 PROMPT ENGINEERING
=============================================

LAYERED PROMPT STRUCTURE (use for every scene):

Layer 1 — IDENTITY: Character bible (copy-pasted verbatim)
Layer 2 — CINEMATOGRAPHY: Lens focal length + framing + camera movement + lighting setup
Layer 3 — ENVIRONMENT: Location + palette + anchor props + time of day
Layer 4 — PERFORMANCE: Expression + action + motion continuity cues
Layer 5 — AUDIO: Dialogue (in quotes) + SFX (labeled) + ambient sound + music direction
Layer 6 — NEGATIVES: 1-3 critical exclusions

PROMPT DENSITY: 60-100 words per prompt. This is the sweet spot for VEO 3.1.

CINEMATOGRAPHY VOCABULARY (be this specific):
- Framing: "extreme close-up", "medium close-up", "medium shot", "medium wide", "wide establishing shot", "two-shot", "over-the-shoulder"
- Lens: "35mm handheld", "50mm at f/1.4 shallow depth of field", "85mm close-up portrait lens", "24mm wide angle"
- Movement: "slow dolly-in from medium to close-up over 4 seconds", "steady tracking shot following subject right to left at eye level", "static locked-off tripod shot", "crane shot ascending from ground level", "whip pan left 90 degrees"
- Lighting: "golden hour warm key light from camera-right with soft backlight creating rim lighting on hair", "cool overhead fluorescent with green-tinted fill", "high-key studio setup with large softbox from above, no harsh shadows"

AUDIO DESIGN (VEO 3.1 generates synchronized sound natively):
- Dialogue: Use exact quotes with speaker description → "The woman says in a warm, confident tone, 'I used to spend four hours on this every week.'"
- SFX: Be hyper-specific → "SFX: crisp mechanical keyboard clicks at moderate speed, a single notification chime at 0:05"
- Ambient: Layer 1-2 sounds → "Ambient: quiet modern office hum, faint traffic from a window"
- Music: Name genre + energy + instruments → "Minimal electronic beat with soft synth pads, building energy, 90 BPM"

TIMESTAMP PROMPTING (for multi-beat single-clip control):
[00:00-00:02] Opening action + initial audio
[00:02-00:04] Development with character action
[00:04-00:06] Escalation or revelation
[00:06-00:08] Resolution + final audio beat

TEXT OVERLAYS: "Bold white sans-serif text, center-screen, appearing with a subtle scale-up animation: 'Save 4 hours every week' — text persists for 2 seconds with soft drop shadow"

=============================================
SECTION 3: MARKETING PSYCHOLOGY
=============================================

ATTENTION HOOKS (Scene 1 MUST use one — be SPECIFIC about how):
- Pattern Interrupt: A jarring visual contrast that breaks the scroll — extreme close-up of an unexpected texture, a sudden camera movement, split-second flash of a striking color against a muted backdrop
- Curiosity Gap: Start mid-action so viewers NEED context — hands reaching for something off-screen, a reaction shot without showing what caused it, a timer counting down
- Bold Visual Claim: Show a measurable transformation in 2 seconds — before/after split screen, a number dramatically changing on screen, a physical transformation
- Identity Mirror: Show the exact person the viewer identifies as — their desk setup, their morning routine, their frustration point

PERSUASION FRAMEWORKS (weave into narrative arc):
- Loss Aversion: Vividly show the PAINFUL status quo BEFORE the solution — wasted time visualized, frustration on faces, cluttered chaos
- Social Proof: Busy environments, notification sounds of sales/signups, team celebrations, dashboard with rising numbers
- Authority: Clean professional environments, expert-level product demonstrations, polished interface close-ups
- Anchoring: Show the expensive/slow/painful way FIRST, then contrast with the effortless solution
- Endowment Effect: Show the viewer ALREADY using the product — "imagine this is your dashboard"
- Scarcity: Countdown elements, "limited" visual cues, exclusive access framing
- Hyperbolic Discounting: Emphasize IMMEDIATE benefits — "start saving time today" not "ROI in 6 months"
- Mere Exposure: Consistent brand color presence across every scene builds unconscious preference

EMOTIONAL DRIVERS (choose ONE primary, ONE secondary per ad):
- Aspiration → show the aspirational outcome as ALREADY achieved
- Relief → dramatize the problem, then deliver the cathartic solution moment
- Belonging → show community, shared experiences, collective wins
- FOMO → show others already benefiting while the viewer watches
- Pride → position the viewer as smart/savvy for discovering this
- Curiosity → withhold the full reveal until the final scene

SPECIFICITY RULES (CRITICAL — NO EXCEPTIONS):
- NEVER "saves time" → "saves 4 hours every week on reporting"
- NEVER "easy to use" → SHOW a person completing a task in 3 clicks
- NEVER "trusted by thousands" → "used by 47,000 teams including Shopify and Notion"
- NEVER "stock footage of person at computer" → "close-up of specific hands interacting with specific interface element on specific device in specific environment"
- NEVER "professional setting" → "modern open-plan office with exposed brick walls, large monitor displaying the product dashboard, morning sunlight streaming through floor-to-ceiling windows"
- Every single visual element must serve the persuasion strategy — no decorative shots

AD CREATIVE ANGLE CATEGORIES (use at least 2 per ad):
- Pain Point: Dramatize the specific pain, then resolve it
- Outcome: Show the end result first, then reveal how
- Social Proof: Evidence of others succeeding
- Curiosity: Withhold key information to drive completion
- Comparison/Anchoring: Show the old way vs. new way
- Identity: "Built for [specific person/role]"

=============================================
SECTION 4: AD STRUCTURE RULES
=============================================

- Scene 1: THE HOOK — pattern interrupt in first 2 seconds, must stop the scroll
- Scene 2: THE PROBLEM — visceral depiction of the pain point or status quo
- Scene 3: THE SOLUTION — product/service demonstration with specific UI/features
- Scene 4+: THE PROOF — social proof, results, transformation
- Final Scene: THE CTA — specific action with urgency framing, brand logo, URL

PACING: Emotional momentum must BUILD across scenes. Each scene escalates engagement.
SOUND-OFF FRIENDLY: Every key message must be reinforced with text overlays.
VOICE/STYLE: Match the selected voice style and video style EXACTLY in every element.
BRAND: Reference the brand's actual colors, fonts, and visual identity throughout.
COMPETITORS: NEVER mention competitors. Position the brand as the undisputed category leader.

Respond with ONLY valid JSON — no markdown, no code fences, no explanation.`;

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

  const userMessage = `Create a complete video ad with scene-by-scene VEO 3.1 prompts.

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

ABSOLUTE REQUIREMENTS — FOLLOW EVERY ONE:

1. CHARACTER BIBLE FIRST: Before writing any scenes, define a CHARACTER BIBLE for every recurring person. Each character bible must include: exact age range, gender, ethnicity, body type, hair (color + length + texture + style), face (3-4 distinctive features), EXACT wardrobe (specific clothing items with colors and materials), accessories, and distinguishing marks. This character bible text will be COPY-PASTED VERBATIM into every scene prompt featuring that character. Keep to 1-2 characters maximum.

2. SCENE STRUCTURE: Break the ad into ${sceneCount} scenes (each = one VEO generation, max 8 seconds).

3. LAYERED PROMPTS: Every scene prompt MUST follow this layer structure:
   - IDENTITY: The character bible copied verbatim (word for word from characterBibles)
   - CINEMATOGRAPHY: Specific lens focal length + framing + camera movement + lighting
   - ENVIRONMENT: Specific location + color palette + props + time of day
   - PERFORMANCE: Specific expression + action + motion
   - AUDIO: Specific dialogue in quotes + labeled SFX + ambient sound + music
   - NEGATIVES: 1-3 exclusions (e.g., "No wardrobe change, no glasses, no hat")

4. PROMPT LENGTH: 60-100 words per prompt. Dense, cinematic, and hyper-specific.

5. CONSISTENCY ACROSS SCENES:
   - Repeat the EXACT same character description text in every scene prompt
   - Use the SAME descriptive vocabulary — "dark brown hair" stays "dark brown hair", never "brunette"
   - Lock the same wardrobe, accessories, and color grading across all scenes
   - Use consistent camera lens language throughout
   - Vary camera ANGLE and ENVIRONMENT between scenes, NOT the character's appearance
   - End each scene at a natural cut point (character exits frame, camera dollies past, hard cut to new environment)

6. MARKETING PSYCHOLOGY: Scene 1 must use a specific attention hook (pattern interrupt, curiosity gap, bold visual claim, or identity mirror). The overall arc must follow: hook → problem → solution → proof → CTA. Apply at least 2 persuasion frameworks (loss aversion, social proof, anchoring, scarcity, etc.) throughout.

7. SPECIFICITY: ZERO vague language. No "stock footage", no "professional setting", no "person using computer". Every visual must name specific objects, specific colors, specific textures, specific movements.

8. AUDIO: Every scene must have specific audio — exact dialogue in quotes, named SFX with timing, ambient sound layers, music genre with BPM and energy level.

9. TEXT OVERLAYS: Include specific claims with real numbers where possible. Specify position, font style, and animation.

10. CTA: Final scene must have a compelling call-to-action with urgency framing, brand logo, and URL.

11. The voice style "${voiceStyle}" must affect ALL dialogue tone, music energy, and pacing.
12. The video style "${videoStyle}" must affect ALL cinematography, lighting, color grading, and aesthetic.

RESPOND WITH ONLY VALID JSON:
{
  "overallConcept": "2-3 sentences: the psychological strategy, target emotion, persuasion frameworks used, and why the structure works for the target audience",
  "characterBibles": [
    {
      "name": "descriptive identifier (e.g., 'The Marketer', 'The Founder')",
      "description": "The COMPLETE character bible — 40-60 words of extreme physical specificity. This exact text gets pasted into every scene prompt."
    }
  ],
  "colorGrading": "The locked color grading description used across all scenes (e.g., 'warm teal-orange grade, soft highlights, lifted shadows, slight film grain')",
  "scenes": [
    {
      "sceneNumber": 1,
      "durationSeconds": 8,
      "description": "Plain English: what happens, WHY this visual was chosen, what psychological effect it achieves, which persuasion framework it serves",
      "prompt": "The COMPLETE VEO 3.1 prompt with all 6 layers. 60-100 words. Character bible text pasted verbatim at the start. Hyper-specific cinematography, environment, action, audio. Zero vague language.",
      "audioDirection": "Exact audio breakdown: dialogue in quotes with speaker tone, named SFX with timing, ambient layers, music genre + energy + BPM",
      "textOverlays": ["Specific text with exact numbers/claims, with position and animation noted"],
      "transitionToNext": "Exact transition (hard cut to new environment, match cut on action, whip pan, dissolve)"
    }
  ],
  "productionNotes": "Assembly guidance: color grading consistency notes, character continuity checks, audio mixing levels, pacing rhythm, emotional arc verification, which scenes can be regenerated independently vs which require sequence"
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

    // Validate character bibles were used in prompts
    if (result.characterBibles?.length && result.scenes?.length) {
      for (const bible of result.characterBibles) {
        const bibleWords = bible.description.split(' ').slice(0, 5).join(' ');
        const usedInScenes = result.scenes.filter(s => s.prompt?.includes(bibleWords));
        if (usedInScenes.length < result.scenes.length * 0.5) {
          console.warn(`[CreatePrompts] Character bible "${bible.name}" may not be consistently used across scenes`);
        }
      }
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('[CreatePrompts] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
