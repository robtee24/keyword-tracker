import { useState } from 'react';
import type { ReactNode } from 'react';
import { usePlan } from '../contexts/PlanContext';
import { PlanBadge } from './UpgradePrompt';
import { InfoTooltip } from './Tooltip';

export type View =
  | 'projects' | 'objectives' | 'connections'
  | 'overview' | 'keywords' | 'lost-keywords'
  | 'audit' | 'seo-audit' | 'content-audit' | 'aeo-audit' | 'schema-audit' | 'compliance-audit' | 'speed-audit'
  | 'blog-audit'
  | 'ad-audit' | 'ad-audit-google' | 'ad-audit-meta' | 'ad-audit-linkedin' | 'ad-audit-reddit' | 'ad-audit-tiktok'
  | 'ad-audit-budget' | 'ad-audit-performance' | 'ad-audit-creative' | 'ad-audit-attribution' | 'ad-audit-structure'
  | 'blog-opportunity' | 'blog-automate' | 'advertising'
  | 'build-rebuild' | 'build-new'
  | 'tasks' | 'activity'
  | 'settings';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSignOut: () => void;
  hasActiveProject: boolean;
}

const SEARCH_VIEWS = new Set<View>(['overview', 'keywords', 'lost-keywords']);
const SITE_AUDIT_VIEWS = new Set<View>(['audit', 'seo-audit', 'content-audit', 'aeo-audit', 'schema-audit', 'compliance-audit', 'speed-audit']);
const AD_AUDIT_VIEWS = new Set<View>(['ad-audit', 'ad-audit-google', 'ad-audit-meta', 'ad-audit-linkedin', 'ad-audit-reddit', 'ad-audit-tiktok', 'ad-audit-budget', 'ad-audit-performance', 'ad-audit-creative', 'ad-audit-attribution', 'ad-audit-structure']);
const CONTENT_VIEWS = new Set<View>(['blog-opportunity', 'blog-automate', 'advertising']);
const PAGES_VIEWS = new Set<View>(['build-rebuild', 'build-new']);

const searchSubItems: Array<{ id: View; label: string }> = [
  { id: 'overview', label: 'Dashboard' },
  { id: 'keywords', label: 'Keyword Rankings' },
  { id: 'lost-keywords', label: 'Keyword Alerts' },
];

const siteAuditSubItems: Array<{ id: View; label: string }> = [
  { id: 'audit', label: 'Full Audit' },
  { id: 'seo-audit', label: 'Technical SEO' },
  { id: 'content-audit', label: 'Content & Copy' },
  { id: 'aeo-audit', label: 'AI Visibility' },
  { id: 'schema-audit', label: 'Schema Markup' },
  { id: 'compliance-audit', label: 'Compliance' },
  { id: 'speed-audit', label: 'Page Speed' },
];

const adAuditSubItems: Array<{ id: View; label: string }> = [
  { id: 'ad-audit', label: 'Full Audit' },
  { id: 'ad-audit-google', label: 'Google Ads' },
  { id: 'ad-audit-meta', label: 'Meta' },
  { id: 'ad-audit-linkedin', label: 'LinkedIn' },
  { id: 'ad-audit-reddit', label: 'Reddit' },
  { id: 'ad-audit-tiktok', label: 'TikTok' },
  { id: 'ad-audit-budget', label: 'Budget & Spend' },
  { id: 'ad-audit-performance', label: 'Performance' },
  { id: 'ad-audit-creative', label: 'Creative & Copy' },
  { id: 'ad-audit-attribution', label: 'Attribution' },
  { id: 'ad-audit-structure', label: 'Account Structure' },
];

const contentSubItems: Array<{ id: View; label: string }> = [
  { id: 'blog-opportunity', label: 'Blog Ideas' },
  { id: 'blog-automate', label: 'Blog Writer' },
  { id: 'advertising', label: 'Ad Keywords' },
];

const pagesSubItems: Array<{ id: View; label: string }> = [
  { id: 'build-rebuild', label: 'Optimize Page' },
  { id: 'build-new', label: 'Create Page' },
];

function LockIcon() {
  return (
    <svg className="w-3 h-3 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

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
  locked,
  lockedSubItems,
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
  locked?: boolean;
  lockedSubItems?: Set<View>;
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
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-apple-sm text-apple-sm font-medium text-left transition-all duration-150 ${
          isGroupActive
            ? 'bg-apple-blue/10 text-apple-blue'
            : 'text-apple-text-secondary hover:bg-apple-fill-secondary hover:text-apple-text'
        }`}
        title={collapsed ? (title || label) : undefined}
      >
        <span className={`shrink-0 ${isGroupActive ? 'text-apple-blue' : ''}`}>{icon}</span>
        {!collapsed && (
          <>
            <span className="truncate flex-1 text-left">{label}</span>
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
            const isSubLocked = lockedSubItems?.has(sub.id);
            return (
              <button
                key={sub.id}
                onClick={() => onNavigate(sub.id)}
                className={`w-full flex items-center gap-1 text-left px-3 py-1.5 rounded-apple-sm text-apple-xs font-medium transition-all duration-150 ${
                  isSubActive
                    ? 'bg-apple-blue/10 text-apple-blue'
                    : isSubLocked
                      ? 'text-apple-text-tertiary hover:bg-apple-fill-secondary'
                      : 'text-apple-text-secondary hover:bg-apple-fill-secondary hover:text-apple-text'
                }`}
              >
                <span className="flex-1">{sub.label}</span>
                {isSubLocked && <LockIcon />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="border-t border-apple-divider my-2 mx-2" />;
  return (
    <div className="pt-4 pb-1 px-3">
      <div className="text-[10px] font-semibold text-apple-text-tertiary uppercase tracking-widest">
        {label}
      </div>
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
  const { canUseFeature, planInfo, planId } = usePlan();

  const isSearchActive = SEARCH_VIEWS.has(currentView);
  const isSiteAuditActive = SITE_AUDIT_VIEWS.has(currentView);
  const isAdAuditActive = AD_AUDIT_VIEWS.has(currentView);
  const isContentActive = CONTENT_VIEWS.has(currentView);
  const isPagesActive = PAGES_VIEWS.has(currentView);

  const [searchExpanded, setSearchExpanded] = useState(isSearchActive);
  const [siteAuditExpanded, setSiteAuditExpanded] = useState(isSiteAuditActive);
  const [adAuditExpanded, setAdAuditExpanded] = useState(isAdAuditActive);
  const [contentExpanded, setContentExpanded] = useState(isContentActive);
  const [pagesExpanded, setPagesExpanded] = useState(isPagesActive);

  const allowedAuditTypes = planInfo?.features?.audit_types || ['seo', 'content'];
  const lockedAuditSubItems = new Set<View>();
  const auditTypeMap: Record<string, View> = {
    seo: 'seo-audit', content: 'content-audit', aeo: 'aeo-audit',
    schema: 'schema-audit', compliance: 'compliance-audit', speed: 'speed-audit',
  };
  if (!canUseFeature('full_site_audit')) lockedAuditSubItems.add('audit');
  for (const [type, view] of Object.entries(auditTypeMap)) {
    if (!allowedAuditTypes.includes(type)) lockedAuditSubItems.add(view);
  }

  const isAdvertisingLocked = !canUseFeature('advertising');
  const lockedContentSubItems = new Set<View>();
  if (isAdvertisingLocked) lockedContentSubItems.add('advertising');

  const pageBuildLimit = planInfo?.limits?.page_builds ?? 0;
  const isPagesLocked = pageBuildLimit === 0;

  const renderNavButton = (item: { id: View; label: string; icon: ReactNode }) => {
    const isActive = currentView === item.id;
    return (
      <button
        key={item.id}
        onClick={() => onNavigate(item.id)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-apple-sm text-apple-sm font-medium text-left transition-all duration-150 ${
          isActive
            ? 'bg-apple-blue/10 text-apple-blue'
            : 'text-apple-text-secondary hover:bg-apple-fill-secondary hover:text-apple-text'
        }`}
        title={collapsed ? item.label : undefined}
      >
        <span className={`shrink-0 ${isActive ? 'text-apple-blue' : ''}`}>
          {item.icon}
        </span>
        {!collapsed && <span className="truncate text-left">{item.label}</span>}
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
            <img src="/seauto-logo.svg" alt="SEAUTO" className="h-8 object-contain" />
          </button>
        ) : (
          <img src="/seauto-logo.svg" alt="SEAUTO" className="h-10 object-contain" />
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
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-apple-sm text-apple-sm font-medium text-left transition-all duration-150 ${
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
          {!collapsed && <span className="truncate text-left">Projects</span>}
        </button>

        {hasActiveProject && (
          <>
            {/* ── CONFIGURE ── */}
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

            {renderNavButton({
              id: 'connections',
              label: 'Connections',
              icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              ),
            })}

            {/* ── MONITOR ── */}
            <SectionHeader label="Monitor" collapsed={collapsed} />

            <NavGroup
              label="Search Performance"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V9m4 8V5m4 12v-4" />
                </svg>
              }
              parentView="overview"
              subItems={searchSubItems}
              isGroupActive={isSearchActive}
              expanded={searchExpanded}
              onToggleExpand={() => setSearchExpanded(!searchExpanded)}
              currentView={currentView}
              onNavigate={onNavigate}
              collapsed={collapsed}
            />

            {/* ── ANALYZE ── */}
            <SectionHeader label="Analyze" collapsed={collapsed} />

            <NavGroup
              label="Site Audit"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              }
              parentView="audit"
              subItems={siteAuditSubItems}
              isGroupActive={isSiteAuditActive}
              expanded={siteAuditExpanded}
              onToggleExpand={() => setSiteAuditExpanded(!siteAuditExpanded)}
              currentView={currentView}
              onNavigate={onNavigate}
              collapsed={collapsed}
              lockedSubItems={lockedAuditSubItems}
            />

            {renderNavButton({
              id: 'blog-audit',
              label: 'Blog Audit',
              icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              ),
            })}

            <NavGroup
              label="Ad Audit"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              }
              parentView="ad-audit"
              subItems={adAuditSubItems}
              isGroupActive={isAdAuditActive}
              expanded={adAuditExpanded}
              onToggleExpand={() => setAdAuditExpanded(!adAuditExpanded)}
              currentView={currentView}
              onNavigate={onNavigate}
              collapsed={collapsed}
            />

            {/* ── CREATE ── */}
            <SectionHeader label="Create" collapsed={collapsed} />

            <NavGroup
              label="Content"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              }
              parentView="blog-opportunity"
              subItems={contentSubItems}
              isGroupActive={isContentActive}
              expanded={contentExpanded}
              onToggleExpand={() => setContentExpanded(!contentExpanded)}
              currentView={currentView}
              onNavigate={onNavigate}
              collapsed={collapsed}
              lockedSubItems={lockedContentSubItems}
            />

            <NavGroup
              label="Pages"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              }
              parentView="build-rebuild"
              subItems={pagesSubItems}
              isGroupActive={isPagesActive}
              expanded={pagesExpanded}
              onToggleExpand={() => setPagesExpanded(!pagesExpanded)}
              currentView={currentView}
              onNavigate={onNavigate}
              collapsed={collapsed}
              locked={isPagesLocked}
              lockedSubItems={isPagesLocked ? new Set<View>(['build-rebuild', 'build-new']) : undefined}
            />

            {/* ── TRACK ── */}
            <SectionHeader label="Track" collapsed={collapsed} />

            {renderNavButton({
              id: 'tasks',
              label: 'Tasks',
              icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
            })}

            {renderNavButton({
              id: 'activity',
              label: 'Activity Log',
              icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
            })}

            <SectionHeader label="Manage" collapsed={collapsed} />

            {renderNavButton({
              id: 'settings',
              label: 'Settings',
              icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ),
            })}
          </>
        )}
      </nav>

      <div className="px-2 pb-4 shrink-0 space-y-2">
        {!collapsed && (
          <div className="px-3 py-2">
            <PlanBadge />
          </div>
        )}
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
