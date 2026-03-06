import { useState, useEffect, useCallback, useMemo } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { authenticatedFetch } from '../services/authService';
import { logActivity } from '../utils/activityLog';

interface Opportunity {
  id?: string;
  batch_id?: string;
  title: string;
  targetKeyword: string;
  target_keyword?: string;
  relatedKeywords: string[];
  related_keywords?: string[];
  searchVolume: string;
  search_volume?: string;
  estimatedMonthlySearches: number;
  estimated_searches?: number;
  difficulty: string;
  funnelStage: string;
  funnel_stage?: string;
  description: string;
  contentType: string;
  content_type?: string;
  status?: string;
  generated_blog?: GeneratedBlog | null;
  created_at?: string;
}

interface GeneratedBlog {
  title: string;
  metaDescription: string;
  slug: string;
  content: string;
  wordCount: number;
  suggestedImages: string[];
  internalLinkSuggestions: string[];
  articleId?: string;
}

interface Batch {
  batchId: string;
  createdAt: string;
  opportunities: Opportunity[];
}

interface BlogOpportunityViewProps {
  siteUrl: string;
  projectId: string;
}

function normalizeOpp(raw: Record<string, unknown>): Opportunity {
  return {
    id: raw.id as string | undefined,
    batch_id: raw.batch_id as string | undefined,
    title: (raw.title as string) || '',
    targetKeyword: (raw.target_keyword as string) || (raw.targetKeyword as string) || '',
    relatedKeywords: (raw.related_keywords as string[]) || (raw.relatedKeywords as string[]) || [],
    searchVolume: (raw.search_volume as string) || (raw.searchVolume as string) || 'medium',
    estimatedMonthlySearches: (raw.estimated_searches as number) || (raw.estimatedMonthlySearches as number) || 0,
    difficulty: (raw.difficulty as string) || 'medium',
    funnelStage: (raw.funnel_stage as string) || (raw.funnelStage as string) || 'awareness',
    description: (raw.description as string) || '',
    contentType: (raw.content_type as string) || (raw.contentType as string) || 'guide',
    status: (raw.status as string) || 'pending',
    generated_blog: (raw.generated_blog as GeneratedBlog | null) || null,
    created_at: (raw.created_at as string) || '',
  };
}

function groupIntoBatches(opps: Opportunity[]): Batch[] {
  const withBatchId: Opportunity[] = [];
  const withoutBatchId: Opportunity[] = [];

  for (const opp of opps) {
    if (opp.batch_id) withBatchId.push(opp);
    else withoutBatchId.push(opp);
  }

  const byBatch = new Map<string, Opportunity[]>();

  for (const opp of withBatchId) {
    if (!byBatch.has(opp.batch_id!)) byBatch.set(opp.batch_id!, []);
    byBatch.get(opp.batch_id!)!.push(opp);
  }

  if (withoutBatchId.length > 0) {
    const sorted = [...withoutBatchId].sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
    let currentGroup: Opportunity[] = [sorted[0]];
    let groupIdx = 0;

    for (let i = 1; i < sorted.length; i++) {
      const prevTime = new Date(sorted[i - 1].created_at || 0).getTime();
      const currTime = new Date(sorted[i].created_at || 0).getTime();
      if (prevTime - currTime < 5 * 60 * 1000) {
        currentGroup.push(sorted[i]);
      } else {
        byBatch.set(`legacy_${groupIdx}`, currentGroup);
        groupIdx++;
        currentGroup = [sorted[i]];
      }
    }
    byBatch.set(`legacy_${groupIdx}`, currentGroup);
  }

  const batches: Batch[] = [];
  for (const [batchId, items] of byBatch) {
    batches.push({
      batchId,
      createdAt: items[0]?.created_at || '',
      opportunities: items,
    });
  }

  batches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return batches;
}

export default function BlogOpportunityView({ siteUrl, projectId }: BlogOpportunityViewProps) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingBlog, setGeneratingBlog] = useState<string | null>(null);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blogError, setBlogError] = useState<string | null>(null);

  const batches = useMemo(() => groupIntoBatches(opportunities), [opportunities]);

  const loadOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await authenticatedFetch(`${API_ENDPOINTS.db.blogOpportunities}?siteUrl=${encodeURIComponent(siteUrl)}&projectId=${projectId}`);
      const data = await resp.json();
      setOpportunities((data.opportunities || []).map((o: Record<string, unknown>) => normalizeOpp(o)));
    } catch (err) {
      console.error('[BlogOpps] Load error:', err);
    }
    setLoading(false);
  }, [siteUrl, projectId]);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  const generateOpportunities = async () => {
    setGenerating(true);
    setError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 100000);
    try {
      const objectives = localStorage.getItem('site_objectives') || localStorage.getItem(`kt_objectives_${projectId}`) || '';
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.opportunities, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          projectId,
          objectives,
          existingKeywords: [],
          existingTopics: opportunities.map((o) => o.title),
        }),
        signal: controller.signal,
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || `Server error (${resp.status})`);
      } else if (data.opportunities && data.opportunities.length > 0) {
        const normalized = data.opportunities.map((o: Record<string, unknown>) => normalizeOpp(o));
        setOpportunities((prev) => [...normalized, ...prev]);
        if (data.batchId) {
          setExpandedBatch(data.batchId);
        }
        if (data.warning) {
          console.warn('[BlogOpps]', data.warning);
        }
        logActivity(siteUrl, 'blog', 'opportunities', 'Generated blog topic opportunities');
      } else {
        setError('No topics were generated. Please try again.');
      }
    } catch (err) {
      console.error('Failed to generate opportunities:', err);
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Request timed out. The server took too long to respond. Please try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to connect to server. Please check your connection and try again.');
      }
    } finally {
      clearTimeout(timeout);
    }
    setGenerating(false);
  };

  const generateBlogPost = async (opp: Opportunity) => {
    if (!opp.id) return;
    setGeneratingBlog(opp.id);
    setBlogError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    try {
      const objectives = localStorage.getItem('site_objectives') || localStorage.getItem(`kt_objectives_${projectId}`) || '';
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.generate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          projectId,
          title: opp.title,
          targetKeyword: opp.targetKeyword,
          relatedKeywords: opp.relatedKeywords,
          description: opp.description,
          objectives,
          opportunityId: opp.id,
          source: 'idea',
        }),
        signal: controller.signal,
      });
      const data = await resp.json();
      if (data.error) {
        setBlogError(data.error);
      } else if (data.blog) {
        setOpportunities((prev) =>
          prev.map((o) =>
            o.id === opp.id ? { ...o, status: 'completed', generated_blog: data.blog } : o
          )
        );
        logActivity(siteUrl, 'blog', 'post-generated', `Generated blog post: ${opp.title}`);
      } else {
        setBlogError('No article was returned. Please try again.');
      }
    } catch (err) {
      console.error('Failed to generate blog:', err);
      if (err instanceof DOMException && err.name === 'AbortError') {
        setBlogError('Article generation timed out. Please try again.');
      } else {
        setBlogError(err instanceof Error ? err.message : 'Failed to generate article.');
      }
    } finally {
      clearTimeout(timeout);
    }
    setGeneratingBlog(null);
  };

  const deleteBatch = async (batch: Batch) => {
    if (!confirm(`Delete this batch of ${batch.opportunities.length} ideas?`)) return;
    const ids = batch.opportunities.filter((o) => o.id).map((o) => o.id!);
    try {
      if (batch.batchId && !batch.batchId.startsWith('legacy_')) {
        await authenticatedFetch(API_ENDPOINTS.db.blogOpportunities, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchId: batch.batchId, projectId }),
        });
      } else {
        for (const id of ids) {
          await authenticatedFetch(API_ENDPOINTS.db.blogOpportunities, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, projectId }),
          });
        }
      }
    } catch { /* best effort */ }
    setOpportunities((prev) => prev.filter((o) => !ids.includes(o.id!)));
    if (expandedBatch === batch.batchId) setExpandedBatch(null);
  };

  const getVolumeColor = (v: string) => {
    if (v === 'high') return 'bg-green-100 text-green-700';
    if (v === 'medium') return 'bg-amber-100 text-amber-700';
    return 'bg-gray-100 text-gray-600';
  };
  const getDifficultyColor = (d: string) => {
    if (d === 'easy') return 'bg-green-100 text-green-700';
    if (d === 'medium') return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };
  const getFunnelColor = (f: string) => {
    if (f === 'awareness') return 'bg-blue-100 text-blue-700';
    if (f === 'consideration') return 'bg-purple-100 text-purple-700';
    return 'bg-green-100 text-green-700';
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-apple-text">Blog Ideas</h1>
          <p className="text-apple-sm text-apple-text-secondary mt-1">
            AI-generated blog topic ideas targeted at keywords that drive traffic and support your business goals.
          </p>
        </div>
        <button
          onClick={generateOpportunities}
          disabled={generating}
          className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
        >
          {generating ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating...
            </span>
          ) : (
            'Generate Topics'
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-apple p-4">
          <p className="text-apple-sm text-red-800 font-medium">Failed to generate topics</p>
          <p className="text-apple-xs text-red-600 mt-1">{error}</p>
        </div>
      )}

      {blogError && (
        <div className="bg-red-50 border border-red-200 rounded-apple p-4 flex items-center justify-between">
          <div>
            <p className="text-apple-sm text-red-800 font-medium">Article generation failed</p>
            <p className="text-apple-xs text-red-600 mt-1">{blogError}</p>
          </div>
          <button onClick={() => setBlogError(null)} className="text-red-400 hover:text-red-600 shrink-0 ml-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-apple-text-secondary text-apple-sm justify-center">
          <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
          Loading ideas...
        </div>
      ) : batches.length === 0 ? (
        <div className="bg-white rounded-apple border border-apple-border p-8 text-center">
          <p className="text-apple-text-secondary text-apple-sm">
            No blog ideas yet. Click &quot;Generate Topics&quot; to get AI-powered topic suggestions.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => {
            const isExp = expandedBatch === batch.batchId;
            const articlesGenerated = batch.opportunities.filter((o) => o.generated_blog).length;
            const totalIdeas = batch.opportunities.length;
            const dateStr = batch.createdAt
              ? new Date(batch.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
              : 'Unknown date';

            return (
              <div key={batch.batchId} className="rounded-apple border border-apple-divider bg-white overflow-hidden shadow-sm">
                {/* Batch Card Header */}
                <div
                  className="p-4 flex items-center gap-3 cursor-pointer hover:bg-apple-fill-secondary/30 transition-colors"
                  onClick={() => setExpandedBatch(isExp ? null : batch.batchId)}
                >
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-apple-sm font-medium text-apple-text">
                      {totalIdeas} idea{totalIdeas !== 1 ? 's' : ''} generated
                    </p>
                    <p className="text-apple-xs text-apple-text-tertiary">
                      {dateStr}
                      {articlesGenerated > 0 && (
                        <span className="ml-2 text-green-600">
                          · {articlesGenerated} article{articlesGenerated !== 1 ? 's' : ''} created
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteBatch(batch); }}
                      className="p-1.5 rounded-apple-sm text-apple-text-tertiary hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete batch"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                    <svg className={`w-4 h-4 text-apple-text-tertiary transition-transform ${isExp ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded: Ideas List */}
                {isExp && (
                  <div className="border-t border-apple-divider bg-apple-fill-secondary/20 p-4 space-y-3">
                    {batch.opportunities.map((opp, idx) => {
                      const oppKey = opp.id || `${batch.batchId}-${idx}`;
                      return (
                        <OpportunityCard
                          key={oppKey}
                          opp={opp}
                          expanded={expandedId === oppKey}
                          onToggle={() => setExpandedId(expandedId === oppKey ? null : oppKey)}
                          onGenerate={() => generateBlogPost(opp)}
                          generatingBlog={generatingBlog === opp.id}
                          getVolumeColor={getVolumeColor}
                          getDifficultyColor={getDifficultyColor}
                          getFunnelColor={getFunnelColor}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OpportunityCard({
  opp, expanded, onToggle, onGenerate, generatingBlog,
  getVolumeColor, getDifficultyColor, getFunnelColor,
}: {
  opp: Opportunity;
  expanded: boolean;
  onToggle: () => void;
  onGenerate: () => void;
  generatingBlog: boolean;
  getVolumeColor: (v: string) => string;
  getDifficultyColor: (d: string) => string;
  getFunnelColor: (f: string) => string;
}) {
  return (
    <div className="bg-white rounded-apple border border-apple-border">
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-3 text-left hover:bg-apple-fill-secondary transition-colors">
        <div className="flex-1 min-w-0">
          <span className="text-apple-sm font-medium text-apple-text">{opp.title}</span>
          <div className="flex gap-2 mt-1 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${getVolumeColor(opp.searchVolume)}`}>
              {opp.searchVolume} vol
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${getDifficultyColor(opp.difficulty)}`}>
              {opp.difficulty}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${getFunnelColor(opp.funnelStage)}`}>
              {opp.funnelStage}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
              {opp.contentType}
            </span>
            {opp.generated_blog && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                Article Created
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {opp.estimatedMonthlySearches > 0 && (
            <span className="text-apple-xs text-apple-text-tertiary">
              ~{opp.estimatedMonthlySearches.toLocaleString()}/mo
            </span>
          )}
          <svg className={`w-4 h-4 transition-transform text-apple-text-tertiary ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-apple-divider p-4 space-y-3">
          <div>
            <span className="text-apple-xs font-semibold text-apple-text-secondary">Target Keyword: </span>
            <span className="text-apple-sm text-apple-text">{opp.targetKeyword}</span>
          </div>
          {opp.relatedKeywords.length > 0 && (
            <div>
              <span className="text-apple-xs font-semibold text-apple-text-secondary">Related Keywords: </span>
              <span className="text-apple-sm text-apple-text">{opp.relatedKeywords.join(', ')}</span>
            </div>
          )}
          <p className="text-apple-sm text-apple-text-secondary">{opp.description}</p>

          <div className="flex gap-2 pt-1">
            {opp.generated_blog ? (
              <span className="px-3 py-1.5 rounded-apple-sm bg-green-50 text-green-700 text-apple-xs font-medium border border-green-200">
                Article Generated — View in Completed
              </span>
            ) : (
              <button
                onClick={onGenerate}
                disabled={generatingBlog || !opp.id}
                className="px-3 py-1.5 rounded-apple-sm bg-apple-blue text-white text-apple-xs font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
              >
                {generatingBlog ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating Article...
                  </span>
                ) : (
                  'Generate Article'
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
