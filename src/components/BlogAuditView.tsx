import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { logActivity } from '../utils/activityLog';

interface BlogUrl {
  id?: string;
  site_url: string;
  blog_url: string;
  added_at: string;
}

interface Recommendation {
  priority: string;
  category: string;
  issue: string;
  recommendation: string;
  howToFix: string;
  impact: string;
  done?: boolean;
}

interface PostResult {
  url: string;
  score: number;
  summary: string;
  strengths: string[];
  recommendations: Recommendation[];
  error?: string;
}

interface BlogAuditResult {
  blogUrl: string;
  mode: 'single' | 'full';
  overview?: { score: number; summary: string; strengths: string[]; recommendations: Recommendation[] };
  posts?: PostResult[];
  totalPosts?: number;
  auditedPosts?: number;
  score?: number;
  summary?: string;
  strengths?: string[];
  recommendations?: Recommendation[];
  error?: string;
}

interface SavedAudit {
  blog_url: string;
  audit_mode: string;
  score: number;
  summary: string;
  strengths: string[];
  recommendations: Recommendation[];
  audited_at: string;
}

type AuditTab = 'summary' | 'by-post' | 'recommendations';

interface BlogAuditViewProps {
  siteUrl: string;
}

export default function BlogAuditView({ siteUrl }: BlogAuditViewProps) {
  const [blogUrls, setBlogUrls] = useState<BlogUrl[]>([]);
  const [newBlogUrl, setNewBlogUrl] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selectedBlog, setSelectedBlog] = useState('');
  const [auditMode, setAuditMode] = useState<'single' | 'full'>('full');
  const [singleUrl, setSingleUrl] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');

  const [result, setResult] = useState<BlogAuditResult | null>(null);
  const [savedAudits, setSavedAudits] = useState<SavedAudit[]>([]);
  const [activeTab, setActiveTab] = useState<AuditTab>('summary');
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [expandedRecs, setExpandedRecs] = useState<Set<string>>(new Set());

  const loadBlogUrls = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_ENDPOINTS.db.blogUrls}?siteUrl=${encodeURIComponent(siteUrl)}`);
      const data = await resp.json();
      setBlogUrls(data.urls || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [siteUrl]);

  const loadSavedAudits = useCallback(async () => {
    try {
      const resp = await fetch(`${API_ENDPOINTS.db.blogAudits}?siteUrl=${encodeURIComponent(siteUrl)}`);
      const data = await resp.json();
      setSavedAudits(data.audits || []);
    } catch { /* ignore */ }
  }, [siteUrl]);

  useEffect(() => {
    loadBlogUrls();
    loadSavedAudits();
  }, [loadBlogUrls, loadSavedAudits]);

  const detectBlogUrls = async () => {
    setDetecting(true);
    try {
      const resp = await fetch(`${API_ENDPOINTS.blog.detect}?siteUrl=${encodeURIComponent(siteUrl)}`);
      const data = await resp.json();
      const detected = data.blogUrls || [];
      for (const url of detected) {
        await fetch(API_ENDPOINTS.db.blogUrls, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl, blogUrl: url }),
        });
      }
      await loadBlogUrls();
    } catch (err) {
      console.error('Detection failed:', err);
    }
    setDetecting(false);
  };

  const addBlogUrl = async () => {
    if (!newBlogUrl.trim()) return;
    let url = newBlogUrl.trim();
    if (!url.startsWith('http')) url = `https://${url}`;
    if (!url.endsWith('/')) url += '/';

    await fetch(API_ENDPOINTS.db.blogUrls, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteUrl, blogUrl: url }),
    });
    setNewBlogUrl('');
    await loadBlogUrls();
  };

  const removeBlogUrl = async (blogUrl: string) => {
    await fetch(API_ENDPOINTS.db.blogUrls, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteUrl, blogUrl }),
    });
    await loadBlogUrls();
  };

  const runAudit = async () => {
    const targetUrl = auditMode === 'single' ? singleUrl.trim() : selectedBlog;
    if (!targetUrl) return;

    setRunning(true);
    setResult(null);
    setProgress(auditMode === 'full' ? 'Discovering blog posts and running audits...' : 'Auditing blog post...');

    try {
      const resp = await fetch(API_ENDPOINTS.blog.audit, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, blogUrl: targetUrl, mode: auditMode }),
      });
      const data: BlogAuditResult = await resp.json();
      setResult(data);
      setActiveTab('summary');
      await loadSavedAudits();
      const postCount = data.posts?.length || 0;
      logActivity(siteUrl, 'blog', 'audit', `Blog audit completed: ${auditMode === 'full' ? `Full audit (${postCount} posts)` : `Single post: ${targetUrl}`} — Score: ${data.overallScore || data.posts?.[0]?.score || 'N/A'}`);
    } catch (err) {
      console.error('Audit failed:', err);
    }
    setRunning(false);
    setProgress('');
  };

  const togglePost = (url: string) => {
    setExpandedPosts((prev) => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });
  };

  const toggleRec = (key: string) => {
    setExpandedRecs((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const addToTasklist = async (rec: Recommendation, source: string) => {
    try {
      await fetch(API_ENDPOINTS.db.completedTasks, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          keyword: `blog:${source}`,
          taskId: `blog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          taskText: `${rec.issue} → ${rec.recommendation}`,
          category: rec.category,
          status: 'pending',
        }),
      });
    } catch (err) {
      console.error('Failed to add to tasklist:', err);
    }
  };

  const getPriorityColor = (p: string) => {
    if (p === 'high') return 'bg-red-100 text-red-700';
    if (p === 'medium') return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };

  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-600';
    if (s >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const allRecs: (Recommendation & { source: string })[] = [];
  if (result) {
    if (result.mode === 'full') {
      for (const rec of result.overview?.recommendations || []) {
        allRecs.push({ ...rec, source: 'Blog Strategy' });
      }
      for (const post of result.posts || []) {
        for (const rec of post.recommendations || []) {
          allRecs.push({ ...rec, source: post.url });
        }
      }
    } else {
      for (const rec of result.recommendations || []) {
        allRecs.push({ ...rec, source: result.blogUrl });
      }
    }
  }

  if (allRecs.length === 0 && savedAudits.length > 0 && !result) {
    for (const a of savedAudits) {
      for (const rec of a.recommendations || []) {
        allRecs.push({ ...rec, source: a.blog_url });
      }
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-apple-text">Blog Audit</h1>
        <p className="text-apple-sm text-apple-text-secondary mt-1">
          Audit individual blog posts or your entire blog for content quality, SEO, engagement, and conversion optimization.
        </p>
      </div>

      {/* Blog URLs Section */}
      <div className="bg-white rounded-apple border border-apple-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-apple-text">Blog URLs</h2>
          <button
            onClick={detectBlogUrls}
            disabled={detecting}
            className="px-3 py-1.5 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
          >
            {detecting ? 'Detecting...' : 'Auto-Detect from Sitemap'}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-apple-text-secondary text-apple-sm">
            <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
            Loading...
          </div>
        ) : blogUrls.length === 0 ? (
          <p className="text-apple-sm text-apple-text-tertiary py-3">
            No blog URLs found. Use auto-detect or add one manually.
          </p>
        ) : (
          <div className="space-y-2 mb-4">
            {blogUrls.map((bu) => (
              <div key={bu.blog_url} className="flex items-center gap-3 py-2 px-3 bg-apple-fill-secondary rounded-apple-sm">
                <a href={bu.blog_url} target="_blank" rel="noopener noreferrer" className="text-apple-sm text-apple-blue hover:underline flex-1 truncate">
                  {bu.blog_url}
                </a>
                <button onClick={() => removeBlogUrl(bu.blog_url)} className="text-apple-text-tertiary hover:text-apple-red text-apple-xs">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={newBlogUrl}
            onChange={(e) => setNewBlogUrl(e.target.value)}
            placeholder="https://example.com/blog/"
            className="input text-apple-sm flex-1"
            onKeyDown={(e) => e.key === 'Enter' && addBlogUrl()}
          />
          <button onClick={addBlogUrl} className="px-3 py-1.5 rounded-apple-sm border border-apple-border text-apple-sm hover:bg-apple-fill-secondary transition-colors">
            Add
          </button>
        </div>
      </div>

      {/* Run Audit Section */}
      <div className="bg-white rounded-apple border border-apple-border p-5">
        <h2 className="text-base font-semibold text-apple-text mb-4">Run Audit</h2>

        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setAuditMode('full')}
            className={`px-4 py-2 rounded-apple-sm text-apple-sm font-medium transition-colors ${
              auditMode === 'full' ? 'bg-apple-blue text-white' : 'bg-apple-fill-secondary text-apple-text-secondary hover:bg-gray-200'
            }`}
          >
            Full Blog Audit
          </button>
          <button
            onClick={() => setAuditMode('single')}
            className={`px-4 py-2 rounded-apple-sm text-apple-sm font-medium transition-colors ${
              auditMode === 'single' ? 'bg-apple-blue text-white' : 'bg-apple-fill-secondary text-apple-text-secondary hover:bg-gray-200'
            }`}
          >
            Single Post Audit
          </button>
        </div>

        {auditMode === 'full' ? (
          <div className="flex gap-2">
            <select
              value={selectedBlog}
              onChange={(e) => setSelectedBlog(e.target.value)}
              className="input text-apple-sm flex-1"
            >
              <option value="">Select a blog to audit...</option>
              {blogUrls.map((bu) => (
                <option key={bu.blog_url} value={bu.blog_url}>{bu.blog_url}</option>
              ))}
            </select>
            <button
              onClick={runAudit}
              disabled={running || !selectedBlog}
              className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
            >
              {running ? 'Running...' : 'Run Full Audit'}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={singleUrl}
              onChange={(e) => setSingleUrl(e.target.value)}
              placeholder="https://example.com/blog/my-post"
              className="input text-apple-sm flex-1"
            />
            <button
              onClick={runAudit}
              disabled={running || !singleUrl.trim()}
              className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
            >
              {running ? 'Running...' : 'Audit Post'}
            </button>
          </div>
        )}

        {running && progress && (
          <div className="mt-3 flex items-center gap-2 text-apple-sm text-apple-text-secondary">
            <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
            {progress}
          </div>
        )}
      </div>

      {/* Results Section */}
      {(result || savedAudits.length > 0) && (
        <div className="bg-white rounded-apple border border-apple-border p-5">
          <div className="flex gap-2 border-b border-apple-divider pb-3 mb-4">
            {['summary', 'by-post', 'recommendations'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as AuditTab)}
                className={`px-3 py-1.5 rounded-apple-sm text-apple-sm font-medium transition-colors ${
                  activeTab === tab ? 'bg-apple-blue text-white' : 'text-apple-text-secondary hover:bg-apple-fill-secondary'
                }`}
              >
                {tab === 'summary' ? 'Summary' : tab === 'by-post' ? 'By Post' : `Recommendations (${allRecs.length})`}
              </button>
            ))}
          </div>

          {activeTab === 'summary' && (
            <div className="space-y-4">
              {result?.mode === 'full' && result.overview ? (
                <>
                  <div className="flex items-center gap-4">
                    <span className={`text-4xl font-bold ${getScoreColor(result.overview.score)}`}>{result.overview.score}</span>
                    <div>
                      <span className="text-apple-sm text-apple-text-secondary">/100 overall blog score</span>
                      <p className="text-apple-sm text-apple-text-secondary mt-0.5">
                        {result.auditedPosts} of {result.totalPosts} posts audited
                      </p>
                    </div>
                  </div>
                  <p className="text-apple-sm text-apple-text">{result.overview.summary}</p>
                  {result.overview.strengths?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-apple-text mb-2">Strengths</h3>
                      <ul className="space-y-1">
                        {result.overview.strengths.map((s, i) => (
                          <li key={i} className="text-apple-sm text-apple-text-secondary flex gap-2">
                            <span className="text-green-500 shrink-0">✓</span> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : result?.mode === 'single' ? (
                <>
                  <div className="flex items-center gap-4">
                    <span className={`text-4xl font-bold ${getScoreColor(result.score || 0)}`}>{result.score}</span>
                    <span className="text-apple-sm text-apple-text-secondary">/100</span>
                  </div>
                  <p className="text-apple-sm text-apple-text">{result.summary}</p>
                  {result.strengths && result.strengths.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-apple-text mb-2">Strengths</h3>
                      <ul className="space-y-1">
                        {result.strengths.map((s, i) => (
                          <li key={i} className="text-apple-sm text-apple-text-secondary flex gap-2">
                            <span className="text-green-500 shrink-0">✓</span> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : savedAudits.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-apple-text">Previous Audits</h3>
                  {savedAudits.map((a, i) => (
                    <div key={i} className="bg-apple-fill-secondary rounded-apple-sm p-3">
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-bold ${getScoreColor(a.score)}`}>{a.score}</span>
                        <div className="flex-1 min-w-0">
                          <a href={a.blog_url} target="_blank" rel="noopener noreferrer" className="text-apple-sm text-apple-blue hover:underline truncate block">
                            {a.blog_url}
                          </a>
                          <span className="text-apple-xs text-apple-text-tertiary">
                            {a.audit_mode} &middot; {new Date(a.audited_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {activeTab === 'by-post' && (
            <div className="space-y-2">
              {result?.mode === 'full' && result.posts ? (
                result.posts.map((post) => (
                  <div key={post.url} className="border border-apple-border rounded-apple-sm">
                    <button
                      onClick={() => togglePost(post.url)}
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-apple-fill-secondary transition-colors"
                    >
                      <span className={`text-lg font-bold ${getScoreColor(post.score)}`}>{post.score}</span>
                      <div className="flex-1 min-w-0">
                        <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-apple-sm text-apple-blue hover:underline truncate block" onClick={(e) => e.stopPropagation()}>
                          {post.url.replace(/^https?:\/\/[^/]+/, '')}
                        </a>
                      </div>
                      <span className="text-apple-xs text-apple-text-tertiary">{post.recommendations?.length || 0} recs</span>
                      <svg className={`w-4 h-4 transition-transform ${expandedPosts.has(post.url) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedPosts.has(post.url) && (
                      <div className="border-t border-apple-divider p-4 space-y-3">
                        <p className="text-apple-sm text-apple-text">{post.summary}</p>
                        {post.strengths?.length > 0 && (
                          <div>
                            <h4 className="text-apple-xs font-semibold text-apple-text-secondary mb-1">Strengths</h4>
                            <ul className="space-y-0.5">
                              {post.strengths.map((s, i) => (
                                <li key={i} className="text-apple-xs text-apple-text-secondary flex gap-1.5">
                                  <span className="text-green-500 shrink-0">✓</span> {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {post.recommendations?.length > 0 && (
                          <div>
                            <h4 className="text-apple-xs font-semibold text-apple-text-secondary mb-1">Recommendations</h4>
                            <div className="space-y-2">
                              {post.recommendations.map((rec, ri) => {
                                const key = `${post.url}-${ri}`;
                                return (
                                  <div key={ri} className="border border-apple-border rounded-apple-sm">
                                    <button onClick={() => toggleRec(key)} className="w-full flex items-center gap-2 p-2 text-left">
                                      <span className={`text-apple-xs px-1.5 py-0.5 rounded ${getPriorityColor(rec.priority)}`}>{rec.priority}</span>
                                      <span className="text-apple-xs text-apple-text flex-1">{rec.issue}</span>
                                      <svg className={`w-3 h-3 transition-transform ${expandedRecs.has(key) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                    {expandedRecs.has(key) && (
                                      <div className="border-t border-apple-divider p-3 space-y-2 bg-apple-fill-secondary">
                                        <p className="text-apple-xs text-apple-text"><strong>Fix:</strong> {rec.recommendation}</p>
                                        <p className="text-apple-xs text-apple-text-secondary"><strong>How:</strong> {rec.howToFix}</p>
                                        <p className="text-apple-xs text-apple-text-tertiary"><strong>Impact:</strong> {rec.impact}</p>
                                        <button
                                          onClick={() => addToTasklist(rec, post.url)}
                                          className="text-apple-xs text-apple-blue hover:underline"
                                        >
                                          Add to Tasklist
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : savedAudits.filter((a) => a.audit_mode === 'single').length > 0 ? (
                savedAudits.filter((a) => a.audit_mode === 'single').map((a, i) => (
                  <div key={i} className="border border-apple-border rounded-apple-sm p-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold ${getScoreColor(a.score)}`}>{a.score}</span>
                      <a href={a.blog_url} target="_blank" rel="noopener noreferrer" className="text-apple-sm text-apple-blue hover:underline truncate flex-1">
                        {a.blog_url}
                      </a>
                      <span className="text-apple-xs text-apple-text-tertiary">{new Date(a.audited_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-apple-sm text-apple-text-tertiary py-4">Run a full blog audit to see individual post results.</p>
              )}
            </div>
          )}

          {activeTab === 'recommendations' && (
            <div className="space-y-2">
              {allRecs.length === 0 ? (
                <p className="text-apple-sm text-apple-text-tertiary py-4">No recommendations yet.</p>
              ) : (
                allRecs.map((rec, i) => {
                  const key = `all-${i}`;
                  return (
                    <div key={i} className="border border-apple-border rounded-apple-sm">
                      <button onClick={() => toggleRec(key)} className="w-full flex items-center gap-2 p-3 text-left hover:bg-apple-fill-secondary transition-colors">
                        <span className={`text-apple-xs px-1.5 py-0.5 rounded ${getPriorityColor(rec.priority)}`}>{rec.priority}</span>
                        <span className="text-apple-sm text-apple-text flex-1">{rec.issue}</span>
                        <span className="text-apple-xs text-apple-text-tertiary truncate max-w-[200px]">{rec.source}</span>
                        <svg className={`w-3.5 h-3.5 transition-transform ${expandedRecs.has(key) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {expandedRecs.has(key) && (
                        <div className="border-t border-apple-divider p-4 space-y-2 bg-apple-fill-secondary">
                          <p className="text-apple-sm text-apple-text"><strong>Fix:</strong> {rec.recommendation}</p>
                          <p className="text-apple-sm text-apple-text-secondary"><strong>How:</strong> {rec.howToFix}</p>
                          <p className="text-apple-sm text-apple-text-tertiary"><strong>Impact:</strong> {rec.impact}</p>
                          <button
                            onClick={() => addToTasklist(rec, rec.source)}
                            className="mt-1 px-3 py-1 rounded-apple-sm bg-apple-blue text-white text-apple-xs font-medium hover:bg-apple-blue-hover transition-colors"
                          >
                            Add to Tasklist
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
