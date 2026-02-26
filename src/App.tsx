import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import Sidebar from './components/Sidebar';
import type { View } from './components/Sidebar';
import ProjectsView from './components/ProjectsView';
import type { Project } from './components/ProjectsView';
import ObjectivesView from './components/ObjectivesView';
import OverviewView from './components/OverviewView';
import GoogleSearchConsole from './components/SEO/GoogleSearchConsole';
import TasklistView from './components/RecommendationsView';
import LostKeywordsView from './components/LostKeywordsView';
import AuditView from './components/AuditView';
import AuditMainView from './components/AuditMainView';
import AdAuditMainView from './components/AdAuditMainView';
import AdAuditView from './components/AdAuditView';
import AdvertisingView from './components/AdvertisingView';
import ActivityLogView from './components/ActivityLogView';
import BlogAuditView from './components/BlogAuditView';
import BlogOpportunityView from './components/BlogOpportunityView';
import BlogAutomateView from './components/BlogAutomateView';
import BuildRebuildView from './components/BuildRebuildView';
import BuildNewView from './components/BuildNewView';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import SeoAuditToolPage from './components/website/SeoAuditToolPage';
import KeywordRankTrackerPage from './components/website/KeywordRankTrackerPage';
import AiContentGeneratorPage from './components/website/AiContentGeneratorPage';
import ComplianceCheckerPage from './components/website/ComplianceCheckerPage';
import SmallBusinessSeoPage from './components/website/SmallBusinessSeoPage';
import SeoAgencySoftwarePage from './components/website/SeoAgencySoftwarePage';
import AiWebsiteBuilderPage from './components/website/AiWebsiteBuilderPage';
import GoogleAdsOptimizationPage from './components/website/GoogleAdsOptimizationPage';
import AutomatedSeoPage from './components/website/AutomatedSeoPage';
import SeautoVsHiringPage from './components/website/SeautoVsHiringPage';
import PricingPage from './components/website/PricingPage';
import AuthPage from './components/AuthPage';
import ConnectionsView from './components/ConnectionsView';
import { signOut, onAuthStateChange, authenticatedFetch } from './services/authService';
import { supabase } from './services/supabaseClient';
import { API_ENDPOINTS } from './config/api';
import { PlanProvider, usePlan } from './contexts/PlanContext';
import UpgradePrompt from './components/UpgradePrompt';
import SettingsView from './components/SettingsView';
import GscPropertyDropdown from './components/GscPropertyDropdown';
import GscRequiredModal from './components/GscRequiredModal';
import type { DateRange } from './types';
import type { Session } from '@supabase/supabase-js';

type AppState = 'loading' | 'unauthenticated' | 'authenticated';

const GSC_REQUIRED_VIEWS = new Set<View>(['overview', 'keywords', 'lost-keywords']);
const SITE_AUDIT_VIEWS = new Set<View>(['audit', 'seo-audit', 'content-audit', 'aeo-audit', 'schema-audit', 'compliance-audit', 'speed-audit']);
const AD_AUDIT_VIEWS = new Set<View>(['ad-audit', 'ad-audit-google', 'ad-audit-meta', 'ad-audit-linkedin', 'ad-audit-reddit', 'ad-audit-tiktok', 'ad-audit-budget', 'ad-audit-performance', 'ad-audit-creative', 'ad-audit-attribution', 'ad-audit-structure']);

const BREADCRUMB_LABELS: Record<string, string> = {
  'objectives': 'Objectives',
  'overview': 'Search Performance › Dashboard',
  'keywords': 'Search Performance › Keyword Rankings',
  'lost-keywords': 'Search Performance › Keyword Alerts',
  'audit': 'Site Audit › Full Audit',
  'seo-audit': 'Site Audit › Technical SEO',
  'content-audit': 'Site Audit › Content & Copy',
  'aeo-audit': 'Site Audit › AI Visibility',
  'schema-audit': 'Site Audit › Schema Markup',
  'compliance-audit': 'Site Audit › Compliance',
  'speed-audit': 'Site Audit › Page Speed',
  'blog-audit': 'Blog Audit',
  'ad-audit': 'Ad Audit › Full Audit',
  'ad-audit-google': 'Ad Audit › Google Ads',
  'ad-audit-meta': 'Ad Audit › Meta',
  'ad-audit-linkedin': 'Ad Audit › LinkedIn',
  'ad-audit-reddit': 'Ad Audit › Reddit',
  'ad-audit-tiktok': 'Ad Audit › TikTok',
  'connections': 'Connections',
  'settings': 'Settings',
  'ad-audit-budget': 'Ad Audit › Budget & Spend',
  'ad-audit-performance': 'Ad Audit › Performance',
  'ad-audit-creative': 'Ad Audit › Creative & Copy',
  'ad-audit-attribution': 'Ad Audit › Attribution',
  'ad-audit-structure': 'Ad Audit › Account Structure',
  'blog-opportunity': 'Content › Blog Ideas',
  'blog-automate': 'Content › Blog Writer',
  'advertising': 'Content › Ad Keywords',
  'build-rebuild': 'Pages › Optimize Page',
  'build-new': 'Pages › Create Page',
  'tasks': 'Tasks',
  'activity': 'Activity Log',
};

type AdAuditType = 'google' | 'meta' | 'linkedin' | 'reddit' | 'tiktok' | 'budget' | 'performance' | 'creative' | 'attribution' | 'structure';

const AD_AUDIT_VIEW_MAP: Record<string, AdAuditType> = {
  'ad-audit-google': 'google',
  'ad-audit-meta': 'meta',
  'ad-audit-linkedin': 'linkedin',
  'ad-audit-reddit': 'reddit',
  'ad-audit-tiktok': 'tiktok',
  'ad-audit-budget': 'budget',
  'ad-audit-performance': 'performance',
  'ad-audit-creative': 'creative',
  'ad-audit-attribution': 'attribution',
  'ad-audit-structure': 'structure',
};

const AD_AUDIT_TITLES: Record<AdAuditType, { title: string; description: string }> = {
  google: { title: 'Google Ads Audit', description: 'Analyzes wasted spend, Quality Score breakdowns, bid strategies, ad extensions, keyword cannibalization, and search term mining.' },
  meta: { title: 'Meta Ads Audit', description: 'Detects creative fatigue, audience overlap, frequency cap issues, retargeting window optimization, and competitor creative analysis.' },
  linkedin: { title: 'LinkedIn Ads Audit', description: 'Evaluates B2B campaign performance against LinkedIn benchmarks, audience quality, lead gen form friction, and budget efficiency.' },
  reddit: { title: 'Reddit Ads Audit', description: 'Analyzes community targeting, subreddit performance, creative fit, and bid inefficiencies for Reddit advertising campaigns.' },
  tiktok: { title: 'TikTok Ads Audit', description: 'Analyzes TikTok campaign performance, creative effectiveness, audience targeting, and spend efficiency for short-form video advertising.' },
  budget: { title: 'Budget & Spend Audit', description: 'Cross-channel budget optimization, wasted spend identification, budget scenario modeling, channel mix rebalancing, and ROAS forecasting.' },
  performance: { title: 'Performance Audit', description: 'CPA spike diagnostics, anomaly detection, day/hour scheduling optimization, geo analysis, and device performance splits.' },
  creative: { title: 'Creative & Copy Audit', description: 'Ad copy variant analysis, landing page conversion audit, and creative performance benchmarking.' },
  attribution: { title: 'Attribution & Tracking Audit', description: 'Attribution model comparison, conversion path analysis, and UTM/tracking consistency review.' },
  structure: { title: 'Account Structure Audit', description: 'Campaign and ad set structure review, naming convention standardization, and consolidation opportunities.' },
};

function PlanGatedAuditView({ children, auditType }: { children: React.ReactNode; auditType: string }) {
  const { planInfo } = usePlan();
  const allowedTypes = planInfo?.features?.audit_types || ['seo', 'content'];

  if (!allowedTypes.includes(auditType)) {
    return (
      <UpgradePrompt
        feature="full_site_audit"
        title={`${auditType.toUpperCase()} Audit requires an upgrade`}
        description="This audit type is not available on your current plan. Upgrade to Plus or Managed Digital to unlock all audit types."
      />
    );
  }

  return <>{children}</>;
}

function PlanGatedView({ children, feature, limitField }: { children: React.ReactNode; feature?: string; limitField?: string }) {
  const { canUseFeature, isLimitExhausted, planInfo } = usePlan();

  if (feature && !canUseFeature(feature)) {
    return <UpgradePrompt feature={feature} />;
  }

  if (limitField && planInfo) {
    const limit = planInfo.limits[limitField as keyof typeof planInfo.limits];
    if (limit === 0) {
      return <UpgradePrompt limitField={limitField} />;
    }
  }

  return <>{children}</>;
}

function getSiteUrl(project: Project): string {
  return project.gsc_property || project.domain;
}

function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [session, setSession] = useState<Session | null>(null);

  const [currentView, setCurrentView] = useState<View>('projects');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const [visitedAudits, setVisitedAudits] = useState<Set<string>>(new Set());

  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
    endDate: new Date(),
  });
  const [compareDateRange, setCompareDateRange] = useState<DateRange | null>(null);
  const [committedDateRange, setCommittedDateRange] = useState<DateRange | null>(null);
  const [committedCompareDateRange, setCommittedCompareDateRange] = useState<DateRange | null>(null);
  const [loadTrigger, setLoadTrigger] = useState(0);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [connectionVersion, setConnectionVersion] = useState(0);

  const navigate = useNavigate();

  useEffect(() => {
    const hasAuthInUrl =
      window.location.hash.includes('access_token') ||
      new URLSearchParams(window.location.search).has('code');

    if (hasAuthInUrl) {
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (s) {
          setSession(s);
          setAppState('authenticated');
          navigate('/app', { replace: true });
        }
      });
    }

    const { data: { subscription } } = onAuthStateChange((s) => {
      setSession(s);
      if (s) {
        setAppState('authenticated');
        const loc = window.location.pathname;
        if (loc !== '/app' && !loc.startsWith('/app')) {
          navigate('/app', { replace: true });
        }
      } else {
        setAppState('unauthenticated');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProjects = async () => {
    setProjectsLoading(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.projects.list);
      const data = await res.json();
      const fetched: Project[] = data.projects || [];
      setProjects(fetched);

      const lastId = localStorage.getItem('kt_active_project');
      const lastView = localStorage.getItem('kt_active_view') as View | null;
      if (lastId) {
        const p = fetched.find((pr) => pr.id === lastId);
        if (p) {
          setActiveProject(p);
          setCurrentView(lastView && lastView !== 'projects' ? lastView : 'overview');
        }
      }
    } catch {
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  };

  useEffect(() => {
    if (appState !== 'authenticated') return;
    fetchProjects();
  }, [appState]);

  const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const handleLoadData = () => {
    setCommittedDateRange({ ...dateRange });
    setCommittedCompareDateRange(compareDateRange ? { ...compareDateRange } : null);
    setLoadTrigger((prev) => prev + 1);
    setHasLoadedOnce(true);
    setShowDatePicker(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setSession(null);
    setAppState('unauthenticated');
    setActiveProject(null);
    setProjects([]);
    setHasLoadedOnce(false);
    setLoadTrigger(0);
    localStorage.removeItem('kt_active_project');
    localStorage.removeItem('kt_active_view');
  };

  const handleCreateProject = async (name: string, domain: string) => {
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.projects.create, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, domain }),
      });
      const data = await res.json();
      if (res.ok && data.project) {
        setProjects((prev) => [data.project, ...prev]);
      }
    } catch { /* silently fail */ }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await authenticatedFetch(`${API_ENDPOINTS.projects.delete}?id=${id}`, {
        method: 'DELETE',
      });
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (activeProject?.id === id) {
        setActiveProject(null);
        setCurrentView('projects');
        localStorage.removeItem('kt_active_project');
        localStorage.removeItem('kt_active_view');
      }
    } catch { /* silently fail */ }
  };

  const handleUpdateProject = async (id: string, updates: { name?: string; gsc_property?: string }) => {
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.projects.update, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await res.json();
      if (res.ok && data.project) {
        setProjects((prev) => prev.map((p) => p.id === id ? { ...p, ...data.project } : p));
        if (activeProject?.id === id) {
          setActiveProject((prev) => prev ? { ...prev, ...data.project } : prev);
        }
      }
    } catch { /* silently fail */ }
  };

  const handleConnectionChange = () => {
    setConnectionVersion((v) => v + 1);
    setLoadTrigger((v) => v + 1);
    setHasLoadedOnce(false);
    setVisitedAudits(new Set());
  };

  const handleSelectProject = (project: Project) => {
    setActiveProject(project);
    setCurrentView(project.gsc_property ? 'objectives' : 'connections');
    localStorage.setItem('kt_active_project', project.id);
    localStorage.setItem('kt_active_view', project.gsc_property ? 'objectives' : 'connections');
    setHasLoadedOnce(false);
    setLoadTrigger(0);
  };

  const handleNavigate = (view: View) => {
    setCurrentView(view);
    if (view === 'projects') {
      setActiveProject(null);
      localStorage.removeItem('kt_active_project');
      localStorage.removeItem('kt_active_view');
      setHasLoadedOnce(false);
      setLoadTrigger(0);
      setVisitedAudits(new Set());
    } else {
      localStorage.setItem('kt_active_view', view);
      if (SITE_AUDIT_VIEWS.has(view) || AD_AUDIT_VIEWS.has(view)) {
        setVisitedAudits((prev) => new Set(prev).add(view));
      }
    }
  };

  const toggleCompare = () => {
    if (compareDateRange) {
      setCompareDateRange(null);
    } else {
      const daysDiff = Math.ceil(
        (dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const compareStart = new Date(dateRange.startDate);
      compareStart.setDate(compareStart.getDate() - daysDiff - 1);
      const compareEnd = new Date(dateRange.startDate);
      compareEnd.setDate(compareEnd.getDate() - 1);
      setCompareDateRange({ startDate: compareStart, endDate: compareEnd });
    }
  };

  useEffect(() => {
    if (currentView === 'keywords' && activeProject && !hasLoadedOnce) {
      handleLoadData();
    }
  }, [currentView, activeProject]);

  const showsDateControls = activeProject && (currentView === 'overview' || currentView === 'keywords');
  const needsDataLoad = currentView === 'keywords';

  if (appState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (appState === 'unauthenticated') {
    const openApp = () => {
      navigate('/app');
    };

    return (
      <Routes>
        <Route path="/app" element={<AuthPage onAuthenticated={() => setAppState('authenticated')} />} />
        <Route path="/features/seo-audit-tool" element={<SeoAuditToolPage onOpenApp={openApp} />} />
        <Route path="/features/keyword-rank-tracker" element={<KeywordRankTrackerPage onOpenApp={openApp} />} />
        <Route path="/features/ai-content-generator" element={<AiContentGeneratorPage onOpenApp={openApp} />} />
        <Route path="/features/compliance-checker" element={<ComplianceCheckerPage onOpenApp={openApp} />} />
        <Route path="/features/ai-website-builder" element={<AiWebsiteBuilderPage onOpenApp={openApp} />} />
        <Route path="/features/google-ads-optimization" element={<GoogleAdsOptimizationPage onOpenApp={openApp} />} />
        <Route path="/solutions/small-business-seo" element={<SmallBusinessSeoPage onOpenApp={openApp} />} />
        <Route path="/solutions/seo-agency-software" element={<SeoAgencySoftwarePage onOpenApp={openApp} />} />
        <Route path="/resources/automated-seo" element={<AutomatedSeoPage onOpenApp={openApp} />} />
        <Route path="/compare/seauto-vs-hiring" element={<SeautoVsHiringPage onOpenApp={openApp} />} />
        <Route path="/pricing" element={<PricingPage onOpenApp={openApp} />} />
        <Route path="*" element={<LandingPage onOpenApp={openApp} />} />
      </Routes>
    );
  }

  return (
    <PlanProvider isAuthenticated={appState === 'authenticated'}>
    <div className="flex h-screen bg-apple-bg overflow-hidden">
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onSignOut={handleSignOut}
        hasActiveProject={!!activeProject}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 shrink-0 bg-white/80 backdrop-blur-xl border-b border-apple-divider flex items-center px-6 gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => handleNavigate('projects')}
              className="text-apple-sm text-apple-text-secondary hover:text-apple-blue transition-colors shrink-0"
            >
              Projects
            </button>
            {activeProject && (
              <>
                <svg className="w-3 h-3 text-apple-text-tertiary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-apple-sm font-medium text-apple-text truncate">
                  {activeProject.name}
                </span>
                {currentView !== 'projects' && BREADCRUMB_LABELS[currentView] && (
                  <>
                    <svg className="w-3 h-3 text-apple-text-tertiary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-apple-sm text-apple-text-tertiary">
                      {BREADCRUMB_LABELS[currentView]}
                    </span>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex-1" />

          {activeProject && GSC_REQUIRED_VIEWS.has(currentView) && activeProject.gsc_property && (
            <GscPropertyDropdown
              projectDomain={activeProject.domain}
              currentProperty={activeProject.gsc_property}
              onPropertyChange={(prop) => handleUpdateProject(activeProject.id, { gsc_property: prop })}
            />
          )}

          {showsDateControls && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-apple-sm border border-apple-border text-apple-sm text-apple-text-secondary hover:bg-apple-fill-secondary transition-all duration-150"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>
                  {format(dateRange.startDate, 'MMM d')} – {format(dateRange.endDate, 'MMM d, yyyy')}
                </span>
                {compareDateRange && (
                  <span className="text-apple-text-tertiary">vs prior</span>
                )}
                <svg className={`w-3 h-3 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {needsDataLoad && (
                <button
                  onClick={handleLoadData}
                  className="px-3 py-1.5 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors"
                >
                  {hasLoadedOnce ? 'Refresh' : 'Load Data'}
                </button>
              )}
            </div>
          )}
        </header>

        {showDatePicker && showsDateControls && (
          <div className="bg-white border-b border-apple-divider shadow-sm px-6 py-4">
            <div className="max-w-3xl flex flex-wrap gap-6 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1.5 uppercase tracking-wider">
                  Date Range
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={format(dateRange.startDate, 'yyyy-MM-dd')}
                    onChange={(e) => setDateRange({ ...dateRange, startDate: parseLocalDate(e.target.value) })}
                    className="input text-apple-sm"
                  />
                  <span className="text-apple-text-tertiary text-apple-xs">to</span>
                  <input
                    type="date"
                    value={format(dateRange.endDate, 'yyyy-MM-dd')}
                    onChange={(e) => setDateRange({ ...dateRange, endDate: parseLocalDate(e.target.value) })}
                    className="input text-apple-sm"
                  />
                </div>
              </div>

              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-3 mb-1.5">
                  <label className="block text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider">
                    Compare Period
                  </label>
                  <button
                    onClick={toggleCompare}
                    className={`px-2.5 py-0.5 text-apple-xs rounded-apple-pill transition-all duration-200 ${
                      compareDateRange
                        ? 'bg-red-50 text-apple-red hover:bg-red-100'
                        : 'bg-apple-fill-secondary text-apple-text-secondary hover:bg-gray-200'
                    }`}
                  >
                    {compareDateRange ? 'Disable' : 'Enable'}
                  </button>
                </div>
                {compareDateRange && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={format(compareDateRange.startDate, 'yyyy-MM-dd')}
                      onChange={(e) => setCompareDateRange({ ...compareDateRange, startDate: parseLocalDate(e.target.value) })}
                      className="input text-apple-sm"
                    />
                    <span className="text-apple-text-tertiary text-apple-xs">to</span>
                    <input
                      type="date"
                      value={format(compareDateRange.endDate, 'yyyy-MM-dd')}
                      onChange={(e) => setCompareDateRange({ ...compareDateRange, endDate: parseLocalDate(e.target.value) })}
                      className="input text-apple-sm"
                    />
                  </div>
                )}
              </div>

              {needsDataLoad && (
                <button
                  onClick={handleLoadData}
                  className="btn-primary text-apple-sm"
                >
                  {hasLoadedOnce ? 'Refresh Data' : 'Load Data'}
                </button>
              )}
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-6">
          {currentView === 'projects' && (
            <ProjectsView
              projects={projects}
              onCreateProject={handleCreateProject}
              onDeleteProject={handleDeleteProject}
              onSelectProject={handleSelectProject}
            />
          )}

          {currentView === 'objectives' && activeProject && (
            <ObjectivesView projectId={activeProject.id} projectName={activeProject.name} siteUrl={getSiteUrl(activeProject)} />
          )}

          {currentView === 'connections' && activeProject && (
            <ConnectionsView
              siteUrl={getSiteUrl(activeProject)}
              projectId={activeProject.id}
              projectDomain={activeProject.domain}
              gscProperty={activeProject.gsc_property}
              onGscPropertySelected={(prop) => handleUpdateProject(activeProject.id, { gsc_property: prop })}
              onConnectionChange={handleConnectionChange}
            />
          )}

          {currentView === 'settings' && activeProject && (
            <SettingsView
              projectId={activeProject.id}
              projectName={activeProject.name}
              isOwner={activeProject.role === 'owner'}
            />
          )}

          {activeProject && !activeProject.gsc_property && GSC_REQUIRED_VIEWS.has(currentView) && (
            <GscRequiredModal onGoToConnections={() => handleNavigate('connections')} />
          )}

          {activeProject && activeProject.gsc_property && (
            <div style={{ display: currentView === 'overview' ? 'block' : 'none' }}>
              <OverviewView
                siteUrl={getSiteUrl(activeProject)}
                projectId={activeProject.id}
                dateRange={dateRange}
                compareDateRange={compareDateRange}
                connectionVersion={connectionVersion}
              />
            </div>
          )}

          {activeProject && activeProject.gsc_property && committedDateRange && (
            <div style={{ display: currentView === 'keywords' ? 'block' : 'none' }}>
              <GoogleSearchConsole
                dateRange={committedDateRange}
                compareDateRange={committedCompareDateRange}
                siteUrl={getSiteUrl(activeProject)}
                loadTrigger={loadTrigger}
                projectId={activeProject.id}
              />
            </div>
          )}

          {currentView === 'lost-keywords' && activeProject && activeProject.gsc_property && (
            <LostKeywordsView key={connectionVersion} siteUrl={getSiteUrl(activeProject)} projectId={activeProject.id} />
          )}

          {/* ── SEO Audit Views ── */}
          {activeProject && visitedAudits.has('audit') && (
            <div style={{ display: currentView === 'audit' ? 'block' : 'none' }}>
              <PlanGatedView feature="full_site_audit">
                <AuditMainView siteUrl={getSiteUrl(activeProject)} projectId={activeProject.id} />
              </PlanGatedView>
            </div>
          )}
          {activeProject && visitedAudits.has('seo-audit') && (
            <div style={{ display: currentView === 'seo-audit' ? 'block' : 'none' }}>
              <AuditView siteUrl={getSiteUrl(activeProject)} projectId={activeProject.id} auditType="seo" title="SEO Audit" description="Comprehensive technical SEO audit of every page in your sitemap. Analyzes title tags, meta descriptions, headings, internal links, images, and more." isVisible={currentView === 'seo-audit'} />
            </div>
          )}
          {activeProject && visitedAudits.has('content-audit') && (
            <div style={{ display: currentView === 'content-audit' ? 'block' : 'none' }}>
              <AuditView siteUrl={getSiteUrl(activeProject)} projectId={activeProject.id} auditType="content" title="Content Audit" description="Evaluates copy quality, conversion optimization, and marketing psychology across every page." isVisible={currentView === 'content-audit'} />
            </div>
          )}
          {activeProject && visitedAudits.has('aeo-audit') && (
            <div style={{ display: currentView === 'aeo-audit' ? 'block' : 'none' }}>
              <PlanGatedAuditView auditType="aeo">
                <AuditView siteUrl={getSiteUrl(activeProject)} projectId={activeProject.id} auditType="aeo" title="AEO Audit" description="AI Engine Optimization audit — analyzes how well your pages would be cited by AI assistants." isVisible={currentView === 'aeo-audit'} />
              </PlanGatedAuditView>
            </div>
          )}
          {activeProject && visitedAudits.has('schema-audit') && (
            <div style={{ display: currentView === 'schema-audit' ? 'block' : 'none' }}>
              <PlanGatedAuditView auditType="schema">
                <AuditView siteUrl={getSiteUrl(activeProject)} projectId={activeProject.id} auditType="schema" title="Schema Audit" description="Validates existing schema markup and identifies missing structured data opportunities." isVisible={currentView === 'schema-audit'} />
              </PlanGatedAuditView>
            </div>
          )}
          {activeProject && visitedAudits.has('compliance-audit') && (
            <div style={{ display: currentView === 'compliance-audit' ? 'block' : 'none' }}>
              <PlanGatedAuditView auditType="compliance">
                <AuditView siteUrl={getSiteUrl(activeProject)} projectId={activeProject.id} auditType="compliance" title="Compliance Audit" description="Audits for GDPR, CCPA, ADA/WCAG accessibility, privacy, security headers, and all applicable compliance requirements." isVisible={currentView === 'compliance-audit'} />
              </PlanGatedAuditView>
            </div>
          )}
          {activeProject && visitedAudits.has('speed-audit') && (
            <div style={{ display: currentView === 'speed-audit' ? 'block' : 'none' }}>
              <PlanGatedAuditView auditType="speed">
                <AuditView siteUrl={getSiteUrl(activeProject)} projectId={activeProject.id} auditType="speed" title="Page Speed Audit" description="Analyzes Core Web Vitals signals, render-blocking resources, image optimization, font loading, and page load performance." isVisible={currentView === 'speed-audit'} />
              </PlanGatedAuditView>
            </div>
          )}

          {/* ── Advertising Audit Views ── */}
          {activeProject && visitedAudits.has('ad-audit') && (
            <div style={{ display: currentView === 'ad-audit' ? 'block' : 'none' }}>
              <AdAuditMainView siteUrl={getSiteUrl(activeProject)} projectId={activeProject.id} />
            </div>
          )}
          {activeProject && Object.entries(AD_AUDIT_VIEW_MAP).map(([viewId, adType]) =>
            visitedAudits.has(viewId) ? (
              <div key={viewId} style={{ display: currentView === viewId ? 'block' : 'none' }}>
                <AdAuditView
                  siteUrl={getSiteUrl(activeProject)}
                  projectId={activeProject.id}
                  adAuditType={adType}
                  title={AD_AUDIT_TITLES[adType].title}
                  description={AD_AUDIT_TITLES[adType].description}
                  isVisible={currentView === viewId}
                />
              </div>
            ) : null
          )}

          {currentView === 'advertising' && activeProject && (
            <PlanGatedView feature="advertising">
              <AdvertisingView key={connectionVersion} siteUrl={getSiteUrl(activeProject)} projectId={activeProject.id} />
            </PlanGatedView>
          )}

          {/* ── Blog Views ── */}
          {currentView === 'blog-audit' && activeProject && (
            <BlogAuditView key={connectionVersion} siteUrl={getSiteUrl(activeProject)} projectId={activeProject.id} />
          )}
          {currentView === 'blog-opportunity' && activeProject && (
            <BlogOpportunityView key={connectionVersion} siteUrl={getSiteUrl(activeProject)} projectId={activeProject.id} />
          )}
          {currentView === 'blog-automate' && activeProject && (
            <BlogAutomateView key={connectionVersion} siteUrl={getSiteUrl(activeProject)} projectId={activeProject.id} />
          )}

          {/* ── Build Views ── */}
          {currentView === 'build-rebuild' && activeProject && (
            <PlanGatedView limitField="page_builds">
              <BuildRebuildView key={connectionVersion} siteUrl={getSiteUrl(activeProject)} projectId={activeProject.id} />
            </PlanGatedView>
          )}
          {currentView === 'build-new' && activeProject && (
            <PlanGatedView limitField="page_builds">
              <BuildNewView key={connectionVersion} siteUrl={getSiteUrl(activeProject)} projectId={activeProject.id} />
            </PlanGatedView>
          )}

          {/* ── Consolidated Tasks & Activity ── */}
          {currentView === 'tasks' && activeProject && (
            <TasklistView key={connectionVersion} siteUrl={getSiteUrl(activeProject)} projectId={activeProject.id} scope="all" />
          )}
          {currentView === 'activity' && activeProject && (
            <ActivityLogView key={connectionVersion} siteUrl={getSiteUrl(activeProject)} scope="all" />
          )}
        </main>
      </div>
    </div>
    </PlanProvider>
  );
}

export default App;
