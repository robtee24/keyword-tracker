import { useState } from 'react';

export interface Recommendation {
  category: 'on-page' | 'content' | 'internal-linking' | 'technical' | 'backlinks';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
}

interface RecommendationsPanelProps {
  recommendations: Recommendation[];
  keyword: string;
}

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  'on-page': { label: 'On-Page', icon: '📝' },
  content: { label: 'Content', icon: '📄' },
  'internal-linking': { label: 'Internal Linking', icon: '🔗' },
  technical: { label: 'Technical SEO', icon: '⚙️' },
  backlinks: { label: 'Backlinks', icon: '🌐' },
};

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-red-50', text: 'text-apple-red', label: 'High' },
  medium: { bg: 'bg-orange-50', text: 'text-apple-orange', label: 'Medium' },
  low: { bg: 'bg-blue-50', text: 'text-apple-blue', label: 'Low' },
};

const CATEGORY_ORDER = ['on-page', 'content', 'internal-linking', 'technical', 'backlinks'];

export default function RecommendationsPanel({ recommendations, keyword }: RecommendationsPanelProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="py-4 text-center text-apple-text-tertiary text-apple-sm">
        No recommendations generated.
      </div>
    );
  }

  // Group by category
  const grouped: Record<string, Recommendation[]> = {};
  recommendations.forEach((rec) => {
    const cat = rec.category || 'on-page';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(rec);
  });

  // Sort categories by defined order
  const sortedCategories = CATEGORY_ORDER.filter((cat) => grouped[cat]);

  // Flatten with category info for indexing
  let globalIndex = 0;

  return (
    <div className="mt-4 mb-2">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-4 h-4 text-apple-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <h4 className="text-apple-sm font-semibold text-apple-text">
          SEO Recommendations for "{keyword}"
        </h4>
        <span className="text-apple-xs text-apple-text-tertiary">
          ({recommendations.length} suggestions)
        </span>
      </div>

      <div className="space-y-5">
        {sortedCategories.map((category) => {
          const meta = CATEGORY_META[category] || { label: category, icon: '📋' };
          const recs = grouped[category];

          return (
            <div key={category}>
              {/* Category header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">{meta.icon}</span>
                <span className="text-apple-xs font-semibold text-apple-text-secondary uppercase tracking-wider">
                  {meta.label}
                </span>
                <span className="text-apple-xs text-apple-text-tertiary">({recs.length})</span>
              </div>

              {/* Recommendation cards */}
              <div className="space-y-2">
                {recs.map((rec) => {
                  const idx = globalIndex++;
                  const isOpen = expandedIndex === idx;
                  const priority = PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.medium;

                  return (
                    <div
                      key={idx}
                      className="rounded-apple-sm border border-apple-divider bg-white overflow-hidden transition-all duration-200"
                    >
                      {/* Header row */}
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-apple-fill-secondary transition-colors duration-150"
                        onClick={() => setExpandedIndex(isOpen ? null : idx)}
                      >
                        {/* Priority badge */}
                        <span className={`flex-shrink-0 px-2 py-0.5 rounded-apple-pill text-apple-xs font-medium ${priority.bg} ${priority.text}`}>
                          {priority.label}
                        </span>

                        {/* Title */}
                        <span className="flex-1 text-apple-sm font-medium text-apple-text">
                          {rec.title}
                        </span>

                        {/* Chevron */}
                        <svg
                          className={`w-4 h-4 text-apple-text-tertiary transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Expanded content */}
                      {isOpen && (
                        <div className="px-4 pb-4 border-t border-apple-divider">
                          <div className="pt-3 space-y-3">
                            {/* Description */}
                            <div>
                              <div className="text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider mb-1">
                                Why
                              </div>
                              <p className="text-apple-sm text-apple-text leading-relaxed">
                                {rec.description}
                              </p>
                            </div>

                            {/* Action */}
                            <div className="bg-apple-fill-secondary rounded-apple-sm p-3">
                              <div className="text-apple-xs font-medium text-apple-blue uppercase tracking-wider mb-1">
                                Action
                              </div>
                              <p className="text-apple-sm text-apple-text leading-relaxed">
                                {rec.action}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
