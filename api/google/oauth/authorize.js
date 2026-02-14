import { API_CONFIG } from '../../_config.js';

export default function handler(req, res) {
  // Only request Search Console read access
  const scopes = [
    'https://www.googleapis.com/auth/webmasters.readonly',
  ];

  // Determine the redirect URI based on the request origin
  let redirectUri = API_CONFIG.google.redirectUri;

  const host = req.headers.host;
  if (host && !host.includes('localhost')) {
    redirectUri = `https://${host}/api/google/oauth/callback`;
  }

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${API_CONFIG.google.clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scopes.join(' '))}` +
    `&access_type=offline` +
    `&prompt=${encodeURIComponent('select_account consent')}`;

  res.status(200).json({ authUrl });
}
