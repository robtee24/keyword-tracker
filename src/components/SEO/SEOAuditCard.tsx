import { useState } from 'react';

export interface AuditGrade {
  grade: string;
  value: string;
  notes: string;
}

export interface SEOAudit {
  url: string;
  overallGrade: string;
  grades: Record<string, AuditGrade>;
}

interface SEOAuditCardProps {
  audit: SEOAudit;
  keyword: string;
}

const GRADE_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  A: { bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-200' },
  B: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200' },
  C: { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-200' },
  D: { bg: 'bg-red-50', text: 'text-red-600', ring: 'ring-red-200' },
  F: { bg: 'bg-red-100', text: 'text-red-700', ring: 'ring-red-300' },
};

const ELEMENT_META: Record<string, { label: string; icon: string }> = {
  titleTag: { label: 'Title Tag', icon: '🏷️' },
  metaDescription: { label: 'Meta Description', icon: '📝' },
  h1Tag: { label: 'H1 Tag', icon: '🔤' },
  headingStructure: { label: 'Heading Structure', icon: '📑' },
  schemaMarkup: { label: 'Schema Markup', icon: '⚙️' },
  keywordOptimization: { label: 'Keyword Density', icon: '🎯' },
  contentVolume: { label: 'Content Volume', icon: '📄' },
  internalLinking: { label: 'Internal Links', icon: '🔗' },
  imageOptimization: { label: 'Images', icon: '🖼️' },
  technicalSEO: { label: 'Technical SEO', icon: '🔧' },
};

const ELEMENT_ORDER = [
  'titleTag',
  'metaDescription',
  'h1Tag',
  'headingStructure',
  'keywordOptimization',
  'contentVolume',
  'schemaMarkup',
  'internalLinking',
  'imageOptimization',
  'technicalSEO',
];

export default function SEOAuditCard({ audit, keyword }: SEOAuditCardProps) {
  const [expandedElement, setExpandedElement] = useState<string | null>(null);

  const overallColor = GRADE_COLORS[audit.overallGrade] || GRADE_COLORS.F;

  // Count grades
  const gradeCount: Record<string, number> = {};
  Object.values(audit.grades).forEach((g) => {
    gradeCount[g.grade] = (gradeCount[g.grade] || 0) + 1;
  });

  return (
    <div className="rounded-apple-sm border border-apple-divider bg-white overflow-hidden">
      {/* Header with overall grade */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-apple-divider">
        <div
          className={`w-14 h-14 rounded-apple-sm flex items-center justify-center ${overallColor.bg} ring-2 ${overallColor.ring}`}
        >
          <span className={`text-2xl font-bold ${overallColor.text}`}>{audit.overallGrade}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-apple-sm font-semibold text-apple-text">
            SEO Audit — Top Ranking Page
          </h4>
          <p className="text-apple-xs text-apple-text-tertiary truncate mt-0.5">{audit.url}</p>
          <div className="flex gap-3 mt-1">
            {['A', 'B', 'C', 'D', 'F'].map((g) =>
              gradeCount[g] ? (
                <span
                  key={g}
                  className={`text-apple-xs font-medium px-1.5 py-0.5 rounded ${GRADE_COLORS[g].bg} ${GRADE_COLORS[g].text}`}
                >
                  {gradeCount[g]}{g}
                </span>
              ) : null
            )}
          </div>
        </div>
      </div>

      {/* Grade grid */}
      <div className="divide-y divide-apple-divider">
        {ELEMENT_ORDER.filter((key) => audit.grades[key]).map((key) => {
          const grade = audit.grades[key];
          const meta = ELEMENT_META[key] || { label: key, icon: '📋' };
          const colors = GRADE_COLORS[grade.grade] || GRADE_COLORS.F;
          const isOpen = expandedElement === key;

          return (
            <button
              key={key}
              className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-apple-fill-secondary transition-colors duration-150"
              onClick={() => setExpandedElement(isOpen ? null : key)}
            >
              <span className="text-sm flex-shrink-0">{meta.icon}</span>
              <span className="flex-1 text-apple-sm font-medium text-apple-text">{meta.label}</span>
              <span
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold ${colors.bg} ${colors.text}`}
              >
                {grade.grade}
              </span>
              <svg
                className={`w-3.5 h-3.5 text-apple-text-tertiary transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          );
        })}
      </div>

      {/* Expanded detail (rendered outside button for accessibility) */}
      {expandedElement && audit.grades[expandedElement] && (
        <div className="px-5 py-3 bg-apple-fill-secondary border-t border-apple-divider">
          <div className="space-y-2">
            <div>
              <span className="text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider">
                Current Value
              </span>
              <p className="text-apple-sm text-apple-text mt-0.5 break-words font-mono bg-white px-3 py-2 rounded-lg border border-apple-divider">
                {audit.grades[expandedElement].value}
              </p>
            </div>
            <div>
              <span className="text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider">
                Assessment
              </span>
              <p className="text-apple-sm text-apple-text mt-0.5 leading-relaxed">
                {audit.grades[expandedElement].notes}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Backlinks note */}
      <div className="px-5 py-3 bg-apple-fill-secondary border-t border-apple-divider">
        <div className="flex items-start gap-2">
          <span className="text-sm">🌐</span>
          <div>
            <span className="text-apple-xs font-medium text-apple-text-secondary">Backlinks</span>
            <p className="text-apple-xs text-apple-text-tertiary mt-0.5">
              Per-page backlink data isn't available via the Search Console API.
              Check the Links report in Search Console's web UI, or use tools like Ahrefs / Semrush for detailed backlink analysis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
