import { authenticateRequest } from '../_config.js';
import { addCredits } from '../_credits.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const { amount, packageId } = req.body || {};
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }

  // TODO: Integrate Stripe payment verification here.
  // For now, this is a placeholder that directly adds credits.
  const result = await addCredits(
    auth.user.id,
    amount,
    'purchase',
    packageId ? `Purchased ${packageId} package` : `Purchased $${amount.toFixed(2)} in credits`
  );

  if (!result.success) {
    return res.status(500).json({ error: 'Failed to add credits' });
  }

  return res.status(200).json({ success: true, newBalance: result.newBalance });
}
