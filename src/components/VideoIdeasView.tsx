import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { authenticatedFetch } from '../services/authService';
import { parseJsonOrThrow } from '../utils/apiResponse';
import { useBackgroundTasks } from '../contexts/BackgroundTaskContext';

interface AdIdea {
  title: string;
  hook: string;
  concept: string;
  targetAudience: string;
  emotionalAngle: string;
  cta: string;
  estimatedLength: number;
  platform: string;
  variationStrategy?: string;
}

interface IdeaBatch {
  id: string;
  input_type: string;
  input_text: string;
  ideas: AdIdea[];
  created_at: string;
}


interface Props {
  siteUrl: string;
  projectId: string;
  onAdTize?: (idea: AdIdea) => void;
}

const INPUT_TYPES = [
  { id: 'general_idea', label: 'General Idea', placeholder: 'Describe your ad concept, product feature, or campaign goal...' },
  { id: 'best_performer', label: 'Best Performer', placeholder: 'Paste or describe your current best-performing ad...' },
  { id: 'website_analysis', label: 'Analyze Website', placeholder: 'We\'ll crawl your site and generate ideas based on your offering...' },
];

export default function VideoIdeasView({ siteUrl, projectId, onAdTize }: Props) {
  const [inputType, setInputType] = useState('general_idea');
  const [inputText, setInputText] = useState('');
  const [ideaBatches, setIdeaBatches] = useState<IdeaBatch[]>([]);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingVariations, setGeneratingVariations] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const { startTask, getTask } = useBackgroundTasks();

  const loadData = useCallback(async () => {
    try {
      const resp = await authenticatedFetch(
        `${API_ENDPOINTS.db.videoAds}?table=ideas&projectId=${projectId}`
      );
      const data = await parseJsonOrThrow<{ data: IdeaBatch[] }>(resp);
      setIdeaBatches(data.data || []);
      if (data.data?.length && !expandedBatch) {
        setExpandedBatch(data.data[0].id);
      }
    } catch { /* silent */ }
  }, [projectId, expandedBatch]);

  useEffect(() => { loadData(); }, [loadData]);

  const generateIdeas = async () => {
    if (generating) return;
    if (inputType !== 'website_analysis' && !inputText.trim()) return;
    setGenerating(true);
    setError('');

    try {
      const resp = await authenticatedFetch(API_ENDPOINTS.videoAds.generateIdeas, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, siteUrl, inputType, inputText: inputText.trim() }),
      });
      const data = await parseJsonOrThrow<{ ideas: AdIdea[] }>(resp);

      if (!data.ideas?.length) throw new Error('No ideas generated');

      const saveResp = await authenticatedFetch(`${API_ENDPOINTS.db.videoAds}?table=ideas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          siteUrl,
          inputType,
          inputText: inputText.trim(),
          ideas: data.ideas,
        }),
      });
      const saved = await parseJsonOrThrow<{ data: IdeaBatch }>(saveResp);

      setIdeaBatches(prev => [saved.data, ...prev]);
      setExpandedBatch(saved.data.id);
      setInputText('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate ideas');
    } finally {
      setGenerating(false);
    }
  };

  const generateVariations = async (batchId: string, idea: AdIdea) => {
    if (generatingVariations) return;
    setGeneratingVariations(`${batchId}-${idea.title}`);

    const allExistingIdeas = ideaBatches.flatMap(b => b.ideas);

    try {
      const resp = await authenticatedFetch(API_ENDPOINTS.videoAds.generateVariations, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          siteUrl,
          sourceIdea: idea,
          existingVariations: allExistingIdeas,
        }),
      });
      const data = await parseJsonOrThrow<{ variations: AdIdea[] }>(resp);

      if (!data.variations?.length) throw new Error('No variations generated');

      const saveResp = await authenticatedFetch(`${API_ENDPOINTS.db.videoAds}?table=ideas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          siteUrl,
          inputType: 'variation',
          inputText: `Variations of: ${idea.title}`,
          ideas: data.variations,
        }),
      });
      const saved = await parseJsonOrThrow<{ data: IdeaBatch }>(saveResp);

      setIdeaBatches(prev => [saved.data, ...prev]);
      setExpandedBatch(saved.data.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate variations');
    } finally {
      setGeneratingVariations(null);
    }
  };

  const handleAdTize = (idea: AdIdea) => {
    if (onAdTize) onAdTize(idea);
  };

  const filteredBatches = searchQuery
    ? ideaBatches.filter(b =>
        b.ideas.some(i =>
          i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.concept.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : ideaBatches;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-apple-text">Video Ad Ideas</h1>
        <p className="text-apple-sm text-apple-text-secondary mt-1">
          Generate creative video ad concepts using AI. Explore variations and send your favorites to production.
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-white rounded-apple border border-apple-border p-5 space-y-4">
        <div className="flex gap-2">
          {INPUT_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setInputType(t.id)}
              className={`px-3 py-1.5 rounded-apple-sm text-apple-xs font-medium transition-colors ${
                inputType === t.id
                  ? 'bg-apple-blue text-white'
                  : 'bg-apple-fill-secondary text-apple-text-secondary hover:bg-apple-fill-tertiary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={INPUT_TYPES.find(t => t.id === inputType)?.placeholder}
          rows={3}
          className="input w-full text-apple-sm resize-none"
          disabled={generating}
        />

        <div className="flex items-center justify-between">
          <span className="text-apple-xs text-apple-text-tertiary">
            {inputType === 'website_analysis' ? 'We\'ll analyze your site automatically' : ''}
          </span>
          <button
            onClick={generateIdeas}
            disabled={generating || (inputType !== 'website_analysis' && !inputText.trim())}
            className="px-5 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {generating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating 10 Ideas...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate 10 Ideas
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-apple-sm text-red-700 text-apple-xs">{error}</div>
        )}
      </div>

      {/* Search */}
      {ideaBatches.length > 0 && (
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ideas..."
            className="input w-full pl-10 text-apple-sm"
          />
        </div>
      )}

      {/* Idea Batches */}
      <div className="space-y-4">
        {filteredBatches.map(batch => (
          <div key={batch.id} className="bg-white rounded-apple border border-apple-border overflow-hidden">
            <button
              onClick={() => setExpandedBatch(expandedBatch === batch.id ? null : batch.id)}
              className="w-full px-5 py-3 flex items-center justify-between hover:bg-apple-fill-secondary transition-colors"
            >
              <div className="flex items-center gap-3 text-left">
                <svg className={`w-4 h-4 text-apple-text-tertiary transition-transform ${expandedBatch === batch.id ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <div>
                  <span className="text-apple-sm font-medium text-apple-text">
                    {batch.ideas.length} Ideas
                  </span>
                  <span className="text-apple-xs text-apple-text-tertiary ml-2">
                    {batch.input_type === 'variation' ? `Variations — ${batch.input_text}` :
                     batch.input_type === 'general_idea' ? 'From idea' :
                     batch.input_type === 'best_performer' ? 'From best performer' : 'From site analysis'}
                  </span>
                </div>
              </div>
              <span className="text-apple-xs text-apple-text-tertiary">
                {new Date(batch.created_at).toLocaleDateString()}
              </span>
            </button>

            {expandedBatch === batch.id && (
              <div className="border-t border-apple-border divide-y divide-apple-border">
                {batch.ideas.map((idea, idx) => {
                  const isGeneratingThis = generatingVariations === `${batch.id}-${idea.title}`;

                  return (
                    <div key={idx} className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-apple-xs font-mono bg-apple-fill-secondary text-apple-text-secondary px-1.5 py-0.5 rounded">
                              #{idx + 1}
                            </span>
                            <h3 className="text-apple-sm font-semibold text-apple-text truncate">{idea.title}</h3>
                          </div>
                          <p className="text-apple-xs text-apple-blue font-medium mb-1">Hook: "{idea.hook}"</p>
                          <p className="text-apple-xs text-apple-text-secondary">{idea.concept}</p>
                          {idea.variationStrategy && (
                            <p className="text-[10px] text-purple-600 mt-1 italic">{idea.variationStrategy}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => generateVariations(batch.id, idea)}
                            disabled={!!generatingVariations}
                            className="px-3 py-1.5 text-apple-xs font-medium rounded-apple-sm border border-apple-border text-apple-text hover:bg-apple-fill-secondary disabled:opacity-50 transition-colors"
                          >
                            {isGeneratingThis ? 'Generating...' : 'Create Variations'}
                          </button>
                          <button
                            onClick={() => handleAdTize(idea)}
                            className="px-3 py-1.5 text-apple-xs font-medium rounded-apple-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all"
                          >
                            Ad-tize
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-4 text-apple-xs text-apple-text-tertiary">
                        <span>Audience: {idea.targetAudience}</span>
                        <span>Emotion: {idea.emotionalAngle}</span>
                        <span>{idea.estimatedLength}s</span>
                        <span>{idea.platform}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {ideaBatches.length === 0 && !generating && (
        <div className="text-center py-16 text-apple-text-tertiary">
          <svg className="w-12 h-12 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-apple-sm font-medium">No video ad ideas yet</p>
          <p className="text-apple-xs mt-1">Describe your idea above and generate 10 creative concepts</p>
        </div>
      )}
    </div>
  );
}
