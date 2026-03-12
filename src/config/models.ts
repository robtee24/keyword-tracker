export type ModelProvider = 'openai' | 'google' | 'fal' | 'anthropic';
export type ModelCategory =
  | 'textToImage' | 'imageEdit' | 'textToVideo' | 'imageToVideo'
  | 'backgroundRemoval' | 'imageUpscale'
  | 'contentGeneration' | 'analysisAudit' | 'ideaGeneration';

export interface ModelRoute {
  provider: ModelProvider;
  modelId: string;
  falModelId?: string;
  label: string;
}

export interface ModelOption {
  id: string;
  label: string;
  vendor: string;
  provider: ModelProvider;
  falModelId?: string;
  cost: number;
  userCost: number;
  costLabel: string;
  description: string;
  category: ModelCategory;
  routes?: ModelRoute[];
}

function markup(cost: number): number {
  return Math.round(cost * 1.3 * 10000) / 10000;
}

function costLabel(cost: number, unit: string): string {
  const uc = markup(cost);
  if (uc < 0.01) return `$${uc.toFixed(4)}/${unit}`;
  return `$${uc.toFixed(2)}/${unit}`;
}

function estCostLabel(cost: number): string {
  const uc = markup(cost);
  if (uc < 0.01) return `~$${uc.toFixed(3)}/task`;
  return `~$${uc.toFixed(2)}/task`;
}

// --------------- TEXT TO IMAGE ---------------
export const TEXT_TO_IMAGE_MODELS: ModelOption[] = [
  {
    id: 'imagen-4.0-fast-generate-001', label: 'Imagen 4 Fast', vendor: 'Google', provider: 'google',
    cost: 0.02, userCost: markup(0.02), costLabel: costLabel(0.02, 'image'),
    description: 'Fast generation, great value', category: 'textToImage',
  },
  {
    id: 'imagen-4.0-generate-001', label: 'Imagen 4', vendor: 'Google', provider: 'google',
    cost: 0.04, userCost: markup(0.04), costLabel: costLabel(0.04, 'image'),
    description: 'Flagship quality, best text rendering', category: 'textToImage',
  },
  {
    id: 'imagen-4.0-ultra-generate-001', label: 'Imagen 4 Ultra', vendor: 'Google', provider: 'google',
    cost: 0.06, userCost: markup(0.06), costLabel: costLabel(0.06, 'image'),
    description: 'Highest precision, up to 2K resolution', category: 'textToImage',
  },
  {
    id: 'nano-banana-pro', label: 'Nano Banana Pro', vendor: 'Google', provider: 'google',
    cost: 0.067, userCost: markup(0.067), costLabel: costLabel(0.067, 'image'),
    description: 'State-of-the-art, typography', category: 'textToImage',
  },
  {
    id: 'dall-e-3', label: 'DALL-E 3', vendor: 'OpenAI', provider: 'openai',
    cost: 0.08, userCost: markup(0.08), costLabel: costLabel(0.08, 'image'),
    description: 'High quality, creative', category: 'textToImage',
  },
  {
    id: 'fal-flux-schnell', label: 'FLUX.1 Schnell', vendor: 'FLUX', provider: 'fal',
    falModelId: 'fal-ai/flux/schnell', cost: 0.003, userCost: markup(0.003), costLabel: costLabel(0.003, 'MP'),
    description: 'Ultra fast, 1-4 steps', category: 'textToImage',
  },
  {
    id: 'fal-flux-dev', label: 'FLUX.1 Dev', vendor: 'FLUX', provider: 'fal',
    falModelId: 'fal-ai/flux/dev', cost: 0.025, userCost: markup(0.025), costLabel: costLabel(0.025, 'image'),
    description: 'High quality, LoRA support', category: 'textToImage',
  },
  {
    id: 'fal-recraft-v3', label: 'Recraft V3', vendor: 'Recraft', provider: 'fal',
    falModelId: 'fal-ai/recraft/v3/text-to-image', cost: 0.04, userCost: markup(0.04), costLabel: costLabel(0.04, 'image'),
    description: 'Vector art, typography, brand style', category: 'textToImage',
  },
];

// --------------- IMAGE EDIT ---------------
export const IMAGE_EDIT_MODELS: ModelOption[] = [
  {
    id: 'nano-banana-pro-edit', label: 'Nano Banana Pro Edit', vendor: 'Google', provider: 'google',
    cost: 0.067, userCost: markup(0.067), costLabel: costLabel(0.067, 'edit'),
    description: 'Prompt-based image editing', category: 'imageEdit',
  },
  {
    id: 'fal-flux-kontext', label: 'FLUX Kontext Pro', vendor: 'FLUX', provider: 'fal',
    falModelId: 'fal-ai/flux-pro/kontext', cost: 0.04, userCost: markup(0.04), costLabel: costLabel(0.04, 'edit'),
    description: 'Local edits, style transfer', category: 'imageEdit',
  },
  {
    id: 'fal-nano-banana-2-edit', label: 'Nano Banana 2 Edit', vendor: 'Google', provider: 'fal',
    falModelId: 'fal-ai/nano-banana-2/edit', cost: 0.15, userCost: markup(0.15), costLabel: costLabel(0.15, 'edit'),
    description: 'Latest generation editing', category: 'imageEdit',
  },
];

// --------------- TEXT TO VIDEO ---------------
export const TEXT_TO_VIDEO_MODELS: ModelOption[] = [
  {
    id: 'veo-3.1-generate-preview', label: 'Veo 3.1', vendor: 'Google', provider: 'google',
    cost: 0.40, userCost: markup(0.40), costLabel: costLabel(0.40, 'sec'),
    description: 'Highest quality, native audio', category: 'textToVideo',
    routes: [
      { provider: 'google', modelId: 'veo-3.1-generate-preview', label: 'Direct' },
      { provider: 'fal', modelId: 'fal-veo-3.1', falModelId: 'fal-ai/veo3.1', label: 'fal.ai' },
    ],
  },
  {
    id: 'veo-3.1-fast', label: 'Veo 3.1 Fast', vendor: 'Google', provider: 'google',
    cost: 0.15, userCost: markup(0.15), costLabel: costLabel(0.15, 'sec'),
    description: 'Fast, with audio', category: 'textToVideo',
    routes: [
      { provider: 'google', modelId: 'veo-3.1-fast', label: 'Direct' },
      { provider: 'fal', modelId: 'fal-veo-3.1-fast', falModelId: 'fal-ai/veo3.1/fast', label: 'fal.ai' },
    ],
  },
  {
    id: 'fal-kling-3-pro', label: 'Kling 3.0 Pro', vendor: 'Kling', provider: 'fal',
    falModelId: 'fal-ai/kling-video/v3/pro/text-to-video', cost: 0.07, userCost: markup(0.07), costLabel: costLabel(0.07, 'sec'),
    description: 'Cinematic, great motion', category: 'textToVideo',
  },
  {
    id: 'fal-kling-2.5-turbo', label: 'Kling 2.5 Turbo Pro', vendor: 'Kling', provider: 'fal',
    falModelId: 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video', cost: 0.07, userCost: markup(0.07), costLabel: costLabel(0.07, 'sec'),
    description: 'Fast turbo, cinematic quality', category: 'textToVideo',
  },
  {
    id: 'fal-ltx-2.3-fast', label: 'LTX 2.3 Fast', vendor: 'LTX', provider: 'fal',
    falModelId: 'fal-ai/ltx-2.3/text-to-video/fast', cost: 0.04, userCost: markup(0.04), costLabel: costLabel(0.04, 'sec'),
    description: 'Fast, with audio, great value', category: 'textToVideo',
  },
];

// --------------- IMAGE TO VIDEO ---------------
export const IMAGE_TO_VIDEO_MODELS: ModelOption[] = [
  {
    id: 'fal-veo-3.1-i2v', label: 'Veo 3.1 I2V', vendor: 'Google', provider: 'fal',
    falModelId: 'fal-ai/veo3.1/image-to-video', cost: 0.40, userCost: markup(0.40), costLabel: costLabel(0.40, 'sec'),
    description: 'Animate images, with audio', category: 'imageToVideo',
  },
  {
    id: 'fal-veo-3.1-fast-i2v', label: 'Veo 3.1 Fast I2V', vendor: 'Google', provider: 'fal',
    falModelId: 'fal-ai/veo3.1/fast/image-to-video', cost: 0.15, userCost: markup(0.15), costLabel: costLabel(0.15, 'sec'),
    description: 'Fast image animation', category: 'imageToVideo',
  },
  {
    id: 'fal-kling-3-pro-i2v', label: 'Kling 3.0 Pro I2V', vendor: 'Kling', provider: 'fal',
    falModelId: 'fal-ai/kling-video/v3/pro/image-to-video', cost: 0.07, userCost: markup(0.07), costLabel: costLabel(0.07, 'sec'),
    description: 'Cinematic image-to-video', category: 'imageToVideo',
  },
  {
    id: 'fal-kling-2.5-i2v', label: 'Kling 2.5 Turbo I2V', vendor: 'Kling', provider: 'fal',
    falModelId: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video', cost: 0.07, userCost: markup(0.07), costLabel: costLabel(0.07, 'sec'),
    description: 'Fast turbo image animation', category: 'imageToVideo',
  },
  {
    id: 'fal-ltx-2.3-i2v', label: 'LTX 2.3 I2V', vendor: 'LTX', provider: 'fal',
    falModelId: 'fal-ai/ltx-2.3/image-to-video', cost: 0.04, userCost: markup(0.04), costLabel: costLabel(0.04, 'sec'),
    description: 'Fast image animation, with audio', category: 'imageToVideo',
  },
];

// --------------- BACKGROUND REMOVAL ---------------
export const BG_REMOVAL_MODELS: ModelOption[] = [
  {
    id: 'fal-bria-bg-remove', label: 'Bria RMBG 2.0', vendor: 'Bria', provider: 'fal',
    falModelId: 'fal-ai/bria/background/remove', cost: 0.01, userCost: markup(0.01), costLabel: costLabel(0.01, 'image'),
    description: 'High quality background removal', category: 'backgroundRemoval',
  },
  {
    id: 'fal-pixelcut-bg', label: 'Pixelcut BG Removal', vendor: 'Pixelcut', provider: 'fal',
    falModelId: 'fal-ai/pixelcut/background-removal', cost: 0.01, userCost: markup(0.01), costLabel: costLabel(0.01, 'image'),
    description: 'Fast, clean cutouts', category: 'backgroundRemoval',
  },
];

// --------------- IMAGE UPSCALE ---------------
export const UPSCALE_MODELS: ModelOption[] = [
  {
    id: 'fal-seedvr-upscale', label: 'SeedVR Upscale', vendor: 'SeedVR', provider: 'fal',
    falModelId: 'fal-ai/seedvr/upscale/image', cost: 0.02, userCost: markup(0.02), costLabel: costLabel(0.02, 'image'),
    description: 'AI-powered image upscaling', category: 'imageUpscale',
  },
];

// --------------- LLM: CONTENT GENERATION ---------------
export const CONTENT_GENERATION_MODELS: ModelOption[] = [
  {
    id: 'claude-sonnet-4', label: 'Claude Sonnet 4', vendor: 'Anthropic', provider: 'anthropic',
    cost: 0.135, userCost: markup(0.135), costLabel: estCostLabel(0.135),
    description: 'Best quality writing, highest accuracy', category: 'contentGeneration',
  },
  {
    id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', vendor: 'Anthropic', provider: 'anthropic',
    cost: 0.036, userCost: markup(0.036), costLabel: estCostLabel(0.036),
    description: 'Fast, good quality, much cheaper', category: 'contentGeneration',
  },
  {
    id: 'gpt-4o', label: 'GPT-4o', vendor: 'OpenAI', provider: 'openai',
    cost: 0.093, userCost: markup(0.093), costLabel: estCostLabel(0.093),
    description: 'Strong writing and analysis', category: 'contentGeneration',
  },
  {
    id: 'gpt-4o-mini', label: 'GPT-4o Mini', vendor: 'OpenAI', provider: 'openai',
    cost: 0.006, userCost: markup(0.006), costLabel: estCostLabel(0.006),
    description: 'Ultra cheap, fast, good for simple tasks', category: 'contentGeneration',
  },
  {
    id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', vendor: 'Google', provider: 'google',
    cost: 0.086, userCost: markup(0.086), costLabel: estCostLabel(0.086),
    description: 'Strong reasoning and writing', category: 'contentGeneration',
  },
  {
    id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', vendor: 'Google', provider: 'google',
    cost: 0.006, userCost: markup(0.006), costLabel: estCostLabel(0.006),
    description: 'Ultra cheap, fast, solid quality', category: 'contentGeneration',
  },
];

// --------------- LLM: ANALYSIS & AUDITS ---------------
export const ANALYSIS_AUDIT_MODELS: ModelOption[] = [
  {
    id: 'claude-sonnet-4', label: 'Claude Sonnet 4', vendor: 'Anthropic', provider: 'anthropic',
    cost: 0.057, userCost: markup(0.057), costLabel: estCostLabel(0.057),
    description: 'Thorough, nuanced analysis', category: 'analysisAudit',
  },
  {
    id: 'gpt-4o', label: 'GPT-4o', vendor: 'OpenAI', provider: 'openai',
    cost: 0.04, userCost: markup(0.04), costLabel: estCostLabel(0.04),
    description: 'Strong analytical capabilities', category: 'analysisAudit',
  },
  {
    id: 'gpt-4o-mini', label: 'GPT-4o Mini', vendor: 'OpenAI', provider: 'openai',
    cost: 0.002, userCost: markup(0.002), costLabel: estCostLabel(0.002),
    description: 'Fast, cheap, good for bulk analysis', category: 'analysisAudit',
  },
  {
    id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', vendor: 'Google', provider: 'google',
    cost: 0.002, userCost: markup(0.002), costLabel: estCostLabel(0.002),
    description: 'Fast, cheap, solid quality', category: 'analysisAudit',
  },
];

// --------------- LLM: IDEA GENERATION ---------------
export const IDEA_GENERATION_MODELS: ModelOption[] = [
  {
    id: 'claude-sonnet-4', label: 'Claude Sonnet 4', vendor: 'Anthropic', provider: 'anthropic',
    cost: 0.051, userCost: markup(0.051), costLabel: estCostLabel(0.051),
    description: 'Creative, high quality ideas', category: 'ideaGeneration',
  },
  {
    id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', vendor: 'Anthropic', provider: 'anthropic',
    cost: 0.014, userCost: markup(0.014), costLabel: estCostLabel(0.014),
    description: 'Fast, good quality, great value', category: 'ideaGeneration',
  },
  {
    id: 'gpt-4o', label: 'GPT-4o', vendor: 'OpenAI', provider: 'openai',
    cost: 0.035, userCost: markup(0.035), costLabel: estCostLabel(0.035),
    description: 'Strong creative generation', category: 'ideaGeneration',
  },
  {
    id: 'gpt-4o-mini', label: 'GPT-4o Mini', vendor: 'OpenAI', provider: 'openai',
    cost: 0.002, userCost: markup(0.002), costLabel: estCostLabel(0.002),
    description: 'Ultra cheap, fast brainstorming', category: 'ideaGeneration',
  },
  {
    id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', vendor: 'Google', provider: 'google',
    cost: 0.002, userCost: markup(0.002), costLabel: estCostLabel(0.002),
    description: 'Fast, cheap, solid creative output', category: 'ideaGeneration',
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
  ...CONTENT_GENERATION_MODELS,
  ...ANALYSIS_AUDIT_MODELS,
  ...IDEA_GENERATION_MODELS,
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
  contentGeneration: string;
  analysisAudit: string;
  ideaGeneration: string;
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
  contentGeneration: 'claude-sonnet-4',
  analysisAudit: 'claude-sonnet-4',
  ideaGeneration: 'claude-sonnet-4',
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

/** Format a model option as a display string for dropdowns */
export function formatModelOption(m: ModelOption): string {
  return `${m.label} (${m.vendor}) — ${m.costLabel}`;
}
