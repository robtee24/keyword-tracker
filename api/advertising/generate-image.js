import { authenticateRequest } from '../_config.js';

export const config = { maxDuration: 120 };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });

  const { imageDescription, textOverlay, platform, dimensions } = req.body || {};
  if (!imageDescription) return res.status(400).json({ error: 'imageDescription is required' });

  const sizeMap = {
    '1080x1080': '1024x1024',
    '1080x1920': '1024x1792',
    '1200x628': '1792x1024',
    '1200x627': '1792x1024',
  };
  const size = sizeMap[dimensions] || '1024x1024';

  const platformContext = {
    meta: 'Facebook/Instagram feed ad',
    tiktok: 'TikTok in-feed ad',
    linkedin: 'LinkedIn sponsored content ad',
    x: 'Twitter/X promoted post card',
  }[platform] || 'social media ad';

  const prompt = `Create a professional, high-converting ${platformContext} creative image.

CONCEPT: ${imageDescription}

${textOverlay ? `TEXT OVERLAY TO INCLUDE: "${textOverlay}" — render this text prominently and legibly as part of the design.` : 'NO text overlay — keep the image clean without any text.'}

DESIGN REQUIREMENTS:
- Bold, attention-grabbing visual that stops the scroll
- Clean, modern design with strong focal point
- High contrast and vibrant colors that pop in a social feed
- Professional quality suitable for paid advertising
- Clear visual hierarchy that guides the eye
- Brand-safe, platform-policy compliant imagery
- No watermarks, no stock photo feel
- If showing people, use authentic, relatable scenes
- Leave breathing room for the platform UI elements`;

  try {
    const resp = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size,
        quality: 'hd',
        style: 'vivid',
        response_format: 'url',
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      return res.status(resp.status).json({ error: `Image generation failed (${resp.status}): ${detail}` });
    }

    const data = await resp.json();
    const imageUrl = data.data?.[0]?.url || null;
    const revisedPrompt = data.data?.[0]?.revised_prompt || '';

    return res.status(200).json({ imageUrl, revisedPrompt });
  } catch (err) {
    console.error('[AdImage] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
