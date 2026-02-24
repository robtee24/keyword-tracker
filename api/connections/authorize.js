import { authenticateRequest, API_CONFIG } from '../_config.js';

const SERVICE_SCOPES = {
  google_search_console: [
    'https://www.googleapis.com/auth/webmasters.readonly',
  ],
  google_ads: [
    'https://www.googleapis.com/auth/adwords',
  ],
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await authenticateRequest(req);
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { service, site_url } = req.query;
  if (!service || !site_url) {
    return res.status(400).json({ error: 'Missing service or site_url' });
  }

  const scopes = SERVICE_SCOPES[service];
  if (!scopes) {
    return res.status(200).json({ authUrl: null, status: 'coming_soon' });
  }

  const host = req.headers.host;
  const redirectUri = host && !host.includes('localhost')
    ? `https://${host}/api/connections/callback`
    : API_CONFIG.google.redirectUri;

  const state = JSON.stringify({
    userId: auth.user.id,
    siteUrl: site_url,
    service,
  });

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${API_CONFIG.google.clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scopes.join(' '))}` +
    `&access_type=offline` +
    `&prompt=${encodeURIComponent('select_account consent')}` +
    `&state=${encodeURIComponent(state)}`;

  res.status(200).json({ authUrl });
}
