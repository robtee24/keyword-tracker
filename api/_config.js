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

const ADS_STANDALONE_PASSWORD = process.env.ADS_STANDALONE_PASSWORD || 'BNBCALC';

/**
 * Validate the Supabase JWT from the Authorization header.
 * Also accepts X-Ads-Auth header for the standalone /ads page,
 * which looks up the BNBCalc project owner as the authenticated user.
 * Returns { user } on success or null on failure.
 */
export async function authenticateRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';

  // Standard Supabase JWT auth
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const supabase = getSupabaseAdmin();
    if (!supabase) return null;
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return { user };
  }

  // Standalone ads page auth via shared password
  const adsAuth = req.headers['x-ads-auth'];
  if (adsAuth && adsAuth === ADS_STANDALONE_PASSWORD) {
    const supabase = getSupabaseAdmin();
    if (!supabase) return null;
    const { data: projects } = await supabase
      .from('projects')
      .select('owner_id')
      .or('domain.ilike.%bnbcalc%,name.ilike.%bnbcalc%')
      .limit(1);
    const ownerId = projects?.[0]?.owner_id;
    if (!ownerId) return null;
    const { data: { user }, error } = await supabase.auth.admin.getUserById(ownerId);
    if (error || !user) return null;
    return { user };
  }

  return null;
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
