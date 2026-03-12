import { fal } from '@fal-ai/client';

const FAL_KEY = process.env.FAL_API_KEY;

let configured = false;
function ensureConfigured() {
  if (!configured && FAL_KEY) {
    fal.config({ credentials: FAL_KEY });
    configured = true;
  }
}

function assertKey() {
  if (!FAL_KEY) throw new Error('FAL_API_KEY is not configured');
  ensureConfigured();
}

/**
 * Generic fal.ai model call via queue (subscribe waits for result).
 */
export async function falGenerate(modelId, input) {
  assertKey();
  const result = await fal.subscribe(modelId, { input });
  return result.data;
}

/**
 * Text-to-image via fal.ai.
 * Returns { imageUrl, images }
 */
export async function falTextToImage(modelId, { prompt, aspectRatio = '16:9', numImages = 1, resolution = '1K' }) {
  assertKey();
  const input = { prompt, num_images: numImages };

  if (modelId.includes('nano-banana')) {
    input.aspect_ratio = aspectRatio;
    input.resolution = resolution;
  } else if (modelId.includes('flux')) {
    const sizeMap = {
      '1:1': 'square',
      '16:9': 'landscape_16_9',
      '9:16': 'portrait_16_9',
      '4:3': 'landscape_4_3',
      '3:4': 'portrait_4_3',
    };
    input.image_size = sizeMap[aspectRatio] || 'landscape_4_3';
  }

  const result = await fal.subscribe(modelId, { input });
  const data = result.data;

  const images = data.images || [];
  const firstUrl = images[0]?.url || null;

  return { imageUrl: firstUrl, images, description: data.description || '' };
}

/**
 * Image editing via fal.ai (image-to-image).
 * Returns { imageUrl, images }
 */
export async function falEditImage(modelId, { imageUrl, prompt, aspectRatio }) {
  assertKey();
  const input = { prompt, image_url: imageUrl };
  if (aspectRatio) input.aspect_ratio = aspectRatio;

  const result = await fal.subscribe(modelId, { input });
  const data = result.data;

  const images = data.images || [];
  const firstUrl = images[0]?.url || null;

  return { imageUrl: firstUrl, images };
}

/**
 * Text-to-video via fal.ai.
 * Returns { videoUrl }
 */
export async function falTextToVideo(modelId, { prompt, duration = '8s', aspectRatio = '16:9', resolution = '720p', generateAudio = true, negativePrompt }) {
  assertKey();
  const input = { prompt };

  if (modelId.includes('veo')) {
    input.duration = typeof duration === 'number' ? `${duration}s` : duration;
    input.aspect_ratio = aspectRatio;
    input.resolution = resolution;
    input.generate_audio = generateAudio;
    if (negativePrompt) input.negative_prompt = negativePrompt;
  } else if (modelId.includes('kling')) {
    input.duration = typeof duration === 'number' ? String(duration) : duration.replace('s', '');
    input.aspect_ratio = aspectRatio;
  } else if (modelId.includes('ltx')) {
    input.duration = typeof duration === 'number' ? duration : parseInt(duration);
    input.aspect_ratio = aspectRatio;
    input.resolution = resolution;
    input.generate_audio = generateAudio;
  } else {
    input.duration = duration;
    if (aspectRatio) input.aspect_ratio = aspectRatio;
  }

  const result = await fal.subscribe(modelId, { input });
  const data = result.data;

  const videoUrl = data.video?.url || null;
  return { videoUrl };
}

/**
 * Image-to-video via fal.ai.
 * Returns { videoUrl }
 */
export async function falImageToVideo(modelId, { imageUrl, prompt, duration = '8s', aspectRatio = '16:9', resolution = '720p', generateAudio = true }) {
  assertKey();
  const input = { image_url: imageUrl };
  if (prompt) input.prompt = prompt;

  if (modelId.includes('veo')) {
    input.duration = typeof duration === 'number' ? `${duration}s` : duration;
    if (aspectRatio) input.aspect_ratio = aspectRatio;
    input.resolution = resolution;
    input.generate_audio = generateAudio;
  } else if (modelId.includes('kling')) {
    input.duration = typeof duration === 'number' ? String(duration) : duration.replace('s', '');
  } else if (modelId.includes('ltx')) {
    input.duration = typeof duration === 'number' ? duration : parseInt(duration);
    input.aspect_ratio = aspectRatio;
    input.resolution = resolution;
    input.generate_audio = generateAudio;
  } else {
    if (duration) input.duration = duration;
  }

  const result = await fal.subscribe(modelId, { input });
  const data = result.data;

  const videoUrl = data.video?.url || null;
  return { videoUrl };
}

/**
 * Background removal via fal.ai.
 * Returns { imageUrl }
 */
export async function falBackgroundRemove(modelId, { imageUrl }) {
  assertKey();
  const result = await fal.subscribe(modelId, { input: { image_url: imageUrl } });
  const data = result.data;
  const url = data.image?.url || data.images?.[0]?.url || null;
  return { imageUrl: url };
}

/**
 * Image upscale via fal.ai.
 * Returns { imageUrl }
 */
export async function falUpscale(modelId, { imageUrl, scale = 2 }) {
  assertKey();
  const result = await fal.subscribe(modelId, { input: { image_url: imageUrl, scale } });
  const data = result.data;
  const url = data.image?.url || data.images?.[0]?.url || null;
  return { imageUrl: url };
}
