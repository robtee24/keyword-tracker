export type View = 'projects' | 'project-detail';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSignOut: () => void;
}

export default function Sidebar({
  currentView,
  onNavigate,
  collapsed,
  onToggleCollapse,
  onSignOut,
}: SidebarProps) {
  const navItems = [
    {
      id: 'projects' as View,
      label: 'Projects',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
    },
  ];

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
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = currentView === item.id || (item.id === 'projects' && currentView === 'project-detail');
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
      </nav>

      {/* Sign out */}
      <div className="px-2 pb-4">
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
