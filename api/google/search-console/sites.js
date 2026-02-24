import { authenticateRequest } from '../../_config.js';
import { getSupabase } from '../../db.js';

/**
 * List the user's Google Search Console properties (sites).
 * Looks for any GSC connection belonging to this user to get the token.
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
      .select('access_token, refresh_token, token_expiry')
      .eq('user_id', auth.user.id)
      .eq('service', 'google_search_console')
      .limit(1)
      .maybeSingle();

    if (!conn?.access_token) {
      return res.status(200).json({ sites: [], needsConnection: true });
    }

    const accessToken = conn.access_token;

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

      if (response.status === 401 || response.status === 403) {
        return res.status(401).json({
          error: 'Authentication error',
          message: 'Please sign in again.',
        });
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
