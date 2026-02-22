import { useState } from 'react';
import type { ReactNode } from 'react';

export type View =
  | 'projects' | 'objectives'
  | 'overview' | 'keywords' | 'lost-keywords' | 'organic-tasklist' | 'organic-activity'
  | 'audit' | 'seo-audit' | 'content-audit' | 'aeo-audit' | 'schema-audit' | 'compliance-audit' | 'speed-audit' | 'seo-tasklist' | 'seo-activity'
  | 'ad-audit' | 'ad-audit-google' | 'ad-audit-meta' | 'ad-audit-linkedin' | 'ad-audit-reddit'
  | 'ad-audit-budget' | 'ad-audit-performance' | 'ad-audit-creative' | 'ad-audit-attribution' | 'ad-audit-structure'
  | 'ad-tasklist' | 'ad-activity'
  | 'advertising';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSignOut: () => void;
  hasActiveProject: boolean;
}

const ORGANIC_VIEWS = new Set<View>(['overview', 'keywords', 'lost-keywords', 'organic-tasklist', 'organic-activity']);
const SEO_AUDIT_VIEWS = new Set<View>(['audit', 'seo-audit', 'content-audit', 'aeo-audit', 'schema-audit', 'compliance-audit', 'speed-audit', 'seo-tasklist', 'seo-activity']);
const AD_AUDIT_VIEWS = new Set<View>(['ad-audit', 'ad-audit-google', 'ad-audit-meta', 'ad-audit-linkedin', 'ad-audit-reddit', 'ad-audit-budget', 'ad-audit-performance', 'ad-audit-creative', 'ad-audit-attribution', 'ad-audit-structure', 'ad-tasklist', 'ad-activity', 'advertising']);

const organicSubItems: Array<{ id: View; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'keywords', label: 'Keywords' },
  { id: 'lost-keywords', label: 'Lost Keywords' },
  { id: 'organic-tasklist', label: 'Tasklist' },
  { id: 'organic-activity', label: 'Activity Log' },
];

const seoAuditSubItems: Array<{ id: View; label: string }> = [
  { id: 'audit', label: 'Full Audit' },
  { id: 'seo-audit', label: 'SEO' },
  { id: 'content-audit', label: 'Content' },
  { id: 'aeo-audit', label: 'AEO' },
  { id: 'schema-audit', label: 'Schema' },
  { id: 'compliance-audit', label: 'Compliance' },
  { id: 'speed-audit', label: 'Page Speed' },
  { id: 'seo-tasklist', label: 'Tasklist' },
  { id: 'seo-activity', label: 'Activity Log' },
];

const adAuditSubItems: Array<{ id: View; label: string }> = [
  { id: 'ad-audit', label: 'Full Audit' },
  { id: 'advertising', label: 'Google Keywords' },
  { id: 'ad-audit-google', label: 'Google Ads' },
  { id: 'ad-audit-meta', label: 'Meta Ads' },
  { id: 'ad-audit-linkedin', label: 'LinkedIn Ads' },
  { id: 'ad-audit-reddit', label: 'Reddit Ads' },
  { id: 'ad-audit-budget', label: 'Budget & Spend' },
  { id: 'ad-audit-performance', label: 'Performance' },
  { id: 'ad-audit-creative', label: 'Creative & Copy' },
  { id: 'ad-audit-attribution', label: 'Attribution' },
  { id: 'ad-audit-structure', label: 'Account Structure' },
  { id: 'ad-tasklist', label: 'Tasklist' },
  { id: 'ad-activity', label: 'Activity Log' },
];

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
  collapsed,
  title,
}: {
  label: string;
  icon: ReactNode;
  parentView: View;
  subItems: Array<{ id: View; label: string }>;
  isGroupActive: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  currentView: View;
  onNavigate: (v: View) => void;
  collapsed: boolean;
  title?: string;
}) {
  const handleClick = () => {
    if (collapsed) {
      onNavigate(parentView);
      return;
    }
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
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-apple-sm text-apple-sm font-medium transition-all duration-150 ${
          isGroupActive
            ? 'bg-apple-blue/10 text-apple-blue'
            : 'text-apple-text-secondary hover:bg-apple-fill-secondary hover:text-apple-text'
        }`}
        title={collapsed ? (title || label) : undefined}
      >
        <span className={`shrink-0 ${isGroupActive ? 'text-apple-blue' : ''}`}>{icon}</span>
        {!collapsed && (
          <>
            <span className="truncate flex-1">{label}</span>
            <svg
              className={`w-3.5 h-3.5 text-apple-text-tertiary transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {!collapsed && expanded && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-apple-divider pl-2">
          {subItems.map((sub) => {
            const isSubActive = currentView === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => onNavigate(sub.id)}
                className={`w-full text-left px-3 py-1.5 rounded-apple-sm text-apple-xs font-medium transition-all duration-150 ${
                  isSubActive
                    ? 'bg-apple-blue/10 text-apple-blue'
                    : 'text-apple-text-secondary hover:bg-apple-fill-secondary hover:text-apple-text'
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

export default function Sidebar({
  currentView,
  onNavigate,
  collapsed,
  onToggleCollapse,
  onSignOut,
  hasActiveProject,
}: SidebarProps) {
  const isOrganicActive = ORGANIC_VIEWS.has(currentView);
  const isSeoAuditActive = SEO_AUDIT_VIEWS.has(currentView);
  const isAdAuditActive = AD_AUDIT_VIEWS.has(currentView);

  const [organicExpanded, setOrganicExpanded] = useState(isOrganicActive);
  const [seoExpanded, setSeoExpanded] = useState(isSeoAuditActive);
  const [adExpanded, setAdExpanded] = useState(isAdAuditActive);

  const renderNavButton = (item: { id: View; label: string; icon: ReactNode }) => {
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
  };

  return (
    <div
      className={`flex flex-col h-screen bg-white/80 backdrop-blur-xl border-r border-apple-divider transition-all duration-300 ${
        collapsed ? 'w-[60px]' : 'w-[220px]'
      }`}
    >
      <div className="flex items-center gap-2 px-3 h-14 border-b border-apple-divider shrink-0">
        {collapsed ? (
          <button onClick={onToggleCollapse} className="mx-auto p-1 rounded-apple-sm hover:bg-apple-fill-secondary transition-colors" title="Expand">
            <img src="/seauto-logo.svg" alt="SEAUTO" className="h-6 object-contain" />
          </button>
        ) : (
          <img src="/seauto-logo.svg" alt="SEAUTO" className="h-8 object-contain" />
        )}
        <button
          onClick={onToggleCollapse}
          className={`p-1.5 rounded-apple-sm hover:bg-apple-fill-secondary transition-colors text-apple-text-tertiary hover:text-apple-text ${
            collapsed ? 'hidden' : 'ml-auto'
          }`}
          title="Collapse"
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

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
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

            {renderNavButton({
              id: 'objectives',
              label: 'Objectives',
              icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              ),
            })}

            <NavGroup
              label="Organic"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              }
              parentView="overview"
              subItems={organicSubItems}
              isGroupActive={isOrganicActive}
              expanded={organicExpanded}
              onToggleExpand={() => setOrganicExpanded(!organicExpanded)}
              currentView={currentView}
              onNavigate={onNavigate}
              collapsed={collapsed}
            />

            <NavGroup
              label="SEO"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              }
              parentView="audit"
              subItems={seoAuditSubItems}
              isGroupActive={isSeoAuditActive}
              expanded={seoExpanded}
              onToggleExpand={() => setSeoExpanded(!seoExpanded)}
              currentView={currentView}
              onNavigate={onNavigate}
              collapsed={collapsed}
            />

            <NavGroup
              label="Advertising"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              }
              parentView="ad-audit"
              subItems={adAuditSubItems}
              isGroupActive={isAdAuditActive}
              expanded={adExpanded}
              onToggleExpand={() => setAdExpanded(!adExpanded)}
              currentView={currentView}
              onNavigate={onNavigate}
              collapsed={collapsed}
            />
          </>
        )}
      </nav>

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
