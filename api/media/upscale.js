import { authenticateRequest } from '../_config.js';
import { falUpscale } from '../_fal.js';
import { enforceCredits, deductCredits } from '../_credits.js';

export const config = { maxDuration: 120 };

const MODEL_COSTS = {
  'fal-seedvr-upscale': 0.02,
};

const UPSCALE_MODELS = {
  'fal-seedvr-upscale': 'fal-ai/seedvr/upscale/image',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const { imageUrl, model, scale } = req.body || {};
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });

  const upModel = model || 'fal-seedvr-upscale';
  const falModelId = UPSCALE_MODELS[upModel];
  if (!falModelId) return res.status(400).json({ error: `Unsupported model: ${upModel}` });

  const rawCost = MODEL_COSTS[upModel] || 0.02;
  const creditCost = rawCost * 1.3;
  if (!(await enforceCredits(auth.user.id, creditCost, res))) return;

  try {
    const result = await falUpscale(falModelId, { imageUrl, scale: scale || 2 });
    if (!result.imageUrl) throw new Error('No image returned from upscale');
    await deductCredits(auth.user.id, creditCost, upModel, 'Image upscale');
    return res.status(200).json({ imageUrl: result.imageUrl, model: upModel });
  } catch (err) {
    console.error('[Upscale] Error:', err.message);
    return res.status(500).json({ error: 'Image upscale failed: ' + err.message });
  }
}
