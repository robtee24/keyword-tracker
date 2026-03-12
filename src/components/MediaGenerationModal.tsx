import { useState, useRef } from 'react';
import type { ModelOption, ModelCategory, GenerationContext } from '../config/models';
import {
  TEXT_TO_IMAGE_MODELS, IMAGE_EDIT_MODELS, TEXT_TO_VIDEO_MODELS,
  IMAGE_TO_VIDEO_MODELS, BG_REMOVAL_MODELS, UPSCALE_MODELS,
  getModelPreferences,
  IMAGE_CONTENT_TYPES, VIDEO_CONTENT_TYPES, STYLE_OPTIONS, MOOD_OPTIONS, CAMERA_MOTION_OPTIONS,
} from '../config/models';

type GenerationMode = 'textToImage' | 'imageEdit' | 'textToVideo' | 'imageToVideo' | 'backgroundRemoval' | 'imageUpscale';

interface MediaGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: GenerationMode;
  projectId: string;
  onGenerate: (settings: GenerationSettings) => void;
  defaultPrompt?: string;
  defaultImageUrl?: string;
  hidePrompt?: boolean;
  defaultContext?: Partial<GenerationContext>;
}

export interface GenerationSettings {
  model: string;
  prompt?: string;
  imageUrl?: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: string;
  generateAudio?: boolean;
  context?: GenerationContext;
}

const MODE_CONFIG: Record<GenerationMode, { title: string; getModels: () => ModelOption[]; prefKey: keyof ReturnType<typeof getModelPreferences> }> = {
  textToImage: { title: 'Image Generation', getModels: () => TEXT_TO_IMAGE_MODELS, prefKey: 'textToImage' },
  imageEdit: { title: 'Image Editing', getModels: () => IMAGE_EDIT_MODELS, prefKey: 'imageEdit' },
  textToVideo: { title: 'Video Generation', getModels: () => TEXT_TO_VIDEO_MODELS, prefKey: 'textToVideo' },
  imageToVideo: { title: 'Image to Video', getModels: () => IMAGE_TO_VIDEO_MODELS, prefKey: 'imageToVideo' },
  backgroundRemoval: { title: 'Background Removal', getModels: () => BG_REMOVAL_MODELS, prefKey: 'backgroundRemoval' },
  imageUpscale: { title: 'Image Upscale', getModels: () => UPSCALE_MODELS, prefKey: 'imageUpscale' },
};

const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4'];
const RESOLUTIONS = ['720p', '1080p', '4k'];
const DURATIONS = ['4s', '6s', '8s', '10s', '14s', '20s'];

function PillSelector({ options, value, onChange }: {
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 text-[11px] rounded-apple-pill border transition-all ${
            value === o.value
              ? 'border-apple-blue bg-blue-50 text-apple-blue font-medium'
              : 'border-apple-divider text-apple-text-secondary hover:border-gray-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ToggleSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
          checked ? 'bg-apple-blue' : 'bg-gray-200'
        }`}
      >
        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`} />
      </button>
      <span className="text-apple-xs text-apple-text">{label}</span>
    </label>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-semibold text-apple-text-tertiary uppercase tracking-wider mb-1.5">{children}</label>
  );
}

export default function MediaGenerationModal({
  isOpen, onClose, mode, projectId, onGenerate,
  defaultPrompt = '', defaultImageUrl = '', hidePrompt = false,
  defaultContext,
}: MediaGenerationModalProps) {
  const config = MODE_CONFIG[mode];
  const models = config.getModels();
  const prefs = getModelPreferences(projectId);
  const defaultModel = prefs[config.prefKey] || models[0]?.id || '';

  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [imageUrl, setImageUrl] = useState(defaultImageUrl);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resolution, setResolution] = useState('1080p');
  const [duration, setDuration] = useState('8s');
  const [generateAudio, setGenerateAudio] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isVideo = mode === 'textToVideo' || mode === 'imageToVideo';
  const isUtility = mode === 'backgroundRemoval' || mode === 'imageUpscale';
  const hasContextFields = !isUtility;

  const [contentType, setContentType] = useState(defaultContext?.contentType || (isVideo ? 'social_clip' : 'lifestyle'));
  const [subject, setSubject] = useState(defaultContext?.subject || '');
  const [style, setStyle] = useState(defaultContext?.style || 'photorealistic');
  const [mood, setMood] = useState(defaultContext?.mood || 'professional');
  const [colorHints, setColorHints] = useState(defaultContext?.colorHints || '');
  const [includesText, setIncludesText] = useState(defaultContext?.includesText ?? false);
  const [includesPeople, setIncludesPeople] = useState(defaultContext?.includesPeople ?? false);
  const [cameraMotion, setCameraMotion] = useState(defaultContext?.cameraMotion || 'tracking');
  const [hasDialogue, setHasDialogue] = useState(defaultContext?.hasDialogue ?? false);
  const [negativePrompt, setNegativePrompt] = useState(defaultContext?.negativePrompt || '');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);

  if (!isOpen) return null;

  const needsImage = mode === 'imageEdit' || mode === 'imageToVideo' || mode === 'backgroundRemoval' || mode === 'imageUpscale';
  const needsPrompt = mode !== 'backgroundRemoval' && mode !== 'imageUpscale';
  const contentTypeOptions = isVideo ? VIDEO_CONTENT_TYPES : IMAGE_CONTENT_TYPES;
  const selectedModelObj = models.find(m => m.id === selectedModel) || models[0];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleGenerate = () => {
    const settings: GenerationSettings = { model: selectedModel };
    if (needsPrompt && prompt) settings.prompt = prompt;
    if (needsImage && imageUrl) settings.imageUrl = imageUrl;
    if (isVideo) {
      settings.aspectRatio = aspectRatio;
      settings.resolution = resolution;
      settings.duration = duration;
      settings.generateAudio = generateAudio;
    } else if (mode === 'textToImage') {
      settings.aspectRatio = aspectRatio;
    }
    if (hasContextFields) {
      settings.context = {
        contentType,
        subject,
        style,
        mood,
        colorHints: colorHints || undefined,
        includesText,
        includesPeople,
        cameraMotion: isVideo ? cameraMotion : undefined,
        hasDialogue: isVideo ? hasDialogue : undefined,
        negativePrompt: negativePrompt || undefined,
        platform: defaultContext?.platform,
        purpose: defaultContext?.purpose,
      };
    }
    onGenerate(settings);
    onClose();
  };

  const vendorBadge = (vendor: string) => {
    const colors: Record<string, string> = {
      Google: 'bg-blue-50 text-blue-700', OpenAI: 'bg-emerald-50 text-emerald-700',
      FLUX: 'bg-purple-50 text-purple-700', Kling: 'bg-cyan-50 text-cyan-700',
      LTX: 'bg-violet-50 text-violet-700', Recraft: 'bg-rose-50 text-rose-700',
      Bria: 'bg-teal-50 text-teal-700', Pixelcut: 'bg-indigo-50 text-indigo-700',
      SeedVR: 'bg-orange-50 text-orange-700', ByteDance: 'bg-sky-50 text-sky-700',
      Qwen: 'bg-amber-50 text-amber-700', ImagineArt: 'bg-fuchsia-50 text-fuchsia-700',
      Reve: 'bg-lime-50 text-lime-700', Topaz: 'bg-yellow-50 text-yellow-700',
      Wan: 'bg-pink-50 text-pink-700',
    };
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded-apple-pill font-medium ${colors[vendor] || 'bg-gray-100 text-gray-600'}`}>
        {vendor}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-apple-lg shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-apple-divider px-5 py-3 flex items-center justify-between z-10">
          <h3 className="text-apple-base font-semibold text-apple-text">{config.title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-apple-fill-secondary rounded-apple transition-colors">
            <svg className="w-5 h-5 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Image Upload (for edit/I2V/utility modes) */}
          {needsImage && (
            <div>
              <SectionLabel>Source Image</SectionLabel>
              {imageUrl ? (
                <div className="relative">
                  <img src={imageUrl} alt="Source" className="w-full h-32 object-cover rounded-apple border border-apple-divider" />
                  <button
                    onClick={() => { setImageUrl(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="absolute top-1 right-1 p-1 bg-white/90 rounded-full shadow"
                  >
                    <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-20 border-2 border-dashed border-apple-divider rounded-apple flex flex-col items-center justify-center gap-1 hover:border-apple-blue hover:bg-blue-50/30 transition-all"
                >
                  <svg className="w-5 h-5 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                  <span className="text-[11px] text-apple-text-tertiary">Upload image</span>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </div>
          )}

          {/* Prompt */}
          {needsPrompt && !hidePrompt && (
            <div>
              <SectionLabel>{mode === 'imageEdit' ? 'Edit Instructions' : 'Prompt'}</SectionLabel>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={mode === 'imageEdit' ? 'Describe the changes you want...' : 'Describe what you want to generate...'}
                className="input w-full h-16 text-apple-sm resize-none"
              />
            </div>
          )}

          {/* Context Fields (not for utility modes) */}
          {hasContextFields && (
            <>
              {/* Subject */}
              <div>
                <SectionLabel>Subject / Focus</SectionLabel>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Main subject of the visual (e.g., coffee cup on marble, person using laptop)"
                  className="input w-full text-apple-sm"
                />
              </div>

              {/* Content Type */}
              <div>
                <SectionLabel>Content Type</SectionLabel>
                <PillSelector options={contentTypeOptions} value={contentType} onChange={setContentType} />
              </div>

              {/* Visual Style */}
              <div>
                <SectionLabel>Visual Style</SectionLabel>
                <PillSelector options={STYLE_OPTIONS} value={style} onChange={setStyle} />
              </div>

              {/* Mood / Tone */}
              <div>
                <SectionLabel>Mood / Tone</SectionLabel>
                <PillSelector options={MOOD_OPTIONS} value={mood} onChange={setMood} />
              </div>

              {/* People & Text Toggles */}
              <div className="flex items-center gap-6">
                <ToggleSwitch label="Includes people" checked={includesPeople} onChange={setIncludesPeople} />
                <ToggleSwitch label="Text overlay needed" checked={includesText} onChange={setIncludesText} />
              </div>

              {/* Camera Motion (video only) */}
              {isVideo && (
                <div>
                  <SectionLabel>Camera Motion</SectionLabel>
                  <PillSelector options={CAMERA_MOTION_OPTIONS} value={cameraMotion} onChange={setCameraMotion} />
                </div>
              )}

              {/* Dialogue toggle (video only) */}
              {isVideo && (
                <div className="flex items-center gap-6">
                  <ToggleSwitch label="Has dialogue / voiceover" checked={hasDialogue} onChange={setHasDialogue} />
                </div>
              )}
            </>
          )}

          {/* Technical Settings */}
          {(mode === 'textToImage' || isVideo) && (
            <div>
              <SectionLabel>Aspect Ratio</SectionLabel>
              <PillSelector
                options={ASPECT_RATIOS.map(ar => ({ value: ar, label: ar }))}
                value={aspectRatio}
                onChange={setAspectRatio}
              />
            </div>
          )}

          {isVideo && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <SectionLabel>Duration</SectionLabel>
                <PillSelector
                  options={DURATIONS.map(d => ({ value: d, label: d }))}
                  value={duration}
                  onChange={setDuration}
                />
              </div>
              <div>
                <SectionLabel>Resolution</SectionLabel>
                <PillSelector
                  options={RESOLUTIONS.map(r => ({ value: r, label: r }))}
                  value={resolution}
                  onChange={setResolution}
                />
              </div>
            </div>
          )}

          {isVideo && (
            <ToggleSwitch label="Generate audio" checked={generateAudio} onChange={setGenerateAudio} />
          )}

          {/* Advanced (collapsible) */}
          {hasContextFields && (
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-[11px] font-medium text-apple-text-secondary hover:text-apple-text transition-colors"
              >
                <svg className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
                Advanced
              </button>
              {showAdvanced && (
                <div className="mt-2 space-y-3">
                  <div>
                    <SectionLabel>Color Palette / Brand Colors</SectionLabel>
                    <input
                      type="text"
                      value={colorHints}
                      onChange={(e) => setColorHints(e.target.value)}
                      placeholder="e.g., navy blue and gold, warm earth tones, #FF6B35"
                      className="input w-full text-apple-sm"
                    />
                  </div>
                  <div>
                    <SectionLabel>Negative Prompt (things to avoid)</SectionLabel>
                    <input
                      type="text"
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      placeholder="e.g., blurry, low quality, text, watermark"
                      className="input w-full text-apple-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Model Selector (collapsible) */}
          <div className="border-t border-apple-divider pt-3">
            <button
              type="button"
              onClick={() => setShowModelSelector(!showModelSelector)}
              className="w-full flex items-center justify-between text-[11px] font-medium text-apple-text-secondary hover:text-apple-text transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <svg className={`w-3.5 h-3.5 transition-transform ${showModelSelector ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
                Model
              </span>
              {selectedModelObj && (
                <span className="flex items-center gap-1.5">
                  <span className="text-apple-text font-medium">{selectedModelObj.label}</span>
                  {vendorBadge(selectedModelObj.vendor)}
                  <span className="font-mono text-apple-text-tertiary">{selectedModelObj.costLabel}</span>
                </span>
              )}
            </button>
            {showModelSelector && (
              <div className="mt-2 space-y-1.5">
                {models.map((m) => (
                  <label
                    key={m.id}
                    className={`flex items-center gap-3 p-2 rounded-apple border cursor-pointer transition-all ${
                      selectedModel === m.id
                        ? 'border-apple-blue bg-blue-50/50 ring-1 ring-apple-blue/20'
                        : 'border-apple-divider hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="model"
                      value={m.id}
                      checked={selectedModel === m.id}
                      onChange={() => setSelectedModel(m.id)}
                      className="accent-apple-blue"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-apple-sm font-medium text-apple-text">{m.label}</span>
                        {vendorBadge(m.vendor)}
                      </div>
                      <p className="text-[10px] text-apple-text-tertiary mt-0.5 line-clamp-1">{m.description}</p>
                    </div>
                    <span className="text-[10px] font-mono text-apple-text-secondary whitespace-nowrap">{m.costLabel}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-apple-divider px-5 py-3 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-apple-sm text-apple-text-secondary hover:text-apple-text transition-colors">
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={needsImage && !imageUrl}
            className="btn-primary text-apple-sm disabled:opacity-50"
          >
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Small settings gear icon button to embed in generation buttons.
 */
export function GenerationSettingsIcon({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      className="ml-2 p-1 rounded-apple hover:bg-white/20 transition-colors"
      title="Generation settings"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    </button>
  );
}
