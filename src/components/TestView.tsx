import { useState, useRef } from 'react';
import { authenticatedFetch } from '../services/authService';
import { API_BASE_URL } from '../config/api';
import {
  TEXT_TO_IMAGE_MODELS, IMAGE_EDIT_MODELS, TEXT_TO_VIDEO_MODELS, IMAGE_TO_VIDEO_MODELS,
} from '../config/models';
import type { ModelOption } from '../config/models';

interface TestResult {
  modelId: string;
  label: string;
  vendor: string;
  status: 'pending' | 'running' | 'success' | 'error';
  imageUrl?: string;
  videoUrl?: string;
  error?: string;
  elapsed?: number;
}

const TEST_ENDPOINT = `${API_BASE_URL}/api/test/generate`;

function ResultCard({ result }: { result: TestResult }) {
  return (
    <div className="border border-apple-divider rounded-apple overflow-hidden bg-white">
      <div className="px-3 py-2 border-b border-apple-divider bg-apple-fill-secondary flex items-center justify-between">
        <div>
          <span className="text-apple-xs font-semibold text-apple-text">{result.label}</span>
          <span className="text-[10px] text-apple-text-tertiary ml-1.5">({result.vendor})</span>
        </div>
        <div className="flex items-center gap-2">
          {result.elapsed != null && (
            <span className="text-[10px] text-apple-text-tertiary">{(result.elapsed / 1000).toFixed(1)}s</span>
          )}
          {result.status === 'pending' && (
            <span className="text-[10px] text-apple-text-tertiary">Waiting</span>
          )}
          {result.status === 'running' && (
            <div className="w-3.5 h-3.5 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
          )}
          {result.status === 'success' && (
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          )}
          {result.status === 'error' && (
            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
      </div>
      <div className="aspect-square bg-apple-fill-secondary flex items-center justify-center relative">
        {result.status === 'pending' && (
          <span className="text-apple-xs text-apple-text-tertiary">Queued</span>
        )}
        {result.status === 'running' && (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
            <span className="text-apple-xs text-apple-text-tertiary">Generating...</span>
          </div>
        )}
        {result.status === 'success' && result.imageUrl && (
          <img src={result.imageUrl} alt={result.label} className="w-full h-full object-cover" />
        )}
        {result.status === 'success' && result.videoUrl && (
          <video src={result.videoUrl} controls className="w-full h-full object-cover" />
        )}
        {result.status === 'success' && !result.imageUrl && !result.videoUrl && (
          <span className="text-apple-xs text-amber-600 px-3 text-center">Returned OK but no media (polling may be required)</span>
        )}
        {result.status === 'error' && (
          <div className="px-3 py-2 text-center">
            <p className="text-apple-xs text-red-600 break-words max-h-32 overflow-y-auto">{result.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface TestSectionProps {
  title: string;
  type: string;
  models: ModelOption[];
  needsImage?: boolean;
  defaultPrompt: string;
}

function TestSection({ title, type, models, needsImage, defaultPrompt, projectId }: TestSectionProps & { projectId?: string }) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [sourceImage, setSourceImage] = useState('');
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSourceImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const runAll = async () => {
    if (needsImage && !sourceImage) return;
    setRunning(true);

    const initial: TestResult[] = models.map((m) => ({
      modelId: m.id,
      label: m.label,
      vendor: m.vendor,
      status: 'pending',
    }));
    setResults(initial);

    const runModel = async (model: ModelOption, idx: number) => {
      setResults((prev) => prev.map((r, i) => i === idx ? { ...r, status: 'running' } : r));
      const start = Date.now();
      try {
        const body: Record<string, string> = { type, model: model.id, prompt };
        if (model.falModelId) body.falModelId = model.falModelId;
        if (needsImage && sourceImage) body.imageUrl = sourceImage;
        if (projectId) body.projectId = projectId;

        const resp = await authenticatedFetch(TEST_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await resp.json();
        const elapsed = Date.now() - start;

        if (data.error) {
          setResults((prev) => prev.map((r, i) => i === idx ? { ...r, status: 'error', error: data.error, elapsed } : r));
        } else {
          setResults((prev) => prev.map((r, i) => i === idx ? {
            ...r,
            status: 'success',
            imageUrl: data.imageUrl,
            videoUrl: data.videoUrl,
            elapsed,
          } : r));
        }
      } catch (err: any) {
        const elapsed = Date.now() - start;
        setResults((prev) => prev.map((r, i) => i === idx ? { ...r, status: 'error', error: err.message, elapsed } : r));
      }
    };

    const promises = models.map((model, idx) => runModel(model, idx));
    await Promise.allSettled(promises);
    setRunning(false);
  };

  return (
    <div className="card p-6 mb-6">
      <h2 className="text-apple-title3 font-semibold text-apple-text mb-1">{title}</h2>
      <p className="text-apple-xs text-apple-text-tertiary mb-4">{models.length} models will be tested simultaneously</p>

      {needsImage && (
        <div className="mb-3">
          <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1.5">Source Image</label>
          {sourceImage ? (
            <div className="relative inline-block">
              <img src={sourceImage} alt="Source" className="h-20 rounded-apple border border-apple-divider" />
              <button onClick={() => { setSourceImage(''); if (fileRef.current) fileRef.current.value = ''; }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">×</button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()}
              className="px-4 py-2 border-2 border-dashed border-apple-divider rounded-apple text-apple-xs text-apple-text-tertiary hover:border-apple-blue hover:text-apple-blue transition-all">
              Upload image
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter test prompt..."
          className="input flex-1 text-apple-sm"
        />
        <button
          onClick={runAll}
          disabled={running || (needsImage && !sourceImage)}
          className="btn-primary text-apple-sm whitespace-nowrap disabled:opacity-50"
        >
          {running ? 'Testing...' : `Test All ${models.length} Models`}
        </button>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {results.map((r) => (
            <ResultCard key={r.modelId} result={r} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TestView({ projectId }: { projectId: string }) {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-apple-title2 font-bold text-apple-text">API Model Test</h1>
        <p className="text-apple-sm text-apple-text-secondary mt-1">
          Test every model across all generation types. All models in each category run simultaneously.
        </p>
        <p className="text-apple-xs text-amber-600 mt-2">
          Note: This will use AI credits for each successful generation. Video models will generate short 5-second clips at 720p to minimize cost.
        </p>
      </div>

      <TestSection
        title="Image Generation"
        type="textToImage"
        models={TEXT_TO_IMAGE_MODELS}
        defaultPrompt="A serene mountain lake at sunset with snow-capped peaks reflected in crystal clear water"
        projectId={projectId}
      />

      <TestSection
        title="Image Editing"
        type="imageEdit"
        models={IMAGE_EDIT_MODELS}
        needsImage
        defaultPrompt="Make the colors more vibrant and add a warm golden glow"
        projectId={projectId}
      />

      <TestSection
        title="Video Generation"
        type="textToVideo"
        models={TEXT_TO_VIDEO_MODELS}
        defaultPrompt="A calm ocean wave rolling onto a sandy beach at golden hour with seagulls flying overhead"
        projectId={projectId}
      />

      <TestSection
        title="Image to Video"
        type="imageToVideo"
        models={IMAGE_TO_VIDEO_MODELS}
        needsImage
        defaultPrompt="Gently animate this scene with subtle motion and atmospheric effects"
        projectId={projectId}
      />
    </div>
  );
}
