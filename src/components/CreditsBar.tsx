import { useCredits } from '../contexts/CreditsContext';

interface CreditsBarProps {
  onNavigateToBilling?: () => void;
}

export default function CreditsBar({ onNavigateToBilling }: CreditsBarProps) {
  const { balance, unlimited, loading } = useCredits();

  if (loading) return null;

  const totalSpent = unlimited ? 0 : 0;
  const displayBalance = unlimited ? null : balance;

  return (
    <div className="shrink-0 border-t border-apple-divider bg-white px-6 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <svg className="w-4 h-4 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
          </svg>
          <span className="text-apple-xs font-medium text-apple-text-secondary">AI Credits:</span>
        </div>

        {unlimited ? (
          <span className="text-apple-xs font-semibold text-emerald-600">Unlimited</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-apple-xs font-semibold text-apple-text">
              ${displayBalance?.toFixed(2)}
            </span>
            <span className="text-apple-xs text-apple-text-tertiary">remaining</span>
            {displayBalance !== null && displayBalance < 1 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-apple-pill bg-red-50 text-red-600 font-medium">Low</span>
            )}
          </div>
        )}
      </div>

      {!unlimited && onNavigateToBilling && (
        <button
          onClick={onNavigateToBilling}
          className="text-apple-xs font-medium text-apple-blue hover:text-blue-700 transition-colors"
        >
          Buy Credits
        </button>
      )}
    </div>
  );
}
