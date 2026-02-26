import { useState, useEffect, useCallback } from 'react';
import { authenticatedFetch } from '../services/authService';
import { API_ENDPOINTS } from '../config/api';
import { logActivity } from '../utils/activityLog';

type SocialPlatform = 'instagram' | 'linkedin' | 'x' | 'facebook' | 'tiktok' | 'pinterest';
type SocialTab = 'audit' | 'ideas' | 'create';

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
}> = {
  instagram: { name: 'Instagram', color: 'text-pink-600', bgColor: 'bg-pink-50', formats: ['Reel Script', 'Carousel Slides', 'Single Post', 'Story Sequence'], charLimit: 2200, description: 'Visual content, Reels, Carousels, and Stories' },
  linkedin: { name: 'LinkedIn', color: 'text-blue-700', bgColor: 'bg-blue-50', formats: ['Text Post', 'Carousel Slides', 'Article', 'Poll'], charLimit: 3000, description: 'Professional content and thought leadership' },
  x: { name: 'X (Twitter)', color: 'text-gray-900', bgColor: 'bg-gray-50', formats: ['Single Tweet', 'Thread', 'Poll'], charLimit: 280, description: 'Short-form content, threads, and real-time engagement' },
  facebook: { name: 'Facebook', color: 'text-blue-600', bgColor: 'bg-blue-50', formats: ['Text Post', 'Photo Caption', 'Video Post', 'Poll'], charLimit: 63206, description: 'Community engagement and native video' },
  tiktok: { name: 'TikTok', color: 'text-gray-900', bgColor: 'bg-gray-50', formats: ['Video Script', 'Photo Carousel Caption'], charLimit: 4000, description: 'Short-form video scripts and captions' },
  pinterest: { name: 'Pinterest', color: 'text-red-600', bgColor: 'bg-red-50', formats: ['Pin Description', 'Idea Pin Sequence'], charLimit: 500, description: 'Visual discovery and SEO-rich descriptions' },
};

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

      {activeTab === 'audit' && <AuditTab siteUrl={siteUrl} projectId={projectId} platform={platform} config={config} />}
      {activeTab === 'ideas' && <IdeasTab siteUrl={siteUrl} projectId={projectId} platform={platform} config={config} />}
      {activeTab === 'create' && <CreateTab siteUrl={siteUrl} projectId={projectId} platform={platform} config={config} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AUDIT TAB
   ═══════════════════════════════════════════════════════════════ */

function AuditTab({ siteUrl, projectId, platform, config }: { siteUrl: string; projectId: string; platform: SocialPlatform; config: typeof PLATFORM_CONFIG[SocialPlatform] }) {
  const [postInputs, setPostInputs] = useState<string[]>(['']);
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

  const addPostInput = () => { if (postInputs.length < 10) setPostInputs([...postInputs, '']); };
  const removePostInput = (idx: number) => setPostInputs(postInputs.filter((_, i) => i !== idx));
  const updatePostInput = (idx: number, val: string) => {
    const updated = [...postInputs];
    updated[idx] = val;
    setPostInputs(updated);
  };

  const runAudit = async () => {
    const posts = postInputs.filter((p) => p.trim());
    if (posts.length === 0) return;
    setRunning(true);
    setResult(null);
    try {
      const resp = await authenticatedFetch(API_ENDPOINTS.social.audit, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, projectId, platform, posts: posts.map((content) => ({ content })) }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setResult(data);
        await loadSavedAudits();
        logActivity(siteUrl, 'social', 'audit', `${config.name} audit: ${posts.length} post(s), score: ${data.score}/100`);
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
        <h3 className="text-apple-sm font-semibold text-apple-text mb-1">Paste your {config.name} posts</h3>
        <p className="text-apple-xs text-apple-text-tertiary mb-4">Add up to 10 posts to audit. Paste the full text content of each post.</p>

        <div className="space-y-3">
          {postInputs.map((val, idx) => (
            <div key={idx} className="flex gap-2">
              <textarea
                value={val}
                onChange={(e) => updatePostInput(idx, e.target.value)}
                placeholder={`Post ${idx + 1} content...`}
                rows={3}
                className="flex-1 px-3 py-2 rounded-apple-sm border border-apple-border text-apple-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue resize-none"
              />
              {postInputs.length > 1 && (
                <button onClick={() => removePostInput(idx)} className="self-start p-2 text-apple-text-tertiary hover:text-apple-red transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-4">
          {postInputs.length < 10 && (
            <button onClick={addPostInput} className="text-apple-xs text-apple-blue hover:underline font-medium">+ Add another post</button>
          )}
          <div className="flex-1" />
          <button onClick={runAudit} disabled={running || postInputs.every((p) => !p.trim())}
            className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50">
            {running ? 'Auditing...' : `Audit ${postInputs.filter((p) => p.trim()).length} Post${postInputs.filter((p) => p.trim()).length !== 1 ? 's' : ''}`}
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
          <p className="text-apple-sm text-apple-text-secondary">Paste your {config.name} post content above to get an AI-powered audit.</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   IDEAS TAB
   ═══════════════════════════════════════════════════════════════ */

function IdeasTab({ siteUrl, projectId, platform, config }: { siteUrl: string; projectId: string; platform: SocialPlatform; config: typeof PLATFORM_CONFIG[SocialPlatform] }) {
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
            <div className="flex items-center gap-3 text-[10px] text-apple-text-tertiary">
              <span>Best time: {idea.bestTime}</span>
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

function CreateTab({ siteUrl, projectId, platform, config }: { siteUrl: string; projectId: string; platform: SocialPlatform; config: typeof PLATFORM_CONFIG[SocialPlatform] }) {
  const [postType, setPostType] = useState(config.formats[0]);
  const [topic, setTopic] = useState('');
  const [running, setRunning] = useState(false);
  const [generated, setGenerated] = useState<GeneratedPost | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);

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
        body: JSON.stringify({ siteUrl, projectId, platform, postType, topic }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setGenerated(data);
        await loadSavedPosts();
        logActivity(siteUrl, 'social', 'generate', `Generated ${config.name} ${postType}: "${topic.slice(0, 50)}"`);
      }
    } catch { /* */ }
    setRunning(false);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* */ }
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
        <p className="text-apple-xs text-apple-text-tertiary mb-4">Select a format and describe what you want to post about.</p>

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

          {/* Connect to Publish Placeholder */}
          <div className="rounded-apple-sm border border-dashed border-apple-divider bg-apple-fill-secondary/20 p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-apple-fill-secondary flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-apple-sm font-medium text-apple-text">Connect {config.name} to publish directly</p>
              <p className="text-apple-xs text-apple-text-tertiary">Social publishing is coming soon. For now, copy your post and publish manually.</p>
            </div>
            <a href="#" onClick={(e) => { e.preventDefault(); }} className="px-3 py-1.5 rounded-apple-sm border border-apple-border text-apple-xs text-apple-text-secondary font-medium opacity-50 cursor-not-allowed">
              Coming Soon
            </a>
          </div>
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
