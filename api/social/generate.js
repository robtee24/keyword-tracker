import { getSupabase } from '../db.js';
import { authenticateRequest } from '../_config.js';
import { deductCredits } from '../_credits.js';

export const config = { maxDuration: 60 };

const PLATFORM_SPECS = {
  instagram: { charLimit: 2200, hashtagRange: '20-30', bestTimes: '11am-1pm, 7-9pm', style: 'Visual-first. Reels get 2x reach of static posts. First frame must hook. Saves and shares matter more than likes. Use all features. Keep it native and authentic — overly produced content underperforms.' },
  linkedin: { charLimit: 3000, hashtagRange: '3-5', bestTimes: 'Tue-Thu 7-8am, 12pm, 5-6pm', style: 'Professional but personal. First line is everything (hook before "see more"). Use line breaks for readability. 1200-1500 chars performs well. No external links in post body. Personal stories with business lessons outperform corporate speak. Comments > reactions > clicks for the algorithm.' },
  x: { charLimit: 280, hashtagRange: '0-2', bestTimes: 'Varies — engagement in first 30 min matters most', style: 'Short, punchy, opinionated. Tweets under 100 chars get more engagement. Use visuals to stop the scroll. Hot takes and real-time commentary work best. Quote tweets with insight beat plain retweets.' },
  facebook: { charLimit: 63206, hashtagRange: '1-3', bestTimes: '1-4pm weekdays', style: 'Community-oriented. Native video and live video perform best. Discussion-prompting questions drive reach. No external links in post body (kills reach). Cross-posted content underperforms adapted content.' },
  tiktok: { charLimit: 4000, hashtagRange: '3-5', bestTimes: '7-9am, 12-3pm, 7-11pm', style: 'Native, raw, unpolished feel. Hook in first 1-2 seconds or lose them. Keep under 30 seconds to start. Use trending sounds and formats. Vertical only (9:16). Educational content in entertaining wrappers outperforms. POV and day-in-the-life formats work well.' },
  pinterest: { charLimit: 500, hashtagRange: '2-5', bestTimes: 'Evergreen — SEO-driven', style: 'Visual discovery and SEO-rich. High-quality vertical images. Clear, benefit-driven descriptions. Think "inspiration + action" — users are planners and savers.' },
};

const PLATFORM_VIDEO_STRATEGY = {
  instagram: 'Instagram Reels: Hook in first frame (pattern interrupt or bold claim). Structure: Hook (0-2s) → Setup (2-5s) → Value (5-25s) → CTA (25-30s). Native, slightly raw aesthetic outperforms polished production. Use trending audio when relevant. Fast cuts and text overlays perform well. Optimize for saves and shares.',
  linkedin: 'LinkedIn Video: Professional but human. Open with a surprising stat or contrarian statement. Tell a story with a business lesson. Keep it educational and insight-driven. Talking-head + B-roll works well. Subtitles are essential (most watch muted). End with a question to drive comments.',
  x: 'X/Twitter Video: Stop the scroll in the first second. Short and punchy (under 60s ideal). Pair with a strong tweet caption. Text overlays critical since most watch muted. Controversial or surprising openings get shared. Memes and humor work if on-brand.',
  facebook: 'Facebook Video: Native video gets 10x more reach than links. Open with motion and intrigue — first 3 seconds determine if people stop scrolling. Discussion-prompting content drives comments which boost reach. Live-feel and behind-the-scenes resonate. Subtitles required.',
  tiktok: 'TikTok Video: Hook in the literal first second — "Wait..." "Did you know..." or a visual pattern interrupt. Trending sounds and formats multiply reach. Keep it under 30s to start. Raw > polished. POV format, day-in-the-life, and "things I wish I knew" structures work. Loop the ending into the beginning for replay value. Comment-bait CTA ("Tell me if I\'m wrong").',
  pinterest: 'Pinterest Video Pin: Vertical (2:3 or 9:16). Tutorial and how-to format works best. Clear title overlay in first frame. Step-by-step visual storytelling. Evergreen content outperforms trendy. SEO-driven: include keywords in first frame text and description.',
};

const BASE_PROMPT = (platform, postType) => {
  const spec = PLATFORM_SPECS[platform] || {};
  return `You are an elite ${platform} content strategist who reverse-engineers viral content patterns. Create a complete, publish-ready ${postType} for ${platform}.

PLATFORM RULES:
- Character limit: ${spec.charLimit || 'standard'}
- Hashtag count: ${spec.hashtagRange || '3-5'}
- Format: ${postType}
- Best posting times: ${spec.bestTimes || 'varies'}
- Platform style: ${spec.style || ''}

HOOK FORMULAS (use one of these proven patterns for the opening):
- Curiosity: "The real reason [outcome] happens isn't what you think." / "Nobody talks about [insider knowledge]."
- Story: "Last week, [unexpected thing] happened." / "3 years ago, I [past state]. Today, [current state]."
- Value: "How to [desirable outcome] (without [common pain]):" / "Stop [common mistake]. Do this instead:"
- Contrarian: "Unpopular opinion: [bold statement]" / "[Common advice] is wrong. Here's why:"
- Social Proof: "We [achieved result] in [timeframe]. Here's the full story:"

WRITING VOICE — "Smart friend who figured something out":
- Write like you're texting advice to a friend, not lecturing
- Be SPECIFIC, not vague: "$47,329" not "good revenue", "47 days" not "a while", "2,847 people" not "a lot"
- Short. Breathe. Land. One idea per sentence. Use line breaks. Let important points stand alone.
- Write from EMOTION first — how you felt, not just what happened. Use words like: frustrated, obsessed, terrified, excited
- Create rhythm: short, short, longer explanation

PSYCHOLOGICAL PRINCIPLES TO APPLY:
- Loss aversion: Frame what they'll LOSE by not acting (losses feel 2x stronger than gains)
- Curiosity gap: Open a loop in the hook that the content resolves
- Social proof: Reference numbers, results, others doing this
- Reciprocity: Give genuine value before any ask
- Peak-end rule: Design a memorable peak moment and a strong ending/CTA
- Pattern interrupt: The first line must BREAK the scroll pattern

CTA PATTERNS (end with one):
- Question: "What would you add?" / "Agree or disagree?"
- Save: "Save this for later"
- Share: "Tag someone who needs this"
- Engagement bait: "Comment [word] and I'll send you..."

The content must feel 100% authentic and human. Match the exact tone, cadence, and energy of top-performing native ${platform} content.`;
};

const VIDEO_RESPONSE_FORMAT = `
Respond with ONLY valid JSON:
{
  "content": "<the full post caption/text, ready to copy and paste — use hook formula, specific language, emotional writing, strong CTA>",
  "hashtags": ["<relevant hashtags>"],
  "format": "<the format used>",
  "charCount": <number of characters in content>,
  "tips": "<1-2 sentences of posting tips based on platform best practices>",
  "bestTime": "<suggested posting time based on platform data>",
  "script": "<detailed scene-by-scene video script narrative following the Hook→Setup→Value→Peak→CTA structure>",
  "shots": [
    {
      "time": "<e.g. 0-2s>",
      "visual": "<extremely detailed visual: camera angle (dolly in, aerial, close-up, tracking shot), subjects, colors, lighting (golden hour, moody, bright), motion (slow-mo, fast cut, zoom), setting, composition>",
      "text_overlay": "<short punchy text on screen — max 8 words, highlight numbers/results>",
      "audio": "<music mood (upbeat, cinematic, lo-fi), voiceover text if any, or sound effects>",
      "purpose": "<why this shot matters: hook, tension, value delivery, peak moment, CTA>"
    }
  ]
}

CRITICAL for the shots array:
- Include 4-8 shots covering the full video duration
- Shot 1 MUST be the hook — a pattern interrupt that stops the scroll in under 2 seconds
- Include one clear PEAK MOMENT shot that delivers the "wow" or "aha"
- Final shot must drive a specific action (follow, comment, share, save)
- Each shot "visual" must be cinematic and production-ready — describe exactly what the AI video generator should create
- Include camera motion, lighting direction, color temperature, and depth of field
- Build energy/stakes progressively through the sequence
- The shots will be sent directly to an AI video generator, so visual specificity and cinematic language are essential
- Text overlays should work standalone (most viewers watch muted)`;

const STATIC_RESPONSE_FORMAT = `
Respond with ONLY valid JSON:
{
  "content": "<the full post caption/text, ready to copy and paste>",
  "hashtags": ["<relevant hashtags>"],
  "format": "<the format used>",
  "charCount": <number of characters in content>,
  "tips": "<1-2 sentences of posting tips>",
  "bestTime": "<suggested posting time>",
  "imagePrompt": "<a detailed visual scene description for an AI image generator — MUST CONTAIN ZERO TEXT, WORDS, LETTERS, OR TYPOGRAPHY>",
  "textOverlay": "<short 5-8 word headline or CTA to overlay on the image via CSS>"
}

CRITICAL for imagePrompt:
- Describe ONLY the visual scene: subjects, composition, lighting, mood, colors, style
- DO NOT include any text, words, letters, numbers, logos, or typography in the image description
- The AI image generator produces garbled text — all text will be added separately via CSS overlay
- Include art style (photorealistic, flat illustration, 3D render, watercolor, etc.)
- Specify color palette, composition, and focal point
- Match the visual style to ${'{platform}'} aesthetics
- Think premium ad photography: Apple, Nike, Glossier quality

CRITICAL for textOverlay:
- A short, punchy headline or CTA (5-8 words max)
- This will be rendered with pixel-perfect CSS typography on top of the clean image
- Make it the single most impactful line from the post
- Examples: "Your Mornings, Reinvented", "Join 50K+ Pros", "Stop Guessing, Start Growing"`;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const { siteUrl, projectId, platform, postType, topic, ideaContext, mediaType, videoStyle } = req.body || {};
  if (!siteUrl || !platform || !postType || !topic) {
    return res.status(400).json({ error: 'siteUrl, platform, postType, and topic are required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });

  const isVideo = mediaType === 'video';

  const videoStrategy = PLATFORM_VIDEO_STRATEGY[platform] || '';

  const VIDEO_STYLE_GUIDES = {
    ugc: 'UGC (User-Generated Content) style: Raw, authentic, phone-shot aesthetic. Handheld camera feel, natural lighting, casual framing. Looks like a real person made it — NOT a brand. First-person POV, unscripted energy, jump cuts, real environments (bedroom, office, street). This style builds trust and relatability.',
    cinematic: 'Cinematic style: Polished, dramatic, high-production look. Wide establishing shots, shallow depth of field, color grading, smooth camera movements (dolly, gimbal, drone). Dramatic lighting, slow motion for impact moments. Epic music swells. Think movie trailer meets brand storytelling.',
    'talking-head': 'Talking Head style: Person speaking directly to camera. Clean background or contextual setting. Eye-level framing, good lighting on face. Confidence and personality drive engagement. Cut between close-up and medium shots. Text overlays reinforce key points. Subtitles essential.',
    tutorial: 'Tutorial / How-To style: Screen recordings, close-up demonstrations, step-by-step visuals. Numbered steps with clear text overlays. Before/after comparisons. Clean, well-lit product or screen shots. Instructional voiceover or text-only with music.',
    'product-demo': 'Product Demo style: Hero shots of the product in action. Close-ups on key features. Smooth transitions between use cases. Clean backgrounds or lifestyle contexts. Show the transformation or result the product delivers. Aspirational but believable.',
    'motion-graphics': 'Motion Graphics style: Animated text, icons, shapes, and data visualizations. No live footage needed. Bold typography, brand colors, smooth transitions. Kinetic text that reinforces the voiceover or message. Modern, clean, and professional.',
    'broll-montage': 'B-Roll Montage style: Visual storytelling without a person on camera. Atmospheric footage, product shots, environment scenes, hands-in-action clips. Mood-driven editing with music. Evocative and cinematic. Text overlays carry the narrative.',
    'before-after': 'Before/After Transformation style: Split-screen or sequential reveal. Clear "before" state (problem, messy, old) contrasted with "after" state (solved, clean, new). Dramatic reveal moment. Satisfying visual payoff. Works great with swipe or transition effects.',
  };

  let extraInstructions = '';
  if (isVideo) {
    const styleGuide = VIDEO_STYLE_GUIDES[videoStyle] || VIDEO_STYLE_GUIDES.ugc;
    extraInstructions = `\n\nThis is a VIDEO post. You are creating a viral-worthy video script.

VIDEO STYLE:
${styleGuide}
All shot descriptions, camera directions, and visual details MUST match this style. The style should inform every creative decision.

PLATFORM VIDEO STRATEGY:
${videoStrategy}

VIDEO STRUCTURE (proven framework):
1. HOOK (0-2s): Pattern interrupt — bold visual or statement that stops the scroll instantly. Use one of the hook formulas above adapted for video. This is the MOST IMPORTANT part — if you lose them here, nothing else matters.
2. SETUP (2-5s): Quick context — establish the promise of value. Create a curiosity gap or tension that the viewer needs resolved.
3. VALUE (5-80% of duration): The core content — deliver specific, actionable value. Use the "specific > vague" principle throughout. Show, don't just tell. Each scene should visually reinforce the message.
4. PEAK MOMENT: Design one "wow" or "aha" moment that viewers will remember (peak-end rule). This could be a surprising stat, a visual transformation, or an unexpected twist.
5. CTA (final 2-3s): Strong close — ask for engagement (comment, share, follow). Use loss aversion: "Don't miss the next one" > "Follow for more."

PSYCHOLOGICAL TECHNIQUES FOR VIDEO:
- Open loop in the hook, close it at the end (Zeigarnik effect — unfinished loops demand resolution)
- Use contrast effect: show the "before" state vs the "after" to make transformation vivid
- Apply the rule of 3: three key points, three steps, three examples — the brain remembers threes
- Build momentum: each shot should escalate energy, stakes, or value
- End by looping back to the opening concept for replay value (especially on TikTok/Reels)

TEXT OVERLAY STRATEGY:
- Key message should appear as text on screen within the first 2 seconds
- Use short, punchy phrases (5-8 words max per overlay)
- Highlight specific numbers and results in larger text
- Most viewers watch muted — the video must work with text alone

In addition to the caption text, you must provide:
1. A detailed video SCRIPT with scene-by-scene narrative that follows the structure above
2. A SHOTS array with 4-8 shot descriptions including exact timing, camera angles, visual details, text overlays, and audio/voiceover cues
For multi-part content, clearly number or label each section.`;
  } else {
    extraInstructions = `\n\nThis is a STATIC image post. In addition to the caption text, you must provide:
1. An imagePrompt — a visual scene description for the background image. CRITICAL: The image must contain ZERO text, words, or typography. Describe only the visual: subjects, lighting, composition, colors, mood. Text will be overlaid separately via CSS.
2. A textOverlay — a short 5-8 word headline or CTA that will be rendered on top of the image with pixel-perfect CSS typography.`;
  }

  let userMessage = `${BASE_PROMPT(platform, postType)}${extraInstructions}\n\nTOPIC/BRIEF: ${topic}`;
  if (ideaContext) {
    userMessage += `\n\nIDEA CONTEXT:\nHook: ${ideaContext.hook || ''}\nOutline: ${ideaContext.outline || ''}`;
  }
  userMessage += `\n\nWebsite: ${siteUrl}\n\n${isVideo ? VIDEO_RESPONSE_FORMAT : STATIC_RESPONSE_FORMAT}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    const data = await resp.json();
    const text = data.content?.[0]?.text || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');

    const supabase = getSupabase();
    if (supabase && projectId) {
      await supabase.from('social_posts').insert({
        project_id: projectId,
        site_url: siteUrl,
        platform,
        post_type: postType,
        topic,
        content: result.content || '',
        metadata: {
          mediaType: mediaType || 'static',
          videoStyle: videoStyle || undefined,
          hashtags: result.hashtags,
          format: result.format,
          charCount: result.charCount,
          tips: result.tips,
          bestTime: result.bestTime,
          script: result.script,
          shots: result.shots,
          imagePrompt: result.imagePrompt,
        },
        status: 'draft',
      });
    }

    await deductCredits(auth.user.id, 0.03 * 1.3, 'claude-sonnet-4', 'Social post generation', projectId || null);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[SocialGenerate] Error:', err.message);
    return res.status(500).json({ error: 'Post generation failed: ' + err.message });
  }
}
