import { useState, useEffect } from 'react';
import { authenticatedFetch } from '../../services/authService';
import { API_ENDPOINTS } from '../../config/api';
import RecommendationsPanel from './RecommendationsPanel';
import type { ScanResult, ChecklistItem } from './RecommendationsPanel';

interface GroupRecommendationsProps {
  groupName: string;
  keywords: string[];
  siteUrl: string;
  keywordPages: Map<string, Array<{ page: string; clicks: number; impressions: number; ctr: number }>>;
  cachedScanResults: Map<string, ScanResult>;
  onScanResultsUpdate: (results: Map<string, ScanResult>) => void;
  searchVolumes: Map<string, { avgMonthlySearches: number | null }>;
}

interface ConflictGroup {
  page: string;
  category: string;
  items: Array<{
    keyword: string;
    task: ChecklistItem;
    priority: number;
  }>;
}

function calculateKeywordValue(
  keyword: string,
  position: number | null,
  volume: number | null,
): number {
  let score = 0;
  if (position !== null && position > 0) {
    // Closer to #1 = higher value; top 10 is much more valuable
    if (position <= 3) score += 100;
    else if (position <= 10) score += 70;
    else if (position <= 20) score += 40;
    else if (position <= 50) score += 20;
    else score += 5;
  }
  if (volume !== null && volume > 0) {
    if (volume >= 10000) score += 50;
    else if (volume >= 5000) score += 40;
    else if (volume >= 1000) score += 30;
    else if (volume >= 500) score += 20;
    else if (volume >= 100) score += 10;
    else score += 5;
  }
  return score;
}

const CATEGORY_LABELS: Record<string, string> = {
  'title-tag': 'Title Tags',
  'meta-description': 'Meta Descriptions',
  'heading-structure': 'Heading Structure',
  content: 'Content',
  'internal-linking': 'Internal Links',
  'schema-markup': 'Schema Markup',
  'technical-seo': 'Technical SEO',
  backlinks: 'Backlinks',
  images: 'Images',
  'featured-snippet': 'Featured Snippet',
  'topical-authority': 'Topical Authority',
  eeat: 'E-E-A-T',
};

const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  high: { bg: 'bg-red-50', text: 'text-red-600' },
  medium: { bg: 'bg-orange-50', text: 'text-orange-600' },
  low: { bg: 'bg-blue-50', text: 'text-blue-600' },
};

export default function GroupRecommendations({
  groupName,
  keywords,
  siteUrl,
  keywordPages,
  cachedScanResults,
  onScanResultsUpdate,
  searchVolumes,
}: GroupRecommendationsProps) {
  const [scanResults, setScanResults] = useState<Map<string, ScanResult>>(new Map(cachedScanResults));
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, keyword: '' });
  const [scanErrors, setScanErrors] = useState<Map<string, string>>(new Map());
  const [activeTab, setActiveTab] = useState<'individual' | 'ranked'>('ranked');

  useEffect(() => {
    setScanResults(new Map(cachedScanResults));
  }, [cachedScanResults]);

  const scannedCount = keywords.filter((kw) => scanResults.has(kw)).length;
  const needsScan = keywords.filter((kw) => !scanResults.has(kw) && (keywordPages.get(kw)?.length || 0) > 0);

  const handleScanAll = async () => {
    setScanning(true);
    setScanErrors(new Map());
    const toScan = keywords.filter((kw) => !scanResults.has(kw));
    setScanProgress({ current: 0, total: toScan.length, keyword: '' });

    const newResults = new Map(scanResults);

    for (let i = 0; i < toScan.length; i++) {
      const kw = toScan[i];
      const pages = keywordPages.get(kw) || [];
      setScanProgress({ current: i + 1, total: toScan.length, keyword: kw });

      if (pages.length === 0) {
        setScanErrors((prev) => new Map(prev).set(kw, 'No pages found'));
        continue;
      }

      try {
        const response = await authenticatedFetch(API_ENDPOINTS.google.searchConsole.recommendations, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keyword: kw,
            pages: pages.map((p) => ({ url: p.page, clicks: p.clicks, impressions: p.impressions })),
            siteUrl,
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(err.error || `HTTP ${response.status}`);
        }

        const result: ScanResult = await response.json();
        newResults.set(kw, result);
        setScanResults(new Map(newResults));
      } catch (err: any) {
        setScanErrors((prev) => new Map(prev).set(kw, err.message || 'Scan failed'));
      }
    }

    setScanning(false);
    onScanResultsUpdate(newResults);
  };

  // Build ranked recommendations with conflict detection
  const { rankedItems, conflicts } = buildRankedRecommendations(
    keywords, scanResults, keywordPages, searchVolumes
  );

  return (
    <div className="space-y-4">
      {/* Scan Status */}
      <div className="rounded-apple-sm border border-apple-divider bg-white overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <h4 className="text-apple-sm font-semibold text-apple-text">
              Group Scan: {groupName}
            </h4>
            <p className="text-apple-xs text-apple-text-tertiary mt-0.5">
              {scannedCount}/{keywords.length} keywords scanned
              {needsScan.length > 0 && ` · ${needsScan.length} remaining`}
            </p>
          </div>
          <button
            onClick={handleScanAll}
            disabled={scanning || needsScan.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-apple-pill bg-apple-blue text-white text-apple-sm font-medium transition-all duration-200 hover:bg-apple-blue-hover active:opacity-80 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanning ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Scanning {scanProgress.current}/{scanProgress.total}...
              </>
            ) : scannedCount === keywords.length ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                All Scanned
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Scan {needsScan.length > 0 ? `${needsScan.length} Keywords` : 'All Keywords'}
              </>
            )}
          </button>
        </div>

        {/* Scan Progress */}
        {scanning && (
          <div className="px-5 pb-4">
            <div className="h-1.5 rounded-full bg-apple-divider overflow-hidden">
              <div
                className="h-full rounded-full bg-apple-blue transition-all duration-500"
                style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-apple-xs text-apple-text-tertiary mt-1.5">
              Scanning: <span className="font-medium text-apple-text-secondary">{scanProgress.keyword}</span>
            </p>
          </div>
        )}

        {/* Errors */}
        {scanErrors.size > 0 && (
          <div className="px-5 pb-4">
            <div className="text-apple-xs text-apple-red">
              {scanErrors.size} keyword{scanErrors.size !== 1 ? 's' : ''} failed to scan
            </div>
          </div>
        )}
      </div>

      {/* Results Tabs */}
      {scannedCount > 0 && (
        <>
          <div className="flex gap-6 border-b border-apple-divider">
            <button
              onClick={() => setActiveTab('ranked')}
              className={`py-2.5 text-apple-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === 'ranked'
                  ? 'border-apple-blue text-apple-blue'
                  : 'border-transparent text-apple-text-tertiary hover:text-apple-text-secondary'
              }`}
            >
              Ranked Recommendations
              {conflicts.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                  {conflicts.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('individual')}
              className={`py-2.5 text-apple-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === 'individual'
                  ? 'border-apple-blue text-apple-blue'
                  : 'border-transparent text-apple-text-tertiary hover:text-apple-text-secondary'
              }`}
            >
              By Keyword ({scannedCount})
            </button>
          </div>

          {activeTab === 'ranked' ? (
            <RankedView
              rankedItems={rankedItems}
              conflicts={conflicts}
              keywords={keywords}
              scanResults={scanResults}
            />
          ) : (
            <IndividualView
              keywords={keywords}
              scanResults={scanResults}
              siteUrl={siteUrl}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Ranked Recommendations View                                        */
/* ------------------------------------------------------------------ */

interface RankedItem {
  keyword: string;
  task: ChecklistItem;
  keywordValue: number;
  isConflict: boolean;
  isPrimary: boolean;
}

function RankedView({
  rankedItems,
  conflicts,
  keywords,
  scanResults,
}: {
  rankedItems: RankedItem[];
  conflicts: ConflictGroup[];
  keywords: string[];
  scanResults: Map<string, ScanResult>;
}) {
  const [showConflictsOnly, setShowConflictsOnly] = useState(false);

  const displayItems = showConflictsOnly
    ? rankedItems.filter((item) => item.isConflict)
    : rankedItems;

  const highPriority = displayItems.filter((i) => i.task.priority === 'high' && i.isPrimary);
  const medPriority = displayItems.filter((i) => i.task.priority === 'medium' && i.isPrimary);
  const lowPriority = displayItems.filter((i) => i.task.priority === 'low' && i.isPrimary);
  const deprioritized = displayItems.filter((i) => !i.isPrimary);

  return (
    <div className="space-y-4">
      {/* Conflict Summary */}
      {conflicts.length > 0 && (
        <div className="rounded-apple-sm border border-amber-200 bg-amber-50/50 px-5 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-apple-sm font-medium text-amber-800">
                {conflicts.length} conflicting recommendation{conflicts.length !== 1 ? 's' : ''} detected
              </span>
            </div>
            <button
              onClick={() => setShowConflictsOnly(!showConflictsOnly)}
              className="text-apple-xs text-amber-700 hover:underline font-medium"
            >
              {showConflictsOnly ? 'Show all' : 'Show conflicts only'}
            </button>
          </div>
          <p className="text-apple-xs text-amber-700 mt-1">
            Multiple keywords target the same page with different suggestions. Higher-value keywords are prioritized.
          </p>
        </div>
      )}

      {/* Priority Sections */}
      {highPriority.length > 0 && (
        <PrioritySection label="High Priority" items={highPriority} color="red" />
      )}
      {medPriority.length > 0 && (
        <PrioritySection label="Medium Priority" items={medPriority} color="orange" />
      )}
      {lowPriority.length > 0 && (
        <PrioritySection label="Low Priority" items={lowPriority} color="blue" />
      )}
      {deprioritized.length > 0 && (
        <div className="rounded-apple-sm border border-apple-divider bg-white overflow-hidden opacity-60">
          <div className="px-5 py-2.5 bg-apple-fill-secondary border-b border-apple-divider">
            <div className="flex items-center gap-2">
              <span className="text-apple-xs font-semibold text-apple-text-tertiary uppercase tracking-wider">
                Deprioritized (Conflicts)
              </span>
              <span className="text-apple-xs text-apple-text-tertiary">
                ({deprioritized.length})
              </span>
            </div>
            <p className="text-apple-xs text-apple-text-tertiary mt-0.5">
              These conflict with higher-value keyword recommendations for the same page
            </p>
          </div>
          <div className="divide-y divide-apple-divider">
            {deprioritized.map((item, i) => (
              <RankedItemRow key={`depri-${i}`} item={item} />
            ))}
          </div>
        </div>
      )}

      {displayItems.length === 0 && (
        <div className="text-center py-8 text-apple-text-tertiary text-apple-sm">
          No recommendations to display
        </div>
      )}
    </div>
  );
}

function PrioritySection({
  label,
  items,
  color,
}: {
  label: string;
  items: RankedItem[];
  color: 'red' | 'orange' | 'blue';
}) {
  const colorMap = {
    red: { header: 'text-red-700', bg: 'bg-red-50/30' },
    orange: { header: 'text-orange-700', bg: 'bg-orange-50/30' },
    blue: { header: 'text-blue-700', bg: 'bg-blue-50/30' },
  };

  return (
    <div className="rounded-apple-sm border border-apple-divider bg-white overflow-hidden">
      <div className={`px-5 py-2.5 bg-apple-fill-secondary border-b border-apple-divider`}>
        <div className="flex items-center gap-2">
          <span className={`text-apple-xs font-semibold uppercase tracking-wider ${colorMap[color].header}`}>
            {label}
          </span>
          <span className="text-apple-xs text-apple-text-tertiary">
            ({items.length})
          </span>
        </div>
      </div>
      <div className="divide-y divide-apple-divider">
        {items.map((item, i) => (
          <RankedItemRow key={`${label}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function RankedItemRow({ item }: { item: RankedItem }) {
  const catLabel = CATEGORY_LABELS[item.task.category] || item.task.category;
  const priStyle = PRIORITY_STYLES[item.task.priority] || PRIORITY_STYLES.medium;

  return (
    <div className={`flex items-start gap-3 px-5 py-3 ${item.isConflict && !item.isPrimary ? 'bg-amber-50/20' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-apple-xs font-medium px-2 py-0.5 rounded-apple-pill bg-apple-fill-secondary text-apple-text-secondary">
            {item.keyword}
          </span>
          <span className="text-apple-xs text-apple-text-tertiary">{catLabel}</span>
          {item.isConflict && (
            <span className={`text-apple-xs font-medium px-1.5 py-0.5 rounded-apple-pill ${
              item.isPrimary ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {item.isPrimary ? 'Primary' : 'Conflict'}
            </span>
          )}
        </div>
        <p className={`text-apple-sm leading-relaxed ${item.isPrimary ? 'text-apple-text' : 'text-apple-text-tertiary line-through'}`}>
          {item.task.task}
        </p>
        {item.task.page && (
          <span className="text-apple-xs text-apple-text-tertiary mt-0.5 block truncate">
            {item.task.page}
          </span>
        )}
      </div>
      <span className={`flex-shrink-0 px-2 py-0.5 rounded-apple-pill text-apple-xs font-medium ${priStyle.bg} ${priStyle.text}`}>
        {item.task.priority}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Individual Keyword View                                            */
/* ------------------------------------------------------------------ */

function IndividualView({
  keywords,
  scanResults,
  siteUrl,
}: {
  keywords: string[];
  scanResults: Map<string, ScanResult>;
  siteUrl: string;
}) {
  const [expandedKw, setExpandedKw] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {keywords.map((kw) => {
        const result = scanResults.get(kw);
        const isExpanded = expandedKw === kw;

        return (
          <div key={kw} className="rounded-apple-sm border border-apple-divider bg-white overflow-hidden">
            <button
              onClick={() => setExpandedKw(isExpanded ? null : kw)}
              className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-apple-fill-secondary transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-apple-sm font-medium text-apple-text">{kw}</span>
                {result ? (
                  <span className="text-apple-xs px-2 py-0.5 rounded-apple-pill bg-green-50 text-green-700 font-medium">
                    {result.checklist.length} tasks
                  </span>
                ) : (
                  <span className="text-apple-xs text-apple-text-tertiary">Not scanned</span>
                )}
              </div>
              <svg
                className={`w-4 h-4 text-apple-text-tertiary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isExpanded && result && (
              <div className="border-t border-apple-divider px-3 pb-3">
                <RecommendationsPanel
                  scanResult={result}
                  keyword={kw}
                  siteUrl={siteUrl}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Conflict Detection & Ranking                                       */
/* ------------------------------------------------------------------ */

function buildRankedRecommendations(
  keywords: string[],
  scanResults: Map<string, ScanResult>,
  keywordPages: Map<string, Array<{ page: string }>>,
  searchVolumes: Map<string, { avgMonthlySearches: number | null }>,
): { rankedItems: RankedItem[]; conflicts: ConflictGroup[] } {
  const allItems: RankedItem[] = [];
  const keywordValues = new Map<string, number>();

  // Calculate value for each keyword
  for (const kw of keywords) {
    const result = scanResults.get(kw);
    if (!result) continue;

    const topPage = keywordPages.get(kw)?.[0];
    const volume = searchVolumes.get(kw)?.avgMonthlySearches ?? null;
    // Use position from page data if available, otherwise estimate from strategy
    const value = calculateKeywordValue(kw, null, volume);
    keywordValues.set(kw, value);
  }

  // Collect all checklist items with keyword attribution
  for (const kw of keywords) {
    const result = scanResults.get(kw);
    if (!result) continue;

    for (const task of result.checklist) {
      allItems.push({
        keyword: kw,
        task,
        keywordValue: keywordValues.get(kw) || 0,
        isConflict: false,
        isPrimary: true,
      });
    }
  }

  // Detect conflicts: same page + same category = conflict
  const conflicts: ConflictGroup[] = [];
  const CONFLICTING_CATEGORIES = new Set([
    'title-tag', 'meta-description', 'heading-structure', 'schema-markup',
  ]);

  const pageCategory = new Map<string, RankedItem[]>();
  for (const item of allItems) {
    if (!item.task.page || !CONFLICTING_CATEGORIES.has(item.task.category)) continue;
    const key = `${item.task.page}::${item.task.category}`;
    if (!pageCategory.has(key)) pageCategory.set(key, []);
    pageCategory.get(key)!.push(item);
  }

  for (const [key, items] of pageCategory) {
    if (items.length <= 1) continue;

    // Sort by keyword value descending — highest value keyword wins
    items.sort((a, b) => b.keywordValue - a.keywordValue);

    const [page, category] = key.split('::');
    conflicts.push({
      page,
      category,
      items: items.map((item) => ({
        keyword: item.keyword,
        task: item.task,
        priority: item.keywordValue,
      })),
    });

    // Mark conflicts
    for (let i = 0; i < items.length; i++) {
      items[i].isConflict = true;
      items[i].isPrimary = i === 0;
    }
  }

  // Sort: primary items first, then by priority (high > medium > low), then by keyword value
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  allItems.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    const pa = priorityOrder[a.task.priority] ?? 1;
    const pb = priorityOrder[b.task.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    return b.keywordValue - a.keywordValue;
  });

  return { rankedItems: allItems, conflicts };
}
