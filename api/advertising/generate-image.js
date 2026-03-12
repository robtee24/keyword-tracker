import { authenticateRequest } from '../_config.js';
import { generateImage } from '../_imageGen.js';
import { enforceCredits, deductCredits } from '../_credits.js';

export const config = { maxDuration: 120 };

const MODEL_COSTS = {
  'dall-e-3': 0.04,
  'gpt-image-1': 0.04,
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const { imageDescription, textOverlay, platform, dimensions, model } = req.body || {};
  if (!imageDescription) return res.status(400).json({ error: 'imageDescription is required' });

  const sizeMap = {
    '1080x1080': '1024x1024',
    '1080x1920': '1024x1792',
    '1200x628': '1792x1024',
    '1200x627': '1792x1024',
  };
  const size = sizeMap[dimensions] || '1024x1024';
  const imageModel = model || 'dall-e-3';

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

  const rawCost = MODEL_COSTS[imageModel] || 0.04;
  const creditCost = rawCost * 1.3;
  if (!(await enforceCredits(auth.user.id, creditCost, res))) return;

  try {
    const { imageUrl, revisedPrompt } = await generateImage(prompt, {
      model: imageModel,
      size,
    });

    await deductCredits(auth.user.id, creditCost, imageModel, 'Ad image generation');

    return res.status(200).json({ imageUrl, revisedPrompt });
  } catch (err) {
    console.error('[AdImage] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
