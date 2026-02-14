import { getAccessTokenFromRequest } from '../../_config.js';

/**
 * List the user's Google Search Console properties (sites).
 * Returns verified sites the authenticated user has access to.
 */
export default async function handler(req, res) {
  try {
    const accessToken = getAccessTokenFromRequest(req);

    if (!accessToken) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please sign in with Google to view your Search Console properties.',
      });
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
