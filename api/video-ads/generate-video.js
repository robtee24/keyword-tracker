import { authenticateRequest } from '../_config.js';
import { getSupabase } from '../db.js';

export const config = { maxDuration: 300 };

const VEO_BASE = 'https://generativelanguage.googleapis.com/v1beta';

async function generateVeoVideo(prompt, aspectRatio = '16:9', durationSeconds = 8) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const model = 'veo-3.1-generate-preview';

  const response = await fetch(
    `${VEO_BASE}/models/${model}:predictLongRunning`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          aspectRatio,
          durationSeconds,
          sampleCount: 1,
          personGeneration: 'allow_adult',
          resolution: '720p',
        },
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => 'unknown');
    throw new Error(`VEO API error (${response.status}): ${detail}`);
  }

  const data = await response.json();
  return data.name || data.operationName || null;
}

async function pollOperation(operationName) {
  const apiKey = process.env.GEMINI_API_KEY;

  const response = await fetch(
    `${VEO_BASE}/${operationName}`,
    {
      method: 'GET',
      headers: { 'x-goog-api-key': apiKey },
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => 'unknown');
    throw new Error(`Poll error (${response.status}): ${detail}`);
  }

  return response.json();
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const { videoProjectId, sceneIndex, generateAll, prompt, aspectRatio, durationSeconds } = req.body || {};

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  // Single scene generation (used for direct prompt or individual scene)
  if (prompt && sceneIndex !== undefined) {
    try {
      const operationName = await generateVeoVideo(
        prompt,
        aspectRatio || '16:9',
        durationSeconds || 8
      );

      if (!operationName) {
        return res.status(500).json({ error: 'No operation returned from VEO' });
      }

      // Save to DB if videoProjectId provided
      const supabase = getSupabase();
      if (supabase && videoProjectId) {
        await supabase.from('video_generated').upsert({
          video_project_id: videoProjectId,
          scene_index: sceneIndex,
          prompt,
          operation_name: operationName,
          status: 'generating',
          duration_seconds: durationSeconds || 8,
          aspect_ratio: aspectRatio || '16:9',
        }, { onConflict: 'video_project_id,scene_index' }).select();
      }

      return res.status(200).json({ operationName, sceneIndex, status: 'generating' });
    } catch (err) {
      console.error('[GenerateVideo] Error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // Generate all scenes for a project
  if (videoProjectId && generateAll) {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'Database not available' });

    const { data: project } = await supabase
      .from('video_projects')
      .select('*')
      .eq('id', videoProjectId)
      .single();

    if (!project) return res.status(404).json({ error: 'Video project not found' });

    const scenes = project.scenes || [];
    const operations = [];

    for (const scene of scenes) {
      try {
        const operationName = await generateVeoVideo(
          scene.prompt,
          project.aspect_ratio || '16:9',
          scene.durationSeconds || 8
        );

        await supabase.from('video_generated').upsert({
          video_project_id: videoProjectId,
          scene_index: scene.sceneNumber - 1,
          prompt: scene.prompt,
          operation_name: operationName,
          status: 'generating',
          duration_seconds: scene.durationSeconds || 8,
          aspect_ratio: project.aspect_ratio || '16:9',
        }, { onConflict: 'video_project_id,scene_index' }).select();

        operations.push({
          sceneIndex: scene.sceneNumber - 1,
          operationName,
          status: 'generating',
        });
      } catch (err) {
        operations.push({
          sceneIndex: scene.sceneNumber - 1,
          status: 'failed',
          error: err.message,
        });
      }
    }

    await supabase
      .from('video_projects')
      .update({ status: 'generating', updated_at: new Date().toISOString() })
      .eq('id', videoProjectId);

    return res.status(200).json({ operations });
  }

  return res.status(400).json({ error: 'Provide prompt+sceneIndex or videoProjectId+generateAll' });
}

// Poll endpoint - GET with operationName
export async function pollHandler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { operationName, videoProjectId, sceneIndex } = req.query;
  if (!operationName) return res.status(400).json({ error: 'operationName required' });

  try {
    const result = await pollOperation(operationName);

    if (result.done) {
      const videos = result.response?.generatedVideos || result.result?.generatedVideos || [];
      const videoUrl = videos[0]?.video?.uri || null;

      // Update DB
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

    const progress = result.metadata?.progress || null;
    return res.status(200).json({
      done: false,
      status: 'generating',
      progress,
    });
  } catch (err) {
    console.error('[PollVideo] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
