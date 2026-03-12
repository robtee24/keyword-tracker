import { useState, useEffect, useCallback, useRef } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { authenticatedFetch } from '../services/authService';
import { parseJsonOrThrow } from '../utils/apiResponse';
import { useBackgroundTasks } from '../contexts/BackgroundTaskContext';
import { getModelPreferences } from '../config/models';
import type { GenerationContext } from '../config/models';
import MediaGenerationModal, { GenerationSettingsIcon } from './MediaGenerationModal';
import type { GenerationSettings } from './MediaGenerationModal';
import { useCredits } from '../contexts/CreditsContext';

interface AdIdea {
  title: string;
  hook: string;
  concept: string;
  targetAudience: string;
  emotionalAngle: string;
  cta: string;
  estimatedLength: number;
  platform: string;
}

interface Scene {
  sceneNumber: number;
  durationSeconds: number;
  description: string;
  prompt: string;
  audioDirection: string;
  textOverlays: string[];
  transitionToNext: string;
}

interface CharacterBible {
  name: string;
  description: string;
}

interface VideoProject {
  id: string;
  project_id: string;
  site_url: string;
  idea: AdIdea;
  source_type: string;
  platforms: string[];
  aspect_ratio: string;
  voice_style: string;
  video_style: string;
  overall_concept: string;
  character_bibles?: CharacterBible[];
  color_grading?: string;
  scenes: Scene[];
  status: string;
  created_at: string;
  updated_at: string;
}

interface GeneratedVideo {
  id: string;
  video_project_id: string;
  scene_index: number;
  prompt: string;
  video_url: string | null;
  operation_name: string | null;
  status: string;
  error_message: string | null;
}

interface Props {
  siteUrl: string;
  projectId: string;
  initialIdea?: AdIdea | null;
  onClearIdea?: () => void;
}

const VOICE_STYLES = [
  'Professional', 'Funny', 'Inspirational', 'Conversational', 'Urgent',
  'Luxury', 'Friendly', 'Bold', 'Storytelling', 'Educational',
  'Emotional', 'Energetic', 'Calm', 'Witty', 'Authoritative',
];

const VIDEO_STYLES = [
  'Cinematic', 'UGC', 'Documentary', 'Motion Graphics', 'Testimonial',
  'Product Demo', 'Lifestyle', 'Stop Motion', 'Animated', 'Retro',
  'Minimalist', 'Fast-Paced', 'Slow Motion', 'Split Screen', 'Behind the Scenes',
];

const PLATFORMS = [
  { id: 'meta', label: 'Meta', ratios: ['9:16', '1:1', '16:9'] },
  { id: 'tiktok', label: 'TikTok', ratios: ['9:16'] },
  { id: 'linkedin', label: 'LinkedIn', ratios: ['16:9', '1:1', '9:16'] },
];

const ASPECT_RATIOS = ['16:9', '9:16', '1:1'];

export default function VideoCreateView({ siteUrl, projectId, initialIdea, onClearIdea }: Props) {
  const { startTask } = useBackgroundTasks();
  const [showGenModal, setShowGenModal] = useState(false);
  const { refreshCredits } = useCredits();
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [generatedVideos, setGeneratedVideos] = useState<Record<string, GeneratedVideo[]>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Quick generate
  const [quickIdea, setQuickIdea] = useState('');
  const [quickGenerating, setQuickGenerating] = useState(false);

  // Config for new projects
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['meta']);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [voiceStyle, setVoiceStyle] = useState('Professional');
  const [videoStyle, setVideoStyle] = useState('Cinematic');

  // Prompt editing
  const [editingScene, setEditingScene] = useState<{ projectId: string; sceneIdx: number } | null>(null);
  const [aiEditInput, setAiEditInput] = useState('');
  const [aiEditLoading, setAiEditLoading] = useState(false);

  // Regeneration modal
  const [regenModal, setRegenModal] = useState<{ projectId: string; sceneIdx: number; prompt: string } | null>(null);
  const [regenReason, setRegenReason] = useState('');
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenResult, setRegenResult] = useState<{ changesMade: string; updatedPrompt: string } | null>(null);

  // Generating state
  const [generatingScenes, setGeneratingScenes] = useState<Record<string, boolean>>({});
  const pollingRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const [error, setError] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const resp = await authenticatedFetch(
        `${API_ENDPOINTS.db.videoAds}?table=projects&projectId=${projectId}`
      );
      const data = await parseJsonOrThrow<{ data: VideoProject[] }>(resp);
      setProjects(data.data || []);
    } catch { /* silent */ }
  }, [projectId]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Pending idea that has been ad-tized but not yet had prompts generated
  const [pendingIdea, setPendingIdea] = useState<{ idea: AdIdea; sourceType: string } | null>(null);

  // Handle incoming idea from VideoIdeasView (ad-tize) — stage it, don't generate prompts yet
  useEffect(() => {
    if (initialIdea) {
      setPendingIdea({ idea: initialIdea, sourceType: 'ad-tized' });
      if (onClearIdea) onClearIdea();
    }
  }, [initialIdea]);

  const generateScriptsForPendingIdea = async () => {
    if (!pendingIdea || creatingProject) return;
    if (selectedPlatforms.length === 0) {
      setError('Please select at least one platform');
      return;
    }
    setCreatingProject(true);
    setError('');

    const { idea, sourceType } = pendingIdea;
    const objectives = (() => {
      try { return localStorage.getItem(`kt_objectives_${projectId}`) || ''; } catch { return ''; }
    })();

    const taskLabel = idea.title ? `Video: ${idea.title.slice(0, 40)}` : 'Creating video project';
    startTask(`video-create-${Date.now()}`, 'video-create', taskLabel, async () => {
      try {
        const resp = await authenticatedFetch(API_ENDPOINTS.videoAds.createPrompts, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            siteUrl,
            idea,
            platforms: selectedPlatforms,
            aspectRatio,
            voiceStyle: voiceStyle.toLowerCase(),
            videoStyle: videoStyle.toLowerCase(),
            objectives,
          }),
        });
        const data = await parseJsonOrThrow<{ overallConcept: string; scenes: Scene[]; characterBibles?: CharacterBible[]; colorGrading?: string; productionNotes?: string }>(resp);

        const saveResp = await authenticatedFetch(`${API_ENDPOINTS.db.videoAds}?table=projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            siteUrl,
            idea,
            sourceType,
            platforms: selectedPlatforms,
            aspectRatio,
            voiceStyle: voiceStyle.toLowerCase(),
            videoStyle: videoStyle.toLowerCase(),
            overallConcept: data.overallConcept,
            characterBibles: data.characterBibles || [],
            colorGrading: data.colorGrading || '',
            scenes: data.scenes,
          }),
        });
        const saved = await parseJsonOrThrow<{ data: VideoProject }>(saveResp);

        setProjects(prev => [saved.data, ...prev]);
        setExpandedProject(saved.data.id);
        setPendingIdea(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to create video project');
        throw err;
      } finally {
        setCreatingProject(false);
      }
    });
  };

  const handleQuickGenerate = async () => {
    if (!quickIdea.trim() || quickGenerating) return;
    if (selectedPlatforms.length === 0) {
      setError('Please select at least one platform');
      return;
    }

    const idea: AdIdea = {
      title: quickIdea.trim().slice(0, 60),
      hook: '',
      concept: quickIdea.trim(),
      targetAudience: 'General',
      emotionalAngle: 'Engagement',
      cta: 'Learn More',
      estimatedLength: 30,
      platform: 'All',
    };

    setPendingIdea({ idea, sourceType: 'direct' });
    setQuickIdea('');
    setQuickGenerating(true);
    const objectives = (() => {
      try { return localStorage.getItem(`kt_objectives_${projectId}`) || ''; } catch { return ''; }
    })();

    setCreatingProject(true);
    setError('');
    const taskLabel = `Video: ${idea.title.slice(0, 40)}`;
    startTask(`video-create-${Date.now()}`, 'video-create', taskLabel, async () => {
      try {
        const resp = await authenticatedFetch(API_ENDPOINTS.videoAds.createPrompts, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId, siteUrl, idea,
            platforms: selectedPlatforms, aspectRatio,
            voiceStyle: voiceStyle.toLowerCase(),
            videoStyle: videoStyle.toLowerCase(),
            objectives,
          }),
        });
        const data = await parseJsonOrThrow<{ overallConcept: string; scenes: Scene[]; characterBibles?: CharacterBible[]; colorGrading?: string; productionNotes?: string }>(resp);

        const saveResp = await authenticatedFetch(`${API_ENDPOINTS.db.videoAds}?table=projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId, siteUrl, idea, sourceType: 'direct',
            platforms: selectedPlatforms, aspectRatio,
            voiceStyle: voiceStyle.toLowerCase(),
            videoStyle: videoStyle.toLowerCase(),
            overallConcept: data.overallConcept,
            characterBibles: data.characterBibles || [],
            colorGrading: data.colorGrading || '',
            scenes: data.scenes,
          }),
        });
        const saved = await parseJsonOrThrow<{ data: VideoProject }>(saveResp);

        setProjects(prev => [saved.data, ...prev]);
        setExpandedProject(saved.data.id);
        setPendingIdea(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to create video project');
        throw err;
      } finally {
        setCreatingProject(false);
        setQuickGenerating(false);
      }
    });
  };

  const updateScenePrompt = async (vpId: string, sceneIdx: number, newPrompt: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== vpId) return p;
      const scenes = [...p.scenes];
      scenes[sceneIdx] = { ...scenes[sceneIdx], prompt: newPrompt };
      return { ...p, scenes };
    }));

    const project = projects.find(p => p.id === vpId);
    if (!project) return;
    const scenes = [...project.scenes];
    scenes[sceneIdx] = { ...scenes[sceneIdx], prompt: newPrompt };

    await authenticatedFetch(`${API_ENDPOINTS.db.videoAds}?table=projects`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: vpId, scenes }),
    }).catch(() => {});
  };

  const handleAiEdit = async (vpId: string, sceneIdx: number) => {
    if (!aiEditInput.trim() || aiEditLoading) return;
    setAiEditLoading(true);

    const project = projects.find(p => p.id === vpId);
    if (!project) return;
    const scene = project.scenes[sceneIdx];

    try {
      const resp = await authenticatedFetch(API_ENDPOINTS.videoAds.editPrompt, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPrompt: scene.prompt,
          editInstruction: aiEditInput.trim(),
          sceneDescription: scene.description,
          voiceStyle: project.voice_style,
          videoStyle: project.video_style,
          characterBibles: project.character_bibles || [],
          colorGrading: project.color_grading || '',
        }),
      });
      const data = await parseJsonOrThrow<{ updatedPrompt: string; changesMade: string }>(resp);

      await updateScenePrompt(vpId, sceneIdx, data.updatedPrompt);
      setAiEditInput('');
      setEditingScene(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to edit prompt');
    } finally {
      setAiEditLoading(false);
    }
  };

  const buildVideoContext = (project: VideoProject, scene?: Scene): GenerationContext => ({
    contentType: 'cinematic_ad',
    subject: scene?.description || project.overall_concept || '',
    style: project.video_style || 'cinematic',
    mood: project.idea?.emotionalAngle || 'professional',
    includesText: (scene?.textOverlays?.length || 0) > 0,
    includesPeople: true,
    cameraMotion: 'tracking',
    hasDialogue: !!scene?.audioDirection,
    platform: project.platforms?.[0] || '',
    purpose: 'video_ad',
    colorHints: project.color_grading || '',
  });

  const generateVideo = async (vpId: string, sceneIdx: number) => {
    const project = projects.find(p => p.id === vpId);
    if (!project) return;
    const scene = project.scenes[sceneIdx];

    const key = `${vpId}-${sceneIdx}`;
    setGeneratingScenes(prev => ({ ...prev, [key]: true }));

    startTask(`video-gen-${key}`, 'video-generate', `Generating scene ${sceneIdx + 1}`, async () => {
      try {
        const resp = await authenticatedFetch(API_ENDPOINTS.videoAds.generateVideo, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoProjectId: vpId,
            sceneIndex: sceneIdx,
            prompt: scene.prompt,
            aspectRatio: project.aspect_ratio,
            durationSeconds: scene.durationSeconds || 8,
            model: getModelPreferences(projectId).videoModel,
            context: buildVideoContext(project, scene),
          }),
        });
        const data = await parseJsonOrThrow<{ operationName: string; sceneIndex: number }>(resp);

        if (data.operationName) {
          startPolling(vpId, sceneIdx, data.operationName);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to start video generation');
        setGeneratingScenes(prev => ({ ...prev, [key]: false }));
        throw err;
      }
    });
  };

  const generateAllScenes = async (vpId: string) => {
    const project = projects.find(p => p.id === vpId);
    if (!project) return;

    startTask(`video-gen-all-${vpId}-${Date.now()}`, 'video-generate', `Generating all scenes`, async () => {
      try {
        const resp = await authenticatedFetch(API_ENDPOINTS.videoAds.generateVideo, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoProjectId: vpId, generateAll: true, model: getModelPreferences(projectId).videoModel, context: buildVideoContext(project) }),
        });
        const data = await parseJsonOrThrow<{ operations: Array<{ sceneIndex: number; operationName?: string; status: string; error?: string }> }>(resp);

        const failedOps = data.operations.filter(op => op.status === 'failed');
        if (failedOps.length === data.operations.length) {
          setError(`All scenes failed: ${failedOps[0]?.error || 'Unknown error'}`);
          return;
        }
        if (failedOps.length > 0) {
          setError(`${failedOps.length} scene(s) failed. ${data.operations.length - failedOps.length} generating.`);
        }

        for (const op of data.operations) {
          if (op.operationName) {
            const key = `${vpId}-${op.sceneIndex}`;
            setGeneratingScenes(prev => ({ ...prev, [key]: true }));
            startPolling(vpId, op.sceneIndex, op.operationName);
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to generate videos');
        throw err;
      }
    });
  };

  const startPolling = (vpId: string, sceneIdx: number, operationName: string) => {
    const key = `${vpId}-${sceneIdx}`;

    const poll = async () => {
      try {
        const resp = await authenticatedFetch(
          `${API_ENDPOINTS.videoAds.pollVideo}?operationName=${encodeURIComponent(operationName)}&videoProjectId=${vpId}&sceneIndex=${sceneIdx}`
        );
        const data = await parseJsonOrThrow<{ done: boolean; videoUrl?: string; status: string }>(resp);

        if (data.done) {
          setGeneratingScenes(prev => ({ ...prev, [key]: false }));
          if (pollingRef.current[key]) {
            clearInterval(pollingRef.current[key]);
            delete pollingRef.current[key];
          }
          loadGeneratedVideos(vpId);
          refreshCredits();
        }
      } catch {
        setGeneratingScenes(prev => ({ ...prev, [key]: false }));
        if (pollingRef.current[key]) {
          clearInterval(pollingRef.current[key]);
          delete pollingRef.current[key];
        }
      }
    };

    pollingRef.current[key] = setInterval(poll, 10000);
    poll();
  };

  const loadGeneratedVideos = async (vpId: string) => {
    try {
      const resp = await authenticatedFetch(
        `${API_ENDPOINTS.db.videoAds}?table=generated&videoProjectId=${vpId}`
      );
      const data = await parseJsonOrThrow<{ data: GeneratedVideo[] }>(resp);
      setGeneratedVideos(prev => ({ ...prev, [vpId]: data.data || [] }));
    } catch { /* silent */ }
  };

  const handleRegenerate = async () => {
    if (!regenModal || !regenReason.trim() || regenLoading) return;
    setRegenLoading(true);

    const project = projects.find(p => p.id === regenModal.projectId);
    if (!project) return;

    startTask(`video-regen-${regenModal.projectId}-${regenModal.sceneIdx}`, 'video-regenerate', `Regenerating scene ${regenModal.sceneIdx + 1}`, async () => {
      try {
        const resp = await authenticatedFetch(API_ENDPOINTS.videoAds.regenerate, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentPrompt: regenModal.prompt,
            sceneDescription: project.scenes[regenModal.sceneIdx]?.description,
            reason: regenReason.trim(),
            voiceStyle: project.voice_style,
            videoStyle: project.video_style,
            characterBibles: project.character_bibles || [],
            colorGrading: project.color_grading || '',
          }),
        });
        const data = await parseJsonOrThrow<{ updatedPrompt: string; changesMade: string }>(resp);
        setRegenResult(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to regenerate');
        setRegenModal(null);
        throw err;
      } finally {
        setRegenLoading(false);
      }
    });
  };

  const confirmRegenerate = async () => {
    if (!regenModal || !regenResult) return;

    await updateScenePrompt(regenModal.projectId, regenModal.sceneIdx, regenResult.updatedPrompt);
    await generateVideo(regenModal.projectId, regenModal.sceneIdx);

    setRegenModal(null);
    setRegenResult(null);
    setRegenReason('');
  };

  useEffect(() => {
    return () => {
      Object.values(pollingRef.current).forEach(clearInterval);
    };
  }, []);

  const filteredProjects = searchQuery
    ? projects.filter(p =>
        p.idea?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.overall_concept?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : projects;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-apple-text">Create Video</h1>
        <p className="text-apple-sm text-apple-text-secondary mt-1">
          Generate professional video ads with AI-powered scripts and VEO 3 video generation.
        </p>
      </div>

      {/* Quick Generate */}
      <div className="bg-white rounded-apple border border-apple-border p-5">
        <label className="text-apple-xs font-medium text-apple-text-secondary mb-2 block">Quick Generate</label>
        <div className="flex gap-3">
          <input
            type="text"
            value={quickIdea}
            onChange={(e) => setQuickIdea(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuickGenerate()}
            placeholder="Describe a video idea and we'll create a full script and prompts..."
            className="input flex-1 text-apple-sm"
            disabled={quickGenerating || creatingProject}
          />
          <button
            onClick={handleQuickGenerate}
            disabled={!quickIdea.trim() || quickGenerating || creatingProject}
            className="px-4 py-2 bg-apple-blue text-white rounded-apple-sm text-apple-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {quickGenerating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>

      {/* Pending Idea - show when an idea has been ad-tized but settings not yet confirmed */}
      {pendingIdea && !creatingProject && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-apple border-2 border-purple-200 p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 uppercase tracking-wider">
                  {pendingIdea.sourceType === 'ad-tized' ? 'Ad-tized' : 'Direct'}
                </span>
                <h3 className="text-apple-sm font-semibold text-apple-text">{pendingIdea.idea.title}</h3>
              </div>
              <p className="text-apple-xs text-apple-text-secondary">{pendingIdea.idea.concept}</p>
              <div className="flex gap-3 mt-2 text-[10px] text-apple-text-tertiary">
                {pendingIdea.idea.hook && <span>Hook: "{pendingIdea.idea.hook}"</span>}
                <span>Audience: {pendingIdea.idea.targetAudience}</span>
                <span>{pendingIdea.idea.estimatedLength}s</span>
              </div>
            </div>
            <button onClick={() => setPendingIdea(null)} className="text-apple-text-tertiary hover:text-red-500 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <p className="text-apple-xs text-purple-700 font-medium">Select your video settings below, then click "Generate Script & Prompts" to create the full video production plan.</p>
        </div>
      )}

      {/* Configuration */}
      <div className="bg-white rounded-apple border border-apple-border p-5 space-y-4">
        <h3 className="text-apple-sm font-medium text-apple-text">Video Settings</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Platforms */}
          <div>
            <label className="text-apple-xs text-apple-text-secondary block mb-1.5">Platforms</label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlatforms(prev =>
                    prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]
                  )}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    selectedPlatforms.includes(p.id)
                      ? 'bg-apple-blue text-white'
                      : 'bg-apple-fill-secondary text-apple-text-secondary hover:bg-apple-fill-tertiary'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="text-apple-xs text-apple-text-secondary block mb-1.5">Aspect Ratio</label>
            <div className="flex gap-1.5">
              {ASPECT_RATIOS.map(r => (
                <button
                  key={r}
                  onClick={() => setAspectRatio(r)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    aspectRatio === r
                      ? 'bg-apple-blue text-white'
                      : 'bg-apple-fill-secondary text-apple-text-secondary hover:bg-apple-fill-tertiary'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Voice Style */}
          <div>
            <label className="text-apple-xs text-apple-text-secondary block mb-1.5">Voice</label>
            <select
              value={voiceStyle}
              onChange={(e) => setVoiceStyle(e.target.value)}
              className="input w-full text-apple-xs"
            >
              {VOICE_STYLES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* Video Style */}
          <div>
            <label className="text-apple-xs text-apple-text-secondary block mb-1.5">Style</label>
            <select
              value={videoStyle}
              onChange={(e) => setVideoStyle(e.target.value)}
              className="input w-full text-apple-xs"
            >
              {VIDEO_STYLES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        {/* Generate Script button (only visible when pending idea exists) */}
        {pendingIdea && !creatingProject && (
          <div className="pt-2 border-t border-apple-border flex justify-end">
            <button
              onClick={generateScriptsForPendingIdea}
              disabled={selectedPlatforms.length === 0}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-apple-sm text-apple-sm font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-md"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Generate Script & Prompts
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-apple-sm text-red-700 text-apple-xs">{error}
          <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {creatingProject && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-apple flex items-center gap-3">
          <svg className="w-5 h-5 animate-spin text-apple-blue" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-apple-sm text-apple-blue font-medium">Creating video script and prompts...</span>
        </div>
      )}

      {/* Search */}
      {projects.length > 0 && (
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search video projects..."
            className="input w-full pl-10 text-apple-sm"
          />
        </div>
      )}

      {/* Video Projects */}
      <div className="space-y-4">
        {filteredProjects.map(project => {
          const isExpanded = expandedProject === project.id;
          const videos = generatedVideos[project.id] || [];

          return (
            <div key={project.id} className="bg-white rounded-apple border border-apple-border overflow-hidden">
              <button
                onClick={() => {
                  setExpandedProject(isExpanded ? null : project.id);
                  if (!isExpanded && !generatedVideos[project.id]) {
                    loadGeneratedVideos(project.id);
                  }
                }}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-apple-fill-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3 text-left flex-1 min-w-0">
                  <svg className={`w-4 h-4 text-apple-text-tertiary transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <div className="min-w-0">
                    <h3 className="text-apple-sm font-semibold text-apple-text truncate">{project.idea?.title || 'Untitled'}</h3>
                    <p className="text-apple-xs text-apple-text-tertiary truncate">{project.overall_concept}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    project.status === 'completed' ? 'bg-green-100 text-green-700' :
                    project.status === 'generating' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {project.status}
                  </span>
                  <span className="text-apple-xs text-apple-text-tertiary">{project.scenes?.length || 0} scenes</span>
                  <span className="text-apple-xs text-apple-text-tertiary">
                    {new Date(project.created_at).toLocaleDateString()}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-apple-border">
                  {/* Project meta */}
                  <div className="px-5 py-3 bg-apple-fill-secondary/30 flex flex-wrap gap-4 text-apple-xs text-apple-text-tertiary">
                    <span>Platforms: {project.platforms?.join(', ') || 'All'}</span>
                    <span>Ratio: {project.aspect_ratio}</span>
                    <span>Voice: {project.voice_style}</span>
                    <span>Style: {project.video_style}</span>
                  </div>

                  {/* Character Bibles & Color Grading */}
                  {(project.character_bibles?.length || project.color_grading) && (
                    <div className="px-5 py-3 border-b border-apple-border space-y-2">
                      {project.character_bibles?.map((cb, cbi) => (
                        <div key={cbi} className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                          <span className="text-[10px] font-semibold text-purple-700 uppercase tracking-wider">Character: {cb.name}</span>
                          <p className="text-apple-xs text-purple-900 mt-1">{cb.description}</p>
                        </div>
                      ))}
                      {project.color_grading && (
                        <div className="bg-blue-50 rounded-lg p-2 px-3 border border-blue-200">
                          <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider">Color Grading</span>
                          <span className="text-apple-xs text-blue-900 ml-2">{project.color_grading}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action bar */}
                  <div className="px-5 py-3 border-b border-apple-border flex items-center justify-between gap-3">
                    {/* Combine All download */}
                    {videos.filter(v => v.video_url).length > 1 && (
                      <button
                        onClick={() => {
                          const completedVideos = videos.filter(v => v.video_url).sort((a, b) => a.scene_index - b.scene_index);
                          completedVideos.forEach((v, i) => {
                            const a = document.createElement('a');
                            a.href = v.video_url!;
                            a.download = `${project.idea?.title || 'video'}-scene-${i + 1}.mp4`;
                            a.target = '_blank';
                            a.rel = 'noopener';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          });
                        }}
                        className="px-3 py-1.5 text-apple-xs font-medium rounded-apple-sm border border-green-300 text-green-700 hover:bg-green-50 transition-colors flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download All Scenes ({videos.filter(v => v.video_url).length})
                      </button>
                    )}
                    <button
                      onClick={() => generateAllScenes(project.id)}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-apple-sm text-apple-xs font-medium hover:from-purple-700 hover:to-blue-700 transition-all flex items-center gap-2 ml-auto"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Generate All Scenes
                      <GenerationSettingsIcon onClick={(e) => { e.stopPropagation(); setShowGenModal(true); }} />
                    </button>
                  </div>

                  {/* Scenes */}
                  <div className="divide-y divide-apple-border">
                    {(project.scenes || []).map((scene, idx) => {
                      const genKey = `${project.id}-${idx}`;
                      const isGenerating = generatingScenes[genKey];
                      const video = videos.find(v => v.scene_index === idx);
                      const isEditing = editingScene?.projectId === project.id && editingScene?.sceneIdx === idx;

                      return (
                        <div key={idx} className="p-5 space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-mono bg-apple-fill-secondary text-apple-text-secondary px-1.5 py-0.5 rounded font-semibold">
                                  Scene {scene.sceneNumber}
                                </span>
                                <span className="text-[10px] text-apple-text-tertiary">{scene.durationSeconds}s</span>
                                {scene.transitionToNext && (
                                  <span className="text-[10px] text-purple-600">→ {scene.transitionToNext}</span>
                                )}
                              </div>
                              <p className="text-apple-xs text-apple-text-secondary mb-2">{scene.description}</p>

                              {scene.textOverlays?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {scene.textOverlays.map((t, ti) => (
                                    <span key={ti} className="text-[10px] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-200">
                                      Text: "{t}"
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {video?.video_url ? (
                                <button
                                  onClick={() => setRegenModal({ projectId: project.id, sceneIdx: idx, prompt: scene.prompt })}
                                  className="px-2.5 py-1 text-[11px] font-medium rounded border border-orange-300 text-orange-600 hover:bg-orange-50 transition-colors"
                                >
                                  Regenerate
                                </button>
                              ) : null}

                              <button
                                onClick={() => generateVideo(project.id, idx)}
                                disabled={isGenerating}
                                className="px-3 py-1.5 text-apple-xs font-medium rounded-apple-sm bg-apple-blue text-white hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                              >
                                {isGenerating ? (
                                  <>
                                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    </svg>
                                    Generate
                                    <GenerationSettingsIcon onClick={(e) => { e.stopPropagation(); setShowGenModal(true); }} />
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Prompt (editable) */}
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">VEO 3 Prompt</span>
                            </div>
                            <textarea
                              value={scene.prompt}
                              onChange={(e) => {
                                const newPrompt = e.target.value;
                                setProjects(prev => prev.map(p => {
                                  if (p.id !== project.id) return p;
                                  const scenes = [...p.scenes];
                                  scenes[idx] = { ...scenes[idx], prompt: newPrompt };
                                  return { ...p, scenes };
                                }));
                              }}
                              onBlur={() => updateScenePrompt(project.id, idx, scene.prompt)}
                              rows={3}
                              className="w-full bg-transparent text-apple-xs text-gray-700 resize-none focus:outline-none"
                            />
                          </div>

                          {/* AI Edit bar */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={isEditing ? aiEditInput : ''}
                              onChange={(e) => { setEditingScene({ projectId: project.id, sceneIdx: idx }); setAiEditInput(e.target.value); }}
                              onFocus={() => setEditingScene({ projectId: project.id, sceneIdx: idx })}
                              onKeyDown={(e) => e.key === 'Enter' && handleAiEdit(project.id, idx)}
                              placeholder="Edit with AI — e.g. &quot;add a palm tree to the scene&quot;"
                              className="input flex-1 text-[11px]"
                              disabled={aiEditLoading}
                            />
                            {isEditing && aiEditInput.trim() && (
                              <button
                                onClick={() => handleAiEdit(project.id, idx)}
                                disabled={aiEditLoading}
                                className="px-3 py-1 text-[11px] bg-apple-blue text-white rounded-apple-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
                              >
                                {aiEditLoading ? 'Editing...' : 'Apply'}
                              </button>
                            )}
                          </div>

                          {/* Audio direction */}
                          {scene.audioDirection && (
                            <p className="text-[10px] text-apple-text-tertiary">
                              <span className="font-medium">Audio:</span> {scene.audioDirection}
                            </p>
                          )}

                          {/* Generated video preview + download */}
                          {video?.video_url && (
                            <div className="mt-2 space-y-2">
                              <video
                                src={video.video_url}
                                controls
                                className="w-full max-w-md rounded-lg border border-gray-200"
                              />
                              <a
                                href={video.video_url}
                                download={`${project.idea?.title || 'video'}-scene-${idx + 1}.mp4`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded border border-apple-border text-apple-text-secondary hover:bg-apple-fill-secondary transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download Scene {idx + 1}
                              </a>
                            </div>
                          )}
                          {video?.status === 'failed' && (
                            <div className="text-[11px] text-red-600 bg-red-50 px-3 py-2 rounded">
                              Generation failed: {video.error_message || 'Unknown error'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {projects.length === 0 && !creatingProject && (
        <div className="text-center py-16 text-apple-text-tertiary">
          <svg className="w-12 h-12 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-apple-sm font-medium">No video projects yet</p>
          <p className="text-apple-xs mt-1">Use the quick generate box above or "Ad-tize" an idea from the Generate Ideas tab</p>
        </div>
      )}

      {/* Regeneration Modal */}
      {regenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
            {!regenResult ? (
              <>
                <h3 className="text-lg font-semibold text-apple-text">Why are you regenerating?</h3>
                <p className="text-apple-xs text-apple-text-secondary">
                  Tell us what was wrong so we can fix the prompt before regenerating.
                </p>
                <textarea
                  value={regenReason}
                  onChange={(e) => setRegenReason(e.target.value)}
                  placeholder="e.g. The lighting was too dark, the camera movement was too fast, the character didn't match..."
                  rows={3}
                  className="input w-full text-apple-sm resize-none"
                  autoFocus
                />
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => { setRegenModal(null); setRegenReason(''); }}
                    className="px-4 py-2 text-apple-sm text-apple-text-secondary hover:bg-apple-fill-secondary rounded-apple-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRegenerate}
                    disabled={!regenReason.trim() || regenLoading}
                    className="px-4 py-2 bg-apple-blue text-white rounded-apple-sm text-apple-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
                  >
                    {regenLoading ? 'Analyzing...' : 'Fix & Regenerate'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-apple-text">Changes Made</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-apple-sm text-blue-800">
                  {regenResult.changesMade}
                </div>
                <p className="text-apple-xs text-apple-text-secondary">Ready to regenerate with the updated prompt?</p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => { setRegenResult(null); setRegenReason(''); }}
                    className="px-4 py-2 text-apple-sm text-apple-text-secondary hover:bg-apple-fill-secondary rounded-apple-sm transition-colors"
                  >
                    No, change more
                  </button>
                  <button
                    onClick={confirmRegenerate}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-apple-sm text-apple-sm font-medium hover:from-purple-700 hover:to-blue-700 transition-all"
                  >
                    Continue
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <MediaGenerationModal
        isOpen={showGenModal}
        onClose={() => setShowGenModal(false)}
        mode="textToVideo"
        projectId={projectId}
        onGenerate={(settings: GenerationSettings) => {
          // Override model preference for the next generation
        }}
        defaultContext={projects[0] ? buildVideoContext(projects[0]) : undefined}
      />
    </div>
  );
}
