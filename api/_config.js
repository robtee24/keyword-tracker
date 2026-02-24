import { createClient } from '@supabase/supabase-js';

export const API_CONFIG = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/api/connections/callback`
      : (process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/connections/callback'),
  },
  googleSearchConsole: {
    baseUrl: 'https://www.googleapis.com/webmasters/v3',
  },
};

let _supabaseAdmin = null;

function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  _supabaseAdmin = createClient(url, key);
  return _supabaseAdmin;
}

/**
 * Validate the Supabase JWT from the Authorization header.
 * Returns { user } on success or null on failure.
 */
export async function authenticateRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return { user };
}

/**
 * Legacy helper — still used by routes that haven't migrated yet.
 * Prefer authenticateRequest + getServiceToken for new code.
 */
export function getAccessTokenFromRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}
