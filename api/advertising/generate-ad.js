import { authenticateRequest } from '../_config.js';

export const config = { maxDuration: 120 };

const PLATFORM_SPECS = {
  meta: {
    name: 'Meta (Facebook/Instagram)',
    fields: [
      { key: 'primaryText', label: 'Primary Text', charLimit: 125, recommended: 125, maxAllowed: 2200, purpose: 'The main ad copy shown above the image/video. First ~125 characters visible before "See More". Front-load the hook — this is what stops the scroll.' },
      { key: 'headline', label: 'Headline', charLimit: 40, recommended: 40, maxAllowed: 255, purpose: 'Appears below the image/video. Short, punchy call-to-action or value proposition. This is the last thing they read before clicking.' },
      { key: 'description', label: 'Description', charLimit: 30, recommended: 30, maxAllowed: 255, purpose: 'Shown below the headline in some placements. Reinforces the offer or handles an objection. Not always visible.' },
    ],
    placements: ['Feed', 'Stories', 'Reels', 'Right Column'],
    imageSpecs: { feed: '1080x1080', stories: '1080x1920' },
  },
  tiktok: {
    name: 'TikTok',
    fields: [
      { key: 'adText', label: 'Ad Text', charLimit: 100, recommended: 80, maxAllowed: 100, purpose: 'The text overlay shown above the video. Keep it punchy — TikTok users scan fast. Use emojis and casual language.' },
      { key: 'displayName', label: 'Display Name', charLimit: 40, recommended: 20, maxAllowed: 40, purpose: 'Your brand name shown on the ad. Keep it recognizable.' },
    ],
    placements: ['In-Feed', 'TopView', 'Spark Ads'],
    imageSpecs: { video: '1080x1920' },
  },
  linkedin: {
    name: 'LinkedIn',
    fields: [
      { key: 'introText', label: 'Intro Text', charLimit: 150, recommended: 150, maxAllowed: 600, purpose: 'The main copy above the image/video. First ~150 characters visible before truncation. Lead with a professional insight, stat, or question.' },
      { key: 'headline', label: 'Headline', charLimit: 70, recommended: 70, maxAllowed: 200, purpose: 'Below the image. Should convey the value proposition clearly. B2B audiences expect substance over hype.' },
      { key: 'description', label: 'Description', charLimit: 100, recommended: 100, maxAllowed: 300, purpose: 'Additional context shown in some placements. Handles objections or adds social proof.' },
    ],
    placements: ['Feed', 'Right Rail', 'Message Ads'],
    imageSpecs: { feed: '1200x627', square: '1080x1080' },
  },
  x: {
    name: 'X (Twitter)',
    fields: [
      { key: 'tweetText', label: 'Tweet Text', charLimit: 280, recommended: 280, maxAllowed: 280, purpose: 'The full ad copy. Twitter users expect concise, conversational copy. Use threads for longer stories.' },
      { key: 'headline', label: 'Card Headline', charLimit: 70, recommended: 70, maxAllowed: 70, purpose: 'Website card headline shown below the image. Make it click-worthy and clear.' },
      { key: 'description', label: 'Card Description', charLimit: 200, recommended: 200, maxAllowed: 200, purpose: 'Additional text on the website card. Expands on the headline with benefits or social proof.' },
    ],
    placements: ['Timeline', 'Search', 'Profile'],
    imageSpecs: { card: '1200x628' },
  },
};

async function callClaude(systemPrompt, userMessage) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

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
        max_tokens: 6000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => 'unknown');
      throw new Error(`Claude API error (${response.status}): ${detail}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  } finally {
    clearTimeout(timeout);
  }
}

const SYSTEM_PROMPT = `You are an elite performance creative strategist who generates high-converting ad creative.

AD COPY FRAMEWORKS:
- PAS (Problem-Agitate-Solve): [Problem] → [Agitate] → [Solution] → [CTA]
- BAB (Before-After-Bridge): [Current pain] → [Desired future] → [Product as bridge]
- Social Proof Lead: [Impressive stat/testimonial] → [What you do] → [CTA]

HEADLINE RULES:
- Specific ("Cut reporting time 75%") beats vague ("Save time")
- Benefits ("Ship code faster") beat features ("CI/CD pipeline")
- Active voice, include numbers when possible
- Never exceed character limits

ANGLE CATEGORIES (use at least 3 different angles across variations):
- Pain point: "Stop wasting time on X"
- Outcome: "Achieve Y in Z days"
- Social proof: "Join 10,000+ teams who..."
- Curiosity: "The X secret top companies use"
- Comparison: "Unlike X, we do Y"
- Urgency: "Limited time: get X free"
- Identity: "Built for [specific role]"

DESCRIPTIONS should complement headlines, not repeat them. Use to:
- Add proof points (numbers, testimonials)
- Handle objections ("No credit card required")
- Reinforce CTAs

VIDEO SCRIPT RULES:
- Hook (0-3s): Pattern interrupt, question, or bold statement
- Problem (3-8s): Relatable pain point
- Solution (8-20s): Show product/benefit
- CTA (20-30s): Clear next step
- Captions always (85% watch without sound)

PSYCHOLOGY TRIGGERS:
- Loss aversion: Frame what they'll miss
- Anchoring: Show comparison prices
- Social proof: Numbers, logos, testimonials
- Scarcity: Limited availability
- Authority: Expert endorsement

Respond ONLY with valid JSON. No markdown, no code fences.`;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const {
    platform,
    siteUrl,
    objective,
    targetAudience,
    valueProposition,
    creativeType,
    landingPageUrl,
    additionalContext,
  } = req.body || {};

  if (!platform || !PLATFORM_SPECS[platform]) {
    return res.status(400).json({ error: `Invalid platform. Use: ${Object.keys(PLATFORM_SPECS).join(', ')}` });
  }

  const spec = PLATFORM_SPECS[platform];

  const fieldDescriptions = spec.fields
    .map(f => `- ${f.label} (key: "${f.key}"): max ${f.charLimit} chars recommended (${f.maxAllowed} max). Purpose: ${f.purpose}`)
    .join('\n');

  const userMessage = `Generate 3 complete ad variations for ${spec.name}.

BUSINESS: ${siteUrl || 'Not specified'}
OBJECTIVE: ${objective || 'Drive conversions'}
TARGET AUDIENCE: ${targetAudience || 'Not specified'}
VALUE PROPOSITION: ${valueProposition || 'Not specified'}
CREATIVE TYPE: ${creativeType || 'static'}
LANDING PAGE: ${landingPageUrl || siteUrl || 'Not specified'}
ADDITIONAL CONTEXT: ${additionalContext || 'None'}

PLATFORM TEXT FIELDS:
${fieldDescriptions}

Each variation MUST use a DIFFERENT angle (e.g., pain point, outcome, social proof).
Each text field MUST respect the character limit.
${creativeType === 'video' ? `
For video creative, also include a detailed script for each variation:
- Hook (0-3s): What grabs attention
- Problem (3-8s): The pain point
- Solution (8-20s): How the product solves it
- CTA (20-30s): Clear next step
- Visual direction for each shot
- Estimated duration: 15-30 seconds
` : `
For static creative, include for each variation:

IMAGE DESCRIPTION (imageDescription):
- Describe a premium, photorealistic background image
- CRITICAL: The image must contain ZERO text, words, letters, numbers, logos, or typography
- Describe only the visual scene, lighting, mood, composition, and subject
- Think Apple/Nike campaign photography quality
- Ensure the scene leaves negative space for text overlay

TEXT OVERLAY (textOverlay):
- A short, punchy headline or CTA (max 6-8 words) that will be rendered as CSS text on top of the clean image
- This is NOT baked into the image — it is overlaid with pixel-perfect typography by the frontend
- Make it the single most impactful line from the ad
- Examples: "Ship 10x Faster", "Your Team Will Thank You", "Join 50,000+ Teams"
`}

Return JSON:
{
  "variations": [
    {
      "angle": "<which angle this uses>",
      "texts": {
        ${spec.fields.map(f => `"${f.key}": "<copy within ${f.charLimit} chars>"`).join(',\n        ')}
      },
      "charCounts": {
        ${spec.fields.map(f => `"${f.key}": <number>`).join(',\n        ')}
      },
      ${creativeType === 'video' ? `"script": {
        "hook": "<0-3s script>",
        "problem": "<3-8s script>",
        "solution": "<8-20s script>",
        "cta": "<20-30s script>",
        "visualDirection": "<shot-by-shot description>",
        "duration": "<estimated seconds>"
      }` : `"imageDescription": "<detailed visual scene description — NO TEXT in the image>",
      "textOverlay": "<short 6-8 word headline/CTA for CSS overlay>"`}
    }
  ],
  "platformTips": ["<2-3 platform-specific optimization tips>"]
}`;

  try {
    let raw = await callClaude(SYSTEM_PROMPT, userMessage);
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      else throw new Error('Failed to parse AI response');
    }

    return res.status(200).json({
      ...parsed,
      platform,
      platformSpec: spec,
    });
  } catch (err) {
    console.error('[AdGen] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
