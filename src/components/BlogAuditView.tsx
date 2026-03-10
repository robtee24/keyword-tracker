import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
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
  gscData?: GscPostData;
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

interface GscPostData {
  totalClicks: number;
  totalImpressions: number;
  keywords: { keyword: string; clicks: number; impressions: number; position: number }[];
}

interface BlogDiscovery {
  id: string;
  project_id: string;
  site_url: string;
  root_path: string;
  blog_name: string;
  posts: BlogPost[];
  overview: BlogOverview | null;
  gsc_data: { [url: string]: GscPostData };
  crawled_at: string;
}

interface BlogOverview {
  summary: string;
  totalClicks: number;
  top5: { url: string; title: string; clicks: number }[];
}

interface MonthlyData {
  month: string;
  clicks: number;
  impressions: number;
}

interface BlogAuditViewProps {
  siteUrl: string;
  projectId: string;
}

type SortColumn = 'title' | 'clicks' | 'impressions';
type SortDir = 'asc' | 'desc';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function BlogAuditView({ siteUrl, projectId }: BlogAuditViewProps) {
  const [blogs, setBlogs] = useState<BlogDiscovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBlogs, setExpandedBlogs] = useState<Set<string>>(new Set());
  const [expandedPost, setExpandedPost] = useState<string | null>(null);

  const [sortColumn, setSortColumn] = useState<SortColumn>('clicks');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [minClicks, setMinClicks] = useState<string>('');
  const [minImpressions, setMinImpressions] = useState<string>('');

  // Post-level monthly graph
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // Blog-level monthly graph
  const [blogMonthlyData, setBlogMonthlyData] = useState<Record<string, MonthlyData[]>>({});
  const [blogMonthlyLoading, setBlogMonthlyLoading] = useState<Set<string>>(new Set());

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
      const data = await parseJsonOrThrow<{ discoveries?: BlogDiscovery[] }>(resp);
      setBlogs(data.discoveries || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [siteUrl, projectId]);

  useEffect(() => { loadDiscoveries(); }, [loadDiscoveries]);

  /* ----- Auto-refresh GSC data if older than 30 days ----- */
  useEffect(() => {
    if (blogs.length === 0 || isDetecting) return;
    const staleBlogs = blogs.filter(b => {
      const age = Date.now() - new Date(b.crawled_at).getTime();
      return age > THIRTY_DAYS_MS;
    });
    if (staleBlogs.length > 0) {
      handleFindAllPosts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blogs.length]);

  /* ----- Handle background detect completion ----- */
  useEffect(() => {
    if (detectTask?.status === 'completed' && detectTask.result) {
      loadDiscoveries();
      clearTask(detectTaskId);
    } else if (detectTask?.status === 'failed') {
      clearTask(detectTaskId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectTask?.status]);

  /* ----- Fetch monthly GSC data when a post is expanded ----- */
  useEffect(() => {
    if (!expandedPost) { setMonthlyData([]); return; }
    let cancelled = false;
    (async () => {
      setMonthlyLoading(true);
      try {
        const resp = await authenticatedFetch(API_ENDPOINTS.blog.gscMonthly, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl, pageUrl: expandedPost }),
        });
        const data = await parseJsonOrThrow<{ months?: MonthlyData[] }>(resp);
        if (!cancelled) setMonthlyData(data.months || []);
      } catch {
        if (!cancelled) setMonthlyData([]);
      }
      if (!cancelled) setMonthlyLoading(false);
    })();
    return () => { cancelled = true; };
  }, [expandedPost, siteUrl]);

  /* ----- Fetch blog-level monthly data when a blog is expanded ----- */
  const fetchBlogMonthly = useCallback(async (rootPath: string) => {
    if (blogMonthlyData[rootPath] || blogMonthlyLoading.has(rootPath)) return;
    setBlogMonthlyLoading(prev => new Set(prev).add(rootPath));
    try {
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.gscBlogMonthly, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, rootPath }),
      });
      const data = await parseJsonOrThrow<{ months?: MonthlyData[] }>(resp);
      setBlogMonthlyData(prev => ({ ...prev, [rootPath]: data.months || [] }));
    } catch {
      setBlogMonthlyData(prev => ({ ...prev, [rootPath]: [] }));
    }
    setBlogMonthlyLoading(prev => { const n = new Set(prev); n.delete(rootPath); return n; });
  }, [siteUrl, blogMonthlyData, blogMonthlyLoading]);

  /* ----- Find All Posts ----- */
  const handleFindAllPosts = () => {
    startTask(detectTaskId, 'blog-detect', `Finding all blog posts on ${siteUrl}`, async () => {
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.detect, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, projectId }),
      });
      const data = await parseJsonOrThrow<{ blogs?: BlogDiscovery[] }>(resp);
      logActivity(siteUrl, 'blog', 'detect', `Found ${data.blogs?.length || 0} blog section(s)`);
      return data;
    });
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
      const data = await parseJsonOrThrow<{
        score?: number; summary?: string; strengths?: string[]; recommendations?: Recommendation[];
      }>(resp);

      const auditResult: AuditResult = {
        score: data.score || 0, summary: data.summary || '',
        strengths: data.strengths || [], recommendations: data.recommendations || [],
      };

      setBlogs(prev => prev.map(b => {
        if (b.root_path !== blog.root_path) return b;
        const updatedPosts = b.posts.map(p =>
          p.url === postUrl ? { ...p, auditResult, auditedAt: new Date().toISOString() } : p
        );
        authenticatedFetch(API_ENDPOINTS.db.blogDiscoveries, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, siteUrl, rootPath: blog.root_path, updates: { posts: updatedPosts } }),
        }).catch(() => {});
        return { ...b, posts: updatedPosts };
      }));

      logActivity(siteUrl, 'blog', 'audit', `Audited post: ${postUrl} — Score: ${auditResult.score}`);
      return auditResult;
    });
  };

  const auditAllPosts = (blog: BlogDiscovery) => {
    blog.posts.filter(p => !p.auditedAt).forEach(p => auditPost(blog, p.url));
  };

  /* ----- Rewrite a single post ----- */
  const rewritePost = (blog: BlogDiscovery, postUrl: string) => {
    const taskId = `blog-rewrite-${postUrl}`;
    startTask(taskId, 'blog-rewrite', `Rewriting: ${postUrl.slice(0, 60)}`, async () => {
      const otherPostUrls = blog.posts.filter(p => p.url !== postUrl).map(p => p.url);
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.rewrite, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, projectId, postUrl, blogRootPath: blog.root_path, otherPostUrls }),
      });
      const data = await parseJsonOrThrow<{ blog?: { articleId?: string } }>(resp);

      setBlogs(prev => prev.map(b => {
        if (b.root_path !== blog.root_path) return b;
        const updatedPosts = b.posts.map(p =>
          p.url === postUrl ? { ...p, rewrittenAt: new Date().toISOString(), articleId: data.blog?.articleId } : p
        );
        authenticatedFetch(API_ENDPOINTS.db.blogDiscoveries, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, siteUrl, rootPath: blog.root_path, updates: { posts: updatedPosts } }),
        }).catch(() => {});
        return { ...b, posts: updatedPosts };
      }));

      logActivity(siteUrl, 'blog', 'rewrite', `Rewrote post: ${postUrl}`);
      return data;
    });
  };

  const rewriteAllPosts = (blog: BlogDiscovery) => {
    blog.posts.filter(p => !p.rewrittenAt).forEach(p => rewritePost(blog, p.url));
  };

  /* ----- Generate Post Ideas ----- */
  const generatePostIdeas = (blog: BlogDiscovery) => {
    const taskId = `blog-ideas-${blog.root_path}`;
    startTask(taskId, 'blog-ideas', `Generating ideas for ${blog.blog_name || blog.root_path}`, async () => {
      const existingTitles = blog.posts.map(p => p.title).filter(Boolean).slice(0, 30);
      const resp = await authenticatedFetch(API_ENDPOINTS.blog.opportunities, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl, projectId,
          context: `Blog section: ${blog.blog_name || blog.root_path}. Existing posts: ${existingTitles.join(', ')}. Generate ideas that complement existing content and fill gaps.`,
        }),
      });
      const data = await parseJsonOrThrow<{ topics?: unknown[] }>(resp);
      logActivity(siteUrl, 'blog', 'ideas', `Generated ${data.topics?.length || 0} post ideas for ${blog.blog_name || blog.root_path}`);
      return data;
    });
  };

  /* ----- Toggle / Sort helpers ----- */
  const toggleBlog = (rootPath: string) => {
    setExpandedBlogs(prev => {
      const n = new Set(prev);
      if (n.has(rootPath)) {
        n.delete(rootPath);
      } else {
        n.add(rootPath);
        fetchBlogMonthly(rootPath);
      }
      return n;
    });
  };

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDir(col === 'title' ? 'asc' : 'desc');
    }
  };

  const sortPosts = useCallback((posts: BlogPost[]) => {
    return [...posts].sort((a, b) => {
      switch (sortColumn) {
        case 'title': {
          const av = (a.title || a.url).toLowerCase();
          const bv = (b.title || b.url).toLowerCase();
          return sortDir === 'asc' ? (av < bv ? -1 : av > bv ? 1 : 0) : (bv < av ? -1 : bv > av ? 1 : 0);
        }
        case 'clicks': {
          const av = a.gscData?.totalClicks || 0;
          const bv = b.gscData?.totalClicks || 0;
          return sortDir === 'asc' ? av - bv : bv - av;
        }
        case 'impressions': {
          const av = a.gscData?.totalImpressions || 0;
          const bv = b.gscData?.totalImpressions || 0;
          return sortDir === 'asc' ? av - bv : bv - av;
        }
      }
    });
  }, [sortColumn, sortDir]);

  /* ----- Filtered blogs & posts ----- */
  const filteredBlogs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const mc = minClicks ? parseInt(minClicks, 10) : 0;
    const mi = minImpressions ? parseInt(minImpressions, 10) : 0;

    return blogs.map(blog => {
      let posts = blog.posts;
      if (mc > 0) posts = posts.filter(p => (p.gscData?.totalClicks || 0) >= mc);
      if (mi > 0) posts = posts.filter(p => (p.gscData?.totalImpressions || 0) >= mi);
      if (q) {
        const blogMatch = blog.blog_name?.toLowerCase().includes(q) || blog.root_path.toLowerCase().includes(q);
        if (!blogMatch) {
          posts = posts.filter(p => p.url.toLowerCase().includes(q) || p.title?.toLowerCase().includes(q));
        }
      }
      if (posts.length === 0 && q && !blog.blog_name?.toLowerCase().includes(q) && !blog.root_path.toLowerCase().includes(q)) {
        return null;
      }
      return { ...blog, posts: sortPosts(posts) };
    }).filter(Boolean) as BlogDiscovery[];
  }, [blogs, searchQuery, minClicks, minImpressions, sortPosts]);

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

  const getScoreColor = (s: number) => s >= 80 ? 'text-green-600' : s >= 60 ? 'text-amber-600' : 'text-red-600';

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortColumn !== col) return <span className="text-apple-text-tertiary ml-0.5">↕</span>;
    return <span className="text-apple-blue ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const postPath = (url: string) => { try { return new URL(url).pathname; } catch { return url; } };

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="space-y-6 max-w-6xl">
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
              {Date.now() - crawledAt > THIRTY_DAYS_MS && (
                <span className="text-amber-600 ml-2">GSC data may be stale</span>
              )}
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

      {/* Search & Filter Bar */}
      {blogs.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search posts by URL or title..."
              className="input text-apple-sm w-full pl-10"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-apple-xs text-apple-text-tertiary whitespace-nowrap">Min Clicks:</label>
            <input type="number" value={minClicks} onChange={e => setMinClicks(e.target.value)} placeholder="0" className="input text-apple-sm w-20 text-center" min={0} />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-apple-xs text-apple-text-tertiary whitespace-nowrap">Min Impr:</label>
            <input type="number" value={minImpressions} onChange={e => setMinImpressions(e.target.value)} placeholder="0" className="input text-apple-sm w-20 text-center" min={0} />
          </div>
        </div>
      )}

      {/* Loading */}
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
            Click &quot;Find All Posts&quot; to crawl your sitemap and discover all blog sections and articles.
          </p>
        </div>
      )}

      {/* Detecting Progress */}
      {isDetecting && blogs.length === 0 && (
        <div className="bg-white rounded-apple border border-apple-border p-6">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="text-apple-sm font-medium text-apple-text">Crawling sitemaps and fetching GSC data...</p>
              <p className="text-apple-xs text-apple-text-tertiary">Parsing sitemap indexes, identifying blog sections, and pulling search performance metrics.</p>
            </div>
          </div>
        </div>
      )}

      {/* Blog Sections */}
      {filteredBlogs.map(blog => {
        const isExpanded = expandedBlogs.has(blog.root_path);
        const totalClicks = blog.overview?.totalClicks || blog.posts.reduce((s, p) => s + (p.gscData?.totalClicks || 0), 0);
        const totalImpressions = blog.posts.reduce((s, p) => s + (p.gscData?.totalImpressions || 0), 0);
        const auditedCount = blog.posts.filter(p => p.auditedAt).length;
        const rewrittenCount = blog.posts.filter(p => p.rewrittenAt).length;
        const blogMonthly = blogMonthlyData[blog.root_path];
        const isBlogMonthlyLoading = blogMonthlyLoading.has(blog.root_path);

        return (
          <div key={blog.root_path} className="bg-white rounded-apple border border-apple-border overflow-hidden">
            {/* Blog Section Header */}
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
                  {totalClicks > 0 && <span className="font-medium">{totalClicks.toLocaleString()} clicks/mo</span>}
                  {totalImpressions > 0 && <span>{totalImpressions.toLocaleString()} impressions/mo</span>}
                  {auditedCount > 0 && <span>{auditedCount} audited</span>}
                  {rewrittenCount > 0 && <span className="text-green-600">{rewrittenCount} rewritten</span>}
                </div>
              </div>

              <svg className={`w-5 h-5 text-apple-text-tertiary transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Blog Action Buttons */}
            <div className="flex items-center gap-2 px-5 pb-3 -mt-1 flex-wrap">
              <button
                onClick={() => auditAllPosts(blog)}
                disabled={blog.posts.every(p => p.auditedAt)}
                className="px-3 py-1 rounded-apple-sm border border-apple-border text-apple-xs font-medium hover:bg-apple-fill-secondary transition-colors disabled:opacity-50"
              >
                {blog.posts.every(p => p.auditedAt) ? 'All Audited' : `Audit All (${blog.posts.filter(p => !p.auditedAt).length})`}
              </button>
              {blog.posts.every(p => p.auditedAt) && (
                <button
                  onClick={() => rewriteAllPosts(blog)}
                  disabled={blog.posts.every(p => p.rewrittenAt)}
                  className="px-3 py-1 rounded-apple-sm bg-apple-blue text-white text-apple-xs font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
                >
                  {blog.posts.every(p => p.rewrittenAt) ? 'All Rewritten' : `Rewrite All (${blog.posts.filter(p => !p.rewrittenAt).length})`}
                </button>
              )}
              <button
                onClick={() => generatePostIdeas(blog)}
                disabled={isGeneratingIdeas(blog.root_path)}
                className="px-3 py-1 rounded-apple-sm border border-apple-border text-apple-xs font-medium hover:bg-apple-fill-secondary transition-colors disabled:opacity-50"
              >
                {isGeneratingIdeas(blog.root_path) ? 'Generating...' : 'Generate Post Ideas'}
              </button>
            </div>

            {/* Expanded Blog Content */}
            {isExpanded && (
              <div className="border-t border-apple-divider">
                {/* Blog-Level Monthly Performance Chart */}
                <div className="px-5 py-4 bg-apple-fill-secondary/30 border-b border-apple-divider">
                  <h4 className="text-sm font-semibold text-apple-text mb-3">
                    {blog.blog_name || 'Blog'} — Monthly Performance (Last 12 Months)
                  </h4>
                  {isBlogMonthlyLoading ? (
                    <div className="flex items-center gap-2 py-6 text-apple-xs text-apple-text-tertiary">
                      <div className="w-3 h-3 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
                      Loading blog performance data...
                    </div>
                  ) : blogMonthly && blogMonthly.length > 0 ? (
                    <MonthlyChart data={blogMonthly} height={240} />
                  ) : blogMonthly ? (
                    <p className="text-apple-xs text-apple-text-tertiary py-3">No monthly data available for this blog.</p>
                  ) : null}

                  {/* Overview summary */}
                  {blog.overview && (
                    <div className="mt-3">
                      <p className="text-apple-sm text-apple-text-secondary">{blog.overview.summary}</p>
                      {blog.overview.top5?.length > 0 && (
                        <div className="mt-2">
                          <h5 className="text-apple-xs font-semibold text-apple-text-secondary mb-1">Top 5 Posts</h5>
                          <div className="space-y-0.5">
                            {blog.overview.top5.map((t, i) => (
                              <div key={i} className="flex items-center gap-2 text-apple-xs">
                                <span className="text-apple-text-tertiary w-3">{i + 1}.</span>
                                <span className="truncate flex-1 text-apple-text">{t.title || postPath(t.url)}</span>
                                <span className="font-medium text-apple-text shrink-0">{t.clicks.toLocaleString()} clicks</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Posts Table — simplified to just Clicks and Impressions */}
                <div className="overflow-x-auto">
                  <table className="w-full text-apple-sm">
                    <thead>
                      <tr className="text-left text-apple-xs text-apple-text-tertiary border-b border-apple-divider bg-apple-fill-secondary/20">
                        <th className="py-2.5 px-5 font-medium">
                          <button onClick={() => handleSort('title')} className="flex items-center hover:text-apple-text">
                            Post <SortIcon col="title" />
                          </button>
                        </th>
                        <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">
                          <button onClick={() => handleSort('clicks')} className="flex items-center justify-end hover:text-apple-text ml-auto">
                            Clicks <SortIcon col="clicks" />
                          </button>
                        </th>
                        <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">
                          <button onClick={() => handleSort('impressions')} className="flex items-center justify-end hover:text-apple-text ml-auto">
                            Impressions <SortIcon col="impressions" />
                          </button>
                        </th>
                        <th className="py-2.5 px-3 font-medium text-center">Status</th>
                        <th className="py-2.5 px-5 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blog.posts.map(post => (
                        <PostRow
                          key={post.url}
                          post={post}
                          isExpanded={expandedPost === post.url}
                          auditing={isPostAuditing(post.url)}
                          rewriting={isPostRewriting(post.url)}
                          monthlyData={expandedPost === post.url ? monthlyData : []}
                          monthlyLoading={expandedPost === post.url ? monthlyLoading : false}
                          getScoreColor={getScoreColor}
                          postPath={postPath}
                          onToggle={() => setExpandedPost(expandedPost === post.url ? null : post.url)}
                          onAudit={() => auditPost(blog, post.url)}
                          onRewrite={() => rewritePost(blog, post.url)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {blog.posts.length === 0 && (
                  <div className="px-5 py-6 text-center text-apple-sm text-apple-text-tertiary">
                    No posts match your current filters.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Monthly Chart (reusable for both blog-level and post-level)        */
/* ------------------------------------------------------------------ */

function MonthlyChart({ data, height = 220 }: { data: MonthlyData[]; height?: number }) {
  return (
    <div className="bg-white rounded-apple border border-apple-border p-4">
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart data={data.map(m => ({
          month: formatMonth(m.month),
          Clicks: m.clicks,
          Impressions: m.impressions,
        }))}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E8E8ED" />
          <XAxis
            dataKey="month"
            tick={{ fill: '#86868B', fontSize: 11 }}
            axisLine={{ stroke: '#E8E8ED' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="clicks"
            tick={{ fill: '#86868B', fontSize: 11 }}
            axisLine={{ stroke: '#E8E8ED' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="impressions"
            orientation="right"
            tick={{ fill: '#86868B', fontSize: 11 }}
            axisLine={{ stroke: '#E8E8ED' }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFF', border: 'none',
              borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              fontSize: '12px',
            }}
          />
          <Line yAxisId="clicks" type="monotone" dataKey="Clicks" stroke="#0071E3" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Line yAxisId="impressions" type="monotone" dataKey="Impressions" stroke="#86868B" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2 }} />
        </RechartsLineChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-6 mt-2 text-apple-xs text-apple-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#0071E3] rounded" /> Clicks
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#86868B] rounded" style={{ borderTop: '2px dashed #86868B', height: 0 }} /> Impressions
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PostRow Sub-Component                                              */
/* ------------------------------------------------------------------ */

interface PostRowProps {
  post: BlogPost;
  isExpanded: boolean;
  auditing: boolean;
  rewriting: boolean;
  monthlyData: MonthlyData[];
  monthlyLoading: boolean;
  getScoreColor: (s: number) => string;
  postPath: (url: string) => string;
  onToggle: () => void;
  onAudit: () => void;
  onRewrite: () => void;
}

function PostRow({
  post, isExpanded, auditing, rewriting,
  monthlyData, monthlyLoading, getScoreColor, postPath,
  onToggle, onAudit, onRewrite,
}: PostRowProps) {
  const clicks = post.gscData?.totalClicks || 0;
  const impressions = post.gscData?.totalImpressions || 0;

  return (
    <>
      <tr
        className={`border-b border-apple-divider hover:bg-apple-fill-secondary/50 cursor-pointer transition-colors ${isExpanded ? 'bg-apple-fill-secondary/30' : ''}`}
        onClick={onToggle}
      >
        {/* Post title + URL */}
        <td className="py-3 px-5 max-w-[400px]">
          <div className="flex items-center gap-2">
            <svg className={`w-3.5 h-3.5 text-apple-text-tertiary transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <div className="min-w-0">
              <div className="text-apple-text font-medium truncate">{post.title || postPath(post.url)}</div>
              <a
                href={post.url} target="_blank" rel="noopener noreferrer"
                className="text-apple-xs text-apple-text-tertiary hover:text-apple-blue hover:underline truncate block"
                onClick={e => e.stopPropagation()}
              >
                {postPath(post.url)}
              </a>
            </div>
          </div>
        </td>

        {/* Clicks */}
        <td className="py-3 px-3 text-right font-medium tabular-nums">
          {clicks > 0 ? clicks.toLocaleString() : <span className="text-apple-text-tertiary">—</span>}
        </td>

        {/* Impressions */}
        <td className="py-3 px-3 text-right text-apple-text-secondary tabular-nums">
          {impressions > 0 ? impressions.toLocaleString() : <span className="text-apple-text-tertiary">—</span>}
        </td>

        {/* Status */}
        <td className="py-3 px-3 text-center">
          {post.rewrittenAt ? (
            <span className="inline-block text-apple-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Rewritten</span>
          ) : post.auditedAt ? (
            <span className="inline-block text-apple-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
              {post.auditResult ? <span className={getScoreColor(post.auditResult.score)}>{post.auditResult.score}</span> : 'Audited'}
            </span>
          ) : (
            <span className="text-apple-text-tertiary text-apple-xs">—</span>
          )}
        </td>

        {/* Actions */}
        <td className="py-3 px-5 text-right" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1.5 justify-end">
            <button onClick={onAudit} disabled={auditing} className="px-2.5 py-1 rounded-apple-sm border border-apple-border text-apple-xs font-medium hover:bg-apple-fill-secondary transition-colors disabled:opacity-50">
              {auditing ? '...' : 'Audit'}
            </button>
            <button onClick={onRewrite} disabled={rewriting} className="px-2.5 py-1 rounded-apple-sm bg-apple-blue text-white text-apple-xs font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50">
              {rewriting ? '...' : 'Rewrite'}
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded Row */}
      {isExpanded && (
        <tr>
          <td colSpan={5} className="p-0">
            <div className="bg-apple-fill-secondary/30 px-5 py-4 space-y-4 border-b border-apple-divider">
              {/* Meta info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {post.title && (
                  <div>
                    <span className="text-apple-xs font-semibold text-apple-text-secondary block mb-0.5">Meta Title</span>
                    <p className="text-apple-sm text-apple-text">{post.title}</p>
                  </div>
                )}
                {post.metaDescription && (
                  <div>
                    <span className="text-apple-xs font-semibold text-apple-text-secondary block mb-0.5">Meta Description</span>
                    <p className="text-apple-sm text-apple-text">{post.metaDescription}</p>
                  </div>
                )}
              </div>

              {/* Post Monthly Performance Graph */}
              <div>
                <h5 className="text-apple-xs font-semibold text-apple-text-secondary mb-2">Monthly Performance (Last 12 Months)</h5>
                {monthlyLoading ? (
                  <div className="flex items-center gap-2 py-4 text-apple-xs text-apple-text-tertiary">
                    <div className="w-3 h-3 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
                    Loading monthly data...
                  </div>
                ) : monthlyData.length > 0 ? (
                  <MonthlyChart data={monthlyData} />
                ) : (
                  <p className="text-apple-xs text-apple-text-tertiary py-2">No monthly data available for this post.</p>
                )}
              </div>

              {/* Keywords this page ranks for */}
              {post.gscData?.keywords && post.gscData.keywords.length > 0 && (
                <div>
                  <h5 className="text-apple-xs font-semibold text-apple-text-secondary mb-2">
                    Keywords Indexing For ({post.gscData.keywords.length})
                  </h5>
                  <div className="bg-white rounded-apple border border-apple-border overflow-x-auto">
                    <table className="w-full text-apple-xs">
                      <thead>
                        <tr className="text-left text-apple-text-tertiary border-b border-apple-divider">
                          <th className="py-2 px-3 font-medium">Keyword</th>
                          <th className="py-2 px-3 font-medium text-right">Clicks</th>
                          <th className="py-2 px-3 font-medium text-right">Impressions</th>
                          <th className="py-2 px-3 font-medium text-right">Position</th>
                        </tr>
                      </thead>
                      <tbody>
                        {post.gscData.keywords.map((kw, i) => (
                          <tr key={i} className="border-b border-apple-divider/50">
                            <td className="py-1.5 px-3 text-apple-text">{kw.keyword}</td>
                            <td className="py-1.5 px-3 text-right font-medium tabular-nums">{kw.clicks}</td>
                            <td className="py-1.5 px-3 text-right text-apple-text-secondary tabular-nums">{kw.impressions.toLocaleString()}</td>
                            <td className="py-1.5 px-3 text-right text-apple-text-secondary tabular-nums">{kw.position}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Audit Results */}
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
          </td>
        </tr>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = parseInt(month, 10) - 1;
  return `${months[idx] || month} '${year.slice(2)}`;
}
