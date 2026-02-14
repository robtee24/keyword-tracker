import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import type { DateRange } from '../../types';
import { fetchGoogleSearchConsole } from '../../services/googleSearchConsoleService';
import { authenticatedFetch } from '../../services/authService';
import { API_ENDPOINTS } from '../../config/api';
import SectionHeader from '../SectionHeader';
import LineChart from '../LineChart';
import RecommendationsPanel from './RecommendationsPanel';
import type { ScanResult } from './RecommendationsPanel';
import KeywordInsightsPanel from './KeywordInsightsPanel';
import type { MonthlyPosition } from './KeywordInsightsPanel';

interface GoogleSearchConsoleProps {
  dateRange: DateRange;
  compareDateRange: DateRange | null;
  siteUrl: string;
  loadTrigger: number;
}

export default function GoogleSearchConsole({
  dateRange,
  compareDateRange,
  siteUrl,
  loadTrigger,
}: GoogleSearchConsoleProps) {
  const [data, setData] = useState<{
    current: any;
    compare: any | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [appliedFilter, setAppliedFilter] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showImpressionsChart, setShowImpressionsChart] = useState(false);
  const [showClicksChart, setShowClicksChart] = useState(false);
  const [showRankedKeywordsChart, setShowRankedKeywordsChart] = useState(false);
  const [expandedKeyword, setExpandedKeyword] = useState<string | null>(null);
  const [keywordPages, setKeywordPages] = useState<
    Map<string, Array<{ page: string; clicks: number; impressions: number; ctr: number }>>
  >(new Map());
  const [loadingPages, setLoadingPages] = useState<Set<string>>(new Set());
  const [scanResults, setScanResults] = useState<Map<string, ScanResult>>(new Map());
  const [loadingRecs, setLoadingRecs] = useState<Set<string>>(new Set());
  const [recsError, setRecsError] = useState<Map<string, string>>(new Map());
  const [keywordHistory, setKeywordHistory] = useState<Map<string, MonthlyPosition[]>>(new Map());
  const [loadingHistory, setLoadingHistory] = useState<Set<string>>(new Set());
  const [searchVolumes, setSearchVolumes] = useState<Map<string, {
    avgMonthlySearches: number | null;
    competition: string | null;
    competitionIndex: number | null;
  }>>(new Map());
  const [intentFilter, setIntentFilter] = useState<KeywordIntent | ''>('');

  const itemsPerPage = 20;

  useEffect(() => {
    if (loadTrigger === 0) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const result = await fetchGoogleSearchConsole(dateRange, compareDateRange, siteUrl);
        setData(result);
      } catch (error) {
        console.error('Error fetching Google Search Console data:', error);
        setData({
          current: {
            impressions: null,
            clicks: null,
            keywords: [],
            impressionsHistory: [],
            clicksHistory: [],
          },
          compare: null,
        });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [loadTrigger, dateRange, compareDateRange, siteUrl]);

  // Fetch search volumes after keyword data loads
  useEffect(() => {
    if (!data?.current?.keywords?.length) return;

    const keywords = data.current.keywords.map((kw: any) => kw.keyword);
    if (keywords.length === 0) return;

    const fetchVolumes = async () => {
      try {
        const response = await authenticatedFetch(API_ENDPOINTS.google.ads.searchVolume, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywords }),
        });
        if (response.ok) {
          const result = await response.json();
          if (result.volumes && Object.keys(result.volumes).length > 0) {
            const volumeMap = new Map<string, any>();
            for (const [kw, vol] of Object.entries(result.volumes)) {
              volumeMap.set(kw, vol as any);
            }
            setSearchVolumes(volumeMap);
          }
        }
      } catch {
        // Silently fail — search volume is optional
      }
    };
    fetchVolumes();
  }, [data]);

  if (loading) {
    return (
      <div className="card p-8">
        <SectionHeader
          title="Google Search Console"
          logoUrl="https://cdn.simpleicons.org/googlesearchconsole/4285F4"
        />
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-apple-blue border-t-transparent rounded-full animate-spin mr-3" />
          <span className="text-apple-text-secondary text-apple-base">Loading keyword data...</span>
        </div>
      </div>
    );
  }

  if (!data || !data.current?.keywords?.length) {
    return (
      <div className="card p-8">
        <SectionHeader
          title="Google Search Console"
          logoUrl="https://cdn.simpleicons.org/googlesearchconsole/4285F4"
        />
        <div className="text-center py-12 text-apple-text-tertiary text-apple-base">
          No keyword data available for this period.
        </div>
      </div>
    );
  }

  // Filter keywords
  let filteredKeywords = data.current.keywords.filter((keyword: any) =>
    keyword.keyword.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (appliedFilter.size > 0) {
    filteredKeywords = filteredKeywords.filter((keyword: any) =>
      appliedFilter.has(keyword.keyword)
    );
  }

  // Intent filter
  if (intentFilter) {
    filteredKeywords = filteredKeywords.filter(
      (keyword: any) => classifyKeywordIntent(keyword.keyword) === intentFilter
    );
  }

  // Compare keywords map
  const compareKeywordsMap = new Map();
  if (data.compare?.keywords && Array.isArray(data.compare.keywords)) {
    data.compare.keywords.forEach((kw: any) => {
      compareKeywordsMap.set(kw.keyword, kw);
    });
  }

  // Sort
  if (sortColumn) {
    filteredKeywords = [...filteredKeywords].sort((a: any, b: any) => {
      let aVal: any;
      let bVal: any;

      if (sortColumn === 'volume') {
        aVal = searchVolumes.get(a.keyword)?.avgMonthlySearches ?? -1;
        bVal = searchVolumes.get(b.keyword)?.avgMonthlySearches ?? -1;
      } else if (sortColumn === 'intent') {
        aVal = classifyKeywordIntent(a.keyword);
        bVal = classifyKeywordIntent(b.keyword);
      } else {
        aVal = a[sortColumn];
        bVal = b[sortColumn];
      }

      if (sortColumn === 'keyword' || sortColumn === 'intent') {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Paginate
  const paginatedKeywords = filteredKeywords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(filteredKeywords.length / itemsPerPage);

  const toggleKeyword = (keyword: string) => {
    const newSelected = new Set(selectedKeywords);
    if (newSelected.has(keyword)) newSelected.delete(keyword);
    else newSelected.add(keyword);
    setSelectedKeywords(newSelected);
  };

  const applyFilter = () => {
    setAppliedFilter(new Set(selectedKeywords));
    setCurrentPage(1);
  };

  const clearFilter = () => {
    setSearchTerm('');
    setSelectedKeywords(new Set());
    setAppliedFilter(new Set());
    setIntentFilter('');
    setCurrentPage(1);
    setSortColumn(null);
    setSortDirection('asc');
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const fetchKeywordHistory = async (keyword: string) => {
    if (keywordHistory.has(keyword)) return;

    setLoadingHistory((prev) => new Set(prev).add(keyword));
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.google.searchConsole.keywordHistory, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, siteUrl }),
      });

      if (response.ok) {
        const result = await response.json();
        setKeywordHistory((prev) => new Map(prev).set(keyword, result.monthly || []));
      } else {
        setKeywordHistory((prev) => new Map(prev).set(keyword, []));
      }
    } catch {
      setKeywordHistory((prev) => new Map(prev).set(keyword, []));
    } finally {
      setLoadingHistory((prev) => {
        const s = new Set(prev);
        s.delete(keyword);
        return s;
      });
    }
  };

  const handleKeywordRowClick = async (keyword: string) => {
    if (expandedKeyword === keyword) {
      setExpandedKeyword(null);
      return;
    }
    setExpandedKeyword(keyword);

    // Fetch pages and history in parallel
    if (!keywordPages.has(keyword)) {
      setLoadingPages((prev) => new Set(prev).add(keyword));
      try {
        const startDate = format(dateRange.startDate, 'yyyy-MM-dd');
        const endDate = format(dateRange.endDate, 'yyyy-MM-dd');

        const response = await authenticatedFetch(API_ENDPOINTS.google.searchConsole.keywordPages, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword, startDate, endDate, siteUrl }),
        });

        if (response.ok) {
          const result = await response.json();
          const pages = (result.rows || [])
            .map((row: any) => ({
              page: row.keys?.[1] || '',
              clicks: parseInt(row.clicks || '0', 10),
              impressions: parseInt(row.impressions || '0', 10),
              ctr: parseFloat(row.ctr || '0') * 100,
            }))
            .sort((a: any, b: any) => b.clicks - a.clicks);

          setKeywordPages((prev) => new Map(prev).set(keyword, pages));
        } else {
          setKeywordPages((prev) => new Map(prev).set(keyword, []));
        }
      } catch {
        setKeywordPages((prev) => new Map(prev).set(keyword, []));
      } finally {
        setLoadingPages((prev) => {
          const s = new Set(prev);
          s.delete(keyword);
          return s;
        });
      }
    }

    // Also fetch position history
    fetchKeywordHistory(keyword);
  };

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return (
        <span className="ml-1 text-apple-text-tertiary opacity-40">
          <svg className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </span>
      );
    }
    return (
      <span className="ml-1 text-apple-blue">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  const handleScanRecommendations = async (keyword: string) => {
    if (scanResults.has(keyword)) return; // Already scanned

    const pages = keywordPages.get(keyword) || [];
    if (pages.length === 0) return;

    setLoadingRecs((prev) => new Set(prev).add(keyword));
    setRecsError((prev) => { const m = new Map(prev); m.delete(keyword); return m; });

    try {
      const response = await authenticatedFetch(API_ENDPOINTS.google.searchConsole.recommendations, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword,
          pages: pages.map((p) => ({ url: p.page, clicks: p.clicks, impressions: p.impressions })),
          siteUrl,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const result: ScanResult = await response.json();
      setScanResults((prev) => new Map(prev).set(keyword, result));
    } catch (err: any) {
      console.error('Failed to get recommendations:', err);
      setRecsError((prev) => new Map(prev).set(keyword, err.message || 'Failed to generate recommendations'));
    } finally {
      setLoadingRecs((prev) => { const s = new Set(prev); s.delete(keyword); return s; });
    }
  };

  const getCompareColor = (metric: string, current: number | null, compare: number | null): string => {
    if (current === null || current === undefined || compare === null || compare === undefined) {
      return 'text-apple-text-tertiary';
    }
    if (metric === 'position') {
      return compare > current ? 'text-apple-green' : compare < current ? 'text-apple-red' : 'text-apple-text-tertiary';
    }
    return compare < current ? 'text-apple-green' : compare > current ? 'text-apple-red' : 'text-apple-text-tertiary';
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Google Search Console"
        logoUrl="https://cdn.simpleicons.org/googlesearchconsole/4285F4"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Impressions */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-apple-sm font-medium text-apple-text-secondary uppercase tracking-wide">
              Impressions
            </h3>
            <button
              onClick={() => setShowImpressionsChart(!showImpressionsChart)}
              className="text-apple-sm text-apple-blue hover:underline"
            >
              {showImpressionsChart ? 'Hide Chart' : 'Show Chart'}
            </button>
          </div>
          {showImpressionsChart ? (
            <LineChart data={data.current.impressionsHistory} compareData={data.compare?.impressionsHistory} title="" yAxisLabel="Impressions" />
          ) : (
            <div>
              <div className={`text-apple-hero font-bold tracking-tight ${data.current.impressions != null ? 'text-apple-text' : 'text-apple-text-tertiary'}`}>
                {data.current.impressions != null ? data.current.impressions.toLocaleString() : 'N/A'}
              </div>
              {data.compare?.impressions != null && (
                <div className="text-apple-xs text-apple-text-tertiary mt-1">
                  Compare: {data.compare.impressions.toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Clicks */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-apple-sm font-medium text-apple-text-secondary uppercase tracking-wide">
              Clicks
            </h3>
            <button
              onClick={() => setShowClicksChart(!showClicksChart)}
              className="text-apple-sm text-apple-blue hover:underline"
            >
              {showClicksChart ? 'Hide Chart' : 'Show Chart'}
            </button>
          </div>
          {showClicksChart ? (
            <LineChart data={data.current.clicksHistory} compareData={data.compare?.clicksHistory} title="" yAxisLabel="Clicks" />
          ) : (
            <div>
              <div className={`text-apple-hero font-bold tracking-tight ${data.current.clicks != null ? 'text-apple-text' : 'text-apple-text-tertiary'}`}>
                {data.current.clicks != null ? data.current.clicks.toLocaleString() : 'N/A'}
              </div>
              {data.compare?.clicks != null && (
                <div className="text-apple-xs text-apple-text-tertiary mt-1">
                  Compare: {data.compare.clicks.toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ranked Keywords */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-apple-sm font-medium text-apple-text-secondary uppercase tracking-wide">
              Ranked Keywords
            </h3>
            <button
              onClick={() => setShowRankedKeywordsChart(!showRankedKeywordsChart)}
              className="text-apple-sm text-apple-blue hover:underline"
            >
              {showRankedKeywordsChart ? 'Hide Chart' : 'Show Chart'}
            </button>
          </div>
          {showRankedKeywordsChart ? (
            <LineChart data={[]} compareData={null} title="" yAxisLabel="Keywords" />
          ) : (
            <div>
              <div className={`text-apple-hero font-bold tracking-tight ${data.current.keywords?.length > 0 ? 'text-apple-text' : 'text-apple-text-tertiary'}`}>
                {data.current.keywords?.length > 0 ? data.current.keywords.length.toLocaleString() : 'N/A'}
              </div>
              {data.compare?.keywords?.length > 0 && (
                <div className="text-apple-xs text-apple-text-tertiary mt-1">
                  Compare: {data.compare.keywords.length.toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Keyword Table */}
      <div className="card p-6">
        <div className="mb-6">
          <h3 className="text-apple-body font-semibold text-apple-text mb-4">
            Keyword Rankings
          </h3>
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              placeholder="Search keywords..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="input flex-1"
            />
            <select
              value={intentFilter}
              onChange={(e) => {
                setIntentFilter(e.target.value as KeywordIntent | '');
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-apple-sm rounded-apple-sm border border-apple-border bg-white text-apple-text-secondary focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all duration-200"
            >
              <option value="">All Intents</option>
              {ALL_INTENTS.map((intent) => (
                <option key={intent} value={intent}>{intent}</option>
              ))}
            </select>
            {selectedKeywords.size > 0 && appliedFilter.size === 0 && (
              <button onClick={applyFilter} className="btn-primary text-apple-sm">
                Apply Filter ({selectedKeywords.size})
              </button>
            )}
            {(appliedFilter.size > 0 || intentFilter) && (
              <button onClick={clearFilter} className="btn-danger text-apple-sm">
                Clear Filters
              </button>
            )}
            {searchTerm && appliedFilter.size === 0 && !intentFilter && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="btn-secondary text-apple-sm"
              >
                Clear Search
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto -mx-6">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-apple-divider">
                <th className="px-6 py-3 text-left" rowSpan={compareDateRange ? 2 : 1}>
                  <input
                    type="checkbox"
                    className="rounded border-apple-border"
                    checked={paginatedKeywords.length > 0 && paginatedKeywords.every((k: any) => selectedKeywords.has(k.keyword))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const s = new Set(selectedKeywords);
                        paginatedKeywords.forEach((k: any) => s.add(k.keyword));
                        setSelectedKeywords(s);
                      } else {
                        const s = new Set(selectedKeywords);
                        paginatedKeywords.forEach((k: any) => s.delete(k.keyword));
                        setSelectedKeywords(s);
                      }
                    }}
                  />
                </th>
                <th
                  className="px-6 py-3 text-left text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider cursor-pointer hover:text-apple-text transition-colors"
                  rowSpan={compareDateRange ? 2 : 1}
                  onClick={() => handleSort('keyword')}
                >
                  Keyword {getSortIcon('keyword')}
                </th>
                <th
                  className="px-6 py-3 text-left text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider cursor-pointer hover:text-apple-text transition-colors"
                  rowSpan={compareDateRange ? 2 : 1}
                  onClick={() => handleSort('intent')}
                >
                  Intent {getSortIcon('intent')}
                </th>
                <th
                  className="px-6 py-3 text-left text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider cursor-pointer hover:text-apple-text transition-colors"
                  rowSpan={compareDateRange ? 2 : 1}
                  onClick={() => handleSort('volume')}
                >
                  Volume {getSortIcon('volume')}
                </th>
                {compareDateRange ? (
                  <>
                    <th colSpan={2} className="px-6 py-3 text-center text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider cursor-pointer hover:text-apple-text transition-colors" onClick={() => handleSort('position')}>
                      Position {getSortIcon('position')}
                    </th>
                    <th colSpan={2} className="px-6 py-3 text-center text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider cursor-pointer hover:text-apple-text transition-colors" onClick={() => handleSort('impressions')}>
                      Impressions {getSortIcon('impressions')}
                    </th>
                    <th colSpan={2} className="px-6 py-3 text-center text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider cursor-pointer hover:text-apple-text transition-colors" onClick={() => handleSort('clicks')}>
                      Clicks {getSortIcon('clicks')}
                    </th>
                    <th colSpan={2} className="px-6 py-3 text-center text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider cursor-pointer hover:text-apple-text transition-colors" onClick={() => handleSort('ctr')}>
                      CTR {getSortIcon('ctr')}
                    </th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-3 text-left text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider cursor-pointer hover:text-apple-text transition-colors" onClick={() => handleSort('position')}>
                      Position {getSortIcon('position')}
                    </th>
                    <th className="px-6 py-3 text-left text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider cursor-pointer hover:text-apple-text transition-colors" onClick={() => handleSort('impressions')}>
                      Impressions {getSortIcon('impressions')}
                    </th>
                    <th className="px-6 py-3 text-left text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider cursor-pointer hover:text-apple-text transition-colors" onClick={() => handleSort('clicks')}>
                      Clicks {getSortIcon('clicks')}
                    </th>
                    <th className="px-6 py-3 text-left text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider cursor-pointer hover:text-apple-text transition-colors" onClick={() => handleSort('ctr')}>
                      CTR {getSortIcon('ctr')}
                    </th>
                  </>
                )}
              </tr>
              {compareDateRange && (
                <tr className="border-b border-apple-divider">
                  <th className="px-6 py-2 text-left text-apple-xs font-medium text-apple-text-secondary">Current</th>
                  <th className="px-6 py-2 text-left text-apple-xs font-medium text-apple-text-tertiary">Compare</th>
                  <th className="px-6 py-2 text-left text-apple-xs font-medium text-apple-text-secondary">Current</th>
                  <th className="px-6 py-2 text-left text-apple-xs font-medium text-apple-text-tertiary">Compare</th>
                  <th className="px-6 py-2 text-left text-apple-xs font-medium text-apple-text-secondary">Current</th>
                  <th className="px-6 py-2 text-left text-apple-xs font-medium text-apple-text-tertiary">Compare</th>
                  <th className="px-6 py-2 text-left text-apple-xs font-medium text-apple-text-secondary">Current</th>
                  <th className="px-6 py-2 text-left text-apple-xs font-medium text-apple-text-tertiary">Compare</th>
                </tr>
              )}
            </thead>
            <tbody>
              {paginatedKeywords.length > 0 ? (
                paginatedKeywords.map((keyword: any, index: number) => {
                  const compareKeyword = compareKeywordsMap.get(keyword.keyword);
                  const isExpanded = expandedKeyword === keyword.keyword;
                  const pages = keywordPages.get(keyword.keyword) || [];
                  const isLoadingPages = loadingPages.has(keyword.keyword);

                  return (
                    <KeywordRow
                      key={index}
                      keyword={keyword}
                      compareKeyword={compareKeyword}
                      compareDateRange={compareDateRange}
                      isExpanded={isExpanded}
                      pages={pages}
                      isLoadingPages={isLoadingPages}
                      isSelected={selectedKeywords.has(keyword.keyword)}
                      onToggleSelect={() => toggleKeyword(keyword.keyword)}
                      onRowClick={() => handleKeywordRowClick(keyword.keyword)}
                      getCompareColor={getCompareColor}
                      scanResult={scanResults.get(keyword.keyword) || null}
                      isLoadingRecs={loadingRecs.has(keyword.keyword)}
                      recsError={recsError.get(keyword.keyword) || null}
                      onScanRecommendations={() => handleScanRecommendations(keyword.keyword)}
                      history={keywordHistory.get(keyword.keyword) || null}
                      loadingHistory={loadingHistory.has(keyword.keyword)}
                      siteUrl={siteUrl}
                      volume={searchVolumes.get(keyword.keyword) || null}
                    />
                  );
                })
              ) : (
                <tr>
                  <td colSpan={compareDateRange ? 12 : 8} className="px-6 py-12 text-center text-apple-text-tertiary text-apple-base">
                    No keywords found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-apple-sm text-apple-text-secondary">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredKeywords.length)} of{' '}
              {filteredKeywords.length} keywords
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-apple-sm rounded-apple-sm border border-apple-border text-apple-text-secondary hover:bg-apple-fill-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-apple-sm rounded-apple-sm border border-apple-border text-apple-text-secondary hover:bg-apple-fill-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Selected keywords indicator */}
        {selectedKeywords.size > 0 && (
          <div className="mt-4 p-4 rounded-apple-sm bg-blue-50/50">
            <div className="text-apple-sm font-medium text-apple-text-secondary mb-2">
              Selected Keywords ({selectedKeywords.size}):
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from(selectedKeywords).map((kw) => (
                <span
                  key={kw}
                  className="px-3 py-1 bg-blue-100 text-apple-blue rounded-apple-pill text-apple-xs font-medium"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(vol >= 10_000 ? 0 : 1)}K`;
  return vol.toLocaleString();
}

/* ------------------------------------------------------------------ */
/*  Keyword Intent Classification                                      */
/* ------------------------------------------------------------------ */

export type KeywordIntent = 'Transactional' | 'Product' | 'Educational' | 'Navigational' | 'Local';

const INTENT_PATTERNS: { intent: KeywordIntent; patterns: RegExp[] }[] = [
  {
    intent: 'Transactional',
    patterns: [
      /\b(buy|purchase|order|deal|deals|discount|coupon|price|pricing|cheap|cost|hire|book|subscribe|shop|for sale|free trial|sign up|signup|get started|quote|estimate|affordable)\b/i,
    ],
  },
  {
    intent: 'Product',
    patterns: [
      /\b(best|top|review|reviews|compare|comparison|vs|versus|alternative|alternatives|recommended|pros and cons|specs|features|rating|ratings|benchmark)\b/i,
    ],
  },
  {
    intent: 'Local',
    patterns: [
      /\b(near me|nearby|in my area|local|directions|hours|open now|closest)\b/i,
      /\bin\s+[A-Z][a-z]+/,  // "in Miami", "in Chicago" etc.
    ],
  },
  {
    intent: 'Navigational',
    patterns: [
      /\b(login|log in|sign in|signin|website|official|app|download|contact|support|dashboard|portal|account)\b/i,
    ],
  },
  {
    intent: 'Educational',
    patterns: [
      /\b(how|what|why|when|where|who|which|guide|tutorial|tips|learn|example|examples|definition|meaning|explained|is|are|can you|does|do|should|ways to|steps|beginner|basics)\b/i,
    ],
  },
];

function classifyKeywordIntent(keyword: string): KeywordIntent {
  for (const { intent, patterns } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(keyword)) return intent;
    }
  }
  return 'Educational'; // Default — most long-tail keywords are informational
}

const INTENT_COLORS: Record<KeywordIntent, { bg: string; text: string }> = {
  Transactional: { bg: 'bg-green-50', text: 'text-green-700' },
  Product: { bg: 'bg-purple-50', text: 'text-purple-700' },
  Educational: { bg: 'bg-blue-50', text: 'text-blue-700' },
  Navigational: { bg: 'bg-orange-50', text: 'text-orange-700' },
  Local: { bg: 'bg-rose-50', text: 'text-rose-700' },
};

const ALL_INTENTS: KeywordIntent[] = ['Transactional', 'Product', 'Educational', 'Navigational', 'Local'];

/* ------------------------------------------------------------------ */
/*  KeywordRow sub-component (keeps main component cleaner)           */
/* ------------------------------------------------------------------ */

function KeywordRow({
  keyword,
  compareKeyword,
  compareDateRange,
  isExpanded,
  pages,
  isLoadingPages,
  isSelected,
  onToggleSelect,
  onRowClick,
  getCompareColor,
  scanResult,
  isLoadingRecs,
  recsError,
  onScanRecommendations,
  history,
  loadingHistory,
  siteUrl,
  volume,
}: {
  keyword: any;
  compareKeyword: any;
  compareDateRange: DateRange | null;
  isExpanded: boolean;
  pages: Array<{ page: string; clicks: number; impressions: number; ctr: number }>;
  isLoadingPages: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onRowClick: () => void;
  getCompareColor: (metric: string, current: number | null, compare: number | null) => string;
  scanResult: ScanResult | null;
  isLoadingRecs: boolean;
  recsError: string | null;
  onScanRecommendations: () => void;
  history: MonthlyPosition[] | null;
  loadingHistory: boolean;
  siteUrl: string;
  volume: { avgMonthlySearches: number | null; competition: string | null; competitionIndex: number | null } | null;
}) {
  return (
    <>
      <tr
        className={`border-b border-apple-divider cursor-pointer transition-colors duration-150 ${
          isSelected ? 'bg-blue-50/40' : isExpanded ? 'bg-apple-fill-secondary' : 'hover:bg-apple-fill-secondary'
        }`}
        onClick={(e) => {
          if ((e.target as HTMLElement).tagName === 'INPUT') return;
          onRowClick();
        }}
      >
        <td className="px-6 py-3.5" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="rounded border-apple-border"
          />
        </td>
        <td className="px-6 py-3.5 text-apple-sm font-medium text-apple-text">
          <div className="flex items-center gap-2">
            {keyword.keyword}
            <svg
              className={`w-3.5 h-3.5 text-apple-text-tertiary transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </td>
        <td className="px-6 py-3.5">
          {(() => {
            const intent = classifyKeywordIntent(keyword.keyword);
            const colors = INTENT_COLORS[intent];
            return (
              <span className={`inline-block px-2 py-0.5 rounded-apple-pill text-apple-xs font-medium ${colors.bg} ${colors.text}`}>
                {intent}
              </span>
            );
          })()}
        </td>
        <td className="px-6 py-3.5 text-apple-sm text-apple-text-secondary">
          {volume?.avgMonthlySearches != null ? (
            <span title={`Competition: ${volume.competition || '—'} (${volume.competitionIndex ?? '—'}/100)`}>
              {formatVolume(volume.avgMonthlySearches)}
            </span>
          ) : (
            <span className="text-apple-text-tertiary">—</span>
          )}
        </td>
        {compareDateRange ? (
          <>
            <td className="px-6 py-3.5 text-apple-sm text-apple-text-secondary">
              {keyword.position ?? 'N/A'}
            </td>
            <td className={`px-6 py-3.5 text-apple-sm ${getCompareColor('position', keyword.position, compareKeyword?.position)}`}>
              {compareKeyword?.position ?? 'N/A'}
            </td>
            <td className="px-6 py-3.5 text-apple-sm text-apple-text-secondary">
              {keyword.impressions != null ? keyword.impressions.toLocaleString() : 'N/A'}
            </td>
            <td className={`px-6 py-3.5 text-apple-sm ${getCompareColor('impressions', keyword.impressions, compareKeyword?.impressions)}`}>
              {compareKeyword?.impressions != null ? compareKeyword.impressions.toLocaleString() : 'N/A'}
            </td>
            <td className="px-6 py-3.5 text-apple-sm text-apple-text-secondary">
              {keyword.clicks != null ? keyword.clicks.toLocaleString() : 'N/A'}
            </td>
            <td className={`px-6 py-3.5 text-apple-sm ${getCompareColor('clicks', keyword.clicks, compareKeyword?.clicks)}`}>
              {compareKeyword?.clicks != null ? compareKeyword.clicks.toLocaleString() : 'N/A'}
            </td>
            <td className="px-6 py-3.5 text-apple-sm text-apple-text-secondary">
              {keyword.ctr != null ? keyword.ctr.toFixed(2) + '%' : 'N/A'}
            </td>
            <td className={`px-6 py-3.5 text-apple-sm ${getCompareColor('ctr', keyword.ctr, compareKeyword?.ctr)}`}>
              {compareKeyword?.ctr != null ? compareKeyword.ctr.toFixed(2) + '%' : 'N/A'}
            </td>
          </>
        ) : (
          <>
            <td className="px-6 py-3.5 text-apple-sm text-apple-text-secondary">
              {keyword.position ?? 'N/A'}
            </td>
            <td className="px-6 py-3.5 text-apple-sm text-apple-text-secondary">
              {keyword.impressions != null ? keyword.impressions.toLocaleString() : 'N/A'}
            </td>
            <td className="px-6 py-3.5 text-apple-sm text-apple-text-secondary">
              {keyword.clicks != null ? keyword.clicks.toLocaleString() : 'N/A'}
            </td>
            <td className="px-6 py-3.5 text-apple-sm text-apple-text-secondary">
              {keyword.ctr != null ? keyword.ctr.toFixed(2) + '%' : 'N/A'}
            </td>
          </>
        )}
      </tr>

      {/* Expanded keyword details */}
      {isExpanded && (() => {
        const colSpan = compareDateRange ? 12 : 8;
        const topPage = pages.length > 0 ? pages[0] : null;
        const additionalPages = pages.length > 1 ? pages.slice(1) : [];

        return (
          <>
            {/* 1. Insights: trending, opportunity score, position chart */}
            <tr className="bg-apple-fill-secondary">
              <td colSpan={colSpan} className="px-6 py-2">
                <KeywordInsightsPanel
                  keyword={keyword.keyword}
                  currentPosition={keyword.position ?? null}
                  history={history}
                  loadingHistory={loadingHistory}
                  checklist={scanResult?.checklist || null}
                  searchVolume={volume?.avgMonthlySearches ?? null}
                />
              </td>
            </tr>

            {/* 2. Top Ranking Page */}
            <tr className="bg-apple-fill-secondary">
              <td colSpan={colSpan} className="px-6 py-3">
                {isLoadingPages ? (
                  <div className="flex items-center gap-2 text-apple-sm text-apple-text-tertiary">
                    <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
                    Loading pages...
                  </div>
                ) : topPage ? (
                  <div className="rounded-apple-sm border border-apple-divider bg-white p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-apple-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                      <span className="text-apple-xs font-semibold text-apple-text-secondary uppercase tracking-wider">
                        Top Ranking Page
                      </span>
                    </div>
                    <a
                      href={topPage.page}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-apple-sm text-apple-blue hover:underline break-all font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {topPage.page}
                    </a>
                    <div className="flex gap-6 mt-2">
                      <div>
                        <span className="text-apple-xs text-apple-text-tertiary">Clicks</span>
                        <div className="text-apple-sm font-semibold text-apple-text">{topPage.clicks.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-apple-xs text-apple-text-tertiary">Impressions</span>
                        <div className="text-apple-sm font-semibold text-apple-text">{topPage.impressions.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-apple-xs text-apple-text-tertiary">CTR</span>
                        <div className="text-apple-sm font-semibold text-apple-text">{topPage.ctr.toFixed(2)}%</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-apple-sm text-apple-text-tertiary">
                    No page data available for this keyword
                  </div>
                )}
              </td>
            </tr>

            {/* 3. Scan button / loading / error / results */}
            <tr className="bg-apple-fill-secondary">
              <td colSpan={colSpan} className="px-6 py-3">
                {/* Scan button */}
                {!scanResult && !isLoadingRecs && !recsError && pages.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onScanRecommendations();
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-apple-pill bg-apple-blue text-white text-apple-sm font-medium transition-all duration-200 hover:bg-apple-blue-hover active:opacity-80 shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Scan for Recommendations
                  </button>
                )}

                {/* Loading */}
                {isLoadingRecs && (
                  <div className="flex items-center gap-3 py-2">
                    <div className="w-5 h-5 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
                    <div>
                      <span className="text-apple-sm font-medium text-apple-text">Analyzing pages...</span>
                      <span className="text-apple-xs text-apple-text-tertiary ml-2">
                        Crawling content, grading SEO elements, and generating your action plan
                      </span>
                    </div>
                  </div>
                )}

                {/* Error */}
                {recsError && (
                  <div className="flex items-center gap-3 py-2">
                    <span className="text-apple-sm text-apple-red">{recsError}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onScanRecommendations();
                      }}
                      className="text-apple-sm text-apple-blue hover:underline"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Results: strategy + audit + checklist */}
                {scanResult && (
                  <RecommendationsPanel
                    scanResult={scanResult}
                    keyword={keyword.keyword}
                    siteUrl={siteUrl}
                  />
                )}
              </td>
            </tr>

            {/* 4. Additional Pages */}
            {!isLoadingPages && additionalPages.length > 0 && (
              <>
                <tr className="bg-apple-fill-secondary border-b border-apple-divider">
                  <td colSpan={colSpan} className="px-6 pt-4 pb-2">
                    <span className="text-apple-xs font-semibold text-apple-text-secondary uppercase tracking-wider">
                      Additional Pages Ranking For "{keyword.keyword}" ({additionalPages.length})
                    </span>
                  </td>
                </tr>
                {additionalPages.map((page, pageIndex) => (
                  <tr key={`page-${pageIndex}`} className="bg-apple-fill-secondary border-b border-apple-divider">
                    <td className="px-6 py-3" />
                    <td className="px-6 py-3 text-apple-sm text-apple-text">
                      <a
                        href={page.page}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-apple-blue hover:underline"
                        onClick={(e) => e.stopPropagation()}
                        title={page.page}
                      >
                        {page.page}
                      </a>
                    </td>
                    <td className="px-6 py-3" />
                    <td className="px-6 py-3" />
                    {compareDateRange ? (
                      <>
                        <td className="px-6 py-3" />
                        <td className="px-6 py-3" />
                        <td className="px-6 py-3 text-apple-sm text-apple-text-secondary">{page.impressions.toLocaleString()}</td>
                        <td className="px-6 py-3" />
                        <td className="px-6 py-3 text-apple-sm text-apple-text-secondary">{page.clicks.toLocaleString()}</td>
                        <td className="px-6 py-3" />
                        <td className="px-6 py-3 text-apple-sm text-apple-text-secondary">{page.ctr.toFixed(2)}%</td>
                        <td className="px-6 py-3" />
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-3" />
                        <td className="px-6 py-3 text-apple-sm text-apple-text-secondary">{page.impressions.toLocaleString()}</td>
                        <td className="px-6 py-3 text-apple-sm text-apple-text-secondary">{page.clicks.toLocaleString()}</td>
                        <td className="px-6 py-3 text-apple-sm text-apple-text-secondary">{page.ctr.toFixed(2)}%</td>
                      </>
                    )}
                  </tr>
                ))}
              </>
            )}
          </>
        );
      })()}
    </>
  );
}
