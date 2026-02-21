import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

interface DataPoint {
  date: string;
  value: number;
}

interface LineChartProps {
  data: DataPoint[];
  compareData?: DataPoint[] | null;
  title: string;
  yAxisLabel?: string;
  invertY?: boolean;
}

export default function LineChart({ data, compareData, title, yAxisLabel, invertY }: LineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="card p-6">
        {title && (
          <h3 className="text-apple-body font-semibold text-apple-text mb-4">{title}</h3>
        )}
        <div className="text-center py-8 text-apple-text-tertiary text-apple-base">
          No data available
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM dd');
    } catch {
      return dateStr;
    }
  };

  const chartData = data.map((point, index) => {
    const comparePoint = compareData?.[index];
    return {
      date: formatDate(point.date),
      current: point.value,
      compare: comparePoint?.value ?? null,
    };
  });

  return (
    <div className="card p-6">
      {title && (
        <h3 className="text-apple-body font-semibold text-apple-text mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={280}>
        <RechartsLineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E8E8ED" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#86868B', fontSize: 11 }}
            axisLine={{ stroke: '#E8E8ED' }}
            tickLine={false}
          />
          <YAxis
            label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', fill: '#86868B', fontSize: 11 } : undefined}
            tick={{ fill: '#86868B', fontSize: 11 }}
            axisLine={{ stroke: '#E8E8ED' }}
            tickLine={false}
            reversed={invertY}
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
          />
          <Legend
            wrapperStyle={{ fontSize: '13px', color: '#6E6E73' }}
          />
          <Line
            type="monotone"
            dataKey="current"
            stroke="#0071E3"
            strokeWidth={2}
            name="Current Period"
            dot={false}
            activeDot={{ r: 4, fill: '#0071E3' }}
          />
          {compareData && (
            <Line
              type="monotone"
              dataKey="compare"
              stroke="#86868B"
              strokeWidth={2}
              name="Compare Period"
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 4, fill: '#86868B' }}
            />
          )}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
