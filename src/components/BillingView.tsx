import { useCredits } from '../contexts/CreditsContext';

interface BillingViewProps {
  projectId: string;
}

const CREDIT_PACKAGES = [
  { id: 'starter', label: '$10', amount: 10, description: '100+ image generations' },
  { id: 'pro', label: '$50', amount: 50, description: '500+ image generations' },
  { id: 'enterprise', label: '$200', amount: 200, description: '2000+ image generations' },
];

export default function BillingView({ projectId }: BillingViewProps) {
  const { balance, unlimited, transactions, usage, projectUsage, refreshCredits } = useCredits();

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const formatDollars = (v: number) => {
    if (v < 0.01 && v > 0) return `$${v.toFixed(3)}`;
    return `$${v.toFixed(2)}`;
  };

  const typeColors: Record<string, string> = {
    usage: 'text-red-600 bg-red-50',
    purchase: 'text-emerald-600 bg-emerald-50',
    refund: 'text-blue-600 bg-blue-50',
    grant: 'text-violet-600 bg-violet-50',
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-apple-title2 font-bold text-apple-text">AI Credits & Billing</h1>
        <p className="text-apple-sm text-apple-text-secondary mt-1">
          Manage your AI credits and view usage history
        </p>
      </div>

      {/* Usage Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Balance Card */}
        <div className="card p-5">
          <p className="text-[10px] text-apple-text-tertiary uppercase tracking-wider font-semibold mb-1">Balance</p>
          {unlimited ? (
            <p className="text-2xl font-bold text-emerald-600">Unlimited</p>
          ) : (
            <p className="text-2xl font-bold text-apple-text">{formatDollars(balance)}</p>
          )}
        </div>

        {/* Total Usage Card */}
        <div className="card p-5">
          <p className="text-[10px] text-apple-text-tertiary uppercase tracking-wider font-semibold mb-1">Total Usage (Cycle)</p>
          <p className="text-2xl font-bold text-apple-text">{formatDollars(usage.used)}</p>
          <p className="text-[11px] text-apple-text-tertiary mt-0.5">
            {unlimited ? 'Across all projects' : `of ${formatDollars(usage.cycleTotal)}`}
          </p>
        </div>

        {/* Project Usage Card */}
        <div className="card p-5">
          <p className="text-[10px] text-apple-text-tertiary uppercase tracking-wider font-semibold mb-1">This Project</p>
          <p className="text-2xl font-bold text-apple-blue">
            {projectUsage ? formatDollars(projectUsage.used) : formatDollars(0)}
          </p>
          <p className="text-[11px] text-apple-text-tertiary mt-0.5">All-time project usage</p>
        </div>
      </div>

      {unlimited && (
        <div className="card p-4 mb-6 bg-emerald-50 border-emerald-100">
          <p className="text-apple-sm text-emerald-700">
            Your account has unlimited AI credits. All usage is tracked for reporting purposes.
          </p>
        </div>
      )}

      {/* Purchase Credits */}
      {!unlimited && (
        <div className="card p-6 mb-6">
          <h2 className="text-apple-title3 font-semibold text-apple-text mb-4">Purchase Credits</h2>
          <p className="text-apple-xs text-apple-text-tertiary mb-4">
            Credits are used for AI image generation, video creation, editing, and more.
          </p>
          <div className="grid grid-cols-3 gap-4">
            {CREDIT_PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                className="p-4 rounded-apple border border-apple-divider hover:border-apple-blue hover:bg-blue-50/30 transition-all text-left"
              >
                <p className="text-xl font-bold text-apple-text">{pkg.label}</p>
                <p className="text-apple-xs text-apple-text-tertiary mt-1">{pkg.description}</p>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-apple-text-tertiary mt-3">
            Payment integration coming soon. Contact support for custom packages.
          </p>
        </div>
      )}

      {/* Transaction History */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-apple-title3 font-semibold text-apple-text">
            Recent Activity
            <span className="text-apple-xs text-apple-text-tertiary font-normal ml-2">(this project)</span>
          </h2>
          <span className="text-[11px] text-apple-text-tertiary">{transactions.length} transactions</span>
        </div>
        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-10 h-10 mx-auto text-apple-text-tertiary mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p className="text-apple-sm text-apple-text-secondary">No transactions yet for this project</p>
            <p className="text-apple-xs text-apple-text-tertiary mt-1">Activity will appear here as you use AI tools</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-apple-divider">
                  <th className="text-left text-apple-xs font-medium text-apple-text-secondary py-2 pr-4">Date</th>
                  <th className="text-left text-apple-xs font-medium text-apple-text-secondary py-2 pr-4">Type</th>
                  <th className="text-left text-apple-xs font-medium text-apple-text-secondary py-2 pr-4">Description</th>
                  <th className="text-left text-apple-xs font-medium text-apple-text-secondary py-2 pr-4">Model</th>
                  <th className="text-right text-apple-xs font-medium text-apple-text-secondary py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-apple-divider/50 last:border-0">
                    <td className="py-2.5 pr-4 text-apple-xs text-apple-text-secondary whitespace-nowrap">
                      {formatDate(tx.created_at)}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${typeColors[tx.type] || 'text-gray-600 bg-gray-50'}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-apple-xs text-apple-text max-w-[200px] truncate">
                      {tx.description || '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-apple-xs text-apple-text-tertiary font-mono max-w-[120px] truncate">
                      {tx.model_id || '—'}
                    </td>
                    <td className={`py-2.5 text-right text-apple-xs font-medium whitespace-nowrap ${tx.amount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {tx.amount < 0 ? '−' : '+'}${Math.abs(tx.amount).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
