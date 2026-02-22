import { getSupabase } from '../db.js';

export const config = { maxDuration: 120 };

const AUDIT_PROMPTS = {
  seo: `You are an expert SEO auditor. Analyze this page and provide actionable recommendations.

EVALUATE:
- Title tag (length, keyword placement, uniqueness)
- Meta description (length, call-to-action, keyword inclusion)
- Heading hierarchy (H1 presence and uniqueness, H2-H6 structure)
- Internal linking (count, anchor text quality, relevant pages)
- Image optimization (alt tags, file names, lazy loading)
- URL structure (readability, keyword inclusion, length)
- Content quality (length, depth, keyword coverage, readability)
- Canonical tag presence and correctness
- Mobile-friendliness signals
- Core Web Vitals indicators (large DOM, render-blocking resources)
- Open Graph and social meta tags

SCORING: Rate 0-100 based on how well the page follows SEO best practices.`,

  content: `You are an expert marketing strategist combining skills in copywriting, conversion rate optimization, marketing psychology, and copy editing. Analyze this page holistically.

EVALUATE COPY QUALITY:
- Headline effectiveness (clarity, benefit-driven, emotional impact)
- Value proposition clarity (can a visitor understand what's offered in 5 seconds?)
- Call-to-action strength (visibility, urgency, specificity)
- Persuasion techniques (social proof, authority, scarcity, reciprocity)
- Benefit vs feature balance
- Reading level and accessibility
- Grammar, spelling, and punctuation

EVALUATE CONVERSION OPTIMIZATION:
- Above-the-fold content effectiveness
- Visual hierarchy and scanability
- Trust signals (testimonials, logos, guarantees)
- Friction points in the user journey
- Form optimization (if applicable)
- Exit intent and engagement hooks

EVALUATE PSYCHOLOGY:
- Cognitive biases leveraged (anchoring, loss aversion, social proof)
- Emotional triggers used
- Decision fatigue management (choice reduction)
- FOMO and urgency (authentic vs manufactured)

SCORING: Rate 0-100 based on overall marketing effectiveness.`,

  aeo: `You are an expert in AI Search Engine Optimization (AEO/GEO/LLMO). Analyze this page for how well it would be cited by AI assistants like ChatGPT, Perplexity, and Google AI Overviews.

EVALUATE:
- Question-based content (does it directly answer common questions?)
- Featured snippet optimization (concise definitions, lists, tables)
- Entity coverage (are key entities clearly defined and connected?)
- Structured answers (clear, quotable paragraphs that AI can extract)
- Authority signals (author expertise, citations, data sources)
- Content comprehensiveness (does it cover the topic thoroughly?)
- Conversational tone (natural language that matches how people ask questions)
- Source-worthiness (would an AI choose to cite this over competitors?)
- Unique data or insights (original research, proprietary data, expert opinions)
- Content freshness (up-to-date information, recent dates)
- Topical authority (does the site demonstrate expertise on this topic?)

SCORING: Rate 0-100 based on AI search visibility potential.`,

  schema: `You are an expert in structured data and schema markup. Analyze this page's schema implementation.

EVALUATE EXISTING SCHEMA:
- List all schema types found on the page
- Validate required properties for each type
- Check for errors or warnings
- Assess completeness of each schema object

IDENTIFY MISSING SCHEMA:
- Organization / LocalBusiness schema
- WebSite and WebPage schema
- BreadcrumbList schema
- FAQ schema (if page has Q&A content)
- HowTo schema (if page has step-by-step content)
- Product schema (if page has products)
- Review / AggregateRating schema
- Article / BlogPosting schema (if editorial content)
- Person / Author schema
- Event schema (if applicable)
- Video schema (if page has videos)

RICH SNIPPET OPPORTUNITIES:
- Which schema additions would generate rich results in Google?
- Priority of implementation (high/medium/low impact)

SCORING: Rate 0-100 based on schema completeness and correctness.`,

  compliance: `You are an expert web compliance auditor. You MUST evaluate the page against EXACTLY these 12 standards and give each one a PASS or FAIL verdict.

═══ ACCESSIBILITY (check HTML structure) ═══

1. WCAG 2.0/2.1/2.2 (Level A & AA)
   Check: lang attribute on <html>, alt text on every <img>, heading hierarchy (no skipped levels), ARIA landmarks (nav, main, banner, contentinfo), skip-navigation link, form inputs have associated <label> or aria-label, link text is descriptive (no bare "click here"), tables have <th> with scope, no auto-playing media, focus-visible CSS not suppressed, color contrast indicators (inline style analysis), touch targets ≥ 44px, text resizable (no fixed px on body font).
   PASS = zero or only minor warnings.
   FAIL = any missing alt text, missing lang, skipped heading levels, missing form labels, or missing ARIA landmarks.

2. Section 508
   Check: all WCAG Level A & AA criteria above PLUS multimedia alternatives (captions/transcripts for video/audio elements), no CAPTCHA without accessible alternative, no content that flashes > 3 times/second.
   PASS = meets WCAG AA + multimedia requirements.
   FAIL = any WCAG AA failure OR missing multimedia alternatives.

═══ PRIVACY / COOKIE (check page content & scripts) ═══

3. GDPR (General Data Protection Regulation)
   Check: cookie consent banner/dialog present in HTML (look for common consent manager patterns: OneTrust, Cookiebot, CookieYes, Osano, custom consent banners with accept/reject buttons), cookies/tracking scripts NOT firing before user consent (scripts deferred behind consent logic), privacy policy link accessible from the page, data processing disclosures.
   PASS = consent mechanism found AND tracking appears gated behind consent AND privacy policy linked.
   FAIL = no consent banner, OR tracking scripts fire unconditionally, OR no privacy policy link.

4. ePrivacy Directive
   Check: prior consent required before ANY cookie is set (look for analytics/marketing scripts loading without consent gate), cookie policy page linked (separate from privacy policy), clear cookie categories disclosed.
   PASS = cookies appear gated behind consent, cookie policy linked.
   FAIL = scripts load cookies before consent OR no cookie policy.

5. CCPA (California Consumer Privacy Act)
   Check: "Do Not Sell or Share My Personal Information" link present on page (or in footer), privacy policy link present, opt-out mechanism detectable.
   PASS = "Do Not Sell" link found AND privacy policy linked.
   FAIL = missing "Do Not Sell" link OR no privacy policy.

6. CPRA (California Privacy Rights Act)
   Check: Global Privacy Control (GPC) support signal (Sec-GPC header respect or documented GPC support), "Limit Use of My Sensitive Personal Information" link or equivalent opt-out, updated privacy policy reflecting CPRA rights.
   PASS = GPC support indicated AND opt-out link present.
   FAIL = no GPC support OR no opt-out mechanism.

═══ SECURITY / TECHNICAL (check HTTP headers & HTML) ═══

7. TLS (Transport Layer Security)
   Check: page served over HTTPS (from the URL), no mixed content (HTTP resources loaded on HTTPS page — check src/href attributes for http:// URLs), valid certificate (page loaded successfully over HTTPS).
   PASS = HTTPS enforced, no mixed content detected.
   FAIL = HTTP resources found on page OR page not served over HTTPS.

8. HSTS (HTTP Strict-Transport-Security)
   Check: Strict-Transport-Security response header present. Look for max-age value ≥ 31536000 (1 year). Check for includeSubDomains and preload directives.
   PASS = HSTS header present with max-age ≥ 31536000.
   FAIL = HSTS header missing OR max-age too low.

9. CSP (Content-Security-Policy)
   Check: Content-Security-Policy response header present. Evaluate directives: default-src, script-src, style-src, img-src, connect-src, frame-ancestors. Check for unsafe-inline and unsafe-eval in script-src (security weakness). Check for nonce-based or hash-based script allowlisting.
   PASS = CSP header present with meaningful directives (not just default-src *).
   FAIL = no CSP header OR CSP is effectively permissive (default-src * or script-src 'unsafe-inline' 'unsafe-eval').

10. PCI DSS (public-facing technical controls)
    Check: HTTPS enforced on all pages with forms, no credit card fields in URL parameters, no card data visible in page source, payment forms use iframes/tokenization (Stripe, Braintree, etc.), no inline JavaScript handling card numbers. If no payment forms exist, this standard is N/A (PASS).
    PASS = HTTPS on forms, card data properly isolated, OR no payment processing present.
    FAIL = payment forms without HTTPS, card data in URLs, or raw card handling in page scripts.

SCORING: Rate 0-100. Each FAIL on standards 1-10 deducts 10 points from 100. Standards marked N/A count as PASS.`,

  speed: `You are an expert web performance engineer specializing in Core Web Vitals, page load optimization, and frontend performance. Analyze this page's HTML for every performance issue you can detect.

EVALUATE CORE WEB VITALS SIGNALS:
- LCP (Largest Contentful Paint) risks:
  - Hero image optimization (format, dimensions, lazy vs eager loading)
  - Above-the-fold content loading strategy
  - Server response time indicators (large HTML = slow TTFB)
  - Preload hints for critical resources
  - Font loading strategy impact on LCP
- INP (Interaction to Next Paint) risks:
  - JavaScript bundle size indicators (number of scripts, inline scripts)
  - Event handler patterns in HTML (onclick, onload, etc.)
  - Third-party scripts blocking main thread
  - Heavy DOM operations visible in markup
- CLS (Cumulative Layout Shift) risks:
  - Images without explicit width/height attributes
  - Iframes without dimensions
  - Dynamic content injection patterns
  - Web fonts without font-display strategy
  - Ads or embeds without reserved space

EVALUATE RESOURCE LOADING:
- Render-blocking resources:
  - CSS files in <head> without media queries or preload
  - JavaScript files in <head> without async or defer
  - Number of synchronous scripts
- Resource hints:
  - preload for critical resources (fonts, hero image, critical CSS)
  - preconnect for third-party origins
  - prefetch for next-page resources
  - dns-prefetch for external domains
  - modulepreload for ES modules
- Third-party scripts:
  - Total count of external scripts
  - Which domains they load from
  - Analytics, ads, widgets, social embeds
  - Impact on page load performance

EVALUATE IMAGE OPTIMIZATION:
- Image format (WebP/AVIF vs JPEG/PNG/GIF)
- Lazy loading (loading="lazy" on below-fold images)
- Eager loading on hero/LCP image (loading="eager" or no attribute)
- Responsive images (srcset, sizes attributes)
- Image dimensions specified (width/height attributes)
- SVG usage for icons/logos
- Background images in inline styles

EVALUATE CSS & FONT PERFORMANCE:
- Total number of CSS files
- Inline critical CSS present?
- Font loading strategy (font-display: swap/optional)
- Number of web fonts loaded
- Font preloading
- CSS media queries for conditional loading
- Print stylesheets separated

EVALUATE JAVASCRIPT PERFORMANCE:
- Total number of script tags
- Scripts with async attribute
- Scripts with defer attribute
- Scripts without async/defer (render-blocking)
- Inline script volume
- Module scripts (type="module")
- Third-party vs first-party scripts ratio

EVALUATE HTML & DOM OPTIMIZATION:
- DOM size (total element count estimated from HTML length)
- DOM depth (nesting levels)
- Unnecessary wrapper elements
- HTML compression indicators
- Viewport meta tag present
- Character encoding declared
- DOCTYPE present

EVALUATE CACHING & DELIVERY:
- CDN usage signals (asset URLs from CDN domains)
- Service worker registration
- Manifest file linked
- HTTP/2 push hints
- Cache-busting in asset URLs (hash-based filenames)

SCORING: Rate 0-100 based on overall page speed optimization. Score severely for render-blocking resources without async/defer, images without dimensions, no resource hints, and excessive third-party scripts. A score of 80+ means the page follows modern performance best practices.`,
};

const STANDARD_RESPONSE_FORMAT = `
Respond with ONLY valid JSON in this format:
{
  "score": <number 0-100>,
  "summary": "<2-3 sentence overview of the page's overall status>",
  "strengths": ["<what the page does well — 3-5 bullet points>"],
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "category": "<short category name>",
      "issue": "<describe the EXACT problem found — reference the specific element, text, or code>",
      "recommendation": "<provide the EXACT fix — include specific text to change, code to add, or precise action to take>",
      "howToFix": "<step-by-step implementation instructions>",
      "impact": "<expected improvement>"
    }
  ]
}`;

const COMPLIANCE_RESPONSE_FORMAT = `
Respond with ONLY valid JSON in this format:
{
  "score": <number 0-100>,
  "summary": "<2-3 sentence overview of the page's compliance status>",
  "standards": [
    {
      "id": "<standard-id>",
      "name": "<full standard name>",
      "category": "Accessibility" | "Privacy / Cookie" | "Security / Technical",
      "status": "pass" | "fail",
      "findings": "<1-3 sentence explanation of what was found — cite specific elements, headers, or code>"
    }
  ],
  "strengths": ["<what the page does well — 3-5 bullet points>"],
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "category": "<short category name>",
      "issue": "<describe the EXACT problem found — reference the specific element, text, or code>",
      "recommendation": "<provide the EXACT fix — include specific text to change, code to add, or precise action to take>",
      "howToFix": "<step-by-step implementation instructions>",
      "impact": "<expected improvement>"
    }
  ]
}

You MUST include ALL 10 standards in the "standards" array using these exact IDs:
wcag, section508, gdpr, eprivacy, ccpa, cpra, tls, hsts, csp, pci_dss

Each standard MUST have status "pass" or "fail" based on your analysis.
The "findings" field must cite specific evidence from the page.`;

const SHARED_RULES = `
CRITICAL RULES FOR RECOMMENDATIONS:
- Every recommendation MUST reference a specific element on the page
- Every recommendation MUST provide an exact fix
- The howToFix field MUST contain step-by-step instructions a developer can follow
- NEVER give vague advice like "regularly update content"
- NEVER recommend something the page already does correctly
- If a page element is fine, do NOT include it as a recommendation

Return 5-15 recommendations sorted by priority (high first).
Return 3-5 strengths — things the page already does correctly.`;

/**
 * POST /api/audit/run-multi
 * { siteUrl, pageUrl, auditTypes: ['seo', 'content', 'aeo', 'schema', 'compliance'] }
 *
 * Fetches a page ONCE, then runs all requested audit types against it in parallel.
 * Saves each audit result to the DB individually.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { siteUrl, pageUrl, auditTypes } = req.body || {};
  if (!siteUrl || !pageUrl || !Array.isArray(auditTypes) || auditTypes.length === 0) {
    return res.status(400).json({ error: 'siteUrl, pageUrl, and auditTypes[] are required' });
  }

  const validTypes = auditTypes.filter((t) => AUDIT_PROMPTS[t]);
  if (validTypes.length === 0) {
    return res.status(400).json({ error: 'No valid audit types provided' });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
  }

  // 1. Fetch page content ONCE
  let pageContent;
  try {
    pageContent = await fetchPageContent(pageUrl);
  } catch (err) {
    const errorResults = validTypes.map((auditType) => ({
      pageUrl, auditType, score: 0, summary: '', strengths: [], recommendations: [],
      error: `Failed to fetch page: ${err.message}`,
    }));
    return res.status(200).json({ results: errorResults });
  }

  const pageContext = buildPageContext(pageUrl, pageContent);

  // 2. Run all audit types in parallel against the same content
  const auditPromises = validTypes.map(async (auditType) => {
    try {
      const result = await runAudit(openaiKey, pageContext, auditType);
      return { auditType, ...result };
    } catch (err) {
      return {
        auditType, score: 0, summary: '', strengths: [], recommendations: [],
        error: `Audit failed: ${err.message}`,
      };
    }
  });

  const auditResults = await Promise.all(auditPromises);

  // 3. Save all results to DB
  const supabase = getSupabase();
  if (supabase) {
    for (const result of auditResults) {
      if (result.error) continue;
      const row = {
        site_url: siteUrl,
        page_url: pageUrl,
        audit_type: result.auditType,
        score: result.score,
        recommendations: result.recommendations,
        strengths: result.strengths,
        standards: result.standards || null,
        summary: result.summary || '',
        audited_at: new Date().toISOString(),
      };
      try {
        const { error: upsertErr } = await supabase
          .from('page_audits')
          .upsert(row, { onConflict: 'site_url,page_url,audit_type' });

        if (upsertErr) {
          await supabase.from('page_audits')
            .delete()
            .eq('site_url', siteUrl)
            .eq('page_url', pageUrl)
            .eq('audit_type', result.auditType);
          await supabase.from('page_audits').insert(row);
        }
      } catch (err) {
        console.error(`[MultiAudit] DB save error for ${result.auditType}:`, err.message);
      }
    }
  }

  const output = auditResults.map((r) => ({
    pageUrl,
    auditType: r.auditType,
    score: r.score,
    summary: r.summary,
    strengths: r.strengths,
    standards: r.standards || null,
    recommendations: r.recommendations,
    error: r.error,
  }));

  return res.status(200).json({ results: output });
}

function buildPageContext(pageUrl, content) {
  return `
PAGE URL: ${pageUrl}
TITLE: ${content.title || '(none)'}
META DESCRIPTION: ${content.metaDescription || '(none)'}
CANONICAL: ${content.canonical || '(none)'}
OG TITLE: ${content.ogTitle || '(none)'}
OG DESCRIPTION: ${content.ogDesc || '(none)'}

HEADINGS:
${content.headings.map((h) => `${h.level}: ${h.text}`).join('\n') || '(none found)'}

BODY TEXT (first 3000 chars):
${content.bodyText || '(empty)'}

IMAGES: ${content.imageCount} total, ${content.imagesWithoutAlt} without alt text
INTERNAL LINKS: ${content.internalLinkCount}
HTML SIZE: ${Math.round(content.htmlLength / 1024)}KB
SCHEMA MARKUP: ${content.schemaMarkup || '(none found)'}
${content.perfData ? `
PERFORMANCE DATA:
Scripts: ${content.perfData.scriptCount} total (${content.perfData.asyncScripts} async, ${content.perfData.deferScripts} defer, ${content.perfData.blockingScripts} blocking)
Stylesheets: ${content.perfData.stylesheetCount}
Inline styles: ${content.perfData.inlineStyleCount}
Resource hints: ${content.perfData.resourceHints.join(', ') || 'none'}
Third-party domains: ${content.perfData.thirdPartyDomains.join(', ') || 'none'}
Images with lazy loading: ${content.perfData.lazyImages}/${content.imageCount}
Images with dimensions: ${content.perfData.imagesWithDimensions}/${content.imageCount}
Web fonts: ${content.perfData.webFontCount}
Font display strategy: ${content.perfData.fontDisplay || 'not specified'}
Viewport meta: ${content.perfData.hasViewport ? 'yes' : 'no'}
DOCTYPE: ${content.perfData.hasDoctype ? 'yes' : 'no'}` : ''}
${content.complianceData ? `
COMPLIANCE DATA:
Protocol: ${content.complianceData.protocol}
HSTS Header: ${content.complianceData.hstsHeader || 'NOT PRESENT'}
CSP Header: ${content.complianceData.cspHeader || 'NOT PRESENT'}
X-Frame-Options: ${content.complianceData.xFrameOptions || 'NOT PRESENT'}
X-Content-Type-Options: ${content.complianceData.xContentTypeOptions || 'NOT PRESENT'}
Referrer-Policy: ${content.complianceData.referrerPolicy || 'NOT PRESENT'}
Permissions-Policy: ${content.complianceData.permissionsPolicy || 'NOT PRESENT'}
Mixed Content: ${content.complianceData.mixedContentUrls.length > 0 ? content.complianceData.mixedContentUrls.join(', ') : 'none detected'}
HTML lang attribute: ${content.complianceData.htmlLang || 'NOT SET'}
Skip navigation link: ${content.complianceData.hasSkipNav ? 'yes' : 'no'}
ARIA landmarks: ${content.complianceData.ariaLandmarks.join(', ') || 'none'}
Form labels: ${content.complianceData.formsWithoutLabels} form inputs without labels out of ${content.complianceData.totalFormInputs}
Cookie consent signals: ${content.complianceData.consentSignals.join(', ') || 'none detected'}
Privacy policy link: ${content.complianceData.hasPrivacyPolicy ? 'yes' : 'no'}
Do Not Sell link: ${content.complianceData.hasDoNotSell ? 'yes' : 'no'}
Cookie policy link: ${content.complianceData.hasCookiePolicy ? 'yes' : 'no'}
GPC support signals: ${content.complianceData.gpcSignals.join(', ') || 'none detected'}
Payment forms: ${content.complianceData.hasPaymentForms ? 'yes' : 'no'}
Payment iframes: ${content.complianceData.paymentIframes.join(', ') || 'none'}` : ''}`;
}

async function runAudit(apiKey, pageContext, auditType) {
  const isCompliance = auditType === 'compliance';
  const responseFormat = isCompliance ? COMPLIANCE_RESPONSE_FORMAT : STANDARD_RESPONSE_FORMAT;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `${AUDIT_PROMPTS[auditType]}\n${responseFormat}\n${SHARED_RULES}` },
        { role: 'user', content: pageContext },
      ],
      temperature: 0.2,
      max_tokens: isCompliance ? 4000 : 3000,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => 'unknown');
    throw new Error(`OpenAI error (${response.status}): ${detail}`);
  }

  const data = await response.json();
  let raw = data.choices?.[0]?.message?.content || '{}';
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    const parsed = JSON.parse(cleaned);
    const result = {
      score: typeof parsed.score === 'number' ? Math.min(100, Math.max(0, parsed.score)) : 0,
      summary: parsed.summary || '',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map((r) => ({
        ...r,
        howToFix: r.howToFix || r.how_to_fix || '',
      })) : [],
    };
    if (Array.isArray(parsed.standards)) {
      result.standards = parsed.standards;
    }
    return result;
  } catch {
    console.error(`[MultiAudit] Failed to parse ${auditType} response:`, cleaned.substring(0, 300));
    return { score: 0, summary: 'Failed to parse audit results', strengths: [], recommendations: [] };
  }
}

async function fetchPageContent(url) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'SEAUTO-AuditBot/1.0', Accept: 'text/html' },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const html = await resp.text();
  const images = extractImages(html);

  return {
    url,
    title: extractTag(html, 'title'),
    metaDescription: extractMeta(html, 'description'),
    canonical: extractLink(html, 'canonical'),
    ogTitle: extractMeta(html, 'og:title', 'property'),
    ogDesc: extractMeta(html, 'og:description', 'property'),
    headings: extractHeadings(html),
    bodyText: extractBodyText(html).substring(0, 3000),
    imageCount: images.length,
    imagesWithoutAlt: images.filter((i) => !i.alt).length,
    internalLinkCount: extractInternalLinks(html, url).length,
    schemaMarkup: extractSchemaMarkup(html),
    htmlLength: html.length,
    perfData: extractPerformanceData(html),
    complianceData: extractComplianceData(html, url, resp.headers),
  };
}

function extractTag(html, tag) {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

function extractMeta(html, name, attr = 'name') {
  const regex = new RegExp(`<meta[^>]*${attr}=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i');
  const match = html.match(regex);
  if (match) return match[1];
  const regex2 = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${name}["']`, 'i');
  const match2 = html.match(regex2);
  return match2 ? match2[1] : '';
}

function extractLink(html, rel) {
  const match = html.match(new RegExp(`<link[^>]*rel=["']${rel}["'][^>]*href=["']([^"']*)["']`, 'i'));
  return match ? match[1] : '';
}

function extractHeadings(html) {
  const headings = [];
  const regex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    headings.push({ level: match[1].toUpperCase(), text: stripTags(match[2]).trim() });
    if (headings.length >= 30) break;
  }
  return headings;
}

function extractBodyText(html) {
  let body = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  body = body.replace(/<style[\s\S]*?<\/style>/gi, '');
  body = body.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  body = body.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  body = body.replace(/<header[\s\S]*?<\/header>/gi, '');
  body = stripTags(body);
  return body.replace(/\s+/g, ' ').trim();
}

function extractImages(html) {
  const images = [];
  const regex = /<img[^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const altMatch = match[0].match(/alt=["']([^"']*)["']/i);
    images.push({ alt: altMatch ? altMatch[1] : '' });
    if (images.length >= 100) break;
  }
  return images;
}

function extractInternalLinks(html, pageUrl) {
  const links = [];
  try {
    const origin = new URL(pageUrl).origin;
    const regex = /<a[^>]*href=["']([^"'#]*)["']/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const href = match[1];
      if (href.startsWith('/') || href.startsWith(origin)) links.push(href);
      if (links.length >= 200) break;
    }
  } catch { /* ignore */ }
  return links;
}

function extractSchemaMarkup(html) {
  const schemas = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) schemas.push(match[1].trim());
  return schemas.length > 0 ? schemas.join('\n---\n').substring(0, 2000) : '';
}

function extractPerformanceData(html) {
  const scriptTags = html.match(/<script[^>]*>/gi) || [];
  const asyncScripts = scriptTags.filter((s) => /\basync\b/i.test(s)).length;
  const deferScripts = scriptTags.filter((s) => /\bdefer\b/i.test(s)).length;
  const blockingScripts = scriptTags.filter((s) => /\bsrc=/i.test(s) && !/\basync\b/i.test(s) && !/\bdefer\b/i.test(s) && !/type=["']module["']/i.test(s)).length;

  const stylesheetMatches = html.match(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi) || [];
  const inlineStyleMatches = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];

  const resourceHints = [];
  const hintTypes = ['preload', 'preconnect', 'prefetch', 'dns-prefetch', 'modulepreload'];
  for (const hint of hintTypes) {
    const re = new RegExp(`<link[^>]*rel=["']${hint}["'][^>]*>`, 'gi');
    const m = html.match(re);
    if (m && m.length > 0) resourceHints.push(`${hint}(${m.length})`);
  }

  const thirdPartyDomains = new Set();
  const srcRegex = /(?:src|href)=["'](https?:\/\/[^/"']+)/gi;
  let srcMatch;
  while ((srcMatch = srcRegex.exec(html)) !== null) {
    try {
      const domain = new URL(srcMatch[1]).hostname;
      thirdPartyDomains.add(domain);
    } catch { /* ignore */ }
  }

  const imgTags = html.match(/<img[^>]*>/gi) || [];
  const lazyImages = imgTags.filter((img) => /loading=["']lazy["']/i.test(img)).length;
  const imagesWithDimensions = imgTags.filter((img) => /\bwidth=/i.test(img) && /\bheight=/i.test(img)).length;

  const fontFaceMatches = html.match(/@font-face/gi) || [];
  const fontLinkMatches = html.match(/fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net/gi) || [];
  const fontDisplayMatch = html.match(/font-display:\s*(swap|optional|fallback|block|auto)/i);

  return {
    scriptCount: scriptTags.length,
    asyncScripts,
    deferScripts,
    blockingScripts,
    stylesheetCount: stylesheetMatches.length,
    inlineStyleCount: inlineStyleMatches.length,
    resourceHints,
    thirdPartyDomains: [...thirdPartyDomains].slice(0, 20),
    lazyImages,
    imagesWithDimensions,
    webFontCount: fontFaceMatches.length + fontLinkMatches.length,
    fontDisplay: fontDisplayMatch ? fontDisplayMatch[1] : '',
    hasViewport: /<meta[^>]*name=["']viewport["']/i.test(html),
    hasDoctype: /^<!DOCTYPE/i.test(html.trim()),
  };
}

function extractComplianceData(html, url, headers) {
  const protocol = url.startsWith('https') ? 'HTTPS' : 'HTTP';
  const hstsHeader = headers.get('strict-transport-security') || '';
  const cspHeader = headers.get('content-security-policy') || '';
  const xFrameOptions = headers.get('x-frame-options') || '';
  const xContentTypeOptions = headers.get('x-content-type-options') || '';
  const referrerPolicy = headers.get('referrer-policy') || '';
  const permissionsPolicy = headers.get('permissions-policy') || '';

  const mixedContentUrls = [];
  if (protocol === 'HTTPS') {
    const httpRefs = html.match(/(?:src|href|action)=["'](http:\/\/[^"']+)["']/gi) || [];
    for (const ref of httpRefs.slice(0, 10)) {
      const urlMatch = ref.match(/["'](http:\/\/[^"']+)["']/i);
      if (urlMatch) mixedContentUrls.push(urlMatch[1]);
    }
  }

  const htmlLangMatch = html.match(/<html[^>]*\slang=["']([^"']*)["']/i);
  const htmlLang = htmlLangMatch ? htmlLangMatch[1] : '';

  const hasSkipNav = /skip[- ]?(to[- ]?)?(main|content|nav)/i.test(html);

  const ariaLandmarks = [];
  const roles = ['banner', 'navigation', 'main', 'contentinfo', 'complementary', 'search', 'form'];
  for (const role of roles) {
    if (new RegExp(`role=["']${role}["']|<${role === 'navigation' ? 'nav' : role === 'banner' ? 'header' : role === 'contentinfo' ? 'footer' : role === 'main' ? 'main' : role === 'complementary' ? 'aside' : '___'}[\\s>]`, 'i').test(html)) {
      ariaLandmarks.push(role);
    }
  }

  const inputTags = html.match(/<input[^>]*>/gi) || [];
  const selectTags = html.match(/<select[^>]*>/gi) || [];
  const textareaTags = html.match(/<textarea[^>]*>/gi) || [];
  const allFormElements = [...inputTags, ...selectTags, ...textareaTags];
  const totalFormInputs = allFormElements.filter((el) => !/type=["'](hidden|submit|button|reset|image)["']/i.test(el)).length;
  let formsWithoutLabels = 0;
  for (const el of allFormElements) {
    if (/type=["'](hidden|submit|button|reset|image)["']/i.test(el)) continue;
    const hasAriaLabel = /aria-label(ledby)?=/i.test(el);
    const idMatch = el.match(/\bid=["']([^"']*)["']/i);
    const hasAssociatedLabel = idMatch ? new RegExp(`<label[^>]*for=["']${idMatch[1]}["']`, 'i').test(html) : false;
    if (!hasAriaLabel && !hasAssociatedLabel) formsWithoutLabels++;
  }

  const consentSignals = [];
  const consentPatterns = [
    { pattern: /onetrust|optanon/i, name: 'OneTrust' },
    { pattern: /cookiebot/i, name: 'Cookiebot' },
    { pattern: /cookieyes|cookie-yes/i, name: 'CookieYes' },
    { pattern: /osano/i, name: 'Osano' },
    { pattern: /cookie[- ]?consent|consent[- ]?banner|accept[- ]?cookies|cookie[- ]?notice/i, name: 'Cookie Consent Banner' },
    { pattern: /gdpr|cookie[- ]?policy/i, name: 'GDPR/Cookie reference' },
  ];
  for (const cp of consentPatterns) {
    if (cp.pattern.test(html)) consentSignals.push(cp.name);
  }

  const hasPrivacyPolicy = /privacy[- ]?policy|privacy[- ]?notice/i.test(html);
  const hasDoNotSell = /do[- ]?not[- ]?sell|do[- ]?not[- ]?share/i.test(html);
  const hasCookiePolicy = /cookie[- ]?policy|cookie[- ]?notice/i.test(html);

  const gpcSignals = [];
  if (/global[- ]?privacy[- ]?control|gpc/i.test(html)) gpcSignals.push('GPC reference in page');
  if (/sec-gpc/i.test(html)) gpcSignals.push('Sec-GPC reference');
  if (/limit[- ]?use.*sensitive/i.test(html)) gpcSignals.push('Limit Use link');

  const hasPaymentForms = /credit[- ]?card|card[- ]?number|payment|checkout|billing/i.test(html) && /<form/i.test(html);
  const paymentIframes = [];
  const iframeTags = html.match(/<iframe[^>]*>/gi) || [];
  for (const iframe of iframeTags) {
    if (/stripe|braintree|paypal|square|adyen|checkout/i.test(iframe)) {
      const srcMatch = iframe.match(/src=["']([^"']*)["']/i);
      if (srcMatch) paymentIframes.push(srcMatch[1].substring(0, 80));
    }
  }

  return {
    protocol,
    hstsHeader,
    cspHeader: cspHeader.substring(0, 500),
    xFrameOptions,
    xContentTypeOptions,
    referrerPolicy,
    permissionsPolicy: permissionsPolicy.substring(0, 300),
    mixedContentUrls,
    htmlLang,
    hasSkipNav,
    ariaLandmarks,
    totalFormInputs,
    formsWithoutLabels,
    consentSignals,
    hasPrivacyPolicy,
    hasDoNotSell,
    hasCookiePolicy,
    gpcSignals,
    hasPaymentForms,
    paymentIframes,
  };
}

function stripTags(html) {
  return html.replace(/<[^>]*>/g, ' ');
}
