export interface ModelOption {
  id: string;
  label: string;
  provider: 'openai' | 'google' | 'ltx';
  cost: string;
  description: string;
}

export const IMAGE_MODELS: ModelOption[] = [
  { id: 'dall-e-3', label: 'DALL-E 3', provider: 'openai', cost: '$0.08/image', description: 'OpenAI — high quality, creative' },
  { id: 'imagen-3.0-generate-002', label: 'Imagen 3', provider: 'google', cost: '$0.03/image', description: 'Google — good quality, better text rendering' },
  { id: 'imagen-4.0-fast-generate-001', label: 'Imagen 4 Fast', provider: 'google', cost: '$0.02/image', description: 'Google — fast generation, great value' },
  { id: 'imagen-4.0-generate-001', label: 'Imagen 4', provider: 'google', cost: '$0.04/image', description: 'Google — flagship quality, best text rendering' },
  { id: 'imagen-4.0-ultra-generate-001', label: 'Imagen 4 Ultra', provider: 'google', cost: '$0.06/image', description: 'Google — highest precision, up to 2K resolution' },
];

export const VIDEO_MODELS: ModelOption[] = [
  { id: 'veo-3.1-generate-preview', label: 'Veo 3.1 Preview', provider: 'google', cost: 'Preview pricing', description: 'Google — text-to-video for video ads' },
  { id: 'ltx-2-fast', label: 'LTX 2 Fast', provider: 'ltx', cost: 'Per-video pricing', description: 'LTX — fast text-to-video for social posts' },
];

const SETTINGS_KEY_PREFIX = 'kt_model_prefs_';

export interface ModelPreferences {
  imageModel: string;
  videoModel: string;
}

const DEFAULTS: ModelPreferences = {
  imageModel: 'imagen-4.0-generate-001',
  videoModel: 'veo-3.1-generate-preview',
};

export function getModelPreferences(projectId: string): ModelPreferences {
  try {
    const raw = localStorage.getItem(`${SETTINGS_KEY_PREFIX}${projectId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export function setModelPreferences(projectId: string, prefs: Partial<ModelPreferences>): void {
  const current = getModelPreferences(projectId);
  const updated = { ...current, ...prefs };
  localStorage.setItem(`${SETTINGS_KEY_PREFIX}${projectId}`, JSON.stringify(updated));
}
