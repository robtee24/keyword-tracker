import { API_CONFIG } from '../../_config.js';

/**
 * Refresh an access token using a refresh token.
 * The client sends its refresh_token, and the server uses GOOGLE_CLIENT_SECRET
 * (which is never exposed to the client) to get a new access token.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'refresh_token is required' });
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: API_CONFIG.google.clientId,
        client_secret: API_CONFIG.google.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token refresh failed:', errorText);
      return res.status(401).json({
        error: 'Failed to refresh token',
        message: 'Your session has expired. Please sign in again.',
      });
    }

    const data = await response.json();

    return res.status(200).json({
      accessToken: data.access_token,
      expiresIn: data.expires_in || 3600,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(500).json({
      error: 'Internal error refreshing token',
      message: error.message,
    });
  }
}
