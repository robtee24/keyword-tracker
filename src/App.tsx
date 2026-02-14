import { useState, useEffect } from 'react';
import DatePeriodSelector from './components/DatePeriodSelector';
import GoogleSearchConsole from './components/SEO/GoogleSearchConsole';
import PropertySelector from './components/PropertySelector';
import OAuthModal from './components/OAuthModal';
import { isAuthenticated, clearTokens } from './services/authService';
import type { DateRange } from './types';

type AppState = 'loading' | 'unauthenticated' | 'authenticated';

function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [selectedSite, setSelectedSite] = useState<string | null>(null);

  // Live editing state
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
    endDate: new Date(),
  });
  const [compareDateRange, setCompareDateRange] = useState<DateRange | null>(null);

  // Committed state (only updates on Load Data)
  const [committedDateRange, setCommittedDateRange] = useState<DateRange | null>(null);
  const [committedCompareDateRange, setCommittedCompareDateRange] = useState<DateRange | null>(null);

  const [loadTrigger, setLoadTrigger] = useState(0);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    // Check auth on mount
    if (isAuthenticated()) {
      setAppState('authenticated');
      // Restore selected site
      const stored = localStorage.getItem('gsc_selected_site');
      if (stored) setSelectedSite(stored);
    } else {
      setAppState('unauthenticated');
    }
  }, []);

  const handleLoadData = () => {
    setCommittedDateRange({ ...dateRange });
    setCommittedCompareDateRange(compareDateRange ? { ...compareDateRange } : null);
    setLoadTrigger((prev) => prev + 1);
    setHasLoadedOnce(true);
  };

  const handleSignOut = () => {
    clearTokens();
    setAppState('unauthenticated');
    setSelectedSite(null);
    setHasLoadedOnce(false);
    setLoadTrigger(0);
  };

  const handleAuthenticated = () => {
    setAppState('authenticated');
  };

  const handleSiteChange = (siteUrl: string) => {
    setSelectedSite(siteUrl);
    // Reset data when site changes
    setHasLoadedOnce(false);
    setLoadTrigger(0);
  };

  // Loading state
  if (appState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Sign-in screen
  if (appState === 'unauthenticated') {
    return <OAuthModal onAuthenticated={handleAuthenticated} />;
  }

  // Authenticated -- main app
  return (
    <div className="min-h-screen bg-apple-bg">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-apple-large-title font-bold text-apple-text tracking-tight">
              Keyword Tracker
            </h1>
            <p className="text-apple-base text-apple-text-secondary mt-1">
              Google Search Console keyword rankings and performance
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-apple-sm text-apple-text-secondary hover:text-apple-text transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Property Selector */}
        <PropertySelector selectedSite={selectedSite} onSiteChange={handleSiteChange} />

        {/* Main content -- only show when a site is selected */}
        {selectedSite ? (
          <>
            <DatePeriodSelector
              dateRange={dateRange}
              compareDateRange={compareDateRange}
              onDateRangeChange={setDateRange}
              onCompareDateRangeChange={setCompareDateRange}
              onLoadData={handleLoadData}
              hasLoadedOnce={hasLoadedOnce}
            />

            {!hasLoadedOnce || !committedDateRange ? (
              <div className="card p-16 text-center">
                <div className="text-5xl mb-5 opacity-30">📊</div>
                <h3 className="text-apple-title3 font-semibold text-apple-text mb-2">
                  Ready to Load Data
                </h3>
                <p className="text-apple-base text-apple-text-secondary max-w-md mx-auto">
                  Select your date range above, then click "Load Data" to fetch keyword rankings.
                </p>
              </div>
            ) : (
              <GoogleSearchConsole
                dateRange={committedDateRange}
                compareDateRange={committedCompareDateRange}
                siteUrl={selectedSite}
                loadTrigger={loadTrigger}
              />
            )}
          </>
        ) : (
          <div className="card p-16 text-center">
            <div className="text-5xl mb-5 opacity-30">🌐</div>
            <h3 className="text-apple-title3 font-semibold text-apple-text mb-2">
              Select a Property
            </h3>
            <p className="text-apple-base text-apple-text-secondary max-w-md mx-auto">
              Choose a Search Console property from the dropdown above to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
