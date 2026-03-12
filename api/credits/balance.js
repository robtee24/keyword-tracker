import { authenticateRequest } from '../_config.js';
import { getCreditsBalance, getTransactions, getCycleUsage } from '../_credits.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const [{ balance, unlimited }, transactions, usage] = await Promise.all([
    getCreditsBalance(auth.user.id),
    getTransactions(auth.user.id, 50),
    getCycleUsage(auth.user.id),
  ]);

  return res.status(200).json({ balance, unlimited, transactions, usage });
}
