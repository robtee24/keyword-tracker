import { useState, useEffect, useCallback } from 'react';
import { authenticatedFetch } from '../services/authService';
import { API_ENDPOINTS } from '../config/api';
import { logActivity } from '../utils/activityLog';

type SocialPlatform = 'instagram' | 'linkedin' | 'x' | 'facebook' | 'tiktok' | 'pinterest';
type SocialTab = 'audit' | 'ideas' | 'create';

const PLATFORM_CONNECTION_MAP: Record<SocialPlatform, string> = {
  instagram: 'instagram',
  linkedin: 'linkedin_social',
  x: 'x_twitter',
  facebook: 'facebook',
  tiktok: 'tiktok_social',
  pinterest: 'pinterest',
};

interface Recommendation {
  priority: string;
  category: string;
  issue: string;
  recommendation: string;
  howToFix: string;
  impact: string;
}

interface AuditResult {
  score: number;
  summary: string;
  strengths: string[];
  recommendations: Recommendation[];
}

interface SavedAudit {
  id: string;
  platform: string;
  urls: string[];
  score: number;
  summary: string;
  strengths: string[];
  recommendations: Recommendation[];
  audited_at: string;
}

interface PostIdea {
  title: string;
  hook: string;
  outline: string;
  format: string;
  hashtags: string[];
  bestTime: string;
  pillar: string;
  whyItWorks: string;
}

interface IdeaBatch {
  id: string;
  platform: string;
  ideas: PostIdea[];
  created_at: string;
}

interface GeneratedPost {
  content: string;
  hashtags: string[];
  format: string;
  charCount: number;
  tips: string;
  bestTime: string;
}

interface SavedPost {
  id: string;
  platform: string;
  post_type: string;
  topic: string;
  content: string;
  metadata: any;
  status: string;
  created_at: string;
}

const PLATFORM_CONFIG: Record<SocialPlatform, {
  name: string;
  color: string;
  bgColor: string;
  formats: string[];
  charLimit: number;
  description: string;
  profilePlaceholder: string;
}> = {
  instagram: { name: 'Instagram', color: 'text-pink-600', bgColor: 'bg-pink-50', formats: ['Reel Script', 'Carousel Slides', 'Single Post', 'Story Sequence'], charLimit: 2200, description: 'Visual content, Reels, Carousels, and Stories', profilePlaceholder: 'https://instagram.com/yourbrand' },
  linkedin: { name: 'LinkedIn', color: 'text-blue-700', bgColor: 'bg-blue-50', formats: ['Text Post', 'Carousel Slides', 'Article', 'Poll'], charLimit: 3000, description: 'Professional content and thought leadership', profilePlaceholder: 'https://linkedin.com/company/yourbrand' },
  x: { name: 'X (Twitter)', color: 'text-gray-900', bgColor: 'bg-gray-50', formats: ['Single Tweet', 'Thread', 'Poll'], charLimit: 280, description: 'Short-form content, threads, and real-time engagement', profilePlaceholder: 'https://x.com/yourbrand' },
  facebook: { name: 'Facebook', color: 'text-blue-600', bgColor: 'bg-blue-50', formats: ['Text Post', 'Photo Caption', 'Video Post', 'Poll'], charLimit: 63206, description: 'Community engagement and native video', profilePlaceholder: 'https://facebook.com/yourbrand' },
  tiktok: { name: 'TikTok', color: 'text-gray-900', bgColor: 'bg-gray-50', formats: ['Video Script', 'Photo Carousel Caption'], charLimit: 4000, description: 'Short-form video scripts and captions', profilePlaceholder: 'https://tiktok.com/@yourbrand' },
  pinterest: { name: 'Pinterest', color: 'text-red-600', bgColor: 'bg-red-50', formats: ['Pin Description', 'Idea Pin Sequence'], charLimit: 500, description: 'Visual discovery and SEO-rich descriptions', profilePlaceholder: 'https://pinterest.com/yourbrand' },
};

const VIDEO_FORMATS = new Set(['Reel Script', 'Video Script', 'Video Post', 'Story Sequence']);

const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  low: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
};

const PILLAR_COLORS: Record<string, string> = {
  industry: 'bg-indigo-100 text-indigo-700',
  'behind-the-scenes': 'bg-purple-100 text-purple-700',
  educational: 'bg-cyan-100 text-cyan-700',
  personal: 'bg-amber-100 text-amber-700',
  promotional: 'bg-green-100 text-green-700',
};

interface SocialPlatformViewProps {
  siteUrl: string;
  projectId: string;
  platform: SocialPlatform;
}

export default function SocialPlatformView({ siteUrl, projectId, platform }: SocialPlatformViewProps) {
  const config = PLATFORM_CONFIG[platform];
  const [activeTab, setActiveTab] = useState<SocialTab>('audit');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionLoading, setConnectionLoading] = useState(true);

  // State for idea-to-create flow
  const [prefillPostType, setPrefillPostType] = useState<string | null>(null);
  const [prefillTopic, setPrefillTopic] = useState<string | null>(null);
  const [prefillIdeaContext, setPrefillIdeaContext] = useState<{ hook: string; outline: string } | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const resp = await authenticatedFetch(
          `${API_ENDPOINTS.connections.status}?site_url=${encodeURIComponent(siteUrl)}`
        );
        if (resp.ok) {
          const data = await resp.json();
          const serviceId = PLATFORM_CONNECTION_MAP[platform];
          const conn = (data.connections || []).find((c: any) => c.service === serviceId);
          setIsConnected(!!conn);
        }
      } catch { /* */ }
      setConnectionLoading(false);
    };
    checkConnection();
  }, [siteUrl, platform]);

  const handleGenerateFromIdea = (idea: PostIdea) => {
    setPrefillPostType(idea.format);
    setPrefillTopic(idea.title);
    setPrefillIdeaContext({ hook: idea.hook, outline: idea.outline });
    setActiveTab('create');
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-apple-text mb-1">{config.name}</h2>
        <p className="text-apple-sm text-apple-text-secondary">{config.description}</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-apple-divider">
        {([
          { id: 'audit' as SocialTab, label: 'Audit Posts', icon: '📊' },
          { id: 'ideas' as SocialTab, label: 'Post Ideas', icon: '💡' },
          { id: 'create' as SocialTab, label: 'Create Post', icon: '✏️' },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-apple-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-apple-blue text-apple-blue'
                : 'border-transparent text-apple-text-secondary hover:text-apple-text hover:border-apple-divider'
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'audit' && <AuditTab siteUrl={siteUrl} projectId={projectId} platform={platform} config={config} isConnected={isConnected} />}
      {activeTab === 'ideas' && <IdeasTab siteUrl={siteUrl} projectId={projectId} platform={platform} config={config} onGenerateFromIdea={handleGenerateFromIdea} />}
      {activeTab === 'create' && (
        <CreateTab
          siteUrl={siteUrl}
          projectId={projectId}
          platform={platform}
          config={config}
          isConnected={isConnected}
          connectionLoading={connectionLoading}
          prefillPostType={prefillPostType}
          prefillTopic={prefillTopic}
          prefillIdeaContext={prefillIdeaContext}
          onPrefillConsumed={() => { setPrefillPostType(null); setPrefillTopic(null); setPrefillIdeaContext(null); }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AUDIT TAB
   ═══════════════════════════════════════════════════════════════ */

function AuditTab({ siteUrl, projectId, platform, config, isConnected }: {
  siteUrl: string; projectId: string; platform: SocialPlatform;
  config: typeof PLATFORM_CONFIG[SocialPlatform]; isConnected: boolean;
}) {
  const [profileUrl, setProfileUrl] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [savedAudits, setSavedAudits] = useState<SavedAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAudit, setExpandedAudit] = useState<string | null>(null);
  const [expandedRecs, setExpandedRecs] = useState<Set<string>>(new Set());

  const loadSavedAudits = useCallback(async () => {
    try {
      const resp = await authenticatedFetch(
        `${API_ENDPOINTS.db.socialAudits}?siteUrl=${encodeURIComponent(siteUrl)}&projectId=${projectId}&platform=${platform}`
      );
      if (resp.ok) {
        const data = await resp.json();
        setSavedAudits(data.audits || []);
      }
    } catch { /* */ }
    setLoading(false);
  }, [siteUrl, projectId, platform]);

  useEffect(() => { loadSavedAudits(); }, [loadSavedAudits]);

  const runAudit = async () => {
    if (!profileUrl.trim()) return;
    setRunning(true);
    setResult(null);
    try {
      const resp = await authenticatedFetch(API_ENDPOINTS.social.audit, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, projectId, platform, profileUrl: profileUrl.trim() }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setResult(data);
        await loadSavedAudits();
        logActivity(siteUrl, 'social', 'audit', `${config.name} audit: ${profileUrl}, score: ${data.score}/100`);
      }
    } catch { /* */ }
    setRunning(false);
  };

  const deleteAudit = async (id: string) => {
    await authenticatedFetch(API_ENDPOINTS.db.socialAudits, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, projectId }),
    });
    setSavedAudits((prev) => prev.filter((a) => a.id !== id));
  };

  const toggleRec = (key: string) => setExpandedRecs((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const scoreColor = (s: number) => s >= 80 ? 'text-green-600' : s >= 60 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = (s: number) => s >= 80 ? 'bg-green-50 border-green-200' : s >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  const renderRecommendations = (recs: Recommendation[], prefix: string) => (
    <div className="space-y-2">
      {recs.map((rec, i) => {
        const key = `${prefix}-${i}`;
        const pc = PRIORITY_COLORS[rec.priority] || PRIORITY_COLORS.low;
        const isExp = expandedRecs.has(key);
        return (
          <div key={key} className={`rounded-apple-sm border ${pc.border} ${pc.bg} overflow-hidden`}>
            <div className="p-3 flex items-start gap-2 cursor-pointer" onClick={() => toggleRec(key)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] font-bold uppercase ${pc.text}`}>{rec.priority}</span>
                  <span className="text-[10px] text-apple-text-tertiary">{rec.category}</span>
                </div>
                <p className="text-apple-xs font-medium text-apple-text">{rec.issue}</p>
              </div>
              <svg className={`w-3.5 h-3.5 text-apple-text-tertiary transition-transform shrink-0 mt-1 ${isExp ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </div>
            {isExp && (
              <div className="px-3 pb-3 border-t border-apple-divider/30 pt-2 space-y-1.5">
                <div><p className="text-[10px] font-semibold text-apple-text-secondary">Recommendation</p><p className="text-apple-xs text-apple-text mt-0.5">{rec.recommendation}</p></div>
                {rec.howToFix && <div><p className="text-[10px] font-semibold text-apple-text-secondary">How to Fix</p><p className="text-apple-xs text-apple-text mt-0.5 whitespace-pre-wrap">{rec.howToFix}</p></div>}
                {rec.impact && <div><p className="text-[10px] font-semibold text-apple-text-secondary">Impact</p><p className="text-apple-xs text-apple-text-secondary mt-0.5">{rec.impact}</p></div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      {/* Input Section */}
      <div className="rounded-apple border border-apple-divider bg-white p-5 mb-6">
        <h3 className="text-apple-sm font-semibold text-apple-text mb-1">Audit your {config.name} content</h3>
        <p className="text-apple-xs text-apple-text-tertiary mb-4">
          {isConnected
            ? `Your ${config.name} account is connected. Posts will be fetched automatically via API.`
            : `Paste a link to your ${config.name} profile or page to crawl and audit your recent posts.`
          }
        </p>

        <div className="flex gap-3">
          <input
            type="url"
            value={profileUrl}
            onChange={(e) => setProfileUrl(e.target.value)}
            placeholder={config.profilePlaceholder}
            className="flex-1 px-3 py-2 rounded-apple-sm border border-apple-border text-apple-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue"
            onKeyDown={(e) => { if (e.key === 'Enter') runAudit(); }}
          />
          <button onClick={runAudit} disabled={running || !profileUrl.trim()}
            className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50 whitespace-nowrap">
            {running ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Auditing...
              </span>
            ) : 'Audit Posts'}
          </button>
        </div>
      </div>

      {/* Live Result */}
      {result && (
        <div className="rounded-apple border border-apple-divider bg-white p-5 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className={`text-3xl font-bold ${scoreColor(result.score)}`}>{result.score}<span className="text-lg text-apple-text-tertiary">/100</span></div>
            <div className="flex-1">
              <p className="text-apple-sm text-apple-text">{result.summary}</p>
            </div>
          </div>
          {result.strengths?.length > 0 && (
            <div className={`rounded-apple-sm border p-3 mb-4 ${scoreBg(result.score)}`}>
              <p className="text-[10px] font-semibold text-apple-text-secondary uppercase tracking-wider mb-1.5">Strengths</p>
              <ul className="space-y-1">
                {result.strengths.map((s, i) => (
                  <li key={i} className="text-apple-xs text-apple-text flex items-start gap-1.5">
                    <span className="text-green-500 mt-0.5 shrink-0">✓</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.recommendations?.length > 0 && renderRecommendations(result.recommendations, 'live')}
        </div>
      )}

      {/* Saved Audits */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : savedAudits.length > 0 && (
        <div>
          <h3 className="text-apple-sm font-semibold text-apple-text-secondary uppercase tracking-wider mb-3">Audit History</h3>
          <div className="space-y-3">
            {savedAudits.map((audit) => {
              const isExp = expandedAudit === audit.id;
              return (
                <div key={audit.id} className="rounded-apple border border-apple-divider bg-white overflow-hidden">
                  <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-apple-fill-secondary/30 transition-colors" onClick={() => setExpandedAudit(isExp ? null : audit.id)}>
                    <span className={`text-lg font-bold ${scoreColor(audit.score)}`}>{audit.score}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-apple-sm text-apple-text truncate">{audit.summary}</p>
                      <p className="text-apple-xs text-apple-text-tertiary">
                        {new Date(audit.audited_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        {' · '}{audit.recommendations?.length || 0} recommendations
                      </p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this audit?')) deleteAudit(audit.id); }}
                      className="p-1.5 rounded hover:bg-red-50 text-apple-text-tertiary hover:text-red-500 transition-colors shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    <svg className={`w-4 h-4 text-apple-text-tertiary transition-transform ${isExp ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                  {isExp && (
                    <div className="border-t border-apple-divider p-4 space-y-3">
                      {audit.strengths?.length > 0 && (
                        <div className={`rounded-apple-sm border p-3 ${scoreBg(audit.score)}`}>
                          <p className="text-[10px] font-semibold text-apple-text-secondary uppercase mb-1">Strengths</p>
                          <ul className="space-y-1">{audit.strengths.map((s, i) => <li key={i} className="text-apple-xs text-apple-text">✓ {s}</li>)}</ul>
                        </div>
                      )}
                      {audit.recommendations?.length > 0 && renderRecommendations(audit.recommendations, audit.id)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && savedAudits.length === 0 && !result && (
        <div className="card p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-apple-fill-secondary mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl">📊</span>
          </div>
          <h3 className="text-apple-base font-semibold text-apple-text mb-1">No audits yet</h3>
          <p className="text-apple-sm text-apple-text-secondary">Paste a link to your {config.name} profile above to audit your recent posts.</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   IDEAS TAB
   ═══════════════════════════════════════════════════════════════ */

function IdeasTab({ siteUrl, projectId, platform, config, onGenerateFromIdea }: {
  siteUrl: string; projectId: string; platform: SocialPlatform;
  config: typeof PLATFORM_CONFIG[SocialPlatform]; onGenerateFromIdea: (idea: PostIdea) => void;
}) {
  const [niche, setNiche] = useState('');
  const [audience, setAudience] = useState('');
  const [voice, setVoice] = useState('');
  const [topics, setTopics] = useState('');
  const [running, setRunning] = useState(false);
  const [ideas, setIdeas] = useState<PostIdea[]>([]);
  const [savedBatches, setSavedBatches] = useState<IdeaBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [expandedIdea, setExpandedIdea] = useState<string | null>(null);

  const loadSavedBatches = useCallback(async () => {
    try {
      const resp = await authenticatedFetch(
        `${API_ENDPOINTS.db.socialIdeas}?siteUrl=${encodeURIComponent(siteUrl)}&projectId=${projectId}&platform=${platform}`
      );
      if (resp.ok) {
        const data = await resp.json();
        setSavedBatches(data.batches || []);
      }
    } catch { /* */ }
    setLoading(false);
  }, [siteUrl, projectId, platform]);

  useEffect(() => { loadSavedBatches(); }, [loadSavedBatches]);

  const generateIdeas = async () => {
    setRunning(true);
    setIdeas([]);
    try {
      const resp = await authenticatedFetch(API_ENDPOINTS.social.ideas, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl, projectId, platform,
          context: { niche, audience, voice, topics },
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setIdeas(data.ideas || []);
        await loadSavedBatches();
        logActivity(siteUrl, 'social', 'ideas', `Generated ${(data.ideas || []).length} ${config.name} post ideas`);
      }
    } catch { /* */ }
    setRunning(false);
  };

  const deleteBatch = async (id: string) => {
    await authenticatedFetch(API_ENDPOINTS.db.socialIdeas, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, projectId }),
    });
    setSavedBatches((prev) => prev.filter((b) => b.id !== id));
  };

  const renderIdea = (idea: PostIdea, key: string) => {
    const isExp = expandedIdea === key;
    const pillarClass = PILLAR_COLORS[idea.pillar] || 'bg-gray-100 text-gray-700';
    return (
      <div key={key} className="rounded-apple-sm border border-apple-divider bg-white overflow-hidden">
        <div className="p-3 cursor-pointer hover:bg-apple-fill-secondary/30 transition-colors" onClick={() => setExpandedIdea(isExp ? null : key)}>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${pillarClass}`}>{idea.pillar}</span>
                <span className="text-[10px] text-apple-text-tertiary">{idea.format}</span>
              </div>
              <p className="text-apple-sm font-medium text-apple-text">{idea.title}</p>
              <p className="text-apple-xs text-apple-text-secondary mt-0.5 italic">"{idea.hook}"</p>
            </div>
            <svg className={`w-3.5 h-3.5 text-apple-text-tertiary transition-transform shrink-0 mt-1 ${isExp ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
        {isExp && (
          <div className="px-3 pb-3 border-t border-apple-divider/30 pt-2 space-y-2">
            <div><p className="text-[10px] font-semibold text-apple-text-secondary">Outline</p><p className="text-apple-xs text-apple-text mt-0.5 whitespace-pre-wrap">{idea.outline}</p></div>
            <div><p className="text-[10px] font-semibold text-apple-text-secondary">Why It Works</p><p className="text-apple-xs text-apple-text-secondary mt-0.5">{idea.whyItWorks}</p></div>
            {idea.hashtags?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {idea.hashtags.map((h, i) => <span key={i} className="text-[10px] text-apple-blue">#{h.replace(/^#/, '')}</span>)}
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-apple-text-tertiary">Best time: {idea.bestTime}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onGenerateFromIdea(idea); }}
                className="px-3 py-1.5 rounded-apple-sm bg-apple-blue text-white text-apple-xs font-medium hover:bg-apple-blue-hover transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                Generate This Post
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Context Form */}
      <div className="rounded-apple border border-apple-divider bg-white p-5 mb-6">
        <h3 className="text-apple-sm font-semibold text-apple-text mb-1">Generate {config.name} Post Ideas</h3>
        <p className="text-apple-xs text-apple-text-tertiary mb-4">Provide context about your brand to get tailored ideas. All fields are optional.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1">Niche / Industry</label>
            <input type="text" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g., SaaS, fitness, real estate" className="w-full px-3 py-2 rounded-apple-sm border border-apple-border text-apple-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue" />
          </div>
          <div>
            <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1">Target Audience</label>
            <input type="text" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g., startup founders, marketers" className="w-full px-3 py-2 rounded-apple-sm border border-apple-border text-apple-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue" />
          </div>
          <div>
            <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1">Brand Voice</label>
            <input type="text" value={voice} onChange={(e) => setVoice(e.target.value)} placeholder="e.g., professional, witty, casual" className="w-full px-3 py-2 rounded-apple-sm border border-apple-border text-apple-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue" />
          </div>
          <div>
            <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1">Focus Topics</label>
            <input type="text" value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="e.g., SEO tips, growth hacking" className="w-full px-3 py-2 rounded-apple-sm border border-apple-border text-apple-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue" />
          </div>
        </div>
        <button onClick={generateIdeas} disabled={running}
          className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50">
          {running ? 'Generating...' : 'Generate Ideas'}
        </button>
      </div>

      {/* Live Ideas */}
      {ideas.length > 0 && (
        <div className="mb-6">
          <h3 className="text-apple-sm font-semibold text-apple-text mb-3">Generated Ideas</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ideas.map((idea, i) => renderIdea(idea, `live-${i}`))}
          </div>
        </div>
      )}

      {/* Saved Batches */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : savedBatches.length > 0 && (
        <div>
          <h3 className="text-apple-sm font-semibold text-apple-text-secondary uppercase tracking-wider mb-3">Idea History</h3>
          <div className="space-y-3">
            {savedBatches.map((batch) => {
              const isExp = expandedBatch === batch.id;
              return (
                <div key={batch.id} className="rounded-apple border border-apple-divider bg-white overflow-hidden">
                  <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-apple-fill-secondary/30 transition-colors" onClick={() => setExpandedBatch(isExp ? null : batch.id)}>
                    <span className="text-lg">💡</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-apple-sm font-medium text-apple-text">{batch.ideas?.length || 0} ideas generated</p>
                      <p className="text-apple-xs text-apple-text-tertiary">{new Date(batch.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete these ideas?')) deleteBatch(batch.id); }}
                      className="p-1.5 rounded hover:bg-red-50 text-apple-text-tertiary hover:text-red-500 transition-colors shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    <svg className={`w-4 h-4 text-apple-text-tertiary transition-transform ${isExp ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                  {isExp && (
                    <div className="border-t border-apple-divider p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(batch.ideas || []).map((idea: PostIdea, i: number) => renderIdea(idea, `${batch.id}-${i}`))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && savedBatches.length === 0 && ideas.length === 0 && (
        <div className="card p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-apple-fill-secondary mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl">💡</span>
          </div>
          <h3 className="text-apple-base font-semibold text-apple-text mb-1">No ideas yet</h3>
          <p className="text-apple-sm text-apple-text-secondary">Add context about your brand above and generate AI-powered {config.name} post ideas.</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CREATE TAB
   ═══════════════════════════════════════════════════════════════ */

function CreateTab({ siteUrl, projectId, platform, config, isConnected, connectionLoading, prefillPostType, prefillTopic, prefillIdeaContext, onPrefillConsumed }: {
  siteUrl: string; projectId: string; platform: SocialPlatform;
  config: typeof PLATFORM_CONFIG[SocialPlatform]; isConnected: boolean; connectionLoading: boolean;
  prefillPostType: string | null; prefillTopic: string | null;
  prefillIdeaContext: { hook: string; outline: string } | null;
  onPrefillConsumed: () => void;
}) {
  const [postType, setPostType] = useState(config.formats[0]);
  const [topic, setTopic] = useState('');
  const [ideaContext, setIdeaContext] = useState<{ hook: string; outline: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [generated, setGenerated] = useState<GeneratedPost | null>(null);
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishTooltip, setPublishTooltip] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);

  const isVideoFormat = VIDEO_FORMATS.has(postType);

  // Handle prefill from Ideas tab
  useEffect(() => {
    if (prefillPostType || prefillTopic || prefillIdeaContext) {
      if (prefillPostType && config.formats.includes(prefillPostType)) {
        setPostType(prefillPostType);
      }
      if (prefillTopic) setTopic(prefillTopic);
      if (prefillIdeaContext) setIdeaContext(prefillIdeaContext);
      onPrefillConsumed();
    }
  }, [prefillPostType, prefillTopic, prefillIdeaContext, config.formats, onPrefillConsumed]);

  const loadSavedPosts = useCallback(async () => {
    try {
      const resp = await authenticatedFetch(
        `${API_ENDPOINTS.db.socialPosts}?siteUrl=${encodeURIComponent(siteUrl)}&projectId=${projectId}&platform=${platform}`
      );
      if (resp.ok) {
        const data = await resp.json();
        setSavedPosts(data.posts || []);
      }
    } catch { /* */ }
    setLoading(false);
  }, [siteUrl, projectId, platform]);

  useEffect(() => { loadSavedPosts(); }, [loadSavedPosts]);

  const generatePost = async () => {
    if (!topic.trim()) return;
    setRunning(true);
    setGenerated(null);
    try {
      const resp = await authenticatedFetch(API_ENDPOINTS.social.generate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, projectId, platform, postType, topic, ideaContext }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setGenerated(data);
        setIdeaContext(null);
        await loadSavedPosts();
        logActivity(siteUrl, 'social', 'generate', `Generated ${config.name} ${postType}: "${topic.slice(0, 50)}"`);
      }
    } catch { /* */ }
    setRunning(false);
  };

  const generateVideo = async () => {
    if (!generated?.content) return;
    setGeneratingVideo(true);
    setVideoUrl(null);
    setVideoError(null);
    try {
      const videoPrompt = `Create a visually engaging social media video for ${config.name}: ${generated.content.slice(0, 500)}`;
      const resp = await authenticatedFetch(API_ENDPOINTS.social.generateVideo, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, prompt: videoPrompt }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.error) {
          setVideoError(data.error);
        } else {
          setVideoUrl(data.videoUrl);
          logActivity(siteUrl, 'social', 'video', `Generated ${config.name} video for: "${topic.slice(0, 50)}"`);
        }
      }
    } catch {
      setVideoError('Failed to generate video. Please try again.');
    }
    setGeneratingVideo(false);
  };

  const downloadVideo = () => {
    if (!videoUrl) return;
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = `${platform}-video-${Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* */ }
  };

  const handlePublish = async () => {
    if (!isConnected || !generated) return;
    setPublishing(true);
    // Placeholder: when API publishing is implemented, this will call the publish endpoint
    setTimeout(() => {
      setPublishing(false);
      alert(`Publishing to ${config.name} is not yet available. This feature will be enabled once ${config.name} API integration is complete.`);
    }, 500);
  };

  const deletePost = async (id: string) => {
    await authenticatedFetch(API_ENDPOINTS.db.socialPosts, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, projectId }),
    });
    setSavedPosts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div>
      {/* Create Form */}
      <div className="rounded-apple border border-apple-divider bg-white p-5 mb-6">
        <h3 className="text-apple-sm font-semibold text-apple-text mb-1">Create a {config.name} Post</h3>
        <p className="text-apple-xs text-apple-text-tertiary mb-4">
          Select a format and describe what you want to post about.
          {ideaContext && <span className="text-apple-blue font-medium ml-1">Pre-filled from idea.</span>}
        </p>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1.5">Post Format</label>
            <div className="flex flex-wrap gap-2">
              {config.formats.map((fmt) => (
                <button key={fmt} onClick={() => setPostType(fmt)}
                  className={`px-3 py-1.5 rounded-apple-sm text-apple-xs font-medium transition-all ${
                    postType === fmt ? 'bg-apple-blue text-white' : 'border border-apple-border text-apple-text-secondary hover:border-apple-blue/40'
                  }`}>
                  {fmt}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1.5">Topic / Brief</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={`What should this ${postType.toLowerCase()} be about? Be specific for better results...`}
              rows={3}
              className="w-full px-3 py-2 rounded-apple-sm border border-apple-border text-apple-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue resize-none"
            />
          </div>
        </div>

        <button onClick={generatePost} disabled={running || !topic.trim()}
          className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50">
          {running ? 'Generating...' : `Generate ${postType}`}
        </button>
      </div>

      {/* Generated Result */}
      {generated && (
        <div className="rounded-apple border border-apple-divider bg-white p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-apple-sm font-semibold text-apple-text">Generated {postType}</h3>
            <div className="flex items-center gap-2">
              <span className="text-apple-xs text-apple-text-tertiary">{generated.charCount} chars</span>
              <button onClick={() => copyToClipboard(generated.content)}
                className={`px-3 py-1.5 rounded-apple-sm text-apple-xs font-medium transition-colors ${
                  copied ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-apple-fill-secondary text-apple-text hover:bg-gray-200'
                }`}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="rounded-apple-sm border border-apple-divider bg-apple-fill-secondary/30 p-4 mb-4 whitespace-pre-wrap text-apple-sm text-apple-text font-mono leading-relaxed">
            {generated.content}
          </div>

          {generated.hashtags?.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold text-apple-text-secondary uppercase mb-1">Hashtags</p>
              <div className="flex flex-wrap gap-1.5">
                {generated.hashtags.map((h, i) => <span key={i} className="text-apple-xs text-apple-blue font-medium">#{h.replace(/^#/, '')}</span>)}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 text-apple-xs text-apple-text-tertiary mb-4">
            {generated.bestTime && <span>Best time: {generated.bestTime}</span>}
            {generated.tips && <span>{generated.tips}</span>}
          </div>

          {/* Publish Button */}
          <div className="flex items-center gap-3">
            <button onClick={() => copyToClipboard(generated.content)}
              className="px-4 py-2 rounded-apple-sm border border-apple-border text-apple-sm font-medium text-apple-text hover:bg-apple-fill-secondary transition-colors">
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                Copy to Clipboard
              </span>
            </button>

            <div className="relative">
              {!connectionLoading && !isConnected ? (
                <div
                  onMouseEnter={() => setPublishTooltip(true)}
                  onMouseLeave={() => setPublishTooltip(false)}
                  className="relative"
                >
                  <button disabled className="px-4 py-2 rounded-apple-sm bg-gray-100 text-gray-400 text-apple-sm font-medium cursor-not-allowed flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Publish
                  </button>
                  {publishTooltip && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-apple-xs rounded-apple-sm whitespace-nowrap shadow-lg z-10">
                      Please connect {config.name} Access
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-800 rotate-45" />
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={handlePublish} disabled={publishing || connectionLoading}
                  className="px-4 py-2 rounded-apple-sm bg-green-600 text-white text-apple-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                  {publishing ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  )}
                  Publish
                </button>
              )}
            </div>
          </div>

          {/* Video Generation for video formats */}
          {isVideoFormat && (
            <div className="mt-4 rounded-apple-sm border border-apple-divider bg-apple-fill-secondary/20 p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="text-apple-sm font-semibold text-apple-text flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Generate Video
                  </h4>
                  <p className="text-apple-xs text-apple-text-tertiary mt-0.5">Create an AI-generated video based on your post content using LTX Video.</p>
                </div>
                <button onClick={generateVideo} disabled={generatingVideo}
                  className="px-4 py-2 rounded-apple-sm bg-purple-600 text-white text-apple-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0">
                  {generatingVideo ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating Video...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Generate Video
                    </>
                  )}
                </button>
              </div>

              {videoError && (
                <div className="mt-3 rounded-apple-sm border border-red-200 bg-red-50 p-3">
                  <p className="text-apple-xs text-red-700">{videoError}</p>
                </div>
              )}

              {videoUrl && (
                <div className="mt-3 space-y-3">
                  <video
                    src={videoUrl}
                    controls
                    className="w-full max-w-lg rounded-apple-sm border border-apple-divider"
                  />
                  <button onClick={downloadVideo}
                    className="px-4 py-2 rounded-apple-sm border border-apple-border text-apple-sm font-medium text-apple-text hover:bg-apple-fill-secondary transition-colors flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download Video
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Saved Drafts */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : savedPosts.length > 0 && (
        <div>
          <h3 className="text-apple-sm font-semibold text-apple-text-secondary uppercase tracking-wider mb-3">Saved Drafts</h3>
          <div className="space-y-3">
            {savedPosts.map((post) => {
              const isExp = expandedPost === post.id;
              return (
                <div key={post.id} className="rounded-apple border border-apple-divider bg-white overflow-hidden">
                  <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-apple-fill-secondary/30 transition-colors" onClick={() => setExpandedPost(isExp ? null : post.id)}>
                    <span className="text-lg">✏️</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-apple-xs font-medium text-apple-blue">{post.post_type}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>{post.status}</span>
                      </div>
                      <p className="text-apple-sm text-apple-text truncate">{post.topic || post.content.slice(0, 80)}</p>
                      <p className="text-apple-xs text-apple-text-tertiary">{new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); copyToClipboard(post.content); }}
                      className="p-1.5 rounded hover:bg-apple-fill-secondary text-apple-text-tertiary hover:text-apple-text transition-colors shrink-0" title="Copy">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this draft?')) deletePost(post.id); }}
                      className="p-1.5 rounded hover:bg-red-50 text-apple-text-tertiary hover:text-red-500 transition-colors shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    <svg className={`w-4 h-4 text-apple-text-tertiary transition-transform ${isExp ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                  {isExp && (
                    <div className="border-t border-apple-divider p-4">
                      <div className="rounded-apple-sm border border-apple-divider bg-apple-fill-secondary/30 p-4 whitespace-pre-wrap text-apple-sm text-apple-text font-mono leading-relaxed mb-3">
                        {post.content}
                      </div>
                      {post.metadata?.hashtags?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {post.metadata.hashtags.map((h: string, i: number) => <span key={i} className="text-apple-xs text-apple-blue font-medium">#{h.replace(/^#/, '')}</span>)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && savedPosts.length === 0 && !generated && (
        <div className="card p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-apple-fill-secondary mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl">✏️</span>
          </div>
          <h3 className="text-apple-base font-semibold text-apple-text mb-1">No posts yet</h3>
          <p className="text-apple-sm text-apple-text-secondary">Select a format and topic above to generate your first {config.name} post.</p>
        </div>
      )}
    </div>
  );
}
