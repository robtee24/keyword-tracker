import { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/api';

export interface SiteObjectives {
  siteType: string;
  primaryObjective: string;
  secondaryObjectives: string[];
  coreOfferings: Array<{ name: string; description: string; topKeyword: string }>;
  targetAudience: string;
  geographicFocus: string;
  competitors: string;
  uniqueValue: string;
  conversionGoals: string;
  contentStrategy: string;
}

const SITE_TYPES = [
  'E-commerce / Online Store',
  'Service-based Business',
  'SaaS / Software Product',
  'Blog / Content Site',
  'News / Media Publication',
  'Portfolio / Personal Brand',
  'Agency / Consultancy',
  'Marketplace',
  'Community / Forum',
  'Educational / Course Platform',
  'Non-profit / Organization',
  'Local Business',
  'Lead Generation',
  'Affiliate / Review Site',
  'Other',
];

const OBJECTIVES = [
  'Generate qualified leads',
  'Sell products online',
  'Drive brand awareness',
  'Educate and inform audience',
  'Generate recurring subscriptions',
  'Build community engagement',
  'Drive ad revenue / monetize traffic',
  'Establish thought leadership',
  'Support existing customers',
  'Drive foot traffic to physical locations',
  'Build email list',
  'Promote events',
];

const GEO_OPTIONS = [
  'Local (single city/region)',
  'Regional (multi-city/state)',
  'National (single country)',
  'Multi-country',
  'Global / International',
];

interface ObjectivesViewProps {
  projectId: string;
  projectName: string;
  siteUrl: string;
}

const STORAGE_KEY = (id: string) => `kt_objectives_${id}`;

function getDefaults(): SiteObjectives {
  return {
    siteType: '',
    primaryObjective: '',
    secondaryObjectives: [],
    coreOfferings: [{ name: '', description: '', topKeyword: '' }],
    targetAudience: '',
    geographicFocus: '',
    competitors: '',
    uniqueValue: '',
    conversionGoals: '',
    contentStrategy: '',
  };
}

export default function ObjectivesView({ projectId, projectName, siteUrl }: ObjectivesViewProps) {
  const [data, setData] = useState<SiteObjectives>(getDefaults);
  const [saved, setSaved] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY(projectId));
      if (stored) {
        const parsed = JSON.parse(stored);
        // Migrate offerings that don't have topKeyword
        if (parsed.coreOfferings) {
          parsed.coreOfferings = parsed.coreOfferings.map((o: any) => ({
            ...o,
            topKeyword: o.topKeyword || '',
          }));
        }
        setData(parsed);
        setHasExisting(true);
      } else {
        setData(getDefaults());
        setHasExisting(false);
      }
    } catch {
      setData(getDefaults());
    }
    setSaved(false);
    setAiError(null);
  }, [projectId]);

  const save = () => {
    localStorage.setItem(STORAGE_KEY(projectId), JSON.stringify(data));
    setSaved(true);
    setHasExisting(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const update = <K extends keyof SiteObjectives>(key: K, value: SiteObjectives[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const toggleSecondary = (obj: string) => {
    setData((prev) => ({
      ...prev,
      secondaryObjectives: prev.secondaryObjectives.includes(obj)
        ? prev.secondaryObjectives.filter((o) => o !== obj)
        : [...prev.secondaryObjectives, obj],
    }));
    setSaved(false);
  };

  const addOffering = () => {
    setData((prev) => ({
      ...prev,
      coreOfferings: [...prev.coreOfferings, { name: '', description: '', topKeyword: '' }],
    }));
  };

  const removeOffering = (index: number) => {
    setData((prev) => ({
      ...prev,
      coreOfferings: prev.coreOfferings.filter((_, i) => i !== index),
    }));
  };

  const updateOffering = (index: number, field: 'name' | 'description' | 'topKeyword', value: string) => {
    setData((prev) => ({
      ...prev,
      coreOfferings: prev.coreOfferings.map((o, i) => (i === index ? { ...o, [field]: value } : o)),
    }));
    setSaved(false);
  };

  const handleCompleteWithAI = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const resp = await fetch(API_ENDPOINTS.ai.analyzeSite, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const { objectives } = await resp.json();
      if (objectives) {
        setData({
          siteType: objectives.siteType || '',
          primaryObjective: objectives.primaryObjective || '',
          secondaryObjectives: objectives.secondaryObjectives || [],
          coreOfferings: (objectives.coreOfferings || []).map((o: any) => ({
            name: o.name || '',
            description: o.description || '',
            topKeyword: o.topKeyword || '',
          })),
          targetAudience: objectives.targetAudience || '',
          geographicFocus: objectives.geographicFocus || '',
          competitors: objectives.competitors || '',
          uniqueValue: objectives.uniqueValue || '',
          conversionGoals: objectives.conversionGoals || '',
          contentStrategy: objectives.contentStrategy || '',
        });
        setSaved(false);
      }
    } catch (err: any) {
      setAiError(err.message || 'Failed to analyze site');
    } finally {
      setAiLoading(false);
    }
  };

  const completionPct = (() => {
    let filled = 0;
    const total = 7;
    if (data.siteType) filled++;
    if (data.primaryObjective) filled++;
    if (data.coreOfferings.some((o) => o.name.trim())) filled++;
    if (data.targetAudience.trim()) filled++;
    if (data.geographicFocus) filled++;
    if (data.uniqueValue.trim()) filled++;
    if (data.conversionGoals.trim()) filled++;
    return Math.round((filled / total) * 100);
  })();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-apple-title1 font-bold text-apple-text tracking-tight">
            Website Objectives
          </h2>
          <p className="text-apple-base text-apple-text-secondary mt-1">
            Help us understand {projectName} to identify your most valuable keywords
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 rounded-full bg-apple-fill-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-apple-green transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <span className="text-apple-xs text-apple-text-tertiary font-medium">{completionPct}%</span>
          </div>
          <button onClick={save} className="btn-primary text-apple-sm">
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Complete with AI */}
      <div className="mb-6 card p-5 bg-gradient-to-r from-indigo-50/80 to-blue-50/80 border border-indigo-100">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-apple-sm bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-apple-base font-semibold text-apple-text">Complete with AI</h3>
            <p className="text-apple-sm text-apple-text-secondary mt-0.5">
              Automatically crawl your site and fill out all objectives using AI analysis
            </p>
          </div>
          <button
            onClick={handleCompleteWithAI}
            disabled={aiLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-apple-sm bg-gradient-to-r from-indigo-500 to-blue-600 text-white text-apple-sm font-medium hover:from-indigo-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {aiLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Complete with AI
              </>
            )}
          </button>
        </div>
        {aiLoading && (
          <div className="mt-3 flex items-center gap-2 text-apple-sm text-indigo-600">
            <div className="w-full bg-indigo-100 rounded-full h-1 overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
            <span className="shrink-0">Crawling site & analyzing...</span>
          </div>
        )}
        {aiError && (
          <div className="mt-3 text-apple-sm text-apple-red">{aiError}</div>
        )}
      </div>

      <div className="space-y-6">
        {/* Site Type */}
        <Section title="What type of website is this?" number={1}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SITE_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => update('siteType', type)}
                className={`px-3 py-2 rounded-apple-sm text-apple-sm text-left transition-all duration-150 border ${
                  data.siteType === type
                    ? 'bg-apple-blue/10 border-apple-blue/30 text-apple-blue font-medium'
                    : 'border-apple-divider text-apple-text-secondary hover:bg-apple-fill-secondary'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </Section>

        {/* Primary Objective */}
        <Section title="What is the primary objective of the site?" number={2}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {OBJECTIVES.map((obj) => (
              <button
                key={obj}
                onClick={() => update('primaryObjective', obj)}
                className={`px-3 py-2 rounded-apple-sm text-apple-sm text-left transition-all duration-150 border ${
                  data.primaryObjective === obj
                    ? 'bg-apple-blue/10 border-apple-blue/30 text-apple-blue font-medium'
                    : 'border-apple-divider text-apple-text-secondary hover:bg-apple-fill-secondary'
                }`}
              >
                {obj}
              </button>
            ))}
          </div>
        </Section>

        {/* Secondary Objectives */}
        <Section title="Any secondary objectives?" number={3} optional>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {OBJECTIVES.filter((o) => o !== data.primaryObjective).map((obj) => (
              <button
                key={obj}
                onClick={() => toggleSecondary(obj)}
                className={`px-3 py-2 rounded-apple-sm text-apple-sm text-left transition-all duration-150 border ${
                  data.secondaryObjectives.includes(obj)
                    ? 'bg-blue-50 border-blue-200 text-apple-blue font-medium'
                    : 'border-apple-divider text-apple-text-secondary hover:bg-apple-fill-secondary'
                }`}
              >
                {obj}
              </button>
            ))}
          </div>
        </Section>

        {/* Core Offerings */}
        <Section title="What are your core offerings?" number={4} subtitle="Products, services, or content categories — and the most important keyword for each">
          <div className="space-y-4">
            {data.coreOfferings.map((offering, i) => (
              <div key={i} className="rounded-apple-sm border border-apple-divider p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-apple-xs font-semibold text-apple-text-tertiary uppercase tracking-wider">
                    Offering {i + 1}
                  </span>
                  {data.coreOfferings.length > 1 && (
                    <button
                      onClick={() => removeOffering(i)}
                      className="p-1 rounded-apple-sm text-apple-text-tertiary hover:text-apple-red hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={offering.name}
                    onChange={(e) => updateOffering(i, 'name', e.target.value)}
                    placeholder="Offering name"
                    className="input w-full"
                  />
                  <textarea
                    value={offering.description}
                    onChange={(e) => updateOffering(i, 'description', e.target.value)}
                    placeholder="Brief description — what is it, who is it for?"
                    rows={2}
                    className="input w-full resize-none"
                  />
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                      <svg className="w-3.5 h-3.5 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={offering.topKeyword}
                      onChange={(e) => updateOffering(i, 'topKeyword', e.target.value)}
                      placeholder="Most important keyword (e.g. 'plumber near me')"
                      className="input w-full pl-9 font-medium text-apple-blue"
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={addOffering}
              className="inline-flex items-center gap-1.5 text-apple-sm text-apple-blue hover:underline"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add another offering
            </button>
          </div>
        </Section>

        {/* Target Audience */}
        <Section title="Who is your target audience?" number={5}>
          <textarea
            value={data.targetAudience}
            onChange={(e) => update('targetAudience', e.target.value)}
            placeholder="Describe your ideal customer/visitor — demographics, interests, pain points, etc."
            rows={3}
            className="input w-full resize-none"
          />
        </Section>

        {/* Geographic Focus */}
        <Section title="What is your geographic focus?" number={6}>
          <div className="flex flex-wrap gap-2">
            {GEO_OPTIONS.map((geo) => (
              <button
                key={geo}
                onClick={() => update('geographicFocus', geo)}
                className={`px-3 py-2 rounded-apple-sm text-apple-sm transition-all duration-150 border ${
                  data.geographicFocus === geo
                    ? 'bg-apple-blue/10 border-apple-blue/30 text-apple-blue font-medium'
                    : 'border-apple-divider text-apple-text-secondary hover:bg-apple-fill-secondary'
                }`}
              >
                {geo}
              </button>
            ))}
          </div>
        </Section>

        {/* Unique Value */}
        <Section title="What makes you different from competitors?" number={7}>
          <textarea
            value={data.uniqueValue}
            onChange={(e) => update('uniqueValue', e.target.value)}
            placeholder="Your unique value proposition — what do you offer that competitors don't?"
            rows={3}
            className="input w-full resize-none"
          />
        </Section>

        {/* Competitors */}
        <Section title="Who are your main competitors?" number={8} optional>
          <textarea
            value={data.competitors}
            onChange={(e) => update('competitors', e.target.value)}
            placeholder="List competitor websites or business names (one per line)"
            rows={3}
            className="input w-full resize-none"
          />
        </Section>

        {/* Conversion Goals */}
        <Section title="What counts as a conversion on your site?" number={9}>
          <textarea
            value={data.conversionGoals}
            onChange={(e) => update('conversionGoals', e.target.value)}
            placeholder="e.g. Form submission, purchase, phone call, newsletter signup, free trial, demo request"
            rows={2}
            className="input w-full resize-none"
          />
        </Section>

        {/* Content Strategy */}
        <Section title="Do you have a content strategy?" number={10} optional>
          <textarea
            value={data.contentStrategy}
            onChange={(e) => update('contentStrategy', e.target.value)}
            placeholder="How do you create content? Blog posts, landing pages, videos, podcasts — how frequently?"
            rows={3}
            className="input w-full resize-none"
          />
        </Section>
      </div>

      {/* Save button at bottom */}
      <div className="mt-8 pb-8 flex justify-end">
        <button onClick={save} className="btn-primary">
          {saved ? '✓ Saved' : 'Save Objectives'}
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  number,
  subtitle,
  optional,
  children,
}: {
  title: string;
  number: number;
  subtitle?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-6">
      <div className="flex items-start gap-3 mb-4">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-apple-blue/10 text-apple-blue text-apple-xs font-bold shrink-0 mt-0.5">
          {number}
        </span>
        <div>
          <h3 className="text-apple-base font-semibold text-apple-text">
            {title}
            {optional && (
              <span className="ml-2 text-apple-xs font-normal text-apple-text-tertiary">Optional</span>
            )}
          </h3>
          {subtitle && (
            <p className="text-apple-sm text-apple-text-tertiary mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
