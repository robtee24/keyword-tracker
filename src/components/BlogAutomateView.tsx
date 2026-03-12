import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { authenticatedFetch } from '../services/authService';
import { logActivity } from '../utils/activityLog';
import { useBackgroundTasks } from '../contexts/BackgroundTaskContext';
import { parseJsonOrThrow } from '../utils/apiResponse';
import { getModelPreferences } from '../config/models';

interface QueueItem {
  id: string;
  title: string;
  description: string;
  targetKeyword: string;
  generated: boolean;
  fromQueue: boolean;
}

interface BlogAutomateViewProps {
  siteUrl: string;
  projectId: string;
}

export default function BlogAutomateView({ siteUrl, projectId }: BlogAutomateViewProps) {
  const [mode, setMode] = useState<'single' | 'series'>('single');

  const [inputMethod, setInputMethod] = useState<'describe' | 'keywords'>('describe');
  const [articleDescription, setArticleDescription] = useState('');
  const [keywords, setKeywords] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [lastGeneratedTitle, setLastGeneratedTitle] = useState<string | null>(null);

  const [seriesTheme, setSeriesTheme] = useState('');
  const [seriesCount, setSeriesCount] = useState(5);
  const [seriesTopics, setSeriesTopics] = useState<QueueItem[]>([]);

  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);

  const { startTask, getTask, getTasksByType, clearTask } = useBackgroundTasks();

  const briefTaskId = `blog-brief-${projectId}`;
  const singleTaskId = `blog-single-${projectId}`;
  const seriesTopicTaskId = `blog-series-topics-${projectId}`;
  const briefTask = getTask(briefTaskId);
  const singleTask = getTask(singleTaskId);
  const seriesTopicTask = getTask(seriesTopicTaskId);
  const seriesArticleTasks = getTasksByType('blog-series-article');

  const generatingPrompt = briefTask?.status === 'running';
  const generatingArticle = singleTask?.status === 'running';
  const generatingTopics = seriesTopicTask?.status === 'running';

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    try {
      const resp = await authenticatedFetch(
        `${API_ENDPOINTS.db.blogOpportunities}?siteUrl=${encodeURIComponent(siteUrl)}&projectId=${projectId}`
      );
      const data = await parseJsonOrThrow<{ opportunities?: Array<Record<string, string>> }>(resp);
      const queued = (data.opportunities || [])
        .filter((o: Record<string, string>) => o.status === 'queued')
        .map((o: Record<string, string>) => ({
          id: o.id,
          title: o.title,
          description: o.description || '',
          targetKeyword: o.target_keyword || o.targetKeyword || '',
          generated: false,
          fromQueue: true,
        }));
      setQueueItems(queued);
    } catch (err) {
      console.error('[BlogWriter] Queue load error:', err);
    }
    setLoadingQueue(false);
  }, [siteUrl, projectId]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const allSeriesItems = [...queueItems, ...seriesTopics.filter(t => !t.fromQueue)];

  const autoGenerateImages = useCallback(async (articleId: string, descriptions: string[], title?: string) => {
    try {
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.generateImages, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descriptions,
          model: getModelPreferences(projectId).imageModel,
          context: { contentType: 'editorial', style: 'photorealistic', mood: 'professional', purpose: 'blog_image', subject: title || '', includesText: false, includesPeople: false },
          projectId,
        }),
      });
      const data = await parseJsonOrThrow<{ images?: unknown[] }>(resp);
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

  const generatePromptFromKeywords = () => {
    if (!keywords.trim()) return;
    startTask(briefTaskId, 'blog-brief', 'Generating article brief', async () => {
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.generateBrief, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, projectId, keywords: keywords.trim() }),
      });
      const data = await parseJsonOrThrow<{ brief?: string }>(resp);
      return data.brief || '';
    });
  };

  useEffect(() => {
    if (briefTask?.status === 'completed') {
      setGeneratedPrompt(briefTask.result as string);
      clearTask(briefTaskId);
    } else if (briefTask?.status === 'failed') {
      clearTask(briefTaskId);
    }
  }, [briefTask?.status]);

  const generateSingleArticle = () => {
    const title = inputMethod === 'describe' ? articleDescription.trim() : generatedPrompt.trim();
    if (!title) return;
    const kw = inputMethod === 'keywords' ? keywords.trim() : '';
    startTask(singleTaskId, 'blog-single', `Writing: ${title.slice(0, 60)}`, async () => {
      const objectives = localStorage.getItem('site_objectives') || localStorage.getItem(`kt_objectives_${projectId}`) || '';
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.generate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, projectId, title, targetKeyword: kw, description: title, objectives, source: 'writer' }),
      });
      const data = await parseJsonOrThrow<{ blog?: Record<string, unknown>; error?: string }>(resp);
      if (!data.blog) throw new Error('No article was returned.');
      if (data.blog.articleId && (data.blog.suggestedImages as unknown[])?.length > 0) {
        autoGenerateImages(data.blog.articleId as string, data.blog.suggestedImages as string[], title);
      }
      return data.blog;
    });
  };

  useEffect(() => {
    if (singleTask?.status === 'completed' && singleTask.result) {
      const blog = singleTask.result as { title: string };
      setLastGeneratedTitle(blog.title);
      logActivity(siteUrl, 'blog', 'article-written', `Wrote blog article: ${blog.title}`);
      clearTask(singleTaskId);
    } else if (singleTask?.status === 'failed') {
      clearTask(singleTaskId);
    }
  }, [singleTask?.status]);

  const generateSeriesTopics = () => {
    if (!seriesTheme.trim()) return;
    const existingTitles = queueItems.map(q => q.title);
    const remainingCount = Math.max(1, seriesCount - queueItems.length);
    startTask(seriesTopicTaskId, 'blog-series-topics', 'Planning series topics', async () => {
      const objectives = localStorage.getItem('site_objectives') || localStorage.getItem(`kt_objectives_${projectId}`) || '';
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.opportunities, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, projectId, objectives, existingKeywords: [], existingTopics: existingTitles, seriesTheme: seriesTheme.trim(), count: remainingCount }),
      });
      const data = await parseJsonOrThrow<{ opportunities?: Record<string, string>[] }>(resp);
      if (!data.opportunities) throw new Error('No topics generated');
      return data.opportunities;
    });
  };

  useEffect(() => {
    if (seriesTopicTask?.status === 'completed' && seriesTopicTask.result) {
      const opps = seriesTopicTask.result as Record<string, string>[];
      setSeriesTopics(
        opps.map((o, i) => ({
          id: o.id || `topic-${i}`, title: o.title, description: o.description || '',
          targetKeyword: o.target_keyword || o.targetKeyword || '', generated: false, fromQueue: false,
        }))
      );
      clearTask(seriesTopicTaskId);
    } else if (seriesTopicTask?.status === 'failed') {
      clearTask(seriesTopicTaskId);
    }
  }, [seriesTopicTask?.status]);

  const removeItem = async (item: QueueItem) => {
    if (item.fromQueue && item.id) {
      try {
        await authenticatedFetch(API_ENDPOINTS.db.blogOpportunities, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, projectId, status: 'pending' }),
        });
      } catch { /* best effort */ }
      setQueueItems((prev) => prev.filter((q) => q.id !== item.id));
    } else {
      setSeriesTopics((prev) => prev.filter((t) => t.id !== item.id));
    }
  };

  const generateItemArticle = (item: QueueItem) => {
    startTask(`blog-series-article-${item.id}`, 'blog-series-article', `Writing: ${item.title.slice(0, 60)}`, async () => {
      const objectives = localStorage.getItem('site_objectives') || localStorage.getItem(`kt_objectives_${projectId}`) || '';
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.generate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl, projectId, title: item.title, targetKeyword: item.targetKeyword,
          description: item.description, objectives,
          opportunityId: item.fromQueue ? item.id : undefined,
          source: item.fromQueue ? 'queue' : 'series',
        }),
      });
      const data = await parseJsonOrThrow<{ blog?: Record<string, unknown>; error?: string }>(resp);
      if (!data.blog) throw new Error('No article was returned.');
      if (item.fromQueue) {
        try {
          await authenticatedFetch(API_ENDPOINTS.db.blogOpportunities, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: item.id, projectId, status: 'completed' }),
          });
        } catch { /* best effort */ }
      }
      if (data.blog.articleId && (data.blog.suggestedImages as unknown[])?.length > 0) {
        autoGenerateImages(data.blog.articleId as string, data.blog.suggestedImages as string[], item.title);
      }
      return { blog: data.blog, itemId: item.id, fromQueue: item.fromQueue, title: item.title };
    });
  };

  useEffect(() => {
    for (const task of seriesArticleTasks) {
      if (task.status === 'completed' && task.result) {
        const { itemId, fromQueue, title } = task.result as { itemId: string; fromQueue: boolean; title: string };
        if (fromQueue) {
          setQueueItems((prev) => prev.map((q) => q.id === itemId ? { ...q, generated: true } : q));
        } else {
          setSeriesTopics((prev) => prev.map((t) => t.id === itemId ? { ...t, generated: true } : t));
        }
        logActivity(siteUrl, 'blog', 'series-article', `Generated article: ${title}`);
        clearTask(task.id);
      } else if (task.status === 'failed') {
        clearTask(task.id);
      }
    }
  }, [seriesArticleTasks.map(t => t.status).join()]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-apple-text">Blog Writer</h1>
        <p className="text-apple-sm text-apple-text-secondary mt-1">
          Write individual articles or create a series. All generated articles appear in the Completed section.
        </p>
      </div>

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

      {mode === 'series' && (
        <div className="space-y-4">
          {/* Queue Section */}
          {queueItems.length > 0 && (
            <div className="bg-white rounded-apple border border-purple-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <h3 className="text-base font-semibold text-apple-text">
                    Writing Queue ({queueItems.filter(q => !q.generated).length} remaining)
                  </h3>
                </div>
                <span className="text-apple-xs text-apple-text-tertiary">
                  {queueItems.filter(q => q.generated).length} / {queueItems.length} completed
                </span>
              </div>
              <p className="text-apple-xs text-apple-text-tertiary">
                Topics added from Blog Ideas. Generate articles one at a time or plan additional series topics below.
              </p>
              <div className="space-y-2">
                {queueItems.map((item, i) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-apple-sm border ${
                      item.generated ? 'border-green-200 bg-green-50/30' : 'border-purple-100 bg-purple-50/20'
                    }`}
                  >
                    <span className="text-apple-xs text-apple-text-tertiary font-mono w-6 text-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-apple-sm font-medium ${item.generated ? 'text-green-700' : 'text-apple-text'}`}>
                        {item.title}
                      </p>
                      {item.targetKeyword && (
                        <p className="text-apple-xs text-apple-text-tertiary mt-0.5">
                          Keyword: {item.targetKeyword}
                        </p>
                      )}
                    </div>
                    {item.generated ? (
                      <span className="text-apple-xs text-green-600 font-medium shrink-0">Done</span>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => generateItemArticle(item)}
                          disabled={getTask(`blog-series-article-${item.id}`)?.status === 'running'}
                          className="px-3 py-1 rounded-apple-sm bg-apple-blue text-white text-apple-xs font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
                        >
                          {getTask(`blog-series-article-${item.id}`)?.status === 'running' ? (
                            <span className="flex items-center gap-1.5">
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Writing...
                            </span>
                          ) : (
                            'Generate'
                          )}
                        </button>
                        <button
                          onClick={() => removeItem(item)}
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

          {loadingQueue && queueItems.length === 0 && (
            <div className="flex items-center gap-2 py-4 text-apple-text-secondary text-apple-sm justify-center">
              <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
              Loading queue...
            </div>
          )}

          {/* Generate Series Topics */}
          <div className="bg-white rounded-apple border border-apple-border p-5 space-y-4">
            <h2 className="text-base font-semibold text-apple-text">
              {queueItems.length > 0 ? 'Add More Series Topics' : 'Create a Blog Series'}
            </h2>
            {queueItems.length > 0 && (
              <p className="text-apple-xs text-apple-text-tertiary">
                {queueItems.length} topic{queueItems.length !== 1 ? 's' : ''} already in queue.
                Generate additional topics to fill out the series, or generate articles from the queue above.
              </p>
            )}
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
                  Additional Articles
                </label>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={seriesCount}
                  onChange={(e) => setSeriesCount(Math.max(1, Math.min(15, parseInt(e.target.value) || 5)))}
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
                queueItems.length > 0 ? 'Generate Additional Topics' : 'Plan Series'
              )}
            </button>
          </div>

          {/* Generated Series Topics */}
          {seriesTopics.filter(t => !t.fromQueue).length > 0 && (
            <div className="bg-white rounded-apple border border-apple-border p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-apple-text">
                  Series Articles ({seriesTopics.filter(t => !t.fromQueue).length})
                </h3>
                <span className="text-apple-xs text-apple-text-tertiary">
                  {seriesTopics.filter((t) => !t.fromQueue && t.generated).length} / {seriesTopics.filter(t => !t.fromQueue).length} completed
                </span>
              </div>
              <div className="space-y-2">
                {seriesTopics.filter(t => !t.fromQueue).map((topic, i) => (
                  <div
                    key={topic.id}
                    className={`flex items-center gap-3 p-3 rounded-apple-sm border ${
                      topic.generated ? 'border-green-200 bg-green-50/30' : 'border-apple-border'
                    }`}
                  >
                    <span className="text-apple-xs text-apple-text-tertiary font-mono w-6 text-center shrink-0">
                      {queueItems.length + i + 1}
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
                          onClick={() => generateItemArticle(topic)}
                          disabled={getTask(`blog-series-article-${topic.id}`)?.status === 'running'}
                          className="px-3 py-1 rounded-apple-sm bg-apple-blue text-white text-apple-xs font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
                        >
                          {getTask(`blog-series-article-${topic.id}`)?.status === 'running' ? (
                            <span className="flex items-center gap-1.5">
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Writing...
                            </span>
                          ) : (
                            'Generate'
                          )}
                        </button>
                        <button
                          onClick={() => removeItem(topic)}
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

          {queueItems.length === 0 && seriesTopics.length === 0 && !loadingQueue && (
            <div className="bg-apple-fill-secondary/30 rounded-apple p-5 text-center">
              <p className="text-apple-sm text-apple-text-secondary">
                No topics in queue. Add topics from Blog Ideas using &quot;Add to Queue&quot;, or plan a new series above.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
