import { authenticateRequest } from '../_config.js';
import { falImageToVideo } from '../_fal.js';
import { enforceCredits, deductCredits } from '../_credits.js';

export const config = { maxDuration: 300 };

const I2V_MODELS = {
  'fal-veo-3.1-i2v': 'fal-ai/veo3.1/image-to-video',
  'fal-veo-3.1-fast-i2v': 'fal-ai/veo3.1/fast/image-to-video',
  'fal-sora-2-i2v': 'fal-ai/sora-2/image-to-video',
  'fal-sora-2-pro-i2v': 'fal-ai/sora-2/image-to-video/pro',
  'fal-kling-3-pro-i2v': 'fal-ai/kling-video/v3/pro/image-to-video',
  'fal-kling-o3-i2v': 'fal-ai/kling-video/o3/standard/image-to-video',
  'fal-kling-2.5-i2v': 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
  'fal-ltx-2.3-i2v': 'fal-ai/ltx-2.3/image-to-video',
  'fal-wan-2.2-i2v': 'fal-ai/wan/v2.2-a14b/image-to-video',
};

const MODEL_COSTS_PER_SEC = {
  'fal-veo-3.1-i2v': 0.40,
  'fal-veo-3.1-fast-i2v': 0.15,
  'fal-sora-2-i2v': 0.30,
  'fal-sora-2-pro-i2v': 0.50,
  'fal-kling-3-pro-i2v': 0.112,
  'fal-kling-o3-i2v': 0.07,
  'fal-kling-2.5-i2v': 0.07,
  'fal-ltx-2.3-i2v': 0.04,
  'fal-wan-2.2-i2v': 0.05,
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const { imageUrl, prompt, model, duration, aspectRatio, resolution, generateAudio } = req.body || {};
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });

  const i2vModel = model || 'fal-veo-3.1-fast-i2v';
  const falModelId = I2V_MODELS[i2vModel];
  if (!falModelId) return res.status(400).json({ error: `Unsupported I2V model: ${i2vModel}` });

  const durationNum = parseInt(duration) || 8;
  const rawCost = (MODEL_COSTS_PER_SEC[i2vModel] || 0.15) * durationNum;
  const creditCost = rawCost * 1.3;
  if (!(await enforceCredits(auth.user.id, creditCost, res))) return;

  try {
    const result = await falImageToVideo(falModelId, {
      imageUrl,
      prompt: prompt || undefined,
      duration: duration || '8s',
      aspectRatio: aspectRatio || '16:9',
      resolution: resolution || '720p',
      generateAudio: generateAudio !== false,
    });

    if (!result.videoUrl) throw new Error('No video returned from I2V model');

    await deductCredits(auth.user.id, creditCost, i2vModel, `Image-to-video (${durationNum}s)`);

    return res.status(200).json({
      videoUrl: result.videoUrl,
      model: i2vModel,
      duration: duration || '8s',
    });
  } catch (err) {
    console.error('[ImageToVideo] Error:', err.message);
    return res.status(500).json({ error: 'Image-to-video failed: ' + err.message });
  }
}
