import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { authenticatedFetch } from '../services/authService';
import { logActivity } from '../utils/activityLog';

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

interface CompletedArticlesViewProps {
  siteUrl: string;
  projectId: string;
}

export default function CompletedArticlesView({ siteUrl, projectId }: CompletedArticlesViewProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const [modifyingArticle, setModifyingArticle] = useState<string | null>(null);
  const [modifyPrompt, setModifyPrompt] = useState('');
  const [applyingModify, setApplyingModify] = useState(false);
  const [generatingImages, setGeneratingImages] = useState<string | null>(null);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await authenticatedFetch(`${API_ENDPOINTS.db.blogArticles}?projectId=${projectId}`);
      const data = await resp.json();
      setArticles(data.articles || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

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

  const generateImages = async (articleId: string, descriptions: string[]) => {
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

  const sourceLabel = (s: string) => s === 'idea' ? 'From Idea' : s === 'series' ? 'Series' : 'Manual';

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-apple-text">Completed Articles</h1>
        <p className="text-apple-sm text-apple-text-secondary mt-1">
          All generated blog articles are saved here permanently. Modify, copy, or delete articles as needed.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-apple-text-secondary text-apple-sm justify-center">
          <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
          Loading articles...
        </div>
      ) : articles.length === 0 ? (
        <div className="bg-white rounded-apple border border-apple-border p-8 text-center">
          <p className="text-apple-text-secondary text-apple-sm">
            No articles generated yet. Generate articles from Blog Ideas or Blog Writer to see them here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => {
            const hasImages = article.images && article.images.length > 0 && article.images.some((img) => img.imageUrl);
            const isExpanded = expandedArticle === article.id;
            const isModifying = modifyingArticle === article.id;

            return (
              <div key={article.id} className="bg-white rounded-apple border border-apple-border">
                <button
                  onClick={() => setExpandedArticle(isExpanded ? null : article.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-apple-fill-secondary transition-colors"
                >
                  <div className="w-8 h-8 rounded-apple-sm bg-green-50 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-apple-sm font-medium text-apple-text">{article.title}</span>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{sourceLabel(article.source)}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{article.word_count} words</span>
                      {hasImages && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">
                          {article.images.filter((img) => img.imageUrl).length} images
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-apple-xs text-apple-text-tertiary shrink-0">
                    {new Date(article.created_at).toLocaleDateString()}
                  </span>
                  <svg className={`w-4 h-4 transition-transform text-apple-text-tertiary ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="border-t border-apple-divider p-4 space-y-4">
                    {/* Metadata */}
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

                    {/* Generate images prompt */}
                    {!hasImages && article.suggested_images && article.suggested_images.length > 0 && (
                      <div className="bg-amber-50/50 rounded-apple-sm border border-amber-100 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-apple-xs font-medium text-amber-800">
                            {article.suggested_images.length} images suggested
                          </span>
                          <button
                            onClick={() => generateImages(article.id, article.suggested_images)}
                            disabled={generatingImages === article.id}
                            className="px-3 py-1 rounded-apple-sm bg-amber-600 text-white text-apple-xs font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                          >
                            {generatingImages === article.id ? (
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
                        onClick={() => {
                          setModifyingArticle(isModifying ? null : article.id);
                          setModifyPrompt('');
                        }}
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
                          onClick={() => revertArticle(article)}
                          className="px-3 py-1.5 rounded-apple-sm border border-amber-500 text-amber-600 text-apple-xs font-medium hover:bg-amber-50 transition-colors"
                        >
                          Revert
                        </button>
                      )}
                      <button
                        onClick={() => navigator.clipboard.writeText(article.content)}
                        className="px-3 py-1.5 rounded-apple-sm border border-apple-border text-apple-text-secondary text-apple-xs font-medium hover:bg-apple-fill-secondary transition-colors"
                      >
                        Copy
                      </button>
                      <div className="flex-1" />
                      <button
                        onClick={() => deleteArticle(article.id)}
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
                          onChange={(e) => setModifyPrompt(e.target.value)}
                          placeholder="e.g., Make the introduction more engaging, add a section about pricing, shorten the conclusion..."
                          className="input w-full text-apple-sm min-h-[80px] resize-y"
                        />
                        <button
                          onClick={() => modifyArticle(article)}
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
          })}
        </div>
      )}
    </div>
  );
}
