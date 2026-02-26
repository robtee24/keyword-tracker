import { getSupabase } from '../db.js';
import { authenticateRequest } from '../_config.js';

export const config = { maxDuration: 60 };

const PLATFORM_SPECS = {
  instagram: { charLimit: 2200, formats: ['Reel Script', 'Carousel Slides', 'Single Post', 'Story Sequence'], hashtagRange: '20-30' },
  linkedin: { charLimit: 3000, formats: ['Text Post', 'Carousel Slides', 'Article', 'Poll'], hashtagRange: '3-5' },
  x: { charLimit: 280, formats: ['Single Tweet', 'Thread', 'Poll'], hashtagRange: '0-2' },
  facebook: { charLimit: 63206, formats: ['Text Post', 'Photo Caption', 'Video Post', 'Poll'], hashtagRange: '1-3' },
  tiktok: { charLimit: 4000, formats: ['Video Script', 'Photo Carousel Caption'], hashtagRange: '3-5' },
  pinterest: { charLimit: 500, formats: ['Pin Description', 'Idea Pin Sequence'], hashtagRange: '2-5' },
};

const GENERATE_PROMPT = (platform, postType) => {
  const spec = PLATFORM_SPECS[platform] || {};
  return `You are an expert ${platform} content creator. Write a complete, publish-ready ${postType} for ${platform}.

PLATFORM RULES:
- Character limit: ${spec.charLimit || 'standard'}
- Hashtag count: ${spec.hashtagRange || '3-5'}
- Format: ${postType}

WRITING GUIDELINES:
1. HOOK: Start with an attention-grabbing first line using proven hook formulas
2. BODY: Deliver clear value — be specific, not generic
3. FORMAT: Use platform-appropriate formatting (line breaks, bullets, spacing)
4. CTA: End with a clear call-to-action that drives engagement
5. HASHTAGS: Include relevant hashtags appropriate for the platform

${postType === 'Thread' || postType === 'Carousel Slides' || postType === 'Idea Pin Sequence' || postType === 'Story Sequence' || postType === 'Reel Script' || postType === 'Video Script'
  ? 'For multi-part content, clearly number or label each section/slide/tweet.'
  : ''}

The content should feel authentic, not AI-generated. Match the tone to what performs well on ${platform}.`;
};

const RESPONSE_FORMAT = `
Respond with ONLY valid JSON:
{
  "content": "<the full post content, ready to copy and paste>",
  "hashtags": ["<relevant hashtags>"],
  "format": "<the format used>",
  "charCount": <number of characters in content>,
  "tips": "<1-2 sentences of posting tips for this specific post>",
  "bestTime": "<suggested posting time>"
}`;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const { siteUrl, projectId, platform, postType, topic, ideaContext } = req.body || {};
  if (!siteUrl || !platform || !postType || !topic) {
    return res.status(400).json({ error: 'siteUrl, platform, postType, and topic are required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });

  let userMessage = `${GENERATE_PROMPT(platform, postType)}\n\nTOPIC/BRIEF: ${topic}`;
  if (ideaContext) {
    userMessage += `\n\nIDEA CONTEXT:\nHook: ${ideaContext.hook || ''}\nOutline: ${ideaContext.outline || ''}`;
  }
  userMessage += `\n\nWebsite: ${siteUrl}\n\n${RESPONSE_FORMAT}`;

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
        metadata: { hashtags: result.hashtags, format: result.format, charCount: result.charCount, tips: result.tips, bestTime: result.bestTime },
        status: 'draft',
      });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('[SocialGenerate] Error:', err.message);
    return res.status(500).json({ error: 'Post generation failed: ' + err.message });
  }
}
