import { getSupabase } from '../db.js';

export const config = { maxDuration: 30 };

const VEO_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { operationName, videoProjectId, sceneIndex } = req.query;
  if (!operationName) return res.status(400).json({ error: 'operationName required' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });

  try {
    const response = await fetch(
      `${VEO_BASE}/${operationName}?key=${apiKey}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => 'unknown');
      throw new Error(`Poll error (${response.status}): ${detail}`);
    }

    const result = await response.json();

    if (result.done) {
      const videos = result.response?.generatedVideos || result.result?.generatedVideos || [];
      const videoUrl = videos[0]?.video?.uri || null;

      const supabase = getSupabase();
      if (supabase && videoProjectId && sceneIndex !== undefined) {
        await supabase
          .from('video_generated')
          .update({
            status: videoUrl ? 'completed' : 'failed',
            video_url: videoUrl,
            completed_at: new Date().toISOString(),
            error_message: videoUrl ? null : 'No video returned',
          })
          .eq('video_project_id', videoProjectId)
          .eq('scene_index', parseInt(sceneIndex));
      }

      return res.status(200).json({
        done: true,
        videoUrl,
        status: videoUrl ? 'completed' : 'failed',
      });
    }

    return res.status(200).json({
      done: false,
      status: 'generating',
      progress: result.metadata?.progress || null,
    });
  } catch (err) {
    console.error('[PollVideo] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
