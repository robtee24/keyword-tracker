// Shared API Configuration for Vercel Serverless Functions
// Stripped down to Google Search Console only
// Tokens are per-user (sent via Authorization header), not server-side cached

export const API_CONFIG = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/api/google/oauth/callback`
      : (process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/google/oauth/callback'),
  },
  googleSearchConsole: {
    baseUrl: 'https://www.googleapis.com/webmasters/v3',
  },
};

/**
 * Extract access token from the Authorization header.
 * Expects: Authorization: Bearer <token>
 */
export function getAccessTokenFromRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}
