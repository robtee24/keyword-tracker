import { useState, useEffect, useCallback } from 'react';
import SEOAuditCard from './SEOAuditCard';
import type { SEOAudit } from './SEOAuditCard';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ChecklistItem {
  id: string;
  category: string;
  task: string;
  page: string;
  priority: 'high' | 'medium' | 'low';
  impact?: string;
}

export interface ScanStrategy {
  targetPage: string;
  approach: string;
  summary: string;
}

export interface ScanResult {
  strategy: ScanStrategy;
  audit: SEOAudit;
  checklist: ChecklistItem[];
}

interface RecommendationsPanelProps {
  scanResult: ScanResult;
  keyword: string;
  siteUrl: string;
}

/* ------------------------------------------------------------------ */
/*  Category config                                                    */
/* ------------------------------------------------------------------ */

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  'title-tag': { label: 'Title Tags', icon: '🏷️' },
  'meta-description': { label: 'Meta Descriptions', icon: '📝' },
  'heading-structure': { label: 'Heading Structure', icon: '📑' },
  content: { label: 'Content', icon: '📄' },
  'internal-linking': { label: 'Internal Links', icon: '🔗' },
  'schema-markup': { label: 'Schema Markup', icon: '⚙️' },
  'technical-seo': { label: 'Technical SEO', icon: '🔧' },
  backlinks: { label: 'Backlinks', icon: '🌐' },
  images: { label: 'Images', icon: '🖼️' },
  'featured-snippet': { label: 'Featured Snippet', icon: '⭐' },
  'topical-authority': { label: 'Topical Authority', icon: '🏛️' },
  eeat: { label: 'E-E-A-T', icon: '🛡️' },
};

const CATEGORY_ORDER = [
  'title-tag',
  'meta-description',
  'heading-structure',
  'content',
  'internal-linking',
  'schema-markup',
  'technical-seo',
  'backlinks',
  'images',
];

const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  high: { bg: 'bg-red-50', text: 'text-red-600' },
  medium: { bg: 'bg-orange-50', text: 'text-orange-600' },
  low: { bg: 'bg-blue-50', text: 'text-blue-600' },
};

/* ------------------------------------------------------------------ */
/*  localStorage helpers                                               */
/* ------------------------------------------------------------------ */

function storageKey(siteUrl: string, keyword: string): string {
  return `seo-checklist:${siteUrl}:${keyword}`;
}

function getCompletedIds(siteUrl: string, keyword: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(siteUrl, keyword));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveCompletedIds(siteUrl: string, keyword: string, ids: Set<string>) {
  localStorage.setItem(storageKey(siteUrl, keyword), JSON.stringify([...ids]));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function RecommendationsPanel({
  scanResult,
  keyword,
  siteUrl,
}: RecommendationsPanelProps) {
  const { strategy, audit, checklist } = scanResult;
  const [completedIds, setCompletedIds] = useState<Set<string>>(() =>
    getCompletedIds(siteUrl, keyword)
  );

  // Persist to localStorage whenever completedIds changes
  useEffect(() => {
    saveCompletedIds(siteUrl, keyword, completedIds);
  }, [completedIds, siteUrl, keyword]);

  const toggleItem = useCallback((id: string) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Group checklist by category
  const grouped: Record<string, ChecklistItem[]> = {};
  checklist.forEach((item) => {
    const cat = item.category || 'content';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });
  const sortedCategories = CATEGORY_ORDER.filter((c) => grouped[c]);
  // Add any categories not in our predefined order
  Object.keys(grouped).forEach((c) => {
    if (!sortedCategories.includes(c)) sortedCategories.push(c);
  });

  const totalItems = checklist.length;
  const completedCount = checklist.filter((item) => completedIds.has(item.id)).length;
  const progressPct = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  return (
    <div className="mt-4 mb-2 space-y-5">
      {/* Strategy Overview */}
      <div className="rounded-apple-sm border border-apple-divider bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-apple-divider bg-gradient-to-r from-blue-50/50 to-white">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-apple-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <h4 className="text-apple-sm font-semibold text-apple-text">Strategy Overview</h4>
          </div>
          <p className="text-apple-sm text-apple-text leading-relaxed">{strategy.summary}</p>
          <div className="flex items-center gap-3 mt-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-apple-pill text-apple-xs font-medium ${
              strategy.approach === 'boost-current'
                ? 'bg-green-50 text-green-700'
                : strategy.approach === 'create-new'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-purple-50 text-purple-700'
            }`}>
              {strategy.approach === 'boost-current'
                ? '🎯 Boost Current Top Page'
                : strategy.approach === 'create-new'
                ? '✨ Create New Dedicated Page'
                : '🔄 Focus on Alternative Page'}
            </span>
          </div>
          {strategy.targetPage && (
            <div className="mt-2">
              <span className="text-apple-xs text-apple-text-tertiary">Target: </span>
              <a
                href={strategy.targetPage}
                target="_blank"
                rel="noopener noreferrer"
                className="text-apple-xs text-apple-blue hover:underline break-all"
              >
                {strategy.targetPage}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* SEO Audit Card */}
      <SEOAuditCard audit={audit} keyword={keyword} />

      {/* Action Checklist */}
      <div className="rounded-apple-sm border border-apple-divider bg-white overflow-hidden">
        {/* Checklist header + progress */}
        <div className="px-5 py-4 border-b border-apple-divider">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-apple-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <h4 className="text-apple-sm font-semibold text-apple-text">Action Checklist</h4>
            </div>
            <span className="text-apple-xs text-apple-text-tertiary">
              {completedCount}/{totalItems} complete
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-apple-divider overflow-hidden">
            <div
              className="h-full rounded-full bg-apple-green transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Grouped checklist items */}
        <div className="divide-y divide-apple-divider">
          {sortedCategories.map((category) => {
            const meta = CATEGORY_META[category] || { label: category, icon: '📋' };
            const items = grouped[category];
            const catCompleted = items.filter((i) => completedIds.has(i.id)).length;

            return (
              <div key={category}>
                {/* Category header */}
                <div className="flex items-center gap-2 px-5 py-2.5 bg-apple-fill-secondary">
                  <span className="text-sm">{meta.icon}</span>
                  <span className="text-apple-xs font-semibold text-apple-text-secondary uppercase tracking-wider">
                    {meta.label}
                  </span>
                  <span className="text-apple-xs text-apple-text-tertiary">
                    ({catCompleted}/{items.length})
                  </span>
                </div>

                {/* Items */}
                {items.map((item) => {
                  const isDone = completedIds.has(item.id);
                  const priority = PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.medium;

                  return (
                    <label
                      key={item.id}
                      className={`flex items-start gap-3 px-5 py-3 cursor-pointer transition-colors duration-150 ${
                        isDone ? 'bg-green-50/30' : 'hover:bg-apple-fill-secondary'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className="pt-0.5 flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={() => toggleItem(item.id)}
                          className="w-4 h-4 rounded border-apple-border text-apple-green focus:ring-apple-green cursor-pointer"
                        />
                      </div>

                      {/* Task content */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-apple-sm leading-relaxed ${
                            isDone
                              ? 'line-through text-apple-text-tertiary'
                              : 'text-apple-text'
                          }`}
                        >
                          {item.task}
                        </p>
                        {item.page && (
                          <span className="text-apple-xs text-apple-text-tertiary mt-0.5 block truncate">
                            {item.page}
                          </span>
                        )}
                        {item.impact && !isDone && (
                          <span className="text-apple-xs text-apple-blue/70 mt-1 block italic">
                            Why: {item.impact}
                          </span>
                        )}
                      </div>

                      {/* Priority badge */}
                      <span
                        className={`flex-shrink-0 px-2 py-0.5 rounded-apple-pill text-apple-xs font-medium ${priority.bg} ${priority.text}`}
                      >
                        {item.priority}
                      </span>
                    </label>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
