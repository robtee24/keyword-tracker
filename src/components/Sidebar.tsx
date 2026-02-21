import type { ReactNode } from 'react';

export type View = 'projects' | 'objectives' | 'overview' | 'keywords' | 'lost-keywords' | 'seo-audit' | 'content-audit' | 'aeo-audit' | 'schema-audit' | 'recommendations' | 'activity-log';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSignOut: () => void;
  hasActiveProject: boolean;
}

const projectNavItems: Array<{ id: View; label: string; icon: ReactNode }> = [
  {
    id: 'objectives',
    label: 'Objectives',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    id: 'overview',
    label: 'Overview',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
  },
  {
    id: 'keywords',
    label: 'Keywords',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
      </svg>
    ),
  },
  {
    id: 'lost-keywords',
    label: 'Lost Keywords',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  {
    id: 'seo-audit',
    label: 'SEO',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    id: 'content-audit',
    label: 'Content Audit',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    id: 'aeo-audit',
    label: 'AEO',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
  },
  {
    id: 'schema-audit',
    label: 'Schema',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
  },
  {
    id: 'recommendations',
    label: 'Recommendations',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    id: 'activity-log',
    label: 'Activity Log',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function Sidebar({
  currentView,
  onNavigate,
  collapsed,
  onToggleCollapse,
  onSignOut,
  hasActiveProject,
}: SidebarProps) {
  return (
    <div
      className={`flex flex-col h-screen bg-white/80 backdrop-blur-xl border-r border-apple-divider transition-all duration-300 ${
        collapsed ? 'w-[60px]' : 'w-[220px]'
      }`}
    >
      {/* Logo / Collapse toggle */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-apple-divider shrink-0">
        {!collapsed && (
          <span className="text-apple-sm font-semibold text-apple-text tracking-tight truncate">
            Keyword Tracker
          </span>
        )}
        <button
          onClick={onToggleCollapse}
          className={`p-1.5 rounded-apple-sm hover:bg-apple-fill-secondary transition-colors text-apple-text-tertiary hover:text-apple-text ${
            collapsed ? 'mx-auto' : 'ml-auto'
          }`}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {collapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
            )}
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {/* Projects — always visible */}
        <button
          onClick={() => onNavigate('projects')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-apple-sm text-apple-sm font-medium transition-all duration-150 ${
            currentView === 'projects'
              ? 'bg-apple-blue/10 text-apple-blue'
              : 'text-apple-text-secondary hover:bg-apple-fill-secondary hover:text-apple-text'
          }`}
          title={collapsed ? 'Projects' : undefined}
        >
          <span className={`shrink-0 ${currentView === 'projects' ? 'text-apple-blue' : ''}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </span>
          {!collapsed && <span className="truncate">Projects</span>}
        </button>

        {/* Project-specific nav items — only when a project is active */}
        {hasActiveProject && (
          <>
            {!collapsed && (
              <div className="pt-3 pb-1 px-3">
                <div className="text-[10px] font-semibold text-apple-text-tertiary uppercase tracking-widest">
                  Project
                </div>
              </div>
            )}
            {collapsed && <div className="border-t border-apple-divider my-2 mx-2" />}

            {projectNavItems.map((item) => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-apple-sm text-apple-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-apple-blue/10 text-apple-blue'
                      : 'text-apple-text-secondary hover:bg-apple-fill-secondary hover:text-apple-text'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className={`shrink-0 ${isActive ? 'text-apple-blue' : ''}`}>
                    {item.icon}
                  </span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </>
        )}
      </nav>

      {/* Sign out */}
      <div className="px-2 pb-4 shrink-0">
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-apple-sm text-apple-sm text-apple-text-tertiary hover:text-apple-red hover:bg-red-50/50 transition-all duration-150"
          title={collapsed ? 'Sign Out' : undefined}
        >
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );
}
