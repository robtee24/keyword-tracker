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

  const prompt = `Create a premium, photorealistic background image for a ${platformContext}. This is ONLY the visual backdrop — text will be added separately later.

CONCEPT: ${imageDescription}

CRITICAL RULES:
- DO NOT include ANY text, words, letters, numbers, logos, watermarks, or typography of any kind
- DO NOT include any UI elements, buttons, or interface components
- The image must be completely clean of all text and writing

VISUAL QUALITY:
- Ultra high-quality, photorealistic or premium illustration style
- Bold, scroll-stopping visual with a clear focal point
- Rich, vibrant colors with high contrast that pop in social feeds
- Professional studio-quality lighting and composition
- Leave negative space for text overlay (especially in the center and lower third)
- Modern, premium aesthetic — think Apple or Nike ad photography
- If showing people: authentic, diverse, emotionally engaging
- If showing products: clean, well-lit, aspirational context
- Depth of field to create visual hierarchy
- No stock photo clichés (no handshakes, no pointing at screens)`;

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
