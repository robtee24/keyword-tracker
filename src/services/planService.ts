import { authenticatedFetch } from './authService';
import { API_ENDPOINTS } from '../config/api';
import type { UserPlanInfo, PlanId } from '../config/plans';
import { PLANS } from '../config/plans';

const DEFAULT_PLAN_INFO: UserPlanInfo = {
  plan: 'base',
  planName: 'Base',
  price: 0,
  limits: PLANS.base.limits,
  features: PLANS.base.features,
  usage: { page_audits: 0, keyword_scans: 0, blog_posts: 0, page_builds: 0, period: '' },
  startedAt: null,
  expiresAt: null,
};

export async function fetchCurrentPlan(): Promise<UserPlanInfo> {
  try {
    const response = await authenticatedFetch(API_ENDPOINTS.plans.current);
    if (!response.ok) return DEFAULT_PLAN_INFO;
    return await response.json();
  } catch {
    return DEFAULT_PLAN_INFO;
  }
}

interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  plan: PlanId;
  planName: string;
}

export async function checkPlanLimit(field: string): Promise<LimitCheckResult> {
  try {
    const response = await authenticatedFetch(API_ENDPOINTS.plans.check, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'limit', field }),
    });
    if (!response.ok) {
      return { allowed: false, current: 0, limit: 0, remaining: 0, plan: 'base', planName: 'Base' };
    }
    return await response.json();
  } catch {
    return { allowed: true, current: 0, limit: -1, remaining: -1, plan: 'base', planName: 'Base' };
  }
}

export async function checkPlanFeature(feature: string): Promise<{ allowed: boolean; plan: PlanId; planName: string }> {
  try {
    const response = await authenticatedFetch(API_ENDPOINTS.plans.check, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'feature', field: feature }),
    });
    if (!response.ok) {
      return { allowed: false, plan: 'base', planName: 'Base' };
    }
    return await response.json();
  } catch {
    return { allowed: true, plan: 'base', planName: 'Base' };
  }
}

/**
 * Check if a 403 response is a plan limit error and return structured info.
 */
export function parsePlanError(status: number, body: Record<string, unknown>): {
  isPlanError: boolean;
  code?: string;
  field?: string;
  current?: number;
  limit?: number;
  plan?: string;
  planName?: string;
} {
  if (status !== 403) return { isPlanError: false };

  const code = body?.code as string;
  if (code === 'PLAN_LIMIT_REACHED' || code === 'PLAN_FEATURE_LOCKED') {
    return {
      isPlanError: true,
      code,
      field: body?.field as string,
      current: body?.current as number,
      limit: body?.limit as number,
      plan: body?.plan as string,
      planName: body?.planName as string,
    };
  }

  return { isPlanError: false };
}
