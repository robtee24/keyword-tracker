import { useState, useEffect, useCallback, useMemo } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { authenticatedFetch } from '../services/authService';
import { logActivity } from '../utils/activityLog';
import { useBackgroundTasks } from '../contexts/BackgroundTaskContext';
import { parseJsonOrThrow } from '../utils/apiResponse';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BlogPost {
  url: string;
  title: string;
  metaDescription: string;
  gscData?: {
    totalClicks: number;
    totalImpressions: number;
    keywords: { keyword: string; clicks: number; impressions: number; position: number }[];
  };
  auditResult?: AuditResult;
  auditedAt?: string;
  rewrittenAt?: string;
  articleId?: string;
}

interface AuditResult {
  score: number;
  summary: string;
  strengths: string[];
  recommendations: Recommendation[];
}

interface Recommendation {
  priority: string;
  category: string;
  issue: string;
  recommendation: string;
  howToFix: string;
  impact: string;
}

interface BlogDiscovery {
  id: string;
  project_id: string;
  site_url: string;
  root_path: string;
  blog_name: string;
  posts: BlogPost[];
  overview: BlogOverview | null;
  gsc_data: Record<string, unknown>;
  crawled_at: string;
}

interface BlogOverview {
  summary: string;
  totalClicks: number;
  top5: { url: string; title: string; clicks: number }[];
}

interface BlogAuditViewProps {
  siteUrl: string;
  projectId: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function BlogAuditView({ siteUrl, projectId }: BlogAuditViewProps) {
  const [blogs, setBlogs] = useState<BlogDiscovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBlogs, setExpandedBlogs] = useState<Set<string>>(new Set());
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [expandedKeywords, setExpandedKeywords] = useState<Set<string>>(new Set());
  const [gscLoading, setGscLoading] = useState<Set<string>>(new Set());

  const { startTask, getTask, clearTask } = useBackgroundTasks();
  const detectTaskId = `blog-detect-${projectId}`;
  const detectTask = getTask(detectTaskId);
  const isDetecting = detectTask?.status === 'running';

  /* ----- Load saved discoveries ----- */
  const loadDiscoveries = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await authenticatedFetch(
        `${API_ENDPOINTS.db.blogDiscoveries}?siteUrl=${encodeURIComponent(siteUrl)}&projectId=${projectId}`
      );
      const data = await parseJsonOrThrow(resp);
      setBlogs(data.discoveries || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [siteUrl, projectId]);

  useEffect(() => { loadDiscoveries(); }, [loadDiscoveries]);

  /* ----- Handle background detect completion ----- */
  useEffect(() => {
    if (detectTask?.status === 'completed' && detectTask.result) {
      const data = detectTask.result as { blogs: BlogDiscovery[] };
      if (data.blogs?.length) {
        loadDiscoveries();
      }
      clearTask(detectTaskId);
    } else if (detectTask?.status === 'failed') {
      clearTask(detectTaskId);
    }
  }, [detectTask?.status]);

  /* ----- Find All Posts ----- */
  const handleFindAllPosts = () => {
    startTask(detectTaskId, 'blog-detect', `Finding all blog posts on ${siteUrl}`, async () => {
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.detect, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, projectId }),
      });
      const data = await parseJsonOrThrow(resp);
      logActivity(siteUrl, 'blog', 'detect', `Found ${data.blogs?.length || 0} blog section(s)`);
      return data;
    });
  };

  /* ----- Fetch GSC Data for a blog ----- */
  const fetchGscData = async (blog: BlogDiscovery) => {
    const key = blog.root_path;
    setGscLoading(prev => new Set(prev).add(key));
    try {
      const urls = blog.posts.map(p => p.url);
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.discoverPosts, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, urls }),
      });
      const data = await parseJsonOrThrow(resp);
      const gscMap = data.data || {};

      const updatedPosts = blog.posts.map(p => ({
        ...p,
        gscData: gscMap[p.url] || p.gscData || { totalClicks: 0, totalImpressions: 0, keywords: [] },
      }));

      // Build overview
      const totalClicks = updatedPosts.reduce((s, p) => s + (p.gscData?.totalClicks || 0), 0);
      const sorted = [...updatedPosts].sort((a, b) => (b.gscData?.totalClicks || 0) - (a.gscData?.totalClicks || 0));
      const top5 = sorted.slice(0, 5).map(p => ({ url: p.url, title: p.title, clicks: p.gscData?.totalClicks || 0 }));
      const overview: BlogOverview = {
        summary: `${blog.blog_name || blog.root_path} contains ${updatedPosts.length} posts with ${totalClicks.toLocaleString()} total monthly clicks.`,
        totalClicks,
        top5,
      };

      // Persist to DB
      await authenticatedFetch(API_ENDPOINTS.db.blogDiscoveries, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          siteUrl,
          rootPath: blog.root_path,
          updates: { posts: updatedPosts, overview, gscData: gscMap },
        }),
      });

      setBlogs(prev => prev.map(b =>
        b.root_path === blog.root_path ? { ...b, posts: updatedPosts, overview, gsc_data: gscMap } : b
      ));
    } catch (err) {
      console.error('Failed to fetch GSC data:', err);
    }
    setGscLoading(prev => { const n = new Set(prev); n.delete(key); return n; });
  };

  /* ----- Audit a single post ----- */
  const auditPost = (blog: BlogDiscovery, postUrl: string) => {
    const taskId = `blog-audit-post-${postUrl}`;
    startTask(taskId, 'blog-audit', `Auditing: ${postUrl.slice(0, 60)}`, async () => {
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.audit, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, projectId, blogUrl: postUrl, mode: 'single' }),
      });
      const data = await parseJsonOrThrow(resp);

      const auditResult: AuditResult = {
        score: data.score || 0,
        summary: data.summary || '',
        strengths: data.strengths || [],
        recommendations: data.recommendations || [],
      };

      // Update the post in local state + persist
      setBlogs(prev => prev.map(b => {
        if (b.root_path !== blog.root_path) return b;
        const updatedPosts = b.posts.map(p =>
          p.url === postUrl ? { ...p, auditResult, auditedAt: new Date().toISOString() } : p
        );
        // Persist asynchronously
        authenticatedFetch(API_ENDPOINTS.db.blogDiscoveries, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, siteUrl, rootPath: blog.root_path, updates: { posts: updatedPosts } }),
        }).catch(() => {});
        return { ...b, posts: updatedPosts };
      }));

      logActivity(siteUrl, 'blog', 'audit', `Audited post: ${postUrl} — Score: ${auditResult.score}`);
      return auditResult;
    });
  };

  /* ----- Audit all posts in a blog ----- */
  const auditAllPosts = (blog: BlogDiscovery) => {
    const unaudited = blog.posts.filter(p => !p.auditedAt);
    for (const post of unaudited) {
      auditPost(blog, post.url);
    }
  };

  /* ----- Rewrite a single post ----- */
  const rewritePost = (blog: BlogDiscovery, postUrl: string) => {
    const taskId = `blog-rewrite-${postUrl}`;
    startTask(taskId, 'blog-rewrite', `Rewriting: ${postUrl.slice(0, 60)}`, async () => {
      const otherPostUrls = blog.posts.filter(p => p.url !== postUrl).map(p => p.url);
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.rewrite, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, projectId, postUrl, blogRootPath: blog.root_path, otherPostUrls }),
      });
      const data = await parseJsonOrThrow(resp);

      // Mark as rewritten in local state
      setBlogs(prev => prev.map(b => {
        if (b.root_path !== blog.root_path) return b;
        const updatedPosts = b.posts.map(p =>
          p.url === postUrl ? { ...p, rewrittenAt: new Date().toISOString(), articleId: data.blog?.articleId } : p
        );
        authenticatedFetch(API_ENDPOINTS.db.blogDiscoveries, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, siteUrl, rootPath: blog.root_path, updates: { posts: updatedPosts } }),
        }).catch(() => {});
        return { ...b, posts: updatedPosts };
      }));

      logActivity(siteUrl, 'blog', 'rewrite', `Rewrote post: ${postUrl}`);
      return data;
    });
  };

  /* ----- Rewrite all posts in a blog ----- */
  const rewriteAllPosts = (blog: BlogDiscovery) => {
    const unrewritten = blog.posts.filter(p => !p.rewrittenAt);
    for (const post of unrewritten) {
      rewritePost(blog, post.url);
    }
  };

  /* ----- Generate Post Ideas (routes to Blog Ideas section) ----- */
  const generatePostIdeas = async (blog: BlogDiscovery) => {
    const taskId = `blog-ideas-${blog.root_path}`;
    startTask(taskId, 'blog-ideas', `Generating ideas for ${blog.blog_name || blog.root_path}`, async () => {
      const existingTitles = blog.posts.map(p => p.title).filter(Boolean).slice(0, 30);
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.opportunities, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          projectId,
          context: `Blog section: ${blog.blog_name || blog.root_path}. Existing posts: ${existingTitles.join(', ')}. Generate ideas that complement existing content and fill gaps.`,
        }),
      });
      const data = await parseJsonOrThrow(resp);
      logActivity(siteUrl, 'blog', 'ideas', `Generated ${data.topics?.length || 0} post ideas for ${blog.blog_name || blog.root_path}`);
      return data;
    });
  };

  /* ----- Toggle helpers ----- */
  const toggleBlog = (rootPath: string) => {
    setExpandedBlogs(prev => {
      const n = new Set(prev);
      n.has(rootPath) ? n.delete(rootPath) : n.add(rootPath);
      return n;
    });
  };

  const togglePost = (url: string) => {
    setExpandedPosts(prev => {
      const n = new Set(prev);
      n.has(url) ? n.delete(url) : n.add(url);
      return n;
    });
  };

  const toggleKeywords = (url: string) => {
    setExpandedKeywords(prev => {
      const n = new Set(prev);
      n.has(url) ? n.delete(url) : n.add(url);
      return n;
    });
  };

  /* ----- Search filtering ----- */
  const filteredBlogs = useMemo(() => {
    if (!searchQuery.trim()) return blogs;
    const q = searchQuery.toLowerCase();
    return blogs.map(blog => {
      const blogNameMatch = blog.blog_name?.toLowerCase().includes(q) || blog.root_path.toLowerCase().includes(q);
      const matchingPosts = blog.posts.filter(p =>
        p.url.toLowerCase().includes(q) || p.title?.toLowerCase().includes(q)
      );
      if (blogNameMatch) return blog;
      if (matchingPosts.length > 0) return { ...blog, posts: matchingPosts };
      return null;
    }).filter(Boolean) as BlogDiscovery[];
  }, [blogs, searchQuery]);

  /* ----- Task status helpers ----- */
  const isPostAuditing = (url: string) => getTask(`blog-audit-post-${url}`)?.status === 'running';
  const isPostRewriting = (url: string) => getTask(`blog-rewrite-${url}`)?.status === 'running';
  const isGeneratingIdeas = (rootPath: string) => getTask(`blog-ideas-${rootPath}`)?.status === 'running';

  const crawledAt = blogs.length > 0
    ? blogs.reduce((latest, b) => {
        const d = new Date(b.crawled_at).getTime();
        return d > latest ? d : latest;
      }, 0)
    : null;

  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-600';
    if (s >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-apple-text">Find All Posts</h1>
          <p className="text-apple-sm text-apple-text-secondary mt-1">
            Discover blog sections from your sitemap, view GSC performance, audit posts, and rewrite content.
          </p>
          {crawledAt && (
            <p className="text-apple-xs text-apple-text-tertiary mt-1">
              Last crawled: {new Date(crawledAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {blogs.length > 0 && (
            <button
              onClick={handleFindAllPosts}
              disabled={isDetecting}
              className="px-3 py-1.5 rounded-apple-sm border border-apple-border text-apple-sm font-medium hover:bg-apple-fill-secondary transition-colors disabled:opacity-50"
            >
              {isDetecting ? 'Crawling...' : 'Find New Posts'}
            </button>
          )}
          <button
            onClick={handleFindAllPosts}
            disabled={isDetecting}
            className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
          >
            {isDetecting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Crawling Sitemaps...
              </span>
            ) : blogs.length > 0 ? 'Re-Crawl All' : 'Find All Posts'}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {blogs.length > 0 && (
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search blog posts by URL or title..."
            className="input text-apple-sm w-full pl-10"
          />
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center gap-2 py-8 justify-center text-apple-text-secondary text-apple-sm">
          <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
          Loading discoveries...
        </div>
      )}

      {/* Empty State */}
      {!loading && blogs.length === 0 && !isDetecting && (
        <div className="bg-white rounded-apple border border-apple-border p-8 text-center">
          <div className="text-4xl mb-3">📝</div>
          <h3 className="text-base font-semibold text-apple-text mb-1">No blog posts found yet</h3>
          <p className="text-apple-sm text-apple-text-secondary mb-4">
            Click "Find All Posts" to crawl your sitemap and discover all blog sections and articles.
          </p>
        </div>
      )}

      {/* Detecting Progress */}
      {isDetecting && blogs.length === 0 && (
        <div className="bg-white rounded-apple border border-apple-border p-6">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="text-apple-sm font-medium text-apple-text">Crawling sitemaps...</p>
              <p className="text-apple-xs text-apple-text-tertiary">Recursively parsing sitemap indexes and identifying blog sections.</p>
            </div>
          </div>
        </div>
      )}

      {/* Blog Cards */}
      {filteredBlogs.map(blog => {
        const isExpanded = expandedBlogs.has(blog.root_path);
        const totalClicks = blog.overview?.totalClicks || blog.posts.reduce((s, p) => s + (p.gscData?.totalClicks || 0), 0);
        const auditedCount = blog.posts.filter(p => p.auditedAt).length;
        const rewrittenCount = blog.posts.filter(p => p.rewrittenAt).length;
        const hasGscData = blog.posts.some(p => p.gscData);
        const isLoadingGsc = gscLoading.has(blog.root_path);

        return (
          <div key={blog.root_path} className="bg-white rounded-apple border border-apple-border overflow-hidden">
            {/* Blog Card Header */}
            <button
              onClick={() => toggleBlog(blog.root_path)}
              className="w-full flex items-center gap-4 p-5 text-left hover:bg-apple-fill-secondary/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-apple-text">{blog.blog_name || 'Blog'}</h3>
                  <span className="text-apple-xs text-apple-text-tertiary bg-apple-fill-secondary px-2 py-0.5 rounded-full">
                    {blog.root_path}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-apple-xs text-apple-text-secondary">
                  <span>{blog.posts.length} post{blog.posts.length !== 1 ? 's' : ''}</span>
                  {totalClicks > 0 && <span>{totalClicks.toLocaleString()} monthly clicks</span>}
                  {auditedCount > 0 && <span>{auditedCount} audited</span>}
                  {rewrittenCount > 0 && <span className="text-green-600">{rewrittenCount} rewritten</span>}
                </div>
                {blog.overview?.summary && (
                  <p className="text-apple-xs text-apple-text-tertiary mt-1 line-clamp-2">{blog.overview.summary}</p>
                )}
              </div>

              {/* Top 5 mini-list (collapsed only) */}
              {!isExpanded && blog.overview?.top5 && blog.overview.top5.length > 0 && (
                <div className="hidden md:block text-right shrink-0 max-w-[300px]">
                  {blog.overview.top5.slice(0, 3).map((t, i) => (
                    <div key={i} className="text-apple-xs text-apple-text-tertiary truncate">
                      {t.title || new URL(t.url).pathname} — <span className="font-medium">{t.clicks} clicks</span>
                    </div>
                  ))}
                </div>
              )}

              <svg className={`w-5 h-5 text-apple-text-tertiary transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Blog Card Actions (always visible) */}
            <div className="flex items-center gap-2 px-5 pb-3 -mt-1">
              {!hasGscData && (
                <button
                  onClick={(e) => { e.stopPropagation(); fetchGscData(blog); }}
                  disabled={isLoadingGsc}
                  className="px-3 py-1 rounded-apple-sm border border-apple-border text-apple-xs font-medium hover:bg-apple-fill-secondary transition-colors disabled:opacity-50"
                >
                  {isLoadingGsc ? 'Loading GSC...' : 'Load GSC Data'}
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); auditAllPosts(blog); }}
                disabled={blog.posts.every(p => p.auditedAt)}
                className="px-3 py-1 rounded-apple-sm border border-apple-border text-apple-xs font-medium hover:bg-apple-fill-secondary transition-colors disabled:opacity-50"
              >
                {blog.posts.every(p => p.auditedAt) ? 'All Audited' : `Audit All (${blog.posts.filter(p => !p.auditedAt).length})`}
              </button>
              {blog.posts.every(p => p.auditedAt) && (
                <button
                  onClick={(e) => { e.stopPropagation(); rewriteAllPosts(blog); }}
                  disabled={blog.posts.every(p => p.rewrittenAt)}
                  className="px-3 py-1 rounded-apple-sm bg-apple-blue text-white text-apple-xs font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
                >
                  {blog.posts.every(p => p.rewrittenAt) ? 'All Rewritten' : `Rewrite All (${blog.posts.filter(p => !p.rewrittenAt).length})`}
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); generatePostIdeas(blog); }}
                disabled={isGeneratingIdeas(blog.root_path)}
                className="px-3 py-1 rounded-apple-sm border border-apple-border text-apple-xs font-medium hover:bg-apple-fill-secondary transition-colors disabled:opacity-50"
              >
                {isGeneratingIdeas(blog.root_path) ? 'Generating...' : 'Generate Post Ideas'}
              </button>
              {hasGscData && (
                <button
                  onClick={(e) => { e.stopPropagation(); fetchGscData(blog); }}
                  disabled={isLoadingGsc}
                  className="px-3 py-1 rounded-apple-sm border border-apple-border text-apple-xs font-medium hover:bg-apple-fill-secondary transition-colors disabled:opacity-50"
                >
                  {isLoadingGsc ? 'Refreshing...' : 'Refresh GSC'}
                </button>
              )}
            </div>

            {/* Expanded: Full Post List */}
            {isExpanded && (
              <div className="border-t border-apple-divider">
                {/* Overview section */}
                {blog.overview && (
                  <div className="px-5 py-4 bg-apple-fill-secondary/30 border-b border-apple-divider">
                    <h4 className="text-sm font-semibold text-apple-text mb-2">Overview</h4>
                    <p className="text-apple-sm text-apple-text-secondary">{blog.overview.summary}</p>
                    {blog.overview.top5?.length > 0 && (
                      <div className="mt-3">
                        <h5 className="text-apple-xs font-semibold text-apple-text-secondary mb-1">Top 5 Posts by Clicks</h5>
                        <div className="space-y-1">
                          {blog.overview.top5.map((t, i) => (
                            <div key={i} className="flex items-center gap-2 text-apple-xs">
                              <span className="text-apple-text-tertiary w-4">{i + 1}.</span>
                              <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-apple-blue hover:underline truncate flex-1">
                                {t.title || new URL(t.url).pathname}
                              </a>
                              <span className="font-medium text-apple-text shrink-0">{t.clicks.toLocaleString()} clicks</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Posts list */}
                <div className="divide-y divide-apple-divider">
                  {blog.posts.map(post => {
                    const postExpanded = expandedPosts.has(post.url);
                    const kwExpanded = expandedKeywords.has(post.url);
                    const auditing = isPostAuditing(post.url);
                    const rewriting = isPostRewriting(post.url);
                    const postPath = (() => { try { return new URL(post.url).pathname; } catch { return post.url; } })();

                    return (
                      <div key={post.url}>
                        <div
                          className="flex items-center gap-3 px-5 py-3 hover:bg-apple-fill-secondary/50 transition-colors cursor-pointer"
                          onClick={() => togglePost(post.url)}
                        >
                          {/* Score badge */}
                          {post.auditResult && (
                            <span className={`text-sm font-bold w-8 text-center ${getScoreColor(post.auditResult.score)}`}>
                              {post.auditResult.score}
                            </span>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-apple-sm text-apple-text font-medium truncate">
                                {post.title || postPath}
                              </span>
                              {post.rewrittenAt && (
                                <span className="text-apple-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded shrink-0">Rewritten</span>
                              )}
                              {post.auditedAt && !post.rewrittenAt && (
                                <span className="text-apple-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded shrink-0">Audited</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-apple-xs text-apple-text-tertiary mt-0.5">
                              <a href={post.url} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-apple-blue truncate" onClick={e => e.stopPropagation()}>
                                {postPath}
                              </a>
                              {post.gscData && (
                                <>
                                  <span>{post.gscData.totalClicks.toLocaleString()} clicks</span>
                                  <span>{post.gscData.totalImpressions.toLocaleString()} impressions</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => auditPost(blog, post.url)}
                              disabled={auditing}
                              className="px-2.5 py-1 rounded-apple-sm border border-apple-border text-apple-xs font-medium hover:bg-apple-fill-secondary transition-colors disabled:opacity-50"
                            >
                              {auditing ? 'Auditing...' : 'Audit Post'}
                            </button>
                            <button
                              onClick={() => rewritePost(blog, post.url)}
                              disabled={rewriting}
                              className="px-2.5 py-1 rounded-apple-sm bg-apple-blue text-white text-apple-xs font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
                            >
                              {rewriting ? 'Rewriting...' : 'Rewrite'}
                            </button>
                          </div>

                          <svg className={`w-4 h-4 text-apple-text-tertiary transition-transform shrink-0 ${postExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>

                        {/* Post expanded details */}
                        {postExpanded && (
                          <div className="px-5 pb-4 pt-1 bg-apple-fill-secondary/30 space-y-3">
                            {/* Meta info */}
                            <div className="grid grid-cols-1 gap-2">
                              {post.title && (
                                <div>
                                  <span className="text-apple-xs font-semibold text-apple-text-secondary">Meta Title</span>
                                  <p className="text-apple-sm text-apple-text">{post.title}</p>
                                </div>
                              )}
                              {post.metaDescription && (
                                <div>
                                  <span className="text-apple-xs font-semibold text-apple-text-secondary">Meta Description</span>
                                  <p className="text-apple-sm text-apple-text">{post.metaDescription}</p>
                                </div>
                              )}
                            </div>

                            {/* GSC Keyword data */}
                            {post.gscData?.keywords && post.gscData.keywords.length > 0 && (
                              <div>
                                <button
                                  onClick={() => toggleKeywords(post.url)}
                                  className="flex items-center gap-1 text-apple-xs font-semibold text-apple-text-secondary hover:text-apple-text"
                                >
                                  Keywords ({post.gscData.keywords.length})
                                  <svg className={`w-3 h-3 transition-transform ${kwExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                {kwExpanded && (
                                  <div className="mt-2 overflow-x-auto">
                                    <table className="w-full text-apple-xs">
                                      <thead>
                                        <tr className="text-left text-apple-text-tertiary border-b border-apple-divider">
                                          <th className="pb-1 pr-4 font-medium">Keyword</th>
                                          <th className="pb-1 pr-4 font-medium text-right">Clicks</th>
                                          <th className="pb-1 pr-4 font-medium text-right">Impressions</th>
                                          <th className="pb-1 font-medium text-right">Position</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {post.gscData.keywords.slice(0, 20).map((kw, i) => (
                                          <tr key={i} className="border-b border-apple-divider/50">
                                            <td className="py-1.5 pr-4 text-apple-text">{kw.keyword}</td>
                                            <td className="py-1.5 pr-4 text-right font-medium">{kw.clicks}</td>
                                            <td className="py-1.5 pr-4 text-right text-apple-text-secondary">{kw.impressions.toLocaleString()}</td>
                                            <td className="py-1.5 text-right text-apple-text-secondary">{kw.position}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Audit results */}
                            {post.auditResult && (
                              <div className="space-y-2">
                                <h5 className="text-apple-xs font-semibold text-apple-text-secondary">
                                  Audit Score: <span className={getScoreColor(post.auditResult.score)}>{post.auditResult.score}/100</span>
                                </h5>
                                <p className="text-apple-xs text-apple-text-secondary">{post.auditResult.summary}</p>
                                {post.auditResult.strengths?.length > 0 && (
                                  <ul className="space-y-0.5">
                                    {post.auditResult.strengths.map((s, i) => (
                                      <li key={i} className="text-apple-xs text-apple-text-secondary flex gap-1.5">
                                        <span className="text-green-500 shrink-0">✓</span> {s}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {post.auditResult.recommendations?.length > 0 && (
                                  <div className="space-y-1.5 mt-2">
                                    <h5 className="text-apple-xs font-semibold text-apple-text-secondary">Recommendations</h5>
                                    {post.auditResult.recommendations.map((rec, ri) => (
                                      <div key={ri} className="bg-white rounded-apple-sm p-2.5 border border-apple-border">
                                        <div className="flex items-start gap-2">
                                          <span className={`text-apple-xs px-1.5 py-0.5 rounded shrink-0 ${
                                            rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                                            rec.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                                            'bg-green-100 text-green-700'
                                          }`}>{rec.priority}</span>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-apple-xs text-apple-text font-medium">{rec.issue}</p>
                                            <p className="text-apple-xs text-apple-text-secondary mt-0.5">{rec.recommendation}</p>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
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
  );
}
