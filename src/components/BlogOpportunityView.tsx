import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { logActivity } from '../utils/activityLog';

interface Opportunity {
  id?: string;
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
}

interface GeneratedBlog {
  title: string;
  metaDescription: string;
  slug: string;
  content: string;
  wordCount: number;
  suggestedImages: string[];
  internalLinkSuggestions: string[];
}

interface BlogOpportunityViewProps {
  siteUrl: string;
}

function normalizeOpp(raw: Record<string, unknown>): Opportunity {
  return {
    id: raw.id as string | undefined,
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
  };
}

export default function BlogOpportunityView({ siteUrl }: BlogOpportunityViewProps) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingBlog, setGeneratingBlog] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewingBlog, setViewingBlog] = useState<string | null>(null);

  const loadOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_ENDPOINTS.db.blogOpportunities}?siteUrl=${encodeURIComponent(siteUrl)}`);
      const data = await resp.json();
      setOpportunities((data.opportunities || []).map((o: Record<string, unknown>) => normalizeOpp(o)));
    } catch { /* ignore */ }
    setLoading(false);
  }, [siteUrl]);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  const generateOpportunities = async () => {
    setGenerating(true);
    try {
      const objectives = localStorage.getItem('site_objectives') || '';
      const resp = await fetch(API_ENDPOINTS.blog.opportunities, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          objectives,
          existingKeywords: [],
          existingTopics: opportunities.map((o) => o.title),
        }),
      });
      const data = await resp.json();
      if (data.opportunities) {
        await loadOpportunities();
      }
      logActivity(siteUrl, 'blog', 'opportunities', `Generated blog topic opportunities`);
    } catch (err) {
      console.error('Failed to generate opportunities:', err);
    }
    setGenerating(false);
  };

  const generateBlogPost = async (opp: Opportunity) => {
    if (!opp.id) return;
    setGeneratingBlog(opp.id);
    try {
      const objectives = localStorage.getItem('site_objectives') || '';
      const resp = await fetch(API_ENDPOINTS.blog.generate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          title: opp.title,
          targetKeyword: opp.targetKeyword,
          relatedKeywords: opp.relatedKeywords,
          description: opp.description,
          objectives,
          opportunityId: opp.id,
        }),
      });
      const data = await resp.json();
      if (data.blog) {
        setOpportunities((prev) =>
          prev.map((o) =>
            o.id === opp.id ? { ...o, status: 'completed', generated_blog: data.blog } : o
          )
        );
        logActivity(siteUrl, 'blog', 'post-generated', `Generated blog post: ${opp.title}`);
      }
    } catch (err) {
      console.error('Failed to generate blog:', err);
    }
    setGeneratingBlog(null);
  };

  const markComplete = async (opp: Opportunity) => {
    if (!opp.id) return;
    const newStatus = opp.status === 'completed' ? 'pending' : 'completed';
    try {
      await fetch(API_ENDPOINTS.db.blogOpportunities, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: opp.id, status: newStatus }),
      });
      setOpportunities((prev) =>
        prev.map((o) => (o.id === opp.id ? { ...o, status: newStatus } : o))
      );
      logActivity(siteUrl, 'blog', 'topic-status', `Marked blog topic "${opp.title}" as ${newStatus}`);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
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

  const pendingOpps = opportunities.filter((o) => o.status !== 'completed');
  const completedOpps = opportunities.filter((o) => o.status === 'completed');

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-apple-text">Blog Opportunities</h1>
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

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-apple-text-secondary text-apple-sm justify-center">
          <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
          Loading opportunities...
        </div>
      ) : opportunities.length === 0 ? (
        <div className="bg-white rounded-apple border border-apple-border p-8 text-center">
          <p className="text-apple-text-secondary text-apple-sm">
            No blog opportunities generated yet. Click "Generate Topics" to get AI-powered topic suggestions.
          </p>
        </div>
      ) : (
        <>
          {pendingOpps.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-apple-text">{pendingOpps.length} Pending Topics</h2>
              {pendingOpps.map((opp, i) => (
                <OpportunityCard
                  key={opp.id || i}
                  opp={opp}
                  expanded={expandedId === (opp.id || `${i}`)}
                  onToggle={() => setExpandedId(expandedId === (opp.id || `${i}`) ? null : (opp.id || `${i}`))}
                  onGenerate={() => generateBlogPost(opp)}
                  onMarkComplete={() => markComplete(opp)}
                  generatingBlog={generatingBlog === opp.id}
                  viewingBlog={viewingBlog === opp.id}
                  onViewBlog={() => setViewingBlog(viewingBlog === opp.id ? null : opp.id || null)}
                  getVolumeColor={getVolumeColor}
                  getDifficultyColor={getDifficultyColor}
                  getFunnelColor={getFunnelColor}
                />
              ))}
            </div>
          )}

          {completedOpps.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-apple-text">{completedOpps.length} Completed</h2>
              {completedOpps.map((opp, i) => (
                <OpportunityCard
                  key={opp.id || `c-${i}`}
                  opp={opp}
                  expanded={expandedId === (opp.id || `c-${i}`)}
                  onToggle={() => setExpandedId(expandedId === (opp.id || `c-${i}`) ? null : (opp.id || `c-${i}`))}
                  onGenerate={() => generateBlogPost(opp)}
                  onMarkComplete={() => markComplete(opp)}
                  generatingBlog={generatingBlog === opp.id}
                  viewingBlog={viewingBlog === opp.id}
                  onViewBlog={() => setViewingBlog(viewingBlog === opp.id ? null : opp.id || null)}
                  getVolumeColor={getVolumeColor}
                  getDifficultyColor={getDifficultyColor}
                  getFunnelColor={getFunnelColor}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OpportunityCard({
  opp, expanded, onToggle, onGenerate, onMarkComplete, generatingBlog, viewingBlog, onViewBlog,
  getVolumeColor, getDifficultyColor, getFunnelColor,
}: {
  opp: Opportunity;
  expanded: boolean;
  onToggle: () => void;
  onGenerate: () => void;
  onMarkComplete: () => void;
  generatingBlog: boolean;
  viewingBlog: boolean;
  onViewBlog: () => void;
  getVolumeColor: (v: string) => string;
  getDifficultyColor: (d: string) => string;
  getFunnelColor: (f: string) => string;
}) {
  return (
    <div className={`bg-white rounded-apple border ${opp.status === 'completed' ? 'border-green-200' : 'border-apple-border'}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-4 text-left hover:bg-apple-fill-secondary transition-colors">
        <input
          type="checkbox"
          checked={opp.status === 'completed'}
          onChange={(e) => { e.stopPropagation(); onMarkComplete(); }}
          className="w-4 h-4 rounded border-apple-border text-apple-blue shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex-1 min-w-0">
          <span className={`text-apple-sm font-medium ${opp.status === 'completed' ? 'line-through text-apple-text-tertiary' : 'text-apple-text'}`}>
            {opp.title}
          </span>
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
              <button
                onClick={onViewBlog}
                className="px-3 py-1.5 rounded-apple-sm border border-apple-blue text-apple-blue text-apple-xs font-medium hover:bg-apple-blue/5 transition-colors"
              >
                {viewingBlog ? 'Hide Blog' : 'View Generated Blog'}
              </button>
            ) : (
              <button
                onClick={onGenerate}
                disabled={generatingBlog}
                className="px-3 py-1.5 rounded-apple-sm bg-apple-blue text-white text-apple-xs font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
              >
                {generatingBlog ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </span>
                ) : (
                  'Generate Blog'
                )}
              </button>
            )}
          </div>

          {viewingBlog && opp.generated_blog && (
            <div className="mt-3 bg-apple-fill-secondary rounded-apple-sm p-4 space-y-3">
              <div>
                <h3 className="text-base font-semibold text-apple-text">{opp.generated_blog.title}</h3>
                <p className="text-apple-xs text-apple-text-tertiary mt-1">
                  {opp.generated_blog.wordCount} words &middot; /{opp.generated_blog.slug}
                </p>
                <p className="text-apple-xs text-apple-text-secondary mt-1 italic">{opp.generated_blog.metaDescription}</p>
              </div>
              <div className="prose prose-sm max-w-none text-apple-sm text-apple-text whitespace-pre-wrap">
                {opp.generated_blog.content}
              </div>
              {opp.generated_blog.suggestedImages?.length > 0 && (
                <div>
                  <h4 className="text-apple-xs font-semibold text-apple-text-secondary mb-1">Suggested Images</h4>
                  <ul className="text-apple-xs text-apple-text-secondary space-y-0.5">
                    {opp.generated_blog.suggestedImages.map((img, i) => (
                      <li key={i}>• {img}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
