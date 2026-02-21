import { useState, useEffect, useRef, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';

type AuditType = 'seo' | 'content' | 'aeo' | 'schema';

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  issue: string;
  recommendation: string;
  impact: string;
}

interface PageResult {
  page_url: string;
  score: number;
  summary: string;
  recommendations: Recommendation[];
  audited_at: string;
  error?: string;
}

interface AuditViewProps {
  siteUrl: string;
  auditType: AuditType;
  title: string;
  description: string;
}

const STORAGE_KEY = (siteUrl: string, auditType: string) =>
  `audit_progress:${siteUrl}:${auditType}`;

const PRIORITY_COLORS = {
  high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  low: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
};

function getScoreColor(score: number) {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function getScoreBg(score: number) {
  if (score >= 80) return 'bg-green-50 border-green-200';
  if (score >= 60) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

export default function AuditView({ siteUrl, auditType, title, description }: AuditViewProps) {
  const [results, setResults] = useState<PageResult[]>([]);
  const [sitemapUrls, setSitemapUrls] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [loadingResults, setLoadingResults] = useState(true);
  const [loadingSitemap, setLoadingSitemap] = useState(false);
  const [currentPage, setCurrentPage] = useState('');
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<'' | 'high' | 'medium' | 'low'>('');
  const abortRef = useRef(false);
  const completedUrlsRef = useRef<Set<string>>(new Set());

  // Load saved results from Supabase on mount
  useEffect(() => {
    if (!siteUrl) return;
    setLoadingResults(true);
    fetch(`${API_ENDPOINTS.db.pageAudits}?siteUrl=${encodeURIComponent(siteUrl)}&auditType=${auditType}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.results) {
          setResults(data.results);
          completedUrlsRef.current = new Set(data.results.map((r: PageResult) => r.page_url));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingResults(false));
  }, [siteUrl, auditType]);

  const fetchSitemap = useCallback(async () => {
    setLoadingSitemap(true);
    setError(null);
    try {
      const resp = await fetch(
        `${API_ENDPOINTS.audit.sitemap}?siteUrl=${encodeURIComponent(siteUrl)}`
      );
      if (!resp.ok) throw new Error('Failed to fetch sitemap');
      const data = await resp.json();
      if (!data.urls || data.urls.length === 0) {
        throw new Error('No URLs found in sitemap. Make sure your site has a sitemap.xml');
      }
      setSitemapUrls(data.urls);
      return data.urls as string[];
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoadingSitemap(false);
    }
  }, [siteUrl]);

  const startAudit = useCallback(async (resume = false) => {
    abortRef.current = false;
    setIsRunning(true);
    setError(null);

    let urls = sitemapUrls;
    if (urls.length === 0) {
      urls = await fetchSitemap();
      if (urls.length === 0) {
        setIsRunning(false);
        return;
      }
    }

    if (!resume) {
      // Clear previous results
      try {
        await fetch(API_ENDPOINTS.db.pageAudits, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl, auditType, action: 'clear' }),
        });
      } catch { /* non-critical */ }
      setResults([]);
      completedUrlsRef.current = new Set();
    }

    const remaining = urls.filter((u) => !completedUrlsRef.current.has(u));

    for (const pageUrl of remaining) {
      if (abortRef.current) break;
      setCurrentPage(pageUrl);

      try {
        const resp = await fetch(API_ENDPOINTS.audit.run, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl, pageUrl, auditType }),
        });

        if (resp.ok) {
          const result = await resp.json();
          const pageResult: PageResult = {
            page_url: result.pageUrl,
            score: result.score,
            summary: result.summary || '',
            recommendations: result.recommendations || [],
            audited_at: new Date().toISOString(),
            error: result.error,
          };
          completedUrlsRef.current.add(pageUrl);
          setResults((prev) => [...prev, pageResult]);

          // Save progress to localStorage
          try {
            localStorage.setItem(
              STORAGE_KEY(siteUrl, auditType),
              JSON.stringify({ completedCount: completedUrlsRef.current.size, totalCount: urls.length })
            );
          } catch { /* ignore */ }
        }
      } catch (err: any) {
        completedUrlsRef.current.add(pageUrl);
        setResults((prev) => [
          ...prev,
          {
            page_url: pageUrl,
            score: 0,
            summary: '',
            recommendations: [],
            audited_at: new Date().toISOString(),
            error: err.message || 'Network error',
          },
        ]);
      }
    }

    setIsRunning(false);
    setCurrentPage('');
  }, [siteUrl, auditType, sitemapUrls, fetchSitemap]);

  const stopAudit = () => {
    abortRef.current = true;
  };

  const totalPages = sitemapUrls.length || results.length;
  const completedPages = results.length;
  const progressPct = totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0;
  const avgScore = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
    : 0;
  const hasResumable = completedPages > 0 && completedPages < totalPages && !isRunning;

  const filteredResults = filterPriority
    ? results.filter((r) => r.recommendations.some((rec) => rec.priority === filterPriority))
    : results;

  const sortedResults = [...filteredResults].sort((a, b) => a.score - b.score);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-apple-text mb-1">{title}</h2>
        <p className="text-apple-sm text-apple-text-secondary">{description}</p>
      </div>

      {/* Action Bar */}
      <div className="rounded-apple border border-apple-divider bg-white p-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          {!isRunning ? (
            <>
              <button
                onClick={() => startAudit(false)}
                disabled={loadingSitemap}
                className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
              >
                {loadingSitemap ? 'Loading Sitemap…' : results.length > 0 ? 'Re-run Full Audit' : 'Start Audit'}
              </button>
              {hasResumable && (
                <button
                  onClick={() => startAudit(true)}
                  className="px-4 py-2 rounded-apple-sm border border-apple-blue text-apple-blue text-apple-sm font-medium hover:bg-apple-blue/5 transition-colors"
                >
                  Resume ({totalPages - completedPages} remaining)
                </button>
              )}
            </>
          ) : (
            <button
              onClick={stopAudit}
              className="px-4 py-2 rounded-apple-sm border border-apple-red text-apple-red text-apple-sm font-medium hover:bg-red-50 transition-colors"
            >
              Stop Audit
            </button>
          )}

          {results.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-apple-xs text-apple-text-tertiary">Filter:</span>
              {(['high', 'medium', 'low'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setFilterPriority(filterPriority === p ? '' : p)}
                  className={`px-2.5 py-1 rounded-apple-pill text-apple-xs font-medium transition-colors ${
                    filterPriority === p
                      ? `${PRIORITY_COLORS[p].bg} ${PRIORITY_COLORS[p].text} border ${PRIORITY_COLORS[p].border}`
                      : 'bg-apple-fill-secondary text-apple-text-secondary hover:bg-gray-200'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {(isRunning || (completedPages > 0 && completedPages < totalPages)) && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-apple-xs font-medium text-apple-text-secondary">
                {isRunning ? 'Auditing pages…' : 'Audit paused'}
              </span>
              <span className="text-apple-xs text-apple-text-tertiary">
                {completedPages} / {totalPages} pages ({progressPct}%)
              </span>
            </div>
            <div className="w-full h-2 bg-apple-fill-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isRunning ? 'bg-apple-blue animate-pulse' : 'bg-apple-blue/60'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {isRunning && currentPage && (
              <p className="mt-1.5 text-apple-xs text-apple-text-tertiary truncate">
                Analyzing: {currentPage}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className={`rounded-apple border p-4 text-center ${getScoreBg(avgScore)}`}>
            <div className={`text-2xl font-bold ${getScoreColor(avgScore)}`}>{avgScore}</div>
            <div className="text-apple-xs text-apple-text-secondary mt-1">Avg Score</div>
          </div>
          <div className="rounded-apple border border-apple-divider bg-white p-4 text-center">
            <div className="text-2xl font-bold text-apple-text">{completedPages}</div>
            <div className="text-apple-xs text-apple-text-secondary mt-1">Pages Audited</div>
          </div>
          <div className="rounded-apple border border-red-200 bg-red-50 p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {results.reduce((n, r) => n + r.recommendations.filter((rec) => rec.priority === 'high').length, 0)}
            </div>
            <div className="text-apple-xs text-apple-text-secondary mt-1">High Priority Issues</div>
          </div>
          <div className="rounded-apple border border-amber-200 bg-amber-50 p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">
              {results.reduce((n, r) => n + r.recommendations.length, 0)}
            </div>
            <div className="text-apple-xs text-apple-text-secondary mt-1">Total Recommendations</div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loadingResults && results.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-apple-sm text-apple-text-secondary">Loading saved results…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-apple border border-apple-red/20 bg-red-50/30 px-4 py-3 mb-6 text-apple-sm text-apple-red">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loadingResults && results.length === 0 && !isRunning && (
        <div className="rounded-apple border border-apple-divider bg-white px-6 py-12 text-center">
          <svg className="w-10 h-10 mx-auto mb-3 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p className="text-apple-body font-medium text-apple-text mb-1">No audit results yet</p>
          <p className="text-apple-sm text-apple-text-secondary">
            Click "Start Audit" to crawl your sitemap and analyze every page.
          </p>
        </div>
      )}

      {/* Results Table */}
      {sortedResults.length > 0 && (
        <div className="rounded-apple border border-apple-divider bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-apple-divider bg-apple-fill-secondary flex items-center justify-between">
            <span className="text-apple-sm font-semibold text-apple-text-secondary">
              {filteredResults.length} page{filteredResults.length !== 1 ? 's' : ''}
              {filterPriority && ` with ${filterPriority} priority issues`}
            </span>
          </div>

          <div className="divide-y divide-apple-divider">
            {sortedResults.map((result) => {
              const isExpanded = expandedPage === result.page_url;
              const highCount = result.recommendations.filter((r) => r.priority === 'high').length;
              const medCount = result.recommendations.filter((r) => r.priority === 'medium').length;
              const lowCount = result.recommendations.filter((r) => r.priority === 'low').length;

              return (
                <div key={result.page_url}>
                  <button
                    className="w-full px-4 py-3 flex items-center gap-4 hover:bg-apple-fill-secondary/50 transition-colors text-left"
                    onClick={() => setExpandedPage(isExpanded ? null : result.page_url)}
                  >
                    {/* Score */}
                    <span className={`text-lg font-bold w-12 text-center ${getScoreColor(result.score)}`}>
                      {result.score}
                    </span>

                    {/* URL + Summary */}
                    <div className="flex-1 min-w-0">
                      <p className="text-apple-sm font-medium text-apple-text truncate">
                        {result.page_url.replace(/^https?:\/\/[^/]+/, '')}
                      </p>
                      {result.summary && (
                        <p className="text-apple-xs text-apple-text-tertiary truncate mt-0.5">
                          {result.summary}
                        </p>
                      )}
                      {result.error && (
                        <p className="text-apple-xs text-red-500 truncate mt-0.5">
                          Error: {result.error}
                        </p>
                      )}
                    </div>

                    {/* Priority badges */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {highCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-apple-pill text-[10px] font-bold bg-red-100 text-red-700">
                          {highCount} high
                        </span>
                      )}
                      {medCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-apple-pill text-[10px] font-bold bg-amber-100 text-amber-700">
                          {medCount} med
                        </span>
                      )}
                      {lowCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-apple-pill text-[10px] font-bold bg-blue-100 text-blue-700">
                          {lowCount} low
                        </span>
                      )}
                    </div>

                    {/* Expand icon */}
                    <svg
                      className={`w-4 h-4 text-apple-text-tertiary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Expanded recommendations */}
                  {isExpanded && result.recommendations.length > 0 && (
                    <div className="px-4 pb-4 pt-1 bg-apple-fill-secondary/30">
                      <div className="ml-12 space-y-2">
                        {result.recommendations
                          .filter((rec) => !filterPriority || rec.priority === filterPriority)
                          .map((rec, i) => {
                            const pc = PRIORITY_COLORS[rec.priority] || PRIORITY_COLORS.low;
                            return (
                              <div
                                key={i}
                                className={`rounded-apple-sm border ${pc.border} ${pc.bg} p-3`}
                              >
                                <div className="flex items-start gap-2">
                                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${pc.dot}`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className={`text-apple-xs font-bold uppercase ${pc.text}`}>
                                        {rec.priority}
                                      </span>
                                      <span className="text-apple-xs text-apple-text-tertiary">
                                        {rec.category}
                                      </span>
                                    </div>
                                    <p className="text-apple-sm font-medium text-apple-text">
                                      {rec.issue}
                                    </p>
                                    <p className="text-apple-sm text-apple-text-secondary mt-1">
                                      {rec.recommendation}
                                    </p>
                                    {rec.impact && (
                                      <p className="text-apple-xs text-apple-text-tertiary mt-1">
                                        Impact: {rec.impact}
                                      </p>
                                    )}
                                  </div>
                                </div>
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
        </div>
      )}
    </div>
  );
}
