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

  if (modelId.includes('nano-banana') || modelId.includes('gemini')) {
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
  } else if (modelId.includes('seedream') || modelId.includes('recraft') || modelId.includes('qwen') || modelId.includes('gpt-image')) {
    const sizeMap = {
      '1:1': 'square_hd',
      '16:9': 'landscape_16_9',
      '9:16': 'portrait_16_9',
      '4:3': 'landscape_4_3',
      '3:4': 'portrait_4_3',
    };
    input.image_size = sizeMap[aspectRatio] || 'landscape_16_9';
  }

  const result = await fal.subscribe(modelId, { input });
  const data = result.data;

  const images = data.images || [];
  const firstUrl = images[0]?.url || null;

  return { imageUrl: firstUrl, images, description: data.description || '' };
}

/**
 * Image editing via fal.ai (image-to-image).
 * Models use either image_url (single) or image_urls (array).
 */
export async function falEditImage(modelId, { imageUrl, prompt, aspectRatio }) {
  assertKey();
  const input = { prompt };

  const usesImageUrls = modelId.includes('flux-2-pro') || modelId.includes('gpt-image')
    || modelId.includes('seedream') || modelId.includes('qwen');

  if (usesImageUrls) {
    input.image_urls = [imageUrl];
  } else {
    input.image_url = imageUrl;
  }

  if (aspectRatio) input.aspect_ratio = aspectRatio;

  const result = await fal.subscribe(modelId, { input });
  const data = result.data;

  const images = data.images || [];
  const firstUrl = images[0]?.url || null;

  return { imageUrl: firstUrl, images };
}

function parseDurationSec(duration) {
  if (typeof duration === 'number') return duration;
  if (typeof duration === 'string') return parseInt(duration) || 8;
  return 8;
}

function snapToAllowed(value, allowed) {
  return allowed.reduce((best, v) => Math.abs(v - value) < Math.abs(best - value) ? v : best, allowed[0]);
}

/**
 * Text-to-video via fal.ai.
 * Returns { videoUrl }
 */
export async function falTextToVideo(modelId, { prompt, duration = '8s', aspectRatio = '16:9', resolution = '720p', generateAudio = true, negativePrompt }) {
  assertKey();
  const rawSec = parseDurationSec(duration);
  const input = { prompt };

  if (modelId.includes('sora')) {
    input.duration = snapToAllowed(rawSec, [4, 8, 12, 16, 20]);
    input.aspect_ratio = aspectRatio;
    input.resolution = resolution;
  } else if (modelId.includes('veo')) {
    input.duration = `${rawSec}s`;
    input.aspect_ratio = aspectRatio;
    input.resolution = resolution;
    input.generate_audio = generateAudio;
    if (negativePrompt) input.negative_prompt = negativePrompt;
  } else if (modelId.includes('kling')) {
    input.duration = String(snapToAllowed(rawSec, [5, 10]));
    input.aspect_ratio = aspectRatio;
  } else if (modelId.includes('ltx')) {
    input.duration = snapToAllowed(rawSec, [6, 8, 10]);
    input.aspect_ratio = aspectRatio;
    input.resolution = resolution || '1080p';
    input.generate_audio = generateAudio;
  } else if (modelId.includes('wan') || modelId.includes('cosmos') || modelId.includes('minimax') || modelId.includes('pixverse')) {
    input.duration = rawSec;
    if (aspectRatio) input.aspect_ratio = aspectRatio;
  } else {
    input.duration = rawSec;
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
  const rawSec = parseDurationSec(duration);
  const input = { image_url: imageUrl };
  if (prompt) input.prompt = prompt;

  if (modelId.includes('sora')) {
    input.duration = snapToAllowed(rawSec, [4, 8, 12, 16, 20]);
    input.aspect_ratio = aspectRatio;
    input.resolution = resolution;
  } else if (modelId.includes('veo')) {
    input.duration = `${rawSec}s`;
    if (aspectRatio) input.aspect_ratio = aspectRatio;
    input.resolution = resolution;
    input.generate_audio = generateAudio;
  } else if (modelId.includes('kling')) {
    input.duration = String(snapToAllowed(rawSec, [5, 10]));
  } else if (modelId.includes('ltx')) {
    input.duration = snapToAllowed(rawSec, [6, 8, 10]);
    input.aspect_ratio = aspectRatio || 'auto';
    input.resolution = resolution || '1080p';
    input.generate_audio = generateAudio;
  } else if (modelId.includes('wan') || modelId.includes('cosmos') || modelId.includes('minimax') || modelId.includes('pixverse')) {
    input.duration = rawSec;
  } else {
    if (duration) input.duration = rawSec;
  }

  const result = await fal.subscribe(modelId, { input });
  const data = result.data;

  const videoUrl = data.video?.url || null;
  return { videoUrl };
}

/**
 * Avatar/lipsync video via fal.ai.
 * Returns { videoUrl }
 */
export async function falAvatarVideo(modelId, { imageUrl, audioUrl, text, duration }) {
  assertKey();
  const input = {};

  if (imageUrl) input.image_url = imageUrl;
  if (audioUrl) input.audio_url = audioUrl;
  if (text) input.text = text;
  if (duration) input.duration = parseDurationSec(duration);

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
