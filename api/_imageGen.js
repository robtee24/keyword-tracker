/**
 * Shared image generation helper.
 * Supports OpenAI DALL-E 3 and Google Imagen models via a unified interface.
 */

const IMAGEN_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const DALLE_SIZE_TO_IMAGEN_ASPECT = {
  '1024x1024': '1:1',
  '1024x1792': '9:16',
  '1792x1024': '16:9',
};

export const IMAGE_MODELS = {
  'dall-e-3': { provider: 'openai', label: 'DALL-E 3 (OpenAI)', cost: '$0.08' },
  'imagen-3.0-generate-002': { provider: 'google', label: 'Imagen 3 (Google)', cost: '$0.03' },
  'imagen-4.0-fast-generate-001': { provider: 'google', label: 'Imagen 4 Fast (Google)', cost: '$0.02' },
  'imagen-4.0-generate-001': { provider: 'google', label: 'Imagen 4 (Google)', cost: '$0.04' },
  'imagen-4.0-ultra-generate-001': { provider: 'google', label: 'Imagen 4 Ultra (Google)', cost: '$0.06' },
};

export const VIDEO_MODELS = {
  'veo-3.1-generate-preview': { provider: 'google', label: 'Veo 3.1 Preview (Google)' },
};

function getProvider(model) {
  return IMAGE_MODELS[model]?.provider || (model.startsWith('imagen') ? 'google' : 'openai');
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

/**
 * Generate a single image using the specified model.
 * @param {string} prompt - The image generation prompt
 * @param {object} options
 * @param {string} options.model - Model ID (dall-e-3, imagen-4.0-generate-001, etc.)
 * @param {string} [options.size] - DALL-E size format (1024x1024, 1792x1024, etc.)
 * @param {string} [options.responseFormat] - For DALL-E: 'url' or 'b64_json'
 * @returns {Promise<{ imageUrl: string, revisedPrompt: string }>}
 */
export async function generateImage(prompt, { model = 'dall-e-3', size = '1792x1024', responseFormat = 'url' } = {}) {
  const provider = getProvider(model);

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
 * Check which providers have their API keys configured.
 */
export function getAvailableProviders() {
  return {
    openai: !!process.env.OPENAI_API_KEY,
    google: !!process.env.GEMINI_API_KEY,
  };
}
