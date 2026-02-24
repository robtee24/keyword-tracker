import { authenticateRequest } from '../_config.js';
import { getUserPlan, getUsage, PLANS } from '../_plans.js';

/**
 * GET /api/plans/current
 * Returns the user's current plan, limits, features, and usage for this period.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const { plan, record } = await getUserPlan(auth.user.id);
  const usage = await getUsage(auth.user.id);

  return res.status(200).json({
    plan: plan.id,
    planName: plan.name,
    price: plan.price,
    limits: plan.limits,
    features: plan.features,
    usage,
    startedAt: record?.started_at || null,
    expiresAt: record?.expires_at || null,
  });
}
