import { API_CONFIG } from '../../_config.js';

export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(renderPage({
      title: 'Authorization Failed',
      body: `
        <div class="icon error">&#10005;</div>
        <h1>Authorization Failed</h1>
        <p class="secondary">${error}</p>
      `,
      script: `
        if (window.opener) {
          window.opener.postMessage({ type: 'oauth-error', error: '${error}' }, '*');
          setTimeout(() => window.close(), 3000);
        }
      `,
    }));
  }

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }

  try {
    // Determine redirect URI to match the one used in authorize
    let redirectUri = API_CONFIG.google.redirectUri;
    const host = req.headers.host;
    if (host && !host.includes('localhost')) {
      redirectUri = `https://${host}/api/google/oauth/callback`;
    }

    // Exchange code for tokens
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

    // Send tokens to parent window via postMessage and close popup
    return res.status(200).send(renderPage({
      title: 'Authorization Successful',
      body: `
        <div class="icon success">&#10003;</div>
        <h1>Connected to Google</h1>
        <p class="secondary">Your Search Console data is now accessible. This window will close automatically.</p>
      `,
      script: `
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-tokens',
            accessToken: ${JSON.stringify(tokens.access_token || '')},
            refreshToken: ${JSON.stringify(tokens.refresh_token || '')},
            expiresIn: ${tokens.expires_in || 3600}
          }, window.location.origin);
          setTimeout(() => window.close(), 1500);
        }
      `,
    }));
  } catch (error) {
    console.error('OAuth callback error:', error);
    return res.status(500).send(renderPage({
      title: 'Authorization Error',
      body: `
        <div class="icon error">&#10005;</div>
        <h1>Authorization Error</h1>
        <p class="secondary">${error.message}</p>
      `,
      script: `
        if (window.opener) {
          window.opener.postMessage({ type: 'oauth-error', error: '${error.message}' }, '*');
        }
      `,
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
