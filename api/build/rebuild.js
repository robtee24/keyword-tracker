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

  const { siteUrl, pageUrl, improvements, objectives } = req.body || {};
  if (!siteUrl || !pageUrl) return res.status(400).json({ error: 'siteUrl and pageUrl required' });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });

  let pageContent;
  try {
    pageContent = await fetchPageContent(pageUrl);
  } catch (err) {
    return res.status(200).json({ error: `Failed to fetch page: ${err.message}` });
  }

  let homePageStyles = '';
  try {
    const homeUrl = new URL(siteUrl).origin + '/';
    if (homeUrl !== pageUrl) {
      homePageStyles = await extractHomePageStyles(homeUrl);
    }
  } catch { /* non-critical */ }

  const improvementAreas = (improvements || []).length > 0
    ? improvements.join(', ')
    : 'SEO, content quality, conversion optimization, technical performance, user experience';

  const prompt = `You are a world-class web developer, SEO specialist, copywriter, and conversion optimizer. You have deep expertise in marketing psychology, CRO, and content strategy. Rebuild this page to be exceptional.

${MARKETING_SKILLS}

WEBSITE: ${siteUrl}
PAGE URL: ${pageUrl}
BUSINESS OBJECTIVES: ${objectives || 'Improve organic traffic, conversions, and user engagement'}
AREAS TO IMPROVE: ${improvementAreas}

${homePageStyles ? `=== EXISTING SITE STYLES (match these) ===\n${homePageStyles}\n` : ''}

CURRENT PAGE ANALYSIS:
Title: ${pageContent.title || '(none)'}
Meta Description: ${pageContent.metaDescription || '(none)'}
H1: ${pageContent.headings.filter(h => h.level === 'H1').map(h => h.text).join(', ') || '(none)'}
Word Count: ~${pageContent.bodyText.split(/\\s+/).length}
Images: ${pageContent.imageCount} total, ${pageContent.imagesWithoutAlt} missing alt text
Internal Links: ${pageContent.internalLinkCount}

HEADINGS:
${pageContent.headings.map(h => \`\${h.level}: \${h.text}\`).join('\\n') || '(none)'}

BODY TEXT (first 4000 chars):
${pageContent.bodyText.substring(0, 4000)}

REBUILD INSTRUCTIONS:
1. Apply EVERY marketing skill and framework above to this page
2. Write REAL, compelling, specific copy — not generic placeholder text
3. Use proven headline formulas. Every heading must be benefit-driven or outcome-focused
4. Include specific, quantified CTAs (e.g., "Start Your Free 14-Day Trial" not "Get Started")
5. Apply marketing psychology: social proof, authority, loss aversion, anchoring
6. Structure page for scanability: short paragraphs, bullet points, subheadings
7. Add trust signals: suggest where to place testimonials, logos, stats
8. Include proper heading hierarchy (H1 > H2 > H3), meta tags, and schema markup
9. Suggest specific image placements with detailed descriptions of what each image should show
10. Include inline CSS styles that match the existing site's visual design (colors, fonts, spacing)
11. Ensure every section serves a clear purpose in the conversion funnel
12. Address likely objections through FAQ or embedded reassurance

Respond with ONLY valid JSON:
{
  "title": "<optimized page title>",
  "metaDescription": "<compelling meta description under 155 chars>",
  "recommendations": [
    {
      "area": "<improvement area>",
      "current": "<what's wrong now — be specific>",
      "improved": "<exact change made>",
      "reason": "<why this improves the page, citing which marketing principle it applies>"
    }
  ],
  "htmlContent": "<complete rebuilt page HTML content (body only). Include inline CSS for styling. Include image placeholders with descriptive alt text. Include structured sections following the CRO framework.>",
  "schemaMarkup": "<complete JSON-LD schema markup>",
  "suggestedImages": ["<specific image description: what it shows, where it goes, and why>"],
  "summary": "<2-3 sentence summary of all changes made and which marketing frameworks were applied>"
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: `Rebuild this page with improvements to: ${improvementAreas}. Apply all marketing skills and frameworks.` },
        ],
        temperature: 0.3,
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

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
      else throw new Error('Failed to parse AI response');
    }

    return res.status(200).json({ result });
  } catch (err) {
    console.error('[BuildRebuild] Error:', err.message);
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

    const btnStyles = allCss.match(/\.btn[^{]*\{[^}]+\}/gi) || allCss.match(/button[^{]*\{[^}]+\}/gi) || [];
    if (btnStyles.length) styles.push(`Button styles found: ${btnStyles.length}`);

    const cssVars = allCss.match(/--[a-zA-Z0-9-]+\s*:\s*[^;]+/g) || [];
    if (cssVars.length) styles.push(`CSS variables: ${cssVars.slice(0, 15).join('; ')}`);

    const navTag = /<nav[^>]*>([\s\S]*?)<\/nav>/i.exec(html);
    if (navTag) styles.push('Has nav element');

    const footerTag = /<footer[^>]*>([\s\S]*?)<\/footer>/i.exec(html);
    if (footerTag) styles.push('Has footer element');

    return styles.join('\n') || '';
  } catch {
    return '';
  }
}

async function fetchPageContent(url) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'SEAUTO-BuildBot/1.0', Accept: 'text/html' },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const html = await resp.text();

  return {
    title: extractTag(html, 'title'),
    metaDescription: extractMeta(html, 'description'),
    headings: extractHeadings(html),
    bodyText: extractBodyText(html),
    imageCount: (html.match(/<img[\s>]/gi) || []).length,
    imagesWithoutAlt: (html.match(/<img(?![^>]*alt=)[^>]*>/gi) || []).length,
    internalLinkCount: extractInternalLinks(html, url).length,
    htmlLength: html.length,
  };
}

function extractTag(html, tag) {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

function extractMeta(html, name) {
  const m = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, 'i'));
  return m ? m[1].trim() : '';
}

function extractHeadings(html) {
  const headings = [];
  const regex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    headings.push({ level: match[1].toUpperCase(), text: match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() });
  }
  return headings.slice(0, 30);
}

function extractBodyText(html) {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
}

function extractInternalLinks(html, pageUrl) {
  const base = new URL(pageUrl);
  const links = [];
  const regex = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const u = new URL(match[1], pageUrl);
      if (u.hostname === base.hostname) links.push(u.href);
    } catch { /* skip */ }
  }
  return links;
}
