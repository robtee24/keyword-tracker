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
    description: 'Cheapest high-quality option with fast generation times.', category: 'textToImage',
  },
  {
    id: 'imagen-4.0-generate-001', label: 'Imagen 4', vendor: 'Google', provider: 'google',
    cost: 0.04, userCost: markup(0.04), costLabel: costLabel(0.04, 'image'),
    description: 'Best-in-class text rendering and prompt adherence from Google.', category: 'textToImage',
  },
  {
    id: 'imagen-4.0-ultra-generate-001', label: 'Imagen 4 Ultra', vendor: 'Google', provider: 'google',
    cost: 0.06, userCost: markup(0.06), costLabel: costLabel(0.06, 'image'),
    description: 'Highest resolution (2K) with maximum photographic detail.', category: 'textToImage',
  },
  {
    id: 'nano-banana-pro', label: 'Nano Banana Pro', vendor: 'Google', provider: 'google',
    cost: 0.067, userCost: markup(0.067), costLabel: costLabel(0.067, 'image'),
    description: 'Gemini-native model excelling at typography and creative compositions.', category: 'textToImage',
  },
  {
    id: 'fal-nano-banana-2', label: 'Nano Banana 2', vendor: 'Google', provider: 'fal',
    falModelId: 'fal-ai/nano-banana-2', cost: 0.08, userCost: markup(0.08), costLabel: costLabel(0.08, 'image'),
    description: 'Latest generation Gemini image model — 2-3x faster than Nano Banana Pro.', category: 'textToImage',
  },
  {
    id: 'dall-e-3', label: 'DALL-E 3', vendor: 'OpenAI', provider: 'openai',
    cost: 0.08, userCost: markup(0.08), costLabel: costLabel(0.08, 'image'),
    description: 'Strong creative interpretation with built-in prompt rewriting.', category: 'textToImage',
  },
  {
    id: 'fal-flux-schnell', label: 'FLUX.1 Schnell', vendor: 'FLUX', provider: 'fal',
    falModelId: 'fal-ai/flux/schnell', cost: 0.003, userCost: markup(0.003), costLabel: costLabel(0.003, 'MP'),
    description: 'Fastest image generation (1-4 steps) at the lowest cost.', category: 'textToImage',
  },
  {
    id: 'fal-flux-dev', label: 'FLUX.1 Dev', vendor: 'FLUX', provider: 'fal',
    falModelId: 'fal-ai/flux/dev', cost: 0.025, userCost: markup(0.025), costLabel: costLabel(0.025, 'image'),
    description: 'Strong base model with custom LoRA support for brand-specific styles.', category: 'textToImage',
  },
  {
    id: 'fal-flux-2-pro', label: 'FLUX 2 Pro', vendor: 'FLUX', provider: 'fal',
    falModelId: 'fal-ai/flux-2-pro', cost: 0.03, userCost: markup(0.03), costLabel: costLabel(0.03, 'MP'),
    description: 'Flagship FLUX model with maximum photorealism and artistic fidelity.', category: 'textToImage',
  },
  {
    id: 'fal-recraft-v3', label: 'Recraft V3', vendor: 'Recraft', provider: 'fal',
    falModelId: 'fal-ai/recraft/v3/text-to-image', cost: 0.04, userCost: markup(0.04), costLabel: costLabel(0.04, 'image'),
    description: 'Specialized in vector art, icons, and brand-consistent design styles.', category: 'textToImage',
  },
  {
    id: 'fal-recraft-v4-pro', label: 'Recraft V4 Pro', vendor: 'Recraft', provider: 'fal',
    falModelId: 'fal-ai/recraft/v4/pro/text-to-image', cost: 0.25, userCost: markup(0.25), costLabel: costLabel(0.25, 'image'),
    description: 'Premium designer-grade model for production-ready brand visuals and SVGs.', category: 'textToImage',
  },
  {
    id: 'fal-seedream-4.5', label: 'Seedream 4.5', vendor: 'ByteDance', provider: 'fal',
    falModelId: 'fal-ai/bytedance/seedream/v4.5', cost: 0.03, userCost: markup(0.03), costLabel: costLabel(0.03, 'image'),
    description: 'ByteDance\'s unified model with strong composition and lighting at low cost.', category: 'textToImage',
  },
  {
    id: 'fal-qwen-image-2', label: 'Qwen Image 2.0', vendor: 'Qwen', provider: 'fal',
    falModelId: 'fal-ai/qwen-image-2/text-to-image', cost: 0.02, userCost: markup(0.02), costLabel: costLabel(0.02, 'MP'),
    description: 'Alibaba\'s model with exceptional text rendering and precise editing.', category: 'textToImage',
  },
  {
    id: 'fal-imagineart-1.5', label: 'ImagineArt 1.5', vendor: 'ImagineArt', provider: 'fal',
    falModelId: 'fal-ai/imagineart/imagineart-1.5-preview/text-to-image', cost: 0.04, userCost: markup(0.04), costLabel: costLabel(0.04, 'image'),
    description: 'Lifelike realism with legible text output and strong aesthetics.', category: 'textToImage',
  },
];

// --------------- IMAGE EDIT ---------------
export const IMAGE_EDIT_MODELS: ModelOption[] = [
  {
    id: 'nano-banana-pro-edit', label: 'Nano Banana Pro Edit', vendor: 'Google', provider: 'google',
    cost: 0.067, userCost: markup(0.067), costLabel: costLabel(0.067, 'edit'),
    description: 'Natural language editing powered by Gemini\'s multimodal understanding.', category: 'imageEdit',
  },
  {
    id: 'fal-nano-banana-2-edit', label: 'Nano Banana 2 Edit', vendor: 'Google', provider: 'fal',
    falModelId: 'fal-ai/nano-banana-2/edit', cost: 0.08, userCost: markup(0.08), costLabel: costLabel(0.08, 'edit'),
    description: 'Latest generation Gemini editing — faster and more accurate than Pro.', category: 'imageEdit',
  },
  {
    id: 'fal-flux-kontext', label: 'FLUX Kontext Pro', vendor: 'FLUX', provider: 'fal',
    falModelId: 'fal-ai/flux-pro/kontext', cost: 0.04, userCost: markup(0.04), costLabel: costLabel(0.04, 'edit'),
    description: 'Best for targeted local edits and complex scene transformations.', category: 'imageEdit',
  },
  {
    id: 'fal-flux-2-pro-edit', label: 'FLUX 2 Pro Edit', vendor: 'FLUX', provider: 'fal',
    falModelId: 'fal-ai/flux-2-pro/edit', cost: 0.03, userCost: markup(0.03), costLabel: costLabel(0.03, 'MP'),
    description: 'Multi-reference editing with maximum quality and style consistency.', category: 'imageEdit',
  },
  {
    id: 'fal-gpt-image-1.5-edit', label: 'GPT Image 1.5', vendor: 'OpenAI', provider: 'fal',
    falModelId: 'fal-ai/gpt-image-1.5/edit', cost: 0.133, userCost: markup(0.133), costLabel: costLabel(0.133, 'edit'),
    description: 'OpenAI\'s editor with strong prompt adherence and fine-grained detail.', category: 'imageEdit',
  },
  {
    id: 'fal-reve-edit', label: 'Reve Edit', vendor: 'Reve', provider: 'fal',
    falModelId: 'fal-ai/reve/edit', cost: 0.04, userCost: markup(0.04), costLabel: costLabel(0.04, 'edit'),
    description: 'Context-aware transformations with batch variation support (1-4 edits).', category: 'imageEdit',
  },
  {
    id: 'fal-seedream-4.5-edit', label: 'Seedream 4.5 Edit', vendor: 'ByteDance', provider: 'fal',
    falModelId: 'fal-ai/bytedance/seedream/v4.5/edit', cost: 0.04, userCost: markup(0.04), costLabel: costLabel(0.04, 'edit'),
    description: 'Unified generation-editing model that handles style changes and composition.', category: 'imageEdit',
  },
  {
    id: 'fal-qwen-image-2-edit', label: 'Qwen Image 2.0 Edit', vendor: 'Qwen', provider: 'fal',
    falModelId: 'fal-ai/qwen-image-2/edit', cost: 0.02, userCost: markup(0.02), costLabel: costLabel(0.02, 'MP'),
    description: 'Cheapest edit option with precise control and text-aware modifications.', category: 'imageEdit',
  },
];

// --------------- TEXT TO VIDEO ---------------
export const TEXT_TO_VIDEO_MODELS: ModelOption[] = [
  {
    id: 'veo-3.1-generate-preview', label: 'Veo 3.1', vendor: 'Google', provider: 'google',
    cost: 0.40, userCost: markup(0.40), costLabel: costLabel(0.40, 'sec'),
    description: 'Top-tier quality with native audio and sound effects built in.', category: 'textToVideo',
    routes: [
      { provider: 'google', modelId: 'veo-3.1-generate-preview', label: 'Direct' },
      { provider: 'fal', modelId: 'fal-veo-3.1', falModelId: 'fal-ai/veo3.1', label: 'fal.ai' },
    ],
  },
  {
    id: 'veo-3.1-fast', label: 'Veo 3.1 Fast', vendor: 'Google', provider: 'google',
    cost: 0.15, userCost: markup(0.15), costLabel: costLabel(0.15, 'sec'),
    description: 'Faster Veo variant — same audio capabilities at 60% lower cost.', category: 'textToVideo',
    routes: [
      { provider: 'google', modelId: 'veo-3.1-fast', label: 'Direct' },
      { provider: 'fal', modelId: 'fal-veo-3.1-fast', falModelId: 'fal-ai/veo3.1/fast', label: 'fal.ai' },
    ],
  },
  {
    id: 'fal-sora-2', label: 'Sora 2', vendor: 'OpenAI', provider: 'fal',
    falModelId: 'fal-ai/sora-2/text-to-video', cost: 0.30, userCost: markup(0.30), costLabel: costLabel(0.30, 'sec'),
    description: 'OpenAI\'s flagship video model with rich detail and audio generation.', category: 'textToVideo',
  },
  {
    id: 'fal-sora-2-pro', label: 'Sora 2 Pro', vendor: 'OpenAI', provider: 'fal',
    falModelId: 'fal-ai/sora-2/text-to-video/pro', cost: 0.50, userCost: markup(0.50), costLabel: costLabel(0.50, 'sec'),
    description: 'Premium Sora with maximum visual fidelity and cinematic quality.', category: 'textToVideo',
  },
  {
    id: 'fal-kling-3-pro', label: 'Kling 3.0 Pro', vendor: 'Kling', provider: 'fal',
    falModelId: 'fal-ai/kling-video/v3/pro/text-to-video', cost: 0.112, userCost: markup(0.112), costLabel: costLabel(0.112, 'sec'),
    description: 'Exceptional motion fluidity with native audio and multi-shot support.', category: 'textToVideo',
  },
  {
    id: 'fal-kling-2.5-turbo', label: 'Kling 2.5 Turbo Pro', vendor: 'Kling', provider: 'fal',
    falModelId: 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video', cost: 0.07, userCost: markup(0.07), costLabel: costLabel(0.07, 'sec'),
    description: 'Fast turbo generation with cinematic quality at lower cost than 3.0.', category: 'textToVideo',
  },
  {
    id: 'fal-ltx-2.3-fast', label: 'LTX 2.3 Fast', vendor: 'LTX', provider: 'fal',
    falModelId: 'fal-ai/ltx-2.3/text-to-video/fast', cost: 0.04, userCost: markup(0.04), costLabel: costLabel(0.04, 'sec'),
    description: 'Best value — fast generation with audio at the lowest per-second cost.', category: 'textToVideo',
  },
  {
    id: 'fal-ltx-2.3-pro', label: 'LTX 2.3 Pro', vendor: 'LTX', provider: 'fal',
    falModelId: 'fal-ai/ltx-2.3/text-to-video', cost: 0.06, userCost: markup(0.06), costLabel: costLabel(0.06, 'sec'),
    description: 'Higher quality LTX variant with better detail at moderate cost.', category: 'textToVideo',
  },
];

// --------------- IMAGE TO VIDEO ---------------
export const IMAGE_TO_VIDEO_MODELS: ModelOption[] = [
  {
    id: 'fal-veo-3.1-i2v', label: 'Veo 3.1 I2V', vendor: 'Google', provider: 'fal',
    falModelId: 'fal-ai/veo3.1/image-to-video', cost: 0.40, userCost: markup(0.40), costLabel: costLabel(0.40, 'sec'),
    description: 'Highest quality image animation with native audio and sound effects.', category: 'imageToVideo',
  },
  {
    id: 'fal-veo-3.1-fast-i2v', label: 'Veo 3.1 Fast I2V', vendor: 'Google', provider: 'fal',
    falModelId: 'fal-ai/veo3.1/fast/image-to-video', cost: 0.15, userCost: markup(0.15), costLabel: costLabel(0.15, 'sec'),
    description: 'Faster Veo image animation at 60% lower cost with audio.', category: 'imageToVideo',
  },
  {
    id: 'fal-sora-2-i2v', label: 'Sora 2 I2V', vendor: 'OpenAI', provider: 'fal',
    falModelId: 'fal-ai/sora-2/image-to-video', cost: 0.30, userCost: markup(0.30), costLabel: costLabel(0.30, 'sec'),
    description: 'OpenAI\'s image-to-video with rich detail and audio generation.', category: 'imageToVideo',
  },
  {
    id: 'fal-sora-2-pro-i2v', label: 'Sora 2 Pro I2V', vendor: 'OpenAI', provider: 'fal',
    falModelId: 'fal-ai/sora-2/image-to-video/pro', cost: 0.50, userCost: markup(0.50), costLabel: costLabel(0.50, 'sec'),
    description: 'Premium Sora image animation with maximum cinematic fidelity.', category: 'imageToVideo',
  },
  {
    id: 'fal-kling-3-pro-i2v', label: 'Kling 3.0 Pro I2V', vendor: 'Kling', provider: 'fal',
    falModelId: 'fal-ai/kling-video/v3/pro/image-to-video', cost: 0.112, userCost: markup(0.112), costLabel: costLabel(0.112, 'sec'),
    description: 'Cinematic image-to-video with custom element and audio support.', category: 'imageToVideo',
  },
  {
    id: 'fal-kling-o3-i2v', label: 'Kling O3 I2V', vendor: 'Kling', provider: 'fal',
    falModelId: 'fal-ai/kling-video/o3/standard/image-to-video', cost: 0.07, userCost: markup(0.07), costLabel: costLabel(0.07, 'sec'),
    description: 'Animates between start and end frames with text-driven scene guidance.', category: 'imageToVideo',
  },
  {
    id: 'fal-kling-2.5-i2v', label: 'Kling 2.5 Turbo I2V', vendor: 'Kling', provider: 'fal',
    falModelId: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video', cost: 0.07, userCost: markup(0.07), costLabel: costLabel(0.07, 'sec'),
    description: 'Fast turbo image animation at a budget-friendly price point.', category: 'imageToVideo',
  },
  {
    id: 'fal-ltx-2.3-i2v', label: 'LTX 2.3 I2V', vendor: 'LTX', provider: 'fal',
    falModelId: 'fal-ai/ltx-2.3/image-to-video', cost: 0.04, userCost: markup(0.04), costLabel: costLabel(0.04, 'sec'),
    description: 'Cheapest image animation option with audio at $0.04/sec.', category: 'imageToVideo',
  },
  {
    id: 'fal-wan-2.2-i2v', label: 'Wan 2.2 I2V', vendor: 'Wan', provider: 'fal',
    falModelId: 'fal-ai/wan/v2.2-a14b/image-to-video', cost: 0.05, userCost: markup(0.05), costLabel: costLabel(0.05, 'sec'),
    description: 'Open-source model with high motion diversity and LoRA fine-tuning.', category: 'imageToVideo',
  },
];

// --------------- BACKGROUND REMOVAL ---------------
export const BG_REMOVAL_MODELS: ModelOption[] = [
  {
    id: 'fal-bria-bg-remove', label: 'Bria RMBG 2.0', vendor: 'Bria', provider: 'fal',
    falModelId: 'fal-ai/bria/background/remove', cost: 0.01, userCost: markup(0.01), costLabel: costLabel(0.01, 'image'),
    description: 'Commercial-safe model trained on licensed data for clean cutouts.', category: 'backgroundRemoval',
  },
  {
    id: 'fal-pixelcut-bg', label: 'Pixelcut BG Removal', vendor: 'Pixelcut', provider: 'fal',
    falModelId: 'fal-ai/pixelcut/background-removal', cost: 0.01, userCost: markup(0.01), costLabel: costLabel(0.01, 'image'),
    description: 'Ultra-fast removal optimized for e-commerce product photos.', category: 'backgroundRemoval',
  },
];

// --------------- IMAGE UPSCALE ---------------
export const UPSCALE_MODELS: ModelOption[] = [
  {
    id: 'fal-seedvr-upscale', label: 'SeedVR Upscale', vendor: 'SeedVR', provider: 'fal',
    falModelId: 'fal-ai/seedvr/upscale/image', cost: 0.02, userCost: markup(0.02), costLabel: costLabel(0.02, 'image'),
    description: 'AI upscaling with detail enhancement at the lowest cost.', category: 'imageUpscale',
  },
  {
    id: 'fal-topaz-upscale', label: 'Topaz Upscale', vendor: 'Topaz', provider: 'fal',
    falModelId: 'fal-ai/topaz/upscale/image', cost: 0.08, userCost: markup(0.08), costLabel: costLabel(0.08, 'image'),
    description: 'Industry-standard upscaler with the sharpest output up to 512MP.', category: 'imageUpscale',
  },
];

// --------------- LLM: CONTENT GENERATION ---------------
export const CONTENT_GENERATION_MODELS: ModelOption[] = [
  {
    id: 'claude-sonnet-4', label: 'Claude Sonnet 4', vendor: 'Anthropic', provider: 'anthropic',
    cost: 0.135, userCost: markup(0.135), costLabel: estCostLabel(0.135),
    description: 'Best overall writing quality with nuanced tone and structure.', category: 'contentGeneration',
  },
  {
    id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', vendor: 'Anthropic', provider: 'anthropic',
    cost: 0.036, userCost: markup(0.036), costLabel: estCostLabel(0.036),
    description: 'Near-Sonnet quality at 75% lower cost — best value for volume.', category: 'contentGeneration',
  },
  {
    id: 'gpt-4o', label: 'GPT-4o', vendor: 'OpenAI', provider: 'openai',
    cost: 0.093, userCost: markup(0.093), costLabel: estCostLabel(0.093),
    description: 'Strong at structured content and data-driven writing.', category: 'contentGeneration',
  },
  {
    id: 'gpt-4o-mini', label: 'GPT-4o Mini', vendor: 'OpenAI', provider: 'openai',
    cost: 0.006, userCost: markup(0.006), costLabel: estCostLabel(0.006),
    description: 'Extremely cheap and fast — good for simple copy and short-form.', category: 'contentGeneration',
  },
  {
    id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', vendor: 'Google', provider: 'google',
    cost: 0.086, userCost: markup(0.086), costLabel: estCostLabel(0.086),
    description: 'Large context window with strong reasoning for long-form content.', category: 'contentGeneration',
  },
  {
    id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', vendor: 'Google', provider: 'google',
    cost: 0.006, userCost: markup(0.006), costLabel: estCostLabel(0.006),
    description: 'Ultra cheap with large context — best for budget-conscious bulk writing.', category: 'contentGeneration',
  },
];

// --------------- LLM: ANALYSIS & AUDITS ---------------
export const ANALYSIS_AUDIT_MODELS: ModelOption[] = [
  {
    id: 'claude-sonnet-4', label: 'Claude Sonnet 4', vendor: 'Anthropic', provider: 'anthropic',
    cost: 0.057, userCost: markup(0.057), costLabel: estCostLabel(0.057),
    description: 'Most thorough and nuanced analysis with structured output.', category: 'analysisAudit',
  },
  {
    id: 'gpt-4o', label: 'GPT-4o', vendor: 'OpenAI', provider: 'openai',
    cost: 0.04, userCost: markup(0.04), costLabel: estCostLabel(0.04),
    description: 'Strong analytical capabilities with reliable formatting.', category: 'analysisAudit',
  },
  {
    id: 'gpt-4o-mini', label: 'GPT-4o Mini', vendor: 'OpenAI', provider: 'openai',
    cost: 0.002, userCost: markup(0.002), costLabel: estCostLabel(0.002),
    description: 'Best for high-volume bulk analysis where cost matters most.', category: 'analysisAudit',
  },
  {
    id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', vendor: 'Google', provider: 'google',
    cost: 0.002, userCost: markup(0.002), costLabel: estCostLabel(0.002),
    description: 'Comparable to GPT-4o Mini at similar cost with larger context.', category: 'analysisAudit',
  },
];

// --------------- LLM: IDEA GENERATION ---------------
export const IDEA_GENERATION_MODELS: ModelOption[] = [
  {
    id: 'claude-sonnet-4', label: 'Claude Sonnet 4', vendor: 'Anthropic', provider: 'anthropic',
    cost: 0.051, userCost: markup(0.051), costLabel: estCostLabel(0.051),
    description: 'Most creative and contextually relevant idea generation.', category: 'ideaGeneration',
  },
  {
    id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', vendor: 'Anthropic', provider: 'anthropic',
    cost: 0.014, userCost: markup(0.014), costLabel: estCostLabel(0.014),
    description: 'Fast creative output at a fraction of Sonnet\'s cost.', category: 'ideaGeneration',
  },
  {
    id: 'gpt-4o', label: 'GPT-4o', vendor: 'OpenAI', provider: 'openai',
    cost: 0.035, userCost: markup(0.035), costLabel: estCostLabel(0.035),
    description: 'Diverse idea generation with strong real-world knowledge.', category: 'ideaGeneration',
  },
  {
    id: 'gpt-4o-mini', label: 'GPT-4o Mini', vendor: 'OpenAI', provider: 'openai',
    cost: 0.002, userCost: markup(0.002), costLabel: estCostLabel(0.002),
    description: 'Cheapest option for quick brainstorming and bulk ideation.', category: 'ideaGeneration',
  },
  {
    id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', vendor: 'Google', provider: 'google',
    cost: 0.002, userCost: markup(0.002), costLabel: estCostLabel(0.002),
    description: 'Budget-friendly with large context for research-heavy ideation.', category: 'ideaGeneration',
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

export function formatModelOption(m: ModelOption): string {
  return `${m.label} (${m.vendor}) — ${m.costLabel}`;
}
