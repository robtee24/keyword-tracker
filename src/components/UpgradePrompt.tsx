import { usePlan } from '../contexts/PlanContext';
import { formatLimit, getUsagePercent, PLANS } from '../config/plans';
import type { PlanId } from '../config/plans';

interface UpgradePromptProps {
  feature?: string;
  limitField?: string;
  title?: string;
  description?: string;
  inline?: boolean;
}

const FEATURE_LABELS: Record<string, string> = {
  advertising: 'Advertising Features',
  full_site_audit: 'Full Site Audit',
  ai_bot_automation: 'AI Bot Automation',
};

const LIMIT_LABELS: Record<string, string> = {
  page_audits: 'Page Audits',
  keyword_scans: 'Keyword Scans',
  blog_posts: 'Blog Posts',
  page_builds: 'Page Builds',
  projects: 'Projects',
};

function getUpgradePlan(currentPlan: PlanId): { id: PlanId; name: string } | null {
  if (currentPlan === 'base') return { id: 'plus', name: 'Plus' };
  if (currentPlan === 'plus') return { id: 'managed_digital', name: 'Managed Digital' };
  return null;
}

export default function UpgradePrompt({ feature, limitField, title, description, inline }: UpgradePromptProps) {
  const { planInfo, planId } = usePlan();
  const upgradeTo = getUpgradePlan(planId);

  const featureLabel = feature ? FEATURE_LABELS[feature] || feature : '';
  const limitLabel = limitField ? LIMIT_LABELS[limitField] || limitField : '';

  let current = 0;
  let limit = 0;
  if (limitField && planInfo) {
    const plan = PLANS[planId];
    current = planInfo.usage[limitField as keyof typeof planInfo.usage] || 0;
    limit = plan.limits[limitField as keyof typeof plan.limits] || 0;
  }

  const defaultTitle = feature
    ? `${featureLabel} not available on the ${planInfo?.planName || 'Base'} plan`
    : `${limitLabel} limit reached`;

  const defaultDescription = feature
    ? `Upgrade to ${upgradeTo?.name || 'a higher plan'} to unlock ${featureLabel.toLowerCase()}.`
    : limit === 0
      ? `${limitLabel} are not available on the ${planInfo?.planName || 'Base'} plan. Upgrade to ${upgradeTo?.name || 'a higher plan'} to get access.`
      : `You've used ${current} of ${formatLimit(limit)} ${limitLabel.toLowerCase()} this month. Upgrade to ${upgradeTo?.name || 'a higher plan'} for a higher limit.`;

  if (inline) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-apple-sm">
        <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-apple-sm font-medium text-amber-800">{title || defaultTitle}</p>
          <p className="text-apple-xs text-amber-600">{description || defaultDescription}</p>
        </div>
        {upgradeTo && (
          <button className="shrink-0 px-3 py-1.5 bg-apple-blue text-white text-apple-xs font-medium rounded-apple-sm hover:bg-apple-blue-hover transition-colors">
            Upgrade to {upgradeTo.name}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto mt-12 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 mb-4">
        <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-apple-text mb-2">{title || defaultTitle}</h2>
      <p className="text-apple-sm text-apple-text-secondary mb-6">{description || defaultDescription}</p>

      {limitField && limit > 0 && (
        <div className="max-w-xs mx-auto mb-6">
          <div className="flex justify-between text-apple-xs text-apple-text-secondary mb-1.5">
            <span>{current} used</span>
            <span>{formatLimit(limit)} limit</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-300"
              style={{ width: `${getUsagePercent(current, limit)}%` }}
            />
          </div>
        </div>
      )}

      {upgradeTo && (
        <div className="space-y-3">
          <button className="px-6 py-2.5 bg-apple-blue text-white text-apple-sm font-medium rounded-apple hover:bg-apple-blue-hover transition-colors">
            Upgrade to {upgradeTo.name}
          </button>
          <p className="text-apple-xs text-apple-text-tertiary">
            Starting at ${PLANS[upgradeTo.id].price}/project/month
          </p>
        </div>
      )}
    </div>
  );
}

export function UsageBadge({ field, compact }: { field: string; compact?: boolean }) {
  const { planInfo, planId } = usePlan();
  if (!planInfo) return null;

  const plan = PLANS[planId];
  const limit = plan.limits[field as keyof typeof plan.limits];
  if (limit === -1) return null;

  const current = planInfo.usage[field as keyof typeof planInfo.usage] || 0;
  const percent = getUsagePercent(current, limit);
  const isNearLimit = percent >= 80;
  const isAtLimit = percent >= 100;

  if (compact) {
    return (
      <span className={`text-apple-xs font-medium ${
        isAtLimit ? 'text-red-500' : isNearLimit ? 'text-amber-500' : 'text-apple-text-tertiary'
      }`}>
        {current}/{formatLimit(limit)}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-apple-blue'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={`text-apple-xs font-medium whitespace-nowrap ${
        isAtLimit ? 'text-red-500' : isNearLimit ? 'text-amber-500' : 'text-apple-text-tertiary'
      }`}>
        {current}/{formatLimit(limit)}
      </span>
    </div>
  );
}

export function PlanBadge() {
  const { planInfo } = usePlan();
  if (!planInfo) return null;

  const colorMap: Record<string, string> = {
    base: 'bg-gray-100 text-gray-600',
    plus: 'bg-blue-50 text-blue-600',
    managed_digital: 'bg-purple-50 text-purple-600',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-apple-pill text-[10px] font-semibold uppercase tracking-wider ${colorMap[planInfo.plan] || colorMap.base}`}>
      {planInfo.planName}
    </span>
  );
}
