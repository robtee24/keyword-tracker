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
- Confident over qualified: Remove "almost," "very," "really"
- Show over tell: Describe the outcome instead of using adverbs
- Be direct: Get to the point. Don't bury the value in qualifications.
- Use rhetorical questions to engage readers about their own situation.

=== HEADLINE FORMULAS ===
Outcome-Focused:
- "{Achieve outcome} without {pain point}"
- "{Achieve outcome} by {how product makes it possible}"
- "Turn {input} into {outcome}"
- "[Achieve outcome] in [timeframe]"
Problem-Focused:
- "Never {unpleasant event} again"
- "{Question highlighting the main pain point}"
- "Stop [pain]. Start [pleasure]."
Audience-Focused:
- "{Feature} for {audience} to {what it's used for}"
- "You don't have to {skills} to {achieve outcome}"
Proof-Focused:
- "[Number] [people] use [product] to [outcome]"
- "{Key benefit of your product}" (simple, direct)
Differentiation-Focused:
- "The [category] that [key differentiator]"
- "The {opposite of usual} way to {achieve outcome}"
Additional:
- "Finally, {category} that {benefit}"
- "What if you could {desirable outcome}?"
- "Everything you need to {outcome}"

=== CTA COPY GUIDELINES ===
Weak CTAs (NEVER use): Submit, Sign Up, Learn More, Click Here, Get Started
Strong CTAs: Start Free Trial, Get [Specific Thing], See [Product] in Action, Create Your First [Thing], Download the Guide
Formula: [Action Verb] + [What They Get] + [Qualifier if needed]
Examples: "Start My Free Trial", "Get the Complete Checklist", "See Pricing for My Team"
Place CTAs: Above the fold, after key benefit sections, after social proof, at page end
Repeat CTAs at every natural decision point down the page.

=== PAGE CRO FRAMEWORK ===
1. VALUE PROPOSITION: Can a visitor understand what this is and why they should care in 5 seconds? Is the primary benefit clear, specific, and differentiated? Written in customer language, not company jargon?
2. HEADLINE: Communicates core value prop. Specific, not generic. Matches traffic source messaging. Use formulas above.
3. CTA: One clear primary action. Visible without scrolling. Button text communicates value. Repeated at key decision points. Logical primary vs. secondary CTA hierarchy.
4. VISUAL HIERARCHY: Scannable layout. Most important elements visually prominent. Enough white space. Images support (not distract from) the message. Can someone scanning get the main message?
5. TRUST SIGNALS: Customer logos (recognizable ones). Testimonials (specific, attributed, with photos). Case study snippets with real numbers. Review scores. Security badges. Place near CTAs and after benefit claims.
6. OBJECTION HANDLING: Address price/value, "will this work for me?", implementation difficulty, "what if it doesn't work?" through FAQ sections, guarantees, comparisons, process transparency.
7. FRICTION REDUCTION: Minimal form fields. Clear next steps. Simple navigation. Mobile-optimized. Reduce perceived effort.

=== PAGE STRUCTURE TEMPLATES ===
Strong Page Structure (follow this):
1. Hero with clear value prop (headline + subheadline + primary CTA + hero visual)
2. Social proof bar (logos, stats, or rating)
3. Problem/pain section — articulate their problem better than they can
4. How it works (3 steps with numbered progression)
5. Key benefits (2-3, not 10) — each: headline + explanation + proof
6. Testimonial with name, role, company, specific results
7. Use cases or personas — help visitors self-identify
8. Comparison to alternatives (vs competitors or vs status quo)
9. Case study snippet with metrics
10. FAQ (5-10 questions addressing objections)
11. Final CTA with guarantee/risk reversal

Section Writing Tips:
- Problem Section: Start with "You know the feeling..." or "If you're like most [role]..." Describe specific frustration, time/money wasted, impact on work/life.
- Benefits Section: For each benefit include headline (outcome), body (how it works), proof (number/testimonial).
- How It Works: Numbered steps with simple verbs. Each step = action + outcome. E.g. "1. Connect your tools (takes 2 minutes)"
- Testimonials: Must include specific results ("increased conversions by 32%"), before/after context, role + company. NEVER use vague praise like "Great product!"

=== MARKETING PSYCHOLOGY ===
Core Persuasion:
- Jobs to Be Done: People "hire" products for outcomes. Frame around the job, not specs.
- Social Proof / Bandwagon: People follow others. Show customer counts, testimonials, logos, reviews.
- Loss Aversion: Losses feel ~2x stronger than gains. Frame what they'll lose by not acting.
- Anchoring: First number seen anchors all judgments. Show higher price/competitor price first.
- Reciprocity: Give value first (free tools, resources). Creates obligation.
- Authority: Expert endorsements, certifications, "featured in" logos, thought leadership.
- Scarcity: Limited-time offers, exclusive access. Only when genuine.
- Commitment & Consistency: Get small commitments first (email, free trial). People who take one step take the next.

Advanced Psychology:
- Decoy Effect: Add inferior option to make preferred option look better.
- Framing Effect: "90% success rate" beats "10% failure rate." Frame positively.
- Contrast Effect: Show "before" state clearly. Contrast makes improvements vivid.
- Endowment Effect: Free trials let people "own" the product, making them reluctant to give up.
- IKEA Effect: Let customers customize or configure — investment increases perceived value.
- Zero-Price Effect: "Free" is psychologically different from cheap. Free tiers have disproportionate appeal.
- Hyperbolic Discounting: Emphasize immediate benefits ("Start saving time today") over future ones.
- Status-Quo Bias: Reduce friction to switch. "Import your data in one click."
- Paradox of Choice: Limit options. Three pricing tiers beat seven. Recommend "best for most."
- Goal-Gradient: Show progress bars, completion percentages, "almost there" messaging.
- Pratfall Effect: Admitting a weakness ("We're not the cheapest, but...") increases trust.
- Mental Accounting: "$3/day" feels different than "$90/month." Frame costs favorably.
- Regret Aversion: Money-back guarantees, free trials, "no commitment" reduce regret fear.
- Mere Exposure: Consistent brand presence builds preference. Repetition creates comfort.
- Confirmation Bias: Align messaging with what audience already believes.

Behavioral Design:
- BJ Fogg Model: Behavior = Motivation × Ability × Prompt. All three must be present.
- EAST Framework: Make desired action Easy, Attractive, Social, Timely.
- Hick's Law: More options = slower decisions = more abandonment. Simplify choices.
- AIDA Funnel: Attention → Interest → Desire → Action. Structure page through each stage.
- Activation Energy: Reduce starting friction. Pre-fill forms, offer templates, show quick wins.

=== COPY QUALITY CHECKS (The Seven Sweeps) ===
Apply these quality checks to all generated copy:
1. CLARITY: Every sentence immediately understandable. No jargon. No sentences trying to do too much.
2. VOICE: Consistent tone throughout. No jarring shifts between formal and casual.
3. SO WHAT: Every claim answers "why should I care?" Features connect to benefits via "which means..."
4. PROVE IT: Every claim substantiated. No "customers love us" without evidence. No unearned superlatives.
5. SPECIFICITY: Vague words replaced with concrete ones. Numbers and timeframes included. "Save 4 hours/week" not "save time."
6. EMOTION: Copy makes reader feel something. Pain points feel real. Aspirations feel achievable.
7. ZERO RISK: Every barrier to action removed. Objections addressed near CTA. Trust signals present. Next steps crystal clear.

=== FORM OPTIMIZATION ===
- Every field reduces completion. 3 fields = baseline. 7+ fields = 25-50% reduction.
- For each field ask: Is this necessary? Can we get it another way? Can we ask later?
- Start with easiest fields (name, email). Sensitive fields last.
- Labels always visible (not just placeholders). Placeholders = examples, not labels.
- Single column layout. Mobile tap targets 44px+.
- Submit button: "[Action] + [What they get]" not "Submit"
- Near form: privacy statement, security badges, testimonial, expected response time.
- Inline validation on blur. Specific error messages near the field.

=== SEO ON-PAGE CHECKLIST ===
Title Tags: Unique per page. Primary keyword near beginning. 50-60 chars. Compelling and click-worthy. Brand at end.
Meta Descriptions: Unique per page. 150-160 chars. Include primary keyword. Clear value prop. Call to action.
Heading Structure: One H1 per page with primary keyword. Logical hierarchy H1→H2→H3. Headings describe content.
Content: Keyword in first 100 words. Related keywords naturally used. Sufficient depth. Answers search intent.
Images: Descriptive file names. Alt text on all images. Compressed sizes. Lazy loading. Responsive.
Internal Linking: Important pages well-linked. Descriptive anchor text. Logical relationships. No broken links.
URL Structure: Readable, descriptive. Keywords where natural. Lowercase, hyphen-separated.

=== SCHEMA MARKUP ===
- Use JSON-LD format (Google recommended). Place in <head> or end of <body>.
- Common types: Organization (name, url, logo, sameAs), WebPage, BreadcrumbList, FAQ (mainEntity Q&A array), Product (name, image, offers), Article (headline, image, datePublished, author), HowTo, Review/AggregateRating.
- Combine multiple types with @graph array.
- Schema must accurately represent page content. Don't markup nonexistent content.
- All required properties must be included. Dates in ISO 8601. URLs fully qualified.

=== LANDING PAGE BEST PRACTICES ===
- Message match: Headline must match the promise that brought visitors to the page.
- Above the fold: Headline, subheadline, CTA, and hero visual must all be visible without scrolling.
- Single focus: One message, one primary CTA. Remove distracting navigation on landing pages.
- Mobile-first: Same quality experience on mobile. No horizontal scroll. Readable without zooming.
- Speed: Page must load fast. Compress images, minimize scripts, use CDN.
- Risk reversal: Include guarantee, free trial terms, "cancel anytime," or "no credit card required" near every CTA.

=== PAGE-SPECIFIC GUIDANCE ===
Homepage: Serve multiple audiences without being generic. Lead with broadest value prop. Provide clear paths for different visitor intents. Handle both "ready to buy" and "still researching."
Landing Page: Single message, single CTA. Match headline to ad/traffic source. Complete argument on one page.
Pricing Page: Help visitors choose. Address "which plan is right for me?" anxiety. Make recommended plan obvious. Use anchoring (expensive tier first).
Feature Page: Connect feature → benefit → outcome. Show use cases and examples. Clear path to try or buy.
About Page: Tell the story of why you exist. Connect mission to customer benefit. Still include a CTA.
Blog Post: Contextual CTAs matching content topic. Inline CTAs at natural stopping points.
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

  const { siteUrl, pageUrl, improvements, objectives, crawlData, homePageStyles: preloadedStyles } = req.body || {};
  if (!siteUrl || !pageUrl) return res.status(400).json({ error: 'siteUrl and pageUrl required' });

  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });

  let pageContent;
  let homeStylesText = '';

  if (crawlData) {
    pageContent = crawlData;
    if (preloadedStyles) {
      homeStylesText = formatStyleData(preloadedStyles);
    }
  } else {
    try {
      pageContent = await fetchPageContent(pageUrl);
    } catch (err) {
      return res.status(200).json({ error: `Failed to fetch page: ${err.message}` });
    }
    try {
      const homeUrl = new URL(siteUrl).origin + '/';
      if (homeUrl !== pageUrl) {
        homeStylesText = await extractHomePageStyles(homeUrl);
      }
    } catch { /* non-critical */ }
  }

  const improvementAreas = (improvements || []).length > 0
    ? improvements.join(', ')
    : 'SEO, content quality, conversion optimization, technical performance, user experience';

  const systemPrompt = `You are a world-class web developer, UI/UX designer, SEO specialist, copywriter, and conversion optimizer. You build pages that look professionally designed with modern aesthetics — clean typography, proper spacing, visual hierarchy, and polished CSS.

${MARKETING_SKILLS}

CRITICAL DESIGN RULES:
- Use modern CSS: flexbox, grid, gradients, shadows, rounded corners, smooth transitions
- Include a cohesive color palette with primary, secondary, and accent colors
- Use proper typography: font-size hierarchy, line-height, letter-spacing, font-weight variation
- Add padding and margins that create breathing room between sections
- Use cards, dividers, and background color alternation to separate content visually
- Include hover states for interactive elements (buttons, links, cards)
- Make it responsive with media queries
- Add subtle animations or transitions where appropriate
- Use CSS custom properties (variables) for consistent theming
- Create visual interest with gradients, patterns, or background shapes
- Include a proper header/navigation and footer
- Buttons should look like buttons: padding, background color, border-radius, hover effects`;

  const imagesWithoutAlt = crawlData
    ? crawlData.images.filter(i => !i.alt).length
    : (pageContent.imagesWithoutAlt || 0);
  const imageCount = crawlData
    ? crawlData.images.length
    : (pageContent.imageCount || 0);
  const internalLinkCount = crawlData
    ? crawlData.internalLinks.length
    : (pageContent.internalLinkCount || 0);
  const headings = crawlData ? crawlData.headings : (pageContent.headings || []);
  const bodyText = crawlData ? crawlData.bodyText : (pageContent.bodyText || '');
  const wordCount = crawlData ? crawlData.wordCount : bodyText.split(/\s+/).length;
  const title = crawlData ? crawlData.title : (pageContent.title || '');
  const metaDescription = crawlData ? crawlData.metaDescription : (pageContent.metaDescription || '');

  let crawlContext = '';
  if (crawlData) {
    const parts = [];
    if (crawlData.canonical) parts.push(`Canonical: ${crawlData.canonical}`);
    if (crawlData.robots) parts.push(`Robots: ${crawlData.robots}`);
    if (crawlData.ogTags?.title) parts.push(`OG Title: ${crawlData.ogTags.title}`);
    if (crawlData.ogTags?.description) parts.push(`OG Description: ${crawlData.ogTags.description}`);

    if (crawlData.navLinks?.length) {
      parts.push(`\nNAVIGATION (${crawlData.navLinks.length} links):\n${crawlData.navLinks.map(l => `- ${l.text}: ${l.href}`).join('\n')}`);
    }

    if (crawlData.images?.length) {
      parts.push(`\nIMAGES (${crawlData.images.length} found):\n${crawlData.images.slice(0, 20).map(i => `- ${i.alt || '(no alt)'}: ${i.src}`).join('\n')}`);
    }

    if (crawlData.externalLinks?.length) {
      parts.push(`\nEXTERNAL LINKS: ${crawlData.externalLinks.length}`);
    }

    if (crawlData.forms?.length) {
      parts.push(`\nFORMS (${crawlData.forms.length}):\n${crawlData.forms.map(f => `- ${f.method.toUpperCase()} ${f.action || '(no action)'}: ${f.fields.map(fi => fi.name).join(', ')}`).join('\n')}`);
    }

    if (crawlData.existingSchema?.length) {
      parts.push(`\nEXISTING SCHEMA MARKUP:\n${JSON.stringify(crawlData.existingSchema, null, 2).substring(0, 1500)}`);
    }

    if (crawlData.styles) {
      const s = crawlData.styles;
      const styleParts = [];
      if (s.colors?.length) styleParts.push(`Colors: ${s.colors.slice(0, 15).join('; ')}`);
      if (s.fonts?.length) styleParts.push(`Fonts: ${s.fonts.join('; ')}`);
      if (s.googleFonts) styleParts.push(`Google Fonts: ${s.googleFonts}`);
      if (s.cssVariables?.length) styleParts.push(`CSS Variables: ${s.cssVariables.slice(0, 15).join('; ')}`);
      if (s.borderRadius?.length) styleParts.push(`Border Radius: ${s.borderRadius.join('; ')}`);
      if (s.shadows?.length) styleParts.push(`Shadows: ${s.shadows.join('; ')}`);
      if (s.transitions?.length) styleParts.push(`Transitions: ${s.transitions.join('; ')}`);
      if (styleParts.length) parts.push(`\nCURRENT PAGE STYLES:\n${styleParts.join('\n')}`);
    }

    crawlContext = parts.join('\n');
  }

  const userMessage = `Rebuild this page to be visually stunning and conversion-optimized.

WEBSITE: ${siteUrl}
PAGE URL: ${pageUrl}
BUSINESS OBJECTIVES: ${objectives || 'Improve organic traffic, conversions, and user engagement'}
AREAS TO IMPROVE: ${improvementAreas}

${homeStylesText ? `=== EXISTING SITE STYLES (match these) ===\n${homeStylesText}\n` : ''}

=== COMPREHENSIVE PAGE ANALYSIS ===
Title: ${title || '(none)'}
Meta Description: ${metaDescription || '(none)'}
H1: ${headings.filter(h => h.level === 'H1').map(h => h.text).join(', ') || '(none)'}
Word Count: ~${wordCount}
Images: ${imageCount} total, ${imagesWithoutAlt} missing alt text
Internal Links: ${internalLinkCount}

${crawlContext ? crawlContext + '\n' : ''}
HEADINGS:
${headings.map(h => `${h.level}: ${h.text}`).join('\n') || '(none)'}

BODY TEXT (first 8000 chars):
${bodyText.substring(0, 8000)}

REBUILD INSTRUCTIONS:
1. Apply EVERY marketing skill and framework listed in the system prompt
2. Write REAL, compelling, specific copy — not generic placeholder text
3. Use proven headline formulas. Every heading must be benefit-driven or outcome-focused
4. Include specific, quantified CTAs (e.g., "Start Your Free 14-Day Trial" not "Get Started")
5. Apply marketing psychology: social proof, authority, loss aversion, anchoring
6. Structure page for scanability: short paragraphs, bullet points, subheadings
7. Add trust signals: suggest where to place testimonials, logos, stats
8. Include proper heading hierarchy (H1 > H2 > H3), meta tags, and schema markup
9. Suggest specific image placements with detailed descriptions
10. Include COMPREHENSIVE inline CSS that creates a visually polished, modern page design
11. Use a <style> tag at the top with CSS variables, then semantic HTML with proper classes
12. Ensure every section serves a clear purpose in the conversion funnel
13. Address likely objections through FAQ or embedded reassurance
14. The page MUST look professionally designed — not like unstyled HTML
15. Preserve the existing site navigation structure and match the site's existing style/brand
16. Retain any existing content that's already good — improve, don't discard

Respond with ONLY valid JSON:
{
  "title": "<optimized page title>",
  "metaDescription": "<compelling meta description under 155 chars>",
  "recommendations": [
    {
      "area": "<improvement area>",
      "current": "<what's wrong now>",
      "improved": "<exact change made>",
      "reason": "<why this improves the page>"
    }
  ],
  "htmlContent": "<complete rebuilt page HTML (body content) with a <style> tag containing all CSS at the top, followed by semantic HTML with proper classes. The CSS should create a modern, visually polished design with proper colors, spacing, typography, shadows, rounded corners, and hover effects.>",
  "schemaMarkup": "<complete JSON-LD schema markup>",
  "suggestedImages": ["<specific image description>"],
  "summary": "<summary of changes made>"
}`;

  try {
    let raw = await callClaude(systemPrompt, userMessage, 16000);
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

function formatStyleData(styleObj) {
  if (!styleObj) return '';
  const parts = [];
  if (styleObj.colors?.length) parts.push(`Colors used: ${styleObj.colors.slice(0, 20).join('; ')}`);
  if (styleObj.fonts?.length) parts.push(`Fonts: ${styleObj.fonts.join('; ')}`);
  if (styleObj.googleFonts) parts.push(`Google Fonts: ${styleObj.googleFonts}`);
  if (styleObj.cssVariables?.length) parts.push(`CSS variables: ${styleObj.cssVariables.slice(0, 20).join('; ')}`);
  if (styleObj.borderRadius?.length) parts.push(`Border radius: ${styleObj.borderRadius.join('; ')}`);
  if (styleObj.buttonStyles?.length) parts.push(`Button styles: ${styleObj.buttonStyles.slice(0, 3).join('\n')}`);
  if (styleObj.spacing?.length) parts.push(`Spacing patterns: ${styleObj.spacing.join('; ')}`);
  if (styleObj.shadows?.length) parts.push(`Shadows: ${styleObj.shadows.join('; ')}`);
  if (styleObj.transitions?.length) parts.push(`Transitions: ${styleObj.transitions.join('; ')}`);
  return parts.join('\n');
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

    const btnStyles = allCss.match(/\.btn[^{]*\{[^}]+\}/gi) || allCss.match(/button[^{]*\{[^}]+\}/gi) || [];
    if (btnStyles.length) styles.push(`Button styles: ${btnStyles.slice(0, 3).join('\n')}`);

    const cssVars = allCss.match(/--[a-zA-Z0-9-]+\s*:\s*[^;]+/g) || [];
    if (cssVars.length) styles.push(`CSS variables: ${cssVars.slice(0, 20).join('; ')}`);

    const spacingPatterns = allCss.match(/(?:padding|margin|gap)\s*:\s*([^;}\n]+)/gi) || [];
    const uniqueSpacing = [...new Set(spacingPatterns.slice(0, 10))];
    if (uniqueSpacing.length) styles.push(`Spacing patterns: ${uniqueSpacing.join('; ')}`);

    const shadowPatterns = allCss.match(/box-shadow\s*:\s*([^;}\n]+)/gi) || [];
    if (shadowPatterns.length) styles.push(`Shadows: ${[...new Set(shadowPatterns.slice(0, 3))].join('; ')}`);

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
