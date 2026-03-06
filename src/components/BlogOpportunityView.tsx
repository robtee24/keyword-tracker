import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { authenticatedFetch } from '../services/authService';
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
  articleId?: string;
}

interface Article {
  id: string;
  project_id: string;
  site_url: string;
  opportunity_id: string | null;
  title: string;
  slug: string;
  meta_description: string;
  content: string;
  previous_content: string | null;
  images: Array<{ description: string; imageUrl: string | null }>;
  word_count: number;
  internal_link_suggestions: string[];
  suggested_images: string[];
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
}

interface BlogOpportunityViewProps {
  siteUrl: string;
  projectId: string;
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

export default function BlogOpportunityView({ siteUrl, projectId }: BlogOpportunityViewProps) {
  const [tab, setTab] = useState<'ideas' | 'completed'>('ideas');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingBlog, setGeneratingBlog] = useState<string | null>(null);
  const [generatingImages, setGeneratingImages] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const [modifyingArticle, setModifyingArticle] = useState<string | null>(null);
  const [modifyPrompt, setModifyPrompt] = useState('');
  const [applyingModify, setApplyingModify] = useState(false);

  const loadOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await authenticatedFetch(`${API_ENDPOINTS.db.blogOpportunities}?siteUrl=${encodeURIComponent(siteUrl)}&projectId=${projectId}`);
      const data = await resp.json();
      setOpportunities((data.opportunities || []).map((o: Record<string, unknown>) => normalizeOpp(o)));
    } catch { /* ignore */ }
    setLoading(false);
  }, [siteUrl, projectId]);

  const loadArticles = useCallback(async () => {
    setArticlesLoading(true);
    try {
      const resp = await authenticatedFetch(`${API_ENDPOINTS.db.blogArticles}?projectId=${projectId}`);
      const data = await resp.json();
      setArticles(data.articles || []);
    } catch { /* ignore */ }
    setArticlesLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadOpportunities();
    loadArticles();
  }, [loadOpportunities, loadArticles]);

  const generateOpportunities = async () => {
    setGenerating(true);
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
      });
      const data = await resp.json();
      if (data.opportunities) {
        await loadOpportunities();
      }
      logActivity(siteUrl, 'blog', 'opportunities', 'Generated blog topic opportunities');
    } catch (err) {
      console.error('Failed to generate opportunities:', err);
    }
    setGenerating(false);
  };

  const generateBlogPost = async (opp: Opportunity) => {
    if (!opp.id) return;
    setGeneratingBlog(opp.id);
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
      });
      const data = await resp.json();
      if (data.blog) {
        setOpportunities((prev) =>
          prev.map((o) =>
            o.id === opp.id ? { ...o, status: 'completed', generated_blog: data.blog } : o
          )
        );
        await loadArticles();

        if (data.blog.articleId && data.blog.suggestedImages?.length > 0) {
          autoGenerateImages(data.blog.articleId, data.blog.suggestedImages);
        }
        logActivity(siteUrl, 'blog', 'post-generated', `Generated blog post: ${opp.title}`);
      }
    } catch (err) {
      console.error('Failed to generate blog:', err);
    }
    setGeneratingBlog(null);
  };

  const autoGenerateImages = async (articleId: string, descriptions: string[]) => {
    setGeneratingImages(articleId);
    try {
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.generateImages, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptions }),
      });
      const data = await resp.json();
      if (data.images) {
        await authenticatedFetch(API_ENDPOINTS.db.blogArticles, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: articleId, images: data.images }),
        });
        await loadArticles();
      }
    } catch (err) {
      console.error('Failed to generate images:', err);
    }
    setGeneratingImages(null);
  };

  const markComplete = async (opp: Opportunity) => {
    if (!opp.id) return;
    const newStatus = opp.status === 'completed' ? 'pending' : 'completed';
    try {
      await authenticatedFetch(API_ENDPOINTS.db.blogOpportunities, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: opp.id, projectId, status: newStatus }),
      });
      setOpportunities((prev) =>
        prev.map((o) => (o.id === opp.id ? { ...o, status: newStatus } : o))
      );
      logActivity(siteUrl, 'blog', 'topic-status', `Marked blog topic "${opp.title}" as ${newStatus}`);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const deleteArticle = async (id: string) => {
    try {
      await authenticatedFetch(API_ENDPOINTS.db.blogArticles, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setArticles((prev) => prev.filter((a) => a.id !== id));
      logActivity(siteUrl, 'blog', 'article-deleted', 'Deleted blog article');
    } catch (err) {
      console.error('Failed to delete article:', err);
    }
  };

  const modifyArticle = async (article: Article) => {
    if (!modifyPrompt.trim()) return;
    setApplyingModify(true);
    try {
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.modify, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: article.id,
          currentContent: article.content,
          currentTitle: article.title,
          modifyPrompt: modifyPrompt.trim(),
        }),
      });
      const data = await resp.json();
      if (data.article) {
        setArticles((prev) => prev.map((a) => (a.id === article.id ? data.article : a)));
        setModifyingArticle(null);
        setModifyPrompt('');
        logActivity(siteUrl, 'blog', 'article-modified', `Modified article: ${article.title}`);
      }
    } catch (err) {
      console.error('Failed to modify article:', err);
    }
    setApplyingModify(false);
  };

  const revertArticle = async (article: Article) => {
    if (!article.previous_content) return;
    try {
      await authenticatedFetch(API_ENDPOINTS.db.blogArticles, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: article.id,
          content: article.previous_content,
          previous_content: null,
        }),
      });
      setArticles((prev) =>
        prev.map((a) =>
          a.id === article.id
            ? { ...a, content: a.previous_content!, previous_content: null }
            : a
        )
      );
    } catch (err) {
      console.error('Failed to revert article:', err);
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

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-apple-text">Blog Ideas</h1>
          <p className="text-apple-sm text-apple-text-secondary mt-1">
            AI-generated blog topic ideas and completed articles.
          </p>
        </div>
        {tab === 'ideas' && (
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
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-apple-fill-secondary rounded-apple-sm p-1">
        <button
          onClick={() => setTab('ideas')}
          className={`flex-1 px-4 py-2 rounded-apple-sm text-apple-sm font-medium transition-colors ${
            tab === 'ideas' ? 'bg-white text-apple-text shadow-sm' : 'text-apple-text-secondary hover:text-apple-text'
          }`}
        >
          Ideas {pendingOpps.length > 0 && `(${pendingOpps.length})`}
        </button>
        <button
          onClick={() => setTab('completed')}
          className={`flex-1 px-4 py-2 rounded-apple-sm text-apple-sm font-medium transition-colors ${
            tab === 'completed' ? 'bg-white text-apple-text shadow-sm' : 'text-apple-text-secondary hover:text-apple-text'
          }`}
        >
          Completed {articles.length > 0 && `(${articles.length})`}
        </button>
      </div>

      {/* Ideas Tab */}
      {tab === 'ideas' && (
        <>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-apple-text-secondary text-apple-sm justify-center">
              <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
              Loading opportunities...
            </div>
          ) : pendingOpps.length === 0 ? (
            <div className="bg-white rounded-apple border border-apple-border p-8 text-center">
              <p className="text-apple-text-secondary text-apple-sm">
                No pending blog ideas. Click &quot;Generate Topics&quot; to get AI-powered topic suggestions.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingOpps.map((opp, i) => (
                <OpportunityCard
                  key={opp.id || i}
                  opp={opp}
                  expanded={expandedId === (opp.id || `${i}`)}
                  onToggle={() => setExpandedId(expandedId === (opp.id || `${i}`) ? null : (opp.id || `${i}`))}
                  onGenerate={() => generateBlogPost(opp)}
                  onMarkComplete={() => markComplete(opp)}
                  generatingBlog={generatingBlog === opp.id}
                  getVolumeColor={getVolumeColor}
                  getDifficultyColor={getDifficultyColor}
                  getFunnelColor={getFunnelColor}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Completed Tab */}
      {tab === 'completed' && (
        <>
          {articlesLoading ? (
            <div className="flex items-center gap-2 py-8 text-apple-text-secondary text-apple-sm justify-center">
              <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
              Loading articles...
            </div>
          ) : articles.length === 0 ? (
            <div className="bg-white rounded-apple border border-apple-border p-8 text-center">
              <p className="text-apple-text-secondary text-apple-sm">
                No articles generated yet. Go to the Ideas tab and generate a blog post from a topic.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {articles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  expanded={expandedArticle === article.id}
                  onToggle={() => setExpandedArticle(expandedArticle === article.id ? null : article.id)}
                  onDelete={() => deleteArticle(article.id)}
                  isModifying={modifyingArticle === article.id}
                  onToggleModify={() => {
                    setModifyingArticle(modifyingArticle === article.id ? null : article.id);
                    setModifyPrompt('');
                  }}
                  modifyPrompt={modifyPrompt}
                  onModifyPromptChange={setModifyPrompt}
                  onApplyModify={() => modifyArticle(article)}
                  applyingModify={applyingModify}
                  onRevert={() => revertArticle(article)}
                  generatingImages={generatingImages === article.id}
                  onGenerateImages={() => autoGenerateImages(article.id, article.suggested_images || [])}
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
  opp, expanded, onToggle, onGenerate, onMarkComplete, generatingBlog,
  getVolumeColor, getDifficultyColor, getFunnelColor,
}: {
  opp: Opportunity;
  expanded: boolean;
  onToggle: () => void;
  onGenerate: () => void;
  onMarkComplete: () => void;
  generatingBlog: boolean;
  getVolumeColor: (v: string) => string;
  getDifficultyColor: (d: string) => string;
  getFunnelColor: (f: string) => string;
}) {
  return (
    <div className="bg-white rounded-apple border border-apple-border">
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-4 text-left hover:bg-apple-fill-secondary transition-colors">
        <input
          type="checkbox"
          checked={opp.status === 'completed'}
          onChange={(e) => { e.stopPropagation(); onMarkComplete(); }}
          className="w-4 h-4 rounded border-apple-border text-apple-blue shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
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
                Article Generated
              </span>
            ) : (
              <button
                onClick={onGenerate}
                disabled={generatingBlog}
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

function ArticleCard({
  article, expanded, onToggle, onDelete,
  isModifying, onToggleModify, modifyPrompt, onModifyPromptChange, onApplyModify, applyingModify,
  onRevert, generatingImages, onGenerateImages,
}: {
  article: Article;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  isModifying: boolean;
  onToggleModify: () => void;
  modifyPrompt: string;
  onModifyPromptChange: (v: string) => void;
  onApplyModify: () => void;
  applyingModify: boolean;
  onRevert: () => void;
  generatingImages: boolean;
  onGenerateImages: () => void;
}) {
  const sourceLabel = article.source === 'idea' ? 'From Idea' : article.source === 'series' ? 'Series' : 'Manual';
  const hasImages = article.images && article.images.length > 0 && article.images.some((img) => img.imageUrl);

  return (
    <div className="bg-white rounded-apple border border-apple-border">
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-4 text-left hover:bg-apple-fill-secondary transition-colors">
        <div className="w-8 h-8 rounded-apple-sm bg-green-50 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-apple-sm font-medium text-apple-text">{article.title}</span>
          <div className="flex gap-2 mt-1 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{sourceLabel}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{article.word_count} words</span>
            {hasImages && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">
                {article.images.filter((img) => img.imageUrl).length} images
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-apple-xs text-apple-text-tertiary">
            {new Date(article.created_at).toLocaleDateString()}
          </span>
          <svg className={`w-4 h-4 transition-transform text-apple-text-tertiary ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-apple-divider p-4 space-y-4">
          {/* Article metadata */}
          <div className="flex flex-wrap gap-4 text-apple-xs text-apple-text-secondary">
            {article.slug && <span>/{article.slug}</span>}
            {article.meta_description && <span className="italic">{article.meta_description}</span>}
          </div>

          {/* Images */}
          {hasImages && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {article.images.filter((img) => img.imageUrl).map((img, i) => (
                <div key={i} className="rounded-apple-sm overflow-hidden border border-apple-border">
                  <img src={img.imageUrl!} alt={img.description} className="w-full h-32 object-cover" />
                  <p className="text-[10px] text-apple-text-tertiary p-1.5 line-clamp-2">{img.description}</p>
                </div>
              ))}
            </div>
          )}

          {!hasImages && article.suggested_images && article.suggested_images.length > 0 && (
            <div className="bg-amber-50/50 rounded-apple-sm border border-amber-100 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-apple-xs font-medium text-amber-800">
                  {article.suggested_images.length} images suggested
                </span>
                <button
                  onClick={onGenerateImages}
                  disabled={generatingImages}
                  className="px-3 py-1 rounded-apple-sm bg-amber-600 text-white text-apple-xs font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {generatingImages ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating...
                    </span>
                  ) : (
                    'Generate Images'
                  )}
                </button>
              </div>
              <ul className="text-[10px] text-amber-700 space-y-0.5">
                {article.suggested_images.map((desc, i) => (
                  <li key={i}>• {desc}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Article content */}
          <div className="prose prose-sm max-w-none text-apple-sm text-apple-text whitespace-pre-wrap bg-apple-fill-secondary rounded-apple-sm p-4">
            {article.content}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={onToggleModify}
              className={`px-3 py-1.5 rounded-apple-sm text-apple-xs font-medium transition-colors ${
                isModifying
                  ? 'bg-gray-200 text-gray-700'
                  : 'border border-apple-blue text-apple-blue hover:bg-apple-blue/5'
              }`}
            >
              {isModifying ? 'Cancel' : 'Modify'}
            </button>
            {article.previous_content && (
              <button
                onClick={onRevert}
                className="px-3 py-1.5 rounded-apple-sm border border-amber-500 text-amber-600 text-apple-xs font-medium hover:bg-amber-50 transition-colors"
              >
                Revert
              </button>
            )}
            <button
              onClick={() => {
                navigator.clipboard.writeText(article.content);
              }}
              className="px-3 py-1.5 rounded-apple-sm border border-apple-border text-apple-text-secondary text-apple-xs font-medium hover:bg-apple-fill-secondary transition-colors"
            >
              Copy
            </button>
            <div className="flex-1" />
            <button
              onClick={onDelete}
              className="px-3 py-1.5 rounded-apple-sm text-apple-red text-apple-xs font-medium hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          </div>

          {/* Modify prompt */}
          {isModifying && (
            <div className="bg-blue-50/50 rounded-apple-sm border border-blue-100 p-4 space-y-3">
              <label className="block text-apple-xs font-semibold text-blue-800">
                Describe what you want changed
              </label>
              <textarea
                value={modifyPrompt}
                onChange={(e) => onModifyPromptChange(e.target.value)}
                placeholder="e.g., Make the introduction more engaging, add a section about pricing, shorten the conclusion..."
                className="input w-full text-apple-sm min-h-[80px] resize-y"
              />
              <button
                onClick={onApplyModify}
                disabled={applyingModify || !modifyPrompt.trim()}
                className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-xs font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
              >
                {applyingModify ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Applying Changes...
                  </span>
                ) : (
                  'Apply Changes'
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
