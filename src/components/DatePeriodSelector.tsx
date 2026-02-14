import type { DateRange } from '../types';
import { format } from 'date-fns';

interface DatePeriodSelectorProps {
  dateRange: DateRange;
  compareDateRange: DateRange | null;
  onDateRangeChange: (range: DateRange) => void;
  onCompareDateRangeChange: (range: DateRange | null) => void;
  onLoadData: () => void;
  hasLoadedOnce: boolean;
}

export default function DatePeriodSelector({
  dateRange,
  compareDateRange,
  onDateRangeChange,
  onCompareDateRangeChange,
  onLoadData,
  hasLoadedOnce,
}: DatePeriodSelectorProps) {
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDateRangeChange({
      ...dateRange,
      startDate: new Date(e.target.value),
    });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDateRangeChange({
      ...dateRange,
      endDate: new Date(e.target.value),
    });
  };

  const handleCompareStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (compareDateRange) {
      onCompareDateRangeChange({
        ...compareDateRange,
        startDate: new Date(e.target.value),
      });
    }
  };

  const handleCompareEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (compareDateRange) {
      onCompareDateRangeChange({
        ...compareDateRange,
        endDate: new Date(e.target.value),
      });
    }
  };

  const toggleCompare = () => {
    if (compareDateRange) {
      onCompareDateRangeChange(null);
    } else {
      const daysDiff = Math.ceil(
        (dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const compareStart = new Date(dateRange.startDate);
      compareStart.setDate(compareStart.getDate() - daysDiff - 1);
      const compareEnd = new Date(dateRange.startDate);
      compareEnd.setDate(compareEnd.getDate() - 1);
      onCompareDateRangeChange({ startDate: compareStart, endDate: compareEnd });
    }
  };

  return (
    <div className="card p-6 mb-6">
      <div className="flex flex-wrap gap-6 items-end">
        {/* Date Range */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-apple-sm font-medium text-apple-text-secondary mb-2 uppercase tracking-wide">
            Date Range
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={format(dateRange.startDate, 'yyyy-MM-dd')}
              onChange={handleStartDateChange}
              className="input"
            />
            <span className="text-apple-text-tertiary text-apple-sm">to</span>
            <input
              type="date"
              value={format(dateRange.endDate, 'yyyy-MM-dd')}
              onChange={handleEndDateChange}
              className="input"
            />
          </div>
        </div>

        {/* Compare Period */}
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-3 mb-2">
            <label className="block text-apple-sm font-medium text-apple-text-secondary uppercase tracking-wide">
              Compare Period
            </label>
            <button
              onClick={toggleCompare}
              className={`px-3 py-1 text-apple-sm rounded-apple-pill transition-all duration-200 ${
                compareDateRange
                  ? 'bg-red-50 text-apple-red hover:bg-red-100'
                  : 'bg-apple-fill-secondary text-apple-text-secondary hover:bg-gray-200'
              }`}
            >
              {compareDateRange ? 'Disable' : 'Enable'}
            </button>
          </div>
          {compareDateRange && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={format(compareDateRange.startDate, 'yyyy-MM-dd')}
                onChange={handleCompareStartDateChange}
                className="input"
              />
              <span className="text-apple-text-tertiary text-apple-sm">to</span>
              <input
                type="date"
                value={format(compareDateRange.endDate, 'yyyy-MM-dd')}
                onChange={handleCompareEndDateChange}
                className="input"
              />
            </div>
          )}
        </div>

        {/* Load Data */}
        <div className="flex items-end">
          <button onClick={onLoadData} className="btn-primary">
            {hasLoadedOnce ? 'Refresh Data' : 'Load Data'}
          </button>
        </div>
      </div>
    </div>
  );
}
