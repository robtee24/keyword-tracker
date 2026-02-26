import { useState, useEffect, useCallback, type ReactNode } from 'react';
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

interface VideoShot {
  time: string;
  visual: string;
  text_overlay?: string;
  audio?: string;
  purpose?: string;
}

interface GeneratedPost {
  content: string;
  hashtags: string[];
  format: string;
  charCount: number;
  tips: string;
  bestTime: string;
  script?: string;
  shots?: VideoShot[];
  imagePrompt?: string;
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
  videoFormats: string[];
  staticFormats: string[];
  charLimit: number;
  description: string;
  profilePlaceholder: string;
}> = {
  instagram: { name: 'Instagram', color: 'text-pink-600', bgColor: 'bg-pink-50', formats: ['Reel Script', 'Carousel Slides', 'Single Post', 'Story Sequence'], videoFormats: ['Reel Script', 'Story Sequence'], staticFormats: ['Single Post', 'Carousel Slides'], charLimit: 2200, description: 'Visual content, Reels, Carousels, and Stories', profilePlaceholder: 'https://instagram.com/yourbrand' },
  linkedin: { name: 'LinkedIn', color: 'text-blue-700', bgColor: 'bg-blue-50', formats: ['Text Post', 'Carousel Slides', 'Article', 'Poll'], videoFormats: ['Video Post'], staticFormats: ['Text Post', 'Carousel Slides', 'Article', 'Poll'], charLimit: 3000, description: 'Professional content and thought leadership', profilePlaceholder: 'https://linkedin.com/company/yourbrand' },
  x: { name: 'X (Twitter)', color: 'text-gray-900', bgColor: 'bg-gray-50', formats: ['Single Tweet', 'Thread', 'Poll'], videoFormats: ['Video Post'], staticFormats: ['Single Tweet', 'Thread', 'Poll'], charLimit: 280, description: 'Short-form content, threads, and real-time engagement', profilePlaceholder: 'https://x.com/yourbrand' },
  facebook: { name: 'Facebook', color: 'text-blue-600', bgColor: 'bg-blue-50', formats: ['Text Post', 'Photo Caption', 'Video Post', 'Poll'], videoFormats: ['Video Post'], staticFormats: ['Text Post', 'Photo Caption', 'Poll'], charLimit: 63206, description: 'Community engagement and native video', profilePlaceholder: 'https://facebook.com/yourbrand' },
  tiktok: { name: 'TikTok', color: 'text-gray-900', bgColor: 'bg-gray-50', formats: ['Video Script', 'Photo Carousel Caption'], videoFormats: ['Video Script'], staticFormats: ['Photo Carousel Caption'], charLimit: 4000, description: 'Short-form video scripts and captions', profilePlaceholder: 'https://tiktok.com/@yourbrand' },
  pinterest: { name: 'Pinterest', color: 'text-red-600', bgColor: 'bg-red-50', formats: ['Pin Description', 'Idea Pin Sequence'], videoFormats: ['Video Pin'], staticFormats: ['Pin Description', 'Idea Pin Sequence'], charLimit: 500, description: 'Visual discovery and SEO-rich descriptions', profilePlaceholder: 'https://pinterest.com/yourbrand' },
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

const VOICE_OPTIONS = [
  'Professional', 'Casual', 'Witty', 'Authoritative', 'Friendly',
  'Bold & Provocative', 'Educational', 'Inspirational', 'Conversational', 'Empathetic',
];

function useObjectivesSuggestions(projectId: string) {
  const [suggestions, setSuggestions] = useState<{
    niches: string[];
    audiences: string[];
    topics: string[];
  }>({ niches: [], audiences: [], topics: [] });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`kt_objectives_${projectId}`);
      if (!stored) return;
      const obj = JSON.parse(stored);

      const niches: string[] = [];
      if (obj.siteType) niches.push(obj.siteType);
      if (obj.coreOfferings?.length) {
        obj.coreOfferings.forEach((o: any) => { if (o.name) niches.push(o.name); });
      }

      const audiences: string[] = [];
      if (obj.targetAudience) {
        const segments = obj.targetAudience
          .split(/[,;]|and\s/i)
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 2 && s.length < 60);
        audiences.push(...segments);
        if (segments.length === 0) audiences.push(obj.targetAudience.slice(0, 80));
      }

      const topics: string[] = [];
      if (obj.coreOfferings?.length) {
        obj.coreOfferings.forEach((o: any) => {
          if (o.topKeyword) topics.push(o.topKeyword);
          if (o.name && !niches.includes(o.name)) topics.push(o.name);
        });
      }
      if (obj.primaryObjective) topics.push(obj.primaryObjective);
      if (obj.secondaryObjectives?.length) {
        obj.secondaryObjectives.slice(0, 3).forEach((o: string) => topics.push(o));
      }

      setSuggestions({
        niches: [...new Set(niches)].slice(0, 6),
        audiences: [...new Set(audiences)].slice(0, 6),
        topics: [...new Set(topics)].slice(0, 8),
      });
    } catch { /* */ }
  }, [projectId]);

  return suggestions;
}

function SelectableField({ label, options, value, onChange, otherPlaceholder }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void; otherPlaceholder: string;
}) {
  const isOther = value !== '' && !options.includes(value);
  const [showOther, setShowOther] = useState(false);

  return (
    <div>
      <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {options.map((opt) => (
          <button key={opt} onClick={() => { onChange(opt); setShowOther(false); }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
              value === opt ? 'bg-apple-blue text-white' : 'bg-apple-fill-secondary text-apple-text-secondary hover:bg-gray-200'
            }`}>
            {opt}
          </button>
        ))}
        <button onClick={() => { setShowOther(true); onChange(''); }}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
            showOther || isOther ? 'bg-apple-blue text-white' : 'bg-apple-fill-secondary text-apple-text-secondary hover:bg-gray-200'
          }`}>
          Other
        </button>
      </div>
      {(showOther || isOther) && (
        <input type="text" value={isOther ? value : ''} onChange={(e) => onChange(e.target.value)}
          placeholder={otherPlaceholder} autoFocus
          className="w-full px-3 py-1.5 rounded-apple-sm border border-apple-border text-apple-xs focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue" />
      )}
    </div>
  );
}

function IdeasTab({ siteUrl, projectId, platform, config, onGenerateFromIdea }: {
  siteUrl: string; projectId: string; platform: SocialPlatform;
  config: typeof PLATFORM_CONFIG[SocialPlatform]; onGenerateFromIdea: (idea: PostIdea) => void;
}) {
  const suggestions = useObjectivesSuggestions(projectId);
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

  useEffect(() => {
    if (!niche && suggestions.niches.length > 0) setNiche(suggestions.niches[0]);
    if (!audience && suggestions.audiences.length > 0) setAudience(suggestions.audiences[0]);
    if (!topics && suggestions.topics.length > 0) setTopics(suggestions.topics[0]);
  }, [suggestions]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <p className="text-apple-xs text-apple-text-tertiary mb-4">
          {suggestions.niches.length > 0
            ? 'Options auto-generated from your site objectives. Select one or choose Other.'
            : 'Provide context about your brand to get tailored ideas. Set up Objectives for auto-generated options.'}
        </p>
        <div className="space-y-4 mb-4">
          <SelectableField label="Niche / Industry" options={suggestions.niches} value={niche} onChange={setNiche} otherPlaceholder="e.g., SaaS, fitness, real estate" />
          <SelectableField label="Target Audience" options={suggestions.audiences} value={audience} onChange={setAudience} otherPlaceholder="e.g., startup founders, marketers" />
          <div>
            <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1.5">Brand Voice</label>
            <div className="flex flex-wrap gap-1.5">
              {VOICE_OPTIONS.map((v) => (
                <button key={v} onClick={() => setVoice(voice === v ? '' : v)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                    voice === v ? 'bg-apple-blue text-white' : 'bg-apple-fill-secondary text-apple-text-secondary hover:bg-gray-200'
                  }`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <SelectableField label="Focus Topics" options={suggestions.topics} value={topics} onChange={setTopics} otherPlaceholder="e.g., SEO tips, growth hacking" />
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

type MediaType = 'static' | 'video';

function CreateTab({ siteUrl, projectId, platform, config, isConnected, connectionLoading, prefillPostType, prefillTopic, prefillIdeaContext, onPrefillConsumed }: {
  siteUrl: string; projectId: string; platform: SocialPlatform;
  config: typeof PLATFORM_CONFIG[SocialPlatform]; isConnected: boolean; connectionLoading: boolean;
  prefillPostType: string | null; prefillTopic: string | null;
  prefillIdeaContext: { hook: string; outline: string } | null;
  onPrefillConsumed: () => void;
}) {
  const [mediaType, setMediaType] = useState<MediaType>('static');
  const [postType, setPostType] = useState(config.staticFormats[0] || config.formats[0]);
  const [topic, setTopic] = useState('');
  const [ideaContext, setIdeaContext] = useState<{ hook: string; outline: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [generated, setGenerated] = useState<GeneratedPost | null>(null);
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishTooltip, setPublishTooltip] = useState(false);

  const [generatingMedia, setGeneratingMedia] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);

  const availableFormats = mediaType === 'video' ? config.videoFormats : config.staticFormats;

  useEffect(() => {
    if (!availableFormats.includes(postType)) {
      setPostType(availableFormats[0] || config.formats[0]);
    }
  }, [mediaType, availableFormats, postType, config.formats]);

  useEffect(() => {
    if (prefillPostType || prefillTopic || prefillIdeaContext) {
      if (prefillPostType) {
        const isVideo = VIDEO_FORMATS.has(prefillPostType);
        setMediaType(isVideo ? 'video' : 'static');
        const fmts = isVideo ? config.videoFormats : config.staticFormats;
        setPostType(fmts.includes(prefillPostType) ? prefillPostType : fmts[0]);
      }
      if (prefillTopic) setTopic(prefillTopic);
      if (prefillIdeaContext) setIdeaContext(prefillIdeaContext);
      onPrefillConsumed();
    }
  }, [prefillPostType, prefillTopic, prefillIdeaContext, config, onPrefillConsumed]);

  const loadSavedPosts = useCallback(async () => {
    try {
      const resp = await authenticatedFetch(
        `${API_ENDPOINTS.db.socialPosts}?siteUrl=${encodeURIComponent(siteUrl)}&projectId=${projectId}&platform=${platform}`
      );
      if (resp.ok) { setSavedPosts((await resp.json()).posts || []); }
    } catch { /* */ }
    setLoading(false);
  }, [siteUrl, projectId, platform]);

  useEffect(() => { loadSavedPosts(); }, [loadSavedPosts]);

  const generatePost = async () => {
    if (!topic.trim()) return;
    setRunning(true);
    setGenerated(null);
    setMediaUrl(null);
    setMediaError(null);
    try {
      const resp = await authenticatedFetch(API_ENDPOINTS.social.generate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, projectId, platform, postType, topic, ideaContext, mediaType }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setGenerated(data);
        setIdeaContext(null);
        await loadSavedPosts();
        logActivity(siteUrl, 'social', 'generate', `Generated ${config.name} ${postType}: "${topic.slice(0, 50)}"`);

        // Auto-generate media
        if (mediaType === 'video' && data.shots?.length > 0) {
          autoGenerateVideo(data.shots);
        } else if (mediaType === 'static' && data.imagePrompt) {
          autoGenerateImage(data.imagePrompt);
        }
      }
    } catch { /* */ }
    setRunning(false);
  };

  const autoGenerateVideo = async (shots: any[]) => {
    setGeneratingMedia(true);
    setMediaError(null);
    try {
      const resp = await authenticatedFetch(API_ENDPOINTS.social.generateVideo, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, shots }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.error) setMediaError(data.error);
        else { setMediaUrl(data.videoUrl); logActivity(siteUrl, 'social', 'video', `Generated ${config.name} video`); }
      }
    } catch { setMediaError('Video generation failed.'); }
    setGeneratingMedia(false);
  };

  const autoGenerateImage = async (imagePrompt: string) => {
    setGeneratingMedia(true);
    setMediaError(null);
    try {
      const resp = await authenticatedFetch(API_ENDPOINTS.social.generateImage, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt, platform }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.error) setMediaError(data.error);
        else { setMediaUrl(data.imageUrl); logActivity(siteUrl, 'social', 'image', `Generated ${config.name} image`); }
      }
    } catch { setMediaError('Image generation failed.'); }
    setGeneratingMedia(false);
  };

  const downloadMedia = () => {
    if (!mediaUrl) return;
    const link = document.createElement('a');
    link.href = mediaUrl;
    link.download = `${platform}-${mediaType === 'video' ? 'video' : 'image'}-${Date.now()}.${mediaType === 'video' ? 'mp4' : 'png'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* */ }
  };

  const handlePublish = async () => {
    if (!isConnected || !generated) return;
    setPublishing(true);
    setTimeout(() => { setPublishing(false); alert(`Publishing to ${config.name} is not yet available. This feature will be enabled once ${config.name} API integration is complete.`); }, 500);
  };

  const deletePost = async (id: string) => {
    await authenticatedFetch(API_ENDPOINTS.db.socialPosts, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, projectId }) });
    setSavedPosts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div>
      {/* Create Form */}
      <div className="rounded-apple border border-apple-divider bg-white p-5 mb-6">
        <h3 className="text-apple-sm font-semibold text-apple-text mb-1">Create a {config.name} Post</h3>
        <p className="text-apple-xs text-apple-text-tertiary mb-4">
          Choose your post type, pick a format, and describe your topic.
          {ideaContext && <span className="text-apple-blue font-medium ml-1">Pre-filled from idea.</span>}
        </p>

        <div className="space-y-4 mb-4">
          {/* Step 1: Media Type */}
          <div>
            <label className="block text-apple-xs font-medium text-apple-text-secondary mb-2">Post Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setMediaType('static')}
                className={`p-4 rounded-apple-sm border-2 text-left transition-all ${
                  mediaType === 'static' ? 'border-apple-blue bg-apple-blue/5' : 'border-apple-divider hover:border-apple-blue/30'
                }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${mediaType === 'static' ? 'bg-apple-blue/10' : 'bg-apple-fill-secondary'}`}>
                    <svg className={`w-5 h-5 ${mediaType === 'static' ? 'text-apple-blue' : 'text-apple-text-tertiary'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <div>
                    <p className={`text-apple-sm font-semibold ${mediaType === 'static' ? 'text-apple-blue' : 'text-apple-text'}`}>Static Post</p>
                    <p className="text-apple-xs text-apple-text-tertiary">Image + caption</p>
                  </div>
                </div>
              </button>
              <button onClick={() => setMediaType('video')}
                className={`p-4 rounded-apple-sm border-2 text-left transition-all ${
                  mediaType === 'video' ? 'border-purple-500 bg-purple-50/50' : 'border-apple-divider hover:border-purple-300'
                }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${mediaType === 'video' ? 'bg-purple-100' : 'bg-apple-fill-secondary'}`}>
                    <svg className={`w-5 h-5 ${mediaType === 'video' ? 'text-purple-600' : 'text-apple-text-tertiary'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  </div>
                  <div>
                    <p className={`text-apple-sm font-semibold ${mediaType === 'video' ? 'text-purple-600' : 'text-apple-text'}`}>Video Post</p>
                    <p className="text-apple-xs text-apple-text-tertiary">Video + script + caption</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Step 2: Format */}
          <div>
            <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1.5">Format</label>
            <div className="flex flex-wrap gap-2">
              {availableFormats.map((fmt) => (
                <button key={fmt} onClick={() => setPostType(fmt)}
                  className={`px-3 py-1.5 rounded-apple-sm text-apple-xs font-medium transition-all ${
                    postType === fmt
                      ? (mediaType === 'video' ? 'bg-purple-600 text-white' : 'bg-apple-blue text-white')
                      : 'border border-apple-border text-apple-text-secondary hover:border-apple-blue/40'
                  }`}>
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Topic */}
          <div>
            <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1.5">Topic / Brief</label>
            <textarea value={topic} onChange={(e) => setTopic(e.target.value)}
              placeholder={`What should this ${postType.toLowerCase()} be about?`} rows={3}
              className="w-full px-3 py-2 rounded-apple-sm border border-apple-border text-apple-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue resize-none" />
          </div>
        </div>

        <button onClick={generatePost} disabled={running || !topic.trim()}
          className={`px-4 py-2 rounded-apple-sm text-white text-apple-sm font-medium transition-colors disabled:opacity-50 ${
            mediaType === 'video' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-apple-blue hover:bg-apple-blue-hover'
          }`}>
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

          {/* Caption / Post Text */}
          <div className="rounded-apple-sm border border-apple-divider bg-apple-fill-secondary/30 p-4 mb-4 whitespace-pre-wrap text-apple-sm text-apple-text font-mono leading-relaxed">
            {generated.content}
          </div>

          {/* Video Script + Shots (video only) */}
          {mediaType === 'video' && generated.script && (
            <div className="mb-4">
              <p className="text-[10px] font-semibold text-apple-text-secondary uppercase mb-2">Video Script</p>
              <div className="rounded-apple-sm border border-purple-200 bg-purple-50/50 p-3 text-apple-xs text-apple-text whitespace-pre-wrap mb-3">{generated.script}</div>
              {generated.shots && generated.shots.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-apple-text-secondary uppercase mb-2">Shot List</p>
                  <div className="space-y-2">
                    {generated.shots.map((shot, i) => (
                      <div key={i} className="rounded-apple-sm border border-apple-divider bg-white p-3 flex gap-3">
                        <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded self-start shrink-0">{shot.time}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-apple-xs text-apple-text">{shot.visual}</p>
                          {shot.text_overlay && <p className="text-[10px] text-apple-blue mt-1">Text: "{shot.text_overlay}"</p>}
                          {shot.audio && <p className="text-[10px] text-apple-text-tertiary mt-0.5">Audio: {shot.audio}</p>}
                          {shot.purpose && <p className="text-[10px] text-purple-500 mt-0.5 italic">{shot.purpose}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

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

          {/* Media Generation Status */}
          {generatingMedia && (
            <div className="mb-4 rounded-apple-sm border border-apple-divider bg-apple-fill-secondary/20 p-4 flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-apple-blue border-t-transparent rounded-full animate-spin shrink-0" />
              <p className="text-apple-sm text-apple-text">
                {mediaType === 'video' ? 'Generating video from shot list...' : 'Generating image with DALL-E 3...'}
              </p>
            </div>
          )}

          {mediaError && (
            <div className="mb-4 rounded-apple-sm border border-red-200 bg-red-50 p-3 flex items-center justify-between">
              <p className="text-apple-xs text-red-700">{mediaError}</p>
              <button onClick={() => { if (mediaType === 'video' && generated.shots) autoGenerateVideo(generated.shots); else if (generated.imagePrompt) autoGenerateImage(generated.imagePrompt); }}
                className="text-apple-xs text-red-600 font-medium hover:underline shrink-0 ml-3">Retry</button>
            </div>
          )}

          {/* Generated Media */}
          {mediaUrl && (
            <div className="mb-4">
              {mediaType === 'video' ? (
                <video src={mediaUrl} controls className="w-full max-w-lg rounded-apple-sm border border-apple-divider" />
              ) : (
                <img src={mediaUrl} alt="Generated creative" className="w-full max-w-lg rounded-apple-sm border border-apple-divider" />
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => copyToClipboard(generated.content)}
              className="px-4 py-2 rounded-apple-sm border border-apple-border text-apple-sm font-medium text-apple-text hover:bg-apple-fill-secondary transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              Copy Text
            </button>

            {mediaUrl && (
              <>
                <button onClick={downloadMedia}
                  className="px-4 py-2 rounded-apple-sm border border-apple-border text-apple-sm font-medium text-apple-text hover:bg-apple-fill-secondary transition-colors flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download {mediaType === 'video' ? 'Video' : 'Image'}
                </button>
                <button onClick={() => setShowPreview(true)}
                  className="px-4 py-2 rounded-apple-sm border border-apple-border text-apple-sm font-medium text-apple-text hover:bg-apple-fill-secondary transition-colors flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  Preview
                </button>
              </>
            )}

            <div className="relative">
              {!connectionLoading && !isConnected ? (
                <div onMouseEnter={() => setPublishTooltip(true)} onMouseLeave={() => setPublishTooltip(false)} className="relative">
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
                  {publishing ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>}
                  Publish
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Post Preview Modal */}
      {showPreview && generated && mediaUrl && (
        <PostPreview platform={platform} config={config} content={generated.content} hashtags={generated.hashtags} mediaUrl={mediaUrl} mediaType={mediaType} onClose={() => setShowPreview(false)} />
      )}

      {/* Saved Drafts */}
      {loading ? (
        <div className="flex items-center justify-center py-8"><div className="w-5 h-5 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" /></div>
      ) : savedPosts.length > 0 && (
        <div>
          <h3 className="text-apple-sm font-semibold text-apple-text-secondary uppercase tracking-wider mb-3">Saved Drafts</h3>
          <div className="space-y-3">
            {savedPosts.map((post) => {
              const isExp = expandedPost === post.id;
              return (
                <div key={post.id} className="rounded-apple border border-apple-divider bg-white overflow-hidden">
                  <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-apple-fill-secondary/30 transition-colors" onClick={() => setExpandedPost(isExp ? null : post.id)}>
                    <span className="text-lg">{post.metadata?.mediaType === 'video' ? '🎬' : '✏️'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-apple-xs font-medium text-apple-blue">{post.post_type}</span>
                        {post.metadata?.mediaType && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-100 text-purple-700">{post.metadata.mediaType}</span>}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{post.status}</span>
                      </div>
                      <p className="text-apple-sm text-apple-text truncate">{post.topic || post.content.slice(0, 80)}</p>
                      <p className="text-apple-xs text-apple-text-tertiary">{new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); copyToClipboard(post.content); }} className="p-1.5 rounded hover:bg-apple-fill-secondary text-apple-text-tertiary hover:text-apple-text transition-colors shrink-0" title="Copy">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this draft?')) deletePost(post.id); }} className="p-1.5 rounded hover:bg-red-50 text-apple-text-tertiary hover:text-red-500 transition-colors shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    <svg className={`w-4 h-4 text-apple-text-tertiary transition-transform ${isExp ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                  {isExp && (
                    <div className="border-t border-apple-divider p-4">
                      <div className="rounded-apple-sm border border-apple-divider bg-apple-fill-secondary/30 p-4 whitespace-pre-wrap text-apple-sm text-apple-text font-mono leading-relaxed mb-3">{post.content}</div>
                      {post.metadata?.hashtags?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">{post.metadata.hashtags.map((h: string, i: number) => <span key={i} className="text-apple-xs text-apple-blue font-medium">#{h.replace(/^#/, '')}</span>)}</div>
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
          <div className="w-14 h-14 rounded-full bg-apple-fill-secondary mx-auto mb-4 flex items-center justify-center"><span className="text-2xl">✏️</span></div>
          <h3 className="text-apple-base font-semibold text-apple-text mb-1">No posts yet</h3>
          <p className="text-apple-sm text-apple-text-secondary">Choose a post type above to generate your first {config.name} post.</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   POST PREVIEW MODAL
   ═══════════════════════════════════════════════════════════════ */

function PostPreview({ platform, config, content, hashtags, mediaUrl, mediaType, onClose }: {
  platform: SocialPlatform; config: typeof PLATFORM_CONFIG[SocialPlatform];
  content: string; hashtags: string[]; mediaUrl: string; mediaType: MediaType; onClose: () => void;
}) {
  const hashtagText = hashtags?.length > 0 ? '\n' + hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ') : '';
  const truncatedContent = content.length > 300 ? content.slice(0, 300) + '...' : content;

  const renderMedia = () => {
    if (mediaType === 'video') return <video src={mediaUrl} controls className="w-full" />;
    return <img src={mediaUrl} alt="" className="w-full" />;
  };

  const mockups: Record<SocialPlatform, () => ReactNode> = {
    instagram: () => (
      <div className="bg-white rounded-xl overflow-hidden shadow-xl max-w-[375px] mx-auto border border-gray-200">
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-100">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center"><div className="w-7 h-7 rounded-full bg-white flex items-center justify-center"><div className="w-6 h-6 rounded-full bg-gray-200" /></div></div>
          <div className="flex-1"><p className="text-[13px] font-semibold text-gray-900">yourbrand</p></div>
          <svg className="w-5 h-5 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01" /></svg>
        </div>
        {renderMedia()}
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" /></svg>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
            </div>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>
          </div>
          <p className="text-[13px] text-gray-900 leading-[18px]"><span className="font-semibold">yourbrand</span> {truncatedContent}</p>
          {hashtagText && <p className="text-[13px] text-blue-900 mt-0.5">{hashtagText.trim()}</p>}
          <p className="text-[11px] text-gray-400 mt-1 uppercase">Just now</p>
        </div>
      </div>
    ),
    linkedin: () => (
      <div className="bg-white rounded-lg overflow-hidden shadow-xl max-w-[500px] mx-auto border border-gray-200">
        <div className="px-4 pt-3 pb-2 flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0"><span className="text-blue-700 font-bold text-sm">YB</span></div>
          <div><p className="text-[14px] font-semibold text-gray-900">Your Brand</p><p className="text-[12px] text-gray-500">Company &middot; Just now</p></div>
        </div>
        <div className="px-4 pb-2"><p className="text-[14px] text-gray-800 leading-[20px] whitespace-pre-wrap">{truncatedContent}{hashtagText && <span className="text-blue-600">{hashtagText}</span>}</p></div>
        {renderMedia()}
        <div className="px-4 py-1.5 border-t border-gray-100 text-[12px] text-gray-500">0 reactions &middot; 0 comments</div>
        <div className="px-4 py-2 border-t border-gray-100 flex justify-around">
          {['Like', 'Comment', 'Repost', 'Send'].map(a => <button key={a} className="text-[12px] text-gray-600 font-medium py-1 px-2 hover:bg-gray-50 rounded">{a}</button>)}
        </div>
      </div>
    ),
    x: () => (
      <div className="bg-white rounded-xl overflow-hidden shadow-xl max-w-[500px] mx-auto border border-gray-200">
        <div className="p-4 flex gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5"><span className="text-[15px] font-bold text-gray-900">Your Brand</span><span className="text-[15px] text-gray-500">@yourbrand &middot; now</span></div>
            <p className="text-[15px] text-gray-900 leading-[20px] whitespace-pre-wrap mb-3">{truncatedContent}{hashtagText && <span className="text-blue-500">{hashtagText}</span>}</p>
            <div className="rounded-xl overflow-hidden border border-gray-200">{renderMedia()}</div>
            <div className="flex justify-between mt-3 max-w-[350px]">
              {[{d:'M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z'},{d:'M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3'},{d:'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z'},{d:'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5'}].map((ic, i) => (
                <button key={i} className="text-gray-500 hover:text-blue-500"><svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={ic.d} /></svg></button>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    facebook: () => (
      <div className="bg-white rounded-lg overflow-hidden shadow-xl max-w-[500px] mx-auto border border-gray-200">
        <div className="px-4 pt-3 pb-2 flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"><span className="text-blue-600 font-bold text-sm">YB</span></div>
          <div><p className="text-[15px] font-semibold text-gray-900">Your Brand</p><p className="text-[13px] text-gray-500">Just now &middot; Public</p></div>
        </div>
        <div className="px-4 pb-2"><p className="text-[15px] text-gray-900 leading-[20px] whitespace-pre-wrap">{truncatedContent}{hashtagText && <span className="text-blue-600">{hashtagText}</span>}</p></div>
        {renderMedia()}
        <div className="px-4 py-2 border-t border-gray-100 flex justify-around">
          {['Like', 'Comment', 'Share'].map(a => <button key={a} className="text-[14px] text-gray-600 font-medium py-1.5 px-4 hover:bg-gray-50 rounded-md flex-1 text-center">{a}</button>)}
        </div>
      </div>
    ),
    tiktok: () => (
      <div className="bg-black rounded-xl overflow-hidden shadow-xl max-w-[340px] mx-auto relative" style={{ aspectRatio: '9/16' }}>
        <div className="absolute inset-0">{mediaType === 'video' ? <video src={mediaUrl} className="w-full h-full object-cover" autoPlay muted loop /> : <img src={mediaUrl} alt="" className="w-full h-full object-cover" />}</div>
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
          <p className="text-white text-[13px] font-semibold mb-1">@yourbrand</p>
          <p className="text-white/90 text-[12px] leading-[16px]">{truncatedContent.slice(0, 150)}</p>
          {hashtagText && <p className="text-white/70 text-[11px] mt-0.5">{hashtagText.trim()}</p>}
        </div>
        <div className="absolute right-2 bottom-20 flex flex-col items-center gap-4">
          {['heart', 'chat', 'share', 'bookmark'].map(ic => (
            <div key={ic} className="flex flex-col items-center">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center"><svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg></div>
              <span className="text-white text-[10px] mt-0.5">0</span>
            </div>
          ))}
        </div>
      </div>
    ),
    pinterest: () => (
      <div className="bg-white rounded-2xl overflow-hidden shadow-xl max-w-[280px] mx-auto border border-gray-200">
        <div className="relative">{renderMedia()}<button className="absolute top-3 right-3 bg-red-600 text-white text-[14px] font-bold px-4 py-2 rounded-full">Save</button></div>
        <div className="p-3">
          <p className="text-[16px] font-semibold text-gray-900 mb-1">{content.slice(0, 60)}</p>
          <p className="text-[13px] text-gray-600 leading-[18px]">{truncatedContent.slice(0, 100)}</p>
          {hashtagText && <p className="text-[12px] text-gray-400 mt-1">{hashtagText.trim()}</p>}
        </div>
      </div>
    ),
  };

  const Mockup = mockups[platform] || mockups.instagram;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <Mockup />
      </div>
    </div>
  );
}
