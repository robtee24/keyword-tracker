import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { authenticatedFetch } from '../services/authService';
import { logActivity } from '../utils/activityLog';
import { useBackgroundTasks } from '../contexts/BackgroundTaskContext';
import { parseJsonOrThrow } from '../utils/apiResponse';

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
  rejected?: boolean;
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
  projectId: string;
}

export default function BuildNewView({ siteUrl, projectId }: BuildNewViewProps) {
  const [suggestions, setSuggestions] = useState<PageSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSuggestions, setHasSuggestions] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [buildingIdx, setBuildingIdx] = useState<number | null>(null);
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
  const [expandedSavedIdx, setExpandedSavedIdx] = useState<number | null>(null);
  const [previewModal, setPreviewModal] = useState<{ type: 'saved' | 'suggestion' | 'wizard'; idx?: number } | null>(null);

  const [modifyTarget, setModifyTarget] = useState<{ type: 'wizard' | 'suggestion'; idx?: number } | null>(null);
  const [modifyInput, setModifyInput] = useState('');
  const [isModifying, setIsModifying] = useState(false);
  const [modifyError, setModifyError] = useState('');
  const [seoEditIdx, setSeoEditIdx] = useState<number | null>(null);
  const [seoForm, setSeoForm] = useState({ slug: '', title: '', metaDescription: '', ogImage: '' });

  const { startTask, getTask, getTasksByType, clearTask } = useBackgroundTasks();
  const buildPageTasks = getTasksByType('build-page');
  const buildWizardTask = getTask(`build-wizard-${projectId}`);

  const loadSavedData = useCallback(async () => {
    setLoadingSaved(true);
    try {
      const [suggestResp, wizardResp] = await Promise.all([
        authenticatedFetch(`${API_ENDPOINTS.db.buildSuggestions}?siteUrl=${encodeURIComponent(siteUrl)}&projectId=${projectId}`),
        authenticatedFetch(`${API_ENDPOINTS.db.buildResults}?siteUrl=${encodeURIComponent(siteUrl)}&buildType=wizard&projectId=${projectId}`),
      ]);
      const suggestData = await parseJsonOrThrow<{ suggestions?: PageSuggestion[]; id?: string }>(suggestResp);
      const wizardParsed = await parseJsonOrThrow<{ results?: Array<{ result: BuiltPage; created_at: string }> }>(wizardResp);

      if (suggestData.suggestions && suggestData.suggestions.length > 0) {
        setSuggestions(suggestData.suggestions);
        setDbRecordId(suggestData.id || null);
        setHasSuggestions(true);
      }
      if (wizardParsed.results) {
        setSavedWizardBuilds(wizardParsed.results);
      }
    } catch { /* ignore */ }
    setLoadingSaved(false);
  }, [siteUrl]);

  useEffect(() => { loadSavedData(); }, [loadSavedData]);

  const suggestTaskId = `build-suggest-${projectId}`;
  const suggestTask = getTask(suggestTaskId);

  useEffect(() => {
    if (suggestTask?.status === 'completed' && suggestTask.result) {
      const data = suggestTask.result as { suggestions: PageSuggestion[]; dbRecordId?: string };
      setSuggestions(data.suggestions);
      setHasSuggestions(true);
      if (data.dbRecordId) setDbRecordId(data.dbRecordId);
      setLoading(false);
      clearTask(suggestTaskId);
    } else if (suggestTask?.status === 'failed') {
      setLoading(false);
      clearTask(suggestTaskId);
    }
  }, [suggestTask?.status]);

  const generateSuggestions = useCallback(() => {
    setLoading(true);
    startTask(suggestTaskId, 'build-suggest', 'Generating page ideas', async () => {
      const objectives = localStorage.getItem('site_objectives') || localStorage.getItem(`kt_objectives_${projectId}`) || '';
      const sitemapResp = await authenticatedFetch(`${API_ENDPOINTS.audit.sitemap}?siteUrl=${encodeURIComponent(siteUrl)}`);
      const sitemapData = await parseJsonOrThrow<{ urls?: string[] }>(sitemapResp);

      const resp = await authenticatedFetch(API_ENDPOINTS.build.suggestPages, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          projectId,
          objectives,
          existingPages: sitemapData.urls || [],
        }),
      });
      const data = await parseJsonOrThrow<{ suggestions?: PageSuggestion[] }>(resp);
      const newSuggestions = (data.suggestions || []).map((s: PageSuggestion) => ({ ...s, built: false, builtContent: null }));

      const saveResp = await authenticatedFetch(API_ENDPOINTS.db.buildSuggestions, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, projectId, suggestions: newSuggestions }),
      });
      let recordId: string | undefined;
      try {
        const saveData = await parseJsonOrThrow<{ id?: string }>(saveResp);
        recordId = saveData.id;
      } catch { /* ignore */ }
      if (!recordId) {
        try {
          const reloadResp = await authenticatedFetch(`${API_ENDPOINTS.db.buildSuggestions}?siteUrl=${encodeURIComponent(siteUrl)}&projectId=${projectId}`);
          const reloadData = await parseJsonOrThrow<{ id?: string }>(reloadResp);
          recordId = reloadData.id;
        } catch { /* ignore */ }
      }
      logActivity(siteUrl, 'build', 'suggestions', `Generated ${newSuggestions.length} new page suggestions`);
      return { suggestions: newSuggestions, dbRecordId: recordId };
    });
  }, [siteUrl, projectId]);

  const buildPage = (idx: number) => {
    const suggestion = suggestions[idx];
    setBuildingIdx(idx);
    startTask(`build-page-${idx}`, 'build-page', `Building: ${suggestion.title.slice(0, 50)}`, async () => {
      const objectives = localStorage.getItem('site_objectives') || '';
      const resp = await authenticatedFetch(API_ENDPOINTS.build.createPage, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          projectId,
          title: suggestion.title,
          slug: suggestion.slug,
          purpose: suggestion.purpose,
          targetKeyword: suggestion.targetKeyword,
          outline: suggestion.outline,
          objectives,
        }),
      });
      const data = await parseJsonOrThrow<{ page?: BuiltPage }>(resp);
      if (!data.page) throw new Error('No page returned from AI');

      if (dbRecordId) {
        await authenticatedFetch(API_ENDPOINTS.db.buildSuggestions, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: dbRecordId, projectId, suggestionIndex: idx, built: true, builtContent: data.page }),
        }).catch(() => {});
      }

      await authenticatedFetch(API_ENDPOINTS.db.buildResults, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          projectId,
          pageUrl: `/${suggestion.slug}`,
          buildType: 'new',
          result: data.page,
        }),
      }).catch(() => {});

      logActivity(siteUrl, 'build', 'page-built', `Built new page: ${suggestion.title} (/${suggestion.slug})`);
      return { idx, page: data.page };
    });
  };

  useEffect(() => {
    for (const task of buildPageTasks) {
      if (task.status === 'completed' && task.result) {
        const { idx, page } = task.result as { idx: number; page: BuiltPage };
        setSuggestions((prev) => prev.map((s, i) => i === idx ? { ...s, built: true, builtContent: page } : s));
        setBuildingIdx(null);
        clearTask(task.id);
      } else if (task.status === 'failed') {
        setBuildingIdx(null);
        clearTask(task.id);
      }
    }
  }, [buildPageTasks.map(t => t.status).join()]);

  const buildFromWizard = () => {
    setWizardBuilding(true);
    setWizardStep('building');
    const wizTitle = wizardData.title || `${wizardData.purpose} Page`;
    startTask(`build-wizard-${projectId}`, 'build-wizard', `Building: ${wizTitle.slice(0, 50)}`, async () => {
      const objectives = localStorage.getItem('site_objectives') || '';
      const resp = await authenticatedFetch(API_ENDPOINTS.build.createPage, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          projectId,
          title: wizTitle,
          purpose: wizardData.purpose,
          targetKeyword: wizardData.keywords,
          objectives,
          style: `Target audience: ${wizardData.audience}. Style: ${wizardData.style}. ${wizardData.additionalNotes}`,
        }),
      });
      const data = await parseJsonOrThrow<{ page?: BuiltPage }>(resp);
      if (!data.page) throw new Error('No page returned from AI');

      await authenticatedFetch(API_ENDPOINTS.db.buildResults, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          projectId,
          pageUrl: data.page.slug ? `/${data.page.slug}` : '',
          buildType: 'wizard',
          result: data.page,
        }),
      }).catch(() => {});

      logActivity(siteUrl, 'build', 'wizard-built', `Created custom page: ${data.page.title || wizTitle}`);
      return { page: data.page };
    });
  };

  useEffect(() => {
    if (buildWizardTask?.status === 'completed' && buildWizardTask.result) {
      const { page } = buildWizardTask.result as { page: BuiltPage };
      setWizardResult(page);
      setWizardBuilding(false);
      loadSavedData();
      clearTask(`build-wizard-${projectId}`);
    } else if (buildWizardTask?.status === 'failed') {
      setWizardBuilding(false);
      clearTask(`build-wizard-${projectId}`);
    }
  }, [buildWizardTask?.status]);

  const handleModifyPage = async (currentResult: BuiltPage) => {
    if (!modifyInput.trim() || isModifying) return;
    setIsModifying(true);
    setModifyError('');
    try {
      const resp = await authenticatedFetch(API_ENDPOINTS.build.modifyPage, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          projectId,
          pageUrl: currentResult.slug ? `/${currentResult.slug}` : '',
          currentHtml: currentResult.htmlContent,
          modifications: modifyInput.trim(),
          currentTitle: currentResult.title,
          currentMeta: currentResult.metaDescription,
        }),
      });
      const data = await parseJsonOrThrow<{ result?: Record<string, string>; error?: string }>(resp);
      if (data.error) {
        setModifyError(data.error);
      } else if (data.result) {
        const updatedPage: BuiltPage = {
          title: data.result.title || currentResult.title,
          metaDescription: data.result.metaDescription || currentResult.metaDescription,
          slug: currentResult.slug,
          htmlContent: data.result.htmlContent || currentResult.htmlContent,
          schemaMarkup: data.result.schemaMarkup || currentResult.schemaMarkup,
          suggestedImages: currentResult.suggestedImages,
          internalLinkSuggestions: currentResult.internalLinkSuggestions,
          summary: data.result.summary || currentResult.summary,
        };

        if (modifyTarget?.type === 'wizard') {
          setWizardResult(updatedPage);
        } else if (modifyTarget?.type === 'suggestion' && modifyTarget.idx !== undefined) {
          const updated = suggestions.map((s, i) =>
            i === modifyTarget.idx ? { ...s, builtContent: updatedPage } : s
          );
          setSuggestions(updated);
          if (dbRecordId) {
            await authenticatedFetch(API_ENDPOINTS.db.buildSuggestions, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: dbRecordId, projectId, suggestionIndex: modifyTarget.idx, built: true, builtContent: updatedPage }),
            }).catch(() => {});
          }
        }

        await authenticatedFetch(API_ENDPOINTS.db.buildResults, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteUrl,
            projectId,
            pageUrl: currentResult.slug ? `/${currentResult.slug}` : '',
            buildType: modifyTarget?.type === 'wizard' ? 'wizard' : 'new',
            result: updatedPage,
          }),
        });
        setModifyInput('');
        setModifyTarget(null);
        logActivity(siteUrl, 'build', 'modify', `Modified page: ${updatedPage.title}`);
      }
    } catch (err) {
      setModifyError(err instanceof Error ? err.message : 'Modification failed');
    }
    setIsModifying(false);
  };

  const [activeTab, setActiveTab] = useState<'ideas' | 'created' | 'rejected'>('ideas');
  const [publishMsg, setPublishMsg] = useState('');

  const ideaSuggestions = suggestions.filter(s => !s.built && !s.rejected);
  const createdSuggestions = suggestions.filter(s => s.built && !s.rejected);
  const rejectedSuggestions = suggestions.filter(s => s.rejected);
  const displaySuggestions = activeTab === 'ideas' ? ideaSuggestions :
    activeTab === 'created' ? createdSuggestions : rejectedSuggestions;

  const rejectSuggestion = async (idx: number) => {
    setSuggestions(prev => prev.map((s, i) => i === idx ? { ...s, rejected: true } : s));
    if (dbRecordId) {
      await authenticatedFetch(API_ENDPOINTS.db.buildSuggestions, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dbRecordId, projectId, suggestionIndex: idx, rejected: true }),
      }).catch(() => {});
    }
  };

  const unrejectSuggestion = async (idx: number) => {
    setSuggestions(prev => prev.map((s, i) => i === idx ? { ...s, rejected: false } : s));
    if (dbRecordId) {
      await authenticatedFetch(API_ENDPOINTS.db.buildSuggestions, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dbRecordId, projectId, suggestionIndex: idx, rejected: false }),
      }).catch(() => {});
    }
  };

  const moveToPublish = async (page: BuiltPage, title: string, slug: string, sourceType: string) => {
    try {
      await authenticatedFetch(API_ENDPOINTS.db.pagePublish, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId, siteUrl,
          sourceType,
          title: page.title || title,
          slug: page.slug || slug,
          metaDescription: page.metaDescription || '',
          htmlContent: page.htmlContent || '',
          schemaMarkup: page.schemaMarkup || '',
          pageUrl: page.slug ? `/${page.slug}` : '',
          status: 'queued',
        }),
      });
      setPublishMsg(`"${page.title || title}" moved to Publish queue`);
      setTimeout(() => setPublishMsg(''), 4000);
    } catch {
      setPublishMsg('Failed to move to Publish');
      setTimeout(() => setPublishMsg(''), 4000);
    }
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
                    <div className="flex gap-2">
                      {wizardResult.htmlContent && (
                        <button
                          onClick={() => setPreviewModal({ type: 'wizard' })}
                          className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Preview
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setModifyTarget({ type: 'wizard' });
                          setModifyInput('');
                          setModifyError('');
                        }}
                        className={`px-4 py-2 rounded-apple-sm text-apple-sm font-medium transition-colors ${
                          modifyTarget?.type === 'wizard' ? 'bg-purple-600 text-white' : 'border border-purple-300 text-purple-600 hover:bg-purple-50'
                        }`}
                      >
                        Modify Page
                      </button>
                      <button
                        onClick={() => moveToPublish(wizardResult, wizardData.title || 'Custom Page', wizardResult.slug || '', 'new')}
                        className="px-4 py-2 rounded-apple-sm bg-green-600 text-white text-apple-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Move to Publish
                      </button>
                      <button onClick={() => setShowWizard(false)} className="px-4 py-2 rounded-apple-sm border border-apple-border text-apple-sm font-medium text-apple-text-secondary hover:bg-apple-fill-secondary transition-colors">Done</button>
                    </div>

                    {modifyTarget?.type === 'wizard' && (
                      <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-apple-sm space-y-3">
                        <textarea
                          value={modifyInput}
                          onChange={(e) => setModifyInput(e.target.value)}
                          placeholder="Describe your modifications..."
                          className="w-full h-24 px-3 py-2 rounded-apple-sm border border-purple-200 text-apple-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 resize-none bg-white"
                          disabled={isModifying}
                        />
                        {modifyError && <p className="text-apple-xs text-red-600">{modifyError}</p>}
                        <div className="flex gap-2">
                          <button
                            onClick={() => wizardResult && handleModifyPage(wizardResult)}
                            disabled={!modifyInput.trim() || isModifying}
                            className="px-3 py-1.5 rounded-apple-sm bg-purple-600 text-white text-apple-xs font-medium disabled:opacity-50"
                          >
                            {isModifying ? (
                              <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Modifying...
                              </span>
                            ) : 'Apply'}
                          </button>
                          <button
                            onClick={() => { setModifyTarget(null); setModifyInput(''); setModifyError(''); }}
                            className="px-3 py-1.5 rounded-apple-sm border border-apple-border text-apple-xs text-apple-text-secondary"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-apple-sm text-red-600">Build failed. Please try again.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {publishMsg && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-apple-sm text-green-700 text-apple-xs">
          {publishMsg}
        </div>
      )}

      {/* Ideas / Created / Rejected Tabs */}
      {hasSuggestions && (
        <div className="flex items-center gap-1 bg-apple-fill-secondary rounded-apple p-1">
          {(['ideas', 'created', 'rejected'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2 rounded-apple-sm text-apple-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-white shadow-sm text-apple-text'
                  : 'text-apple-text-secondary hover:text-apple-text'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span className="ml-1.5 text-[10px] font-mono bg-apple-fill-tertiary px-1.5 py-0.5 rounded-full">
                {tab === 'ideas' ? ideaSuggestions.length : tab === 'created' ? createdSuggestions.length : rejectedSuggestions.length}
              </span>
            </button>
          ))}
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
          {displaySuggestions.length === 0 && (
            <div className="bg-white rounded-apple border border-apple-border p-8 text-center">
              <p className="text-apple-text-secondary text-apple-sm">
                {activeTab === 'ideas' ? 'All ideas have been built or rejected.'
                  : activeTab === 'created' ? 'No created pages yet. Build an idea to see it here.'
                  : 'No rejected ideas.'}
              </p>
            </div>
          )}
          {suggestions.map((s, i) => {
            const show = activeTab === 'ideas' ? (!s.built && !s.rejected)
              : activeTab === 'created' ? (s.built && !s.rejected)
              : !!s.rejected;
            if (!show) return null;
            return (
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
                    {s.rejected ? (
                      <button
                        onClick={() => unrejectSuggestion(i)}
                        className="px-4 py-1.5 rounded-apple-sm border border-apple-border text-apple-xs font-medium text-apple-text-secondary hover:bg-apple-fill-secondary transition-colors"
                      >
                        Restore to Ideas
                      </button>
                    ) : !s.built ? (
                      <>
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
                        <button
                          onClick={() => rejectSuggestion(i)}
                          className="px-4 py-1.5 rounded-apple-sm border border-red-300 text-red-600 text-apple-xs font-medium hover:bg-red-50 transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setPreviewModal({ type: 'suggestion', idx: i })}
                          className="px-4 py-1.5 rounded-apple-sm bg-apple-blue text-white text-apple-xs font-medium hover:bg-apple-blue-hover transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Preview
                        </button>
                        <button
                          onClick={() => {
                            setModifyTarget(modifyTarget?.type === 'suggestion' && modifyTarget.idx === i ? null : { type: 'suggestion', idx: i });
                            setModifyInput('');
                            setModifyError('');
                          }}
                          className={`px-4 py-1.5 rounded-apple-sm text-apple-xs font-medium transition-colors ${
                            modifyTarget?.type === 'suggestion' && modifyTarget.idx === i
                              ? 'bg-purple-600 text-white'
                              : 'border border-purple-300 text-purple-600 hover:bg-purple-50'
                          }`}
                        >
                          Modify
                        </button>
                        <button
                          onClick={() => moveToPublish(s.builtContent!, s.title, s.slug, 'new')}
                          className="px-4 py-1.5 rounded-apple-sm bg-green-600 text-white text-apple-xs font-medium hover:bg-green-700 transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          Move to Publish
                        </button>
                      </>
                    )}
                  </div>

                  {/* SEO Settings */}
                  {s.built && (
                    <div className="mt-3">
                      <button
                        onClick={() => {
                          if (seoEditIdx === i) { setSeoEditIdx(null); }
                          else {
                            setSeoEditIdx(i);
                            setSeoForm({
                              slug: s.builtContent?.slug || s.slug || '',
                              title: s.builtContent?.title || s.title || '',
                              metaDescription: s.builtContent?.metaDescription || '',
                              ogImage: '',
                            });
                          }
                        }}
                        className="text-apple-xs text-apple-text-secondary hover:text-apple-text font-medium flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        SEO Settings
                      </button>
                      {seoEditIdx === i && (
                        <div className="mt-2 p-3 bg-gray-50 border border-apple-border rounded-apple-sm space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-medium text-apple-text-secondary">Page Title</label>
                              <input type="text" value={seoForm.title} onChange={e => setSeoForm(f => ({ ...f, title: e.target.value }))} className="input text-apple-xs w-full" />
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-apple-text-secondary">Slug</label>
                              <input type="text" value={seoForm.slug} onChange={e => setSeoForm(f => ({ ...f, slug: e.target.value }))} className="input text-apple-xs w-full" placeholder="/page-slug" />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-medium text-apple-text-secondary">Meta Description</label>
                            <textarea value={seoForm.metaDescription} onChange={e => setSeoForm(f => ({ ...f, metaDescription: e.target.value }))} className="input text-apple-xs w-full resize-none" rows={2} />
                            <p className="text-[9px] text-apple-text-tertiary mt-0.5">{seoForm.metaDescription.length}/160</p>
                          </div>
                          <div>
                            <label className="text-[10px] font-medium text-apple-text-secondary">OG Image URL</label>
                            <input type="text" value={seoForm.ogImage} onChange={e => setSeoForm(f => ({ ...f, ogImage: e.target.value }))} className="input text-apple-xs w-full" placeholder="https://..." />
                          </div>
                          <button
                            onClick={() => {
                              setSuggestions(prev => prev.map((sg, si) => si !== i ? sg : {
                                ...sg,
                                title: seoForm.title,
                                slug: seoForm.slug,
                                builtContent: sg.builtContent ? { ...sg.builtContent, title: seoForm.title, slug: seoForm.slug, metaDescription: seoForm.metaDescription } : sg.builtContent,
                              }));
                              setSeoEditIdx(null);
                            }}
                            className="px-3 py-1 rounded bg-apple-blue text-white text-[10px] font-medium"
                          >
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {modifyTarget?.type === 'suggestion' && modifyTarget.idx === i && s.builtContent && (
                    <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-apple-sm space-y-3">
                      <label className="block text-apple-xs font-medium text-purple-800">Describe your modifications</label>
                      <textarea
                        value={modifyInput}
                        onChange={(e) => setModifyInput(e.target.value)}
                        placeholder="e.g., Change the headline, add a FAQ section, make the tone more casual..."
                        className="w-full h-24 px-3 py-2 rounded-apple-sm border border-purple-200 text-apple-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 resize-none bg-white"
                        disabled={isModifying}
                      />
                      {modifyError && <p className="text-apple-xs text-red-600">{modifyError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => s.builtContent && handleModifyPage(s.builtContent)}
                          disabled={!modifyInput.trim() || isModifying}
                          className="px-3 py-1.5 rounded-apple-sm bg-purple-600 text-white text-apple-xs font-medium disabled:opacity-50"
                        >
                          {isModifying ? (
                            <span className="flex items-center gap-1.5">
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Modifying...
                            </span>
                          ) : 'Apply'}
                        </button>
                        <button
                          onClick={() => { setModifyTarget(null); setModifyInput(''); setModifyError(''); }}
                          className="px-3 py-1.5 rounded-apple-sm border border-apple-border text-apple-xs text-apple-text-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          );
          })}
        </div>
      )}

      {/* Saved Wizard Builds */}
      {savedWizardBuilds.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-apple-sm font-semibold text-apple-text-secondary uppercase tracking-wider">
            Custom-Built Pages ({savedWizardBuilds.length})
          </h3>
          {savedWizardBuilds.map((build, i) => {
            const isExp = expandedSavedIdx === i;
            const r = build.result;
            return (
              <div key={i} className="rounded-apple border border-apple-divider bg-white overflow-hidden shadow-sm">
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-apple-fill-secondary/30 transition-colors"
                  onClick={() => setExpandedSavedIdx(isExp ? null : i)}
                >
                  <div className="w-10 h-10 rounded-apple-sm bg-green-500/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-apple-sm font-medium text-apple-text truncate">{r?.title || 'Untitled Page'}</p>
                    <p className="text-apple-xs text-apple-text-tertiary truncate mt-0.5">{r?.slug ? `/${r.slug}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-apple-xs text-apple-text-tertiary">
                      {new Date(build.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    {r?.htmlContent && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setPreviewModal({ type: 'saved', idx: i }); }}
                        className="px-3 py-1.5 rounded-apple-sm bg-apple-blue text-white text-apple-xs font-medium hover:bg-apple-blue-hover transition-colors flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Preview
                      </button>
                    )}
                    <svg className={`w-4 h-4 text-apple-text-tertiary transition-transform ${isExp ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {isExp && r && (
                  <div className="border-t border-apple-divider px-5 py-4 space-y-3">
                    {r.metaDescription && <p className="text-apple-xs text-apple-text-tertiary italic">{r.metaDescription}</p>}
                    {r.summary && <p className="text-apple-sm text-apple-text-secondary">{r.summary}</p>}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const isMod = modifyTarget?.type === 'suggestion' && modifyTarget.idx === -(i + 1);
                          setModifyTarget(isMod ? null : { type: 'suggestion', idx: -(i + 1) });
                          setModifyInput('');
                          setModifyError('');
                        }}
                        className={`px-4 py-2 rounded-apple-sm text-apple-xs font-medium transition-colors ${
                          modifyTarget?.type === 'suggestion' && modifyTarget.idx === -(i + 1) ? 'bg-purple-600 text-white' : 'border border-purple-300 text-purple-600 hover:bg-purple-50'
                        }`}
                      >
                        Modify Page
                      </button>
                      <button
                        onClick={() => moveToPublish(r, r.title || 'Custom Page', r.slug || '', 'new')}
                        className="px-4 py-2 rounded-apple-sm bg-green-600 text-white text-apple-xs font-medium hover:bg-green-700 transition-colors flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Move to Publish
                      </button>
                    </div>

                    {modifyTarget?.type === 'suggestion' && modifyTarget.idx === -(i + 1) && r && (
                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-apple-sm space-y-3">
                        <label className="block text-apple-xs font-medium text-purple-800">Describe your modifications</label>
                        <textarea
                          value={modifyInput}
                          onChange={(e) => setModifyInput(e.target.value)}
                          placeholder="e.g., Change the headline, add a FAQ section, make the tone more casual..."
                          className="w-full h-24 px-3 py-2 rounded-apple-sm border border-purple-200 text-apple-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 resize-none bg-white"
                          disabled={isModifying}
                        />
                        {modifyError && <p className="text-apple-xs text-red-600">{modifyError}</p>}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleModifyPage(r)}
                            disabled={!modifyInput.trim() || isModifying}
                            className="px-3 py-1.5 rounded-apple-sm bg-purple-600 text-white text-apple-xs font-medium disabled:opacity-50"
                          >
                            {isModifying ? (
                              <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Modifying...
                              </span>
                            ) : 'Apply'}
                          </button>
                          <button
                            onClick={() => { setModifyTarget(null); setModifyInput(''); setModifyError(''); }}
                            className="px-3 py-1.5 rounded-apple-sm border border-apple-border text-apple-xs text-apple-text-secondary"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      {previewModal && (() => {
        let previewContent: BuiltPage | null = null;
        let previewUrl = '';
        if (previewModal.type === 'wizard' && wizardResult) {
          previewContent = wizardResult;
          previewUrl = wizardResult.slug ? `/${wizardResult.slug}` : '';
        } else if (previewModal.type === 'suggestion' && previewModal.idx !== undefined) {
          previewContent = suggestions[previewModal.idx]?.builtContent || null;
          previewUrl = suggestions[previewModal.idx]?.slug ? `/${suggestions[previewModal.idx].slug}` : '';
        } else if (previewModal.type === 'saved' && previewModal.idx !== undefined) {
          previewContent = savedWizardBuilds[previewModal.idx]?.result || null;
          previewUrl = previewContent?.slug ? `/${previewContent.slug}` : '';
        }
        if (!previewContent?.htmlContent) return null;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setPreviewModal(null)}>
            <div className="bg-white rounded-apple w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="bg-gray-100 px-4 py-3 border-b border-apple-border flex items-center gap-3 shrink-0">
                <div className="flex gap-1.5">
                  <button onClick={() => setPreviewModal(null)} className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500 transition-colors" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 bg-white rounded px-3 py-1 text-apple-xs text-apple-text-secondary truncate">
                  {previewUrl || previewContent.title}
                </div>
                <button
                  onClick={() => setPreviewModal(null)}
                  className="text-apple-text-tertiary hover:text-apple-text transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <iframe
                srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${previewContent.title}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:24px;line-height:1.6;color:#1d1d1f;max-width:900px;margin:0 auto}h1{font-size:2em;margin-bottom:0.5em}h2{font-size:1.5em;margin-top:1.5em}h3{font-size:1.2em}p{margin:0.8em 0}img{max-width:100%;height:auto}a{color:#0071e3}ul,ol{padding-left:1.5em}blockquote{border-left:3px solid #0071e3;margin:1em 0;padding:0.5em 1em;background:#f5f5f7}</style></head><body>${previewContent.htmlContent}</body></html>`}
                className="w-full flex-1 border-0"
                title="Page Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
