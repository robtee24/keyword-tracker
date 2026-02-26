import { authenticateRequest } from '../_config.js';

export const config = { maxDuration: 120 };

const PLATFORM_VIDEO_SPECS = {
  instagram: { resolution: '1080x1920', duration: 15, description: 'Instagram Reel (9:16 vertical)' },
  linkedin: { resolution: '1920x1080', duration: 10, description: 'LinkedIn Video (16:9 landscape)' },
  x: { resolution: '1920x1080', duration: 10, description: 'X/Twitter Video (16:9 landscape)' },
  facebook: { resolution: '1920x1080', duration: 15, description: 'Facebook Video (16:9 landscape)' },
  tiktok: { resolution: '1080x1920', duration: 10, description: 'TikTok Video (9:16 vertical)' },
  pinterest: { resolution: '1000x1500', duration: 8, description: 'Pinterest Video Pin (2:3 vertical)' },
};

/**
 * POST /api/social/generate-video
 * Generates a video using the LTX text-to-video API.
 *
 * Body: { platform, prompt, duration?, model? }
 * Returns: { videoUrl } with base64 data URL
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const ltxKey = process.env.LTX_API_KEY;
  if (!ltxKey) return res.status(500).json({ error: 'LTX_API_KEY is not configured' });

  const { platform, prompt, duration, model } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const specs = PLATFORM_VIDEO_SPECS[platform] || PLATFORM_VIDEO_SPECS.instagram;
  const videoDuration = Math.min(duration || specs.duration, 20);
  const videoModel = model || 'ltx-2-fast';

  try {
    const ltxResp = await fetch('https://api.ltx.video/v1/text-to-video', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ltxKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
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
