import { authenticateRequest } from '../_config.js';
import { generateImage } from '../_imageGen.js';
import { falTextToVideo, falImageToVideo, falEditImage } from '../_fal.js';

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const { type, model, prompt, imageUrl, falModelId } = req.body || {};
  if (!type || !model) return res.status(400).json({ error: 'type and model are required' });

  try {
    if (type === 'textToImage') {
      const { imageUrl: resultUrl } = await generateImage(prompt || 'A serene mountain lake at sunset', {
        model,
        size: '1024x1024',
        responseFormat: 'url',
      });
      return res.status(200).json({ imageUrl: resultUrl, model });
    }

    if (type === 'imageEdit') {
      if (!imageUrl) return res.status(400).json({ error: 'imageUrl required for editing' });
      if (model === 'nano-banana-pro-edit') {
        const { editImageWithGemini } = await import('../_imageGen.js');
        const result = await editImageWithGemini(imageUrl, prompt || 'Make the colors more vibrant');
        return res.status(200).json({ imageUrl: result.imageUrl, model });
      }
      if (falModelId) {
        const result = await falEditImage(falModelId, { imageUrl, prompt: prompt || 'Make the colors more vibrant' });
        return res.status(200).json({ imageUrl: result.imageUrl, model });
      }
      return res.status(400).json({ error: `Unknown edit model: ${model}` });
    }

    if (type === 'textToVideo') {
      if (model.startsWith('veo-') || model === 'veo-3.1-generate-preview' || model === 'veo-3.1-fast') {
        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) throw new Error('GEMINI_API_KEY not configured');
        const veoBase = 'https://generativelanguage.googleapis.com/v1beta';
        const veoResp = await fetch(`${veoBase}/models/${model}:predictLongRunning`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
          body: JSON.stringify({
            instances: [{ prompt: prompt || 'A calm ocean wave rolling onto a sandy beach at golden hour' }],
            parameters: { aspectRatio: '16:9', sampleCount: 1, durationSeconds: 5, generateAudio: true, personGeneration: 'allow_all' },
          }),
        });
        if (!veoResp.ok) {
          const errText = await veoResp.text().catch(() => 'unknown');
          throw new Error(`Veo error (${veoResp.status}): ${errText}`);
        }
        const veoData = await veoResp.json();
        return res.status(200).json({ operationName: veoData.name, status: 'polling_required', model });
      }

      if (falModelId) {
        const result = await falTextToVideo(falModelId, {
          prompt: prompt || 'A calm ocean wave rolling onto a sandy beach at golden hour',
          duration: '5s',
          aspectRatio: '16:9',
          resolution: '720p',
          generateAudio: true,
        });
        return res.status(200).json({ videoUrl: result.videoUrl, model });
      }
      return res.status(400).json({ error: `Unknown video model: ${model}` });
    }

    if (type === 'imageToVideo') {
      if (!imageUrl) return res.status(400).json({ error: 'imageUrl required for I2V' });
      if (falModelId) {
        const result = await falImageToVideo(falModelId, {
          imageUrl,
          prompt: prompt || 'Gently animate this scene with subtle motion',
          duration: '5s',
          aspectRatio: '16:9',
          resolution: '720p',
          generateAudio: true,
        });
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
