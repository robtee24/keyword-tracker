import { useState, useEffect } from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import type { ChecklistItem } from './RecommendationsPanel';
import { API_ENDPOINTS } from '../../config/api';

export interface MonthlyPosition {
  month: string; // YYYY-MM
  position: number | null;
  clicks: number;
  impressions: number;
}

interface CompletedTask {
  id: number;
  task_id: string;
  task_text: string;
  category: string;
  completed_at: string;
}

interface AnnotationGroup {
  month: string;
  tasks: CompletedTask[];
}

interface KeywordInsightsPanelProps {
  keyword: string;
  currentPosition: number | null;
  history: MonthlyPosition[] | null;
  loadingHistory: boolean;
  checklist: ChecklistItem[] | null;
  searchVolume: number | null;
  siteUrl: string;
  taskToggleCounter: number;
}

export default function KeywordInsightsPanel({
  keyword,
  currentPosition,
  history,
  loadingHistory,
  checklist,
  searchVolume,
  siteUrl,
  taskToggleCounter,
}: KeywordInsightsPanelProps) {
  const trending = calculateTrending(history);
  const opportunityScore = calculateOpportunityScore(currentPosition, checklist, searchVolume);
  const [annotations, setAnnotations] = useState<AnnotationGroup[]>([]);

  // Fetch completed tasks for chart annotations
  useEffect(() => {
    if (!siteUrl || !keyword) return;
    let cancelled = false;

    (async () => {
      try {
        const resp = await fetch(
          `${API_ENDPOINTS.db.completedTasks}?siteUrl=${encodeURIComponent(siteUrl)}&keyword=${encodeURIComponent(keyword)}`
        );
        if (!resp.ok || cancelled) return;
        const { tasks } = await resp.json();
        if (!tasks?.length || cancelled) { setAnnotations([]); return; }

        // Group tasks by YYYY-MM
        const byMonth = new Map<string, CompletedTask[]>();
        for (const t of tasks) {
          const month = t.completed_at?.substring(0, 7); // YYYY-MM
          if (!month) continue;
          if (!byMonth.has(month)) byMonth.set(month, []);
          byMonth.get(month)!.push(t);
        }

        const groups: AnnotationGroup[] = [];
        for (const [month, groupTasks] of byMonth) {
          groups.push({ month, tasks: groupTasks });
        }
        setAnnotations(groups);
      } catch {
        // Non-critical
      }
    })();

    return () => { cancelled = true; };
  }, [siteUrl, keyword, taskToggleCounter]);

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
              <div className="h-2 rounded-full bg-apple-divider overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getScoreBarColor(opportunityScore)}`}
                  style={{ width: `${opportunityScore ?? 0}%` }}
                />
              </div>
              <p className="text-apple-xs text-apple-text-tertiary mt-1">
                {opportunityScore !== null ? getScoreLabel(opportunityScore) : 'Scan for recommendations to calculate'}
                {searchVolume !== null && searchVolume > 0 && opportunityScore !== null && (
                  <span className="block text-apple-xs text-apple-text-tertiary mt-0.5">
                    Volume factor: {searchVolume.toLocaleString()} monthly searches
                  </span>
                )}
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
          <PositionChart data={history} keyword={keyword} annotations={annotations} />
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
/*  Position Chart with Annotations                                    */
/* ------------------------------------------------------------------ */

function PositionChart({
  data,
  keyword,
  annotations,
}: {
  data: MonthlyPosition[];
  keyword: string;
  annotations: AnnotationGroup[];
}) {
  const chartData = data
    .filter((d) => d.position !== null)
    .map((d) => ({
      month: formatMonth(d.month),
      rawMonth: d.month,
      position: d.position,
    }));

  if (chartData.length === 0) {
    return (
      <div className="text-center py-8 text-apple-text-tertiary text-apple-sm">
        No position data for this keyword
      </div>
    );
  }

  const positions = chartData.map((d) => d.position as number);
  const minPos = Math.max(1, Math.floor(Math.min(...positions)) - 2);
  const maxPos = Math.ceil(Math.max(...positions)) + 2;

  // Build annotation lookup: formatted month → tasks
  const annotationMap = new Map<string, CompletedTask[]>();
  for (const group of annotations) {
    const formatted = formatMonth(group.month);
    annotationMap.set(formatted, group.tasks);
  }

  // Find data points that have annotations
  const annotatedPoints = chartData.filter((d) => annotationMap.has(d.month));

  return (
    <div className="relative">
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
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const tasks = annotationMap.get(label as string);
              return (
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    fontSize: '13px',
                    color: '#1D1D1F',
                    padding: '10px 14px',
                    maxWidth: '320px',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: tasks?.length ? 6 : 0 }}>
                    Position {payload[0].value} — {label}
                  </div>
                  {tasks && tasks.length > 0 && (
                    <div style={{ borderTop: '1px solid #E8E8ED', paddingTop: 6, marginTop: 2 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#34C759', marginBottom: 4 }}>
                        Changes implemented:
                      </div>
                      {tasks.map((t, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#636366', marginBottom: 2, lineHeight: 1.4 }}>
                          • {t.task_text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }}
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
          {/* Annotation markers for months with completed tasks */}
          {annotatedPoints.map((point) => (
            <ReferenceDot
              key={point.month}
              x={point.month}
              y={point.position as number}
              r={6}
              fill="#34C759"
              stroke="#FFFFFF"
              strokeWidth={2}
              shape={(props: any) => {
                const { cx, cy } = props;
                const taskCount = annotationMap.get(point.month)?.length || 0;
                return (
                  <g>
                    {/* Outer ring */}
                    <circle cx={cx} cy={cy} r={8} fill="#34C759" fillOpacity={0.15} />
                    {/* Inner dot */}
                    <circle cx={cx} cy={cy} r={5} fill="#34C759" stroke="#FFFFFF" strokeWidth={2} />
                    {/* Task count badge */}
                    {taskCount > 1 && (
                      <>
                        <circle cx={cx + 7} cy={cy - 7} r={7} fill="#FF9500" stroke="#FFFFFF" strokeWidth={1.5} />
                        <text
                          x={cx + 7}
                          y={cy - 7}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#FFFFFF"
                          fontSize={8}
                          fontWeight={700}
                        >
                          {taskCount}
                        </text>
                      </>
                    )}
                    {taskCount === 1 && (
                      <>
                        <circle cx={cx + 6} cy={cy - 6} r={5} fill="#34C759" stroke="#FFFFFF" strokeWidth={1.5} />
                        <text
                          x={cx + 6}
                          y={cy - 6}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#FFFFFF"
                          fontSize={8}
                          fontWeight={700}
                        >
                          ✓
                        </text>
                      </>
                    )}
                  </g>
                );
              }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>

      {/* Legend for annotations */}
      {annotations.length > 0 && (
        <div className="flex items-center gap-2 mt-2 px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#34C759]" />
            <span className="text-apple-xs text-apple-text-tertiary">
              Changes implemented ({annotations.reduce((s, a) => s + a.tasks.length, 0)} tasks across {annotations.length} month{annotations.length !== 1 ? 's' : ''})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatMonth(monthStr: string): string {
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

  const valid = history.filter((h) => h.position !== null);
  if (valid.length < 4) return null;

  const recent = valid.slice(-3);
  const prior = valid.slice(-6, -3);

  if (prior.length === 0) return null;

  const recentAvg = recent.reduce((s, h) => s + (h.position || 0), 0) / recent.length;
  const priorAvg = prior.reduce((s, h) => s + (h.position || 0), 0) / prior.length;

  const delta = recentAvg - priorAvg;

  if (delta < -0.5) return { direction: 'up', delta };
  if (delta > 0.5) return { direction: 'down', delta };
  return { direction: 'stable', delta };
}

function calculateOpportunityScore(
  currentPosition: number | null,
  checklist: ChecklistItem[] | null,
  searchVolume: number | null
): number | null {
  if (!checklist) return null;

  let score = 0;

  if (currentPosition !== null && currentPosition > 0) {
    if (currentPosition <= 3) score += 8;
    else if (currentPosition <= 10) score += 25;
    else if (currentPosition <= 20) score += 40;
    else if (currentPosition <= 50) score += 55;
    else score += 65;
  } else {
    score += 35;
  }

  const highCount = checklist.filter((r) => r.priority === 'high').length;
  const medCount = checklist.filter((r) => r.priority === 'medium').length;
  score += Math.min(highCount * 6, 15);
  score += Math.min(medCount * 3, 5);

  if (searchVolume !== null && searchVolume > 0) {
    if (searchVolume >= 10000) score += 20;
    else if (searchVolume >= 5000) score += 16;
    else if (searchVolume >= 1000) score += 12;
    else if (searchVolume >= 500) score += 8;
    else if (searchVolume >= 100) score += 5;
    else score += 2;
  }

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
