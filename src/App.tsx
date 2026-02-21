import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import Sidebar from './components/Sidebar';
import type { View } from './components/Sidebar';
import ProjectsView from './components/ProjectsView';
import type { Project } from './components/ProjectsView';
import ObjectivesView from './components/ObjectivesView';
import OverviewView from './components/OverviewView';
import GoogleSearchConsole from './components/SEO/GoogleSearchConsole';
import RecommendationsView from './components/RecommendationsView';
import LostKeywordsView from './components/LostKeywordsView';
import AuditView from './components/AuditView';
import ActivityLogView from './components/ActivityLogView';
import OAuthModal from './components/OAuthModal';
import { isAuthenticated, clearTokens, authenticatedFetch } from './services/authService';
import { API_ENDPOINTS } from './config/api';
import type { DateRange, SearchConsoleSite } from './types';

type AppState = 'loading' | 'unauthenticated' | 'authenticated';

const PROJECTS_KEY = 'kt_projects';

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

  // Navigation
  const [currentView, setCurrentView] = useState<View>('projects');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Projects
  const [projects, setProjects] = useState<Project[]>(loadProjects);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  // Sites (for project creation dropdown)
  const [sites, setSites] = useState<SearchConsoleSite[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);

  // Audit views that have been visited (stay mounted for background processing)
  const [visitedAudits, setVisitedAudits] = useState<Set<string>>(new Set());

  // Date selection
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

  // Fetch sites when authenticated
  useEffect(() => {
    if (appState !== 'authenticated') return;
    setSitesLoading(true);
    authenticatedFetch(API_ENDPOINTS.google.searchConsole.sites)
      .then((r) => r.json())
      .then((data) => setSites(data.sites || []))
      .catch(() => {})
      .finally(() => setSitesLoading(false));
  }, [appState]);

  // Restore last active project and view
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
      if (['seo-audit', 'content-audit', 'aeo-audit', 'schema-audit'].includes(view)) {
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

  // Auto-load keywords when navigating to the keywords view for the first time
  useEffect(() => {
    if (currentView === 'keywords' && activeProject && !hasLoadedOnce) {
      handleLoadData();
    }
  }, [currentView, activeProject]);

  // Views that need the date picker in the header
  const showsDateControls = activeProject && (currentView === 'overview' || currentView === 'keywords');

  // Show refresh button only after initial load (for date changes)
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
      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onSignOut={handleSignOut}
        hasActiveProject={!!activeProject}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-14 shrink-0 bg-white/80 backdrop-blur-xl border-b border-apple-divider flex items-center px-6 gap-4">
          {/* Breadcrumb */}
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
                {currentView !== 'projects' && (
                  <>
                    <svg className="w-3 h-3 text-apple-text-tertiary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-apple-sm text-apple-text-tertiary capitalize">
                      {({
                        'activity-log': 'Activity Log',
                        'lost-keywords': 'Lost Keywords',
                        'seo-audit': 'SEO Audit',
                        'content-audit': 'Content Audit',
                        'aeo-audit': 'AEO Audit',
                        'schema-audit': 'Schema Audit',
                      } as Record<string, string>)[currentView] || currentView}
                    </span>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex-1" />

          {/* Date controls */}
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

        {/* Date Picker Dropdown */}
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

              {/* Load Data button in dropdown for keywords view */}
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

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Projects List */}
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

          {/* Website Objectives */}
          {currentView === 'objectives' && activeProject && (
            <ObjectivesView projectId={activeProject.id} projectName={activeProject.name} siteUrl={activeProject.siteUrl} />
          )}

          {/* Overview Dashboard — kept mounted so it doesn't refetch on every view switch */}
          {activeProject && (
            <div style={{ display: currentView === 'overview' ? 'block' : 'none' }}>
              <OverviewView
                siteUrl={activeProject.siteUrl}
                dateRange={dateRange}
                compareDateRange={compareDateRange}
              />
            </div>
          )}

          {/* Keywords — kept mounted so it doesn't refetch on every view switch */}
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

          {/* Lost Keywords */}
          {currentView === 'lost-keywords' && activeProject && (
            <LostKeywordsView siteUrl={activeProject.siteUrl} />
          )}

          {/* Audit Views — stay mounted once visited so audits continue in background */}
          {activeProject && visitedAudits.has('seo-audit') && (
            <div style={{ display: currentView === 'seo-audit' ? 'block' : 'none' }}>
              <AuditView
                siteUrl={activeProject.siteUrl}
                auditType="seo"
                title="SEO Audit"
                description="Comprehensive technical SEO audit of every page in your sitemap. Analyzes title tags, meta descriptions, headings, internal links, images, and more."
              />
            </div>
          )}
          {activeProject && visitedAudits.has('content-audit') && (
            <div style={{ display: currentView === 'content-audit' ? 'block' : 'none' }}>
              <AuditView
                siteUrl={activeProject.siteUrl}
                auditType="content"
                title="Content Audit"
                description="Evaluates copy quality, conversion optimization, and marketing psychology across every page. Combines copywriting, CRO, and persuasion analysis."
              />
            </div>
          )}
          {activeProject && visitedAudits.has('aeo-audit') && (
            <div style={{ display: currentView === 'aeo-audit' ? 'block' : 'none' }}>
              <AuditView
                siteUrl={activeProject.siteUrl}
                auditType="aeo"
                title="AEO Audit"
                description="AI Engine Optimization audit — analyzes how well your pages would be cited by AI assistants like ChatGPT, Perplexity, and Google AI Overviews."
              />
            </div>
          )}
          {activeProject && visitedAudits.has('schema-audit') && (
            <div style={{ display: currentView === 'schema-audit' ? 'block' : 'none' }}>
              <AuditView
                siteUrl={activeProject.siteUrl}
                auditType="schema"
                title="Schema Audit"
                description="Validates existing schema markup and identifies missing structured data opportunities for rich snippets in Google search results."
              />
            </div>
          )}

          {/* Recommendations */}
          {currentView === 'recommendations' && activeProject && (
            <RecommendationsView siteUrl={activeProject.siteUrl} />
          )}

          {/* Activity Log */}
          {currentView === 'activity-log' && activeProject && (
            <ActivityLogView siteUrl={activeProject.siteUrl} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
