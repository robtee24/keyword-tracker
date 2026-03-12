import { authenticateRequest } from '../_config.js';
import { generateImage } from '../_imageGen.js';

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
 * Generates a static creative image for social media posts.
 *
 * Body: { prompt, platform, size?, model? }
 * Returns: { imageUrl } as base64 data URL or URL
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const { prompt, platform, size, model } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const imageSize = size || PLATFORM_IMAGE_SIZES[platform] || '1024x1024';
  const imageModel = model || 'dall-e-3';

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
    const responseFormat = imageModel === 'dall-e-3' ? 'b64_json' : 'url';
    const { imageUrl, revisedPrompt } = await generateImage(cleanPrompt, {
      model: imageModel,
      size: imageSize,
      responseFormat,
    });

    return res.status(200).json({
      imageUrl,
      revisedPrompt,
      size: imageSize,
      platform,
    });
  } catch (err) {
    console.error('[GenerateImage] Error:', err.message);
    if (err.message.includes('not configured')) {
      return res.status(200).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Image generation failed: ' + err.message });
  }
}
