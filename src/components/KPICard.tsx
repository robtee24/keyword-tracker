interface KPICardProps {
  label: string;
  value: string | number | null | undefined;
  compareValue?: string | number | null;
  format?: (value: number) => string;
}

export default function KPICard({ label, value, compareValue, format: formatFn }: KPICardProps) {
  const formatValue = (val: string | number | null | undefined) => {
    if (val === null || val === undefined) return 'N/A';
    if (typeof val === 'number' && formatFn) return formatFn(val);
    return typeof val === 'number' ? val.toLocaleString() : val;
  };

  const getChange = () => {
    if (value === null || value === undefined || compareValue === null || compareValue === undefined) return null;
    if (typeof value !== 'number' || typeof compareValue !== 'number') return null;
    return ((value - compareValue) / compareValue) * 100;
  };

  const change = getChange();
  const isUnavailable = value === null || value === undefined;

  return (
    <div className="card p-6">
      <div className="text-apple-sm font-medium text-apple-text-secondary mb-2 uppercase tracking-wide">
        {label}
      </div>
      <div className="flex items-baseline gap-3">
        <div className={`text-apple-hero font-bold tracking-tight ${isUnavailable ? 'text-apple-text-tertiary' : 'text-apple-text'}`}>
          {formatValue(value)}
        </div>
        {change !== null && !isUnavailable && (
          <div className={`text-apple-base font-medium ${change >= 0 ? 'text-apple-green' : 'text-apple-red'}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </div>
        )}
      </div>
      {compareValue !== null && compareValue !== undefined && !isUnavailable && (
        <div className="text-apple-xs text-apple-text-tertiary mt-2">
          Compare: {formatValue(compareValue)}
        </div>
      )}
    </div>
  );
}
