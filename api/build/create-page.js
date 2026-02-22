export const config = { maxDuration: 120 };

const MARKETING_SKILLS = `
=== COPYWRITING RULES ===
- Clarity over cleverness. If you have to choose, choose clear.
- Benefits over features. Features = what it does. Benefits = what that means for the customer.
- Specificity over vagueness: "Cut your weekly reporting from 4 hours to 15 minutes" NOT "Save time on your workflow"
- Use the customer's language, not company jargon.
- One idea per section. Each section advances one argument.
- Simple over complex: "Use" not "utilize," "help" not "facilitate"
- Active over passive: "We generate reports" not "Reports are generated"
- No exclamation points. No marketing buzzwords without substance.

=== HEADLINE FORMULAS ===
- Outcome: "{Achieve outcome} without {pain point}"
- Problem: "Never {unpleasant event} again"
- Audience: "{Feature} for {audience} to {what it's used for}"
- Proof: "[Number] [people] use [product] to [outcome]"
- Differentiation: "The [category] that [key differentiator]"

=== PAGE CRO FRAMEWORK ===
1. VALUE PROPOSITION: Can a visitor understand what this is and why they should care in 5 seconds?
2. HEADLINE: Communicates core value prop. Specific, not generic.
3. CTA: One clear primary action. Visible without scrolling. Button text communicates value.
4. VISUAL HIERARCHY: Scannable layout. Most important elements visually prominent.
5. TRUST SIGNALS: Customer logos, testimonials, case study snippets, review scores.
6. OBJECTION HANDLING: Address price/value, "will this work for me?", implementation difficulty.
7. FRICTION REDUCTION: Minimal form fields. Clear next steps. Mobile-optimized.

=== MARKETING PSYCHOLOGY ===
- Jobs to Be Done: Frame product around the outcome, not specifications.
- Social Proof: People follow the behavior of others. Show numbers, testimonials, logos.
- Loss Aversion: People feel losses ~2x stronger than equivalent gains.
- Anchoring: The first piece of information anchors all subsequent judgments.
- Reciprocity: Give value first (free tools, resources, insights).
- Authority: Demonstrate expertise through data, certifications, press mentions.
- Scarcity: Authentic (not manufactured) urgency drives action.
- Cognitive Ease: Make the desired action the easiest path.

=== SCHEMA MARKUP ===
- Use JSON-LD format. Implement: Organization, WebPage, BreadcrumbList, FAQ, Product, Review/AggregateRating as applicable.

=== SECTION STRUCTURE ===
Above the Fold: Headline + subheadline + primary CTA + hero visual + social proof hint
Problem Section: Describe the pain point your audience experiences.
Solution Section: Introduce your product/service as the answer.
How It Works: 3-4 simple steps showing the process.
Benefits (not features): Focus on outcomes and transformations.
Social Proof: Testimonials, case studies, logos, stats.
FAQ: Address top objections disguised as questions.
Final CTA: Repeat primary action with urgency or incentive.
`;

async function callClaude(systemPrompt, userMessage, maxTokens = 16000) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => 'unknown');
    throw new Error(`Claude API error (${response.status}): ${detail}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { siteUrl, title, slug, purpose, targetKeyword, outline, objectives, style } = req.body || {};
  if (!siteUrl || !title) return res.status(400).json({ error: 'siteUrl and title required' });

  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });

  let homePageStyles = '';
  try {
    homePageStyles = await extractHomePageStyles(new URL(siteUrl).origin + '/');
  } catch { /* non-critical */ }

  const systemPrompt = `You are a world-class web developer, UI/UX designer, copywriter, SEO specialist, and conversion optimizer. You build pages that are visually stunning — with modern design, clean typography, proper spacing, polished CSS, and professional aesthetics.

${MARKETING_SKILLS}

CRITICAL DESIGN RULES:
- Include a complete <style> tag at the top of htmlContent with all CSS
- Use CSS custom properties (variables) for a cohesive theme (colors, spacing, fonts)
- Use modern CSS: flexbox, grid, gradients, box-shadows, border-radius, transitions
- Create proper typography hierarchy: distinct font sizes for h1/h2/h3/body/small text
- Add generous padding and margins between sections (min 60px section padding)
- Alternate section background colors for visual rhythm (white, light gray, brand color)
- Style buttons with padding, background color, border-radius, hover effects, and transitions
- Use cards with border-radius, box-shadow, and padding for content blocks
- Include hover states for all interactive elements
- Add responsive media queries for mobile/tablet
- Use max-width containers (1200px) with auto margins for centered content
- Create visual interest with gradients, subtle patterns, or decorative elements
- Include proper header/navigation structure and footer
- The page MUST look like it was built by a professional designer, not plain unstyled HTML`;

  const userMessage = `Build a complete, publish-ready web page that looks professionally designed.

WEBSITE: ${siteUrl}
BUSINESS OBJECTIVES: ${objectives || 'Maximize organic traffic and conversions'}

${homePageStyles ? `=== EXISTING SITE STYLES (match these) ===\n${homePageStyles}\n` : ''}

PAGE DETAILS:
Title: ${title}
URL Slug: ${slug || 'auto-generate'}
Purpose: ${purpose || 'Drive traffic and conversions'}
Target Keyword: ${targetKeyword || 'Infer from title'}
${style ? `Design Style: ${style}` : ''}
${outline ? `Page Sections: ${Array.isArray(outline) ? outline.join(', ') : outline}` : ''}

REQUIREMENTS:
1. Write REAL, compelling, specific copy — not generic placeholder text
2. Use proven headline formulas. Every heading must be benefit-driven
3. Apply the complete CRO framework: value prop, CTAs, trust signals, objection handling
4. Apply marketing psychology: social proof, authority, loss aversion, anchoring, reciprocity
5. Structure for scanability: short paragraphs, bullets, subheadings every 2-3 paragraphs
6. Include a <style> tag with comprehensive CSS at the top of htmlContent, then semantic HTML with classes
7. The CSS MUST create a modern, polished design: colors, spacing, typography, shadows, rounded corners, hover effects, gradients
8. Include image placeholders with descriptive alt text
9. Include specific, quantified CTAs
10. Include a FAQ section addressing likely objections
11. Include schema markup
12. Minimum 1500 words of actual content
13. The final result must look like a professionally designed webpage

Respond with ONLY valid JSON:
{
  "title": "<optimized page title>",
  "metaDescription": "<compelling meta description under 155 chars>",
  "slug": "<url-friendly-slug>",
  "htmlContent": "<complete page HTML: start with a <style> tag containing ALL CSS (variables, base styles, component styles, responsive styles), followed by semantic HTML using those classes. Must look professionally designed.>",
  "schemaMarkup": "<complete JSON-LD schema markup>",
  "suggestedImages": ["<specific image description>"],
  "internalLinkSuggestions": ["<pages to link to/from>"],
  "summary": "<what was built and key conversion elements included>"
}`;

  try {
    let raw = await callClaude(systemPrompt, userMessage, 16000);
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let page;
    try {
      page = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) page = JSON.parse(jsonMatch[0]);
      else throw new Error('Failed to parse AI response');
    }

    return res.status(200).json({ page });
  } catch (err) {
    console.error('[CreatePage] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function extractHomePageStyles(homeUrl) {
  try {
    const resp = await fetch(homeUrl, {
      headers: { 'User-Agent': 'SEAUTO-BuildBot/1.0', Accept: 'text/html' },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return '';
    const html = await resp.text();

    const styles = [];

    const inlineStyles = [];
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let styleMatch;
    while ((styleMatch = styleRegex.exec(html)) !== null) {
      inlineStyles.push(styleMatch[1]);
    }
    const allCss = inlineStyles.join('\n');

    const colorMatches = allCss.match(/(?:color|background(?:-color)?)\s*:\s*([^;}\n]+)/gi) || [];
    const uniqueColors = [...new Set(colorMatches.map(c => c.trim()).slice(0, 20))];
    if (uniqueColors.length) styles.push(`Colors used: ${uniqueColors.join('; ')}`);

    const fontMatches = allCss.match(/font-family\s*:\s*([^;}\n]+)/gi) || [];
    const uniqueFonts = [...new Set(fontMatches.map(f => f.trim()).slice(0, 5))];
    if (uniqueFonts.length) styles.push(`Fonts: ${uniqueFonts.join('; ')}`);

    const googleFontMatch = html.match(/fonts\.googleapis\.com\/css2?\?family=([^"'&]+)/i);
    if (googleFontMatch) styles.push(`Google Fonts: ${decodeURIComponent(googleFontMatch[1])}`);

    const borderRadiusMatches = allCss.match(/border-radius\s*:\s*([^;}\n]+)/gi) || [];
    if (borderRadiusMatches.length) styles.push(`Border radius: ${[...new Set(borderRadiusMatches.slice(0, 5))].join('; ')}`);

    const cssVars = allCss.match(/--[a-zA-Z0-9-]+\s*:\s*[^;]+/g) || [];
    if (cssVars.length) styles.push(`CSS variables: ${cssVars.slice(0, 20).join('; ')}`);

    const shadowPatterns = allCss.match(/box-shadow\s*:\s*([^;}\n]+)/gi) || [];
    if (shadowPatterns.length) styles.push(`Shadows: ${[...new Set(shadowPatterns.slice(0, 3))].join('; ')}`);

    return styles.join('\n') || '';
  } catch {
    return '';
  }
}
