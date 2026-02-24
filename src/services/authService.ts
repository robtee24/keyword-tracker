import { supabase } from './supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/app' },
  });
}

export async function signInWithMicrosoft() {
  return supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: { redirectTo: window.location.origin + '/app' },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export function isAuthenticated(): boolean {
  // Synchronous check; for real-time session state, use onAuthStateChange
  return false;
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}

/**
 * Make an authenticated fetch request.
 * Attaches the Supabase JWT as a Bearer token.
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const session = await getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);

  return fetch(url, {
    ...options,
    headers,
  });
}

export function clearTokens(): void {
  localStorage.removeItem('gsc_access_token');
  localStorage.removeItem('gsc_refresh_token');
  localStorage.removeItem('gsc_token_expiry');
  localStorage.removeItem('gsc_selected_site');
}
