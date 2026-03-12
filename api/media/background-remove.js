import { authenticateRequest } from '../_config.js';
import { falBackgroundRemove } from '../_fal.js';
import { enforceCredits, deductCredits } from '../_credits.js';

export const config = { maxDuration: 60 };

const MODEL_COSTS = {
  'fal-bria-bg-remove': 0.01,
  'fal-pixelcut-bg': 0.01,
};

const BG_MODELS = {
  'fal-bria-bg-remove': 'fal-ai/bria/background/remove',
  'fal-pixelcut-bg': 'fal-ai/pixelcut/background-removal',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const { imageUrl, model } = req.body || {};
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });

  const bgModel = model || 'fal-bria-bg-remove';
  const falModelId = BG_MODELS[bgModel];
  if (!falModelId) return res.status(400).json({ error: `Unsupported model: ${bgModel}` });

  const rawCost = MODEL_COSTS[bgModel] || 0.01;
  const creditCost = rawCost * 1.3;
  if (!(await enforceCredits(auth.user.id, creditCost, res))) return;

  try {
    const result = await falBackgroundRemove(falModelId, { imageUrl });
    if (!result.imageUrl) throw new Error('No image returned from background removal');
    await deductCredits(auth.user.id, creditCost, bgModel, 'Background removal');
    return res.status(200).json({ imageUrl: result.imageUrl, model: bgModel });
  } catch (err) {
    console.error('[BgRemove] Error:', err.message);
    return res.status(500).json({ error: 'Background removal failed: ' + err.message });
  }
}
