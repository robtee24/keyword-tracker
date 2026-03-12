import { authenticateRequest } from '../_config.js';
import { getSupabase } from '../db.js';
import { falTextToVideo } from '../_fal.js';
import { enforceCredits, deductCredits } from '../_credits.js';
import { buildVideoContextBlock, resolveStyleLabel } from '../_contextPrompt.js';

export const config = { maxDuration: 300 };

const VEO_BASE = 'https://generativelanguage.googleapis.com/v1beta';

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
  'veo-3.1-generate-preview': 0.40,
  'veo-3.1-fast': 0.15,
};

function isFalModel(model) {
  return !!FAL_VIDEO_MODELS[model];
}

async function generateVeoVideo(prompt, aspectRatio = '16:9', durationSeconds = 8, modelOverride = null) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const model = (modelOverride && modelOverride.startsWith('veo')) ? modelOverride : 'veo-3.1-generate-preview';

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

async function generateWithFal(prompt, model, aspectRatio = '16:9', durationSeconds = 8) {
  const falModelId = FAL_VIDEO_MODELS[model];
  if (!falModelId) throw new Error(`Unknown fal video model: ${model}`);

  const result = await falTextToVideo(falModelId, {
    prompt,
    duration: `${durationSeconds}s`,
    aspectRatio,
    resolution: '1080p',
    generateAudio: true,
  });

  return result.videoUrl;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const { videoProjectId, sceneIndex, generateAll, prompt, aspectRatio, durationSeconds, model: videoModel, context, projectId } = req.body || {};

  function enhancePrompt(rawPrompt) {
    if (!context) return rawPrompt;
    const contextBlock = buildVideoContextBlock(context);
    const styleLabel = resolveStyleLabel(context);
    if (!contextBlock) return rawPrompt;
    return `${styleLabel} video. ${rawPrompt}${contextBlock}`;
  }

  // Single scene generation
  if (prompt && sceneIndex !== undefined) {
    const sceneDuration = durationSeconds || 8;
    const rawCost = (MODEL_COSTS_PER_SEC[videoModel] || 0.40) * sceneDuration;
    const creditCost = rawCost * 1.3;
    if (!(await enforceCredits(auth.user.id, creditCost, res))) return;

    const enhancedPrompt = enhancePrompt(prompt);

    if (isFalModel(videoModel)) {
      try {
        const videoUrl = await generateWithFal(enhancedPrompt, videoModel, aspectRatio || '16:9', durationSeconds || 8);
        if (!videoUrl) return res.status(500).json({ error: 'No video returned from fal' });

        const supabase = getSupabase();
        if (supabase && videoProjectId) {
          await supabase.from('video_generated').insert({
            video_project_id: videoProjectId,
            scene_index: sceneIndex,
            prompt,
            operation_name: `fal-direct-${Date.now()}`,
            status: 'completed',
            video_url: videoUrl,
            duration_seconds: durationSeconds || 8,
            aspect_ratio: aspectRatio || '16:9',
            completed_at: new Date().toISOString(),
          });
        }

        await deductCredits(auth.user.id, creditCost, videoModel, `Video ad scene ${sceneIndex}`, projectId || videoProjectId);

        return res.status(200).json({ videoUrl, sceneIndex, status: 'completed', model: videoModel });
      } catch (err) {
        console.error('[GenerateVideo] fal error:', err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    // Google VEO path (long-running operation)
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    }

    try {
      const operationName = await generateVeoVideo(enhancedPrompt, aspectRatio || '16:9', durationSeconds || 8, videoModel);
      if (!operationName) return res.status(500).json({ error: 'No operation returned from VEO' });

      const supabase = getSupabase();
      if (supabase && videoProjectId) {
        await supabase.from('video_generated').insert({
          video_project_id: videoProjectId,
          scene_index: sceneIndex,
          prompt,
          operation_name: operationName,
          status: 'generating',
          duration_seconds: durationSeconds || 8,
          aspect_ratio: aspectRatio || '16:9',
        });
      }

      await deductCredits(auth.user.id, creditCost, videoModel || 'veo-3.1-generate-preview', `Video ad scene ${sceneIndex}`, projectId || videoProjectId);

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

    const { data: project, error: projErr } = await supabase
      .from('video_projects')
      .select('*')
      .eq('id', videoProjectId)
      .single();

    if (projErr || !project) {
      console.error('[GenerateVideo] Project fetch error:', projErr?.message);
      return res.status(404).json({ error: 'Video project not found' });
    }

    const scenes = project.scenes || [];
    if (scenes.length === 0) return res.status(400).json({ error: 'Project has no scenes' });

    const costPerSec = MODEL_COSTS_PER_SEC[videoModel] || 0.40;
    const totalDuration = scenes.reduce((sum, s) => sum + (s.durationSeconds || 8), 0);
    const totalCreditCost = costPerSec * totalDuration * 1.3;
    if (!(await enforceCredits(auth.user.id, totalCreditCost, res))) return;

    const operations = [];
    const useFal = isFalModel(videoModel);

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const scenePrompt = enhancePrompt(scene.prompt);
      try {
        if (useFal) {
          const videoUrl = await generateWithFal(
            scenePrompt,
            videoModel,
            project.aspect_ratio || '16:9',
            scene.durationSeconds || 8
          );

          await supabase.from('video_generated').insert({
            video_project_id: videoProjectId,
            scene_index: i,
            prompt: scene.prompt,
            operation_name: `fal-direct-${Date.now()}-${i}`,
            status: videoUrl ? 'completed' : 'failed',
            video_url: videoUrl,
            duration_seconds: scene.durationSeconds || 8,
            aspect_ratio: project.aspect_ratio || '16:9',
            completed_at: new Date().toISOString(),
          });

          if (videoUrl) {
            const sceneCost = costPerSec * (scene.durationSeconds || 8) * 1.3;
            await deductCredits(auth.user.id, sceneCost, videoModel, `Video ad scene ${i}`, projectId || videoProjectId);
          }

          operations.push({ sceneIndex: i, status: videoUrl ? 'completed' : 'failed', videoUrl });
        } else {
          if (!process.env.GEMINI_API_KEY) {
            operations.push({ sceneIndex: i, status: 'failed', error: 'GEMINI_API_KEY not configured' });
            continue;
          }

          const operationName = await generateVeoVideo(
            scenePrompt,
            project.aspect_ratio || '16:9',
            scene.durationSeconds || 8,
            videoModel
          );

          if (!operationName) {
            operations.push({ sceneIndex: i, status: 'failed', error: 'No operation returned from VEO' });
            continue;
          }

          await supabase.from('video_generated').insert({
            video_project_id: videoProjectId,
            scene_index: i,
            prompt: scene.prompt,
            operation_name: operationName,
            status: 'generating',
            duration_seconds: scene.durationSeconds || 8,
            aspect_ratio: project.aspect_ratio || '16:9',
          });

          const sceneCost = costPerSec * (scene.durationSeconds || 8) * 1.3;
          await deductCredits(auth.user.id, sceneCost, videoModel || 'veo-3.1-generate-preview', `Video ad scene ${i}`, projectId || videoProjectId);

          operations.push({ sceneIndex: i, operationName, status: 'generating' });
        }
      } catch (err) {
        console.error(`[GenerateVideo] Scene ${i} error:`, err.message);
        operations.push({ sceneIndex: i, status: 'failed', error: err.message });
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
