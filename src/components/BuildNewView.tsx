import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';

interface PageSuggestion {
  title: string;
  slug: string;
  pageType: string;
  purpose: string;
  targetKeyword: string;
  estimatedMonthlySearches: number;
  funnelStage: string;
  priority: string;
  outline: string[];
  built?: boolean;
  builtContent?: BuiltPage | null;
}

interface BuiltPage {
  title: string;
  metaDescription: string;
  slug: string;
  htmlContent: string;
  schemaMarkup: string;
  suggestedImages: string[];
  internalLinkSuggestions: string[];
  summary: string;
}

type WizardStep = 'purpose' | 'audience' | 'style' | 'details' | 'building';

interface BuildNewViewProps {
  siteUrl: string;
}

export default function BuildNewView({ siteUrl }: BuildNewViewProps) {
  const [suggestions, setSuggestions] = useState<PageSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSuggestions, setHasSuggestions] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [buildingIdx, setBuildingIdx] = useState<number | null>(null);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [dbRecordId, setDbRecordId] = useState<string | null>(null);

  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>('purpose');
  const [wizardData, setWizardData] = useState({
    purpose: '',
    audience: '',
    style: '',
    title: '',
    keywords: '',
    additionalNotes: '',
  });
  const [wizardBuilding, setWizardBuilding] = useState(false);
  const [wizardResult, setWizardResult] = useState<BuiltPage | null>(null);

  const [loadingSaved, setLoadingSaved] = useState(true);

  const [savedWizardBuilds, setSavedWizardBuilds] = useState<Array<{ result: BuiltPage; created_at: string }>>([]);

  const loadSavedData = useCallback(async () => {
    setLoadingSaved(true);
    try {
      const [suggestResp, wizardResp] = await Promise.all([
        fetch(`${API_ENDPOINTS.db.buildSuggestions}?siteUrl=${encodeURIComponent(siteUrl)}`),
        fetch(`${API_ENDPOINTS.db.buildResults}?siteUrl=${encodeURIComponent(siteUrl)}&buildType=wizard`),
      ]);
      const suggestData = await suggestResp.json();
      const wizardData = await wizardResp.json();

      if (suggestData.suggestions && suggestData.suggestions.length > 0) {
        setSuggestions(suggestData.suggestions);
        setDbRecordId(suggestData.id || null);
        setHasSuggestions(true);
      }
      if (wizardData.results) {
        setSavedWizardBuilds(wizardData.results);
      }
    } catch { /* ignore */ }
    setLoadingSaved(false);
  }, [siteUrl]);

  useEffect(() => { loadSavedData(); }, [loadSavedData]);

  const generateSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const objectives = localStorage.getItem('site_objectives') || '';
      const sitemapResp = await fetch(`${API_ENDPOINTS.audit.sitemap}?siteUrl=${encodeURIComponent(siteUrl)}`);
      const sitemapData = await sitemapResp.json();

      const resp = await fetch(API_ENDPOINTS.build.suggestPages, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          objectives,
          existingPages: sitemapData.urls || [],
        }),
      });
      const data = await resp.json();
      const newSuggestions = (data.suggestions || []).map((s: PageSuggestion) => ({ ...s, built: false, builtContent: null }));
      setSuggestions(newSuggestions);
      setHasSuggestions(true);

      const saveResp = await fetch(API_ENDPOINTS.db.buildSuggestions, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, suggestions: newSuggestions }),
      });
      const saveData = await saveResp.json();
      if (saveData.id) setDbRecordId(saveData.id);
      else {
        const reloadResp = await fetch(`${API_ENDPOINTS.db.buildSuggestions}?siteUrl=${encodeURIComponent(siteUrl)}`);
        const reloadData = await reloadResp.json();
        if (reloadData.id) setDbRecordId(reloadData.id);
      }
    } catch (err) {
      console.error('Failed to generate suggestions:', err);
    }
    setLoading(false);
  }, [siteUrl]);

  const buildPage = async (idx: number) => {
    const suggestion = suggestions[idx];
    setBuildingIdx(idx);
    try {
      const objectives = localStorage.getItem('site_objectives') || '';
      const resp = await fetch(API_ENDPOINTS.build.createPage, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          title: suggestion.title,
          slug: suggestion.slug,
          purpose: suggestion.purpose,
          targetKeyword: suggestion.targetKeyword,
          outline: suggestion.outline,
          objectives,
        }),
      });
      const data = await resp.json();
      if (data.page) {
        const updated = suggestions.map((s, i) =>
          i === idx ? { ...s, built: true, builtContent: data.page } : s
        );
        setSuggestions(updated);

        if (dbRecordId) {
          await fetch(API_ENDPOINTS.db.buildSuggestions, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: dbRecordId, suggestionIndex: idx, built: true, builtContent: data.page }),
          });
        }

        await fetch(API_ENDPOINTS.db.buildResults, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteUrl,
            pageUrl: `/${suggestion.slug}`,
            buildType: 'new',
            result: data.page,
          }),
        });
      }
    } catch (err) {
      console.error('Build failed:', err);
    }
    setBuildingIdx(null);
  };

  const buildFromWizard = async () => {
    setWizardBuilding(true);
    setWizardStep('building');
    try {
      const objectives = localStorage.getItem('site_objectives') || '';
      const resp = await fetch(API_ENDPOINTS.build.createPage, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          title: wizardData.title || `${wizardData.purpose} Page`,
          purpose: wizardData.purpose,
          targetKeyword: wizardData.keywords,
          objectives,
          style: `Target audience: ${wizardData.audience}. Style: ${wizardData.style}. ${wizardData.additionalNotes}`,
        }),
      });
      const data = await resp.json();
      if (data.page) {
        setWizardResult(data.page);

        await fetch(API_ENDPOINTS.db.buildResults, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteUrl,
            pageUrl: data.page.slug ? `/${data.page.slug}` : '',
            buildType: 'wizard',
            result: data.page,
          }),
        });
        await loadSavedData();
      }
    } catch (err) {
      console.error('Wizard build failed:', err);
    }
    setWizardBuilding(false);
  };

  const getPriorityColor = (p: string) => {
    if (p === 'high') return 'bg-red-100 text-red-700';
    if (p === 'medium') return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };

  const getFunnelColor = (f: string) => {
    if (f === 'awareness') return 'bg-blue-100 text-blue-700';
    if (f === 'consideration') return 'bg-purple-100 text-purple-700';
    return 'bg-green-100 text-green-700';
  };

  const getTypeColor = (t: string) => {
    const colors: Record<string, string> = {
      landing: 'bg-indigo-100 text-indigo-700',
      service: 'bg-teal-100 text-teal-700',
      product: 'bg-emerald-100 text-emerald-700',
      comparison: 'bg-orange-100 text-orange-700',
      faq: 'bg-yellow-100 text-yellow-700',
      'case-study': 'bg-pink-100 text-pink-700',
      tool: 'bg-violet-100 text-violet-700',
      pricing: 'bg-lime-100 text-lime-700',
      about: 'bg-sky-100 text-sky-700',
      industry: 'bg-amber-100 text-amber-700',
      location: 'bg-rose-100 text-rose-700',
      integration: 'bg-cyan-100 text-cyan-700',
      testimonial: 'bg-fuchsia-100 text-fuchsia-700',
      resource: 'bg-slate-100 text-slate-700',
      legal: 'bg-stone-100 text-stone-700',
    };
    return colors[t] || 'bg-gray-100 text-gray-600';
  };

  if (loadingSaved) {
    return (
      <div className="flex items-center gap-2 py-12 text-apple-text-secondary text-apple-sm justify-center">
        <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
        Loading saved data...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-apple-text">New Pages</h1>
          <p className="text-apple-sm text-apple-text-secondary mt-1">
            AI-suggested pages to add to your website, plus a wizard to create custom pages.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowWizard(true); setWizardStep('purpose'); setWizardResult(null); }}
            className="px-4 py-2 rounded-apple-sm border border-apple-border text-apple-sm font-medium text-apple-text hover:bg-apple-fill-secondary transition-colors"
          >
            Create New
          </button>
          <button
            onClick={generateSuggestions}
            disabled={loading}
            className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating...
              </span>
            ) : hasSuggestions ? 'Regenerate' : 'Generate Suggestions'}
          </button>
        </div>
      </div>

      {/* Create New Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-apple w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-apple-text">Create New Page</h2>
              <button onClick={() => setShowWizard(false)} className="text-apple-text-tertiary hover:text-apple-text">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {wizardStep === 'purpose' && (
              <div className="space-y-3">
                <label className="block text-apple-sm font-medium text-apple-text">What is the purpose of this page?</label>
                <textarea
                  value={wizardData.purpose}
                  onChange={e => setWizardData({ ...wizardData, purpose: e.target.value })}
                  placeholder="e.g., A pricing page to showcase our three plans, A case study highlighting our work with Company X..."
                  className="input text-apple-sm w-full h-24 resize-none"
                />
                <button
                  onClick={() => setWizardStep('audience')}
                  disabled={!wizardData.purpose.trim()}
                  className="w-full px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}

            {wizardStep === 'audience' && (
              <div className="space-y-3">
                <label className="block text-apple-sm font-medium text-apple-text">Who is the target audience?</label>
                <textarea
                  value={wizardData.audience}
                  onChange={e => setWizardData({ ...wizardData, audience: e.target.value })}
                  placeholder="e.g., Small business owners looking for affordable CRM, Homeowners interested in solar panels..."
                  className="input text-apple-sm w-full h-24 resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={() => setWizardStep('purpose')} className="flex-1 px-4 py-2 rounded-apple-sm border border-apple-border text-apple-sm">Back</button>
                  <button onClick={() => setWizardStep('style')} disabled={!wizardData.audience.trim()} className="flex-1 px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium disabled:opacity-50">Next</button>
                </div>
              </div>
            )}

            {wizardStep === 'style' && (
              <div className="space-y-3">
                <label className="block text-apple-sm font-medium text-apple-text">What style should the page have?</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Professional & Corporate', 'Friendly & Casual', 'Bold & Modern', 'Minimalist & Clean', 'Data-Driven & Technical', 'Storytelling & Narrative'].map(s => (
                    <button
                      key={s}
                      onClick={() => setWizardData({ ...wizardData, style: s })}
                      className={`px-3 py-2 rounded-apple-sm text-apple-xs font-medium border transition-colors ${
                        wizardData.style === s ? 'border-apple-blue bg-apple-blue/5 text-apple-blue' : 'border-apple-border hover:bg-apple-fill-secondary'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setWizardStep('audience')} className="flex-1 px-4 py-2 rounded-apple-sm border border-apple-border text-apple-sm">Back</button>
                  <button onClick={() => setWizardStep('details')} disabled={!wizardData.style} className="flex-1 px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium disabled:opacity-50">Next</button>
                </div>
              </div>
            )}

            {wizardStep === 'details' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-apple-sm font-medium text-apple-text mb-1">Page Title</label>
                  <input
                    value={wizardData.title}
                    onChange={e => setWizardData({ ...wizardData, title: e.target.value })}
                    placeholder="e.g., Pricing Plans, About Us, Free SEO Audit Tool"
                    className="input text-apple-sm w-full"
                  />
                </div>
                <div>
                  <label className="block text-apple-sm font-medium text-apple-text mb-1">Target Keywords (optional)</label>
                  <input
                    value={wizardData.keywords}
                    onChange={e => setWizardData({ ...wizardData, keywords: e.target.value })}
                    placeholder="e.g., affordable crm pricing, solar panel cost calculator"
                    className="input text-apple-sm w-full"
                  />
                </div>
                <div>
                  <label className="block text-apple-sm font-medium text-apple-text mb-1">Additional Notes (optional)</label>
                  <textarea
                    value={wizardData.additionalNotes}
                    onChange={e => setWizardData({ ...wizardData, additionalNotes: e.target.value })}
                    placeholder="Any specific requirements, content to include, sections to have..."
                    className="input text-apple-sm w-full h-20 resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setWizardStep('style')} className="flex-1 px-4 py-2 rounded-apple-sm border border-apple-border text-apple-sm">Back</button>
                  <button onClick={buildFromWizard} className="flex-1 px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium">Build Page</button>
                </div>
              </div>
            )}

            {wizardStep === 'building' && (
              <div className="py-8 text-center space-y-3">
                {wizardBuilding ? (
                  <>
                    <div className="w-8 h-8 border-3 border-apple-blue border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-apple-sm text-apple-text-secondary">Building your page...</p>
                  </>
                ) : wizardResult ? (
                  <div className="text-left space-y-4">
                    <div className="flex items-center gap-2 text-green-600">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-apple-sm font-medium">Page built and saved!</span>
                    </div>
                    <h3 className="text-base font-semibold text-apple-text">{wizardResult.title}</h3>
                    <p className="text-apple-xs text-apple-text-tertiary italic">{wizardResult.metaDescription}</p>
                    <p className="text-apple-sm text-apple-text-secondary">{wizardResult.summary}</p>
                    <div className="border border-apple-border rounded-apple-sm bg-white overflow-hidden">
                      <div className="bg-gray-100 px-3 py-1.5 border-b border-apple-border text-apple-xs text-apple-text-tertiary">
                        Preview
                      </div>
                      <iframe
                        srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${wizardResult.title}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:24px;line-height:1.6;color:#1d1d1f;max-width:900px;margin:0 auto}h1{font-size:2em;margin-bottom:0.5em}h2{font-size:1.5em;margin-top:1.5em}h3{font-size:1.2em}p{margin:0.8em 0}a{color:#0071e3}ul,ol{padding-left:1.5em}</style></head><body>${wizardResult.htmlContent}</body></html>`}
                        className="w-full h-[400px] border-0"
                        title="Preview"
                        sandbox="allow-same-origin"
                      />
                    </div>
                    <button onClick={() => setShowWizard(false)} className="w-full px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium">Done</button>
                  </div>
                ) : (
                  <p className="text-apple-sm text-red-600">Build failed. Please try again.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suggestions List */}
      {!hasSuggestions && !loading ? (
        <div className="bg-white rounded-apple border border-apple-border p-8 text-center">
          <p className="text-apple-text-secondary text-apple-sm">
            Click "Generate Suggestions" to get 20 AI-recommended pages for your site, or "Create New" to build a custom page.
          </p>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 py-8 text-apple-text-secondary text-apple-sm justify-center">
          <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
          Analyzing your site and generating page suggestions...
        </div>
      ) : (
        <div className="space-y-2">
          {suggestions.map((s, i) => (
            <div key={i} className={`bg-white rounded-apple border ${s.built ? 'border-green-200' : 'border-apple-border'}`}>
              <button
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-apple-fill-secondary transition-colors"
              >
                <span className="text-apple-sm text-apple-text-tertiary w-6 text-center shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-apple-sm font-medium ${s.built ? 'text-green-600' : 'text-apple-text'}`}>
                      {s.built && '\u2713 '}{s.title}
                    </span>
                  </div>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${getPriorityColor(s.priority)}`}>{s.priority}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${getTypeColor(s.pageType)}`}>{s.pageType}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${getFunnelColor(s.funnelStage)}`}>{s.funnelStage}</span>
                  </div>
                </div>
                {s.estimatedMonthlySearches > 0 && (
                  <span className="text-apple-xs text-apple-text-tertiary shrink-0">~{s.estimatedMonthlySearches.toLocaleString()}/mo</span>
                )}
                <svg className={`w-4 h-4 text-apple-text-tertiary transition-transform shrink-0 ${expandedIdx === i ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedIdx === i && (
                <div className="border-t border-apple-divider p-4 space-y-3">
                  <div>
                    <span className="text-apple-xs font-semibold text-apple-text-secondary">URL: </span>
                    <span className="text-apple-sm text-apple-blue">/{s.slug}</span>
                  </div>
                  <div>
                    <span className="text-apple-xs font-semibold text-apple-text-secondary">Target Keyword: </span>
                    <span className="text-apple-sm text-apple-text">{s.targetKeyword}</span>
                  </div>
                  <p className="text-apple-sm text-apple-text-secondary">{s.purpose}</p>
                  {s.outline?.length > 0 && (
                    <div>
                      <span className="text-apple-xs font-semibold text-apple-text-secondary">Page Sections:</span>
                      <ul className="mt-1 space-y-0.5">
                        {s.outline.map((section, si) => (
                          <li key={si} className="text-apple-xs text-apple-text-secondary flex gap-1.5">
                            <span className="shrink-0">&bull;</span> {section}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    {!s.built ? (
                      <button
                        onClick={() => buildPage(i)}
                        disabled={buildingIdx === i}
                        className="px-4 py-1.5 rounded-apple-sm bg-apple-blue text-white text-apple-xs font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
                      >
                        {buildingIdx === i ? (
                          <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Building...
                          </span>
                        ) : 'Build'}
                      </button>
                    ) : (
                      <button
                        onClick={() => setPreviewIdx(previewIdx === i ? null : i)}
                        className="px-4 py-1.5 rounded-apple-sm border border-apple-blue text-apple-blue text-apple-xs font-medium hover:bg-apple-blue/5 transition-colors"
                      >
                        {previewIdx === i ? 'Hide Preview' : 'Preview'}
                      </button>
                    )}
                  </div>

                  {previewIdx === i && s.builtContent && (
                    <div className="mt-3">
                      <p className="text-apple-sm text-apple-text-secondary mb-2">{s.builtContent.summary}</p>
                      <div className="border border-apple-border rounded-apple-sm overflow-hidden">
                        <div className="bg-gray-100 px-3 py-1.5 border-b border-apple-border flex items-center gap-2">
                          <div className="flex gap-1">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                          </div>
                          <span className="text-apple-xs text-apple-text-tertiary">/{s.builtContent.slug}</span>
                        </div>
                        <iframe
                          srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${s.builtContent.title}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:24px;line-height:1.6;color:#1d1d1f;max-width:900px;margin:0 auto}h1{font-size:2em;margin-bottom:0.5em}h2{font-size:1.5em;margin-top:1.5em}h3{font-size:1.2em}p{margin:0.8em 0}a{color:#0071e3}ul,ol{padding-left:1.5em}</style></head><body>${s.builtContent.htmlContent}</body></html>`}
                          className="w-full h-[500px] border-0"
                          title="Preview"
                          sandbox="allow-same-origin"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Saved Wizard Builds */}
      {savedWizardBuilds.length > 0 && (
        <div className="bg-white rounded-apple border border-apple-border p-5">
          <h2 className="text-base font-semibold text-apple-text mb-3">Custom-Built Pages</h2>
          <div className="space-y-2">
            {savedWizardBuilds.map((build, i) => (
              <div key={i} className="border border-apple-border rounded-apple-sm p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-apple-sm font-medium text-apple-text">{build.result?.title}</p>
                    <p className="text-apple-xs text-apple-text-tertiary italic truncate">{build.result?.metaDescription}</p>
                  </div>
                  <span className="text-apple-xs text-apple-text-tertiary shrink-0">
                    {new Date(build.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
