import { useState, useRef } from 'react';
import type { ModelOption, ModelCategory } from '../config/models';
import {
  TEXT_TO_IMAGE_MODELS, IMAGE_EDIT_MODELS, TEXT_TO_VIDEO_MODELS,
  IMAGE_TO_VIDEO_MODELS, BG_REMOVAL_MODELS, UPSCALE_MODELS,
  getModelPreferences,
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
}

export interface GenerationSettings {
  model: string;
  prompt?: string;
  imageUrl?: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: string;
  generateAudio?: boolean;
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

export default function MediaGenerationModal({
  isOpen, onClose, mode, projectId, onGenerate,
  defaultPrompt = '', defaultImageUrl = '', hidePrompt = false,
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

  if (!isOpen) return null;

  const needsImage = mode === 'imageEdit' || mode === 'imageToVideo' || mode === 'backgroundRemoval' || mode === 'imageUpscale';
  const needsPrompt = mode !== 'backgroundRemoval' && mode !== 'imageUpscale';
  const isVideo = mode === 'textToVideo' || mode === 'imageToVideo';

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
    onGenerate(settings);
    onClose();
  };

  const vendorBadge = (vendor: string) => {
    const colors: Record<string, string> = {
      Google: 'bg-blue-50 text-blue-700', OpenAI: 'bg-emerald-50 text-emerald-700',
      FLUX: 'bg-purple-50 text-purple-700', Kling: 'bg-cyan-50 text-cyan-700',
      LTX: 'bg-violet-50 text-violet-700', Recraft: 'bg-rose-50 text-rose-700',
      Bria: 'bg-teal-50 text-teal-700', Pixelcut: 'bg-indigo-50 text-indigo-700',
      SeedVR: 'bg-orange-50 text-orange-700',
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
        <div className="sticky top-0 bg-white border-b border-apple-divider px-5 py-3 flex items-center justify-between z-10">
          <h3 className="text-apple-base font-semibold text-apple-text">{config.title} Settings</h3>
          <button onClick={onClose} className="p-1 hover:bg-apple-fill-secondary rounded-apple transition-colors">
            <svg className="w-5 h-5 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Model Selector */}
          <div>
            <label className="block text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider mb-2">Model</label>
            <div className="space-y-1.5">
              {models.map((m) => (
                <label
                  key={m.id}
                  className={`flex items-center gap-3 p-2.5 rounded-apple border cursor-pointer transition-all ${
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
                    <p className="text-[11px] text-apple-text-tertiary mt-0.5">{m.description}</p>
                  </div>
                  <span className="text-[11px] font-mono text-apple-text-secondary whitespace-nowrap">{m.costLabel}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Image Upload (for edit/I2V/utility modes) */}
          {needsImage && (
            <div>
              <label className="block text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider mb-2">
                Source Image
              </label>
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
                  className="w-full h-24 border-2 border-dashed border-apple-divider rounded-apple flex flex-col items-center justify-center gap-1 hover:border-apple-blue hover:bg-blue-50/30 transition-all"
                >
                  <svg className="w-6 h-6 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                  <span className="text-apple-xs text-apple-text-tertiary">Upload image</span>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </div>
          )}

          {/* Prompt */}
          {needsPrompt && !hidePrompt && (
            <div>
              <label className="block text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider mb-2">
                {mode === 'imageEdit' ? 'Edit Instructions' : 'Prompt'}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={mode === 'imageEdit' ? 'Describe the changes you want...' : 'Describe what you want to generate...'}
                className="input w-full h-20 text-apple-sm resize-none"
              />
            </div>
          )}

          {/* Aspect Ratio */}
          {(mode === 'textToImage' || isVideo) && (
            <div>
              <label className="block text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider mb-2">Aspect Ratio</label>
              <div className="flex flex-wrap gap-1.5">
                {ASPECT_RATIOS.map((ar) => (
                  <button
                    key={ar}
                    onClick={() => setAspectRatio(ar)}
                    className={`px-3 py-1.5 text-apple-xs rounded-apple-pill border transition-all ${
                      aspectRatio === ar
                        ? 'border-apple-blue bg-blue-50 text-apple-blue font-medium'
                        : 'border-apple-divider text-apple-text-secondary hover:border-gray-300'
                    }`}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Video-specific options */}
          {isVideo && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider mb-2">Duration</label>
                  <div className="flex flex-wrap gap-1.5">
                    {DURATIONS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        className={`px-2.5 py-1 text-apple-xs rounded-apple-pill border transition-all ${
                          duration === d
                            ? 'border-apple-blue bg-blue-50 text-apple-blue font-medium'
                            : 'border-apple-divider text-apple-text-secondary hover:border-gray-300'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider mb-2">Resolution</label>
                  <div className="flex flex-wrap gap-1.5">
                    {RESOLUTIONS.map((r) => (
                      <button
                        key={r}
                        onClick={() => setResolution(r)}
                        className={`px-2.5 py-1 text-apple-xs rounded-apple-pill border transition-all ${
                          resolution === r
                            ? 'border-apple-blue bg-blue-50 text-apple-blue font-medium'
                            : 'border-apple-divider text-apple-text-secondary hover:border-gray-300'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generateAudio}
                  onChange={(e) => setGenerateAudio(e.target.checked)}
                  className="accent-apple-blue"
                />
                <span className="text-apple-sm text-apple-text">Generate audio</span>
              </label>
            </>
          )}
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
