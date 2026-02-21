import { useState, useEffect } from 'react';
import { format, subMonths, subYears, startOfYear } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { authenticatedFetch } from '../services/authService';
import { API_ENDPOINTS } from '../config/api';
import type { DateRange } from '../types';

type TimePeriod = '6m' | '1y' | 'ytd' | '2y' | '3y' | '5y' | '10y' | 'custom';

const PERIOD_LABELS: Record<TimePeriod, string> = {
  '6m': '6 Months',
  '1y': '1 Year',
  'ytd': 'Year to Date',
  '2y': '2 Years',
  '3y': '3 Years',
  '5y': '5 Years',
  '10y': '10 Years',
  'custom': 'Custom',
};

interface DailyDataPoint {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface PageData {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface KeywordData {
  keyword: string;
  clicks: number;
  impressions: number;
  position: number;
}

interface OverviewViewProps {
  siteUrl: string;
  dateRange: DateRange | null;
  compareDateRange: DateRange | null;
}

function getDateRangeForPeriod(period: TimePeriod): { startDate: Date; endDate: Date } | null {
  const now = new Date();
  switch (period) {
    case '6m': return { startDate: subMonths(now, 6), endDate: now };
    case '1y': return { startDate: subYears(now, 1), endDate: now };
    case 'ytd': return { startDate: startOfYear(now), endDate: now };
    case '2y': return { startDate: subYears(now, 2), endDate: now };
    case '3y': return { startDate: subYears(now, 3), endDate: now };
    case '5y': return { startDate: subYears(now, 5), endDate: now };
    case '10y': return { startDate: subYears(now, 10), endDate: now };
    default: return null;
  }
}

export default function OverviewView({ siteUrl, dateRange, compareDateRange }: OverviewViewProps) {
  const [chartPeriod, setChartPeriod] = useState<TimePeriod>('1y');
  const [chartData, setChartData] = useState<DailyDataPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  const [currentStats, setCurrentStats] = useState<{
    impressions: number; clicks: number; keywords: number; avgPosition: number;
  } | null>(null);
  const [compareStats, setCompareStats] = useState<{
    impressions: number; clicks: number; keywords: number; avgPosition: number;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [topPages, setTopPages] = useState<{ byClicks: PageData[]; byImpressions: PageData[] }>({ byClicks: [], byImpressions: [] });
  const [topKeywords, setTopKeywords] = useState<{ byClicks: KeywordData[]; byImpressions: KeywordData[] }>({ byClicks: [], byImpressions: [] });
  const [pagesLoading, setPagesLoading] = useState(false);

  // Fetch chart data for selected period
  useEffect(() => {
    if (!siteUrl) return;

    const range = chartPeriod === 'custom' && dateRange
      ? { startDate: dateRange.startDate, endDate: dateRange.endDate }
      : getDateRangeForPeriod(chartPeriod);

    if (!range) return;

    const fetchChart = async () => {
      setChartLoading(true);
      try {
        const resp = await authenticatedFetch(API_ENDPOINTS.google.searchConsole.daily, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: format(range.startDate, 'yyyy-MM-dd'),
            endDate: format(range.endDate, 'yyyy-MM-dd'),
            siteUrl,
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          setChartData(data.dailyData || data.rows || []);
        }
      } catch { /* ignore */ }
      setChartLoading(false);
    };
    fetchChart();
  }, [siteUrl, chartPeriod, dateRange]);

  // Fetch current (and compare) period stats + top pages/keywords
  useEffect(() => {
    if (!siteUrl || !dateRange) return;

    const fetchStats = async () => {
      setStatsLoading(true);
      setPagesLoading(true);

      try {
        const startDate = format(dateRange.startDate, 'yyyy-MM-dd');
        const endDate = format(dateRange.endDate, 'yyyy-MM-dd');

        // Fetch keywords, pages, daily in parallel
        const [kwResp, pageResp] = await Promise.all([
          authenticatedFetch(API_ENDPOINTS.google.searchConsole.keywords, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate, endDate, siteUrl }),
          }),
          authenticatedFetch(`${API_ENDPOINTS.google.searchConsole.keywords}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate, endDate, siteUrl, dimension: 'page' }),
          }),
        ]);

        if (kwResp.ok) {
          const kwData = await kwResp.json();
          const keywords = kwData.keywords || [];
          const totalImpressions = keywords.reduce((s: number, k: any) => s + (k.impressions || 0), 0);
          const totalClicks = keywords.reduce((s: number, k: any) => s + (k.clicks || 0), 0);
          const validPos = keywords.filter((k: any) => k.position != null && k.position > 0);
          const avgPos = validPos.length > 0
            ? validPos.reduce((s: number, k: any) => s + k.position, 0) / validPos.length
            : 0;

          setCurrentStats({
            impressions: totalImpressions,
            clicks: totalClicks,
            keywords: keywords.length,
            avgPosition: avgPos,
          });

          // Top keywords
          const sortedByClicks = [...keywords].sort((a: any, b: any) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 10);
          const sortedByImpressions = [...keywords].sort((a: any, b: any) => (b.impressions || 0) - (a.impressions || 0)).slice(0, 10);
          setTopKeywords({ byClicks: sortedByClicks, byImpressions: sortedByImpressions });
        }

        if (pageResp.ok) {
          const pageData = await pageResp.json();
          const pages: PageData[] = (pageData.keywords || pageData.pages || []).map((p: any) => ({
            page: p.keyword || p.page || p.keys?.[0] || '',
            clicks: p.clicks || 0,
            impressions: p.impressions || 0,
            ctr: p.ctr || 0,
            position: p.position || 0,
          }));

          const byClicks = [...pages].sort((a, b) => b.clicks - a.clicks).slice(0, 10);
          const byImpressions = [...pages].sort((a, b) => b.impressions - a.impressions).slice(0, 10);
          setTopPages({ byClicks, byImpressions });
        }

        // Compare period
        if (compareDateRange) {
          try {
            const cmpResp = await authenticatedFetch(API_ENDPOINTS.google.searchConsole.keywords, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                startDate: format(compareDateRange.startDate, 'yyyy-MM-dd'),
                endDate: format(compareDateRange.endDate, 'yyyy-MM-dd'),
                siteUrl,
              }),
            });
            if (cmpResp.ok) {
              const cmpData = await cmpResp.json();
              const keywords = cmpData.keywords || [];
              const totalImpressions = keywords.reduce((s: number, k: any) => s + (k.impressions || 0), 0);
              const totalClicks = keywords.reduce((s: number, k: any) => s + (k.clicks || 0), 0);
              const validPos = keywords.filter((k: any) => k.position != null && k.position > 0);
              const avgPos = validPos.length > 0
                ? validPos.reduce((s: number, k: any) => s + k.position, 0) / validPos.length
                : 0;
              setCompareStats({
                impressions: totalImpressions,
                clicks: totalClicks,
                keywords: keywords.length,
                avgPosition: avgPos,
              });
            }
          } catch { /* ignore */ }
        } else {
          setCompareStats(null);
        }
      } catch { /* ignore */ }

      setStatsLoading(false);
      setPagesLoading(false);
    };
    fetchStats();
  }, [siteUrl, dateRange, compareDateRange]);

  const fmtNum = (n: number) => n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toLocaleString();

  const changePct = (current: number, compare: number) => {
    if (compare === 0) return current > 0 ? '+100%' : '0%';
    const pct = ((current - compare) / compare) * 100;
    return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
  };

  const changeColor = (current: number, compare: number, invert = false) => {
    const better = invert ? current < compare : current > compare;
    if (current === compare) return 'text-apple-text-tertiary';
    return better ? 'text-apple-green' : 'text-apple-red';
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-apple-title1 font-bold text-apple-text tracking-tight">Overview</h2>
        <p className="text-apple-base text-apple-text-secondary mt-1">
          Performance summary for your site
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          title="Impressions"
          value={currentStats ? fmtNum(currentStats.impressions) : '–'}
          compare={compareStats ? changePct(currentStats?.impressions || 0, compareStats.impressions) : undefined}
          compareColor={compareStats ? changeColor(currentStats?.impressions || 0, compareStats.impressions) : undefined}
          loading={statsLoading}
        />
        <KPICard
          title="Clicks"
          value={currentStats ? fmtNum(currentStats.clicks) : '–'}
          compare={compareStats ? changePct(currentStats?.clicks || 0, compareStats.clicks) : undefined}
          compareColor={compareStats ? changeColor(currentStats?.clicks || 0, compareStats.clicks) : undefined}
          loading={statsLoading}
        />
        <KPICard
          title="Ranked Keywords"
          value={currentStats ? fmtNum(currentStats.keywords) : '–'}
          compare={compareStats ? changePct(currentStats?.keywords || 0, compareStats.keywords) : undefined}
          compareColor={compareStats ? changeColor(currentStats?.keywords || 0, compareStats.keywords) : undefined}
          loading={statsLoading}
        />
        <KPICard
          title="Avg. Position"
          value={currentStats ? currentStats.avgPosition.toFixed(1) : '–'}
          compare={compareStats ? changePct(currentStats?.avgPosition || 0, compareStats.avgPosition) : undefined}
          compareColor={compareStats ? changeColor(currentStats?.avgPosition || 0, compareStats.avgPosition, true) : undefined}
          loading={statsLoading}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <ChartCard title="Impressions" data={chartData} dataKey="impressions" color="#0071E3" period={chartPeriod} onPeriodChange={setChartPeriod} loading={chartLoading} />
        <ChartCard title="Clicks" data={chartData} dataKey="clicks" color="#34C759" period={chartPeriod} onPeriodChange={setChartPeriod} loading={chartLoading} />
        <ChartCard title="Average Position" data={chartData} dataKey="position" color="#FF9500" period={chartPeriod} onPeriodChange={setChartPeriod} loading={chartLoading} inverted />
        <ChartCard title="CTR" data={chartData} dataKey="ctr" color="#AF52DE" period={chartPeriod} onPeriodChange={setChartPeriod} loading={chartLoading} suffix="%" />
      </div>

      {/* Top Pages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <RankingTable title="Top Pages by Clicks" items={topPages.byClicks.map((p) => ({ label: p.page, value: p.clicks, secondary: `${p.impressions.toLocaleString()} impressions` }))} loading={pagesLoading} isUrl />
        <RankingTable title="Top Pages by Impressions" items={topPages.byImpressions.map((p) => ({ label: p.page, value: p.impressions, secondary: `${p.clicks.toLocaleString()} clicks` }))} loading={pagesLoading} isUrl />
      </div>

      {/* Top Keywords */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <RankingTable title="Top Keywords by Clicks" items={topKeywords.byClicks.map((k) => ({ label: k.keyword, value: k.clicks, secondary: `Pos ${k.position?.toFixed(1)}` }))} loading={pagesLoading} />
        <RankingTable title="Top Keywords by Impressions" items={topKeywords.byImpressions.map((k) => ({ label: k.keyword, value: k.impressions, secondary: `Pos ${k.position?.toFixed(1)}` }))} loading={pagesLoading} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function KPICard({ title, value, compare, compareColor, loading }: {
  title: string; value: string; compare?: string; compareColor?: string; loading: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="text-apple-xs font-medium text-apple-text-tertiary uppercase tracking-wider mb-2">
        {title}
      </div>
      {loading ? (
        <div className="h-8 w-20 bg-apple-fill-secondary rounded animate-pulse" />
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="text-apple-title1 font-bold text-apple-text">{value}</span>
          {compare && (
            <span className={`text-apple-sm font-medium ${compareColor || 'text-apple-text-tertiary'}`}>
              {compare}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, data, dataKey, color, period, onPeriodChange, loading, inverted, suffix }: {
  title: string; data: DailyDataPoint[]; dataKey: keyof DailyDataPoint; color: string;
  period: TimePeriod; onPeriodChange: (p: TimePeriod) => void; loading: boolean;
  inverted?: boolean; suffix?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-apple-base font-semibold text-apple-text">{title}</h3>
        <select
          value={period}
          onChange={(e) => onPeriodChange(e.target.value as TimePeriod)}
          className="px-2 py-1 text-apple-xs rounded-apple-sm border border-apple-border bg-white text-apple-text-secondary cursor-pointer"
        >
          {Object.entries(PERIOD_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>
      {loading ? (
        <div className="h-40 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-apple-sm text-apple-text-tertiary">
          No data available for this period
        </div>
      ) : (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E8ED" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#86868B' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(d) => {
                  const date = new Date(d);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#86868B' }}
                tickLine={false}
                axisLine={false}
                width={40}
                reversed={inverted}
                tickFormatter={(v) => suffix ? `${v}${suffix}` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8, border: '1px solid #E8E8ED',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)', fontSize: 12,
                }}
                formatter={(value: number) => [
                  suffix ? `${value.toFixed(1)}${suffix}` : value.toLocaleString(),
                  title,
                ]}
                labelFormatter={(label) => new Date(label).toLocaleDateString()}
              />
              <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#grad-${dataKey})`} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function RankingTable({ title, items, loading, isUrl }: {
  title: string;
  items: Array<{ label: string; value: number; secondary: string }>;
  loading: boolean;
  isUrl?: boolean;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-apple-divider">
        <h3 className="text-apple-base font-semibold text-apple-text">{title}</h3>
      </div>
      {loading ? (
        <div className="p-8 text-center">
          <div className="w-5 h-5 border-2 border-apple-blue border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-apple-sm text-apple-text-tertiary">No data</div>
      ) : (
        <div className="divide-y divide-apple-divider">
          {items.map((item, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3 hover:bg-apple-fill-secondary transition-colors">
              <span className="w-6 h-6 rounded-full bg-apple-fill-secondary flex items-center justify-center text-apple-xs font-bold text-apple-text-tertiary shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-apple-sm font-medium text-apple-text truncate ${isUrl ? 'font-mono text-apple-xs' : ''}`}>
                  {isUrl ? new URL(item.label, 'https://x').pathname : item.label}
                </div>
                <div className="text-apple-xs text-apple-text-tertiary">{item.secondary}</div>
              </div>
              <span className="text-apple-sm font-semibold text-apple-text tabular-nums">
                {item.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
