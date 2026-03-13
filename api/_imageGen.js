/**
 * Shared image generation helper.
 * Supports OpenAI DALL-E 3, Google Imagen, Google Gemini (Nano Banana), and fal.ai models.
 */
import { falTextToImage } from './_fal.js';

const IMAGEN_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_GENERATE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const DALLE_SIZE_TO_IMAGEN_ASPECT = {
  '1024x1024': '1:1',
  '1024x1792': '9:16',
  '1792x1024': '16:9',
};

const SIZE_TO_ASPECT = {
  '1024x1024': '1:1',
  '1024x1792': '9:16',
  '1792x1024': '16:9',
};

export const IMAGE_MODELS = {
  'dall-e-3': { provider: 'openai', label: 'DALL-E 3 (OpenAI)', cost: '$0.08' },
  'imagen-4.0-fast-generate-001': { provider: 'google', label: 'Imagen 4 Fast (Google)', cost: '$0.02' },
  'imagen-4.0-generate-001': { provider: 'google', label: 'Imagen 4 (Google)', cost: '$0.04' },
  'imagen-4.0-ultra-generate-001': { provider: 'google', label: 'Imagen 4 Ultra (Google)', cost: '$0.06' },
  'nano-banana-pro': { provider: 'google-gemini', label: 'Nano Banana Pro (Gemini)', cost: '$0.067' },
  'fal-nano-banana-2': { provider: 'fal', falModelId: 'fal-ai/nano-banana-2', label: 'Nano Banana 2', cost: '$0.08' },
  'fal-flux-schnell': { provider: 'fal', falModelId: 'fal-ai/flux/schnell', label: 'FLUX.1 Schnell', cost: '$0.003' },
  'fal-flux-dev': { provider: 'fal', falModelId: 'fal-ai/flux/dev', label: 'FLUX.1 Dev', cost: '$0.025' },
  'fal-flux-2-pro': { provider: 'fal', falModelId: 'fal-ai/flux-2-pro', label: 'FLUX 2 Pro', cost: '$0.03' },
  'fal-recraft-v3': { provider: 'fal', falModelId: 'fal-ai/recraft/v3/text-to-image', label: 'Recraft V3', cost: '$0.04' },
  'fal-recraft-v4-pro': { provider: 'fal', falModelId: 'fal-ai/recraft/v4/pro/text-to-image', label: 'Recraft V4 Pro', cost: '$0.25' },
  'fal-seedream-4.5': { provider: 'fal', falModelId: 'fal-ai/bytedance/seedream/v4.5/text-to-image', label: 'Seedream 4.5', cost: '$0.03' },
  'fal-qwen-image-2': { provider: 'fal', falModelId: 'fal-ai/qwen-image-2/text-to-image', label: 'Qwen Image 2.0', cost: '$0.02' },
  'fal-imagineart-1.5': { provider: 'fal', falModelId: 'imagineart/imagineart-1.5-preview/text-to-image', label: 'ImagineArt 1.5', cost: '$0.04' },
};

export const VIDEO_MODELS = {
  'veo-3.1-generate-preview': { provider: 'google', label: 'Veo 3.1 Preview (Google)' },
  'veo-3.1-fast': { provider: 'google', label: 'Veo 3.1 Fast (Google)' },
};

function getProvider(model) {
  if (IMAGE_MODELS[model]?.provider) return IMAGE_MODELS[model].provider;
  if (model.startsWith('fal-')) return 'fal';
  if (model === 'nano-banana-pro') return 'google-gemini';
  if (model.startsWith('imagen')) return 'google';
  return 'openai';
}

async function generateWithDalle(prompt, { openaiKey, size = '1792x1024', responseFormat = 'url' }) {
  const resp = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
      quality: 'hd',
      style: 'natural',
      response_format: responseFormat,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => 'unknown');
    throw new Error(`DALL-E error (${resp.status}): ${errText}`);
  }

  const data = await resp.json();
  if (responseFormat === 'b64_json') {
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) throw new Error('No image data returned from DALL-E');
    return { imageUrl: `data:image/png;base64,${b64}`, revisedPrompt: data.data?.[0]?.revised_prompt || '' };
  }
  const url = data.data?.[0]?.url;
  if (!url) throw new Error('No image URL returned from DALL-E');
  return { imageUrl: url, revisedPrompt: data.data?.[0]?.revised_prompt || '' };
}

async function generateWithImagen(prompt, { geminiKey, model, size = '1792x1024' }) {
  const aspectRatio = DALLE_SIZE_TO_IMAGEN_ASPECT[size] || '16:9';

  const resp = await fetch(`${IMAGEN_BASE}/models/${model}:predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': geminiKey,
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio,
      },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => 'unknown');
    throw new Error(`Imagen error (${resp.status}): ${errText}`);
  }

  const data = await resp.json();
  const prediction = data.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) {
    throw new Error('No image data returned from Imagen');
  }

  const mime = prediction.mimeType || 'image/png';
  return {
    imageUrl: `data:${mime};base64,${prediction.bytesBase64Encoded}`,
    revisedPrompt: '',
  };
}

async function generateWithGemini(prompt, { geminiKey, size = '1792x1024' }) {
  const aspectRatio = SIZE_TO_ASPECT[size] || '16:9';
  const geminiModel = 'gemini-3-pro-image-preview';

  const resp = await fetch(`${GEMINI_GENERATE_URL}/${geminiModel}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': geminiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Generate an image: ${prompt}` }] }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
      imageGenerationConfig: { aspectRatio },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => 'unknown');
    throw new Error(`Gemini image error (${resp.status}): ${errText}`);
  }

  const data = await resp.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(p => p.inlineData);

  if (!imagePart?.inlineData?.data) {
    throw new Error('No image returned from Gemini');
  }

  const mime = imagePart.inlineData.mimeType || 'image/png';
  return {
    imageUrl: `data:${mime};base64,${imagePart.inlineData.data}`,
    revisedPrompt: '',
  };
}

async function generateWithFal(prompt, { model, size = '1792x1024' }) {
  const falKey = process.env.FAL_API_KEY;
  if (!falKey) throw new Error('FAL_API_KEY is not configured. Add it in your environment variables.');

  const modelInfo = IMAGE_MODELS[model];
  const falModelId = modelInfo?.falModelId;
  if (!falModelId) throw new Error(`Unknown fal model: ${model}`);

  const aspectRatio = SIZE_TO_ASPECT[size] || '16:9';
  const result = await falTextToImage(falModelId, { prompt, aspectRatio });

  if (!result.imageUrl) throw new Error('No image returned from fal.ai');

  return { imageUrl: result.imageUrl, revisedPrompt: '' };
}

/**
 * Generate a single image using the specified model.
 */
export async function generateImage(prompt, { model = 'dall-e-3', size = '1792x1024', responseFormat = 'url' } = {}) {
  const provider = getProvider(model);

  if (provider === 'fal') {
    return generateWithFal(prompt, { model, size });
  }

  if (provider === 'google-gemini') {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error('GEMINI_API_KEY is not configured. Add it in your environment variables.');
    return generateWithGemini(prompt, { geminiKey, size });
  }

  if (provider === 'google') {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error('GEMINI_API_KEY is not configured. Add it in your environment variables.');
    return generateWithImagen(prompt, { geminiKey, model, size });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error('OPENAI_API_KEY is not configured. Add it in your environment variables.');
  return generateWithDalle(prompt, { openaiKey, size, responseFormat });
}

/**
 * Edit an image using Google Gemini (for nano-banana-pro-edit).
 */
export async function editImageWithGemini(imageUrl, editPrompt) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error('GEMINI_API_KEY is not configured');

  const geminiModel = 'gemini-3-pro-image-preview';

  let imageParts;
  if (imageUrl.startsWith('data:')) {
    const [header, b64] = imageUrl.split(',');
    const mime = header.match(/data:([^;]+)/)?.[1] || 'image/png';
    imageParts = { inlineData: { mimeType: mime, data: b64 } };
  } else {
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) throw new Error('Failed to fetch source image');
    const buf = Buffer.from(await imgResp.arrayBuffer());
    const mime = imgResp.headers.get('content-type') || 'image/png';
    imageParts = { inlineData: { mimeType: mime, data: buf.toString('base64') } };
  }

  const resp = await fetch(`${GEMINI_GENERATE_URL}/${geminiModel}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': geminiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [imageParts, { text: editPrompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => 'unknown');
    throw new Error(`Gemini edit error (${resp.status}): ${errText}`);
  }

  const data = await resp.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find(p => p.inlineData);

  if (!imgPart?.inlineData?.data) {
    throw new Error('No edited image returned from Gemini');
  }

  const mime = imgPart.inlineData.mimeType || 'image/png';
  return { imageUrl: `data:${mime};base64,${imgPart.inlineData.data}` };
}

export function getAvailableProviders() {
  return {
    openai: !!process.env.OPENAI_API_KEY,
    google: !!process.env.GEMINI_API_KEY,
    fal: !!process.env.FAL_API_KEY,
  };
}
