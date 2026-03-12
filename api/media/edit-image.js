import { authenticateRequest } from '../_config.js';
import { editImageWithGemini } from '../_imageGen.js';
import { falEditImage } from '../_fal.js';
import { enforceCredits, deductCredits } from '../_credits.js';

export const config = { maxDuration: 120 };

const MODEL_COSTS = {
  'nano-banana-pro-edit': 0.067,
  'fal-flux-kontext': 0.05,
  'fal-nano-banana-2-edit': 0.067,
};

const FAL_EDIT_MODELS = {
  'fal-flux-kontext': 'fal-ai/flux-pro/kontext',
  'fal-nano-banana-2-edit': 'fal-ai/nano-banana-2/edit',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const { imageUrl, editPrompt, model } = req.body || {};
  if (!imageUrl || !editPrompt) {
    return res.status(400).json({ error: 'imageUrl and editPrompt are required' });
  }

  const editModel = model || 'nano-banana-pro-edit';

  const rawCost = MODEL_COSTS[editModel] || 0.067;
  const creditCost = rawCost * 1.3;
  if (!(await enforceCredits(auth.user.id, creditCost, res))) return;

  try {
    if (editModel === 'nano-banana-pro-edit') {
      const result = await editImageWithGemini(imageUrl, editPrompt);
      await deductCredits(auth.user.id, creditCost, editModel, 'Image editing');
      return res.status(200).json({ imageUrl: result.imageUrl, model: editModel });
    }

    const falModelId = FAL_EDIT_MODELS[editModel];
    if (falModelId) {
      const result = await falEditImage(falModelId, { imageUrl, prompt: editPrompt });
      if (!result.imageUrl) throw new Error('No image returned from editing model');
      await deductCredits(auth.user.id, creditCost, editModel, 'Image editing');
      return res.status(200).json({ imageUrl: result.imageUrl, model: editModel });
    }

    return res.status(400).json({ error: `Unsupported edit model: ${editModel}` });
  } catch (err) {
    console.error('[EditImage] Error:', err.message);
    return res.status(500).json({ error: 'Image editing failed: ' + err.message });
  }
}
