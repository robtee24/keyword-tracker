export type ModelProvider = 'openai' | 'google' | 'fal';
export type ModelCategory = 'textToImage' | 'imageEdit' | 'textToVideo' | 'imageToVideo' | 'backgroundRemoval' | 'imageUpscale';

export interface ModelOption {
  id: string;
  label: string;
  provider: ModelProvider;
  falModelId?: string;
  cost: number;
  userCost: number;
  costLabel: string;
  description: string;
  category: ModelCategory;
}

function markup(cost: number): number {
  return Math.round(cost * 1.3 * 10000) / 10000;
}

function costLabel(cost: number, unit: string): string {
  const uc = markup(cost);
  if (uc < 0.01) return `$${uc.toFixed(4)}/${unit}`;
  return `$${uc.toFixed(2)}/${unit}`;
}

// --------------- TEXT TO IMAGE ---------------
export const TEXT_TO_IMAGE_MODELS: ModelOption[] = [
  {
    id: 'imagen-4.0-fast-generate-001', label: 'Imagen 4 Fast', provider: 'google',
    cost: 0.02, userCost: markup(0.02), costLabel: costLabel(0.02, 'image'),
    description: 'Google — fast generation, great value', category: 'textToImage',
  },
  {
    id: 'imagen-4.0-generate-001', label: 'Imagen 4', provider: 'google',
    cost: 0.04, userCost: markup(0.04), costLabel: costLabel(0.04, 'image'),
    description: 'Google — flagship quality, best text rendering', category: 'textToImage',
  },
  {
    id: 'imagen-4.0-ultra-generate-001', label: 'Imagen 4 Ultra', provider: 'google',
    cost: 0.06, userCost: markup(0.06), costLabel: costLabel(0.06, 'image'),
    description: 'Google — highest precision, up to 2K resolution', category: 'textToImage',
  },
  {
    id: 'nano-banana-pro', label: 'Nano Banana Pro', provider: 'google',
    cost: 0.067, userCost: markup(0.067), costLabel: costLabel(0.067, 'image'),
    description: 'Google Gemini — state-of-the-art, typography', category: 'textToImage',
  },
  {
    id: 'dall-e-3', label: 'DALL-E 3', provider: 'openai',
    cost: 0.08, userCost: markup(0.08), costLabel: costLabel(0.08, 'image'),
    description: 'OpenAI — high quality, creative', category: 'textToImage',
  },
  {
    id: 'fal-flux-schnell', label: 'FLUX.1 Schnell', provider: 'fal',
    falModelId: 'fal-ai/flux/schnell', cost: 0.003, userCost: markup(0.003), costLabel: costLabel(0.003, 'MP'),
    description: 'Black Forest Labs — ultra fast, 1-4 steps', category: 'textToImage',
  },
  {
    id: 'fal-flux-dev', label: 'FLUX.1 Dev', provider: 'fal',
    falModelId: 'fal-ai/flux/dev', cost: 0.025, userCost: markup(0.025), costLabel: costLabel(0.025, 'image'),
    description: 'Black Forest Labs — high quality, LoRA support', category: 'textToImage',
  },
  {
    id: 'fal-recraft-v3', label: 'Recraft V3', provider: 'fal',
    falModelId: 'fal-ai/recraft/v3/text-to-image', cost: 0.04, userCost: markup(0.04), costLabel: costLabel(0.04, 'image'),
    description: 'Recraft — vector art, typography, brand style', category: 'textToImage',
  },
];

// --------------- IMAGE EDIT ---------------
export const IMAGE_EDIT_MODELS: ModelOption[] = [
  {
    id: 'nano-banana-pro-edit', label: 'Nano Banana Pro Edit', provider: 'google',
    cost: 0.067, userCost: markup(0.067), costLabel: costLabel(0.067, 'edit'),
    description: 'Google Gemini — prompt-based image editing', category: 'imageEdit',
  },
  {
    id: 'fal-flux-kontext', label: 'FLUX Kontext Pro', provider: 'fal',
    falModelId: 'fal-ai/flux-pro/kontext', cost: 0.04, userCost: markup(0.04), costLabel: costLabel(0.04, 'edit'),
    description: 'Black Forest Labs — local edits, style transfer', category: 'imageEdit',
  },
  {
    id: 'fal-nano-banana-2-edit', label: 'Nano Banana 2 Edit', provider: 'fal',
    falModelId: 'fal-ai/nano-banana-2/edit', cost: 0.15, userCost: markup(0.15), costLabel: costLabel(0.15, 'edit'),
    description: 'Google via fal — latest generation editing', category: 'imageEdit',
  },
];

// --------------- TEXT TO VIDEO ---------------
export const TEXT_TO_VIDEO_MODELS: ModelOption[] = [
  {
    id: 'veo-3.1-generate-preview', label: 'Veo 3.1', provider: 'google',
    cost: 0.40, userCost: markup(0.40), costLabel: costLabel(0.40, 'sec'),
    description: 'Google — highest quality, native audio', category: 'textToVideo',
  },
  {
    id: 'veo-3.1-fast', label: 'Veo 3.1 Fast', provider: 'google',
    cost: 0.15, userCost: markup(0.15), costLabel: costLabel(0.15, 'sec'),
    description: 'Google — fast, with audio', category: 'textToVideo',
  },
  {
    id: 'fal-veo-3.1', label: 'Veo 3.1 (fal)', provider: 'fal',
    falModelId: 'fal-ai/veo3.1', cost: 0.40, userCost: markup(0.40), costLabel: costLabel(0.40, 'sec'),
    description: 'Google via fal — highest quality, native audio', category: 'textToVideo',
  },
  {
    id: 'fal-veo-3.1-fast', label: 'Veo 3.1 Fast (fal)', provider: 'fal',
    falModelId: 'fal-ai/veo3.1/fast', cost: 0.15, userCost: markup(0.15), costLabel: costLabel(0.15, 'sec'),
    description: 'Google via fal — fast, with audio', category: 'textToVideo',
  },
  {
    id: 'fal-kling-3-pro', label: 'Kling 3.0 Pro', provider: 'fal',
    falModelId: 'fal-ai/kling-video/v3/pro/text-to-video', cost: 0.07, userCost: markup(0.07), costLabel: costLabel(0.07, 'sec'),
    description: 'Kling — cinematic, great motion', category: 'textToVideo',
  },
  {
    id: 'fal-kling-2.5-turbo', label: 'Kling 2.5 Turbo Pro', provider: 'fal',
    falModelId: 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video', cost: 0.07, userCost: markup(0.07), costLabel: costLabel(0.07, 'sec'),
    description: 'Kling — fast turbo, cinematic quality', category: 'textToVideo',
  },
  {
    id: 'fal-ltx-2.3-fast', label: 'LTX 2.3 Fast', provider: 'fal',
    falModelId: 'fal-ai/ltx-2.3/text-to-video/fast', cost: 0.04, userCost: markup(0.04), costLabel: costLabel(0.04, 'sec'),
    description: 'LTX — fast, with audio, great value', category: 'textToVideo',
  },
];

// --------------- IMAGE TO VIDEO ---------------
export const IMAGE_TO_VIDEO_MODELS: ModelOption[] = [
  {
    id: 'fal-veo-3.1-i2v', label: 'Veo 3.1 I2V', provider: 'fal',
    falModelId: 'fal-ai/veo3.1/image-to-video', cost: 0.40, userCost: markup(0.40), costLabel: costLabel(0.40, 'sec'),
    description: 'Google via fal — animate images, with audio', category: 'imageToVideo',
  },
  {
    id: 'fal-veo-3.1-fast-i2v', label: 'Veo 3.1 Fast I2V', provider: 'fal',
    falModelId: 'fal-ai/veo3.1/fast/image-to-video', cost: 0.15, userCost: markup(0.15), costLabel: costLabel(0.15, 'sec'),
    description: 'Google via fal — fast image animation', category: 'imageToVideo',
  },
  {
    id: 'fal-kling-3-pro-i2v', label: 'Kling 3.0 Pro I2V', provider: 'fal',
    falModelId: 'fal-ai/kling-video/v3/pro/image-to-video', cost: 0.07, userCost: markup(0.07), costLabel: costLabel(0.07, 'sec'),
    description: 'Kling — cinematic image-to-video', category: 'imageToVideo',
  },
  {
    id: 'fal-kling-2.5-i2v', label: 'Kling 2.5 Turbo I2V', provider: 'fal',
    falModelId: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video', cost: 0.07, userCost: markup(0.07), costLabel: costLabel(0.07, 'sec'),
    description: 'Kling — fast turbo image animation', category: 'imageToVideo',
  },
  {
    id: 'fal-ltx-2.3-i2v', label: 'LTX 2.3 I2V', provider: 'fal',
    falModelId: 'fal-ai/ltx-2.3/image-to-video', cost: 0.04, userCost: markup(0.04), costLabel: costLabel(0.04, 'sec'),
    description: 'LTX — fast image animation, with audio', category: 'imageToVideo',
  },
];

// --------------- BACKGROUND REMOVAL ---------------
export const BG_REMOVAL_MODELS: ModelOption[] = [
  {
    id: 'fal-bria-bg-remove', label: 'Bria RMBG 2.0', provider: 'fal',
    falModelId: 'fal-ai/bria/background/remove', cost: 0.01, userCost: markup(0.01), costLabel: costLabel(0.01, 'image'),
    description: 'Bria — high quality background removal', category: 'backgroundRemoval',
  },
  {
    id: 'fal-pixelcut-bg', label: 'Pixelcut BG Removal', provider: 'fal',
    falModelId: 'fal-ai/pixelcut/background-removal', cost: 0.01, userCost: markup(0.01), costLabel: costLabel(0.01, 'image'),
    description: 'Pixelcut — fast, clean cutouts', category: 'backgroundRemoval',
  },
];

// --------------- IMAGE UPSCALE ---------------
export const UPSCALE_MODELS: ModelOption[] = [
  {
    id: 'fal-seedvr-upscale', label: 'SeedVR Upscale', provider: 'fal',
    falModelId: 'fal-ai/seedvr/upscale/image', cost: 0.02, userCost: markup(0.02), costLabel: costLabel(0.02, 'image'),
    description: 'SeedVR — AI-powered image upscaling', category: 'imageUpscale',
  },
];

// Combined lookup for all models
export const ALL_MODELS: ModelOption[] = [
  ...TEXT_TO_IMAGE_MODELS,
  ...IMAGE_EDIT_MODELS,
  ...TEXT_TO_VIDEO_MODELS,
  ...IMAGE_TO_VIDEO_MODELS,
  ...BG_REMOVAL_MODELS,
  ...UPSCALE_MODELS,
];

export function getModelById(id: string): ModelOption | undefined {
  return ALL_MODELS.find(m => m.id === id);
}

export function getModelsByCategory(category: ModelCategory): ModelOption[] {
  return ALL_MODELS.filter(m => m.category === category);
}

// Backward-compat exports for existing code
export const IMAGE_MODELS = TEXT_TO_IMAGE_MODELS;
export const VIDEO_MODELS = TEXT_TO_VIDEO_MODELS;

// --------------- PREFERENCES ---------------
const SETTINGS_KEY_PREFIX = 'kt_model_prefs_';

export interface ModelPreferences {
  textToImage: string;
  imageEdit: string;
  textToVideo: string;
  imageToVideo: string;
  backgroundRemoval: string;
  imageUpscale: string;
  // Legacy compat
  imageModel: string;
  videoModel: string;
}

const DEFAULTS: ModelPreferences = {
  textToImage: 'imagen-4.0-generate-001',
  imageEdit: 'nano-banana-pro-edit',
  textToVideo: 'veo-3.1-generate-preview',
  imageToVideo: 'fal-veo-3.1-fast-i2v',
  backgroundRemoval: 'fal-bria-bg-remove',
  imageUpscale: 'fal-seedvr-upscale',
  imageModel: 'imagen-4.0-generate-001',
  videoModel: 'veo-3.1-generate-preview',
};

export function getModelPreferences(projectId: string): ModelPreferences {
  try {
    const raw = localStorage.getItem(`${SETTINGS_KEY_PREFIX}${projectId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged = { ...DEFAULTS, ...parsed };
      merged.imageModel = merged.textToImage;
      merged.videoModel = merged.textToVideo;
      return merged;
    }
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export function setModelPreferences(projectId: string, prefs: Partial<ModelPreferences>): void {
  const current = getModelPreferences(projectId);
  const updated = { ...current, ...prefs };
  if (prefs.textToImage) updated.imageModel = prefs.textToImage;
  if (prefs.textToVideo) updated.videoModel = prefs.textToVideo;
  localStorage.setItem(`${SETTINGS_KEY_PREFIX}${projectId}`, JSON.stringify(updated));
}
