import { getSupabase } from './db.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Fetch a valid access token for a given service connection.
 * Auto-refreshes expired Google tokens.
 */
export async function getServiceToken(userId, siteUrl, service) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Database not configured');

  const { data, error } = await supabase
    .from('service_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('site_url', siteUrl)
    .eq('service', service)
    .single();

  if (error || !data) return null;

  const now = new Date();
  const expiry = data.token_expiry ? new Date(data.token_expiry) : null;
  const isExpired = expiry && now >= new Date(expiry.getTime() - 5 * 60 * 1000);

  if (!isExpired) return data.access_token;

  if (!data.refresh_token) return null;

  if (service.startsWith('google')) {
    return refreshGoogleToken(supabase, data);
  }

  return data.access_token;
}

async function refreshGoogleToken(supabase, connection) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: connection.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) return null;

  const tokens = await res.json();
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
}

/**
 * Upsert a service connection after successful OAuth callback.
 */
export async function saveServiceConnection(userId, siteUrl, service, tokenData) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Database not configured');

  const expiry = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  const { error } = await supabase
    .from('service_connections')
    .upsert({
      user_id: userId,
      site_url: siteUrl,
      service,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      token_expiry: expiry,
      account_name: tokenData.account_name || null,
      account_id: tokenData.account_id || null,
      scopes: tokenData.scope || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,site_url,service',
    });

  if (error) throw error;
}

/**
 * Get connection status for all services for a user/site.
 */
export async function getConnectionStatuses(userId, siteUrl) {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('service_connections')
    .select('service, account_name, account_id, connected_at')
    .eq('user_id', userId)
    .eq('site_url', siteUrl);

  if (error) return [];
  return data || [];
}

/**
 * Remove a service connection.
 */
export async function removeServiceConnection(userId, siteUrl, service) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Database not configured');

  const { error } = await supabase
    .from('service_connections')
    .delete()
    .eq('user_id', userId)
    .eq('site_url', siteUrl)
    .eq('service', service);

  if (error) throw error;
}
