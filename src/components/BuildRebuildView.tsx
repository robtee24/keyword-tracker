import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { logActivity } from '../utils/activityLog';

interface RebuildChange {
  area: string;
  current: string;
  improved: string;
  reason: string;
}

interface RebuildResult {
  title: string;
  metaDescription: string;
  recommendations: RebuildChange[];
  htmlContent: string;
  schemaMarkup: string;
  summary: string;
}

interface SavedBuild {
  id?: string;
  page_url: string;
  build_type: string;
  result: RebuildResult;
  created_at: string;
}

interface CrawlStats {
  wordCount: number;
  headings: number;
  images: number;
  imagesMissingAlt: number;
  internalLinks: number;
  externalLinks: number;
  navLinks: number;
  forms: number;
  schemas: number;
  htmlSizeKb: number;
  fetchTimeMs: number;
  title: string;
  metaDescription: string;
}

type BuildStep = 'idle' | 'crawling' | 'generating' | 'saving' | 'done' | 'error';

const IMPROVEMENT_OPTIONS = [
  { id: 'seo', label: 'SEO Optimization', desc: 'Title tags, meta descriptions, headings, keywords' },
  { id: 'content', label: 'Content Quality', desc: 'Copy, readability, depth, engagement' },
  { id: 'conversion', label: 'Conversion Optimization', desc: 'CTAs, trust signals, persuasion' },
  { id: 'ux', label: 'User Experience', desc: 'Layout, navigation, accessibility' },
  { id: 'speed', label: 'Performance', desc: 'Load time, resource optimization' },
  { id: 'schema', label: 'Schema Markup', desc: 'Structured data for rich results' },
  { id: 'images', label: 'Image Optimization', desc: 'Alt text, compression, lazy loading' },
  { id: 'mobile', label: 'Mobile Experience', desc: 'Responsive design, touch targets' },
];

const STEPS = [
  { key: 'crawling', label: 'Crawling page', desc: 'Fetching and analyzing the existing page content, structure, styles, and metadata' },
  { key: 'generating', label: 'Generating rebuild', desc: 'AI is analyzing the crawl data and building an optimized version of your page' },
  { key: 'saving', label: 'Saving results', desc: 'Storing build results for future reference' },
] as const;

interface BuildRebuildViewProps {
  siteUrl: string;
}

export default function BuildRebuildView({ siteUrl }: BuildRebuildViewProps) {
  const [sitemapUrls, setSitemapUrls] = useState<string[]>([]);
  const [loadingSitemap, setLoadingSitemap] = useState(true);
  const [urlInput, setUrlInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedImprovements, setSelectedImprovements] = useState<Set<string>>(new Set(['seo', 'content', 'conversion']));

  const [buildStep, setBuildStep] = useState<BuildStep>('idle');
  const [buildError, setBuildError] = useState('');
  const [crawlStats, setCrawlStats] = useState<CrawlStats | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [result, setResult] = useState<RebuildResult | null>(null);
  const [resultPageUrl, setResultPageUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<'changes' | 'code'>('changes');

  const [savedBuilds, setSavedBuilds] = useState<SavedBuild[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [viewingSavedIdx, setViewingSavedIdx] = useState<number | null>(null);

  const [showModify, setShowModify] = useState(false);
  const [modifyInput, setModifyInput] = useState('');
  const [isModifying, setIsModifying] = useState(false);
  const [modifyError, setModifyError] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isBuilding = buildStep !== 'idle' && buildStep !== 'done' && buildStep !== 'error';

  useEffect(() => {
    if (isBuilding) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isBuilding]);

  useEffect(() => {
    (async () => {
      setLoadingSitemap(true);
      try {
        const resp = await fetch(`${API_ENDPOINTS.audit.sitemap}?siteUrl=${encodeURIComponent(siteUrl)}`);
        const data = await resp.json();
        setSitemapUrls(data.urls || []);
      } catch { /* ignore */ }
      setLoadingSitemap(false);
    })();
  }, [siteUrl]);

  const loadSavedBuilds = useCallback(async () => {
    setLoadingSaved(true);
    try {
      const resp = await fetch(`${API_ENDPOINTS.db.buildResults}?siteUrl=${encodeURIComponent(siteUrl)}&buildType=rebuild`);
      const data = await resp.json();
      setSavedBuilds(data.results || []);
    } catch { /* ignore */ }
    setLoadingSaved(false);
  }, [siteUrl]);

  useEffect(() => { loadSavedBuilds(); }, [loadSavedBuilds]);

  const filteredUrls = useMemo(() => {
    if (!urlInput.trim()) return [];
    const q = urlInput.toLowerCase();
    return sitemapUrls.filter(u => u.toLowerCase().includes(q)).slice(0, 15);
  }, [urlInput, sitemapUrls]);

  const isValidUrl = useMemo(() => {
    const trimmed = urlInput.trim();
    if (!trimmed) return false;
    try {
      const inputHost = new URL(trimmed).hostname.replace(/^www\./, '');
      const siteHost = new URL(siteUrl).hostname.replace(/^www\./, '');
      return inputHost === siteHost;
    } catch {
      return false;
    }
  }, [urlInput, siteUrl]);

  const selectUrl = useCallback((url: string) => {
    setUrlInput(url);
    setShowSuggestions(false);
  }, []);

  const toggleImprovement = (id: string) => {
    setSelectedImprovements(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBuild = async () => {
    if (!isValidUrl || isBuilding) return;
    const pageUrl = urlInput.trim();

    setResult(null);
    setShowPreview(false);
    setResultPageUrl(pageUrl);
    setCrawlStats(null);
    setBuildError('');
    setBuildStep('crawling');

    try {
      // Step 1: Comprehensive crawl
      const crawlResp = await fetch(API_ENDPOINTS.build.crawl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageUrl, siteUrl }),
      });
      const crawlData = await crawlResp.json();

      if (crawlData.error) {
        setBuildError(crawlData.error);
        setBuildStep('error');
        return;
      }

      const crawl = crawlData.crawl;
      setCrawlStats({
        wordCount: crawl.wordCount || 0,
        headings: crawl.headings?.length || 0,
        images: crawl.images?.length || 0,
        imagesMissingAlt: crawl.images?.filter((i: { alt: string }) => !i.alt).length || 0,
        internalLinks: crawl.internalLinks?.length || 0,
        externalLinks: crawl.externalLinks?.length || 0,
        navLinks: crawl.navLinks?.length || 0,
        forms: crawl.forms?.length || 0,
        schemas: crawl.existingSchema?.length || 0,
        htmlSizeKb: Math.round((crawl.htmlSize || 0) / 1024),
        fetchTimeMs: crawl.fetchTimeMs || 0,
        title: crawl.title || '',
        metaDescription: crawl.metaDescription || '',
      });

      // Step 2: Generate rebuild with AI
      setBuildStep('generating');
      const objectives = localStorage.getItem('site_objectives') || '';
      const rebuildResp = await fetch(API_ENDPOINTS.build.rebuild, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          pageUrl,
          improvements: IMPROVEMENT_OPTIONS.filter(o => selectedImprovements.has(o.id)).map(o => o.label),
          objectives,
          crawlData: crawl,
          homePageStyles: crawlData.homePageStyles,
        }),
      });
      const rebuildData = await rebuildResp.json();

      if (rebuildData.error) {
        setBuildError(rebuildData.error);
        setBuildStep('error');
        return;
      }

      if (rebuildData.result) {
        setResult(rebuildData.result);
        setActiveTab('changes');

        // Step 3: Save results
        setBuildStep('saving');
        await fetch(API_ENDPOINTS.db.buildResults, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl, pageUrl, buildType: 'rebuild', result: rebuildData.result }),
        });
        await loadSavedBuilds();
        logActivity(siteUrl, 'build', 'rebuild', `Rebuilt page: ${pageUrl} — ${rebuildData.result.recommendations?.length || 0} improvements`);

        setBuildStep('done');
      } else {
        setBuildError('No result returned from AI');
        setBuildStep('error');
      }
    } catch (err) {
      console.error('Build failed:', err);
      setBuildError(err instanceof Error ? err.message : 'Build failed');
      setBuildStep('error');
    }
  };

  const addToTasklist = async (change: RebuildChange) => {
    try {
      await fetch(API_ENDPOINTS.db.completedTasks, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          keyword: `build:${resultPageUrl}`,
          taskId: `build-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          taskText: `${change.area}: ${change.improved}`,
          category: change.area,
          status: 'pending',
        }),
      });
      logActivity(siteUrl, 'build', 'task-added', `Added rebuild task: ${change.area} for ${resultPageUrl}`);
    } catch (err) {
      console.error('Failed to add to tasklist:', err);
    }
  };

  const handleModify = async () => {
    if (!modifyInput.trim() || !result?.htmlContent || isModifying) return;
    setIsModifying(true);
    setModifyError('');
    try {
      const resp = await fetch(API_ENDPOINTS.build.modifyPage, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          pageUrl: resultPageUrl,
          currentHtml: result.htmlContent,
          modifications: modifyInput.trim(),
          currentTitle: result.title,
          currentMeta: result.metaDescription,
        }),
      });
      const data = await resp.json();
      if (data.error) {
        setModifyError(data.error);
      } else if (data.result) {
        setResult(data.result);
        setActiveTab('code');
        setShowPreview(true);
        setModifyInput('');
        setShowModify(false);
        await fetch(API_ENDPOINTS.db.buildResults, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl, pageUrl: resultPageUrl, buildType: 'rebuild', result: data.result }),
        });
        await loadSavedBuilds();
        logActivity(siteUrl, 'build', 'modify', `Modified page: ${resultPageUrl}`);
      }
    } catch (err) {
      setModifyError(err instanceof Error ? err.message : 'Modification failed');
    }
    setIsModifying(false);
  };

  const viewSavedBuild = (idx: number) => {
    if (viewingSavedIdx === idx) {
      setViewingSavedIdx(null);
      setResult(null);
      return;
    }
    setViewingSavedIdx(idx);
    const build = savedBuilds[idx];
    setResult(build.result);
    setResultPageUrl(build.page_url);
    setActiveTab('changes');
    setShowPreview(false);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const getStepStatus = (stepKey: string): 'pending' | 'active' | 'complete' | 'error' => {
    const stepOrder = ['crawling', 'generating', 'saving'];
    const currentIdx = stepOrder.indexOf(buildStep);
    const stepIdx = stepOrder.indexOf(stepKey);

    if (buildStep === 'done') return 'complete';
    if (buildStep === 'error') {
      if (stepIdx < currentIdx) return 'complete';
      if (stepIdx === currentIdx) return 'error';
      return 'pending';
    }
    if (stepIdx < currentIdx) return 'complete';
    if (stepIdx === currentIdx) return 'active';
    return 'pending';
  };

  const displayResult = result;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-apple-text">Rebuild Page</h1>
        <p className="text-apple-sm text-apple-text-secondary mt-1">
          Enter any page URL on your domain and generate an improved version with AI-powered recommendations.
        </p>
      </div>

      {/* URL Input */}
      <div className="bg-white rounded-apple border border-apple-border p-5">
        <h2 className="text-base font-semibold text-apple-text mb-3">Page URL</h2>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); setShowSuggestions(true); }}
            onFocus={() => { if (urlInput.trim()) setShowSuggestions(true); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={loadingSitemap ? 'Loading sitemap...' : `Enter any URL on ${siteUrl}`}
            className="input text-apple-sm w-full pr-10"
            disabled={loadingSitemap || isBuilding}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {loadingSitemap ? (
              <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
            ) : isValidUrl ? (
              <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : urlInput.trim() ? (
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : null}
          </span>
          {showSuggestions && filteredUrls.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-apple-border rounded-apple-sm shadow-lg max-h-60 overflow-y-auto">
              {filteredUrls.map((url) => (
                <button
                  key={url}
                  onMouseDown={() => selectUrl(url)}
                  className="w-full text-left px-3 py-2 text-apple-sm hover:bg-apple-fill-secondary transition-colors truncate"
                >
                  {url}
                </button>
              ))}
              {filteredUrls.length < sitemapUrls.filter(u => u.toLowerCase().includes(urlInput.toLowerCase())).length && (
                <div className="px-3 py-2 text-apple-xs text-apple-text-tertiary border-t border-apple-divider">
                  Keep typing to narrow results...
                </div>
              )}
            </div>
          )}
        </div>
        {urlInput.trim() && !isValidUrl && !showSuggestions && !loadingSitemap && (
          <p className="text-apple-xs text-red-500 mt-1.5">
            URL must belong to {siteUrl}. Enter a valid URL on the same domain.
          </p>
        )}
      </div>

      {/* Improvement Checkboxes */}
      <div className="bg-white rounded-apple border border-apple-border p-5">
        <h2 className="text-base font-semibold text-apple-text mb-3">What to Improve</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {IMPROVEMENT_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className={`flex items-start gap-3 p-3 rounded-apple-sm border cursor-pointer transition-colors ${
                selectedImprovements.has(opt.id)
                  ? 'border-apple-blue bg-apple-blue/5'
                  : 'border-apple-border hover:bg-apple-fill-secondary'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedImprovements.has(opt.id)}
                onChange={() => toggleImprovement(opt.id)}
                className="w-4 h-4 mt-0.5 rounded border-apple-border text-apple-blue shrink-0"
                disabled={isBuilding}
              />
              <div>
                <span className="text-apple-sm font-medium text-apple-text">{opt.label}</span>
                <p className="text-apple-xs text-apple-text-tertiary">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleBuild}
            disabled={!isValidUrl || isBuilding || selectedImprovements.size === 0}
            className="px-5 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
          >
            {isBuilding ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Building...
              </span>
            ) : (
              'Build'
            )}
          </button>
          {displayResult && !isBuilding && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-5 py-2 rounded-apple-sm border border-apple-border text-apple-sm font-medium text-apple-text hover:bg-apple-fill-secondary transition-colors"
            >
              {showPreview ? 'Hide Preview' : 'Preview'}
            </button>
          )}
        </div>
      </div>

      {/* Progress Indicator */}
      {buildStep !== 'idle' && buildStep !== 'done' && (
        <div className="bg-white rounded-apple border border-apple-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-apple-text">Build Progress</h2>
            <span className="text-apple-xs text-apple-text-tertiary font-mono tabular-nums">
              {formatTime(elapsedSeconds)}
            </span>
          </div>

          <div className="space-y-0">
            {STEPS.map((step, i) => {
              const status = getStepStatus(step.key);
              return (
                <div key={step.key} className="flex gap-3">
                  {/* Step indicator column */}
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                      status === 'complete' ? 'bg-green-500' :
                      status === 'active' ? 'bg-apple-blue' :
                      status === 'error' ? 'bg-red-500' :
                      'bg-gray-200'
                    }`}>
                      {status === 'complete' ? (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : status === 'active' ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : status === 'error' ? (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                      )}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`w-0.5 flex-1 min-h-[24px] transition-colors duration-300 ${
                        status === 'complete' ? 'bg-green-500' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>

                  {/* Step content */}
                  <div className={`pb-5 flex-1 ${i === STEPS.length - 1 ? 'pb-0' : ''}`}>
                    <p className={`text-apple-sm font-medium transition-colors ${
                      status === 'active' ? 'text-apple-blue' :
                      status === 'complete' ? 'text-green-600' :
                      status === 'error' ? 'text-red-600' :
                      'text-apple-text-tertiary'
                    }`}>
                      {step.label}
                    </p>
                    {(status === 'active' || status === 'error') && (
                      <p className="text-apple-xs text-apple-text-tertiary mt-0.5">{step.desc}</p>
                    )}

                    {/* Crawl stats (shown after crawl completes) */}
                    {step.key === 'crawling' && crawlStats && status === 'complete' && (
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <StatChip label="Words" value={crawlStats.wordCount.toLocaleString()} />
                        <StatChip label="Headings" value={String(crawlStats.headings)} />
                        <StatChip label="Images" value={String(crawlStats.images)} warn={crawlStats.imagesMissingAlt > 0 ? `${crawlStats.imagesMissingAlt} no alt` : undefined} />
                        <StatChip label="Internal Links" value={String(crawlStats.internalLinks)} />
                        <StatChip label="External Links" value={String(crawlStats.externalLinks)} />
                        <StatChip label="Nav Links" value={String(crawlStats.navLinks)} />
                        <StatChip label="Forms" value={String(crawlStats.forms)} />
                        <StatChip label="Load Time" value={`${crawlStats.fetchTimeMs}ms`} />
                      </div>
                    )}

                    {/* Generating step — pulsing bar */}
                    {step.key === 'generating' && status === 'active' && (
                      <div className="mt-2.5">
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-apple-blue rounded-full animate-progress-pulse" />
                        </div>
                        <p className="text-apple-xs text-apple-text-tertiary mt-1.5">
                          This typically takes 30–90 seconds depending on page complexity
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Error state */}
          {buildStep === 'error' && buildError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-apple-sm">
              <p className="text-apple-sm text-red-700">{buildError}</p>
              <button
                onClick={() => { setBuildStep('idle'); setBuildError(''); }}
                className="mt-2 text-apple-xs text-red-600 font-medium hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {/* Build complete banner */}
      {buildStep === 'done' && displayResult && (
        <div className="bg-green-50 border border-green-200 rounded-apple p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-apple-sm font-medium text-green-800">
              Build complete in {formatTime(elapsedSeconds)}
            </p>
            <p className="text-apple-xs text-green-600">
              {displayResult.recommendations?.length || 0} improvements generated
              {crawlStats ? ` · Analyzed ${crawlStats.wordCount.toLocaleString()} words across ${crawlStats.headings} sections` : ''}
            </p>
          </div>
        </div>
      )}

      {/* Current Result */}
      {displayResult && !isBuilding && (
        <div className="bg-white rounded-apple border border-apple-border p-5">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-semibold text-apple-text">{displayResult.title}</h2>
            </div>
            <a href={resultPageUrl} target="_blank" rel="noopener noreferrer" className="text-apple-xs text-apple-blue hover:underline">{resultPageUrl}</a>
            <p className="text-apple-xs text-apple-text-tertiary italic mt-1">{displayResult.metaDescription}</p>
            <p className="text-apple-sm text-apple-text-secondary mt-2">{displayResult.summary}</p>
          </div>

          <div className="flex items-center gap-2 border-b border-apple-divider pb-3 mb-4">
            <button
              onClick={() => setActiveTab('changes')}
              className={`px-3 py-1.5 rounded-apple-sm text-apple-sm font-medium transition-colors ${
                activeTab === 'changes' ? 'bg-apple-blue text-white' : 'text-apple-text-secondary hover:bg-apple-fill-secondary'
              }`}
            >
              Changes ({displayResult.recommendations?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-3 py-1.5 rounded-apple-sm text-apple-sm font-medium transition-colors ${
                activeTab === 'code' ? 'bg-apple-blue text-white' : 'text-apple-text-secondary hover:bg-apple-fill-secondary'
              }`}
            >
              Generated Code
            </button>
            <div className="ml-auto">
              <button
                onClick={() => setShowModify(!showModify)}
                className={`px-3 py-1.5 rounded-apple-sm text-apple-sm font-medium transition-colors ${
                  showModify ? 'bg-purple-600 text-white' : 'border border-purple-300 text-purple-600 hover:bg-purple-50'
                }`}
              >
                Modify Page
              </button>
            </div>
          </div>

          {showModify && (
            <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-apple-sm space-y-3">
              <label className="block text-apple-sm font-medium text-purple-800">
                Describe your modifications
              </label>
              <textarea
                value={modifyInput}
                onChange={(e) => setModifyInput(e.target.value)}
                placeholder="e.g., Change the hero headline to 'Transform Your Business Today', add a testimonials section below the pricing, make the CTA buttons green instead of blue..."
                className="w-full h-28 px-3 py-2 rounded-apple-sm border border-purple-200 text-apple-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 resize-none bg-white"
                disabled={isModifying}
              />
              {modifyError && (
                <p className="text-apple-xs text-red-600">{modifyError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleModify}
                  disabled={!modifyInput.trim() || isModifying}
                  className="px-4 py-2 rounded-apple-sm bg-purple-600 text-white text-apple-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {isModifying ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Modifying...
                    </span>
                  ) : 'Apply Modifications'}
                </button>
                <button
                  onClick={() => { setShowModify(false); setModifyInput(''); setModifyError(''); }}
                  className="px-4 py-2 rounded-apple-sm border border-apple-border text-apple-sm text-apple-text-secondary hover:bg-apple-fill-secondary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {activeTab === 'changes' && (
            <div className="space-y-3">
              {(displayResult.recommendations || []).map((change, i) => (
                <div key={i} className="border border-apple-border rounded-apple-sm p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <span className="text-apple-xs font-semibold text-apple-blue uppercase">{change.area}</span>
                      <div className="mt-1.5 space-y-1">
                        <p className="text-apple-sm text-red-600">
                          <span className="font-medium">Before:</span> {change.current}
                        </p>
                        <p className="text-apple-sm text-green-600">
                          <span className="font-medium">After:</span> {change.improved}
                        </p>
                        <p className="text-apple-xs text-apple-text-tertiary mt-1">{change.reason}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => addToTasklist(change)}
                      className="shrink-0 px-2 py-1 rounded text-apple-xs text-apple-blue hover:bg-apple-blue/5 transition-colors"
                    >
                      + Tasklist
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-4">
              {displayResult.htmlContent && (
                <div>
                  <h3 className="text-sm font-semibold text-apple-text mb-2">HTML Content</h3>
                  <pre className="bg-gray-900 text-gray-100 rounded-apple-sm p-4 text-xs overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap">
                    {displayResult.htmlContent}
                  </pre>
                </div>
              )}
              {displayResult.schemaMarkup && (
                <div>
                  <h3 className="text-sm font-semibold text-apple-text mb-2">Schema Markup</h3>
                  <pre className="bg-gray-900 text-gray-100 rounded-apple-sm p-4 text-xs overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {displayResult.schemaMarkup}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      {showPreview && displayResult?.htmlContent && (
        <div className="bg-white rounded-apple border border-apple-border p-5">
          <h2 className="text-base font-semibold text-apple-text mb-3">Page Preview</h2>
          <div className="border border-apple-border rounded-apple-sm bg-white overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 border-b border-apple-border flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 bg-white rounded px-3 py-1 text-apple-xs text-apple-text-secondary truncate">
                {resultPageUrl}
              </div>
            </div>
            <iframe
              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${displayResult.title}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:24px;line-height:1.6;color:#1d1d1f;max-width:900px;margin:0 auto}h1{font-size:2em;margin-bottom:0.5em}h2{font-size:1.5em;margin-top:1.5em}h3{font-size:1.2em}p{margin:0.8em 0}img{max-width:100%;height:auto}a{color:#0071e3}ul,ol{padding-left:1.5em}blockquote{border-left:3px solid #0071e3;margin:1em 0;padding:0.5em 1em;background:#f5f5f7}</style></head><body>${displayResult.htmlContent}</body></html>`}
              className="w-full h-[600px] border-0"
              title="Page Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}

      {/* Previous Builds */}
      {!loadingSaved && savedBuilds.length > 0 && (
        <div className="bg-white rounded-apple border border-apple-border p-5">
          <h2 className="text-base font-semibold text-apple-text mb-3">Previous Builds</h2>
          <div className="space-y-2">
            {savedBuilds.map((build, i) => (
              <button
                key={build.id || i}
                onClick={() => viewSavedBuild(i)}
                className={`w-full flex items-center gap-3 p-3 rounded-apple-sm border text-left transition-colors ${
                  viewingSavedIdx === i ? 'border-apple-blue bg-apple-blue/5' : 'border-apple-border hover:bg-apple-fill-secondary'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-apple-sm font-medium text-apple-text truncate">{build.result?.title || build.page_url}</p>
                  <a href={build.page_url} target="_blank" rel="noopener noreferrer" className="text-apple-xs text-apple-blue hover:underline truncate block" onClick={e => e.stopPropagation()}>
                    {build.page_url}
                  </a>
                </div>
                <span className="text-apple-xs text-apple-text-tertiary shrink-0">
                  {new Date(build.created_at).toLocaleDateString()}
                </span>
                <span className="text-apple-xs text-apple-text-tertiary shrink-0">
                  {build.result?.recommendations?.length || 0} changes
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes progress-pulse {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
        .animate-progress-pulse {
          animation: progress-pulse 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

function StatChip({ label, value, warn }: { label: string; value: string; warn?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-2.5 py-1.5 border border-gray-100">
      <p className="text-[11px] text-apple-text-tertiary uppercase tracking-wider">{label}</p>
      <p className="text-apple-sm font-semibold text-apple-text">{value}</p>
      {warn && <p className="text-[10px] text-amber-600">{warn}</p>}
    </div>
  );
}
