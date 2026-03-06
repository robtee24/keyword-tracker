import { useState, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { authenticatedFetch } from '../services/authService';
import { logActivity } from '../utils/activityLog';

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
  const [mode, setMode] = useState<'single' | 'series'>('single');

  // Single article state
  const [inputMethod, setInputMethod] = useState<'describe' | 'keywords'>('describe');
  const [articleDescription, setArticleDescription] = useState('');
  const [keywords, setKeywords] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [generatingArticle, setGeneratingArticle] = useState(false);
  const [lastGeneratedTitle, setLastGeneratedTitle] = useState<string | null>(null);

  // Series state
  const [seriesTheme, setSeriesTheme] = useState('');
  const [seriesCount, setSeriesCount] = useState(5);
  const [seriesTopics, setSeriesTopics] = useState<SeriesTopic[]>([]);
  const [generatingTopics, setGeneratingTopics] = useState(false);
  const [generatingSeriesArticle, setGeneratingSeriesArticle] = useState<string | null>(null);

  const autoGenerateImages = useCallback(async (articleId: string, descriptions: string[]) => {
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
      }
    } catch (err) {
      console.error('Failed to generate images:', err);
    }
  }, []);

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
        setLastGeneratedTitle(data.blog.title || title);
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

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-apple-text">Blog Writer</h1>
        <p className="text-apple-sm text-apple-text-secondary mt-1">
          Write individual articles or create a series. All generated articles appear in the Completed section.
        </p>
      </div>

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

          {lastGeneratedTitle && (
            <div className="bg-green-50/50 rounded-apple-sm border border-green-200 p-3">
              <p className="text-apple-sm text-green-800 font-medium">
                Article generated: &quot;{lastGeneratedTitle}&quot;
              </p>
              <p className="text-apple-xs text-green-600 mt-1">
                View it in Content &rarr; Completed.
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
  );
}
