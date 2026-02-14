import { API_CONFIG } from '../../_config.js';

const ADS_API_VERSION = 'v23';
const ADS_BASE_URL = `https://googleads.googleapis.com/${ADS_API_VERSION}`;

/**
 * Fetch search volume data for a batch of keywords using the
 * Google Ads Keyword Planner API (GenerateKeywordHistoricalMetrics).
 *
 * Uses app-level credentials (not per-user) because search volume
 * is the same for everyone.
 *
 * Required env vars:
 *   GOOGLE_ADS_DEVELOPER_TOKEN  – from Google Ads API Center
 *   GOOGLE_ADS_CUSTOMER_ID      – digits only (e.g. 1234567890)
 *   GOOGLE_ADS_REFRESH_TOKEN    – obtained with adwords scope
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { keywords } = req.body || {};
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ error: 'keywords array is required' });
  }

  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

  if (!developerToken || !customerId || !refreshToken) {
    // Gracefully return empty — feature not configured
    return res.status(200).json({ volumes: {} });
  }

  try {
    // 1. Get an access token from the refresh token
    const accessToken = await getAccessToken(refreshToken);

    // 2. Call Keyword Planner in batches of 20
    const allVolumes = {};
    const batches = [];
    for (let i = 0; i < keywords.length; i += 20) {
      batches.push(keywords.slice(i, i + 20));
    }

    for (const batch of batches) {
      try {
        const batchResult = await fetchHistoricalMetrics(accessToken, developerToken, customerId, batch);
        Object.assign(allVolumes, batchResult);
      } catch (batchErr) {
        console.error('Batch error:', batchErr.message);
        // Continue with other batches
      }
    }

    return res.status(200).json({ volumes: allVolumes });
  } catch (error) {
    console.error('Search volume API error:', error);
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
      // Geo target 2840 = USA. Can be made configurable later.
      geoTargetConstants: ['geoTargetConstants/2840'],
      keywordPlanNetwork: 'GOOGLE_SEARCH',
      // Language 1000 = English
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
        avgMonthlySearches: metrics.avgMonthlySearches
          ? parseInt(metrics.avgMonthlySearches, 10)
          : null,
        competition: metrics.competition || null,
        competitionIndex: metrics.competitionIndex
          ? parseInt(metrics.competitionIndex, 10)
          : null,
        lowTopOfPageBidMicros: metrics.lowTopOfPageBidMicros
          ? parseInt(metrics.lowTopOfPageBidMicros, 10)
          : null,
        highTopOfPageBidMicros: metrics.highTopOfPageBidMicros
          ? parseInt(metrics.highTopOfPageBidMicros, 10)
          : null,
      };
    }
  }

  return volumes;
}
