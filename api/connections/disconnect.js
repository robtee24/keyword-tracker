import { authenticateRequest } from '../_config.js';
import { removeServiceConnection } from '../_connections.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await authenticateRequest(req);
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { service, site_url } = req.body || {};
  if (!service || !site_url) {
    return res.status(400).json({ error: 'Missing service or site_url' });
  }

  try {
    await removeServiceConnection(auth.user.id, site_url, service);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Disconnect error:', err);
    res.status(500).json({ error: 'Failed to disconnect service' });
  }
}
