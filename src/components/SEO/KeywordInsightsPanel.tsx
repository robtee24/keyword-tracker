import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { ChecklistItem } from './RecommendationsPanel';

export interface MonthlyPosition {
  month: string; // YYYY-MM
  position: number | null;
  clicks: number;
  impressions: number;
}

interface KeywordInsightsPanelProps {
  keyword: string;
  currentPosition: number | null;
  history: MonthlyPosition[] | null;
  loadingHistory: boolean;
  checklist: ChecklistItem[] | null;
}

export default function KeywordInsightsPanel({
  keyword,
  currentPosition,
  history,
  loadingHistory,
  checklist,
}: KeywordInsightsPanelProps) {
  // Calculate trending from history
  const trending = calculateTrending(history);
  // Calculate opportunity score
  const opportunityScore = calculateOpportunityScore(currentPosition, checklist);

  return (
    <div className="mt-4 mb-2 space-y-4">
      {/* Top row: Trending + Opportunity Score */}
      <div className="flex gap-4">
        {/* Trending */}
        <div className="flex-1 rounded-apple-sm border border-apple-divider bg-white p-4">
          <div className="text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider mb-2">
            Trending
          </div>
          {loadingHistory ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
              <span className="text-apple-sm text-apple-text-tertiary">Calculating...</span>
            </div>
          ) : trending ? (
            <div className="flex items-center gap-2">
              {trending.direction === 'up' ? (
                <>
                  <svg className="w-5 h-5 text-apple-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  <span className="text-apple-body font-semibold text-apple-green">Up</span>
                </>
              ) : trending.direction === 'down' ? (
                <>
                  <svg className="w-5 h-5 text-apple-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <span className="text-apple-body font-semibold text-apple-red">Down</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                  </svg>
                  <span className="text-apple-body font-semibold text-apple-text-tertiary">Stable</span>
                </>
              )}
              <span className="text-apple-xs text-apple-text-tertiary ml-1">
                {trending.delta !== null
                  ? `${trending.delta > 0 ? '+' : ''}${trending.delta.toFixed(1)} positions`
                  : ''}
              </span>
            </div>
          ) : (
            <span className="text-apple-sm text-apple-text-tertiary">Not enough data</span>
          )}
          <p className="text-apple-xs text-apple-text-tertiary mt-1">
            Based on recent 3 months vs prior 3 months
          </p>
        </div>

        {/* Opportunity Score */}
        <div className="flex-1 rounded-apple-sm border border-apple-divider bg-white p-4">
          <div className="text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider mb-2">
            Opportunity Score
          </div>
          <div className="flex items-center gap-3">
            <div className={`text-apple-large-title font-bold tracking-tight ${getScoreColor(opportunityScore)}`}>
              {opportunityScore !== null ? opportunityScore : '--'}
            </div>
            <div className="flex-1">
              {/* Score bar */}
              <div className="h-2 rounded-full bg-apple-divider overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getScoreBarColor(opportunityScore)}`}
                  style={{ width: `${opportunityScore ?? 0}%` }}
                />
              </div>
              <p className="text-apple-xs text-apple-text-tertiary mt-1">
                {opportunityScore !== null ? getScoreLabel(opportunityScore) : 'Scan for recommendations to calculate'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Position History Chart */}
      <div className="rounded-apple-sm border border-apple-divider bg-white p-4">
        <div className="text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider mb-3">
          Position History (Monthly Average)
        </div>
        {loadingHistory ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <div className="w-5 h-5 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
            <span className="text-apple-sm text-apple-text-tertiary">Loading position history...</span>
          </div>
        ) : history && history.length > 0 ? (
          <PositionChart data={history} keyword={keyword} />
        ) : (
          <div className="text-center py-8 text-apple-text-tertiary text-apple-sm">
            No historical position data available
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Position Chart                                                     */
/* ------------------------------------------------------------------ */

function PositionChart({ data, keyword }: { data: MonthlyPosition[]; keyword: string }) {
  const chartData = data
    .filter((d) => d.position !== null)
    .map((d) => ({
      month: formatMonth(d.month),
      position: d.position,
    }));

  if (chartData.length === 0) {
    return (
      <div className="text-center py-8 text-apple-text-tertiary text-apple-sm">
        No position data for this keyword
      </div>
    );
  }

  // For position chart, lower is better -- invert the Y axis
  const positions = chartData.map((d) => d.position as number);
  const minPos = Math.max(1, Math.floor(Math.min(...positions)) - 2);
  const maxPos = Math.ceil(Math.max(...positions)) + 2;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RechartsLineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E8E8ED" />
        <XAxis
          dataKey="month"
          tick={{ fill: '#86868B', fontSize: 11 }}
          axisLine={{ stroke: '#E8E8ED' }}
          tickLine={false}
        />
        <YAxis
          reversed
          domain={[minPos, maxPos]}
          tick={{ fill: '#86868B', fontSize: 11 }}
          axisLine={{ stroke: '#E8E8ED' }}
          tickLine={false}
          label={{ value: 'Position', angle: -90, position: 'insideLeft', fill: '#86868B', fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            fontSize: '13px',
            color: '#1D1D1F',
          }}
          formatter={(value: number) => [`Position ${value}`, keyword]}
        />
        <ReferenceLine y={10} stroke="#34C759" strokeDasharray="3 3" strokeOpacity={0.5} />
        <Line
          type="monotone"
          dataKey="position"
          stroke="#0071E3"
          strokeWidth={2.5}
          dot={{ fill: '#0071E3', r: 3 }}
          activeDot={{ r: 5, fill: '#0071E3' }}
        />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatMonth(monthStr: string): string {
  // YYYY-MM -> "Jan '24"
  const [year, month] = monthStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month, 10) - 1]} '${year.slice(2)}`;
}

interface TrendResult {
  direction: 'up' | 'down' | 'stable';
  delta: number | null;
}

function calculateTrending(history: MonthlyPosition[] | null): TrendResult | null {
  if (!history || history.length < 4) return null;

  // Get recent 3 months and prior 3 months with valid positions
  const valid = history.filter((h) => h.position !== null);
  if (valid.length < 4) return null;

  const recent = valid.slice(-3);
  const prior = valid.slice(-6, -3);

  if (prior.length === 0) return null;

  const recentAvg = recent.reduce((s, h) => s + (h.position || 0), 0) / recent.length;
  const priorAvg = prior.reduce((s, h) => s + (h.position || 0), 0) / prior.length;

  // Delta: positive = position number went up (worse), negative = went down (better)
  const delta = recentAvg - priorAvg;

  // For position, lower is better
  // If recentAvg < priorAvg, the keyword improved (trending "up")
  if (delta < -0.5) return { direction: 'up', delta };
  if (delta > 0.5) return { direction: 'down', delta };
  return { direction: 'stable', delta };
}

function calculateOpportunityScore(
  currentPosition: number | null,
  checklist: ChecklistItem[] | null
): number | null {
  if (!checklist) return null;

  // Base score from current position (further from #1 = more room to improve)
  let score = 0;

  if (currentPosition !== null && currentPosition > 0) {
    if (currentPosition <= 3) score += 10;        // Already near top, limited room
    else if (currentPosition <= 10) score += 30;   // Page 1, good potential
    else if (currentPosition <= 20) score += 50;   // Page 2, significant opportunity
    else if (currentPosition <= 50) score += 65;   // Pages 3-5, lots of room
    else score += 75;                              // Deep positions, max opportunity
  } else {
    score += 40; // Unknown position
  }

  // Boost from high-priority checklist items
  const highCount = checklist.filter((r) => r.priority === 'high').length;
  const medCount = checklist.filter((r) => r.priority === 'medium').length;

  score += Math.min(highCount * 8, 20);   // Up to +20 from high priority recs
  score += Math.min(medCount * 3, 10);    // Up to +10 from medium priority recs

  return Math.min(100, Math.max(0, Math.round(score)));
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-apple-text-tertiary';
  if (score >= 70) return 'text-apple-green';
  if (score >= 40) return 'text-apple-orange';
  return 'text-apple-blue';
}

function getScoreBarColor(score: number | null): string {
  if (score === null) return 'bg-apple-text-tertiary';
  if (score >= 70) return 'bg-apple-green';
  if (score >= 40) return 'bg-apple-orange';
  return 'bg-apple-blue';
}

function getScoreLabel(score: number): string {
  if (score >= 70) return 'High opportunity for improvement';
  if (score >= 40) return 'Moderate opportunity';
  return 'Limited opportunity — already performing well';
}
