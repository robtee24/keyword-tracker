import { authenticateRequest, API_CONFIG } from '../../_config.js';
import { getSupabase } from '../../db.js';

/**
 * List the user's Google Search Console properties (sites).
 * Looks for any GSC connection belonging to this user to get the token.
 * Auto-refreshes expired tokens before calling the Google API.
 */
export default async function handler(req, res) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please sign in to view your Search Console properties.',
      });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { data: conn } = await supabase
      .from('service_connections')
      .select('id, access_token, refresh_token, token_expiry')
      .eq('user_id', auth.user.id)
      .eq('service', 'google_search_console')
      .limit(1)
      .maybeSingle();

    if (!conn?.access_token) {
      return res.status(200).json({ sites: [], needsConnection: true });
    }

    let accessToken = conn.access_token;

    const now = new Date();
    const expiry = conn.token_expiry ? new Date(conn.token_expiry) : null;
    const isExpired = expiry && now >= new Date(expiry.getTime() - 5 * 60 * 1000);

    if (isExpired && conn.refresh_token) {
      const refreshed = await refreshGoogleToken(supabase, conn);
      if (refreshed) {
        accessToken = refreshed;
      } else {
        return res.status(200).json({ sites: [], needsReconnect: true });
      }
    }

    const response = await fetch(
      'https://www.googleapis.com/webmasters/v3/sites',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Sites API error:', response.status, errorText);

      if ((response.status === 401 || response.status === 403) && conn.refresh_token) {
        const refreshed = await refreshGoogleToken(supabase, conn);
        if (refreshed) {
          const retry = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
            headers: { Authorization: `Bearer ${refreshed}` },
          });
          if (retry.ok) {
            const retryData = await retry.json();
            const sites = (retryData.siteEntry || []).map((entry) => ({
              siteUrl: entry.siteUrl,
              permissionLevel: entry.permissionLevel,
            }));
            return res.status(200).json({ sites });
          }
        }
        return res.status(200).json({ sites: [], needsReconnect: true });
      }

      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const sites = (data.siteEntry || []).map((entry) => ({
      siteUrl: entry.siteUrl,
      permissionLevel: entry.permissionLevel,
    }));

    return res.status(200).json({ sites });
  } catch (error) {
    console.error('Sites API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch Search Console sites',
      details: error.message,
    });
  }
}

async function refreshGoogleToken(supabase, connection) {
  try {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!resp.ok) {
      console.error('Token refresh failed:', resp.status);
      return null;
    }

    const tokens = await resp.json();
    const newExpiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

    await supabase
      .from('service_connections')
      .update({
        access_token: tokens.access_token,
        token_expiry: newExpiry.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    return tokens.access_token;
  } catch (err) {
    console.error('Token refresh error:', err.message);
    return null;
  }
}
