import { API_CONFIG } from '../../_config.js';
import { getSupabase, VOLUME_CACHE_DAYS } from '../../db.js';

const ADS_API_VERSION = 'v23';
const ADS_BASE_URL = `https://googleads.googleapis.com/${ADS_API_VERSION}`;

/**
 * Fetch search volume data for a batch of keywords using the
 * Google Ads Keyword Planner API (GenerateKeywordHistoricalMetrics).
 *
 * Now with Supabase caching: volumes are cached and only refreshed
 * when older than VOLUME_CACHE_DAYS (30 days).
 *
 * Accepts optional `siteUrl` in body to key the cache per-site.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { keywords, siteUrl } = req.body || {};
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ error: 'keywords array is required' });
  }

  const cacheKey = siteUrl || '__global__';
  const supabase = getSupabase();

  // 1. Check cache for fresh volumes (batch .in() to avoid URL-length limits)
  let cachedVolumes = {};
  let staleKeywords = [...keywords];

  if (supabase) {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - VOLUME_CACHE_DAYS);

      const allCached = [];
      const batchSize = 50;
      for (let i = 0; i < keywords.length; i += batchSize) {
        const batch = keywords.slice(i, i + batchSize);
        const { data: cached, error: cacheErr } = await supabase
          .from('search_volumes')
          .select('keyword, avg_monthly_searches, competition, competition_index, fetched_at')
          .eq('site_url', cacheKey)
          .in('keyword', batch)
          .gte('fetched_at', cutoff.toISOString());

        if (cacheErr) {
          console.error('Cache batch read error:', cacheErr.message);
        } else if (cached) {
          allCached.push(...cached);
        }
      }

      if (allCached.length > 0) {
        const freshSet = new Set();
        for (const row of allCached) {
          cachedVolumes[row.keyword] = {
            avgMonthlySearches: typeof row.avg_monthly_searches === 'number'
              ? row.avg_monthly_searches
              : parseSearchVolume(row.avg_monthly_searches),
            competition: row.competition,
            competitionIndex: row.competition_index,
          };
          freshSet.add(row.keyword);
        }
        staleKeywords = keywords.filter((kw) => !freshSet.has(kw));
      }
    } catch (cacheErr) {
      console.error('Cache read error (continuing with API):', cacheErr.message);
    }
  }

  // 2. If all keywords are cached and fresh, return immediately
  if (staleKeywords.length === 0) {
    return res.status(200).json({ volumes: cachedVolumes, fromCache: true });
  }

  // 3. Fetch uncached keywords from Google Ads API
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

  if (!developerToken || !customerId || !refreshToken) {
    return res.status(200).json({ volumes: cachedVolumes });
  }

  try {
    const accessToken = await getAccessToken(refreshToken);

    const freshVolumes = {};
    const batches = [];
    for (let i = 0; i < staleKeywords.length; i += 20) {
      batches.push(staleKeywords.slice(i, i + 20));
    }

    for (const batch of batches) {
      try {
        const batchResult = await fetchHistoricalMetrics(accessToken, developerToken, customerId, batch);
        Object.assign(freshVolumes, batchResult);
      } catch (batchErr) {
        console.error('Batch error:', batchErr.message);
      }
    }

    // 4. Save fresh volumes to cache (batch to avoid payload limits)
    if (supabase && Object.keys(freshVolumes).length > 0) {
      try {
        const allRows = Object.entries(freshVolumes).map(([kw, vol]) => ({
          site_url: cacheKey,
          keyword: kw,
          avg_monthly_searches: vol.avgMonthlySearches,
          competition: vol.competition,
          competition_index: vol.competitionIndex,
          fetched_at: new Date().toISOString(),
        }));

        for (let i = 0; i < allRows.length; i += 50) {
          const batch = allRows.slice(i, i + 50);
          const { error: upsertErr } = await supabase
            .from('search_volumes')
            .upsert(batch, { onConflict: 'site_url,keyword' });

          if (upsertErr) {
            console.error('Cache upsert batch error:', upsertErr.message, upsertErr.details);
          }
        }
      } catch (saveErr) {
        console.error('Cache write error (non-fatal):', saveErr.message);
      }
    }

    const allVolumes = { ...cachedVolumes, ...freshVolumes };
    return res.status(200).json({ volumes: allVolumes });
  } catch (error) {
    console.error('Search volume API error:', error);
    // Still return cached results if we have any
    if (Object.keys(cachedVolumes).length > 0) {
      return res.status(200).json({ volumes: cachedVolumes, partial: true });
    }
    return res.status(500).json({
      error: error.message || 'Failed to fetch search volume',
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Get access token from refresh token                                */
/* ------------------------------------------------------------------ */

async function getAccessToken(refreshToken) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: API_CONFIG.google.clientId,
      client_secret: API_CONFIG.google.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => 'unknown');
    throw new Error(`Failed to refresh Google Ads token: ${err}`);
  }

  const data = await response.json();
  return data.access_token;
}

/* ------------------------------------------------------------------ */
/*  Call Keyword Planner API                                           */
/* ------------------------------------------------------------------ */

async function fetchHistoricalMetrics(accessToken, developerToken, customerId, keywords) {
  const url = `${ADS_BASE_URL}/customers/${customerId}:generateKeywordHistoricalMetrics`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      keywords,
      geoTargetConstants: ['geoTargetConstants/2840'],
      keywordPlanNetwork: 'GOOGLE_SEARCH',
      language: 'languageConstants/1000',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error(`Google Ads API error (${response.status}):`, errorText);

    if (response.status === 401 || response.status === 403) {
      throw new Error('Google Ads authentication failed — check developer token and refresh token');
    }
    throw new Error(`Google Ads API error: ${response.status}`);
  }

  const data = await response.json();
  const volumes = {};

  if (data.results) {
    for (const result of data.results) {
      const kw = result.text;
      const metrics = result.keywordMetrics || {};

      volumes[kw] = {
        avgMonthlySearches: parseSearchVolume(metrics.avgMonthlySearches),
        competition: metrics.competition || null,
        competitionIndex: metrics.competitionIndex != null
          ? parseInt(String(metrics.competitionIndex), 10) || null
          : null,
        lowTopOfPageBidMicros: metrics.lowTopOfPageBidMicros != null
          ? parseInt(String(metrics.lowTopOfPageBidMicros), 10) || null
          : null,
        highTopOfPageBidMicros: metrics.highTopOfPageBidMicros != null
          ? parseInt(String(metrics.highTopOfPageBidMicros), 10) || null
          : null,
      };
    }
  }

  return volumes;
}

/**
 * Parse a search volume value that may be a number, a numeric string,
 * a comma-formatted string ("4,400"), or an abbreviated string ("4.4K", "1.2M").
 */
function parseSearchVolume(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value === 0 ? 0 : value || null;

  const str = String(value).trim().replace(/,/g, '');
  if (!str) return null;

  const match = str.match(/^([\d.]+)\s*([km])?$/i);
  if (match) {
    const num = parseFloat(match[1]);
    if (isNaN(num)) return null;
    const suffix = (match[2] || '').toLowerCase();
    if (suffix === 'k') return Math.round(num * 1000);
    if (suffix === 'm') return Math.round(num * 1000000);
    return Math.round(num);
  }

  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? null : parsed;
}
