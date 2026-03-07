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
  projects: {
    list: `${API_BASE_URL}/api/projects`,
    create: `${API_BASE_URL}/api/projects`,
    update: `${API_BASE_URL}/api/projects`,
    delete: `${API_BASE_URL}/api/projects`,
    members: `${API_BASE_URL}/api/projects/members`,
  },
  connections: {
    authorize: `${API_BASE_URL}/api/connections/authorize`,
    callback: `${API_BASE_URL}/api/connections/callback`,
    status: `${API_BASE_URL}/api/connections/status`,
    disconnect: `${API_BASE_URL}/api/connections/disconnect`,
  },
  google: {
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
  ai: {
    analyzeSite: `${API_BASE_URL}/api/ai/analyze-site`,
    classifyIntents: `${API_BASE_URL}/api/ai/classify-intents`,
  },
  audit: {
    sitemap: `${API_BASE_URL}/api/audit/sitemap`,
    run: `${API_BASE_URL}/api/audit/run`,
    runBatch: `${API_BASE_URL}/api/audit/run-batch`,
    runMulti: `${API_BASE_URL}/api/audit/run-multi`,
    runAdAudit: `${API_BASE_URL}/api/audit/run-ad-audit`,
    classifyPages: `${API_BASE_URL}/api/audit/classify-pages`,
  },
  advertising: {
    generate: `${API_BASE_URL}/api/advertising/generate`,
    generateAd: `${API_BASE_URL}/api/advertising/generate-ad`,
    generateImage: `${API_BASE_URL}/api/advertising/generate-image`,
  },
  blog: {
    detect: `${API_BASE_URL}/api/blog/detect`,
    audit: `${API_BASE_URL}/api/blog/audit`,
    opportunities: `${API_BASE_URL}/api/blog/opportunities`,
    generate: `${API_BASE_URL}/api/blog/generate`,
    generateImages: `${API_BASE_URL}/api/blog/generate-images`,
    generateBrief: `${API_BASE_URL}/api/blog/generate-brief`,
    modify: `${API_BASE_URL}/api/blog/modify`,
  },
  social: {
    audit: `${API_BASE_URL}/api/social/audit`,
    ideas: `${API_BASE_URL}/api/social/ideas`,
    generate: `${API_BASE_URL}/api/social/generate`,
    generateVideo: `${API_BASE_URL}/api/social/generate-video`,
    generateImage: `${API_BASE_URL}/api/social/generate-image`,
  },
  brand: {
    crawl: `${API_BASE_URL}/api/brand/crawl`,
    guidelines: `${API_BASE_URL}/api/brand/guidelines`,
  },
  build: {
    crawl: `${API_BASE_URL}/api/build/crawl`,
    rebuild: `${API_BASE_URL}/api/build/rebuild`,
    modifyPage: `${API_BASE_URL}/api/build/modify-page`,
    suggestPages: `${API_BASE_URL}/api/build/suggest-pages`,
    createPage: `${API_BASE_URL}/api/build/create-page`,
  },
  plans: {
    current: `${API_BASE_URL}/api/plans/current`,
    check: `${API_BASE_URL}/api/plans/check`,
  },
  db: {
    completedTasks: `${API_BASE_URL}/api/db/completed-tasks`,
    recommendations: `${API_BASE_URL}/api/db/recommendations`,
    keywordGroups: `${API_BASE_URL}/api/db/keyword-groups`,
    keywordGroupMembers: `${API_BASE_URL}/api/db/keyword-group-members`,
    keywords: `${API_BASE_URL}/api/db/keywords`,
    searchVolumes: `${API_BASE_URL}/api/db/search-volumes`,
    keywordIntents: `${API_BASE_URL}/api/db/keyword-intents`,
    pageAudits: `${API_BASE_URL}/api/db/page-audits`,
    adKeywords: `${API_BASE_URL}/api/db/ad-keywords`,
    blogUrls: `${API_BASE_URL}/api/db/blog-urls`,
    blogAudits: `${API_BASE_URL}/api/db/blog-audits`,
    blogOpportunities: `${API_BASE_URL}/api/db/blog-opportunities`,
    blogArticles: `${API_BASE_URL}/api/db/blog-articles`,
    blogSchedules: `${API_BASE_URL}/api/db/blog-schedules`,
    buildResults: `${API_BASE_URL}/api/db/build-results`,
    buildSuggestions: `${API_BASE_URL}/api/db/build-suggestions`,
    socialAudits: `${API_BASE_URL}/api/db/social-audits`,
    socialIdeas: `${API_BASE_URL}/api/db/social-ideas`,
    socialPosts: `${API_BASE_URL}/api/db/social-posts`,
    brand: `${API_BASE_URL}/api/db/brand`,
  },
};
