import { getSupabase } from './db.js';

/**
 * Plan definitions with feature limits.
 * -1 means unlimited.
 */
export const PLANS = {
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

function currentPeriod() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get the user's plan record. Returns 'base' plan config if no record exists.
 */
export async function getUserPlan(userId) {
  const supabase = getSupabase();
  if (!supabase) return { plan: PLANS.base, record: null };

  const { data, error } = await supabase
    .from('user_plans')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return { plan: PLANS.base, record: null };
  }

  const planConfig = PLANS[data.plan] || PLANS.base;
  return { plan: planConfig, record: data };
}

/**
 * Get usage counts for the current billing period.
 */
export async function getUsage(userId) {
  const supabase = getSupabase();
  if (!supabase) return { page_audits: 0, keyword_scans: 0, blog_posts: 0, page_builds: 0 };

  const period = currentPeriod();
  const { data, error } = await supabase
    .from('usage_tracking')
    .select('*')
    .eq('user_id', userId)
    .eq('period', period)
    .maybeSingle();

  if (error || !data) {
    return { page_audits: 0, keyword_scans: 0, blog_posts: 0, page_builds: 0, period };
  }

  return {
    page_audits: data.page_audits || 0,
    keyword_scans: data.keyword_scans || 0,
    blog_posts: data.blog_posts || 0,
    page_builds: data.page_builds || 0,
    period,
  };
}

/**
 * Increment a usage counter. Returns the new count.
 */
export async function incrementUsage(userId, field, amount = 1) {
  const supabase = getSupabase();
  if (!supabase) return 0;

  const period = currentPeriod();
  const validFields = ['page_audits', 'keyword_scans', 'blog_posts', 'page_builds'];
  if (!validFields.includes(field)) return 0;

  const { data: existing } = await supabase
    .from('usage_tracking')
    .select('id, ' + field)
    .eq('user_id', userId)
    .eq('period', period)
    .maybeSingle();

  if (existing) {
    const newValue = (existing[field] || 0) + amount;
    await supabase
      .from('usage_tracking')
      .update({ [field]: newValue, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    return newValue;
  }

  const row = {
    user_id: userId,
    period,
    page_audits: 0,
    keyword_scans: 0,
    blog_posts: 0,
    page_builds: 0,
    [field]: amount,
  };
  await supabase.from('usage_tracking').insert(row);
  return amount;
}

/**
 * Check if a usage-limited action is allowed.
 * Returns { allowed: boolean, current: number, limit: number, remaining: number }
 */
export async function checkLimit(userId, field) {
  const { plan } = await getUserPlan(userId);
  const usage = await getUsage(userId);

  const limit = plan.limits[field];
  const current = usage[field] || 0;

  if (limit === -1) {
    return { allowed: true, current, limit: -1, remaining: -1 };
  }

  if (limit === 0) {
    return { allowed: false, current, limit: 0, remaining: 0 };
  }

  const remaining = Math.max(0, limit - current);
  return { allowed: current < limit, current, limit, remaining };
}

/**
 * Check if a feature is enabled for the user's plan.
 */
export async function checkFeature(userId, feature) {
  const { plan } = await getUserPlan(userId);
  return !!plan.features[feature];
}

/**
 * Check if a specific audit type is allowed for the user's plan.
 */
export async function checkAuditType(userId, auditType) {
  const { plan } = await getUserPlan(userId);
  return plan.features.audit_types.includes(auditType);
}

/**
 * Middleware helper: returns 403 if action is not allowed.
 * Call from API handlers before performing the action.
 */
export async function enforcePlanLimit(userId, field, res) {
  const result = await checkLimit(userId, field);
  if (!result.allowed) {
    const { plan } = await getUserPlan(userId);
    res.status(403).json({
      error: 'Plan limit reached',
      code: 'PLAN_LIMIT_REACHED',
      field,
      current: result.current,
      limit: result.limit,
      plan: plan.id,
      planName: plan.name,
    });
    return false;
  }
  return true;
}

/**
 * Middleware helper: returns 403 if feature is not enabled.
 */
export async function enforcePlanFeature(userId, feature, res) {
  const allowed = await checkFeature(userId, feature);
  if (!allowed) {
    const { plan } = await getUserPlan(userId);
    res.status(403).json({
      error: 'Feature not available on your plan',
      code: 'PLAN_FEATURE_LOCKED',
      feature,
      plan: plan.id,
      planName: plan.name,
    });
    return false;
  }
  return true;
}
