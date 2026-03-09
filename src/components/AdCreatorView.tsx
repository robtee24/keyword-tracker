import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { authenticatedFetch } from '../services/authService';
import { useBackgroundTasks } from '../contexts/BackgroundTaskContext';
import { parseJsonOrThrow } from '../utils/apiResponse';

type AdPlatform = 'meta' | 'tiktok' | 'linkedin' | 'x';
type CreativeType = 'static' | 'video';

interface PlatformField {
  key: string;
  label: string;
  charLimit: number;
  recommended: number;
  maxAllowed: number;
  purpose: string;
}

interface PlatformSpec {
  name: string;
  fields: PlatformField[];
  placements: string[];
  imageSpecs: Record<string, string>;
}

interface VideoScript {
  hook: string;
  problem: string;
  solution: string;
  cta: string;
  visualDirection: string;
  duration: string;
}

interface AdVariation {
  angle: string;
  texts: Record<string, string>;
  charCounts: Record<string, number>;
  script?: VideoScript;
  imageDescription?: string;
  textOverlay?: string | null;
}

interface GeneratedAd {
  variations: AdVariation[];
  platformTips: string[];
  platform: string;
  platformSpec: PlatformSpec;
}

interface AdCreatorViewProps {
  siteUrl: string;
  projectId: string;
  platform: AdPlatform;
}

const PLATFORM_LABELS: Record<AdPlatform, string> = {
  meta: 'Meta (Facebook / Instagram)',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  x: 'X (Twitter)',
};

const PLATFORM_COLORS: Record<AdPlatform, string> = {
  meta: 'from-blue-600 to-purple-600',
  tiktok: 'from-gray-900 to-pink-500',
  linkedin: 'from-blue-700 to-blue-500',
  x: 'from-gray-900 to-gray-700',
};

function CharCounter({ current, limit }: { current: number; limit: number }) {
  const pct = (current / limit) * 100;
  const color = pct > 100 ? 'text-red-600' : pct > 85 ? 'text-amber-600' : 'text-green-600';
  return (
    <span className={`text-[10px] font-mono ${color}`}>
      {current}/{limit}
    </span>
  );
}

function AdPreview({ variation, platform, spec, creativeType, generatedImageUrl }: {
  variation: AdVariation;
  platform: AdPlatform;
  spec: PlatformSpec;
  creativeType: CreativeType;
  generatedImageUrl?: string;
}) {
  if (platform === 'meta') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 max-w-[400px] shadow-sm">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
          <div>
            <p className="text-[11px] font-semibold text-gray-900">Your Brand</p>
            <p className="text-[10px] text-gray-400">Sponsored</p>
          </div>
        </div>
        <div className="px-3 py-2">
          <p className="text-[12px] text-gray-800 leading-relaxed whitespace-pre-wrap">
            {variation.texts.primaryText || ''}
          </p>
        </div>
        <div className={`aspect-square relative ${generatedImageUrl ? '' : `bg-gradient-to-br ${PLATFORM_COLORS[platform]}`} flex items-center justify-center overflow-hidden`}>
          {generatedImageUrl ? (
            <>
              <img src={generatedImageUrl} alt="Ad creative" className="w-full h-full object-cover" />
              {variation.textOverlay && (
                <div className="absolute inset-0 flex items-end justify-center p-6">
                  <div className="bg-black/50 backdrop-blur-sm rounded-lg px-4 py-3 text-center max-w-[85%]">
                    <p className="text-white text-sm font-bold leading-tight">{variation.textOverlay}</p>
                  </div>
                </div>
              )}
            </>
          ) : creativeType === 'video' ? (
            <div className="text-center text-white">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-80" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
              <p className="text-xs opacity-70">Video Preview</p>
            </div>
          ) : (
            <p className="text-white/70 text-xs text-center px-4">{variation.imageDescription?.substring(0, 80) || 'Static Creative'}...</p>
          )}
        </div>
        <div className="px-3 py-2 border-t border-gray-100">
          <p className="text-[13px] font-semibold text-gray-900">{variation.texts.headline || ''}</p>
          <p className="text-[11px] text-gray-500">{variation.texts.description || ''}</p>
        </div>
      </div>
    );
  }

  if (platform === 'tiktok') {
    return (
      <div className="bg-black rounded-2xl max-w-[260px] aspect-[9/16] relative overflow-hidden shadow-lg">
        {generatedImageUrl ? (
          <>
            <img src={generatedImageUrl} alt="Ad creative" className="absolute inset-0 w-full h-full object-cover" />
            {variation.textOverlay && (
              <div className="absolute inset-x-3 top-1/3 flex items-center justify-center">
                <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-center">
                  <p className="text-white text-xs font-bold leading-tight">{variation.textOverlay}</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-b ${PLATFORM_COLORS[platform]} opacity-60`} />
        )}
        {creativeType === 'video' && !generatedImageUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-16 h-16 text-white/50" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-12 p-3">
          <p className="text-white text-[11px] font-semibold mb-1">@{variation.texts.displayName || 'yourbrand'}</p>
          <p className="text-white text-[10px] leading-relaxed">{variation.texts.adText || ''}</p>
        </div>
        <div className="absolute bottom-0 right-0 w-10 flex flex-col items-center gap-3 pb-4">
          <div className="w-7 h-7 rounded-full bg-white/20" />
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        </div>
      </div>
    );
  }

  if (platform === 'linkedin') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 max-w-[400px] shadow-sm">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-400" />
          <div>
            <p className="text-[11px] font-semibold text-gray-900">Your Company</p>
            <p className="text-[10px] text-gray-400">Promoted</p>
          </div>
        </div>
        <div className="px-3 pb-2">
          <p className="text-[12px] text-gray-800 leading-relaxed whitespace-pre-wrap">
            {variation.texts.introText || ''}
          </p>
        </div>
        <div className={`aspect-[1.91/1] relative ${generatedImageUrl ? '' : 'bg-gradient-to-br from-blue-700 to-blue-400'} flex items-center justify-center overflow-hidden`}>
          {generatedImageUrl ? (
            <>
              <img src={generatedImageUrl} alt="Ad creative" className="w-full h-full object-cover" />
              {variation.textOverlay && (
                <div className="absolute inset-0 flex items-end justify-center p-4">
                  <div className="bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 text-center max-w-[85%]">
                    <p className="text-white text-xs font-bold leading-tight">{variation.textOverlay}</p>
                  </div>
                </div>
              )}
            </>
          ) : creativeType === 'video' ? (
            <svg className="w-12 h-12 text-white/50" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          ) : (
            <p className="text-white/70 text-xs text-center px-4">{variation.imageDescription?.substring(0, 60) || 'Creative'}...</p>
          )}
        </div>
        <div className="px-3 py-2 border-t border-gray-100">
          <p className="text-[13px] font-semibold text-gray-900">{variation.texts.headline || ''}</p>
          <p className="text-[11px] text-gray-500">{variation.texts.description || ''}</p>
        </div>
      </div>
    );
  }

  // X (Twitter)
  return (
    <div className="bg-white rounded-xl border border-gray-200 max-w-[400px] shadow-sm">
      <div className="flex items-start gap-2 p-3">
        <div className="w-9 h-9 rounded-full bg-gray-900 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-[12px] font-bold text-gray-900">Your Brand</p>
            <p className="text-[11px] text-gray-400">@yourbrand</p>
            <span className="text-[10px] text-gray-400 ml-auto">Ad</span>
          </div>
          <p className="text-[12px] text-gray-800 mt-1 leading-relaxed whitespace-pre-wrap">
            {variation.texts.tweetText || ''}
          </p>
          <div className="mt-2 rounded-xl border border-gray-200 overflow-hidden">
            <div className={`aspect-[1.91/1] relative ${generatedImageUrl ? '' : 'bg-gradient-to-br from-gray-800 to-gray-600'} flex items-center justify-center overflow-hidden`}>
              {generatedImageUrl ? (
                <>
                  <img src={generatedImageUrl} alt="Ad creative" className="w-full h-full object-cover" />
                  {variation.textOverlay && (
                    <div className="absolute inset-0 flex items-end justify-center p-3">
                      <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5 text-center max-w-[85%]">
                        <p className="text-white text-[11px] font-bold leading-tight">{variation.textOverlay}</p>
                      </div>
                    </div>
                  )}
                </>
              ) : creativeType === 'video' ? (
                <svg className="w-10 h-10 text-white/50" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              ) : (
                <p className="text-white/60 text-xs">{variation.imageDescription?.substring(0, 40) || 'Image'}...</p>
              )}
            </div>
            <div className="p-2 bg-gray-50">
              <p className="text-[12px] font-semibold text-gray-900 truncate">{variation.texts.headline || ''}</p>
              <p className="text-[10px] text-gray-500 line-clamp-2">{variation.texts.description || ''}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SavedCreative {
  id: string;
  platform: string;
  creative_type: string;
  objective: string;
  target_audience: string;
  result: GeneratedAd;
  generated_images: Record<number, string>;
  created_at: string;
}

export default function AdCreatorView({ siteUrl, projectId, platform }: AdCreatorViewProps) {
  const [objective, setObjective] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [valueProposition, setValueProposition] = useState('');
  const [landingPageUrl, setLandingPageUrl] = useState(siteUrl);
  const [additionalContext, setAdditionalContext] = useState('');
  const [creativeType, setCreativeType] = useState<CreativeType>('static');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedAd | null>(null);
  const [activeVariation, setActiveVariation] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});

  const [savedCreatives, setSavedCreatives] = useState<SavedCreative[]>([]);
  const [expandedSaved, setExpandedSaved] = useState<string | null>(null);
  const [activeCreativeId, setActiveCreativeId] = useState<string | null>(null);

  const { startTask, getTask, getTasksByType, clearTask } = useBackgroundTasks();
  const adTaskId = `ad-generate-${platform}-${projectId}`;
  const adTask = getTask(adTaskId);
  const generating = adTask?.status === 'running';
  const adImageTasks = getTasksByType(`ad-image-${platform}`);

  const loadSavedCreatives = useCallback(async () => {
    try {
      const resp = await authenticatedFetch(
        `${API_ENDPOINTS.db.adCreatives}?projectId=${projectId}&platform=${platform}`
      );
      const data = await parseJsonOrThrow<{ data: SavedCreative[] }>(resp);
      setSavedCreatives(data.data || []);
    } catch { /* silent */ }
  }, [projectId, platform]);

  useEffect(() => { loadSavedCreatives(); }, [loadSavedCreatives]);

  const saveCreative = async (adResult: GeneratedAd, images: Record<number, string>) => {
    try {
      const resp = await authenticatedFetch(API_ENDPOINTS.db.adCreatives, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId, siteUrl, platform,
          creativeType, objective, targetAudience, valueProposition,
          landingPageUrl, additionalContext,
          result: adResult, generatedImages: images,
        }),
      });
      const data = await parseJsonOrThrow<{ data: SavedCreative }>(resp);
      setSavedCreatives(prev => [data.data, ...prev]);
      setActiveCreativeId(data.data.id);
    } catch { /* non-critical */ }
  };

  useEffect(() => {
    if (adTask?.status === 'completed' && adTask.result) {
      const adResult = adTask.result as GeneratedAd;
      setResult(adResult);
      setActiveVariation(0);
      saveCreative(adResult, {});
      clearTask(adTaskId);
    } else if (adTask?.status === 'failed') {
      setError(adTask.error || 'Failed to generate ads');
      clearTask(adTaskId);
    }
  }, [adTask?.status]);

  useEffect(() => {
    for (const task of adImageTasks) {
      if (task.status === 'completed' && task.result) {
        const { variationIndex, imageUrl } = task.result as { variationIndex: number; imageUrl: string };
        setGeneratedImages((prev) => {
          const updated = { ...prev, [variationIndex]: imageUrl };
          if (activeCreativeId) {
            authenticatedFetch(API_ENDPOINTS.db.adCreatives, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: activeCreativeId, generatedImages: updated }),
            }).catch(() => {});
          }
          return updated;
        });
        clearTask(task.id);
      } else if (task.status === 'failed') {
        setError(task.error || 'Image generation failed');
        clearTask(task.id);
      }
    }
  }, [adImageTasks.map(t => t.status).join()]);

  const handleGenerate = () => {
    setError(null);
    setActiveCreativeId(null);
    startTask(adTaskId, 'ad-generate', `${platform} ad copy`, async () => {
      const objectives = localStorage.getItem(`kt_objectives_${projectId}`) || '';
      const resp = await authenticatedFetch(API_ENDPOINTS.advertising.generateAd, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, siteUrl, objective: objective || objectives, targetAudience, valueProposition, creativeType, landingPageUrl, additionalContext }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || `Server error (${resp.status})`);
      return data;
    });
  };

  const handleGenerateImage = (variationIndex: number) => {
    if (!result) return;
    const variation = result.variations[variationIndex];
    if (!variation?.imageDescription) return;
    const firstImageSpec = Object.values(result.platformSpec.imageSpecs)[0] || '1080x1080';
    startTask(`ad-image-${platform}-${variationIndex}`, `ad-image-${platform}`, `${platform} ad image #${variationIndex + 1}`, async () => {
      const resp = await authenticatedFetch(API_ENDPOINTS.advertising.generateImage, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDescription: variation.imageDescription, textOverlay: variation.textOverlay || null, platform, dimensions: firstImageSpec }),
      });
      const data = await resp.json();
      if (!data.imageUrl) throw new Error(data.error || 'Failed to generate image');
      return { variationIndex, imageUrl: data.imageUrl };
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const currentVariation = result?.variations?.[activeVariation];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold text-apple-text">{PLATFORM_LABELS[platform]} Ads</h1>
        <p className="text-apple-sm text-apple-text-secondary mt-1">
          Generate high-converting ad creative with AI-powered copy, scripts, and previews.
        </p>
      </div>

      {/* Setup Form */}
      {!result && (
        <div className="bg-white rounded-apple border border-apple-border p-6 space-y-5">
          <h2 className="text-lg font-semibold text-apple-text">Campaign Setup</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1 uppercase tracking-wider">
                Campaign Objective
              </label>
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className="input text-apple-sm w-full"
              >
                <option value="">Select objective...</option>
                <option value="Drive website traffic and clicks">Traffic & Clicks</option>
                <option value="Generate leads and sign-ups">Lead Generation</option>
                <option value="Drive sales and conversions">Sales & Conversions</option>
                <option value="Build brand awareness and reach">Brand Awareness</option>
                <option value="Promote app installs">App Installs</option>
                <option value="Retarget website visitors">Retargeting</option>
              </select>
            </div>
            <div>
              <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1 uppercase tracking-wider">
                Target Audience
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="input text-apple-sm w-full"
                placeholder="e.g., Small business owners, 25-45, US"
              />
            </div>
            <div>
              <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1 uppercase tracking-wider">
                Value Proposition
              </label>
              <input
                type="text"
                value={valueProposition}
                onChange={(e) => setValueProposition(e.target.value)}
                className="input text-apple-sm w-full"
                placeholder="What makes your offer compelling?"
              />
            </div>
            <div>
              <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1 uppercase tracking-wider">
                Landing Page URL
              </label>
              <input
                type="text"
                value={landingPageUrl}
                onChange={(e) => setLandingPageUrl(e.target.value)}
                className="input text-apple-sm w-full"
                placeholder={siteUrl}
              />
            </div>
          </div>

          <div>
            <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1 uppercase tracking-wider">
              Additional Context
            </label>
            <textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              className="input text-apple-sm w-full h-20 resize-none"
              placeholder="Any specific offers, promotions, or messaging guidelines..."
            />
          </div>

          {/* Creative Type */}
          <div>
            <label className="block text-apple-xs font-medium text-apple-text-secondary mb-2 uppercase tracking-wider">
              Creative Type
            </label>
            <div className="flex gap-3">
              {(['static', 'video'] as CreativeType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setCreativeType(type)}
                  className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-apple border-2 transition-all ${
                    creativeType === type
                      ? 'border-apple-blue bg-apple-blue/5'
                      : 'border-apple-border hover:border-gray-300'
                  }`}
                >
                  {type === 'static' ? (
                    <svg className="w-5 h-5 text-apple-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-apple-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                  <div className="text-left">
                    <p className="text-apple-sm font-medium text-apple-text capitalize">{type}</p>
                    <p className="text-apple-xs text-apple-text-tertiary">
                      {type === 'static' ? 'Image creative with text' : 'Video with script & shots'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full px-4 py-3 rounded-apple bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
          >
            {generating ? (
              <span className="flex items-center gap-2 justify-center">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating 3 Ad Variations...
              </span>
            ) : (
              `Generate ${PLATFORM_LABELS[platform]} Ads`
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-apple p-4">
          <p className="text-apple-sm text-red-800 font-medium">Generation failed</p>
          <p className="text-apple-xs text-red-600 mt-1">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-apple-text">Generated Variations</h2>
              <span className="text-apple-xs px-2 py-0.5 rounded-apple-pill bg-green-100 text-green-700">
                {result.variations.length} variations
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`px-3 py-1.5 rounded-apple-sm text-apple-xs font-medium transition-colors ${
                  showPreview
                    ? 'bg-apple-blue text-white'
                    : 'border border-apple-border text-apple-text-secondary hover:bg-apple-fill-secondary'
                }`}
              >
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </button>
              <button
                onClick={() => { setResult(null); setError(null); }}
                className="px-3 py-1.5 rounded-apple-sm border border-apple-border text-apple-xs font-medium text-apple-text-secondary hover:bg-apple-fill-secondary transition-colors"
              >
                New Campaign
              </button>
            </div>
          </div>

          {/* Variation Tabs */}
          <div className="flex gap-2 border-b border-apple-divider pb-0">
            {result.variations.map((v, i) => (
              <button
                key={i}
                onClick={() => setActiveVariation(i)}
                className={`px-4 py-2 text-apple-sm font-medium border-b-2 transition-colors ${
                  activeVariation === i
                    ? 'border-apple-blue text-apple-blue'
                    : 'border-transparent text-apple-text-secondary hover:text-apple-text'
                }`}
              >
                Variation {i + 1}
                <span className="ml-1.5 text-apple-xs text-apple-text-tertiary">({v.angle})</span>
              </button>
            ))}
          </div>

          {currentVariation && (
            <div className={`grid gap-6 ${showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
              {/* Copy Section */}
              <div className="space-y-4">
                <div className="bg-white rounded-apple border border-apple-border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-apple-sm font-semibold text-apple-text">Ad Copy</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-apple-pill bg-purple-100 text-purple-700`}>
                      {currentVariation.angle}
                    </span>
                  </div>

                  {result.platformSpec.fields.map((field) => (
                    <div key={field.key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider">
                          {field.label}
                        </label>
                        <div className="flex items-center gap-2">
                          <CharCounter
                            current={currentVariation.charCounts?.[field.key] || (currentVariation.texts[field.key] || '').length}
                            limit={field.charLimit}
                          />
                          <button
                            onClick={() => copyToClipboard(currentVariation.texts[field.key] || '')}
                            className="text-apple-text-tertiary hover:text-apple-blue transition-colors"
                            title="Copy"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="bg-apple-fill-secondary rounded-apple-sm p-3">
                        <p className="text-apple-sm text-apple-text whitespace-pre-wrap">
                          {currentVariation.texts[field.key] || '(empty)'}
                        </p>
                      </div>
                      <p className="text-[10px] text-apple-text-tertiary">{field.purpose}</p>
                    </div>
                  ))}
                </div>

                {/* Video Script or Image Description */}
                {creativeType === 'video' && currentVariation.script && (
                  <div className="bg-white rounded-apple border border-apple-border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-apple-sm font-semibold text-apple-text">Video Script</h3>
                      <span className="text-apple-xs text-apple-text-tertiary">
                        ~{currentVariation.script.duration || '15-30'}s
                      </span>
                    </div>
                    {[
                      { label: 'Hook (0-3s)', value: currentVariation.script.hook, color: 'border-red-300 bg-red-50' },
                      { label: 'Problem (3-8s)', value: currentVariation.script.problem, color: 'border-amber-300 bg-amber-50' },
                      { label: 'Solution (8-20s)', value: currentVariation.script.solution, color: 'border-green-300 bg-green-50' },
                      { label: 'CTA (20-30s)', value: currentVariation.script.cta, color: 'border-blue-300 bg-blue-50' },
                    ].map((section) => (
                      <div key={section.label} className={`border-l-3 ${section.color} rounded-r-apple-sm p-3`} style={{ borderLeftWidth: '3px' }}>
                        <p className="text-apple-xs font-semibold text-apple-text-secondary mb-1">{section.label}</p>
                        <p className="text-apple-sm text-apple-text">{section.value}</p>
                      </div>
                    ))}
                    <div className="bg-gray-50 rounded-apple-sm p-3">
                      <p className="text-apple-xs font-semibold text-apple-text-secondary mb-1">Visual Direction</p>
                      <p className="text-apple-sm text-apple-text">{currentVariation.script.visualDirection}</p>
                    </div>
                    <button
                      className="w-full px-3 py-2 rounded-apple-sm bg-purple-600 text-white text-apple-xs font-medium hover:bg-purple-700 transition-colors"
                      onClick={() => copyToClipboard(
                        `HOOK: ${currentVariation.script!.hook}\nPROBLEM: ${currentVariation.script!.problem}\nSOLUTION: ${currentVariation.script!.solution}\nCTA: ${currentVariation.script!.cta}\nVISUAL: ${currentVariation.script!.visualDirection}`
                      )}
                    >
                      Copy Full Script
                    </button>
                  </div>
                )}

                {creativeType === 'static' && currentVariation.imageDescription && (
                  <div className="bg-white rounded-apple border border-apple-border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-apple-sm font-semibold text-apple-text">Image Creative</h3>
                      {!generatedImages[activeVariation] && (
                        <button
                          onClick={() => handleGenerateImage(activeVariation)}
                          disabled={getTask(`ad-image-${platform}-${activeVariation}`)?.status === 'running'}
                          className="px-3 py-1.5 rounded-apple-sm bg-gradient-to-r from-purple-600 to-pink-600 text-white text-apple-xs font-medium hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50"
                        >
                          {getTask(`ad-image-${platform}-${activeVariation}`)?.status === 'running' ? (
                            <span className="flex items-center gap-1.5">
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Generating...
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Generate Image
                            </span>
                          )}
                        </button>
                      )}
                    </div>

                    {generatedImages[activeVariation] && (
                      <div className="space-y-2">
                        <img
                          src={generatedImages[activeVariation]}
                          alt="Generated ad creative"
                          className="w-full rounded-apple-sm border border-apple-divider"
                        />
                        <div className="flex gap-2">
                          <a
                            href={generatedImages[activeVariation]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 px-3 py-1.5 rounded-apple-sm border border-apple-border text-apple-xs font-medium text-apple-text-secondary hover:bg-apple-fill-secondary transition-colors text-center"
                          >
                            Open Full Size
                          </a>
                          <button
                            onClick={() => handleGenerateImage(activeVariation)}
                            disabled={getTask(`ad-image-${platform}-${activeVariation}`)?.status === 'running'}
                            className="px-3 py-1.5 rounded-apple-sm border border-apple-border text-apple-xs font-medium text-apple-text-secondary hover:bg-apple-fill-secondary transition-colors disabled:opacity-50"
                          >
                            {getTask(`ad-image-${platform}-${activeVariation}`)?.status === 'running' ? 'Regenerating...' : 'Regenerate'}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="bg-gray-50 rounded-apple-sm p-3">
                      <p className="text-apple-xs font-semibold text-apple-text-secondary mb-1">Creative Brief</p>
                      <p className="text-apple-sm text-apple-text">{currentVariation.imageDescription}</p>
                    </div>
                    {currentVariation.textOverlay && (
                      <div className="bg-blue-50 rounded-apple-sm p-3">
                        <p className="text-apple-xs font-semibold text-blue-700 mb-1">Text Overlay</p>
                        <p className="text-apple-sm text-blue-900">{currentVariation.textOverlay}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Preview */}
              {showPreview && (
                <div className="space-y-4">
                  <div className="bg-gray-100 rounded-apple p-6 flex items-start justify-center min-h-[400px]">
                    <AdPreview
                      variation={currentVariation}
                      platform={platform}
                      spec={result.platformSpec}
                      creativeType={creativeType}
                      generatedImageUrl={generatedImages[activeVariation]}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Platform Tips */}
          {result.platformTips?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-apple p-4">
              <h3 className="text-apple-sm font-semibold text-amber-800 mb-2">Platform Tips</h3>
              <ul className="space-y-1">
                {result.platformTips.map((tip, i) => (
                  <li key={i} className="text-apple-xs text-amber-700 flex gap-2">
                    <span className="shrink-0">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Copy All Button */}
          <button
            onClick={() => {
              const allText = result.variations.map((v, i) => {
                const texts = result.platformSpec.fields
                  .map(f => `${f.label}: ${v.texts[f.key] || ''}`)
                  .join('\n');
                return `--- Variation ${i + 1} (${v.angle}) ---\n${texts}`;
              }).join('\n\n');
              copyToClipboard(allText);
            }}
            className="w-full px-4 py-2.5 rounded-apple border border-apple-border text-apple-sm font-medium text-apple-text-secondary hover:bg-apple-fill-secondary transition-colors"
          >
            Copy All Variations
          </button>
        </div>
      )}

      {/* Saved Creatives */}
      {savedCreatives.length > 0 && (
        <div className="bg-white rounded-apple border border-apple-border p-5 space-y-3">
          <h3 className="text-apple-sm font-semibold text-apple-text">Saved Creatives ({savedCreatives.length})</h3>
          <div className="space-y-2">
            {savedCreatives.map(creative => (
              <div key={creative.id} className="border border-apple-border rounded-apple-sm overflow-hidden">
                <button
                  onClick={() => {
                    if (expandedSaved === creative.id) {
                      setExpandedSaved(null);
                    } else {
                      setExpandedSaved(creative.id);
                      setResult(creative.result);
                      setGeneratedImages(creative.generated_images || {});
                      setActiveCreativeId(creative.id);
                      setActiveVariation(0);
                    }
                  }}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-apple-fill-secondary/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <svg className={`w-3.5 h-3.5 text-apple-text-tertiary transition-transform shrink-0 ${expandedSaved === creative.id ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-apple-xs font-medium text-apple-text truncate">
                        {creative.objective || 'Ad Creative'} — {creative.creative_type}
                      </p>
                      <p className="text-[10px] text-apple-text-tertiary">
                        {creative.result?.variations?.length || 0} variations • {new Date(creative.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
