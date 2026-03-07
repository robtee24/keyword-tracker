import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { authenticatedFetch } from '../services/authService';
import { useBackgroundTasks } from '../contexts/BackgroundTaskContext';
import { parseJsonOrThrow } from '../utils/apiResponse';

interface BrandColor {
  hex: string;
  name: string;
  role: string;
}

interface BrandFont {
  family: string;
  weight: string;
  style: string;
}

interface BrandButton {
  css: string;
  label: string;
  variant: string;
}

interface BrandLogo {
  url: string;
  alt: string;
  type: string;
}

interface BrandProfile {
  id?: string;
  project_id: string;
  site_url: string;
  brand_style: string | null;
  logos: BrandLogo[];
  fonts: { heading?: BrandFont; body?: BrandFont; other?: string[] };
  font_styling: { headingCase?: string; letterSpacing?: string; lineHeight?: string };
  colors: BrandColor[];
  tagline: string | null;
  mission_statement: string | null;
  button_styles: BrandButton[];
  spacing: { borderRadius?: string; shadows?: string; padding?: string };
  voice_and_tone: string | null;
  additional_notes: string | null;
}

interface BrandViewProps {
  siteUrl: string;
  projectId: string;
}

const EMPTY_PROFILE: BrandProfile = {
  project_id: '',
  site_url: '',
  brand_style: null,
  logos: [],
  fonts: {},
  font_styling: {},
  colors: [],
  tagline: null,
  mission_statement: null,
  button_styles: [],
  spacing: {},
  voice_and_tone: null,
  additional_notes: null,
};

function ColorSwatch({ color, onChange, onRemove }: { color: BrandColor; onChange: (c: BrandColor) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [hex, setHex] = useState(color.hex);
  const [name, setName] = useState(color.name);
  const [role, setRole] = useState(color.role);

  useEffect(() => { setHex(color.hex); setName(color.name); setRole(color.role); }, [color]);

  const commit = () => {
    const normalized = hex.startsWith('#') ? hex : `#${hex}`;
    onChange({ hex: normalized, name, role });
    setEditing(false);
  };

  return (
    <div className="relative group rounded-xl overflow-hidden border border-apple-border bg-white">
      <div
        className="h-20 w-full cursor-pointer"
        style={{ backgroundColor: color.hex }}
        onClick={() => setEditing(!editing)}
      />
      {editing ? (
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-1">
            <input
              type="color"
              value={hex.startsWith('#') ? hex : `#${hex}`}
              onChange={(e) => setHex(e.target.value)}
              className="w-8 h-8 p-0 border-0 cursor-pointer rounded"
            />
            <input
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              placeholder="#000000"
              className="input text-apple-xs font-mono flex-1 py-1"
            />
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Color name" className="input text-apple-xs w-full py-1" />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="input text-apple-xs w-full py-1">
            <option value="primary">Primary</option>
            <option value="secondary">Secondary</option>
            <option value="accent">Accent</option>
            <option value="background">Background</option>
            <option value="text">Text</option>
            <option value="border">Border</option>
            <option value="hover">Hover</option>
            <option value="highlight">Highlight</option>
          </select>
          <div className="flex gap-1">
            <button onClick={commit} className="flex-1 px-2 py-1 bg-apple-blue text-white text-[10px] font-medium rounded-apple-sm hover:bg-apple-blue-hover">Save</button>
            <button onClick={onRemove} className="px-2 py-1 text-apple-red text-[10px] font-medium rounded-apple-sm hover:bg-red-50">Remove</button>
          </div>
        </div>
      ) : (
        <div className="p-3 cursor-pointer" onClick={() => setEditing(true)}>
          <div className="font-mono text-apple-xs font-semibold text-apple-text">{color.hex}</div>
          {color.name && <div className="text-[10px] text-apple-text-secondary mt-0.5">{color.name}</div>}
          <div className="text-[10px] text-apple-text-tertiary uppercase tracking-wide mt-1">{color.role}</div>
        </div>
      )}
    </div>
  );
}

export default function BrandView({ siteUrl, projectId }: BrandViewProps) {
  const [profile, setProfile] = useState<BrandProfile>({ ...EMPTY_PROFILE, project_id: projectId, site_url: siteUrl });
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [generatingColors, setGeneratingColors] = useState(false);
  const [suggestedColors, setSuggestedColors] = useState<BrandColor[]>([]);

  const { startTask, getTask, clearTask } = useBackgroundTasks();
  const crawlTask = getTask(`brand-crawl-${projectId}`);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await authenticatedFetch(`${API_ENDPOINTS.db.brand}?projectId=${projectId}`);
      const data = await parseJsonOrThrow<{ profile: BrandProfile | null }>(resp);
      if (data.profile) {
        setProfile(data.profile);
        setHasProfile(true);
      }
    } catch { /* no profile yet */ }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  useEffect(() => {
    if (crawlTask?.status === 'completed' && crawlTask.result) {
      const { profile: newProfile } = crawlTask.result as { profile: BrandProfile };
      setProfile(newProfile);
      setHasProfile(true);
      clearTask(`brand-crawl-${projectId}`);
    } else if (crawlTask?.status === 'failed') {
      clearTask(`brand-crawl-${projectId}`);
    }
  }, [crawlTask?.status]);

  const crawlSite = () => {
    startTask(`brand-crawl-${projectId}`, 'brand-crawl', `Analyzing brand: ${siteUrl}`, async () => {
      const resp = await authenticatedFetch(API_ENDPOINTS.brand.crawl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, projectId }),
      });
      const data = await parseJsonOrThrow<{ profile: BrandProfile }>(resp);
      return data;
    });
  };

  const saveProfile = async (updates: Partial<BrandProfile>) => {
    setSaving(true);
    setSaveStatus(null);
    const merged = { ...profile, ...updates };
    setProfile(merged);
    try {
      const resp = await authenticatedFetch(API_ENDPOINTS.db.brand, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, site_url: siteUrl, ...updates }),
      });
      const data = await parseJsonOrThrow<{ profile: BrandProfile }>(resp);
      if (data.profile) setProfile(data.profile);
      setHasProfile(true);
      setSaveStatus('Saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      console.error('Failed to save brand profile:', err);
      setSaveStatus('Failed to save');
    }
    setSaving(false);
  };

  const generateColors = async () => {
    if (profile.colors.length === 0) return;
    setGeneratingColors(true);
    setSuggestedColors([]);
    try {
      const resp = await authenticatedFetch(API_ENDPOINTS.brand.crawl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, generateColors: true, currentColors: profile.colors }),
      });
      const data = await parseJsonOrThrow<{ colors: BrandColor[] }>(resp);
      setSuggestedColors(data.colors || []);
    } catch (err) {
      console.error('Failed to generate colors:', err);
    }
    setGeneratingColors(false);
  };

  const addSuggestedColor = (color: BrandColor) => {
    const newColors = [...profile.colors, color];
    saveProfile({ colors: newColors });
    setSuggestedColors((prev) => prev.filter((c) => c.hex !== color.hex));
  };

  const updateColor = (idx: number, color: BrandColor) => {
    const newColors = profile.colors.map((c, i) => (i === idx ? color : c));
    saveProfile({ colors: newColors });
  };

  const removeColor = (idx: number) => {
    saveProfile({ colors: profile.colors.filter((_, i) => i !== idx) });
  };

  const addBlankColor = () => {
    saveProfile({ colors: [...profile.colors, { hex: '#000000', name: '', role: 'accent' }] });
  };

  const updateLogo = (idx: number, logo: BrandLogo) => {
    const newLogos = profile.logos.map((l, i) => (i === idx ? logo : l));
    saveProfile({ logos: newLogos });
  };

  const removeLogo = (idx: number) => {
    saveProfile({ logos: profile.logos.filter((_, i) => i !== idx) });
  };

  const addLogo = () => {
    saveProfile({ logos: [...profile.logos, { url: '', alt: '', type: 'secondary' }] });
  };

  const updateButton = (idx: number, btn: BrandButton) => {
    const newBtns = profile.button_styles.map((b, i) => (i === idx ? btn : b));
    saveProfile({ button_styles: newBtns });
  };

  const removeButton = (idx: number) => {
    saveProfile({ button_styles: profile.button_styles.filter((_, i) => i !== idx) });
  };

  const addButton = () => {
    saveProfile({ button_styles: [...profile.button_styles, { css: 'background: #2563eb; color: white; border-radius: 8px; padding: 10px 20px; font-weight: 600', label: 'Button', variant: 'primary' }] });
  };

  const openGuidelines = () => {
    window.open(`${API_ENDPOINTS.brand.guidelines}?projectId=${projectId}`, '_blank');
  };

  const isCrawling = crawlTask?.status === 'running';

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-apple-text-secondary text-apple-sm justify-center">
        <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
        Loading brand profile...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-apple-text">Brand</h1>
          <p className="text-apple-sm text-apple-text-secondary mt-1">
            Your brand identity and style guidelines. Auto-detect from your site or configure manually.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus && (
            <span className={`text-apple-xs font-medium ${saveStatus === 'Saved' ? 'text-green-600' : 'text-red-500'}`}>
              {saveStatus}
            </span>
          )}
          {saving && <div className="w-3 h-3 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={crawlSite}
          disabled={isCrawling}
          className="px-4 py-2 rounded-apple-sm bg-apple-blue text-white text-apple-sm font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isCrawling ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Analyzing Site...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Auto-Detect from Site
            </>
          )}
        </button>
        {hasProfile && (
          <button
            onClick={openGuidelines}
            className="px-4 py-2 rounded-apple-sm border border-apple-border text-apple-text text-apple-sm font-medium hover:bg-apple-fill-secondary transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Brand Guidelines
          </button>
        )}
      </div>

      {!hasProfile && !isCrawling && (
        <div className="bg-white rounded-apple border border-apple-border p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-apple-text mb-2">No brand profile yet</h2>
          <p className="text-apple-sm text-apple-text-secondary max-w-md mx-auto">
            Click "Auto-Detect from Site" to crawl your homepage and let AI analyze your brand's visual identity, colors, typography, and voice. You can edit everything afterwards.
          </p>
        </div>
      )}

      {(hasProfile || isCrawling) && (
        <div className="space-y-5">
          {/* Brand Style */}
          <Section title="Brand Style" desc="Overall visual style and identity">
            <textarea
              value={profile.brand_style || ''}
              onChange={(e) => setProfile({ ...profile, brand_style: e.target.value })}
              onBlur={() => saveProfile({ brand_style: profile.brand_style })}
              placeholder="e.g., Modern minimalist with bold sans-serif typography and a blue-dominant palette"
              className="input w-full text-apple-sm min-h-[80px] resize-y"
            />
          </Section>

          {/* Logos */}
          <Section title="Logos" desc="Brand logo assets detected or configured">
            {profile.logos.length === 0 && <EmptyField text="No logos detected. Add one manually." />}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {profile.logos.map((logo, i) => (
                <div key={i} className="bg-apple-fill-secondary rounded-apple-sm border border-apple-divider p-4 space-y-3">
                  {logo.url && (
                    <div className="h-16 flex items-center justify-center bg-white rounded-lg border border-apple-divider p-2">
                      <img src={logo.url} alt={logo.alt} className="max-h-full max-w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  )}
                  <input
                    value={logo.url}
                    onChange={(e) => updateLogo(i, { ...logo, url: e.target.value })}
                    placeholder="Logo URL"
                    className="input text-apple-xs w-full py-1 font-mono"
                  />
                  <div className="flex gap-2">
                    <input
                      value={logo.alt}
                      onChange={(e) => updateLogo(i, { ...logo, alt: e.target.value })}
                      placeholder="Alt text"
                      className="input text-apple-xs flex-1 py-1"
                    />
                    <select
                      value={logo.type}
                      onChange={(e) => updateLogo(i, { ...logo, type: e.target.value })}
                      className="input text-apple-xs py-1"
                    >
                      <option value="primary">Primary</option>
                      <option value="secondary">Secondary</option>
                      <option value="icon">Icon</option>
                    </select>
                  </div>
                  <button onClick={() => removeLogo(i)} className="text-apple-xs text-apple-red hover:underline">Remove</button>
                </div>
              ))}
            </div>
            <button onClick={addLogo} className="mt-3 text-apple-xs text-apple-blue font-medium hover:underline">+ Add Logo</button>
          </Section>

          {/* Typography */}
          <Section title="Typography" desc="Heading and body fonts with styling rules">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FontEditor
                label="Heading Font"
                font={profile.fonts.heading || { family: '', weight: '700', style: 'normal' }}
                onChange={(f) => saveProfile({ fonts: { ...profile.fonts, heading: f } })}
              />
              <FontEditor
                label="Body Font"
                font={profile.fonts.body || { family: '', weight: '400', style: 'normal' }}
                onChange={(f) => saveProfile({ fonts: { ...profile.fonts, body: f } })}
              />
            </div>
            <div className="mt-4 bg-apple-fill-secondary rounded-apple-sm border border-apple-divider p-4">
              <h4 className="text-apple-xs font-semibold text-apple-text mb-3">Font Styling</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-apple-text-tertiary mb-1">Heading Case</label>
                  <select
                    value={profile.font_styling.headingCase || 'none'}
                    onChange={(e) => saveProfile({ font_styling: { ...profile.font_styling, headingCase: e.target.value } })}
                    className="input text-apple-xs w-full py-1"
                  >
                    <option value="none">None (as written)</option>
                    <option value="uppercase">UPPERCASE</option>
                    <option value="capitalize">Capitalize Each Word</option>
                    <option value="lowercase">lowercase</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-apple-text-tertiary mb-1">Letter Spacing</label>
                  <input
                    value={profile.font_styling.letterSpacing || ''}
                    onChange={(e) => setProfile({ ...profile, font_styling: { ...profile.font_styling, letterSpacing: e.target.value } })}
                    onBlur={() => saveProfile({ font_styling: profile.font_styling })}
                    placeholder="e.g., 0.05em"
                    className="input text-apple-xs w-full py-1 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-apple-text-tertiary mb-1">Line Height</label>
                  <input
                    value={profile.font_styling.lineHeight || ''}
                    onChange={(e) => setProfile({ ...profile, font_styling: { ...profile.font_styling, lineHeight: e.target.value } })}
                    onBlur={() => saveProfile({ font_styling: profile.font_styling })}
                    placeholder="e.g., 1.6"
                    className="input text-apple-xs w-full py-1 font-mono"
                  />
                </div>
              </div>
              {/* Live preview */}
              {profile.fonts.heading?.family && (
                <div className="mt-4 p-4 bg-white rounded-lg border border-apple-divider">
                  <div className="text-[10px] text-apple-text-tertiary mb-2 uppercase tracking-wide">Preview</div>
                  <h3
                    className="text-lg font-bold text-apple-text"
                    style={{
                      fontFamily: `'${profile.fonts.heading.family}', sans-serif`,
                      textTransform: (profile.font_styling.headingCase || 'none') as 'uppercase' | 'capitalize' | 'lowercase' | 'none',
                      letterSpacing: profile.font_styling.letterSpacing || undefined,
                    }}
                  >
                    Sample Heading Text
                  </h3>
                  {profile.fonts.body?.family && (
                    <p className="text-apple-sm text-apple-text-secondary mt-2" style={{ fontFamily: `'${profile.fonts.body.family}', sans-serif`, lineHeight: profile.font_styling.lineHeight || undefined }}>
                      This is sample body text using your brand's typography settings. The quick brown fox jumps over the lazy dog.
                    </p>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* Color Palette */}
          <Section title="Color Palette" desc="Brand colors with roles. Click any swatch to edit its hex code.">
            {profile.colors.length === 0 && <EmptyField text="No colors detected. Add colors manually or auto-detect from your site." />}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {profile.colors.map((color, i) => (
                <ColorSwatch
                  key={`${i}-${color.hex}`}
                  color={color}
                  onChange={(c) => updateColor(i, c)}
                  onRemove={() => removeColor(i)}
                />
              ))}
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button onClick={addBlankColor} className="text-apple-xs text-apple-blue font-medium hover:underline">+ Add Color</button>
              {profile.colors.length > 0 && (
                <button
                  onClick={generateColors}
                  disabled={generatingColors}
                  className="px-3 py-1.5 rounded-apple-sm bg-indigo-600 text-white text-apple-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {generatingColors ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate Matching Colors'
                  )}
                </button>
              )}
            </div>

            {suggestedColors.length > 0 && (
              <div className="mt-4 bg-indigo-50/50 rounded-apple-sm border border-indigo-100 p-4">
                <h4 className="text-apple-xs font-semibold text-indigo-800 mb-3">Suggested Colors — click to add</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {suggestedColors.map((color, i) => (
                    <button
                      key={i}
                      onClick={() => addSuggestedColor(color)}
                      className="rounded-xl overflow-hidden border border-indigo-200 hover:border-indigo-400 transition-colors text-left"
                    >
                      <div className="h-14 w-full" style={{ backgroundColor: color.hex }} />
                      <div className="p-2 bg-white">
                        <div className="font-mono text-[11px] font-semibold">{color.hex}</div>
                        {color.name && <div className="text-[10px] text-apple-text-secondary">{color.name}</div>}
                        <div className="text-[10px] text-apple-text-tertiary uppercase">{color.role}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={() => setSuggestedColors([])} className="mt-2 text-apple-xs text-indigo-600 hover:underline">Dismiss suggestions</button>
              </div>
            )}
          </Section>

          {/* Tagline */}
          <Section title="Tagline" desc="Your brand's tagline or slogan">
            <input
              value={profile.tagline || ''}
              onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
              onBlur={() => saveProfile({ tagline: profile.tagline })}
              placeholder="e.g., Build something great"
              className="input w-full text-apple-sm"
            />
          </Section>

          {/* Mission Statement */}
          <Section title="Mission Statement" desc="Auto-generated from your site, fully editable">
            <textarea
              value={profile.mission_statement || ''}
              onChange={(e) => setProfile({ ...profile, mission_statement: e.target.value })}
              onBlur={() => saveProfile({ mission_statement: profile.mission_statement })}
              placeholder="Your brand's mission statement..."
              className="input w-full text-apple-sm min-h-[80px] resize-y"
            />
          </Section>

          {/* Button Styles */}
          <Section title="Button Styles" desc="Primary interactive element styles with live previews">
            {profile.button_styles.length === 0 && <EmptyField text="No button styles detected." />}
            {profile.button_styles.map((btn, i) => (
              <div key={i} className="bg-apple-fill-secondary rounded-apple-sm border border-apple-divider p-4 mb-3">
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div dangerouslySetInnerHTML={{ __html: `<span style="${btn.css}; display: inline-block; cursor: default;">${btn.label || btn.variant || 'Button'}</span>` }} />
                    <input
                      value={btn.label}
                      onChange={(e) => updateButton(i, { ...btn, label: e.target.value })}
                      placeholder="Label"
                      className="input text-apple-xs py-1 w-32"
                    />
                    <select
                      value={btn.variant}
                      onChange={(e) => updateButton(i, { ...btn, variant: e.target.value })}
                      className="input text-apple-xs py-1"
                    >
                      <option value="primary">Primary</option>
                      <option value="secondary">Secondary</option>
                      <option value="outline">Outline</option>
                    </select>
                  </div>
                  <button onClick={() => removeButton(i)} className="text-apple-xs text-apple-red hover:underline shrink-0">Remove</button>
                </div>
                <textarea
                  value={btn.css}
                  onChange={(e) => updateButton(i, { ...btn, css: e.target.value })}
                  placeholder="CSS properties..."
                  className="input w-full text-apple-xs font-mono py-1 min-h-[40px] resize-y"
                />
              </div>
            ))}
            <button onClick={addButton} className="text-apple-xs text-apple-blue font-medium hover:underline">+ Add Button Style</button>
          </Section>

          {/* Voice & Tone */}
          <Section title="Voice & Tone" desc="How the brand communicates">
            <textarea
              value={profile.voice_and_tone || ''}
              onChange={(e) => setProfile({ ...profile, voice_and_tone: e.target.value })}
              onBlur={() => saveProfile({ voice_and_tone: profile.voice_and_tone })}
              placeholder="e.g., Professional yet approachable, with clear and concise language..."
              className="input w-full text-apple-sm min-h-[80px] resize-y"
            />
          </Section>

          {/* Spacing & Effects */}
          <Section title="Spacing & Effects" desc="Border radius, shadows, and padding patterns">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1">Border Radius</label>
                <input
                  value={profile.spacing.borderRadius || ''}
                  onChange={(e) => setProfile({ ...profile, spacing: { ...profile.spacing, borderRadius: e.target.value } })}
                  onBlur={() => saveProfile({ spacing: profile.spacing })}
                  placeholder="e.g., 8px"
                  className="input text-apple-xs w-full py-1 font-mono"
                />
              </div>
              <div>
                <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1">Box Shadow</label>
                <input
                  value={profile.spacing.shadows || ''}
                  onChange={(e) => setProfile({ ...profile, spacing: { ...profile.spacing, shadows: e.target.value } })}
                  onBlur={() => saveProfile({ spacing: profile.spacing })}
                  placeholder="e.g., 0 2px 8px rgba(0,0,0,0.1)"
                  className="input text-apple-xs w-full py-1 font-mono"
                />
              </div>
              <div>
                <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1">Section Padding</label>
                <input
                  value={profile.spacing.padding || ''}
                  onChange={(e) => setProfile({ ...profile, spacing: { ...profile.spacing, padding: e.target.value } })}
                  onBlur={() => saveProfile({ spacing: profile.spacing })}
                  placeholder="e.g., 60px 0"
                  className="input text-apple-xs w-full py-1 font-mono"
                />
              </div>
            </div>
          </Section>

          {/* Additional Notes */}
          <Section title="Additional Notes" desc="Anything else about your brand">
            <textarea
              value={profile.additional_notes || ''}
              onChange={(e) => setProfile({ ...profile, additional_notes: e.target.value })}
              onBlur={() => saveProfile({ additional_notes: profile.additional_notes })}
              placeholder="Any additional brand notes, do's and don'ts, special guidelines..."
              className="input w-full text-apple-sm min-h-[80px] resize-y"
            />
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-apple border border-apple-border p-5">
      <h2 className="text-base font-semibold text-apple-text mb-1">{title}</h2>
      <p className="text-apple-xs text-apple-text-secondary mb-4">{desc}</p>
      {children}
    </div>
  );
}

function EmptyField({ text }: { text: string }) {
  return <p className="text-apple-xs text-apple-text-tertiary italic mb-3">{text}</p>;
}

function FontEditor({ label, font, onChange }: { label: string; font: BrandFont; onChange: (f: BrandFont) => void }) {
  const [local, setLocal] = useState(font);
  useEffect(() => { setLocal(font); }, [font.family, font.weight, font.style]);

  return (
    <div className="bg-apple-fill-secondary rounded-apple-sm border border-apple-divider p-4">
      <h4 className="text-apple-xs font-semibold text-apple-text mb-3">{label}</h4>
      <div className="space-y-2">
        <input
          value={local.family}
          onChange={(e) => setLocal({ ...local, family: e.target.value })}
          onBlur={() => onChange(local)}
          placeholder="Font family (e.g., Inter)"
          className="input text-apple-xs w-full py-1"
        />
        <div className="flex gap-2">
          <select
            value={local.weight}
            onChange={(e) => { const f = { ...local, weight: e.target.value }; setLocal(f); onChange(f); }}
            className="input text-apple-xs flex-1 py-1"
          >
            <option value="300">300 (Light)</option>
            <option value="400">400 (Regular)</option>
            <option value="500">500 (Medium)</option>
            <option value="600">600 (Semibold)</option>
            <option value="700">700 (Bold)</option>
            <option value="800">800 (Extra Bold)</option>
            <option value="900">900 (Black)</option>
          </select>
          <select
            value={local.style}
            onChange={(e) => { const f = { ...local, style: e.target.value }; setLocal(f); onChange(f); }}
            className="input text-apple-xs py-1"
          >
            <option value="normal">Normal</option>
            <option value="italic">Italic</option>
          </select>
        </div>
      </div>
    </div>
  );
}
