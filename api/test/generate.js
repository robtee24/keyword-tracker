import { authenticateRequest } from '../_config.js';
import { generateImage } from '../_imageGen.js';
import { falTextToVideo, falImageToVideo, falEditImage } from '../_fal.js';
import { deductCredits } from '../_credits.js';

export const config = { maxDuration: 300 };

const IMAGE_COSTS = {
  'imagen-4.0-fast-generate-001': 0.02, 'imagen-4.0-generate-001': 0.04, 'imagen-4.0-ultra-generate-001': 0.06,
  'nano-banana-pro': 0.067, 'fal-nano-banana-2': 0.08, 'dall-e-3': 0.08,
  'fal-flux-schnell': 0.003, 'fal-flux-dev': 0.025, 'fal-flux-2-pro': 0.03,
  'fal-recraft-v3': 0.04, 'fal-recraft-v4-pro': 0.25, 'fal-seedream-4.5': 0.03,
  'fal-qwen-image-2': 0.02, 'fal-imagineart-1.5': 0.04,
};

const EDIT_COSTS = {
  'nano-banana-pro-edit': 0.067, 'fal-nano-banana-2-edit': 0.08, 'fal-flux-kontext': 0.04,
  'fal-flux-2-pro-edit': 0.03, 'fal-gpt-image-1.5-edit': 0.133, 'fal-reve-edit': 0.04,
  'fal-seedream-4.5-edit': 0.04, 'fal-qwen-image-2-edit': 0.02,
};

const VIDEO_COSTS_PER_SEC = {
  'veo-3.1-generate-preview': 0.40, 'veo-3.1-fast': 0.15,
  'fal-sora-2': 0.30, 'fal-sora-2-pro': 0.50,
  'fal-kling-3-pro': 0.112, 'fal-kling-2.5-turbo': 0.07,
  'fal-ltx-2.3-fast': 0.04, 'fal-ltx-2.3-pro': 0.06,
};

const I2V_COSTS_PER_SEC = {
  'fal-veo-3.1-i2v': 0.40, 'fal-veo-3.1-fast-i2v': 0.15,
  'fal-sora-2-i2v': 0.30, 'fal-sora-2-pro-i2v': 0.50,
  'fal-kling-3-pro-i2v': 0.112, 'fal-kling-o3-i2v': 0.07, 'fal-kling-2.5-i2v': 0.07,
  'fal-ltx-2.3-i2v': 0.04, 'fal-wan-2.2-i2v': 0.05,
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const { type, model, prompt, imageUrl, falModelId, projectId } = req.body || {};
  if (!type || !model) return res.status(400).json({ error: 'type and model are required' });

  try {
    if (type === 'textToImage') {
      const { imageUrl: resultUrl } = await generateImage(prompt || 'A serene mountain lake at sunset', {
        model,
        size: '1024x1024',
        responseFormat: 'url',
      });
      const rawCost = IMAGE_COSTS[model] || 0.04;
      await deductCredits(auth.user.id, rawCost * 1.3, model, 'API Test: image generation', projectId || null);
      return res.status(200).json({ imageUrl: resultUrl, model });
    }

    if (type === 'imageEdit') {
      if (!imageUrl) return res.status(400).json({ error: 'imageUrl required for editing' });
      let result;
      if (model === 'nano-banana-pro-edit') {
        const { editImageWithGemini } = await import('../_imageGen.js');
        result = await editImageWithGemini(imageUrl, prompt || 'Make the colors more vibrant');
      } else if (falModelId) {
        result = await falEditImage(falModelId, { imageUrl, prompt: prompt || 'Make the colors more vibrant' });
      } else {
        return res.status(400).json({ error: `Unknown edit model: ${model}` });
      }
      const rawCost = EDIT_COSTS[model] || 0.04;
      await deductCredits(auth.user.id, rawCost * 1.3, model, 'API Test: image editing', projectId || null);
      return res.status(200).json({ imageUrl: result.imageUrl, model });
    }

    if (type === 'textToVideo') {
      const durationSec = 5;
      if (model.startsWith('veo-') || model === 'veo-3.1-generate-preview' || model === 'veo-3.1-fast') {
        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) throw new Error('GEMINI_API_KEY not configured');
        const veoBase = 'https://generativelanguage.googleapis.com/v1beta';
        const veoResp = await fetch(`${veoBase}/models/${model}:predictLongRunning`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
          body: JSON.stringify({
            instances: [{ prompt: prompt || 'A calm ocean wave rolling onto a sandy beach at golden hour' }],
            parameters: { aspectRatio: '16:9', sampleCount: 1, durationSeconds: durationSec, generateAudio: true, personGeneration: 'allow_all' },
          }),
        });
        if (!veoResp.ok) {
          const errText = await veoResp.text().catch(() => 'unknown');
          throw new Error(`Veo error (${veoResp.status}): ${errText}`);
        }
        const veoData = await veoResp.json();
        const rawCost = (VIDEO_COSTS_PER_SEC[model] || 0.40) * durationSec;
        await deductCredits(auth.user.id, rawCost * 1.3, model, `API Test: video generation (${durationSec}s)`, projectId || null);
        return res.status(200).json({ operationName: veoData.name, status: 'polling_required', model });
      }

      if (falModelId) {
        const result = await falTextToVideo(falModelId, {
          prompt: prompt || 'A calm ocean wave rolling onto a sandy beach at golden hour',
          duration: `${durationSec}s`,
          aspectRatio: '16:9',
          resolution: '720p',
          generateAudio: true,
        });
        const rawCost = (VIDEO_COSTS_PER_SEC[model] || 0.04) * durationSec;
        await deductCredits(auth.user.id, rawCost * 1.3, model, `API Test: video generation (${durationSec}s)`, projectId || null);
        return res.status(200).json({ videoUrl: result.videoUrl, model });
      }
      return res.status(400).json({ error: `Unknown video model: ${model}` });
    }

    if (type === 'imageToVideo') {
      if (!imageUrl) return res.status(400).json({ error: 'imageUrl required for I2V' });
      const durationSec = 5;
      if (falModelId) {
        const result = await falImageToVideo(falModelId, {
          imageUrl,
          prompt: prompt || 'Gently animate this scene with subtle motion',
          duration: `${durationSec}s`,
          aspectRatio: '16:9',
          resolution: '720p',
          generateAudio: true,
        });
        const rawCost = (I2V_COSTS_PER_SEC[model] || 0.04) * durationSec;
        await deductCredits(auth.user.id, rawCost * 1.3, model, `API Test: image-to-video (${durationSec}s)`, projectId || null);
        return res.status(200).json({ videoUrl: result.videoUrl, model });
      }
      return res.status(400).json({ error: `Unknown I2V model: ${model}` });
    }

    return res.status(400).json({ error: `Unknown type: ${type}` });
  } catch (err) {
    console.error(`[Test] ${type}/${model} error:`, err.message);
    return res.status(200).json({ error: err.message, model });
  }
}
