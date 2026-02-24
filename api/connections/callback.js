import { API_CONFIG } from '../_config.js';
import { saveServiceConnection } from '../_connections.js';

export default async function handler(req, res) {
  const { code, error, state } = req.query;

  if (error) {
    return res.status(400).send(renderPage({
      title: 'Connection Failed',
      body: `
        <div class="icon error">&#10005;</div>
        <h1>Connection Failed</h1>
        <p class="secondary">${error}</p>
      `,
      script: 'setTimeout(() => window.close(), 3000);',
    }));
  }

  if (!code || !state) {
    return res.status(400).json({ error: 'Missing authorization code or state' });
  }

  let stateData;
  try {
    stateData = JSON.parse(state);
  } catch {
    return res.status(400).json({ error: 'Invalid state parameter' });
  }

  const { userId, siteUrl, service } = stateData;

  try {
    const host = req.headers.host;
    const redirectUri = host && !host.includes('localhost')
      ? `https://${host}/api/connections/callback`
      : API_CONFIG.google.redirectUri;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: API_CONFIG.google.clientId,
        client_secret: API_CONFIG.google.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      throw new Error('Failed to exchange authorization code');
    }

    const tokens = await tokenResponse.json();

    let accountName = null;
    try {
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        accountName = profile.email || profile.name || null;
      }
    } catch {}

    await saveServiceConnection(userId, siteUrl, service, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      scope: tokens.scope,
      account_name: accountName,
    });

    return res.status(200).send(renderPage({
      title: 'Connected',
      body: `
        <div class="icon success">&#10003;</div>
        <h1>Service Connected</h1>
        <p class="secondary">Your account has been linked. This window will close automatically.</p>
      `,
      script: `
        if (window.opener) {
          window.opener.postMessage({ type: 'connection-success', service: '${service}' }, window.location.origin);
          setTimeout(() => window.close(), 1500);
        }
      `,
    }));
  } catch (err) {
    console.error('Connection callback error:', err);
    return res.status(500).send(renderPage({
      title: 'Connection Error',
      body: `
        <div class="icon error">&#10005;</div>
        <h1>Connection Error</h1>
        <p class="secondary">${err.message}</p>
      `,
      script: 'setTimeout(() => window.close(), 3000);',
    }));
  }
}

function renderPage({ title, body, script }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background: #F5F5F7;
      color: #1D1D1F;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    .card {
      background: #FFFFFF;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
      padding: 48px;
      text-align: center;
      max-width: 400px;
      width: 90%;
    }
    .icon {
      font-size: 48px;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .icon.success { background: #E8F9ED; color: #34C759; }
    .icon.error { background: #FFEFEE; color: #FF3B30; }
    h1 {
      font-size: 22px;
      font-weight: 600;
      letter-spacing: 0.016em;
      margin-bottom: 8px;
    }
    .secondary {
      font-size: 15px;
      color: #6E6E73;
      line-height: 1.47;
    }
  </style>
</head>
<body>
  <div class="card">${body}</div>
  <script>${script}</script>
</body>
</html>`;
}
