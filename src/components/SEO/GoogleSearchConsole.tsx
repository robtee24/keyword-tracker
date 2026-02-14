import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import type { DateRange } from '../../types';
import { fetchGoogleSearchConsole } from '../../services/googleSearchConsoleService';
import { authenticatedFetch } from '../../services/authService';
import { API_ENDPOINTS } from '../../config/api';
import SectionHeader from '../SectionHeader';
import LineChart from '../LineChart';

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
      let aVal: any = a[sortColumn];
      let bVal: any = b[sortColumn];
      if (sortColumn === 'keyword') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
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

  const handleKeywordRowClick = async (keyword: string) => {
    if (expandedKeyword === keyword) {
      setExpandedKeyword(null);
      return;
    }
    setExpandedKeyword(keyword);

    if (keywordPages.has(keyword)) return;

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
            {selectedKeywords.size > 0 && appliedFilter.size === 0 && (
              <button onClick={applyFilter} className="btn-primary text-apple-sm">
                Apply Filter ({selectedKeywords.size})
              </button>
            )}
            {appliedFilter.size > 0 && (
              <button onClick={clearFilter} className="btn-danger text-apple-sm">
                Clear Filter
              </button>
            )}
            {searchTerm && appliedFilter.size === 0 && (
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
                    />
                  );
                })
              ) : (
                <tr>
                  <td colSpan={compareDateRange ? 10 : 6} className="px-6 py-12 text-center text-apple-text-tertiary text-apple-base">
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

      {/* Expanded pages rows */}
      {isExpanded && (
        <>
          {isLoadingPages ? (
            <tr className="bg-apple-fill-secondary">
              <td colSpan={compareDateRange ? 10 : 6} className="px-6 py-4">
                <div className="flex items-center gap-2 text-apple-sm text-apple-text-tertiary">
                  <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
                  Loading pages...
                </div>
              </td>
            </tr>
          ) : pages.length > 0 ? (
            pages.map((page, pageIndex) => (
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
            ))
          ) : (
            <tr className="bg-apple-fill-secondary">
              <td colSpan={compareDateRange ? 10 : 6} className="px-6 py-4 text-apple-sm text-apple-text-tertiary">
                No page data available for this keyword
              </td>
            </tr>
          )}
        </>
      )}
    </>
  );
}
