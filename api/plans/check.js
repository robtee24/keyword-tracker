import { authenticateRequest } from '../_config.js';
import { checkLimit, checkFeature, checkAuditType, getUserPlan } from '../_plans.js';

/**
 * POST /api/plans/check
 * { action: 'limit' | 'feature' | 'audit_type', field: string }
 *
 * Pre-flight check: can this user perform this action?
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const { action, field } = req.body || {};
  if (!action || !field) {
    return res.status(400).json({ error: 'action and field are required' });
  }

  const { plan } = await getUserPlan(auth.user.id);

  if (action === 'limit') {
    const result = await checkLimit(auth.user.id, field);
    return res.status(200).json({ ...result, plan: plan.id, planName: plan.name });
  }

  if (action === 'feature') {
    const allowed = await checkFeature(auth.user.id, field);
    return res.status(200).json({ allowed, plan: plan.id, planName: plan.name });
  }

  if (action === 'audit_type') {
    const allowed = await checkAuditType(auth.user.id, field);
    return res.status(200).json({ allowed, plan: plan.id, planName: plan.name });
  }

  return res.status(400).json({ error: 'Invalid action. Use: limit, feature, or audit_type' });
}
