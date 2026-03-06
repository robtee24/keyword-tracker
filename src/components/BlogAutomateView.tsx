import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { authenticatedFetch } from '../services/authService';
import { logActivity } from '../utils/activityLog';

interface Article {
  id: string;
  title: string;
  slug: string;
  meta_description: string;
  content: string;
  previous_content: string | null;
  images: Array<{ description: string; imageUrl: string | null }>;
  word_count: number;
  suggested_images: string[];
  source: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface SeriesTopic {
  id: string;
  title: string;
  description: string;
  generated: boolean;
}

interface BlogAutomateViewProps {
  siteUrl: string;
  projectId: string;
}

export default function BlogAutomateView({ siteUrl, projectId }: BlogAutomateViewProps) {
  const [tab, setTab] = useState<'write' | 'completed'>('write');
  const [mode, setMode] = useState<'single' | 'series'>('single');

  // Single article state
  const [inputMethod, setInputMethod] = useState<'describe' | 'keywords'>('describe');
  const [articleDescription, setArticleDescription] = useState('');
  const [keywords, setKeywords] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [generatingArticle, setGeneratingArticle] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<Article | null>(null);

  // Series state
  const [seriesTheme, setSeriesTheme] = useState('');
  const [seriesCount, setSeriesCount] = useState(5);
  const [seriesTopics, setSeriesTopics] = useState<SeriesTopic[]>([]);
  const [generatingTopics, setGeneratingTopics] = useState(false);
  const [generatingSeriesArticle, setGeneratingSeriesArticle] = useState<string | null>(null);

  // Completed articles
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const [modifyingArticle, setModifyingArticle] = useState<string | null>(null);
  const [modifyPrompt, setModifyPrompt] = useState('');
  const [applyingModify, setApplyingModify] = useState(false);
  const [generatingImages, setGeneratingImages] = useState<string | null>(null);

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
    loadArticles();
  }, [loadArticles]);

  const generatePromptFromKeywords = async () => {
    if (!keywords.trim()) return;
    setGeneratingPrompt(true);
    try {
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.generateBrief, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, keywords: keywords.trim() }),
      });
      const data = await resp.json();
      setGeneratedPrompt(data.brief || '');
    } catch (err) {
      console.error('Failed to generate prompt:', err);
    }
    setGeneratingPrompt(false);
  };

  const generateSingleArticle = async () => {
    const title = inputMethod === 'describe' ? articleDescription.trim() : generatedPrompt.trim();
    if (!title) return;
    setGeneratingArticle(true);
    try {
      const objectives = localStorage.getItem('site_objectives') || localStorage.getItem(`kt_objectives_${projectId}`) || '';
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.generate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          projectId,
          title,
          targetKeyword: inputMethod === 'keywords' ? keywords.trim() : '',
          description: title,
          objectives,
          source: 'writer',
        }),
      });
      const data = await resp.json();
      if (data.blog) {
        await loadArticles();
        const newArticle = articles.find((a) => a.id === data.blog.articleId) || null;
        if (newArticle) setLastGenerated(newArticle);

        if (data.blog.articleId && data.blog.suggestedImages?.length > 0) {
          autoGenerateImages(data.blog.articleId, data.blog.suggestedImages);
        }
        logActivity(siteUrl, 'blog', 'article-written', `Wrote blog article: ${data.blog.title}`);
      }
    } catch (err) {
      console.error('Failed to generate article:', err);
    }
    setGeneratingArticle(false);
  };

  const generateSeriesTopics = async () => {
    if (!seriesTheme.trim()) return;
    setGeneratingTopics(true);
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
          existingTopics: [],
          seriesTheme: seriesTheme.trim(),
          count: seriesCount,
        }),
      });
      const data = await resp.json();
      if (data.opportunities) {
        setSeriesTopics(
          data.opportunities.map((o: Record<string, string>, i: number) => ({
            id: o.id || `topic-${i}`,
            title: o.title,
            description: o.description || '',
            generated: false,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to generate series topics:', err);
    }
    setGeneratingTopics(false);
  };

  const removeTopic = (id: string) => {
    setSeriesTopics((prev) => prev.filter((t) => t.id !== id));
  };

  const generateSeriesArticle = async (topic: SeriesTopic) => {
    setGeneratingSeriesArticle(topic.id);
    try {
      const objectives = localStorage.getItem('site_objectives') || localStorage.getItem(`kt_objectives_${projectId}`) || '';
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.generate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          projectId,
          title: topic.title,
          description: topic.description,
          objectives,
          source: 'series',
        }),
      });
      const data = await resp.json();
      if (data.blog) {
        setSeriesTopics((prev) =>
          prev.map((t) => (t.id === topic.id ? { ...t, generated: true } : t))
        );
        await loadArticles();

        if (data.blog.articleId && data.blog.suggestedImages?.length > 0) {
          autoGenerateImages(data.blog.articleId, data.blog.suggestedImages);
        }
        logActivity(siteUrl, 'blog', 'series-article', `Generated series article: ${topic.title}`);
      }
    } catch (err) {
      console.error('Failed to generate series article:', err);
    }
    setGeneratingSeriesArticle(null);
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

  const deleteArticle = async (id: string) => {
    try {
      await authenticatedFetch(API_ENDPOINTS.db.blogArticles, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setArticles((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('Failed to delete article:', err);
    }
  };

  const modifyArticleAction = async (article: Article) => {
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
        body: JSON.stringify({ id: article.id, content: article.previous_content, previous_content: null }),
      });
      setArticles((prev) =>
        prev.map((a) =>
          a.id === article.id ? { ...a, content: a.previous_content!, previous_content: null } : a
        )
      );
    } catch (err) {
      console.error('Failed to revert article:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-apple-text">Blog Writer</h1>
        <p className="text-apple-sm text-apple-text-secondary mt-1">
          Write individual articles or create a series. All generated articles are saved in the Completed tab.
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-apple-fill-secondary rounded-apple-sm p-1">
        <button
          onClick={() => setTab('write')}
          className={`flex-1 px-4 py-2 rounded-apple-sm text-apple-sm font-medium transition-colors ${
            tab === 'write' ? 'bg-white text-apple-text shadow-sm' : 'text-apple-text-secondary hover:text-apple-text'
          }`}
        >
          Write
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

      {/* Write Tab */}
      {tab === 'write' && (
        <div className="space-y-6">
          {/* Mode Toggle */}
          <div className="flex gap-1 bg-apple-fill-secondary rounded-apple-sm p-1 max-w-xs">
            <button
              onClick={() => setMode('single')}
              className={`flex-1 px-3 py-1.5 rounded-apple-sm text-apple-xs font-medium transition-colors ${
                mode === 'single' ? 'bg-white text-apple-text shadow-sm' : 'text-apple-text-secondary hover:text-apple-text'
              }`}
            >
              Single Article
            </button>
            <button
              onClick={() => setMode('series')}
              className={`flex-1 px-3 py-1.5 rounded-apple-sm text-apple-xs font-medium transition-colors ${
                mode === 'series' ? 'bg-white text-apple-text shadow-sm' : 'text-apple-text-secondary hover:text-apple-text'
              }`}
            >
              Series
            </button>
          </div>

          {/* Single Article Mode */}
          {mode === 'single' && (
            <div className="bg-white rounded-apple border border-apple-border p-5 space-y-4">
              <h2 className="text-base font-semibold text-apple-text">Write a Single Article</h2>

              {/* Input method toggle */}
              <div className="flex gap-3">
                <button
                  onClick={() => setInputMethod('describe')}
                  className={`px-3 py-1.5 rounded-apple-sm text-apple-xs font-medium border transition-colors ${
                    inputMethod === 'describe'
                      ? 'border-apple-blue bg-apple-blue/5 text-apple-blue'
                      : 'border-apple-border text-apple-text-secondary hover:border-apple-text-tertiary'
                  }`}
                >
                  Describe Article
                </button>
                <button
                  onClick={() => setInputMethod('keywords')}
                  className={`px-3 py-1.5 rounded-apple-sm text-apple-xs font-medium border transition-colors ${
                    inputMethod === 'keywords'
                      ? 'border-apple-blue bg-apple-blue/5 text-apple-blue'
                      : 'border-apple-border text-apple-text-secondary hover:border-apple-text-tertiary'
                  }`}
                >
                  From Keywords
                </button>
              </div>

              {inputMethod === 'describe' ? (
                <div className="space-y-3">
                  <textarea
                    value={articleDescription}
                    onChange={(e) => setArticleDescription(e.target.value)}
                    placeholder="Describe the article you want to write. Be as specific as possible — include the topic, angle, target audience, and any key points to cover."
                    className="input w-full text-apple-sm min-h-[120px] resize-y"
                  />
                  <button
                    onClick={generateSingleArticle}
                    disabled={generatingArticle || !articleDescription.trim()}
                    className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
                  >
                    {generatingArticle ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Generating Article...
                      </span>
                    ) : (
                      'Generate Article'
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1.5">
                      Target Keyword(s)
                    </label>
                    <input
                      type="text"
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      placeholder="e.g., best project management tools, agile workflow"
                      className="input w-full text-apple-sm"
                    />
                  </div>
                  <button
                    onClick={generatePromptFromKeywords}
                    disabled={generatingPrompt || !keywords.trim()}
                    className="px-4 py-2 rounded-apple-sm border border-apple-blue text-apple-blue text-apple-sm font-medium hover:bg-apple-blue/5 transition-colors disabled:opacity-50"
                  >
                    {generatingPrompt ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
                        Generating Brief...
                      </span>
                    ) : (
                      'Generate Article Brief'
                    )}
                  </button>
                  {generatedPrompt && (
                    <div className="space-y-3">
                      <label className="block text-apple-xs font-medium text-apple-text-secondary">
                        Article Brief (edit as needed)
                      </label>
                      <textarea
                        value={generatedPrompt}
                        onChange={(e) => setGeneratedPrompt(e.target.value)}
                        className="input w-full text-apple-sm min-h-[120px] resize-y"
                      />
                      <button
                        onClick={generateSingleArticle}
                        disabled={generatingArticle || !generatedPrompt.trim()}
                        className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
                      >
                        {generatingArticle ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Generating Article...
                          </span>
                        ) : (
                          'Generate Article'
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {lastGenerated && (
                <div className="bg-green-50/50 rounded-apple-sm border border-green-200 p-3">
                  <p className="text-apple-sm text-green-800 font-medium">
                    Article generated: &quot;{lastGenerated.title}&quot;
                  </p>
                  <p className="text-apple-xs text-green-600 mt-1">
                    View it in the Completed tab.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Series Mode */}
          {mode === 'series' && (
            <div className="space-y-4">
              <div className="bg-white rounded-apple border border-apple-border p-5 space-y-4">
                <h2 className="text-base font-semibold text-apple-text">Create a Blog Series</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1.5">
                      Series Theme / Topic
                    </label>
                    <input
                      type="text"
                      value={seriesTheme}
                      onChange={(e) => setSeriesTheme(e.target.value)}
                      placeholder="e.g., Complete guide to digital marketing for small businesses"
                      className="input w-full text-apple-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1.5">
                      Number of Articles
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={15}
                      value={seriesCount}
                      onChange={(e) => setSeriesCount(Math.max(2, Math.min(15, parseInt(e.target.value) || 5)))}
                      className="input w-full text-apple-sm"
                    />
                  </div>
                </div>
                <button
                  onClick={generateSeriesTopics}
                  disabled={generatingTopics || !seriesTheme.trim()}
                  className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
                >
                  {generatingTopics ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Planning Series...
                    </span>
                  ) : (
                    'Plan Series'
                  )}
                </button>
              </div>

              {seriesTopics.length > 0 && (
                <div className="bg-white rounded-apple border border-apple-border p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-apple-text">
                      Series Articles ({seriesTopics.length})
                    </h3>
                    <span className="text-apple-xs text-apple-text-tertiary">
                      {seriesTopics.filter((t) => t.generated).length} / {seriesTopics.length} completed
                    </span>
                  </div>

                  <div className="space-y-2">
                    {seriesTopics.map((topic, i) => (
                      <div
                        key={topic.id}
                        className={`flex items-center gap-3 p-3 rounded-apple-sm border ${
                          topic.generated ? 'border-green-200 bg-green-50/30' : 'border-apple-border'
                        }`}
                      >
                        <span className="text-apple-xs text-apple-text-tertiary font-mono w-6 text-center shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-apple-sm font-medium ${topic.generated ? 'text-green-700' : 'text-apple-text'}`}>
                            {topic.title}
                          </p>
                          {topic.description && (
                            <p className="text-apple-xs text-apple-text-tertiary mt-0.5 line-clamp-1">{topic.description}</p>
                          )}
                        </div>
                        {topic.generated ? (
                          <span className="text-apple-xs text-green-600 font-medium shrink-0">Done</span>
                        ) : (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => generateSeriesArticle(topic)}
                              disabled={generatingSeriesArticle === topic.id}
                              className="px-3 py-1 rounded-apple-sm bg-apple-blue text-white text-apple-xs font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
                            >
                              {generatingSeriesArticle === topic.id ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  Writing...
                                </span>
                              ) : (
                                'Generate'
                              )}
                            </button>
                            <button
                              onClick={() => removeTopic(topic.id)}
                              className="text-apple-text-tertiary hover:text-apple-red text-apple-xs"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
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
                No articles generated yet. Write a single article or create a series to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {articles.map((article) => {
                const sourceLabel = article.source === 'idea' ? 'From Idea' : article.source === 'series' ? 'Series' : 'Manual';
                const hasImages = article.images && article.images.length > 0 && article.images.some((img) => img.imageUrl);
                const isExpanded = expandedArticle === article.id;
                const isModifying = modifyingArticle === article.id;

                return (
                  <div key={article.id} className="bg-white rounded-apple border border-apple-border">
                    <button onClick={() => setExpandedArticle(isExpanded ? null : article.id)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-apple-fill-secondary transition-colors">
                      <div className="w-8 h-8 rounded-apple-sm bg-green-50 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-apple-sm font-medium text-apple-text">{article.title}</span>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{sourceLabel}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{article.word_count} words</span>
                          {hasImages && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">
                              {article.images.filter((img) => img.imageUrl).length} images
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-apple-xs text-apple-text-tertiary shrink-0">{new Date(article.created_at).toLocaleDateString()}</span>
                      <svg className={`w-4 h-4 transition-transform text-apple-text-tertiary ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-apple-divider p-4 space-y-4">
                        {article.meta_description && (
                          <p className="text-apple-xs text-apple-text-secondary italic">{article.meta_description}</p>
                        )}

                        {hasImages && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {article.images.filter((img) => img.imageUrl).map((img, i) => (
                              <div key={i} className="rounded-apple-sm overflow-hidden border border-apple-border">
                                <img src={img.imageUrl!} alt={img.description} className="w-full h-32 object-cover" />
                              </div>
                            ))}
                          </div>
                        )}

                        {!hasImages && article.suggested_images && article.suggested_images.length > 0 && (
                          <button
                            onClick={() => autoGenerateImages(article.id, article.suggested_images)}
                            disabled={generatingImages === article.id}
                            className="px-3 py-1.5 rounded-apple-sm bg-amber-600 text-white text-apple-xs font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                          >
                            {generatingImages === article.id ? 'Generating Images...' : `Generate ${article.suggested_images.length} Images`}
                          </button>
                        )}

                        <div className="prose prose-sm max-w-none text-apple-sm text-apple-text whitespace-pre-wrap bg-apple-fill-secondary rounded-apple-sm p-4">
                          {article.content}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => { setModifyingArticle(isModifying ? null : article.id); setModifyPrompt(''); }}
                            className={`px-3 py-1.5 rounded-apple-sm text-apple-xs font-medium transition-colors ${
                              isModifying ? 'bg-gray-200 text-gray-700' : 'border border-apple-blue text-apple-blue hover:bg-apple-blue/5'
                            }`}
                          >
                            {isModifying ? 'Cancel' : 'Modify'}
                          </button>
                          {article.previous_content && (
                            <button onClick={() => revertArticle(article)} className="px-3 py-1.5 rounded-apple-sm border border-amber-500 text-amber-600 text-apple-xs font-medium hover:bg-amber-50 transition-colors">
                              Revert
                            </button>
                          )}
                          <button onClick={() => navigator.clipboard.writeText(article.content)} className="px-3 py-1.5 rounded-apple-sm border border-apple-border text-apple-text-secondary text-apple-xs font-medium hover:bg-apple-fill-secondary transition-colors">
                            Copy
                          </button>
                          <div className="flex-1" />
                          <button onClick={() => deleteArticle(article.id)} className="px-3 py-1.5 rounded-apple-sm text-apple-red text-apple-xs font-medium hover:bg-red-50 transition-colors">
                            Delete
                          </button>
                        </div>

                        {isModifying && (
                          <div className="bg-blue-50/50 rounded-apple-sm border border-blue-100 p-4 space-y-3">
                            <label className="block text-apple-xs font-semibold text-blue-800">Describe what you want changed</label>
                            <textarea
                              value={modifyPrompt}
                              onChange={(e) => setModifyPrompt(e.target.value)}
                              placeholder="e.g., Make the introduction more engaging, add a section about pricing..."
                              className="input w-full text-apple-sm min-h-[80px] resize-y"
                            />
                            <button
                              onClick={() => modifyArticleAction(article)}
                              disabled={applyingModify || !modifyPrompt.trim()}
                              className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-xs font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
                            >
                              {applyingModify ? 'Applying Changes...' : 'Apply Changes'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
