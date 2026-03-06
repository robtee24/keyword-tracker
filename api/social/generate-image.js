import { authenticateRequest } from '../_config.js';

export const config = { maxDuration: 60 };

const PLATFORM_IMAGE_SIZES = {
  instagram: '1024x1792',
  tiktok: '1024x1792',
  pinterest: '1024x1792',
  linkedin: '1792x1024',
  x: '1792x1024',
  facebook: '1792x1024',
};

/**
 * POST /api/social/generate-image
 * Generates a static creative image using OpenAI DALL-E 3.
 *
 * Body: { prompt, platform, size? }
 * Returns: { imageUrl } as base64 data URL
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });

  const { prompt, platform, size } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const imageSize = size || PLATFORM_IMAGE_SIZES[platform] || '1024x1024';

  const cleanPrompt = `Create a premium, photorealistic background image for a ${platform || 'social media'} post. Text will be added separately later.

CONCEPT: ${prompt}

CRITICAL RULES:
- DO NOT include ANY text, words, letters, numbers, logos, watermarks, or typography
- The image must be completely clean of all text and writing
- Leave negative space for text overlay

VISUAL QUALITY:
- Ultra high-quality, photorealistic or premium illustration
- Bold, scroll-stopping visual with clear focal point
- Rich, vibrant colors with high contrast
- Professional studio lighting and composition
- Modern, premium aesthetic
- If showing people: authentic, emotionally engaging
- Depth of field for visual hierarchy
- No stock photo clichés`;

  try {
    const resp = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: cleanPrompt,
        n: 1,
        size: imageSize,
        quality: 'hd',
        style: 'vivid',
        response_format: 'b64_json',
      }),
    });

    if (!resp.ok) {
      const errStatus = resp.status;
      let errMsg = `OpenAI API returned ${errStatus}`;
      if (errStatus === 401) errMsg = 'OpenAI API authentication failed. Check your API key.';
      else if (errStatus === 400) {
        try { const e = await resp.json(); errMsg = e.error?.message || errMsg; } catch {}
      }
      else if (errStatus === 429) errMsg = 'Rate limit exceeded. Please wait and try again.';
      return res.status(200).json({ error: errMsg });
    }

    const data = await resp.json();
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      return res.status(200).json({ error: 'No image was generated. Try a different prompt.' });
    }

    const imageUrl = `data:image/png;base64,${b64}`;
    const revisedPrompt = data.data?.[0]?.revised_prompt || '';

    return res.status(200).json({
      imageUrl,
      revisedPrompt,
      size: imageSize,
      platform,
    });
  } catch (err) {
    console.error('[GenerateImage] OpenAI error:', err.message);
    return res.status(500).json({ error: 'Image generation failed: ' + err.message });
  }
}
