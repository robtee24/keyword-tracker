import { authenticateRequest } from '../_config.js';
import { falTextToVideo } from '../_fal.js';
import { enforceCredits, deductCredits } from '../_credits.js';

export const config = { maxDuration: 300 };

const PLATFORM_VIDEO_SPECS = {
  instagram: { resolution: '1080p', duration: 14, description: 'Instagram Reel', aspectRatio: '9:16' },
  linkedin: { resolution: '1080p', duration: 10, description: 'LinkedIn Video', aspectRatio: '16:9' },
  x: { resolution: '1080p', duration: 10, description: 'X/Twitter Video', aspectRatio: '16:9' },
  facebook: { resolution: '1080p', duration: 14, description: 'Facebook Video', aspectRatio: '16:9' },
  tiktok: { resolution: '1080p', duration: 10, description: 'TikTok Video', aspectRatio: '9:16' },
  pinterest: { resolution: '1080p', duration: 8, description: 'Pinterest Video Pin', aspectRatio: '9:16' },
};

const FAL_VIDEO_MODELS = {
  'fal-veo-3.1': 'fal-ai/veo3.1',
  'fal-veo-3.1-fast': 'fal-ai/veo3.1/fast',
  'fal-sora-2': 'fal-ai/sora-2/text-to-video',
  'fal-sora-2-pro': 'fal-ai/sora-2/text-to-video/pro',
  'fal-kling-3-pro': 'fal-ai/kling-video/v3/pro/text-to-video',
  'fal-kling-2.5-turbo': 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video',
  'fal-ltx-2.3-fast': 'fal-ai/ltx-2.3/text-to-video/fast',
  'fal-ltx-2.3-pro': 'fal-ai/ltx-2.3/text-to-video',
};

const MODEL_COSTS_PER_SEC = {
  'fal-veo-3.1': 0.40,
  'fal-veo-3.1-fast': 0.15,
  'fal-sora-2': 0.30,
  'fal-sora-2-pro': 0.50,
  'fal-kling-3-pro': 0.112,
  'fal-kling-2.5-turbo': 0.07,
  'fal-ltx-2.3-fast': 0.04,
  'fal-ltx-2.3-pro': 0.06,
};

function buildPromptFromShots(shots, platform) {
  if (!shots || !Array.isArray(shots) || shots.length === 0) return null;
  const scenes = shots
    .map((s, i) => {
      const visual = (s.visual || s.description || '').replace(/text overlay[^.]*\./gi, '').replace(/text on screen[^.]*\./gi, '').trim();
      return `Scene ${i + 1} (${s.time || ''}): ${visual}`;
    })
    .join('. ');
  return `Premium cinematic ${PLATFORM_VIDEO_SPECS[platform]?.description || 'social media video'}. Ultra high-quality, professional lighting, smooth camera movements, rich color grading. NO text, words, letters, or typography anywhere in the video. ${scenes}. Modern aesthetic, shallow depth of field, professional color grading like a brand campaign.`;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const { platform, prompt, shots, duration, model, aspectRatio: overrideAspect, resolution: overrideRes, generateAudio } = req.body || {};

  let videoPrompt = buildPromptFromShots(shots, platform);
  if (!videoPrompt && prompt) {
    const cleanPrompt = prompt.replace(/text overlay[^.]*\./gi, '').replace(/text on screen[^.]*\./gi, '').trim();
    videoPrompt = `Premium cinematic video. Ultra high-quality, professional lighting, smooth camera movements. NO text, words, letters, or typography anywhere in the video. ${cleanPrompt}. Professional color grading, shallow depth of field.`;
  }
  if (!videoPrompt) return res.status(400).json({ error: 'Either prompt or shots array is required' });

  const specs = PLATFORM_VIDEO_SPECS[platform] || PLATFORM_VIDEO_SPECS.instagram;
  const videoModel = model || 'fal-ltx-2.3-fast';
  const falModelId = FAL_VIDEO_MODELS[videoModel];

  if (falModelId) {
    try {
      const dur = duration || specs.duration;
      const durationStr = typeof dur === 'number' ? `${dur}s` : dur;
      const ar = overrideAspect || specs.aspectRatio || '16:9';

      const durationNum = typeof dur === 'number' ? dur : parseInt(dur) || 8;
      const rawCost = (MODEL_COSTS_PER_SEC[videoModel] || 0.04) * durationNum;
      const creditCost = rawCost * 1.3;
      if (!(await enforceCredits(auth.user.id, creditCost, res))) return;

      const result = await falTextToVideo(falModelId, {
        prompt: videoPrompt.slice(0, 2000),
        duration: durationStr,
        aspectRatio: ar,
        resolution: overrideRes || specs.resolution || '1080p',
        generateAudio: generateAudio !== false,
      });

      if (!result.videoUrl) throw new Error('No video returned');

      await deductCredits(auth.user.id, creditCost, videoModel, `Social video generation (${durationNum}s)`);

      return res.status(200).json({
        videoUrl: result.videoUrl,
        duration: dur,
        resolution: overrideRes || specs.resolution,
        model: videoModel,
        description: specs.description,
      });
    } catch (err) {
      console.error('[GenerateVideo] fal error:', err.message);
      return res.status(500).json({ error: 'Video generation failed: ' + err.message });
    }
  }

  // Legacy LTX direct API fallback
  const ltxKey = process.env.LTX_API_KEY;
  if (!ltxKey) return res.status(500).json({ error: 'LTX_API_KEY is not configured' });

  const VALID_DURATIONS = [6, 8, 10, 12, 14, 16, 18, 20];
  const rawDuration = Math.min(duration || specs.duration, 20);
  const videoDuration = VALID_DURATIONS.reduce((prev, curr) =>
    Math.abs(curr - rawDuration) < Math.abs(prev - rawDuration) ? curr : prev
  );

  const ltxRawCost = 0.04 * videoDuration;
  const ltxCreditCost = ltxRawCost * 1.3;
  if (!(await enforceCredits(auth.user.id, ltxCreditCost, res))) return;

  try {
    const ltxResp = await fetch('https://api.ltx.video/v1/text-to-video', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ltxKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: videoPrompt.slice(0, 2000),
        model: 'ltx-2-fast',
        duration: videoDuration,
        resolution: '1920x1080',
        fps: 25,
        generate_audio: true,
      }),
    });

    if (!ltxResp.ok) {
      const errStatus = ltxResp.status;
      let errMsg = `LTX API returned ${errStatus}`;
      if (errStatus === 401) errMsg = 'LTX API authentication failed. Check your API key.';
      else if (errStatus === 422) errMsg = 'Video content was rejected by safety filters. Try a different prompt.';
      else if (errStatus === 429) errMsg = 'Rate limit exceeded. Please wait and try again.';
      return res.status(200).json({ error: errMsg });
    }

    const videoBuffer = Buffer.from(await ltxResp.arrayBuffer());
    const base64 = videoBuffer.toString('base64');
    const videoUrl = `data:video/mp4;base64,${base64}`;

    await deductCredits(auth.user.id, ltxCreditCost, 'ltx-2-fast', `Social video LTX (${videoDuration}s)`);

    return res.status(200).json({
      videoUrl,
      duration: videoDuration,
      resolution: '1920x1080',
      model: videoModel,
      description: specs.description,
    });
  } catch (err) {
    console.error('[GenerateVideo] LTX error:', err.message);
    return res.status(500).json({ error: 'Video generation failed: ' + err.message });
  }
}
