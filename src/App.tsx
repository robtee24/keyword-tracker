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
import OAuthModal from './components/OAuthModal';
import { isAuthenticated, clearTokens, authenticatedFetch } from './services/authService';
import { API_ENDPOINTS } from './config/api';
import type { DateRange, SearchConsoleSite } from './types';

type AppState = 'loading' | 'unauthenticated' | 'authenticated';

const PROJECTS_KEY = 'kt_projects';

const SEO_AUDIT_VIEWS = new Set<View>(['audit', 'seo-audit', 'content-audit', 'aeo-audit', 'schema-audit', 'compliance-audit', 'speed-audit', 'seo-tasklist', 'seo-activity']);
const AD_AUDIT_VIEWS = new Set<View>(['ad-audit', 'ad-audit-google', 'ad-audit-meta', 'ad-audit-linkedin', 'ad-audit-reddit', 'ad-audit-budget', 'ad-audit-performance', 'ad-audit-creative', 'ad-audit-attribution', 'ad-audit-structure', 'ad-tasklist', 'ad-activity']);

const BREADCRUMB_LABELS: Record<string, string> = {
  'objectives': 'Objectives',
  'overview': 'Organic Overview',
  'keywords': 'Organic Overview › Keywords',
  'lost-keywords': 'Organic Overview › Lost Keywords',
  'organic-tasklist': 'Organic Overview › Tasklist',
  'organic-activity': 'Organic Overview › Activity Log',
  'audit': 'SEO Audit',
  'seo-audit': 'SEO Audit › SEO',
  'content-audit': 'SEO Audit › Content',
  'aeo-audit': 'SEO Audit › AEO',
  'schema-audit': 'SEO Audit › Schema',
  'compliance-audit': 'SEO Audit › Compliance',
  'speed-audit': 'SEO Audit › Page Speed',
  'seo-tasklist': 'SEO Audit › Tasklist',
  'seo-activity': 'SEO Audit › Activity Log',
  'ad-audit': 'Ad Audit',
  'ad-audit-google': 'Ad Audit › Google Ads',
  'ad-audit-meta': 'Ad Audit › Meta Ads',
  'ad-audit-linkedin': 'Ad Audit › LinkedIn Ads',
  'ad-audit-reddit': 'Ad Audit › Reddit Ads',
  'ad-audit-budget': 'Ad Audit › Budget & Spend',
  'ad-audit-performance': 'Ad Audit › Performance',
  'ad-audit-creative': 'Ad Audit › Creative & Copy',
  'ad-audit-attribution': 'Ad Audit › Attribution',
  'ad-audit-structure': 'Ad Audit › Account Structure',
  'ad-tasklist': 'Ad Audit › Tasklist',
  'ad-activity': 'Ad Audit › Activity Log',
  'advertising': 'Advertising',
};

type AdAuditType = 'google' | 'meta' | 'linkedin' | 'reddit' | 'budget' | 'performance' | 'creative' | 'attribution' | 'structure';

const AD_AUDIT_VIEW_MAP: Record<string, AdAuditType> = {
  'ad-audit-google': 'google',
  'ad-audit-meta': 'meta',
  'ad-audit-linkedin': 'linkedin',
  'ad-audit-reddit': 'reddit',
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
  budget: { title: 'Budget & Spend Audit', description: 'Cross-channel budget optimization, wasted spend identification, budget scenario modeling, channel mix rebalancing, and ROAS forecasting.' },
  performance: { title: 'Performance Audit', description: 'CPA spike diagnostics, anomaly detection, day/hour scheduling optimization, geo analysis, and device performance splits.' },
  creative: { title: 'Creative & Copy Audit', description: 'Ad copy variant analysis, landing page conversion audit, and creative performance benchmarking.' },
  attribution: { title: 'Attribution & Tracking Audit', description: 'Attribution model comparison, conversion path analysis, and UTM/tracking consistency review.' },
  structure: { title: 'Account Structure Audit', description: 'Campaign and ad set structure review, naming convention standardization, and consolidation opportunities.' },
};

function loadProjects(): Project[] {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveProjects(projects: Project[]) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

function App() {
  const [appState, setAppState] = useState<AppState>('loading');

  const [currentView, setCurrentView] = useState<View>('projects');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [projects, setProjects] = useState<Project[]>(loadProjects);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  const [sites, setSites] = useState<SearchConsoleSite[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);

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

  useEffect(() => {
    if (isAuthenticated()) {
      setAppState('authenticated');
    } else {
      setAppState('unauthenticated');
    }
  }, []);

  useEffect(() => {
    if (appState !== 'authenticated') return;
    setSitesLoading(true);
    authenticatedFetch(API_ENDPOINTS.google.searchConsole.sites)
      .then((r) => r.json())
      .then((data) => setSites(data.sites || []))
      .catch(() => {})
      .finally(() => setSitesLoading(false));
  }, [appState]);

  useEffect(() => {
    const lastId = localStorage.getItem('kt_active_project');
    const lastView = localStorage.getItem('kt_active_view') as View | null;
    if (lastId) {
      const p = projects.find((pr) => pr.id === lastId);
      if (p) {
        setActiveProject(p);
        setCurrentView(lastView && lastView !== 'projects' ? lastView : 'overview');
      }
    }
  }, []);

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

  const handleSignOut = () => {
    clearTokens();
    setAppState('unauthenticated');
    setActiveProject(null);
    setHasLoadedOnce(false);
    setLoadTrigger(0);
  };

  const handleCreateProject = (name: string, siteUrl: string) => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name,
      siteUrl,
      createdAt: new Date().toISOString(),
    };
    const updated = [...projects, newProject];
    setProjects(updated);
    saveProjects(updated);
  };

  const handleDeleteProject = (id: string) => {
    const updated = projects.filter((p) => p.id !== id);
    setProjects(updated);
    saveProjects(updated);
    if (activeProject?.id === id) {
      setActiveProject(null);
      setCurrentView('projects');
      localStorage.removeItem('kt_active_project');
      localStorage.removeItem('kt_active_view');
    }
  };

  const handleSelectProject = (project: Project) => {
    setActiveProject(project);
    setCurrentView('objectives');
    localStorage.setItem('kt_active_project', project.id);
    localStorage.setItem('kt_active_view', 'objectives');
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
      if (SEO_AUDIT_VIEWS.has(view) || AD_AUDIT_VIEWS.has(view)) {
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
    return <OAuthModal onAuthenticated={() => setAppState('authenticated')} />;
  }

  return (
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
              sites={sites}
              sitesLoading={sitesLoading}
              onCreateProject={handleCreateProject}
              onDeleteProject={handleDeleteProject}
              onSelectProject={handleSelectProject}
            />
          )}

          {currentView === 'objectives' && activeProject && (
            <ObjectivesView projectId={activeProject.id} projectName={activeProject.name} siteUrl={activeProject.siteUrl} />
          )}

          {activeProject && (
            <div style={{ display: currentView === 'overview' ? 'block' : 'none' }}>
              <OverviewView
                siteUrl={activeProject.siteUrl}
                dateRange={dateRange}
                compareDateRange={compareDateRange}
              />
            </div>
          )}

          {activeProject && committedDateRange && (
            <div style={{ display: currentView === 'keywords' ? 'block' : 'none' }}>
              <GoogleSearchConsole
                dateRange={committedDateRange}
                compareDateRange={committedCompareDateRange}
                siteUrl={activeProject.siteUrl}
                loadTrigger={loadTrigger}
                projectId={activeProject.id}
              />
            </div>
          )}

          {currentView === 'lost-keywords' && activeProject && (
            <LostKeywordsView siteUrl={activeProject.siteUrl} />
          )}

          {/* ── SEO Audit Views ── */}
          {activeProject && visitedAudits.has('audit') && (
            <div style={{ display: currentView === 'audit' ? 'block' : 'none' }}>
              <AuditMainView siteUrl={activeProject.siteUrl} />
            </div>
          )}
          {activeProject && visitedAudits.has('seo-audit') && (
            <div style={{ display: currentView === 'seo-audit' ? 'block' : 'none' }}>
              <AuditView siteUrl={activeProject.siteUrl} auditType="seo" title="SEO Audit" description="Comprehensive technical SEO audit of every page in your sitemap. Analyzes title tags, meta descriptions, headings, internal links, images, and more." isVisible={currentView === 'seo-audit'} />
            </div>
          )}
          {activeProject && visitedAudits.has('content-audit') && (
            <div style={{ display: currentView === 'content-audit' ? 'block' : 'none' }}>
              <AuditView siteUrl={activeProject.siteUrl} auditType="content" title="Content Audit" description="Evaluates copy quality, conversion optimization, and marketing psychology across every page." isVisible={currentView === 'content-audit'} />
            </div>
          )}
          {activeProject && visitedAudits.has('aeo-audit') && (
            <div style={{ display: currentView === 'aeo-audit' ? 'block' : 'none' }}>
              <AuditView siteUrl={activeProject.siteUrl} auditType="aeo" title="AEO Audit" description="AI Engine Optimization audit — analyzes how well your pages would be cited by AI assistants." isVisible={currentView === 'aeo-audit'} />
            </div>
          )}
          {activeProject && visitedAudits.has('schema-audit') && (
            <div style={{ display: currentView === 'schema-audit' ? 'block' : 'none' }}>
              <AuditView siteUrl={activeProject.siteUrl} auditType="schema" title="Schema Audit" description="Validates existing schema markup and identifies missing structured data opportunities." isVisible={currentView === 'schema-audit'} />
            </div>
          )}
          {activeProject && visitedAudits.has('compliance-audit') && (
            <div style={{ display: currentView === 'compliance-audit' ? 'block' : 'none' }}>
              <AuditView siteUrl={activeProject.siteUrl} auditType="compliance" title="Compliance Audit" description="Audits for GDPR, CCPA, ADA/WCAG accessibility, privacy, security headers, and all applicable compliance requirements." isVisible={currentView === 'compliance-audit'} />
            </div>
          )}
          {activeProject && visitedAudits.has('speed-audit') && (
            <div style={{ display: currentView === 'speed-audit' ? 'block' : 'none' }}>
              <AuditView siteUrl={activeProject.siteUrl} auditType="speed" title="Page Speed Audit" description="Analyzes Core Web Vitals signals, render-blocking resources, image optimization, font loading, and page load performance." isVisible={currentView === 'speed-audit'} />
            </div>
          )}

          {/* ── Advertising Audit Views ── */}
          {activeProject && visitedAudits.has('ad-audit') && (
            <div style={{ display: currentView === 'ad-audit' ? 'block' : 'none' }}>
              <AdAuditMainView siteUrl={activeProject.siteUrl} />
            </div>
          )}
          {activeProject && Object.entries(AD_AUDIT_VIEW_MAP).map(([viewId, adType]) =>
            visitedAudits.has(viewId) ? (
              <div key={viewId} style={{ display: currentView === viewId ? 'block' : 'none' }}>
                <AdAuditView
                  siteUrl={activeProject.siteUrl}
                  adAuditType={adType}
                  title={AD_AUDIT_TITLES[adType].title}
                  description={AD_AUDIT_TITLES[adType].description}
                  isVisible={currentView === viewId}
                />
              </div>
            ) : null
          )}

          {currentView === 'advertising' && activeProject && (
            <AdvertisingView siteUrl={activeProject.siteUrl} projectId={activeProject.id} />
          )}

          {/* ── Scoped Tasklists ── */}
          {currentView === 'organic-tasklist' && activeProject && (
            <TasklistView siteUrl={activeProject.siteUrl} scope="organic" />
          )}
          {currentView === 'seo-tasklist' && activeProject && (
            <TasklistView siteUrl={activeProject.siteUrl} scope="seo" />
          )}
          {currentView === 'ad-tasklist' && activeProject && (
            <TasklistView siteUrl={activeProject.siteUrl} scope="ad" />
          )}

          {/* ── Scoped Activity Logs ── */}
          {currentView === 'organic-activity' && activeProject && (
            <ActivityLogView siteUrl={activeProject.siteUrl} scope="organic" />
          )}
          {currentView === 'seo-activity' && activeProject && (
            <ActivityLogView siteUrl={activeProject.siteUrl} scope="seo" />
          )}
          {currentView === 'ad-activity' && activeProject && (
            <ActivityLogView siteUrl={activeProject.siteUrl} scope="ad" />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
