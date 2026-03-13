import { useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../../services/supabaseClient';
import { API_BASE_URL } from '../../config/api';
import { PlanProvider } from '../../contexts/PlanContext';
import { CreditsProvider } from '../../contexts/CreditsContext';
import { BackgroundTaskProvider } from '../../contexts/BackgroundTaskContext';
import BackgroundTaskIndicator from '../BackgroundTaskIndicator';
import VideoIdeasView from '../VideoIdeasView';
import VideoCreateView from '../VideoCreateView';
import AdCreatorView from '../AdCreatorView';
import TestView from '../TestView';
import type { Project } from '../ProjectsView';

const ACCESS_PASSWORD = 'BNBCALC';
const SESSION_ENDPOINT = `${API_BASE_URL}/api/ads/session`;

type AdsView =
  | 'video-ideas' | 'video-create'
  | 'static-meta' | 'static-tiktok' | 'static-linkedin' | 'static-x'
  | 'api-test';

const VIDEO_ADS_VIEWS = new Set<AdsView>(['video-ideas', 'video-create']);
const STATIC_ADS_VIEWS = new Set<AdsView>(['static-meta', 'static-tiktok', 'static-linkedin', 'static-x']);

const videoSubItems: Array<{ id: AdsView; label: string }> = [
  { id: 'video-ideas', label: 'Generate Ideas' },
  { id: 'video-create', label: 'Create Video' },
];

const staticSubItems: Array<{ id: AdsView; label: string }> = [
  { id: 'static-meta', label: 'Meta' },
  { id: 'static-tiktok', label: 'TikTok' },
  { id: 'static-linkedin', label: 'LinkedIn' },
  { id: 'static-x', label: 'X (Twitter)' },
];

const STATIC_PLATFORM_MAP: Record<string, 'meta' | 'tiktok' | 'linkedin' | 'x'> = {
  'static-meta': 'meta',
  'static-tiktok': 'tiktok',
  'static-linkedin': 'linkedin',
  'static-x': 'x',
};

function getSiteUrl(project: Project): string {
  return project.gsc_property || project.domain;
}

/* ── Sidebar NavGroup ── */

function NavGroup({
  label,
  icon,
  parentView,
  subItems,
  isGroupActive,
  expanded,
  onToggleExpand,
  currentView,
  onNavigate,
}: {
  label: string;
  icon: ReactNode;
  parentView: AdsView;
  subItems: Array<{ id: AdsView; label: string }>;
  isGroupActive: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  currentView: AdsView;
  onNavigate: (v: AdsView) => void;
}) {
  const handleClick = () => {
    if (!expanded) {
      onToggleExpand();
      onNavigate(parentView);
    } else if (currentView === parentView) {
      onToggleExpand();
    } else {
      onNavigate(parentView);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-left transition-all duration-150 ${
          isGroupActive
            ? 'bg-blue-500/10 text-blue-600'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
        }`}
      >
        <span className={`shrink-0 ${isGroupActive ? 'text-blue-600' : ''}`}>{icon}</span>
        <span className="truncate flex-1 text-left">{label}</span>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-200 pl-2">
          {subItems.map((sub) => {
            const isSubActive = currentView === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => onNavigate(sub.id)}
                className={`w-full flex items-center text-left px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 ${
                  isSubActive
                    ? 'bg-blue-500/10 text-blue-600'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                }`}
              >
                {sub.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Password Gate ── */

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === ACCESS_PASSWORD) {
      sessionStorage.setItem('ads_unlocked', '1');
      onUnlock();
    } else {
      setError(true);
      setPw('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-semibold text-gray-900 mb-1 text-center">Ad Studio</h1>
        <p className="text-sm text-gray-500 mb-6 text-center">Enter access code to continue</p>
        <input
          type="password"
          value={pw}
          onChange={(e) => { setPw(e.target.value); setError(false); }}
          placeholder="Access code"
          autoFocus
          className={`w-full px-4 py-2.5 rounded-lg border text-sm ${
            error ? 'border-red-400 bg-red-50' : 'border-gray-200'
          } focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500`}
        />
        {error && <p className="text-red-500 text-xs mt-1.5">Incorrect access code</p>}
        <button
          type="submit"
          className="w-full mt-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Continue
        </button>
      </form>
    </div>
  );
}

/* ── Main Standalone Page ── */

export default function AdsStandalonePage() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('ads_unlocked') === '1');
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentView, setCurrentView] = useState<AdsView>('video-ideas');
  const [videoExpanded, setVideoExpanded] = useState(true);
  const [staticExpanded, setStaticExpanded] = useState(false);
  const [adTizeIdea, setAdTizeIdea] = useState<Record<string, unknown> | null>(null);
  const initRef = useRef(false);

  const initSession = useCallback(async () => {
    if (initRef.current) return;
    initRef.current = true;
    setLoading(true);
    setError('');
    try {
      // Call the backend to get a Supabase session + project for the ads page
      const res = await fetch(SESSION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: ACCESS_PASSWORD }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error (${res.status})`);
      }

      const data = await res.json();

      // Set the session on the Supabase client so authenticatedFetch works
      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      setProject(data.project as Project);
    } catch (err: unknown) {
      initRef.current = false;
      setError(err instanceof Error ? err.message : 'Failed to initialize');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (unlocked) initSession();
  }, [unlocked, initSession]);

  // Gate 1: Password
  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  // Gate 2: Loading session
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-gray-400 text-sm">Setting up...</div>
        </div>
      </div>
    );
  }

  // Gate 3: Error
  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
          <p className="text-gray-600 text-sm mb-4">{error || 'Could not load project'}</p>
          <button
            onClick={() => { initRef.current = false; initSession(); }}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const siteUrl = getSiteUrl(project);
  const projectId = project.id;
  const isVideoActive = VIDEO_ADS_VIEWS.has(currentView);
  const isStaticActive = STATIC_ADS_VIEWS.has(currentView);

  return (
    <PlanProvider isAuthenticated={true}>
    <CreditsProvider isAuthenticated={true} projectId={projectId}>
    <BackgroundTaskProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        {/* Sidebar */}
        <div className="w-[220px] shrink-0 bg-white/80 backdrop-blur-xl border-r border-gray-200 flex flex-col">
          <div className="h-14 flex items-center px-4 border-b border-gray-200">
            <span className="text-[15px] font-semibold text-gray-900">Ad Studio</span>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
            <NavGroup
              label="Video Ads"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              }
              parentView="video-ideas"
              subItems={videoSubItems}
              isGroupActive={isVideoActive}
              expanded={videoExpanded}
              onToggleExpand={() => setVideoExpanded(!videoExpanded)}
              currentView={currentView}
              onNavigate={setCurrentView}
            />

            <NavGroup
              label="Static Ads"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
              }
              parentView="static-meta"
              subItems={staticSubItems}
              isGroupActive={isStaticActive}
              expanded={staticExpanded}
              onToggleExpand={() => setStaticExpanded(!staticExpanded)}
              currentView={currentView}
              onNavigate={setCurrentView}
            />

            <button
              onClick={() => setCurrentView('api-test')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-left transition-all duration-150 ${
                currentView === 'api-test'
                  ? 'bg-blue-500/10 text-blue-600'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
              }`}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
              <span>API Test</span>
            </button>
          </nav>

          <div className="border-t border-gray-200 px-4 py-3">
            <div className="text-xs text-gray-400 truncate">{project.name}</div>
            <div className="text-[10px] text-gray-300 truncate">{siteUrl}</div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <main className="flex-1 overflow-y-auto p-6 lg:p-8">
            {currentView === 'video-ideas' && (
              <VideoIdeasView
                siteUrl={siteUrl}
                projectId={projectId}
                onAdTize={(idea) => {
                  setAdTizeIdea(idea as unknown as Record<string, unknown>);
                  setCurrentView('video-create');
                }}
              />
            )}
            {currentView === 'video-create' && (
              <VideoCreateView
                siteUrl={siteUrl}
                projectId={projectId}
                initialIdea={adTizeIdea as any}
                onClearIdea={() => setAdTizeIdea(null)}
              />
            )}

            {STATIC_PLATFORM_MAP[currentView] && (
              <AdCreatorView
                key={currentView}
                siteUrl={siteUrl}
                projectId={projectId}
                platform={STATIC_PLATFORM_MAP[currentView]}
              />
            )}

            {currentView === 'api-test' && (
              <TestView projectId={projectId} />
            )}
          </main>
        </div>

        <BackgroundTaskIndicator />
      </div>
    </BackgroundTaskProvider>
    </CreditsProvider>
    </PlanProvider>
  );
}
