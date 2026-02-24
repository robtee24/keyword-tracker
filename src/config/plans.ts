export type PlanId = 'base' | 'plus' | 'managed_digital';

export interface PlanLimits {
  projects: number;
  page_audits: number;
  keyword_scans: number;
  blog_posts: number;
  page_builds: number;
}

export interface PlanFeatures {
  full_site_audit: boolean;
  keyword_tracking: boolean;
  keyword_recommendations: boolean;
  keyword_refresh: 'weekly' | 'daily' | 'realtime';
  ai_bot_automation: boolean;
  advertising: boolean;
  audit_types: string[];
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  price: number;
  limits: PlanLimits;
  features: PlanFeatures;
}

export interface PlanUsage {
  page_audits: number;
  keyword_scans: number;
  blog_posts: number;
  page_builds: number;
  period: string;
}

export interface UserPlanInfo {
  plan: PlanId;
  planName: string;
  price: number;
  limits: PlanLimits;
  features: PlanFeatures;
  usage: PlanUsage;
  startedAt: string | null;
  expiresAt: string | null;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  base: {
    id: 'base',
    name: 'Base',
    price: 0,
    limits: {
      projects: 1,
      page_audits: 5,
      keyword_scans: 50,
      blog_posts: 5,
      page_builds: 0,
    },
    features: {
      full_site_audit: false,
      keyword_tracking: true,
      keyword_recommendations: true,
      keyword_refresh: 'weekly',
      ai_bot_automation: false,
      advertising: false,
      audit_types: ['seo', 'content'],
    },
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    price: 30,
    limits: {
      projects: -1,
      page_audits: 50,
      keyword_scans: 100,
      blog_posts: 30,
      page_builds: 0,
    },
    features: {
      full_site_audit: true,
      keyword_tracking: true,
      keyword_recommendations: true,
      keyword_refresh: 'daily',
      ai_bot_automation: false,
      advertising: false,
      audit_types: ['seo', 'content', 'aeo', 'schema', 'compliance', 'speed'],
    },
  },
  managed_digital: {
    id: 'managed_digital',
    name: 'Managed Digital',
    price: 200,
    limits: {
      projects: -1,
      page_audits: -1,
      keyword_scans: 200,
      blog_posts: 100,
      page_builds: 30,
    },
    features: {
      full_site_audit: true,
      keyword_tracking: true,
      keyword_recommendations: true,
      keyword_refresh: 'realtime',
      ai_bot_automation: true,
      advertising: true,
      audit_types: ['seo', 'content', 'aeo', 'schema', 'compliance', 'speed'],
    },
  },
};

export function formatLimit(value: number): string {
  if (value === -1) return 'Unlimited';
  if (value === 0) return 'Not available';
  return value.toLocaleString();
}

export function getUsagePercent(current: number, limit: number): number {
  if (limit === -1) return 0;
  if (limit === 0) return 100;
  return Math.min(100, Math.round((current / limit) * 100));
}

export function isFeatureLocked(planId: PlanId, feature: string): boolean {
  const plan = PLANS[planId];
  if (!plan) return true;
  return !(plan.features as unknown as Record<string, unknown>)[feature];
}

export function isLimitReached(current: number, limit: number): boolean {
  if (limit === -1) return false;
  return current >= limit;
}
