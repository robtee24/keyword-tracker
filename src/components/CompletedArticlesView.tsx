import { useState, useEffect, useCallback, useRef } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { authenticatedFetch } from '../services/authService';
import { logActivity } from '../utils/activityLog';
import { useBackgroundTasks } from '../contexts/BackgroundTaskContext';
import { parseJsonOrThrow } from '../utils/apiResponse';
import { getModelPreferences } from '../config/models';
import type { GenerationContext } from '../config/models';
import MediaEditButton from './MediaEditButton';
import { useCredits } from '../contexts/CreditsContext';

interface ArticleImage {
  description: string;
  caption?: string;
  imageUrl: string | null;
  error?: string;
  placement?: string;
}

interface Article {
  id: string;
  project_id: string;
  site_url: string;
  opportunity_id: string | null;
  title: string;
  subtitle: string | null;
  author: string | null;
  slug: string;
  meta_description: string;
  content: string;
  previous_content: string | null;
  images: ArticleImage[];
  word_count: number;
  internal_link_suggestions: string[];
  suggested_images: Array<string | { description: string; caption?: string; placement?: string }>;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
}

interface CompletedArticlesViewProps {
  siteUrl: string;
  projectId: string;
  highlightArticleId?: string | null;
  onHighlightHandled?: () => void;
}

function markdownToHtml(md: string): string {
  if (!md) return '';
  if (md.trim().startsWith('<')) return md;

  let html = md;

  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  const lines = html.split('\n');
  const result: string[] = [];
  let inList = false;
  let listType = '';
  let inParagraph = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('<h') || line.startsWith('<table') || line.startsWith('<blockquote') || line.startsWith('<article') || line.startsWith('<aside') || line.startsWith('<section')) {
      if (inParagraph) { result.push('</p>'); inParagraph = false; }
      if (inList) { result.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      result.push(line);
      continue;
    }

    const ulMatch = line.match(/^[-*+]\s+(.+)/);
    const olMatch = line.match(/^\d+\.\s+(.+)/);

    if (ulMatch) {
      if (inParagraph) { result.push('</p>'); inParagraph = false; }
      if (!inList || listType !== 'ul') {
        if (inList) result.push(listType === 'ul' ? '</ul>' : '</ol>');
        result.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      result.push(`<li>${ulMatch[1]}</li>`);
      continue;
    }

    if (olMatch) {
      if (inParagraph) { result.push('</p>'); inParagraph = false; }
      if (!inList || listType !== 'ol') {
        if (inList) result.push(listType === 'ul' ? '</ul>' : '</ol>');
        result.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      result.push(`<li>${olMatch[1]}</li>`);
      continue;
    }

    if (inList && !ulMatch && !olMatch) {
      result.push(listType === 'ul' ? '</ul>' : '</ol>');
      inList = false;
    }

    if (line === '') {
      if (inParagraph) { result.push('</p>'); inParagraph = false; }
      continue;
    }

    if (line.startsWith('<')) {
      if (inParagraph) { result.push('</p>'); inParagraph = false; }
      result.push(line);
    } else {
      if (!inParagraph) {
        result.push('<p>');
        inParagraph = true;
      } else {
        result.push(' ');
      }
      result.push(line);
    }
  }

  if (inParagraph) result.push('</p>');
  if (inList) result.push(listType === 'ul' ? '</ul>' : '</ol>');

  return result.join('\n');
}

function embedImagesInContent(content: string, images: ArticleImage[]): string {
  if (!images || images.length === 0) return content;

  const validImages = images.filter(img => img.imageUrl);
  if (validImages.length === 0) return content;

  let html = content;

  const slots = html.match(/<!--\s*IMAGE_SLOT\s*-->/g);
  if (slots) {
    let imgIdx = 0;
    html = html.replace(/<!--\s*IMAGE_SLOT\s*-->/g, () => {
      if (imgIdx < validImages.length) {
        const img = validImages[imgIdx++];
        return `<figure><img src="${img.imageUrl}" alt="${(img.caption || img.description || '').replace(/"/g, '&quot;')}" />${img.caption ? `<figcaption>${img.caption}</figcaption>` : ''}</figure>`;
      }
      return '';
    });
    return html;
  }

  const h2Matches = [...html.matchAll(/<\/h2>/gi)];
  if (h2Matches.length > 0) {
    let imgIdx = 0;
    const insertAfterIndices: number[] = [];

    if (h2Matches.length <= validImages.length) {
      for (let i = 0; i < Math.min(h2Matches.length, validImages.length); i++) {
        insertAfterIndices.push(i);
      }
    } else {
      const step = Math.floor(h2Matches.length / validImages.length);
      for (let i = 0; i < validImages.length; i++) {
        insertAfterIndices.push(Math.min(i * step, h2Matches.length - 1));
      }
    }

    let offset = 0;
    for (const sectionIdx of insertAfterIndices) {
      if (imgIdx >= validImages.length) break;
      const match = h2Matches[sectionIdx];
      const insertPos = match.index! + match[0].length + offset;

      const nextClosingTag = html.indexOf('</p>', insertPos);
      const actualInsertPos = nextClosingTag !== -1 ? nextClosingTag + 4 : insertPos;

      const img = validImages[imgIdx++];
      const figureHtml = `\n<figure><img src="${img.imageUrl}" alt="${(img.caption || img.description || '').replace(/"/g, '&quot;')}" />${img.caption ? `<figcaption>${img.caption}</figcaption>` : ''}</figure>\n`;

      html = html.slice(0, actualInsertPos) + figureHtml + html.slice(actualInsertPos);
      offset += figureHtml.length;
    }
  }

  return html;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function CompletedArticlesView({ siteUrl, projectId, highlightArticleId, onHighlightHandled }: CompletedArticlesViewProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const [modifyingArticle, setModifyingArticle] = useState<string | null>(null);
  const [modifyPrompt, setModifyPrompt] = useState('');
  const [imageError, setImageError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const [editingArticle, setEditingArticle] = useState<string | null>(null);
  const [editDirty, setEditDirty] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editMeta, setEditMeta] = useState<{ title: string; subtitle: string; author: string; slug: string; meta_description: string }>({
    title: '', subtitle: '', author: '', slug: '', meta_description: '',
  });
  const contentEditRef = useRef<HTMLDivElement>(null);

  const { refreshCredits } = useCredits();
  const { startTask, getTask, getTasksByType, clearTask } = useBackgroundTasks();
  const modifyTasks = getTasksByType('blog-modify');
  const imageTasks = getTasksByType('blog-images');

  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await authenticatedFetch(`${API_ENDPOINTS.db.blogArticles}?projectId=${projectId}`);
      const data = await parseJsonOrThrow<{ articles: Article[] }>(resp);
      setArticles(data.articles || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  useEffect(() => {
    if (highlightArticleId && articles.length > 0) {
      const found = articles.find(a => a.id === highlightArticleId);
      if (found) {
        setExpandedArticle(highlightArticleId);
        onHighlightHandled?.();
        requestAnimationFrame(() => {
          const el = document.getElementById(`article-${highlightArticleId}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }
  }, [highlightArticleId, articles]);

  const deleteArticle = async (id: string) => {
    if (!confirm('Delete this article permanently?')) return;
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

  const modifyArticle = (article: Article) => {
    if (!modifyPrompt.trim()) return;
    const prompt = modifyPrompt.trim();
    startTask(`blog-modify-${article.id}`, 'blog-modify', `Modifying: ${article.title.slice(0, 50)}`, async () => {
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.modify, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: article.id, projectId, currentContent: article.content, currentTitle: article.title, modifyPrompt: prompt }),
      });
      const data = await parseJsonOrThrow<{ article?: Article; error?: string }>(resp);
      if (!data.article) throw new Error('No result returned');
      logActivity(siteUrl, 'blog', 'article-modified', `Modified article: ${article.title}`);
      return { article: data.article, articleId: article.id };
    });
    setModifyingArticle(null);
    setModifyPrompt('');
  };

  useEffect(() => {
    for (const task of modifyTasks) {
      if (task.status === 'completed' && task.result) {
        const { article: updated } = task.result as { article: Article; articleId: string };
        setArticles((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        clearTask(task.id);
      } else if (task.status === 'failed') {
        clearTask(task.id);
      }
    }
  }, [modifyTasks.map(t => t.status).join()]);

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

  const generateImages = (article: Article) => {
    setImageError(null);
    const context: GenerationContext = {
      contentType: 'editorial',
      subject: article.title || '',
      style: 'photorealistic',
      mood: 'professional',
      includesText: false,
      includesPeople: false,
      purpose: 'blog_image',
    };
    startTask(`blog-images-${article.id}`, 'blog-images', `Images: ${article.title.slice(0, 50)}`, async () => {
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.generateImages, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptions: article.suggested_images, model: getModelPreferences(projectId).imageModel, context, projectId }),
      });
      const data = await parseJsonOrThrow<{ images?: ArticleImage[]; errors?: string[]; error?: string }>(resp);

      const validImages = (data.images || []).filter((img: ArticleImage) => img.imageUrl);
      if (validImages.length === 0) throw new Error('All images failed to generate. ' + (data.errors?.join('; ') || 'Check your OpenAI API key.'));

      const updatedContent = embedImagesInContent(markdownToHtml(article.content), validImages);

      await authenticatedFetch(API_ENDPOINTS.db.blogArticles, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: article.id, images: data.images, content: updatedContent, previous_content: article.content }),
      });

      return { articleId: article.id, images: data.images, updatedContent, previousContent: article.content, partialErrors: data.errors };
    });
  };

  useEffect(() => {
    for (const task of imageTasks) {
      if (task.status === 'completed' && task.result) {
        const { articleId, images, updatedContent, previousContent, partialErrors } = task.result as {
          articleId: string; images: ArticleImage[]; updatedContent: string; previousContent: string; partialErrors?: string[];
        };
        setArticles((prev) =>
          prev.map((a) => a.id === articleId ? { ...a, images, content: updatedContent, previous_content: previousContent } : a)
        );
        if (partialErrors?.length) {
          setImageError(`Some images generated, ${partialErrors.length} failed.`);
        }
        clearTask(task.id);
      } else if (task.status === 'failed') {
        setImageError(task.error || 'Image generation failed.');
        clearTask(task.id);
      }
    }
  }, [imageTasks.map(t => t.status).join()]);

  const copyHtml = (article: Article) => {
    const bodyHtml = getRenderedHtml(article);
    const subtitle = article.subtitle || article.meta_description || '';
    const author = article.author || 'Editorial Team';
    const date = formatDate(article.created_at);
    const header = `<h1>${article.title}</h1>\n${subtitle ? `<p class="subtitle">${subtitle}</p>\n` : ''}<p class="byline">By ${author} &middot; ${date}</p>\n`;
    navigator.clipboard.writeText(header + bodyHtml);
    setCopyFeedback(article.id);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const getRenderedHtml = (article: Article) => {
    let html = markdownToHtml(article.content);
    const validImages = (article.images || []).filter(img => img.imageUrl);
    if (validImages.length > 0 && !article.content.includes('<figure')) {
      html = embedImagesInContent(html, validImages);
    }
    return html;
  };

  const startEditing = (article: Article) => {
    setEditingArticle(article.id);
    setEditDirty(false);
    setEditMeta({
      title: article.title,
      subtitle: article.subtitle || '',
      author: article.author || '',
      slug: article.slug || '',
      meta_description: article.meta_description || '',
    });
  };

  const cancelEditing = () => {
    if (editDirty && !confirm('Discard unsaved changes?')) return;
    setEditingArticle(null);
    setEditDirty(false);
  };

  const saveEditing = async (article: Article) => {
    setEditSaving(true);
    try {
      const newContent = contentEditRef.current?.innerHTML || article.content;
      const updates: Record<string, unknown> = {
        id: article.id,
        content: newContent,
        previous_content: article.content,
        title: editMeta.title,
        subtitle: editMeta.subtitle,
        author: editMeta.author,
        slug: editMeta.slug,
        meta_description: editMeta.meta_description,
      };
      const resp = await authenticatedFetch(API_ENDPOINTS.db.blogArticles, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await parseJsonOrThrow<{ article: Article }>(resp);
      setArticles((prev) => prev.map((a) => (a.id === article.id ? data.article : a)));
      setEditingArticle(null);
      setEditDirty(false);
      logActivity(siteUrl, 'blog', 'article-edited', `Edited article: ${editMeta.title}`);
    } catch (err) {
      console.error('Failed to save edits:', err);
      alert('Failed to save changes. Please try again.');
    }
    setEditSaving(false);
  };

  const updateArticleImage = useCallback(async (articleId: string, oldUrl: string, newUrl: string) => {
    setArticles((prev) =>
      prev.map((a) => {
        if (a.id !== articleId) return a;
        const escaped = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return {
          ...a,
          images: a.images.map((img) =>
            img.imageUrl === oldUrl ? { ...img, imageUrl: newUrl } : img
          ),
          content: a.content.replace(new RegExp(escaped, 'g'), newUrl),
        };
      })
    );
    try {
      const article = articles.find((a) => a.id === articleId);
      if (article) {
        const updatedImages = article.images.map((img) =>
          img.imageUrl === oldUrl ? { ...img, imageUrl: newUrl } : img
        );
        const escaped = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const updatedContent = article.content.replace(new RegExp(escaped, 'g'), newUrl);
        await authenticatedFetch(API_ENDPOINTS.db.blogArticles, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: articleId, images: updatedImages, content: updatedContent }),
        });
      }
    } catch (err) {
      console.error('Failed to persist image update:', err);
    }
    refreshCredits();
  }, [articles, refreshCredits]);

  const sourceLabel = (s: string) => s === 'idea' ? 'From Idea' : s === 'series' ? 'Series' : s === 'queue' ? 'From Queue' : s === 'rewrite' ? 'Rewrite' : 'Manual';

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-apple-text">Publish</h1>
        <p className="text-apple-sm text-apple-text-secondary mt-1">
          All generated and rewritten blog articles are saved here. Copy HTML to paste directly into your CMS.
        </p>
      </div>

      {imageError && (
        <div className="bg-red-50 border border-red-200 rounded-apple p-4 flex items-center justify-between">
          <div>
            <p className="text-apple-sm text-red-800 font-medium">Image generation issue</p>
            <p className="text-apple-xs text-red-600 mt-1">{imageError}</p>
          </div>
          <button onClick={() => setImageError(null)} className="text-red-400 hover:text-red-600 shrink-0 ml-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

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
            const isEditing = editingArticle === article.id;
            const hasSuggestedImages = article.suggested_images && article.suggested_images.length > 0;
            const isCopied = copyFeedback === article.id;

            return (
              <div key={article.id} id={`article-${article.id}`} className="bg-white rounded-apple border border-apple-border">
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
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        article.source === 'rewrite' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
                      }`}>{sourceLabel(article.source)}</span>
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
                    {/* Metadata row */}
                    {!isEditing && (
                      <div className="flex flex-wrap gap-4 text-apple-xs text-apple-text-secondary">
                        {article.slug && (
                          <div>
                            <span className="font-semibold">Slug: </span>
                            <span>/{article.slug}</span>
                          </div>
                        )}
                        {article.meta_description && (
                          <div>
                            <span className="font-semibold">Meta: </span>
                            <span className="italic">{article.meta_description}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Editable metadata fields */}
                    {isEditing && (
                      <div className="bg-blue-50/40 rounded-apple-sm border border-blue-100 p-4 space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1">Title</label>
                            <input
                              value={editMeta.title}
                              onChange={(e) => { setEditMeta({ ...editMeta, title: e.target.value }); setEditDirty(true); }}
                              className="input text-apple-sm w-full font-semibold"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1">Subtitle</label>
                            <input
                              value={editMeta.subtitle}
                              onChange={(e) => { setEditMeta({ ...editMeta, subtitle: e.target.value }); setEditDirty(true); }}
                              placeholder="Supporting line under the title"
                              className="input text-apple-sm w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1">Author</label>
                            <input
                              value={editMeta.author}
                              onChange={(e) => { setEditMeta({ ...editMeta, author: e.target.value }); setEditDirty(true); }}
                              placeholder="Editorial Team"
                              className="input text-apple-sm w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1">Slug</label>
                            <input
                              value={editMeta.slug}
                              onChange={(e) => { setEditMeta({ ...editMeta, slug: e.target.value }); setEditDirty(true); }}
                              className="input text-apple-sm w-full font-mono"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1">Meta Description</label>
                            <textarea
                              value={editMeta.meta_description}
                              onChange={(e) => { setEditMeta({ ...editMeta, meta_description: e.target.value }); setEditDirty(true); }}
                              className="input text-apple-sm w-full min-h-[56px] resize-y"
                              maxLength={160}
                            />
                            <span className="text-[10px] text-apple-text-tertiary">{editMeta.meta_description.length}/160</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Generate images prompt */}
                    {!hasImages && hasSuggestedImages && (
                      <div className="bg-amber-50/50 rounded-apple-sm border border-amber-100 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-apple-xs font-medium text-amber-800">
                            {article.suggested_images.length} images suggested — generate to embed them in the article
                          </span>
                          <button
                            onClick={() => generateImages(article)}
                            disabled={getTask(`blog-images-${article.id}`)?.status === 'running'}
                            className="px-3 py-1 rounded-apple-sm bg-amber-600 text-white text-apple-xs font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                          >
                            {getTask(`blog-images-${article.id}`)?.status === 'running' ? (
                              <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Generating...
                              </span>
                            ) : (
                              'Generate & Embed Images'
                            )}
                          </button>
                        </div>
                        <ul className="text-[10px] text-amber-700 space-y-0.5">
                          {article.suggested_images.map((desc, i) => (
                            <li key={i}>• {typeof desc === 'string' ? desc : desc.description}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Article header: title, subtitle, byline */}
                    <div className="bg-white rounded-apple-sm border border-apple-divider px-8 pt-8 pb-6">
                      <h2 className="text-2xl font-bold text-apple-text leading-tight tracking-tight">
                        {article.title}
                      </h2>
                      {(article.subtitle || article.meta_description) && (
                        <p className="text-base text-apple-text-secondary mt-2 leading-relaxed">
                          {article.subtitle || article.meta_description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-4 text-apple-xs text-apple-text-tertiary">
                        <span className="font-medium text-apple-text-secondary">
                          By {article.author || 'Editorial Team'}
                        </span>
                        <span>&middot;</span>
                        <time dateTime={article.created_at}>
                          {formatDate(article.created_at)}
                        </time>
                        <span>&middot;</span>
                        <span>{article.word_count.toLocaleString()} words</span>
                      </div>
                      <div className="mt-4 h-px bg-apple-divider" />
                    </div>

                    {/* Article content — rendered as HTML with prose typography */}
                    <div
                      ref={isEditing ? contentEditRef : undefined}
                      contentEditable={isEditing}
                      suppressContentEditableWarning
                      onInput={() => { if (isEditing) setEditDirty(true); }}
                      className={`prose prose-base max-w-none rounded-apple-sm px-8 py-6
                        prose-headings:text-apple-text
                        prose-h2:text-xl prose-h2:font-bold prose-h2:mt-10 prose-h2:mb-4 prose-h2:tracking-tight
                        prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-3
                        prose-p:text-apple-text prose-p:leading-relaxed prose-p:mb-4 prose-p:text-[15px]
                        prose-li:text-apple-text prose-li:text-[15px] prose-li:leading-relaxed
                        prose-strong:text-apple-text prose-strong:font-semibold
                        prose-a:text-apple-blue prose-a:no-underline hover:prose-a:underline
                        prose-table:border-collapse prose-table:w-full prose-table:text-[14px]
                        prose-thead:bg-gray-50 prose-thead:border-b-2 prose-thead:border-gray-200
                        prose-th:px-4 prose-th:py-3 prose-th:text-left prose-th:font-semibold prose-th:text-apple-text-secondary
                        prose-td:px-4 prose-td:py-3 prose-td:border-b prose-td:border-gray-100
                        prose-blockquote:border-l-4 prose-blockquote:border-apple-blue prose-blockquote:bg-blue-50/30 prose-blockquote:rounded-r-lg prose-blockquote:pl-5 prose-blockquote:pr-4 prose-blockquote:py-3 prose-blockquote:italic prose-blockquote:not-italic prose-blockquote:text-apple-text-secondary
                        prose-img:rounded-xl prose-img:w-full prose-img:shadow-sm
                        prose-figcaption:text-center prose-figcaption:text-apple-text-tertiary prose-figcaption:text-sm prose-figcaption:mt-2
                        prose-hr:border-apple-divider
                        ${isEditing
                          ? 'bg-white border-2 border-apple-blue/30 focus:outline-none focus:border-apple-blue/60 min-h-[300px] cursor-text'
                          : 'bg-apple-fill-secondary'
                        }
                        [&_aside]:bg-blue-50 [&_aside]:border [&_aside]:border-blue-100 [&_aside]:rounded-xl [&_aside]:p-5 [&_aside]:my-6 [&_aside]:text-[14px]
                        [&_.faq-section]:bg-gray-50 [&_.faq-section]:rounded-xl [&_.faq-section]:p-6 [&_.faq-section]:my-8 [&_.faq-section]:border [&_.faq-section]:border-gray-100
                        [&_figure]:my-8
                      `}
                      dangerouslySetInnerHTML={isEditing ? undefined : { __html: getRenderedHtml(article) }}
                    />

                    {/* Image edit overlays */}
                    {hasImages && !isEditing && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {article.images.filter((img) => img.imageUrl).map((img, idx) => (
                          <div key={idx} className="relative group rounded-xl overflow-hidden border border-apple-divider">
                            <img
                              src={img.imageUrl!}
                              alt={img.caption || img.description || ''}
                              className="w-full aspect-[4/3] object-cover"
                            />
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MediaEditButton
                                imageUrl={img.imageUrl!}
                                projectId={projectId}
                                onImageUpdated={(newUrl) => updateArticleImage(article.id, img.imageUrl!, newUrl)}
                              />
                            </div>
                            {img.caption && (
                              <div className="px-2 py-1.5 text-[10px] text-apple-text-tertiary bg-apple-fill-secondary truncate">
                                {img.caption}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Unsaved changes indicator */}
                    {isEditing && editDirty && (
                      <div className="flex items-center gap-2 text-apple-xs text-amber-600 font-medium">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        Unsaved changes
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEditing(article)}
                            disabled={editSaving || !editDirty}
                            className="px-4 py-1.5 rounded-apple-sm bg-green-600 text-white text-apple-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            {editSaving ? (
                              <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Saving...
                              </span>
                            ) : 'Save Changes'}
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="px-3 py-1.5 rounded-apple-sm border border-apple-border text-apple-text-secondary text-apple-xs font-medium hover:bg-apple-fill-secondary transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEditing(article)}
                            disabled={!!modifyingArticle}
                            className="px-3 py-1.5 rounded-apple-sm border border-indigo-400 text-indigo-600 text-apple-xs font-medium hover:bg-indigo-50 transition-colors disabled:opacity-50"
                          >
                            Edit
                          </button>
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
                            {isModifying ? 'Cancel' : 'Modify with AI'}
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
                            onClick={() => copyHtml(article)}
                            className="px-3 py-1.5 rounded-apple-sm bg-green-600 text-white text-apple-xs font-medium hover:bg-green-700 transition-colors"
                          >
                            {isCopied ? 'Copied!' : 'Copy HTML'}
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(article.content);
                              setCopyFeedback(article.id + '-raw');
                              setTimeout(() => setCopyFeedback(null), 2000);
                            }}
                            className="px-3 py-1.5 rounded-apple-sm border border-apple-border text-apple-text-secondary text-apple-xs font-medium hover:bg-apple-fill-secondary transition-colors"
                          >
                            {copyFeedback === article.id + '-raw' ? 'Copied!' : 'Copy Raw'}
                          </button>
                          <div className="flex-1" />
                          <button
                            onClick={() => deleteArticle(article.id)}
                            className="px-3 py-1.5 rounded-apple-sm text-apple-red text-apple-xs font-medium hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>

                    {/* Modify prompt */}
                    {isModifying && !isEditing && (
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
                          disabled={getTask(`blog-modify-${article.id}`)?.status === 'running' || !modifyPrompt.trim()}
                          className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-xs font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
                        >
                          {getTask(`blog-modify-${article.id}`)?.status === 'running' ? (
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
