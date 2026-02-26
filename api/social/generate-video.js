import { authenticateRequest } from '../_config.js';

export const config = { maxDuration: 120 };

// LTX API only supports: 1920x1080, 2560x1440, 3840x2160
// Durations must be even: 6, 8, 10, 12, 14, 16, 18, 20
const PLATFORM_VIDEO_SPECS = {
  instagram: { resolution: '1920x1080', duration: 14, description: 'Instagram Reel' },
  linkedin: { resolution: '1920x1080', duration: 10, description: 'LinkedIn Video' },
  x: { resolution: '1920x1080', duration: 10, description: 'X/Twitter Video' },
  facebook: { resolution: '1920x1080', duration: 14, description: 'Facebook Video' },
  tiktok: { resolution: '1920x1080', duration: 10, description: 'TikTok Video' },
  pinterest: { resolution: '1920x1080', duration: 8, description: 'Pinterest Video Pin' },
};

/**
 * Build a cinematic prompt from structured shots array.
 */
function buildPromptFromShots(shots, platform) {
  if (!shots || !Array.isArray(shots) || shots.length === 0) return null;
  const scenes = shots.map((s, i) =>
    `Scene ${i + 1} (${s.time || ''}): ${s.visual || s.description || ''}`
  ).join('. ');
  return `Cinematic social media video for ${platform}. ${scenes}. Professional lighting, smooth transitions, modern aesthetic.`;
}

/**
 * POST /api/social/generate-video
 * Body: { platform, prompt?, shots?, duration?, model? }
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const ltxKey = process.env.LTX_API_KEY;
  if (!ltxKey) return res.status(500).json({ error: 'LTX_API_KEY is not configured' });

  const { platform, prompt, shots, duration, model } = req.body || {};

  const videoPrompt = buildPromptFromShots(shots, platform) || prompt;
  if (!videoPrompt) return res.status(400).json({ error: 'Either prompt or shots array is required' });

  const specs = PLATFORM_VIDEO_SPECS[platform] || PLATFORM_VIDEO_SPECS.instagram;
  const VALID_DURATIONS = [6, 8, 10, 12, 14, 16, 18, 20];
  const rawDuration = Math.min(duration || specs.duration, 20);
  const videoDuration = VALID_DURATIONS.reduce((prev, curr) =>
    Math.abs(curr - rawDuration) < Math.abs(prev - rawDuration) ? curr : prev
  );
  const videoModel = model || 'ltx-2-fast';

  try {
    const ltxResp = await fetch('https://api.ltx.video/v1/text-to-video', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ltxKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: videoPrompt.slice(0, 2000),
        model: videoModel,
        duration: videoDuration,
        resolution: specs.resolution,
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

    return res.status(200).json({
      videoUrl,
      duration: videoDuration,
      resolution: specs.resolution,
      model: videoModel,
      description: specs.description,
    });
  } catch (err) {
    console.error('[GenerateVideo] LTX error:', err.message);
    return res.status(500).json({ error: 'Video generation failed: ' + err.message });
  }
}
