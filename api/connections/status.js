import { authenticateRequest } from '../_config.js';
import { getConnectionStatuses } from '../_connections.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await authenticateRequest(req);
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { site_url } = req.query;
  if (!site_url) {
    return res.status(400).json({ error: 'Missing site_url' });
  }

  const connections = await getConnectionStatuses(auth.user.id, site_url);
  res.status(200).json({ connections });
}
