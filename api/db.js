import { createClient } from '@supabase/supabase-js';

let _supabase = null;

export function getSupabase() {
  if (_supabase) return _supabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) return null;

  _supabase = createClient(url, key);
  return _supabase;
}

/**
 * 30-day threshold for search volume cache freshness.
 */
export const VOLUME_CACHE_DAYS = 30;
