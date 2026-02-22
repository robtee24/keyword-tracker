import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { API_ENDPOINTS } from '../config/api';

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

interface BuildRebuildViewProps {
  siteUrl: string;
}

export default function BuildRebuildView({ siteUrl }: BuildRebuildViewProps) {
  const [sitemapUrls, setSitemapUrls] = useState<string[]>([]);
  const [loadingSitemap, setLoadingSitemap] = useState(true);
  const [urlInput, setUrlInput] = useState('');
  const [selectedUrl, setSelectedUrl] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedImprovements, setSelectedImprovements] = useState<Set<string>>(new Set(['seo', 'content', 'conversion']));

  const [building, setBuilding] = useState(false);
  const [result, setResult] = useState<RebuildResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<'changes' | 'code'>('changes');

  const inputRef = useRef<HTMLInputElement>(null);

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

  const filteredUrls = useMemo(() => {
    if (!urlInput.trim()) return sitemapUrls.slice(0, 20);
    const q = urlInput.toLowerCase();
    return sitemapUrls.filter(u => u.toLowerCase().includes(q)).slice(0, 20);
  }, [urlInput, sitemapUrls]);

  const isValidUrl = useMemo(() => {
    return sitemapUrls.includes(selectedUrl);
  }, [selectedUrl, sitemapUrls]);

  const selectUrl = useCallback((url: string) => {
    setSelectedUrl(url);
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
    if (!isValidUrl) return;
    setBuilding(true);
    setResult(null);
    setShowPreview(false);

    try {
      const objectives = localStorage.getItem('site_objectives') || '';
      const resp = await fetch(API_ENDPOINTS.build.rebuild, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          pageUrl: selectedUrl,
          improvements: IMPROVEMENT_OPTIONS.filter(o => selectedImprovements.has(o.id)).map(o => o.label),
          objectives,
        }),
      });
      const data = await resp.json();
      if (data.result) {
        setResult(data.result);
        setActiveTab('changes');
      }
    } catch (err) {
      console.error('Build failed:', err);
    }
    setBuilding(false);
  };

  const addToTasklist = async (change: RebuildChange) => {
    try {
      await fetch(API_ENDPOINTS.db.completedTasks, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          keyword: `build:${selectedUrl}`,
          taskId: `build-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          taskText: `${change.area}: ${change.improved}`,
          category: change.area,
          status: 'pending',
        }),
      });
    } catch (err) {
      console.error('Failed to add to tasklist:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-apple-text">Rebuild Page</h1>
        <p className="text-apple-sm text-apple-text-secondary mt-1">
          Select a page from your sitemap and generate an improved version with AI-powered recommendations.
        </p>
      </div>

      {/* URL Selection */}
      <div className="bg-white rounded-apple border border-apple-border p-5">
        <h2 className="text-base font-semibold text-apple-text mb-3">Select Page</h2>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); setSelectedUrl(''); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={loadingSitemap ? 'Loading sitemap...' : 'Search or select a page URL...'}
            className="input text-apple-sm w-full"
            disabled={loadingSitemap}
          />
          {selectedUrl && isValidUrl && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
          {showSuggestions && filteredUrls.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-apple-border rounded-apple-sm shadow-lg max-h-60 overflow-y-auto">
              {filteredUrls.map((url) => (
                <button
                  key={url}
                  onMouseDown={() => selectUrl(url)}
                  className="w-full text-left px-3 py-2 text-apple-sm hover:bg-apple-fill-secondary transition-colors truncate"
                >
                  {url.replace(/^https?:\/\/[^/]+/, '')}
                </button>
              ))}
            </div>
          )}
        </div>
        {urlInput && !isValidUrl && !showSuggestions && (
          <p className="text-apple-xs text-amber-600 mt-1.5">
            This URL must be in your sitemap. Type to search from {sitemapUrls.length} pages.
          </p>
        )}
        <p className="text-apple-xs text-apple-text-tertiary mt-2">
          {sitemapUrls.length} pages found in sitemap
        </p>
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
            disabled={!isValidUrl || building || selectedImprovements.size === 0}
            className="px-5 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
          >
            {building ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Building...
              </span>
            ) : (
              'Build'
            )}
          </button>
          {result && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-5 py-2 rounded-apple-sm border border-apple-border text-apple-sm font-medium text-apple-text hover:bg-apple-fill-secondary transition-colors"
            >
              {showPreview ? 'Hide Preview' : 'Preview'}
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white rounded-apple border border-apple-border p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-apple-text">{result.title}</h2>
            <p className="text-apple-xs text-apple-text-tertiary italic mt-1">{result.metaDescription}</p>
            <p className="text-apple-sm text-apple-text-secondary mt-2">{result.summary}</p>
          </div>

          <div className="flex gap-2 border-b border-apple-divider pb-3 mb-4">
            <button
              onClick={() => setActiveTab('changes')}
              className={`px-3 py-1.5 rounded-apple-sm text-apple-sm font-medium transition-colors ${
                activeTab === 'changes' ? 'bg-apple-blue text-white' : 'text-apple-text-secondary hover:bg-apple-fill-secondary'
              }`}
            >
              Changes ({result.recommendations?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-3 py-1.5 rounded-apple-sm text-apple-sm font-medium transition-colors ${
                activeTab === 'code' ? 'bg-apple-blue text-white' : 'text-apple-text-secondary hover:bg-apple-fill-secondary'
              }`}
            >
              Generated Code
            </button>
          </div>

          {activeTab === 'changes' && (
            <div className="space-y-3">
              {(result.recommendations || []).map((change, i) => (
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
              {result.htmlContent && (
                <div>
                  <h3 className="text-sm font-semibold text-apple-text mb-2">HTML Content</h3>
                  <pre className="bg-gray-900 text-gray-100 rounded-apple-sm p-4 text-xs overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap">
                    {result.htmlContent}
                  </pre>
                </div>
              )}
              {result.schemaMarkup && (
                <div>
                  <h3 className="text-sm font-semibold text-apple-text mb-2">Schema Markup</h3>
                  <pre className="bg-gray-900 text-gray-100 rounded-apple-sm p-4 text-xs overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {result.schemaMarkup}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      {showPreview && result?.htmlContent && (
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
                {selectedUrl}
              </div>
            </div>
            <iframe
              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${result.title}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:24px;line-height:1.6;color:#1d1d1f;max-width:900px;margin:0 auto}h1{font-size:2em;margin-bottom:0.5em}h2{font-size:1.5em;margin-top:1.5em}h3{font-size:1.2em}p{margin:0.8em 0}img{max-width:100%;height:auto}a{color:#0071e3}ul,ol{padding-left:1.5em}blockquote{border-left:3px solid #0071e3;margin:1em 0;padding:0.5em 1em;background:#f5f5f7}</style></head><body>${result.htmlContent}</body></html>`}
              className="w-full h-[600px] border-0"
              title="Page Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}
    </div>
  );
}
