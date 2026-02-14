import { API_ENDPOINTS } from '../config/api';

const STORAGE_KEYS = {
  accessToken: 'gsc_access_token',
  refreshToken: 'gsc_refresh_token',
  tokenExpiry: 'gsc_token_expiry',
} as const;

/**
 * Store tokens received from the OAuth callback.
 */
export function setTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
  localStorage.setItem(STORAGE_KEYS.accessToken, accessToken);
  if (refreshToken) {
    localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken);
  }
  const expiryTime = Date.now() + expiresIn * 1000;
  localStorage.setItem(STORAGE_KEYS.tokenExpiry, expiryTime.toString());
}

/**
 * Clear all stored tokens (sign out).
 */
export function clearTokens(): void {
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.refreshToken);
  localStorage.removeItem(STORAGE_KEYS.tokenExpiry);
  localStorage.removeItem('gsc_selected_site');
}

/**
 * Check if the user has stored credentials.
 */
export function isAuthenticated(): boolean {
  return !!localStorage.getItem(STORAGE_KEYS.refreshToken);
}

/**
 * Get a valid access token.
 * If the current token is expired, refreshes it using the server-side refresh endpoint.
 */
export async function getAccessToken(): Promise<string | null> {
  const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken);
  const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
  const expiryStr = localStorage.getItem(STORAGE_KEYS.tokenExpiry);

  if (!refreshToken) {
    return null;
  }

  // Check if access token is still valid (with 5 min buffer)
  if (accessToken && expiryStr) {
    const expiry = parseInt(expiryStr, 10);
    if (Date.now() < expiry - 300_000) {
      return accessToken;
    }
  }

  // Access token is expired or missing -- refresh it
  try {
    const response = await fetch(API_ENDPOINTS.google.oauth.refresh, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      // Refresh failed -- clear tokens and force re-auth
      clearTokens();
      return null;
    }

    const data = await response.json();
    const newAccessToken = data.accessToken;
    const expiresIn = data.expiresIn || 3600;

    // Store new access token (keep existing refresh token)
    localStorage.setItem(STORAGE_KEYS.accessToken, newAccessToken);
    const newExpiry = Date.now() + expiresIn * 1000;
    localStorage.setItem(STORAGE_KEYS.tokenExpiry, newExpiry.toString());

    return newAccessToken;
  } catch (error) {
    console.error('Failed to refresh access token:', error);
    return null;
  }
}

/**
 * Make an authenticated fetch request.
 * Automatically attaches the access token as a Bearer token.
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);

  return fetch(url, {
    ...options,
    headers,
  });
}
