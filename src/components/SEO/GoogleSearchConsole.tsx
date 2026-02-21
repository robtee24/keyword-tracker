import { useState, useEffect, useRef, useMemo } from 'react';
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
import ActivityLog from './ActivityLog';
import GroupRecommendations from './GroupRecommendations';

interface KeywordGroup {
  id: number;
  name: string;
  keywords: string[];
  createdAt: string;
}

interface GoogleSearchConsoleProps {
  dateRange: DateRange;
  compareDateRange: DateRange | null;
  siteUrl: string;
  loadTrigger: number;
  projectId?: string;
}

export default function GoogleSearchConsole({
  dateRange,
  compareDateRange,
  siteUrl,
  loadTrigger,
  projectId,
}: GoogleSearchConsoleProps) {
  const objectives = useMemo(() => {
    if (!projectId) return null;
    try {
      const raw = localStorage.getItem(`kt_objectives_${projectId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [projectId]);

  const competitorBrands = useMemo(() => {
    if (!objectives?.competitors) return [];
    try {
      const text: string = objectives.competitors;
      return text
        .split(/[\n,]+/)
        .map((s: string) => s.trim().toLowerCase())
        .filter((s: string) => s.length > 0)
        .flatMap((entry: string) => {
          try {
            const host = new URL(entry.startsWith('http') ? entry : `https://${entry}`).hostname;
            const brand = host.replace('www.', '').split('.')[0];
            return brand ? [brand] : [];
          } catch {
            return [entry.replace(/[^a-z0-9]/g, '')];
          }
        })
        .filter((b: string) => b.length > 1);
    } catch {
      return [];
    }
  }, [objectives]);

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
  const [alertData, setAlertData] = useState<Map<string, {
    period1?: { position: number };
    period2?: { position: number };
    period3?: { position: number };
  }>>(new Map());
  const [loadingVolumes, setLoadingVolumes] = useState(false);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [activeAlert, setActiveAlert] = useState<'fire' | 'smoking' | 'hot' | ''>('');
  const [intentStore, setIntentStore] = useState<IntentStore>(() => loadIntentStore(siteUrl));
  const [groups, setGroups] = useState<KeywordGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<KeywordGroup | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showGroupScan, setShowGroupScan] = useState(false);
  const [addToGroupKeywords, setAddToGroupKeywords] = useState<Set<string>>(new Set());
  const [showAddToGroup, setShowAddToGroup] = useState(false);
  const [newKeywords, setNewKeywords] = useState<Set<string>>(new Set());
  const [lostKeywords, setLostKeywords] = useState<Array<{ keyword: string; lastSeenAt: string }>>([]);
  const [aiIntents, setAiIntents] = useState<Record<string, KeywordIntent>>({});
  const [loadingAiIntents, setLoadingAiIntents] = useState(false);

  // Reload intent store when siteUrl changes
  useEffect(() => {
    setIntentStore(loadIntentStore(siteUrl));
  }, [siteUrl]);

  // Fetch keyword groups
  useEffect(() => {
    if (!siteUrl) return;
    (async () => {
      try {
        const resp = await fetch(
          `${API_ENDPOINTS.db.keywordGroups}?siteUrl=${encodeURIComponent(siteUrl)}`
        );
        if (resp.ok) {
          const { groups: g } = await resp.json();
          setGroups(g || []);
        }
      } catch { /* non-critical */ }
    })();
  }, [siteUrl]);

  const createGroup = async (name: string) => {
    try {
      const resp = await fetch(API_ENDPOINTS.db.keywordGroups, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, name }),
      });
      if (resp.ok) {
        const { group } = await resp.json();
        setGroups((prev) => [...prev, group]);
        setShowCreateGroup(false);
        setNewGroupName('');
      }
    } catch { /* ignore */ }
  };

  const deleteGroup = async (id: number) => {
    try {
      await fetch(API_ENDPOINTS.db.keywordGroups, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setGroups((prev) => prev.filter((g) => g.id !== id));
      if (activeGroup?.id === id) {
        setActiveGroup(null);
        setShowGroupScan(false);
      }
    } catch { /* ignore */ }
  };

  const addKeywordsToGroup = async (groupId: number, keywords: string[]) => {
    try {
      const resp = await fetch(API_ENDPOINTS.db.keywordGroupMembers, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, siteUrl, keywords }),
      });
      if (resp.ok) {
        const mergeKeywords = (existing: string[]) => [...new Set([...existing, ...keywords])];
        setGroups((prev) =>
          prev.map((g) =>
            g.id === groupId
              ? { ...g, keywords: mergeKeywords(g.keywords) }
              : g
          )
        );
        if (activeGroup?.id === groupId) {
          setActiveGroup((prev) =>
            prev ? { ...prev, keywords: mergeKeywords(prev.keywords) } : null
          );
        }
        setSelectedKeywords(new Set());
        setShowAddToGroup(false);
        setAddToGroupKeywords(new Set());
      }
    } catch { /* ignore */ }
  };

  const removeKeywordFromGroup = async (groupId: number, keyword: string) => {
    try {
      await fetch(API_ENDPOINTS.db.keywordGroupMembers, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, keyword }),
      });
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, keywords: g.keywords.filter((k) => k !== keyword) }
            : g
        )
      );
      if (activeGroup?.id === groupId) {
        setActiveGroup((prev) =>
          prev ? { ...prev, keywords: prev.keywords.filter((k) => k !== keyword) } : null
        );
      }
    } catch { /* ignore */ }
  };

  const handleIntentOverride = (keyword: string, newIntent: KeywordIntent) => {
    const allKws = data?.current?.keywords?.map((k: any) => k.keyword) || [];
    const { store, affected } = learnIntentOverride(siteUrl, keyword, newIntent, allKws);
    setIntentStore({ ...store });
    // Force re-render by creating a new object reference
  };

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
            positionHistory: [],
          },
          compare: null,
        });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [loadTrigger, dateRange, compareDateRange, siteUrl]);

  const saveVolumesToDB = async (site: string, volumes: Record<string, any>) => {
    try {
      const resp = await fetch(API_ENDPOINTS.db.searchVolumes, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl: site, volumes }),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        console.error('[SearchVolumes] DB save failed:', resp.status, text);
      } else {
        const result = await resp.json();
        console.log('[SearchVolumes] Saved to DB:', result.saved, 'volumes');
      }
    } catch (err) {
      console.error('[SearchVolumes] DB save error:', err);
    }
  };

  const loadAndSyncSearchVolumes = async (site: string, keywords: string[]) => {
    // Step 1: Read all stored volumes from DB
    let storedCount = 0;
    const volumeMap = new Map<string, any>();

    try {
      const volResp = await fetch(
        `${API_ENDPOINTS.db.searchVolumes}?siteUrl=${encodeURIComponent(site)}`
      );
      if (volResp.ok) {
        const volResult = await volResp.json();
        storedCount = volResult.count || 0;
        if (volResult.volumes) {
          for (const [kw, vol] of Object.entries(volResult.volumes)) {
            volumeMap.set(kw.toLowerCase(), vol as any);
          }
        }
        console.log('[SearchVolumes] Loaded from DB:', storedCount, 'volumes');
      } else {
        console.error('[SearchVolumes] DB read failed:', volResp.status);
      }
    } catch (err) {
      console.error('[SearchVolumes] DB read error:', err);
    }

    // Show cached volumes immediately
    if (volumeMap.size > 0) {
      setSearchVolumes(volumeMap);
    }

    // Step 2: Determine which keywords need a Google Ads API call
    const missing = keywords.filter((kw) => !volumeMap.has(kw.toLowerCase()));
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    let oldestFetch = Infinity;
    for (const vol of volumeMap.values()) {
      if (vol.fetchedAt) {
        const t = new Date(vol.fetchedAt).getTime();
        if (t < oldestFetch) oldestFetch = t;
      }
    }
    const needsMonthlyRefresh = volumeMap.size > 0 && oldestFetch < Date.now() - THIRTY_DAYS;
    const toFetch = needsMonthlyRefresh ? keywords : missing;

    if (toFetch.length === 0) {
      console.log('[SearchVolumes] All volumes cached, nothing to fetch');
      return;
    }

    console.log('[SearchVolumes] Fetching from Google Ads:', toFetch.length, 'keywords',
      needsMonthlyRefresh ? '(monthly refresh)' : '(new keywords)');

    // Step 3: Fetch from Google Ads
    try {
      const freshResp = await authenticatedFetch(API_ENDPOINTS.google.ads.searchVolume, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: toFetch, siteUrl: site }),
      });

      if (!freshResp.ok) {
        console.error('[SearchVolumes] Google Ads API failed:', freshResp.status);
        return;
      }

      const freshResult = await freshResp.json();
      const freshVolumes = freshResult.volumes || {};
      const freshCount = Object.keys(freshVolumes).length;
      console.log('[SearchVolumes] Got from Google Ads:', freshCount, 'volumes',
        freshResult.fromCache ? '(from server cache)' : '(fresh)');

      if (freshCount > 0) {
        // Update state
        setSearchVolumes((prev) => {
          const merged = new Map(prev);
          for (const [kw, vol] of Object.entries(freshVolumes)) {
            merged.set(kw.toLowerCase(), vol as any);
          }
          return merged;
        });

        // Save to DB (awaited, not fire-and-forget)
        await saveVolumesToDB(site, freshVolumes);
      }
    } catch (err) {
      console.error('[SearchVolumes] Google Ads fetch error:', err);
    }
  };

  // Store keywords + load search volumes from DB (no Google Ads on normal loads)
  useEffect(() => {
    if (!data?.current?.keywords?.length) return;

    const keywords: string[] = data.current.keywords.map((kw: any) => kw.keyword);
    if (keywords.length === 0) return;

    const run = async () => {
      // 1. Store keywords and detect new/lost
      try {
        const storeResp = await fetch(API_ENDPOINTS.db.keywords, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl, keywords }),
        });
        if (storeResp.ok) {
          const storeResult = await storeResp.json();
          setNewKeywords(new Set(storeResult.newKeywords || []));
          setLostKeywords(storeResult.lostKeywords || []);
        }
      } catch { /* non-critical */ }

      // 2. Load stored search volumes from DB, fetch missing from Google Ads
      setLoadingVolumes(true);
      try {
        await loadAndSyncSearchVolumes(siteUrl, keywords);
      } catch (err) {
        console.error('[SearchVolumes] top-level error:', err);
      }
      setLoadingVolumes(false);
    };
    run();
  }, [data, siteUrl]);

  // AI intent classification using objectives data
  useEffect(() => {
    if (!data?.current?.keywords?.length || !siteUrl) return;

    const keywords: string[] = data.current.keywords.map((kw: any) => kw.keyword);
    if (keywords.length === 0) return;

    let cancelled = false;
    setLoadingAiIntents(true);

    fetch(API_ENDPOINTS.ai.classifyIntents, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteUrl, keywords, objectives: objectives || {} }),
    })
      .then((resp) => resp.ok ? resp.json() : null)
      .then((result) => {
        if (!cancelled && result?.intents) {
          setAiIntents(result.intents);
          console.log('[AI Intents] Classified:', Object.keys(result.intents).length,
            result.fromCache ? '(all cached)' : `(${result.classified || 0} new)`);
        }
      })
      .catch((err) => console.error('[AI Intents] Error:', err))
      .finally(() => { if (!cancelled) setLoadingAiIntents(false); });

    return () => { cancelled = true; };
  }, [data, siteUrl, objectives]);

  // Fetch alert data (positions across 3 time periods) after keyword data loads
  useEffect(() => {
    if (!data?.current?.keywords?.length || !siteUrl) return;

    const fetchAlerts = async () => {
      setLoadingAlerts(true);
      try {
        const response = await authenticatedFetch(API_ENDPOINTS.google.searchConsole.keywordAlerts, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl }),
        });
        if (response.ok) {
          const result = await response.json();
          if (result.alerts) {
            const alertMap = new Map<string, any>();
            for (const [kw, periods] of Object.entries(result.alerts)) {
              alertMap.set(kw, periods as any);
            }
            setAlertData(alertMap);
          }
        }
      } catch {
        // Silently fail — alerts are optional
      } finally {
        setLoadingAlerts(false);
      }
    };
    fetchAlerts();
  }, [data, siteUrl]);

  if (loading) {
    return (
      <div className="card p-8">
        <SectionHeader
          title="Google Search Console"
          logoUrl="https://cdn.simpleicons.org/googlesearchconsole/4285F4"
        />
        <LoadingStatusBar
          steps={[
            { label: 'Keyword rankings', status: 'loading' },
            { label: 'Search volumes', status: 'pending' },
            { label: 'Keyword alerts', status: 'pending' },
          ]}
        />
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

  // Compute alert status for each keyword
  const keywordAlerts = new Map<string, Set<'fire' | 'smoking' | 'hot'>>();
  let fireCount = 0;
  let smokingCount = 0;
  let hotCount = 0;

  if (alertData.size > 0) {
    for (const kw of data.current.keywords) {
      const kwName = kw.keyword;
      const { intent } = getEffectiveIntent(kwName, intentStore, keywordPages.get(kwName)?.[0]?.page, siteUrl, competitorBrands, aiIntents);
      const isActionable = intent === 'Transactional' || intent === 'Product' || intent === 'Local' || intent === 'Competitor Transactional';
      if (!isActionable) continue;

      const periods = alertData.get(kwName);
      if (!periods) continue;

      const currentPosition = kw.position ?? null;
      if (currentPosition === null) continue;

      const alerts = new Set<'fire' | 'smoking' | 'hot'>();

      // Best historical position across all 3 periods
      const historicalPositions = [
        periods.period1?.position,
        periods.period2?.position,
        periods.period3?.position,
      ].filter((p): p is number => p != null && p > 0);

      const bestHistorical = historicalPositions.length > 0
        ? Math.min(...historicalPositions)
        : null;

      // Fire: was in top 10 in the past year, now > 10
      if (bestHistorical !== null && bestHistorical <= 10 && currentPosition > 10) {
        alerts.add('fire');
        fireCount++;
      }

      // Smoking: was in top 5 in the past year, now > 5
      if (bestHistorical !== null && bestHistorical <= 5 && currentPosition > 5) {
        alerts.add('smoking');
        smokingCount++;
      }

      // Hot: position is worse than 3 months ago (period2 avg vs period3 avg)
      const prev3mo = periods.period2?.position;
      const recent3mo = periods.period3?.position;
      if (prev3mo != null && recent3mo != null && recent3mo > prev3mo) {
        alerts.add('hot');
        hotCount++;
      }

      if (alerts.size > 0) {
        keywordAlerts.set(kwName, alerts);
      }
    }
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
      (keyword: any) => getEffectiveIntent(keyword.keyword, intentStore, keywordPages.get(keyword.keyword)?.[0]?.page, siteUrl, competitorBrands, aiIntents).intent === intentFilter
    );
  }

  // Alert filter
  if (activeAlert) {
    filteredKeywords = filteredKeywords.filter(
      (keyword: any) => keywordAlerts.get(keyword.keyword)?.has(activeAlert)
    );
  }

  // Group filter
  if (activeGroup) {
    const groupSet = new Set(activeGroup.keywords);
    filteredKeywords = filteredKeywords.filter(
      (keyword: any) => groupSet.has(keyword.keyword)
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
        aVal = searchVolumes.get(a.keyword.toLowerCase())?.avgMonthlySearches ?? -1;
        bVal = searchVolumes.get(b.keyword.toLowerCase())?.avgMonthlySearches ?? -1;
      } else if (sortColumn === 'intent') {
        aVal = getEffectiveIntent(a.keyword, intentStore, keywordPages.get(a.keyword)?.[0]?.page, siteUrl, competitorBrands, aiIntents).intent;
        bVal = getEffectiveIntent(b.keyword, intentStore, keywordPages.get(b.keyword)?.[0]?.page, siteUrl, competitorBrands, aiIntents).intent;
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
    setActiveAlert('');
    setActiveGroup(null);
    setShowGroupScan(false);
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

  const handleKeywordRowClick = (keyword: string) => {
    if (expandedKeyword === keyword) {
      setExpandedKeyword(null);
      return;
    }
    setExpandedKeyword(keyword);

    // All three fetches run in parallel
    if (!keywordPages.has(keyword)) {
      setLoadingPages((prev) => new Set(prev).add(keyword));
      (async () => {
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
                ctr: (() => { const raw = parseFloat(row.ctr || '0'); return raw > 1 ? raw : raw * 100; })(),
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
      })();
    }

    fetchKeywordHistory(keyword);

    if (!scanResults.has(keyword)) {
      (async () => {
        try {
          const recResp = await fetch(
            `${API_ENDPOINTS.db.recommendations}?siteUrl=${encodeURIComponent(siteUrl)}&keyword=${encodeURIComponent(keyword)}`
          );
          if (recResp.ok) {
            const recData = await recResp.json();
            if (recData.recommendation?.scanResult) {
              setScanResults((prev) => new Map(prev).set(keyword, recData.recommendation.scanResult));
            }
          }
        } catch {
          // Non-critical — user can still scan manually
        }
      })();
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

  const handleScanRecommendations = async (keyword: string, rescan = false) => {
    if (!rescan && scanResults.has(keyword)) return;

    const pages = keywordPages.get(keyword) || [];
    if (pages.length === 0) return;

    if (rescan) {
      setScanResults((prev) => { const m = new Map(prev); m.delete(keyword); return m; });
    }

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

      {/* Loading Status Bar — visible while background data is still loading */}
      {(loadingVolumes || loadingAlerts || loadingAiIntents) && (
        <LoadingStatusBar
          steps={[
            { label: 'Keyword rankings', status: 'done' },
            { label: 'Search volumes', status: loadingVolumes ? 'loading' : 'done' },
            { label: 'Keyword alerts', status: loadingAlerts ? 'loading' : 'done' },
            { label: 'AI intent classification', status: loadingAiIntents ? 'loading' : 'done' },
          ]}
        />
      )}

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

        {/* Avg. Position */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-apple-sm font-medium text-apple-text-secondary uppercase tracking-wide">
              Avg. Position
            </h3>
            <button
              onClick={() => setShowRankedKeywordsChart(!showRankedKeywordsChart)}
              className="text-apple-sm text-apple-blue hover:underline"
            >
              {showRankedKeywordsChart ? 'Hide Chart' : 'Show Chart'}
            </button>
          </div>
          {showRankedKeywordsChart ? (
            <LineChart data={data.current.positionHistory} compareData={data.compare?.positionHistory} title="" yAxisLabel="Position" invertY />
          ) : (
            (() => {
              const positions = data.current.keywords.filter((k: any) => k.position != null);
              const avg = positions.length > 0
                ? positions.reduce((s: number, k: any) => s + (k.position || 0), 0) / positions.length
                : null;
              const comparePositions = data.compare?.keywords?.filter((k: any) => k.position != null);
              const compareAvg = comparePositions && comparePositions.length > 0
                ? comparePositions.reduce((s: number, k: any) => s + (k.position || 0), 0) / comparePositions.length
                : null;
              return (
                <div>
                  <div className={`text-apple-hero font-bold tracking-tight ${avg != null ? 'text-apple-text' : 'text-apple-text-tertiary'}`}>
                    {avg != null ? avg.toFixed(1) : 'N/A'}
                  </div>
                  {compareAvg != null && (
                    <div className="text-apple-xs text-apple-text-tertiary mt-1">
                      Compare: {compareAvg.toFixed(1)}
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>
      </div>

      {/* Keyword Table */}
      <div className="card p-6">
        <div className="mb-6">
          <h3 className="text-apple-body font-semibold text-apple-text mb-4">
            Keyword Rankings
          </h3>
        </div>

        <div className="mb-6">
          {/* Alerts Bar */}
          {(fireCount > 0 || smokingCount > 0 || hotCount > 0 || loadingAlerts) && (
            <div className="mb-4 rounded-apple-sm border border-apple-divider bg-white overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-2 border-b border-apple-divider bg-apple-fill-secondary">
                <svg className="w-4 h-4 text-apple-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-apple-xs font-semibold text-apple-text-secondary uppercase tracking-wider">
                  Alerts
                </span>
                {loadingAlerts && (
                  <div className="w-3 h-3 border-2 border-apple-blue border-t-transparent rounded-full animate-spin ml-1" />
                )}
                {activeAlert && (
                  <button
                    onClick={() => { setActiveAlert(''); setCurrentPage(1); }}
                    className="ml-auto text-apple-xs text-apple-blue hover:underline"
                  >
                    Clear alert filter
                  </button>
                )}
              </div>
              <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
                {/* Fire */}
                <button
                  onClick={() => { setActiveAlert(activeAlert === 'fire' ? '' : 'fire'); setCurrentPage(1); }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-apple-sm border text-apple-sm font-medium transition-all duration-200 ${
                    activeAlert === 'fire'
                      ? 'bg-red-50 border-red-300 text-red-700 shadow-sm'
                      : 'border-apple-divider text-apple-text-secondary hover:bg-red-50/50 hover:border-red-200'
                  } ${fireCount === 0 ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
                  disabled={fireCount === 0}
                >
                  <span className="text-base">🔥</span>
                  <span>Fire</span>
                  <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-apple-xs font-bold ${
                    fireCount > 0 ? 'bg-red-100 text-red-700' : 'bg-apple-fill-secondary text-apple-text-tertiary'
                  }`}>
                    {fireCount}
                  </span>
                </button>

                {/* Smoking */}
                <button
                  onClick={() => { setActiveAlert(activeAlert === 'smoking' ? '' : 'smoking'); setCurrentPage(1); }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-apple-sm border text-apple-sm font-medium transition-all duration-200 ${
                    activeAlert === 'smoking'
                      ? 'bg-orange-50 border-orange-300 text-orange-700 shadow-sm'
                      : 'border-apple-divider text-apple-text-secondary hover:bg-orange-50/50 hover:border-orange-200'
                  } ${smokingCount === 0 ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
                  disabled={smokingCount === 0}
                >
                  <span className="text-base">💨</span>
                  <span>Smoking</span>
                  <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-apple-xs font-bold ${
                    smokingCount > 0 ? 'bg-orange-100 text-orange-700' : 'bg-apple-fill-secondary text-apple-text-tertiary'
                  }`}>
                    {smokingCount}
                  </span>
                </button>

                {/* Hot */}
                <button
                  onClick={() => { setActiveAlert(activeAlert === 'hot' ? '' : 'hot'); setCurrentPage(1); }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-apple-sm border text-apple-sm font-medium transition-all duration-200 ${
                    activeAlert === 'hot'
                      ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-sm'
                      : 'border-apple-divider text-apple-text-secondary hover:bg-amber-50/50 hover:border-amber-200'
                  } ${hotCount === 0 ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
                  disabled={hotCount === 0}
                >
                  <span className="text-base">🌡️</span>
                  <span>Hot</span>
                  <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-apple-xs font-bold ${
                    hotCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-apple-fill-secondary text-apple-text-tertiary'
                  }`}>
                    {hotCount}
                  </span>
                </button>

                {/* Legend */}
                <div className="ml-auto text-apple-xs text-apple-text-tertiary hidden md:block">
                  <span className="mr-3">🔥 Dropped from top 10</span>
                  <span className="mr-3">💨 Dropped from top 5</span>
                  <span>🌡️ Declining last 3 months</span>
                </div>
              </div>
            </div>
          )}

          {/* Groups Bar */}
          <div className="mb-4 rounded-apple-sm border border-apple-divider bg-white overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-apple-divider bg-apple-fill-secondary">
              <svg className="w-4 h-4 text-apple-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="text-apple-xs font-semibold text-apple-text-secondary uppercase tracking-wider">
                Groups
              </span>
              {activeGroup && (
                <button
                  onClick={() => { setActiveGroup(null); setShowGroupScan(false); setCurrentPage(1); }}
                  className="ml-auto text-apple-xs text-apple-blue hover:underline"
                >
                  Clear group filter
                </button>
              )}
            </div>
            <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
              {groups.map((group) => (
                <div key={group.id} className="relative group/grp inline-flex">
                  <button
                    onClick={() => {
                      if (activeGroup?.id === group.id) {
                        setActiveGroup(null);
                        setShowGroupScan(false);
                      } else {
                        setActiveGroup(group);
                        setShowGroupScan(false);
                      }
                      setCurrentPage(1);
                    }}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-apple-sm border text-apple-sm font-medium transition-all duration-200 ${
                      activeGroup?.id === group.id
                        ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
                        : 'border-apple-divider text-apple-text-secondary hover:bg-blue-50/50 hover:border-blue-200'
                    }`}
                  >
                    <span>{group.name}</span>
                    <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-apple-xs font-bold ${
                      group.keywords.length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-apple-fill-secondary text-apple-text-tertiary'
                    }`}>
                      {group.keywords.length}
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete group "${group.name}"?`)) deleteGroup(group.id);
                    }}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center opacity-0 group-hover/grp:opacity-100 transition-opacity hover:bg-red-600"
                    title="Delete group"
                  >
                    ×
                  </button>
                </div>
              ))}

              {/* Create Group */}
              {showCreateGroup ? (
                <div className="inline-flex items-center gap-1">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newGroupName.trim()) createGroup(newGroupName.trim());
                      if (e.key === 'Escape') { setShowCreateGroup(false); setNewGroupName(''); }
                    }}
                    placeholder="Group name..."
                    className="px-3 py-1.5 text-apple-sm border border-apple-border rounded-apple-sm w-36 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue"
                    autoFocus
                  />
                  <button
                    onClick={() => { if (newGroupName.trim()) createGroup(newGroupName.trim()); }}
                    className="px-2 py-1.5 text-apple-sm font-medium text-apple-blue hover:bg-blue-50 rounded-apple-sm transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setShowCreateGroup(false); setNewGroupName(''); }}
                    className="px-2 py-1.5 text-apple-sm text-apple-text-tertiary hover:text-apple-text-secondary transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-apple-sm border border-dashed border-apple-divider text-apple-xs font-medium text-apple-text-tertiary hover:border-apple-blue hover:text-apple-blue transition-all duration-200"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  New Group
                </button>
              )}
            </div>
          </div>

          {/* Group Overview & Scan */}
          {activeGroup && (
            <div className="mb-4 rounded-apple-sm border border-blue-200 bg-blue-50/30 overflow-hidden">
              {/* Group Overview Stats */}
              {(() => {
                const groupKws = data.current.keywords.filter((k: any) =>
                  activeGroup.keywords.includes(k.keyword)
                );
                const totalImpressions = groupKws.reduce((s: number, k: any) => s + (k.impressions || 0), 0);
                const totalClicks = groupKws.reduce((s: number, k: any) => s + (k.clicks || 0), 0);
                const validPositions = groupKws.filter((k: any) => k.position != null);
                const avgPosition = validPositions.length > 0
                  ? validPositions.reduce((s: number, k: any) => s + k.position, 0) / validPositions.length
                  : null;

                return (
                  <div className="px-4 py-3 flex items-center gap-6 border-b border-blue-200">
                    <div className="flex items-center gap-2">
                      <span className="text-apple-xs font-semibold text-blue-700 uppercase tracking-wider">
                        {activeGroup.name}
                      </span>
                      <span className="text-apple-xs text-blue-600">
                        {groupKws.length} keywords
                      </span>
                    </div>
                    <div className="flex items-center gap-4 ml-auto">
                      <div className="text-right">
                        <div className="text-apple-xs text-apple-text-tertiary">Impressions</div>
                        <div className="text-apple-sm font-semibold text-apple-text">{totalImpressions.toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-apple-xs text-apple-text-tertiary">Clicks</div>
                        <div className="text-apple-sm font-semibold text-apple-text">{totalClicks.toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-apple-xs text-apple-text-tertiary">Avg. Position</div>
                        <div className="text-apple-sm font-semibold text-apple-text">
                          {avgPosition !== null ? avgPosition.toFixed(1) : '—'}
                        </div>
                      </div>
                      <button
                        onClick={() => setShowGroupScan(!showGroupScan)}
                        className={`ml-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-apple-pill text-apple-sm font-medium transition-all duration-200 ${
                          showGroupScan
                            ? 'bg-white border border-apple-blue text-apple-blue'
                            : 'bg-apple-blue text-white hover:bg-apple-blue-hover shadow-sm'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        {showGroupScan ? 'Hide Scan' : 'Scan Group'}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Group Scan Panel */}
              {showGroupScan && (
                <div className="p-4">
                  <GroupRecommendations
                    groupName={activeGroup.name}
                    keywords={activeGroup.keywords}
                    siteUrl={siteUrl}
                    keywordPages={keywordPages}
                    cachedScanResults={scanResults}
                    onScanResultsUpdate={(results) => {
                      setScanResults(new Map([...scanResults, ...results]));
                    }}
                    searchVolumes={searchVolumes}
                  />
                </div>
              )}
            </div>
          )}

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
            {/* Add to Group — selected keywords or all filtered results */}
            {groups.length > 0 && (selectedKeywords.size > 0 || (searchTerm && filteredKeywords.length > 0)) && (
              <div className="relative">
                <button
                  onClick={() => { setShowAddToGroup(!showAddToGroup); if (showAddToGroup) setAddToGroupKeywords(new Set()); }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-apple-sm font-medium rounded-apple-sm border border-apple-border text-apple-text-secondary hover:bg-apple-fill-secondary transition-all duration-200"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Add to Group
                </button>
                {showAddToGroup && (
                  <div className="absolute z-50 mt-1 right-0 w-56 bg-white rounded-apple-sm border border-apple-divider shadow-lg overflow-hidden">
                    {/* Mode selector: selected keywords vs all filtered */}
                    {selectedKeywords.size > 0 && searchTerm && filteredKeywords.length > selectedKeywords.size && (
                      <div className="px-3 py-2 border-b border-apple-divider bg-apple-fill-secondary">
                        <div className="text-apple-xs text-apple-text-tertiary font-medium mb-1">Add keywords:</div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setAddToGroupKeywords(new Set(selectedKeywords))}
                            className={`px-2 py-1 text-apple-xs rounded-apple-sm transition-colors ${
                              addToGroupKeywords.size > 0 && addToGroupKeywords.size === selectedKeywords.size
                                ? 'bg-apple-blue text-white' : 'bg-white border border-apple-divider text-apple-text-secondary hover:bg-apple-fill-secondary'
                            }`}
                          >
                            Selected ({selectedKeywords.size})
                          </button>
                          <button
                            onClick={() => setAddToGroupKeywords(new Set(filteredKeywords.map((k: any) => k.keyword)))}
                            className={`px-2 py-1 text-apple-xs rounded-apple-sm transition-colors ${
                              addToGroupKeywords.size === filteredKeywords.length
                                ? 'bg-apple-blue text-white' : 'bg-white border border-apple-divider text-apple-text-secondary hover:bg-apple-fill-secondary'
                            }`}
                          >
                            All results ({filteredKeywords.length})
                          </button>
                        </div>
                      </div>
                    )}
                    {groups.map((group) => {
                      const kwsToAdd = addToGroupKeywords.size > 0
                        ? [...addToGroupKeywords]
                        : selectedKeywords.size > 0
                        ? [...selectedKeywords]
                        : filteredKeywords.map((k: any) => k.keyword);
                      return (
                        <button
                          key={group.id}
                          onClick={() => {
                            addKeywordsToGroup(group.id, kwsToAdd);
                            setAddToGroupKeywords(new Set());
                          }}
                          className="w-full text-left px-4 py-2.5 text-apple-sm text-apple-text-secondary hover:bg-apple-fill-secondary transition-colors flex items-center justify-between"
                        >
                          <span>{group.name}</span>
                          <span className="text-apple-xs text-apple-text-tertiary">{group.keywords.length}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {selectedKeywords.size > 0 && appliedFilter.size === 0 && (
              <button onClick={applyFilter} className="btn-primary text-apple-sm">
                Apply Filter ({selectedKeywords.size})
              </button>
            )}
            {(appliedFilter.size > 0 || intentFilter || activeAlert || activeGroup) && (
              <button onClick={clearFilter} className="btn-danger text-apple-sm">
                Clear Filters
              </button>
            )}
            {searchTerm && appliedFilter.size === 0 && !intentFilter && !activeAlert && !activeGroup && (
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
                      onRescanRecommendations={() => handleScanRecommendations(keyword.keyword, true)}
                      history={keywordHistory.get(keyword.keyword) || null}
                      loadingHistory={loadingHistory.has(keyword.keyword)}
                      siteUrl={siteUrl}
                      volume={searchVolumes.get(keyword.keyword.toLowerCase()) || null}
                      intentStore={intentStore}
                      onIntentOverride={handleIntentOverride}
                      activeGroupId={activeGroup?.id || null}
                      onRemoveFromGroup={activeGroup ? (kw: string) => removeKeywordFromGroup(activeGroup.id, kw) : undefined}
                      isNew={newKeywords.has(keyword.keyword)}
                      competitorBrands={competitorBrands}
                      aiIntents={aiIntents}
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
/*  Loading Status Bar                                                 */
/* ------------------------------------------------------------------ */

interface StatusStep {
  label: string;
  status: 'pending' | 'loading' | 'done';
}

function LoadingStatusBar({ steps }: { steps: StatusStep[] }) {
  const doneCount = steps.filter((s) => s.status === 'done').length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const currentStep = steps.find((s) => s.status === 'loading');

  return (
    <div className="rounded-apple-sm border border-apple-divider bg-white overflow-hidden">
      {/* Progress bar */}
      <div className="h-1 bg-apple-divider">
        <div
          className="h-full bg-apple-blue transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="px-5 py-3 flex items-center gap-4">
        {/* Spinner for active step */}
        {currentStep && (
          <div className="w-5 h-5 border-2 border-apple-blue border-t-transparent rounded-full animate-spin flex-shrink-0" />
        )}

        {/* Steps */}
        <div className="flex items-center gap-5 flex-1">
          {steps.map((step) => (
            <div key={step.label} className="flex items-center gap-1.5">
              {step.status === 'done' ? (
                <svg className="w-3.5 h-3.5 text-apple-green flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : step.status === 'loading' ? (
                <div className="w-3.5 h-3.5 flex-shrink-0" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-apple-divider flex-shrink-0" />
              )}
              <span className={`text-apple-xs font-medium whitespace-nowrap ${
                step.status === 'done'
                  ? 'text-apple-green'
                  : step.status === 'loading'
                  ? 'text-apple-blue'
                  : 'text-apple-text-tertiary'
              }`}>
                {step.label}
                {step.status === 'loading' && (
                  <span className="text-apple-text-tertiary font-normal ml-1">loading...</span>
                )}
              </span>
            </div>
          ))}
        </div>

        {/* Percentage */}
        <span className="text-apple-xs text-apple-text-tertiary font-medium flex-shrink-0">
          {pct}%
        </span>
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
/*                                                                     */
/*  Strategy: classify using BOTH keyword text patterns AND the        */
/*  ranking page URL. If the ranking page is a product/tool page       */
/*  (not a blog/guide), the keyword is likely Transactional even       */
/*  if the keyword text doesn't contain "buy" or "price."             */
/* ------------------------------------------------------------------ */

export type KeywordIntent = 'Transactional' | 'Product' | 'Educational' | 'Navigational' | 'Local' | 'Branded' | 'Competitor Navigational' | 'Competitor Transactional';

/**
 * Classify keyword intent using a multi-signal approach:
 * 1. Strong text patterns (high-confidence overrides)
 * 2. Page-type inference from the ranking URL
 * 3. Weaker text patterns for remaining keywords
 *
 * @param keyword          The search query
 * @param rankingUrl       The top ranking page URL (optional — improves accuracy)
 * @param siteUrl          The site's base URL (optional — used to detect brand terms)
 * @param competitorBrands Lowercase brand names of known competitors (optional)
 */
function classifyKeywordIntent(keyword: string, rankingUrl?: string, siteUrl?: string, competitorBrands?: string[]): KeywordIntent {
  const kw = keyword.toLowerCase();

  // -----------------------------------------------------------
  // 1. HIGH-CONFIDENCE TEXT PATTERNS (checked first)
  // -----------------------------------------------------------

  // Local — very specific signals
  if (/\b(near me|nearby|in my area|directions|hours|open now|closest)\b/i.test(kw)) {
    return 'Local';
  }

  // Branded — keyword contains the site's own brand name
  if (siteUrl) {
    const brand = extractBrand(siteUrl);
    if (brand && kw.includes(brand.toLowerCase())) {
      return 'Branded';
    }
  }

  // Competitor — keyword contains a known competitor brand name
  if (competitorBrands && competitorBrands.length > 0) {
    const matchedCompetitor = competitorBrands.some((cb) => kw.includes(cb));
    if (matchedCompetitor) {
      if (/\b(buy|purchase|order|pricing|price|discount|coupon|subscribe|sign up|signup|free trial|demo|plans?|alternative|switch|cancel|vs\.?|versus)\b/i.test(kw)) {
        return 'Competitor Transactional';
      }
      return 'Competitor Navigational';
    }
  }

  // Navigational — generic site-specific navigation
  if (/\b(login|log in|sign in|signin|website|official site|dashboard|portal|my account)\b/i.test(kw)) {
    return 'Navigational';
  }

  // Explicit transactional — user wants to act/purchase/use
  if (/\b(buy|purchase|order|deal|deals|discount|coupon|pricing|price|cheap|cost|hire|book now|subscribe|shop|for sale|free trial|sign up|signup|get started|quote|try free|start free|demo|get a quote|affordable|monthly|yearly|per month|plans?)\b/i.test(kw)) {
    return 'Transactional';
  }

  // Product/commercial investigation — comparing, evaluating
  if (/\b(best|top \d|review|reviews|compare|comparison|vs\.?|versus|alternative|alternatives|pros and cons|features|rating|ratings|benchmark|worth it|better than)\b/i.test(kw)) {
    return 'Product';
  }

  // -----------------------------------------------------------
  // 2. PAGE-TYPE INFERENCE FROM RANKING URL
  //    If the page that ranks is a tool/app/product page (not a
  //    blog post or educational guide), the keyword is likely
  //    Transactional — the user wants to USE the product.
  // -----------------------------------------------------------

  if (rankingUrl) {
    const path = rankingUrl.toLowerCase();

    // Product/tool pages — Transactional
    if (isProductPage(path)) {
      // But if the keyword itself is clearly educational, respect that
      if (/\b(how to|what is|what are|why do|when to|guide|tutorial|learn|meaning|definition|explained)\b/i.test(kw)) {
        return 'Educational';
      }
      return 'Transactional';
    }

    // Blog/educational pages
    if (isBlogPage(path)) {
      // Blog pages with product keywords still indicate Product intent
      if (/\b(calculator|tool|software|app|platform|analyzer|estimator|generator|tracker|finder|checker|planner)\b/i.test(kw)) {
        return 'Product';
      }
      return 'Educational';
    }
  }

  // -----------------------------------------------------------
  // 3. TOOL/PRODUCT KEYWORDS — these indicate Transactional
  //    intent because the user wants to USE a tool
  // -----------------------------------------------------------

  if (/\b(calculator|tool|software|app|platform|analyzer|estimator|generator|planner|tracker|finder|checker|widget|spreadsheet|template)\b/i.test(kw)) {
    // "how to use X calculator" = Educational, "X calculator" = Transactional
    if (/\b(how|what|why|guide|tutorial|learn|tips)\b/i.test(kw)) {
      return 'Educational';
    }
    return 'Transactional';
  }

  // -----------------------------------------------------------
  // 4. WEAKER EDUCATIONAL PATTERNS (fallback)
  // -----------------------------------------------------------

  if (/\b(how to|what is|what are|why do|why does|when to|when should|where to|who is|which|guide|tutorial|tips|learn|examples?|definition|meaning|explained|basics|beginner|ways to|steps to|can you|should i|do i need)\b/i.test(kw)) {
    return 'Educational';
  }

  // -----------------------------------------------------------
  // 5. LOCAL — city/state patterns
  // -----------------------------------------------------------
  if (/\bin\s+[A-Z][a-z]+/.test(keyword)) {
    return 'Local';
  }

  // -----------------------------------------------------------
  // 6. DEFAULT — use page URL if available, otherwise Educational
  // -----------------------------------------------------------

  if (rankingUrl) {
    const path = rankingUrl.toLowerCase();
    if (isProductPage(path)) return 'Transactional';
    if (isBlogPage(path)) return 'Educational';
  }

  return 'Educational';
}

/** Extract a likely brand name from a URL (e.g. "bnbcalc" from "https://bnbcalc.com") */
function extractBrand(siteUrl: string): string | null {
  try {
    const host = new URL(siteUrl.replace(/\/$/, '')).hostname;
    // Remove www. and TLD
    const parts = host.replace('www.', '').split('.');
    return parts[0] || null;
  } catch {
    return null;
  }
}

/** Check if a URL path looks like a product/tool/app page */
function isProductPage(path: string): boolean {
  // Common product/tool page patterns
  const productPatterns = [
    /^\/?$/, // homepage is usually the product
    /\/(calculator|tool|analyze|analysis|app|dashboard|estimate|report|pricing|plans|signup|register|demo|try)/,
    /\/(product|features|solutions|platform)/,
  ];
  // Must NOT match blog patterns
  if (isBlogPage(path)) return false;
  return productPatterns.some((p) => p.test(path));
}

/** Check if a URL path looks like a blog/educational page */
function isBlogPage(path: string): boolean {
  return /\/(blog|article|post|news|guide|learn|resource|help|faq|wiki|knowledge|how-to|tips|insights|library|education|regulation|rules|laws)/.test(path);
}

const INTENT_COLORS: Record<KeywordIntent, { bg: string; text: string }> = {
  Transactional: { bg: 'bg-green-50', text: 'text-green-700' },
  Product: { bg: 'bg-purple-50', text: 'text-purple-700' },
  Educational: { bg: 'bg-blue-50', text: 'text-blue-700' },
  Navigational: { bg: 'bg-orange-50', text: 'text-orange-700' },
  Local: { bg: 'bg-rose-50', text: 'text-rose-700' },
  Branded: { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  'Competitor Navigational': { bg: 'bg-amber-50', text: 'text-amber-700' },
  'Competitor Transactional': { bg: 'bg-teal-50', text: 'text-teal-700' },
};

const ALL_INTENTS: KeywordIntent[] = [
  'Transactional', 'Product', 'Educational', 'Navigational', 'Local',
  'Branded', 'Competitor Navigational', 'Competitor Transactional',
];

/* ------------------------------------------------------------------ */
/*  Intent Learning Engine                                             */
/*  Persists user overrides + learned patterns in localStorage.       */
/*  When a keyword is reclassified, similar keywords get the same     */
/*  intent via token-based pattern matching.                          */
/* ------------------------------------------------------------------ */

interface LearnedRule {
  tokens: string[];      // keyword tokens that trigger this rule
  intent: KeywordIntent;
  source: string;        // the keyword the user explicitly reclassified
}

interface IntentStore {
  exactOverrides: Record<string, KeywordIntent>;
  learnedRules: LearnedRule[];
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'is',
  'it', 'my', 'i', 'me', 'we', 'our', 'you', 'your', 'do', 'does', 'can',
  'with', 'from', 'by', 'as', 'be', 'this', 'that', 'are', 'was', 'were',
]);

function getStoreKey(siteUrl: string): string {
  return `intent-overrides:${siteUrl}`;
}

function loadIntentStore(siteUrl: string): IntentStore {
  try {
    const raw = localStorage.getItem(getStoreKey(siteUrl));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { exactOverrides: {}, learnedRules: [] };
}

function saveIntentStore(siteUrl: string, store: IntentStore): void {
  try {
    localStorage.setItem(getStoreKey(siteUrl), JSON.stringify(store));
  } catch { /* ignore */ }
}

/** Extract significant tokens from a keyword (no stop words, 2+ chars) */
function extractTokens(keyword: string): string[] {
  return keyword
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

/**
 * When a user reclassifies a keyword:
 * 1. Save the exact override
 * 2. Extract tokens and create a learned rule
 * 3. Remove conflicting rules for those tokens
 * 4. Return the set of other keywords that should be re-classified
 */
function learnIntentOverride(
  siteUrl: string,
  keyword: string,
  newIntent: KeywordIntent,
  allKeywords: string[]
): { store: IntentStore; affected: Map<string, KeywordIntent> } {
  const store = loadIntentStore(siteUrl);

  // 1. Save exact override
  store.exactOverrides[keyword] = newIntent;

  // 2. Extract significant tokens
  const tokens = extractTokens(keyword);

  if (tokens.length > 0) {
    // Remove any existing rule from this exact source keyword
    store.learnedRules = store.learnedRules.filter((r) => r.source !== keyword);

    // Add new learned rule
    store.learnedRules.push({ tokens, intent: newIntent, source: keyword });
  }

  // 3. Find all similar keywords that match the learned tokens
  const affected = new Map<string, KeywordIntent>();
  if (tokens.length > 0) {
    for (const kw of allKeywords) {
      if (kw === keyword) continue;
      if (store.exactOverrides[kw]) continue; // don't override explicit user choices

      const kwTokens = extractTokens(kw);
      // A keyword matches if it shares at least half the rule tokens (min 1)
      const matchThreshold = Math.max(1, Math.ceil(tokens.length * 0.5));
      const matchCount = tokens.filter((t) => kwTokens.includes(t)).length;

      if (matchCount >= matchThreshold) {
        store.exactOverrides[kw] = newIntent;
        affected.set(kw, newIntent);
      }
    }
  }

  saveIntentStore(siteUrl, store);
  return { store, affected };
}

/**
 * Get the effective intent for a keyword, checking:
 * 1. Exact user override
 * 2. Learned rule match
 * 3. Auto-classifier (fallback)
 */
function getEffectiveIntent(
  keyword: string,
  store: IntentStore,
  rankingUrl?: string,
  siteUrl?: string,
  competitorBrands?: string[],
  aiClassifications?: Record<string, KeywordIntent>
): { intent: KeywordIntent; source: 'override' | 'learned' | 'ai' | 'auto' } {
  // 1. Exact user override (always wins)
  if (store.exactOverrides[keyword]) {
    return { intent: store.exactOverrides[keyword], source: 'override' };
  }

  // 2. Learned rule match from user overrides
  const kwTokens = extractTokens(keyword);
  for (const rule of store.learnedRules) {
    const matchThreshold = Math.max(1, Math.ceil(rule.tokens.length * 0.5));
    const matchCount = rule.tokens.filter((t) => kwTokens.includes(t)).length;
    if (matchCount >= matchThreshold) {
      return { intent: rule.intent, source: 'learned' };
    }
  }

  // 3. AI classification (uses business objectives context)
  if (aiClassifications) {
    const aiIntent = aiClassifications[keyword.toLowerCase()];
    if (aiIntent) {
      return { intent: aiIntent, source: 'ai' };
    }
  }

  // 4. Regex-based fallback
  return { intent: classifyKeywordIntent(keyword, rankingUrl, siteUrl, competitorBrands), source: 'auto' };
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
  scanResult,
  isLoadingRecs,
  recsError,
  onScanRecommendations,
  onRescanRecommendations,
  history,
  loadingHistory,
  siteUrl,
  volume,
  intentStore,
  onIntentOverride,
  activeGroupId,
  onRemoveFromGroup,
  isNew,
  competitorBrands,
  aiIntents,
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
  onRescanRecommendations: () => void;
  history: MonthlyPosition[] | null;
  loadingHistory: boolean;
  siteUrl: string;
  volume: { avgMonthlySearches: number | null; competition: string | null; competitionIndex: number | null } | null;
  intentStore: IntentStore;
  onIntentOverride: (keyword: string, intent: KeywordIntent) => void;
  activeGroupId: number | null;
  onRemoveFromGroup?: (keyword: string) => void;
  isNew: boolean;
  competitorBrands: string[];
  aiIntents: Record<string, KeywordIntent>;
}) {
  const [showIntentPicker, setShowIntentPicker] = useState(false);
  const [taskToggleCounter, setTaskToggleCounter] = useState(0);
  const [activeTab, setActiveTab] = useState<'recommendations' | 'activity'>('recommendations');
  const intentPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showIntentPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (intentPickerRef.current && !intentPickerRef.current.contains(e.target as Node)) {
        setShowIntentPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showIntentPicker]);

  return (
    <>
      <tr
        className={`group/row border-b border-apple-divider cursor-pointer transition-colors duration-150 ${
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
            {isNew && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-apple-pill text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700">
                New
              </span>
            )}
            {activeGroupId && onRemoveFromGroup && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFromGroup(keyword.keyword);
                }}
                className="opacity-0 group-hover/row:opacity-100 inline-flex items-center justify-center w-5 h-5 rounded-full text-red-400 hover:text-white hover:bg-red-500 transition-all duration-150"
                title="Remove from group"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
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
        <td className="px-6 py-3.5" onClick={(e) => e.stopPropagation()}>
          {(() => {
            const { intent, source } = getEffectiveIntent(keyword.keyword, intentStore, pages[0]?.page, siteUrl, competitorBrands, aiIntents);
            const colors = INTENT_COLORS[intent];
            return (
              <div className="relative" ref={intentPickerRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowIntentPicker(!showIntentPicker);
                  }}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-apple-pill text-apple-xs font-medium ${colors.bg} ${colors.text} hover:opacity-80 transition-opacity cursor-pointer`}
                  title={
                    source === 'override' ? 'Manually set — click to change'
                    : source === 'learned' ? 'Learned from similar keyword — click to change'
                    : source === 'ai' ? 'Classified by AI using your objectives — click to change'
                    : 'Auto-classified — click to change'
                  }
                >
                  {intent}
                  {source === 'ai' && (
                    <svg className="w-2.5 h-2.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  )}
                  {(source === 'override' || source === 'learned') && (
                    <svg className="w-2.5 h-2.5 opacity-60" fill="currentColor" viewBox="0 0 20 20">
                      <circle cx="10" cy="10" r="4" />
                    </svg>
                  )}
                  <svg className="w-2.5 h-2.5 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showIntentPicker && (
                  <div className="absolute z-50 mt-1 left-0 w-40 bg-white rounded-apple-sm border border-apple-divider shadow-lg overflow-hidden">
                    {ALL_INTENTS.map((intentOption) => {
                      const optColors = INTENT_COLORS[intentOption];
                      const isActive = intentOption === intent;
                      return (
                        <button
                          key={intentOption}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isActive) {
                              onIntentOverride(keyword.keyword, intentOption);
                            }
                            setShowIntentPicker(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-apple-xs font-medium flex items-center gap-2 transition-colors ${
                            isActive ? 'bg-apple-fill-secondary' : 'hover:bg-apple-fill-secondary'
                          }`}
                        >
                          <span className={`inline-block w-2 h-2 rounded-full`} style={{ backgroundColor: {
                            Transactional: '#15803d', Product: '#7e22ce', Educational: '#1d4ed8',
                            Navigational: '#c2410c', Local: '#be123c', Branded: '#4338ca',
                            'Competitor Navigational': '#b45309', 'Competitor Transactional': '#0d9488',
                          }[intentOption] || '#6b7280' }} />
                          {intentOption}
                          {isActive && <span className="ml-auto text-apple-blue">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
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
            {/* Tab Bar */}
            <tr className="bg-apple-fill-secondary">
              <td colSpan={colSpan} className="px-6 py-0">
                <div className="flex gap-6 border-b border-apple-divider">
                  <button
                    onClick={(e) => { e.stopPropagation(); setActiveTab('recommendations'); }}
                    className={`py-2.5 text-apple-sm font-medium border-b-2 -mb-px transition-colors ${
                      activeTab === 'recommendations'
                        ? 'border-apple-blue text-apple-blue'
                        : 'border-transparent text-apple-text-tertiary hover:text-apple-text-secondary'
                    }`}
                  >
                    Recommendations
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setActiveTab('activity'); }}
                    className={`py-2.5 text-apple-sm font-medium border-b-2 -mb-px transition-colors ${
                      activeTab === 'activity'
                        ? 'border-apple-blue text-apple-blue'
                        : 'border-transparent text-apple-text-tertiary hover:text-apple-text-secondary'
                    }`}
                  >
                    Activity Log
                  </button>
                </div>
              </td>
            </tr>

            {activeTab === 'recommendations' ? (
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
                  siteUrl={siteUrl}
                  taskToggleCounter={taskToggleCounter}
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
                  <div>
                    <div className="flex items-center justify-end mb-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRescanRecommendations();
                        }}
                        disabled={isLoadingRecs}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-apple-pill border border-apple-divider text-apple-xs font-medium text-apple-text-secondary hover:bg-white hover:border-apple-border transition-all duration-200 disabled:opacity-50"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Re-scan
                      </button>
                    </div>
                    <RecommendationsPanel
                      scanResult={scanResult}
                      keyword={keyword.keyword}
                      siteUrl={siteUrl}
                      onTaskToggle={() => setTaskToggleCounter((c) => c + 1)}
                    />
                  </div>
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
            ) : (
              <tr className="bg-apple-fill-secondary">
                <td colSpan={colSpan} className="px-6 py-3">
                  <ActivityLog keyword={keyword.keyword} siteUrl={siteUrl} />
                </td>
              </tr>
            )}
          </>
        );
      })()}
    </>
  );
}
