import { getSupabase } from '../db.js';
import { authenticateRequest } from '../_config.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ error: 'projectId is required' });

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Database not available' });

  const { data: profile, error } = await supabase
    .from('brand_profiles')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error || !profile) {
    return res.status(404).json({ error: 'Brand profile not found' });
  }

  const colors = profile.colors || [];
  const fonts = profile.fonts || {};
  const fontStyling = profile.font_styling || {};
  const logos = profile.logos || [];
  const buttons = profile.button_styles || [];
  const spacing = profile.spacing || {};

  const primaryColor = colors.find(c => c.role === 'primary')?.hex || '#2563eb';
  const textColor = colors.find(c => c.role === 'text')?.hex || '#1a1a1a';
  const bgColor = colors.find(c => c.role === 'background')?.hex || '#ffffff';

  const siteName = profile.site_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Brand Guidelines — ${siteName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --brand-primary: ${primaryColor};
      --brand-text: ${textColor};
      --brand-bg: ${bgColor};
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #1a1a2e;
      line-height: 1.6;
      background: #fff;
    }

    @media print {
      body { font-size: 11pt; }
      .page-break { page-break-before: always; }
      .no-print { display: none !important; }
      section { page-break-inside: avoid; }
    }

    .container { max-width: 800px; margin: 0 auto; padding: 60px 40px; }

    .cover {
      text-align: center;
      padding: 120px 40px;
      border-bottom: 4px solid var(--brand-primary);
      margin-bottom: 60px;
    }
    .cover h1 {
      font-size: 42px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 8px;
    }
    .cover .subtitle {
      font-size: 18px;
      color: #64748b;
      font-weight: 400;
    }
    .cover .date {
      margin-top: 24px;
      font-size: 13px;
      color: #94a3b8;
    }

    section { margin-bottom: 56px; }
    section h2 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e2e8f0;
      color: var(--brand-primary);
    }
    section h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 10px;
      color: #334155;
    }
    section p {
      margin-bottom: 12px;
      color: #475569;
      font-size: 15px;
    }

    .color-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }
    .color-swatch {
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    .color-swatch .preview {
      height: 80px;
      width: 100%;
    }
    .color-swatch .info {
      padding: 10px 12px;
      background: #f8fafc;
    }
    .color-swatch .hex {
      font-family: 'SF Mono', Menlo, monospace;
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
    }
    .color-swatch .name {
      font-size: 12px;
      color: #64748b;
      margin-top: 2px;
    }
    .color-swatch .role {
      font-size: 11px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 4px;
    }

    .font-specimen {
      background: #f8fafc;
      border-radius: 10px;
      padding: 24px;
      margin-bottom: 16px;
      border: 1px solid #e2e8f0;
    }
    .font-specimen .family {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .font-specimen .meta {
      font-size: 13px;
      color: #64748b;
    }
    .font-specimen .sample {
      margin-top: 12px;
      font-size: 16px;
      color: #334155;
      line-height: 1.7;
    }

    .logo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 20px;
      margin-top: 16px;
    }
    .logo-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 24px;
      text-align: center;
    }
    .logo-card img {
      max-width: 100%;
      max-height: 80px;
      object-fit: contain;
    }
    .logo-card .label {
      margin-top: 10px;
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .button-showcase {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-top: 16px;
      align-items: center;
    }
    .button-demo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: default;
      font-family: inherit;
      border: none;
      text-decoration: none;
    }
    .button-info {
      margin-top: 16px;
    }
    .button-info code {
      display: block;
      background: #f1f5f9;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-family: 'SF Mono', Menlo, monospace;
      color: #334155;
      white-space: pre-wrap;
      margin-top: 8px;
      border: 1px solid #e2e8f0;
    }

    .detail-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 24px;
      margin-top: 12px;
    }
    .detail-card p { margin-bottom: 0; }

    .spacing-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-top: 16px;
    }
    .spacing-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
    }
    .spacing-item .label {
      font-size: 12px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .spacing-item .value {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
      margin-top: 4px;
      font-family: 'SF Mono', Menlo, monospace;
    }

    .footer-note {
      text-align: center;
      padding: 40px 0;
      border-top: 1px solid #e2e8f0;
      font-size: 13px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="cover">
      <h1>Brand Guidelines</h1>
      <div class="subtitle">${siteName}</div>
      <div class="date">Generated ${dateStr}</div>
    </div>

    ${profile.brand_style ? `
    <section>
      <h2>Brand Overview</h2>
      <p>${profile.brand_style}</p>
      ${profile.tagline ? `<div class="detail-card"><h3>Tagline</h3><p>"${profile.tagline}"</p></div>` : ''}
      ${profile.mission_statement ? `<div class="detail-card"><h3>Mission Statement</h3><p>${profile.mission_statement}</p></div>` : ''}
    </section>` : ''}

    ${logos.length > 0 ? `
    <section>
      <h2>Logo</h2>
      <p>Primary and secondary logo assets for the brand.</p>
      <div class="logo-grid">
        ${logos.map(l => `
          <div class="logo-card">
            <img src="${l.url}" alt="${l.alt || 'Logo'}" onerror="this.style.display='none'" />
            <div class="label">${l.type}</div>
          </div>
        `).join('')}
      </div>
    </section>` : ''}

    ${colors.length > 0 ? `
    <section class="page-break">
      <h2>Color Palette</h2>
      <p>The brand's core color system.</p>
      <div class="color-grid">
        ${colors.map(c => `
          <div class="color-swatch">
            <div class="preview" style="background-color: ${c.hex}"></div>
            <div class="info">
              <div class="hex">${c.hex}</div>
              ${c.name ? `<div class="name">${c.name}</div>` : ''}
              <div class="role">${c.role}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </section>` : ''}

    ${(fonts.heading || fonts.body) ? `
    <section>
      <h2>Typography</h2>
      ${fonts.heading ? `
      <div class="font-specimen">
        <div class="family" style="font-family: '${fonts.heading.family}', sans-serif">${fonts.heading.family}</div>
        <div class="meta">Heading Font &middot; Weight: ${fonts.heading.weight || '700'} &middot; Style: ${fonts.heading.style || 'normal'}</div>
        <div class="sample" style="font-family: '${fonts.heading.family}', sans-serif; font-weight: ${fonts.heading.weight || '700'}; ${fontStyling.headingCase ? `text-transform: ${fontStyling.headingCase}` : ''}">
          The quick brown fox jumps over the lazy dog
        </div>
      </div>` : ''}
      ${fonts.body ? `
      <div class="font-specimen">
        <div class="family" style="font-family: '${fonts.body.family}', sans-serif">${fonts.body.family}</div>
        <div class="meta">Body Font &middot; Weight: ${fonts.body.weight || '400'} &middot; Style: ${fonts.body.style || 'normal'}</div>
        <div class="sample" style="font-family: '${fonts.body.family}', sans-serif; font-weight: ${fonts.body.weight || '400'}">
          The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump.
        </div>
      </div>` : ''}
      ${fontStyling.headingCase || fontStyling.letterSpacing || fontStyling.lineHeight ? `
      <div class="detail-card">
        <h3>Typography Rules</h3>
        ${fontStyling.headingCase ? `<p><strong>Heading Case:</strong> ${fontStyling.headingCase}</p>` : ''}
        ${fontStyling.letterSpacing ? `<p><strong>Letter Spacing:</strong> ${fontStyling.letterSpacing}</p>` : ''}
        ${fontStyling.lineHeight ? `<p><strong>Line Height:</strong> ${fontStyling.lineHeight}</p>` : ''}
      </div>` : ''}
    </section>` : ''}

    ${buttons.length > 0 ? `
    <section>
      <h2>Button Styles</h2>
      <p>Primary interactive elements and their variants.</p>
      <div class="button-showcase">
        ${buttons.map(b => `<div class="button-demo" style="${b.css}">${b.label || b.variant || 'Button'}</div>`).join('')}
      </div>
      <div class="button-info">
        <h3>CSS Reference</h3>
        ${buttons.map(b => `<div><strong>${b.variant || 'Button'}:</strong><code>${b.css}</code></div>`).join('')}
      </div>
    </section>` : ''}

    ${(spacing.borderRadius || spacing.shadows || spacing.padding) ? `
    <section>
      <h2>Spacing &amp; Effects</h2>
      <div class="spacing-grid">
        ${spacing.borderRadius ? `<div class="spacing-item"><div class="label">Border Radius</div><div class="value">${spacing.borderRadius}</div></div>` : ''}
        ${spacing.shadows && spacing.shadows !== 'none' ? `<div class="spacing-item"><div class="label">Box Shadow</div><div class="value">${spacing.shadows}</div></div>` : ''}
        ${spacing.padding ? `<div class="spacing-item"><div class="label">Section Padding</div><div class="value">${spacing.padding}</div></div>` : ''}
      </div>
    </section>` : ''}

    ${profile.voice_and_tone ? `
    <section>
      <h2>Voice &amp; Tone</h2>
      <p>${profile.voice_and_tone}</p>
    </section>` : ''}

    ${profile.additional_notes ? `
    <section>
      <h2>Additional Notes</h2>
      <p>${profile.additional_notes}</p>
    </section>` : ''}

    <div class="footer-note">
      Brand Guidelines for ${siteName} &middot; Generated by SEAUTO &middot; ${dateStr}
    </div>
  </div>

  <script class="no-print">
    window.onload = function() {
      document.title = 'Brand Guidelines — ${siteName}';
    };
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
}
