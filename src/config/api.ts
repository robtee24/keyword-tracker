// API Configuration
// In production (Vercel): relative URLs (same domain)
// In development: localhost via Vite proxy or VITE_API_URL override

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (import.meta.env.PROD) {
    return '';
  }
  // In development, use empty string -- Vite proxy handles /api routes
  return '';
};

export const API_BASE_URL = getApiBaseUrl();

export const API_ENDPOINTS = {
  google: {
    oauth: {
      authorize: `${API_BASE_URL}/api/google/oauth/authorize`,
      callback: `${API_BASE_URL}/api/google/oauth/callback`,
      status: `${API_BASE_URL}/api/google/oauth/status`,
      refresh: `${API_BASE_URL}/api/google/oauth/refresh`,
    },
    searchConsole: {
      keywords: `${API_BASE_URL}/api/google/search-console`,
      daily: `${API_BASE_URL}/api/google/search-console/daily`,
      keywordPages: `${API_BASE_URL}/api/google/search-console/keyword-pages`,
      sites: `${API_BASE_URL}/api/google/search-console/sites`,
      recommendations: `${API_BASE_URL}/api/google/search-console/recommendations`,
      keywordHistory: `${API_BASE_URL}/api/google/search-console/keyword-history`,
      keywordAlerts: `${API_BASE_URL}/api/google/search-console/keyword-alerts`,
    },
    ads: {
      searchVolume: `${API_BASE_URL}/api/google/ads/search-volume`,
    },
  },
  db: {
    completedTasks: `${API_BASE_URL}/api/db/completed-tasks`,
    recommendations: `${API_BASE_URL}/api/db/recommendations`,
    keywordGroups: `${API_BASE_URL}/api/db/keyword-groups`,
    keywordGroupMembers: `${API_BASE_URL}/api/db/keyword-group-members`,
  },
};
