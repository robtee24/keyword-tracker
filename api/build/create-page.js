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
1. VALUE PROPOSITION: Can a visitor understand what this is and why they should care in 5 seconds? Is the primary benefit clear, specific, and differentiated?
2. HEADLINE: Communicates core value prop. Specific, not generic. Matches traffic source messaging.
3. CTA: One clear primary action. Visible without scrolling. Button text communicates value ("Start Free Trial" not "Submit"). Repeated at key decision points.
4. VISUAL HIERARCHY: Scannable layout. Most important elements visually prominent. Enough white space. Images support (not distract from) the message.
5. TRUST SIGNALS: Customer logos (recognizable ones). Testimonials (specific, attributed). Case study snippets with real numbers. Review scores. Security badges. Place near CTAs.
6. OBJECTION HANDLING: Address price/value, "will this work for me?", implementation difficulty, "what if it doesn't work?" through FAQ sections, guarantees, comparisons.
7. FRICTION REDUCTION: Minimal form fields. Clear next steps. Simple navigation. Mobile-optimized.

=== MARKETING PSYCHOLOGY ===
- Jobs to Be Done: Frame product around the outcome, not specifications.
- Social Proof: People follow the behavior of others. Show numbers, testimonials, logos.
- Loss Aversion: People feel losses ~2x stronger than equivalent gains. Frame what they'll miss.
- Anchoring: The first piece of information anchors all subsequent judgments.
- Reciprocity: Give value first (free tools, resources, insights).
- Authority: Demonstrate expertise through data, certifications, press mentions.
- Scarcity: Authentic (not manufactured) urgency drives action.
- Cognitive Ease: Make the desired action the easiest path.

=== SCHEMA MARKUP ===
- Use JSON-LD format (Google recommended). Place in <head> or end of <body>.
- Implement: Organization, WebPage, BreadcrumbList, FAQ (if Q&A content), Product (if products), Review/AggregateRating.
- Schema must accurately represent page content. Don't markup nonexistent content.

=== SECTION STRUCTURE ===
Above the Fold: Headline + subheadline + primary CTA + hero visual + social proof hint
Problem Section: Describe the pain point your audience experiences. Be specific and empathetic.
Solution Section: Introduce your product/service as the answer. Bridge from problem to solution.
How It Works: 3-4 simple steps showing the process. Reduces perceived complexity.
Benefits (not features): Focus on outcomes and transformations.
Social Proof: Testimonials, case studies, logos, stats.
FAQ: Address top objections disguised as questions.
Final CTA: Repeat primary action with urgency or incentive.
`;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { siteUrl, title, slug, purpose, targetKeyword, outline, objectives, style } = req.body || {};
  if (!siteUrl || !title) return res.status(400).json({ error: 'siteUrl and title required' });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });

  let homePageStyles = '';
  try {
    homePageStyles = await extractHomePageStyles(new URL(siteUrl).origin + '/');
  } catch { /* non-critical */ }

  const prompt = `You are a world-class web developer, copywriter, SEO specialist, and conversion optimizer. You have deep expertise in marketing psychology, CRO, and content strategy. Build a complete, publish-ready web page that is exceptional.

${MARKETING_SKILLS}

WEBSITE: ${siteUrl}
BUSINESS OBJECTIVES: ${objectives || 'Maximize organic traffic and conversions'}

${homePageStyles ? `=== EXISTING SITE STYLES (match these exactly) ===\n${homePageStyles}\n` : ''}

PAGE DETAILS:
Title: ${title}
URL Slug: ${slug || 'auto-generate'}
Purpose: ${purpose || 'Drive traffic and conversions'}
Target Keyword: ${targetKeyword || 'Infer from title'}
${style ? `Design Style: ${style}` : ''}
${outline ? `Page Sections: ${Array.isArray(outline) ? outline.join(', ') : outline}` : ''}

REQUIREMENTS — Apply ALL marketing skills and frameworks above:
1. Write REAL, compelling, specific copy — not generic placeholder text
2. Use proven headline formulas from above. Every heading must be benefit-driven
3. Apply the complete CRO framework: value prop, CTAs, trust signals, objection handling
4. Apply marketing psychology: social proof, authority, loss aversion, anchoring, reciprocity
5. Structure for scanability: short paragraphs, bullets, subheadings every 2-3 paragraphs
6. Include proper HTML with semantic elements and inline CSS matching the site's styling
7. Include specific image placements with detailed descriptions of what each image should show
8. Suggest specific, quantified CTAs (not "Get Started" but "Start Your Free 14-Day Trial")
9. Include a FAQ section addressing likely objections
10. Include schema markup for the page type
11. Make content substantive — minimum 1500 words of actual content
12. Address the complete conversion funnel relevant to this page type

Respond with ONLY valid JSON:
{
  "title": "<optimized page title using headline formula>",
  "metaDescription": "<compelling meta description under 155 chars>",
  "slug": "<url-friendly-slug>",
  "htmlContent": "<complete page HTML content (body section only). Include inline CSS for styling that matches the site. Include image placeholders with descriptive alt text. Follow the section structure framework.>",
  "schemaMarkup": "<complete JSON-LD schema markup>",
  "suggestedImages": ["<specific image description: what it shows, dimensions, where it goes, and why it helps conversions>"],
  "internalLinkSuggestions": ["<pages to link to/from with context>"],
  "summary": "<what was built, which marketing frameworks were applied, and key conversion elements included>"
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: `Build this page: "${title}". Apply all marketing skills and frameworks to make it exceptional.` },
        ],
        temperature: 0.4,
        max_tokens: 10000,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => 'unknown');
      throw new Error(`OpenAI error (${response.status}): ${detail}`);
    }

    const data = await response.json();
    let raw = data.choices?.[0]?.message?.content || '';
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
    const uniqueColors = [...new Set(colorMatches.map(c => c.trim()).slice(0, 15))];
    if (uniqueColors.length) styles.push(`Colors used: ${uniqueColors.join('; ')}`);

    const fontMatches = allCss.match(/font-family\s*:\s*([^;}\n]+)/gi) || [];
    const uniqueFonts = [...new Set(fontMatches.map(f => f.trim()).slice(0, 5))];
    if (uniqueFonts.length) styles.push(`Fonts: ${uniqueFonts.join('; ')}`);

    const googleFontMatch = html.match(/fonts\.googleapis\.com\/css2?\?family=([^"'&]+)/i);
    if (googleFontMatch) styles.push(`Google Fonts: ${decodeURIComponent(googleFontMatch[1])}`);

    const borderRadiusMatches = allCss.match(/border-radius\s*:\s*([^;}\n]+)/gi) || [];
    if (borderRadiusMatches.length) styles.push(`Border radius: ${[...new Set(borderRadiusMatches.slice(0, 3))].join('; ')}`);

    const cssVars = allCss.match(/--[a-zA-Z0-9-]+\s*:\s*[^;]+/g) || [];
    if (cssVars.length) styles.push(`CSS variables: ${cssVars.slice(0, 15).join('; ')}`);

    return styles.join('\n') || '';
  } catch {
    return '';
  }
}
