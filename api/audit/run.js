import { getSupabase } from '../db.js';

export const config = { maxDuration: 60 };

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

  compliance: `You are an expert web compliance auditor specializing in privacy law, accessibility standards, and regulatory requirements. Analyze this page for ALL applicable compliance frameworks.

EVALUATE PRIVACY & DATA PROTECTION:
- GDPR (EU General Data Protection Regulation):
  - Cookie consent banner present and functional (opt-in before tracking)
  - Privacy policy linked and accessible from every page
  - Right to erasure / data deletion mechanism
  - Data processing disclosure (what data is collected, why, how long stored)
  - Third-party data sharing disclosure
  - Lawful basis for processing stated
  - DPO (Data Protection Officer) contact info if required
  - Cross-border data transfer disclosures (EU to non-EU)
- CCPA / CPRA (California Consumer Privacy Act):
  - "Do Not Sell or Share My Personal Information" link present
  - Privacy policy includes CCPA-required disclosures
  - Categories of personal information collected listed
  - Right to know, delete, and opt-out mechanisms
  - Financial incentive disclosures (if applicable)
  - Authorized agent request process
- Other US State Privacy Laws:
  - Virginia VCDPA, Colorado CPA, Connecticut CTDPA, Utah UCPA, Texas TDPSA, Oregon OCPA compliance signals
  - Universal opt-out mechanism support (Global Privacy Control)
- PIPEDA (Canada), LGPD (Brazil), POPIA (South Africa) signals
- ePrivacy Directive (EU cookie law) compliance

EVALUATE ACCESSIBILITY (ADA / WCAG):
- ADA (Americans with Disabilities Act) / Section 508 compliance:
  - WCAG 2.1 Level AA conformance signals
  - Alt text on all images (present, descriptive, not redundant)
  - Color contrast ratios (text vs background meets 4.5:1 minimum)
  - Keyboard navigation (can all interactive elements be reached via Tab?)
  - Form labels and error messages (associated with inputs, descriptive)
  - ARIA landmarks and roles (proper use of nav, main, banner, etc.)
  - Skip navigation link present
  - Focus indicators visible on interactive elements
  - Video captions / audio descriptions (if media present)
  - Readable font sizes (minimum 16px body text)
  - Touch target sizes (minimum 44x44px for mobile)
  - Page language declared in HTML lang attribute
  - Heading hierarchy logical (no skipped levels)
  - Link text descriptive (no "click here" or "read more" without context)
  - Tables have proper headers and scope
  - No content that flashes more than 3 times per second

EVALUATE LEGAL COMPLIANCE:
- Terms of Service / Terms of Use linked
- Cookie policy (separate from privacy policy, detailing cookie types)
- Copyright notice present and current year
- DMCA notice / takedown procedure (if user-generated content)
- CAN-SPAM compliance (if email signup exists: unsubscribe mechanism, physical address)
- FTC disclosure requirements (affiliate links, sponsored content, endorsements clearly labeled)
- COPPA (Children's Online Privacy Protection Act) — age gate if content targets minors
- PCI DSS signals (if payment processing: HTTPS, no card data in URLs)

EVALUATE SECURITY COMPLIANCE:
- HTTPS enforced (no mixed content)
- Security headers present (Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, Referrer-Policy, Permissions-Policy)
- No inline scripts without nonces (CSP violations)
- Third-party scripts inventory (how many, from where, privacy implications)
- Form submissions over HTTPS
- No sensitive data exposed in page source or URLs

EVALUATE INDUSTRY-SPECIFIC (if applicable):
- HIPAA signals (health-related content: PHI handling, BAA mentions)
- SOX compliance signals (financial data handling)
- FERPA signals (educational records)
- GLBA signals (financial services)
- EU Digital Services Act signals

SCORING: Rate 0-100 based on overall compliance posture. Score severely for missing cookie consent, no privacy policy, or critical accessibility failures. A score of 100 means fully compliant across all detected frameworks.`,
};

/**
 * POST /api/audit/run
 * { siteUrl, pageUrl, auditType: 'seo' | 'content' | 'aeo' | 'schema' | 'compliance' }
 *
 * Fetches a page, extracts content, runs an AI audit, saves results to Supabase.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { siteUrl, pageUrl, auditType } = req.body || {};
  if (!siteUrl || !pageUrl || !auditType) {
    return res.status(400).json({ error: 'siteUrl, pageUrl, and auditType are required' });
  }

  if (!AUDIT_PROMPTS[auditType]) {
    return res.status(400).json({ error: `Invalid auditType: ${auditType}` });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
  }

  // 1. Fetch and extract page content
  let pageContent;
  try {
    pageContent = await fetchPageContent(pageUrl);
  } catch (err) {
    return res.status(200).json({
      pageUrl,
      auditType,
      score: 0,
      recommendations: [],
      error: `Failed to fetch page: ${err.message}`,
    });
  }

  // 2. Run AI audit
  let auditResult;
  try {
    auditResult = await runAudit(openaiKey, pageUrl, pageContent, auditType);
  } catch (err) {
    return res.status(200).json({
      pageUrl,
      auditType,
      score: 0,
      recommendations: [],
      error: `Audit failed: ${err.message}`,
    });
  }

  // 3. Save to Supabase
  const supabase = getSupabase();
  if (supabase) {
    const row = {
      site_url: siteUrl,
      page_url: pageUrl,
      audit_type: auditType,
      score: auditResult.score,
      recommendations: auditResult.recommendations,
      strengths: auditResult.strengths,
      summary: auditResult.summary || '',
      audited_at: new Date().toISOString(),
    };
    try {
      // Try upsert first (requires unique constraint)
      const { error: upsertErr } = await supabase
        .from('page_audits')
        .upsert(row, { onConflict: 'site_url,page_url,audit_type' });

      if (upsertErr) {
        console.error('[Audit] Upsert failed, trying delete+insert:', upsertErr.message);
        // Fallback: delete existing then insert
        await supabase.from('page_audits')
          .delete()
          .eq('site_url', siteUrl)
          .eq('page_url', pageUrl)
          .eq('audit_type', auditType);
        const { error: insertErr } = await supabase.from('page_audits').insert(row);
        if (insertErr) console.error('[Audit] Insert also failed:', insertErr.message);
      }
    } catch (err) {
      console.error('[Audit] DB save exception:', err.message);
    }
  }

  return res.status(200).json({
    pageUrl,
    auditType,
    score: auditResult.score,
    summary: auditResult.summary,
    strengths: auditResult.strengths,
    recommendations: auditResult.recommendations,
  });
}

async function fetchPageContent(url) {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'SEAUTO-AuditBot/1.0',
      Accept: 'text/html',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const html = await resp.text();

  const title = extractTag(html, 'title');
  const metaDesc = extractMeta(html, 'description');
  const canonical = extractLink(html, 'canonical');
  const ogTitle = extractMeta(html, 'og:title', 'property');
  const ogDesc = extractMeta(html, 'og:description', 'property');
  const headings = extractHeadings(html);
  const bodyText = extractBodyText(html);
  const images = extractImages(html);
  const internalLinks = extractInternalLinks(html, url);
  const schemaMarkup = extractSchemaMarkup(html);

  return {
    url,
    title,
    metaDescription: metaDesc,
    canonical,
    ogTitle,
    ogDesc,
    headings,
    bodyText: bodyText.substring(0, 3000),
    imageCount: images.length,
    imagesWithoutAlt: images.filter((i) => !i.alt).length,
    internalLinkCount: internalLinks.length,
    schemaMarkup,
    htmlLength: html.length,
  };
}

async function runAudit(apiKey, pageUrl, content, auditType) {
  const pageContext = `
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
SCHEMA MARKUP: ${content.schemaMarkup || '(none found)'}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `${AUDIT_PROMPTS[auditType]}

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
      "howToFix": "<step-by-step implementation instructions: what file/section to edit, what to change from and to, exact HTML/text/code to add or modify>",
      "impact": "<expected improvement>"
    }
  ]
}

CRITICAL RULES FOR RECOMMENDATIONS:
- Every recommendation MUST reference a specific element on the page (e.g., "The title tag is 23 characters" not "Title could be improved")
- Every recommendation MUST provide an exact fix (e.g., "Change title to: 'Best Vacation Rental Calculator | BNBCalc'" not "Add keywords to title")
- The howToFix field MUST contain step-by-step instructions a developer can follow
- NEVER give vague advice like "regularly update content" or "consider adding more keywords"
- NEVER recommend something the page already does correctly
- If a page element is fine, do NOT include it as a recommendation

Return 5-15 recommendations sorted by priority (high first).
Return 3-5 strengths — things the page already does correctly.`,
        },
        { role: 'user', content: pageContext },
      ],
      temperature: 0.2,
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => 'unknown');
    throw new Error(`OpenAI error (${response.status}): ${detail}`);
  }

  const data = await response.json();
  let content_str = data.choices?.[0]?.message?.content || '{}';

  let cleaned = content_str.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    const parsed = JSON.parse(cleaned);
    return {
      score: typeof parsed.score === 'number' ? Math.min(100, Math.max(0, parsed.score)) : 0,
      summary: parsed.summary || '',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map((r) => ({
        ...r,
        howToFix: r.howToFix || r.how_to_fix || '',
      })) : [],
    };
  } catch {
    console.error('[Audit] Failed to parse AI response:', cleaned.substring(0, 300));
    return { score: 0, summary: 'Failed to parse audit results', strengths: [], recommendations: [] };
  }
}

// --- HTML extraction helpers ---

function extractTag(html, tag) {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

function extractMeta(html, name, attr = 'name') {
  const regex = new RegExp(
    `<meta[^>]*${attr}=["']${name}["'][^>]*content=["']([^"']*)["']`,
    'i'
  );
  const match = html.match(regex);
  if (match) return match[1];
  const regex2 = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${name}["']`,
    'i'
  );
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
      if (href.startsWith('/') || href.startsWith(origin)) {
        links.push(href);
      }
      if (links.length >= 200) break;
    }
  } catch { /* ignore */ }
  return links;
}

function extractSchemaMarkup(html) {
  const schemas = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    schemas.push(match[1].trim());
  }
  return schemas.length > 0 ? schemas.join('\n---\n').substring(0, 2000) : '';
}

function stripTags(html) {
  return html.replace(/<[^>]*>/g, ' ');
}
