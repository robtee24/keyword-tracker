import { getSupabase } from '../db.js';
import { authenticateRequest } from '../_config.js';
import { deductCredits } from '../_credits.js';

export const config = { maxDuration: 60 };

const PLATFORM_FORMATS = {
  instagram: 'Reel, Carousel, Single Image Post, Story, Live',
  linkedin: 'Text Post, Carousel/Document, Article, Poll, Video',
  x: 'Tweet, Thread, Poll, Quote Tweet',
  facebook: 'Text Post, Photo Post, Video, Live, Poll, Event',
  tiktok: 'Short Video, Duet, Stitch, Photo Carousel, Live',
  pinterest: 'Standard Pin, Idea Pin, Video Pin',
};

const PLATFORM_TIPS = {
  instagram: 'Reels get 2x reach. Carousels drive saves. Use 20-30 hashtags mixing sizes. Hook in first line of caption.',
  linkedin: 'Text-only posts often outperform. First 2 lines are critical (before "see more"). 3-5 hashtags max. Ask questions to drive comments.',
  x: 'Threads outperform single tweets for reach. First tweet is the hook. No hashtags in threads. End with a CTA.',
  facebook: 'Native video gets priority. Questions drive comments. Avoid external links in post body. Groups outperform pages.',
  tiktok: 'Hook in first 1-2 seconds. Ride trends but add unique angle. Use trending sounds. 3-5 hashtags including niche ones.',
  pinterest: 'Vertical images (2:3). SEO-rich descriptions. Fresh pins prioritized. Link to valuable content. Seasonal content 45 days early.',
};

const IDEAS_PROMPT = (platform) => `You are an expert ${platform} content strategist. Generate creative, engaging post ideas tailored specifically for ${platform}.

PLATFORM CONTEXT:
- Available formats: ${PLATFORM_FORMATS[platform] || 'Standard post'}
- Tips: ${PLATFORM_TIPS[platform] || ''}

USE THESE FRAMEWORKS FOR IDEAS:

HOOK FORMULAS:
- Curiosity: "I was wrong about [belief]." / "The real reason [X] isn't what you think."
- Story: "Last week, [unexpected thing] happened." / "3 years ago, I [past]. Today, [present]."
- Value: "How to [outcome] without [pain]:" / "[Number] [things] that [result]:"
- Contrarian: "Unpopular opinion: [bold take]" / "[Common advice] is wrong. Here's why:"

CONTENT PILLARS TO DRAW FROM:
- Industry insights (trends, data, predictions) — 30%
- Behind-the-scenes (building, lessons, process) — 25%
- Educational (how-tos, frameworks, tips) — 25%
- Personal (stories, values, opinions) — 15%
- Promotional (product, offers, case studies) — 5%

Generate ideas that are specific, actionable, and ready to create.`;

const RESPONSE_FORMAT = `
Respond with ONLY valid JSON:
{
  "ideas": [
    {
      "title": "<short descriptive title>",
      "hook": "<the exact opening line/hook to use>",
      "outline": "<3-5 bullet points of what the post covers>",
      "format": "<recommended format for this platform>",
      "hashtags": ["<5-10 relevant hashtags>"],
      "bestTime": "<suggested posting time>",
      "pillar": "<content pillar: industry | behind-the-scenes | educational | personal | promotional>",
      "whyItWorks": "<1 sentence on why this will perform well>"
    }
  ]
}

Generate exactly 12 ideas with a good mix across content pillars and formats.`;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const { siteUrl, projectId, platform, context } = req.body || {};
  if (!siteUrl || !platform) {
    return res.status(400).json({ error: 'siteUrl and platform are required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });

  const contextBlock = context
    ? `\n\nADDITIONAL CONTEXT FROM USER:\nNiche/Industry: ${context.niche || 'Not specified'}\nTarget Audience: ${context.audience || 'Not specified'}\nBrand Voice: ${context.voice || 'Not specified'}\nTopics to focus on: ${context.topics || 'Not specified'}\nWebsite: ${siteUrl}`
    : `\n\nWebsite: ${siteUrl}`;

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
        messages: [{
          role: 'user',
          content: `${IDEAS_PROMPT(platform)}${contextBlock}\n\n${RESPONSE_FORMAT}`,
        }],
      }),
    });

    const data = await resp.json();
    const text = data.content?.[0]?.text || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : '{"ideas":[]}');

    const supabase = getSupabase();
    if (supabase && projectId) {
      await supabase.from('social_ideas').insert({
        project_id: projectId,
        site_url: siteUrl,
        platform,
        context: JSON.stringify(context || {}),
        ideas: result.ideas || [],
      });
    }

    await deductCredits(auth.user.id, 0.03 * 1.3, 'claude-sonnet-4', 'Social ideas generation', projectId || null);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[SocialIdeas] Error:', err.message);
    return res.status(500).json({ error: 'Idea generation failed: ' + err.message });
  }
}
