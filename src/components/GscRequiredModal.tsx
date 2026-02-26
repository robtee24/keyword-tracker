interface GscRequiredModalProps {
  onGoToConnections: () => void;
}

export default function GscRequiredModal({ onGoToConnections }: GscRequiredModalProps) {
  return (
    <div className="max-w-md mx-auto mt-24 text-center">
      <div className="card p-10">
        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-blue-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-apple-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <h3 className="text-apple-title3 font-semibold text-apple-text mb-2">
          Search Console Required
        </h3>
        <p className="text-apple-sm text-apple-text-secondary mb-6 leading-relaxed">
          Connect your Google Search Console account and select a property to access keyword rankings, search performance data, and alerts.
        </p>
        <button onClick={onGoToConnections} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Go to Connections
        </button>
      </div>
    </div>
  );
}
