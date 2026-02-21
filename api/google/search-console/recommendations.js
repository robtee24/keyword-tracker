import { getAccessTokenFromRequest } from '../../_config.js';
import { getSupabase } from '../../db.js';

export const config = {
  maxDuration: 60,
};

/**
 * Crawl ranking pages for a keyword, extract SEO signals, generate an
 * SEO audit of the top page, and produce a strategy + specific checklist
 * via OpenAI.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = getAccessTokenFromRequest(req);
  if (!accessToken) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { keyword, pages, siteUrl } = req.body || {};

  if (!keyword || !pages || !siteUrl) {
    return res.status(400).json({ error: 'keyword, pages, and siteUrl are required' });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return res.status(500).json({
      error: 'OPENAI_API_KEY is not configured. Add it in your Vercel project Settings → Environment Variables.',
    });
  }

  try {
    // 1. Crawl each page and extract SEO signals (max 3 pages)
    const pagesToCrawl = pages.slice(0, 3);
    const pageAnalyses = [];

    for (const page of pagesToCrawl) {
      try {
        const analysis = await crawlAndAnalyze(page.url, keyword, siteUrl);
        pageAnalyses.push(analysis);
      } catch (crawlErr) {
        pageAnalyses.push({
          url: page.url,
          crawlSuccess: false,
          error: crawlErr.message || 'Crawl failed',
        });
      }
    }

    // 2. Grade the top ranking page
    const topPageAnalysis = pageAnalyses[0];
    const audit = topPageAnalysis?.crawlSuccess
      ? gradePageSEO(topPageAnalysis, keyword)
      : { url: pages[0]?.url || '', overallGrade: 'N/A', grades: {} };

    // 3. Build the prompt and call OpenAI for strategy + checklist
    const prompt = buildPrompt(keyword, siteUrl, pages, pageAnalyses);
    const aiResult = await callOpenAI(openaiKey, prompt);

    const scanResult = {
      strategy: aiResult.strategy || { targetPage: pages[0]?.url, approach: 'boost-current', summary: '' },
      audit,
      checklist: aiResult.checklist || [],
    };

    // Persist to Supabase (non-blocking, best-effort)
    const supabase = getSupabase();
    if (supabase) {
      supabase
        .from('recommendations')
        .upsert(
          {
            site_url: siteUrl,
            keyword,
            scan_result: scanResult,
            scanned_at: new Date().toISOString(),
          },
          { onConflict: 'site_url,keyword' }
        )
        .then(({ error: dbErr }) => {
          if (dbErr) console.error('Failed to save recommendation to DB:', dbErr.message);
        });
    }

    return res.status(200).json(scanResult);
  } catch (error) {
    console.error('Recommendations API error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate recommendations',
    });
  }
}

/* ------------------------------------------------------------------ */
/*  SEO Grading                                                       */
/* ------------------------------------------------------------------ */

function gradePageSEO(analysis, keyword) {
  const grades = {};
  const kw = keyword.toLowerCase();

  // 1. Title Tag
  if (!analysis.title) {
    grades.titleTag = { grade: 'F', value: 'Missing', notes: 'No title tag found' };
  } else {
    const len = analysis.title.length;
    const hasKw = analysis.keywordInTitle;
    if (hasKw && len >= 40 && len <= 65) {
      grades.titleTag = { grade: 'A', value: analysis.title, notes: `Excellent — includes keyword, ${len} chars (optimal 50-60)` };
    } else if (hasKw && (len < 40 || len > 65)) {
      grades.titleTag = { grade: 'B', value: analysis.title, notes: `Includes keyword but ${len} chars (aim for 50-60)` };
    } else if (!hasKw && len >= 40 && len <= 65) {
      grades.titleTag = { grade: 'C', value: analysis.title, notes: `Good length (${len} chars) but missing target keyword` };
    } else {
      grades.titleTag = { grade: 'D', value: analysis.title, notes: `Missing keyword, ${len} chars — needs optimization` };
    }
  }

  // 2. Meta Description
  if (!analysis.metaDescription) {
    grades.metaDescription = { grade: 'F', value: 'Missing', notes: 'No meta description found' };
  } else {
    const len = analysis.metaDescription.length;
    const hasKw = analysis.keywordInMetaDescription;
    if (hasKw && len >= 140 && len <= 165) {
      grades.metaDescription = { grade: 'A', value: analysis.metaDescription, notes: `Excellent — includes keyword, ${len} chars (optimal 150-160)` };
    } else if (hasKw) {
      grades.metaDescription = { grade: 'B', value: analysis.metaDescription, notes: `Includes keyword, ${len} chars (aim for 150-160)` };
    } else if (len >= 140 && len <= 165) {
      grades.metaDescription = { grade: 'C', value: analysis.metaDescription, notes: `Good length but missing target keyword` };
    } else {
      grades.metaDescription = { grade: 'D', value: analysis.metaDescription, notes: `Missing keyword, ${len} chars — needs rewriting` };
    }
  }

  // 3. H1 Tag
  if (analysis.h1.length === 0) {
    grades.h1Tag = { grade: 'F', value: 'Missing', notes: 'No H1 tag found on the page' };
  } else if (analysis.h1.length === 1 && analysis.keywordInH1) {
    grades.h1Tag = { grade: 'A', value: analysis.h1[0], notes: 'Single H1 with target keyword — perfect' };
  } else if (analysis.h1.length === 1) {
    grades.h1Tag = { grade: 'B', value: analysis.h1[0], notes: 'Single H1 but missing target keyword' };
  } else if (analysis.keywordInH1) {
    grades.h1Tag = { grade: 'C', value: analysis.h1.join(' | '), notes: `${analysis.h1.length} H1 tags found (should be exactly 1)` };
  } else {
    grades.h1Tag = { grade: 'D', value: analysis.h1.join(' | '), notes: `${analysis.h1.length} H1 tags, none include keyword` };
  }

  // 4. Heading Structure
  const hasH2 = analysis.h2.length > 0;
  const hasH3 = analysis.h3.length > 0;
  const h1Count = analysis.h1.length;
  if (h1Count === 1 && hasH2 && hasH3 && analysis.h2.length >= 3) {
    grades.headingStructure = { grade: 'A', value: `H1:${h1Count}, H2:${analysis.h2.length}, H3:${analysis.h3.length}`, notes: 'Well-structured heading hierarchy' };
  } else if (h1Count >= 1 && hasH2) {
    grades.headingStructure = { grade: 'B', value: `H1:${h1Count}, H2:${analysis.h2.length}, H3:${analysis.h3.length}`, notes: 'Decent structure, could add more sub-headings' };
  } else if (h1Count >= 1) {
    grades.headingStructure = { grade: 'C', value: `H1:${h1Count}, H2:${analysis.h2.length}, H3:${analysis.h3.length}`, notes: 'Weak heading hierarchy — add H2/H3 sections' };
  } else {
    grades.headingStructure = { grade: 'F', value: 'No headings', notes: 'No heading structure found' };
  }

  // 5. Schema Markup
  if (analysis.hasSchema && analysis.schemaTypes.length >= 2) {
    grades.schemaMarkup = { grade: 'A', value: analysis.schemaTypes.join(', '), notes: 'Rich structured data present' };
  } else if (analysis.hasSchema) {
    grades.schemaMarkup = { grade: 'B', value: analysis.schemaTypes.join(', ') || 'Present', notes: 'Schema found — consider adding more types' };
  } else {
    grades.schemaMarkup = { grade: 'F', value: 'None', notes: 'No structured data / schema markup found' };
  }

  // 6. Keyword Optimization
  const kwPositions = [
    analysis.keywordInTitle && 'title',
    analysis.keywordInH1 && 'H1',
    analysis.keywordInMetaDescription && 'meta description',
    analysis.keywordInFirstParagraph && 'first paragraph',
  ].filter(Boolean);
  const density = analysis.wordCount > 0 ? ((analysis.keywordMentions / analysis.wordCount) * 100).toFixed(2) : 0;

  if (kwPositions.length >= 3 && analysis.keywordMentions >= 3) {
    grades.keywordOptimization = { grade: 'A', value: `In: ${kwPositions.join(', ')} | ${analysis.keywordMentions} mentions (${density}%)`, notes: 'Strong keyword presence across key positions' };
  } else if (kwPositions.length >= 2) {
    grades.keywordOptimization = { grade: 'B', value: `In: ${kwPositions.join(', ')} | ${analysis.keywordMentions} mentions (${density}%)`, notes: 'Good keyword placement, some gaps remain' };
  } else if (kwPositions.length >= 1) {
    grades.keywordOptimization = { grade: 'C', value: `In: ${kwPositions.join(', ') || 'none'} | ${analysis.keywordMentions} mentions (${density}%)`, notes: 'Keyword underrepresented in key positions' };
  } else {
    grades.keywordOptimization = { grade: 'F', value: `${analysis.keywordMentions} mentions (${density}%)`, notes: 'Keyword missing from all key positions' };
  }

  // 7. Content Volume
  const wc = analysis.wordCount;
  if (wc >= 2000) {
    grades.contentVolume = { grade: 'A', value: `${wc.toLocaleString()} words`, notes: 'Comprehensive content length' };
  } else if (wc >= 1000) {
    grades.contentVolume = { grade: 'B', value: `${wc.toLocaleString()} words`, notes: 'Good content length — consider expanding to 2,000+' };
  } else if (wc >= 500) {
    grades.contentVolume = { grade: 'C', value: `${wc.toLocaleString()} words`, notes: 'Thin content — aim for 1,500+ words' };
  } else if (wc >= 300) {
    grades.contentVolume = { grade: 'D', value: `${wc.toLocaleString()} words`, notes: 'Very thin content — significant expansion needed' };
  } else {
    grades.contentVolume = { grade: 'F', value: `${wc.toLocaleString()} words`, notes: 'Critically thin content' };
  }

  // 8. Internal Linking
  const il = analysis.internalLinkCount;
  if (il >= 10) {
    grades.internalLinking = { grade: 'A', value: `${il} internal links`, notes: 'Strong internal link profile' };
  } else if (il >= 5) {
    grades.internalLinking = { grade: 'B', value: `${il} internal links`, notes: 'Decent — add more relevant internal links' };
  } else if (il >= 2) {
    grades.internalLinking = { grade: 'C', value: `${il} internal links`, notes: 'Weak internal linking — add 5-10 more' };
  } else {
    grades.internalLinking = { grade: 'F', value: `${il} internal links`, notes: 'Almost no internal links — critical issue' };
  }

  // 9. Image Optimization
  if (analysis.imageCount === 0) {
    grades.imageOptimization = { grade: 'D', value: 'No images', notes: 'Consider adding relevant images with alt text' };
  } else if (analysis.imagesWithoutAlt === 0) {
    grades.imageOptimization = { grade: 'A', value: `${analysis.imageCount} images, all with alt text`, notes: 'All images properly optimized' };
  } else if (analysis.imagesWithAlt >= analysis.imageCount * 0.7) {
    grades.imageOptimization = { grade: 'B', value: `${analysis.imagesWithAlt}/${analysis.imageCount} with alt text`, notes: `${analysis.imagesWithoutAlt} images missing alt text` };
  } else {
    grades.imageOptimization = { grade: 'D', value: `${analysis.imagesWithAlt}/${analysis.imageCount} with alt text`, notes: `${analysis.imagesWithoutAlt} images missing alt text — needs fixing` };
  }

  // 10. Technical SEO
  const techPoints = [];
  if (analysis.hasCanonical) techPoints.push('canonical');
  if (analysis.hasSchema) techPoints.push('schema');
  if (techPoints.length >= 2) {
    grades.technicalSEO = { grade: 'A', value: techPoints.join(', '), notes: 'Core technical elements in place' };
  } else if (techPoints.length === 1) {
    grades.technicalSEO = { grade: 'C', value: techPoints.join(', ') || 'Partial', notes: 'Some technical elements missing' };
  } else {
    grades.technicalSEO = { grade: 'F', value: 'None', notes: 'Missing canonical and schema markup' };
  }

  // Overall grade
  const gradeValues = { A: 4, B: 3, C: 2, D: 1, F: 0 };
  const allGrades = Object.values(grades).map((g) => gradeValues[g.grade] ?? 0);
  const avg = allGrades.length > 0 ? allGrades.reduce((s, v) => s + v, 0) / allGrades.length : 0;
  const overallGrade = avg >= 3.5 ? 'A' : avg >= 2.5 ? 'B' : avg >= 1.5 ? 'C' : avg >= 0.5 ? 'D' : 'F';

  return {
    url: analysis.url,
    overallGrade,
    grades,
  };
}

/* ------------------------------------------------------------------ */
/*  Page Crawler & SEO Signal Extraction                              */
/* ------------------------------------------------------------------ */

async function crawlAndAnalyze(url, keyword, siteUrl) {
  const analysis = {
    url,
    crawlSuccess: false,
    title: null,
    metaDescription: null,
    h1: [],
    h2: [],
    h3: [],
    wordCount: 0,
    keywordInTitle: false,
    keywordInH1: false,
    keywordInMetaDescription: false,
    keywordMentions: 0,
    keywordInFirstParagraph: false,
    internalLinks: [],
    internalLinkCount: 0,
    externalLinkCount: 0,
    imageCount: 0,
    imagesWithAlt: 0,
    imagesWithoutAlt: 0,
    hasSchema: false,
    schemaTypes: [],
    canonicalUrl: null,
    hasCanonical: false,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      analysis.error = `HTTP ${response.status}`;
      return analysis;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      analysis.error = `Non-HTML content: ${contentType}`;
      return analysis;
    }

    const html = await response.text();
    analysis.crawlSuccess = true;

    let siteDomain = '';
    try {
      siteDomain = new URL(siteUrl.replace(/\/$/, '')).hostname;
    } catch {
      siteDomain = siteUrl.replace(/https?:\/\//, '').replace(/\/$/, '');
    }

    const kw = keyword.toLowerCase();

    // Title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      analysis.title = titleMatch[1].trim();
      analysis.keywordInTitle = analysis.title.toLowerCase().includes(kw);
    }

    // Meta description
    const metaDescMatch =
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i) ||
      html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i);
    if (metaDescMatch) {
      analysis.metaDescription = metaDescMatch[1].trim();
      analysis.keywordInMetaDescription = analysis.metaDescription.toLowerCase().includes(kw);
    }

    // Headings
    for (const m of html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)) {
      const text = stripTags(m[1]).trim();
      if (text) analysis.h1.push(text);
    }
    analysis.keywordInH1 = analysis.h1.some((h) => h.toLowerCase().includes(kw));

    for (const m of html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)) {
      const text = stripTags(m[1]).trim();
      if (text) analysis.h2.push(text);
    }

    for (const m of html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)) {
      const text = stripTags(m[1]).trim();
      if (text) analysis.h3.push(text);
    }

    // Body text
    let bodyContent = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    bodyContent = bodyContent.replace(/<style[\s\S]*?<\/style>/gi, '');
    bodyContent = bodyContent.replace(/<nav[\s\S]*?<\/nav>/gi, '');
    bodyContent = bodyContent.replace(/<footer[\s\S]*?<\/footer>/gi, '');
    bodyContent = bodyContent.replace(/<header[\s\S]*?<\/header>/gi, '');
    const textContent = stripTags(bodyContent);
    const words = textContent.split(/\s+/).filter((w) => w.length > 0);
    analysis.wordCount = words.length;

    const bodyLower = textContent.toLowerCase();
    let idx = 0;
    while (true) {
      idx = bodyLower.indexOf(kw, idx);
      if (idx === -1) break;
      analysis.keywordMentions++;
      idx += kw.length;
    }

    const firstPMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (firstPMatch) {
      analysis.keywordInFirstParagraph = stripTags(firstPMatch[1]).toLowerCase().includes(kw);
    }

    // Links
    for (const m of html.matchAll(/<a[^>]*href=["']([^"']*?)["'][^>]*>/gi)) {
      const href = m[1];
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
      try {
        const linkUrl = new URL(href, url);
        if (linkUrl.hostname === siteDomain || linkUrl.hostname.endsWith('.' + siteDomain)) {
          analysis.internalLinkCount++;
          if (analysis.internalLinks.length < 20) analysis.internalLinks.push(linkUrl.pathname);
        } else {
          analysis.externalLinkCount++;
        }
      } catch {
        analysis.internalLinkCount++;
      }
    }

    // Images
    for (const m of html.matchAll(/<img[^>]*>/gi)) {
      analysis.imageCount++;
      if (/alt=["'][^"']+["']/i.test(m[0])) analysis.imagesWithAlt++;
      else analysis.imagesWithoutAlt++;
    }

    // Schema
    for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      analysis.hasSchema = true;
      try {
        const schema = JSON.parse(m[1]);
        if (schema['@type']) analysis.schemaTypes.push(schema['@type']);
        if (Array.isArray(schema['@graph'])) {
          schema['@graph'].forEach((item) => {
            if (item['@type']) analysis.schemaTypes.push(item['@type']);
          });
        }
      } catch { /* ignore */ }
    }

    // Canonical
    const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*?)["']/i);
    if (canonicalMatch) {
      analysis.canonicalUrl = canonicalMatch[1];
      analysis.hasCanonical = true;
    }
  } catch (err) {
    analysis.error = err.name === 'AbortError' ? 'Timeout' : err.message;
  }

  return analysis;
}

function stripTags(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim();
}

/* ------------------------------------------------------------------ */
/*  OpenAI Prompt Builder                                             */
/* ------------------------------------------------------------------ */

function buildPrompt(keyword, siteUrl, pages, pageAnalyses) {
  const domain = siteDomain(siteUrl);
  const topPage = pageAnalyses[0];
  const topUrl = topPage?.url || pages[0]?.url || siteUrl;

  let prompt = `You are a senior SEO strategist with 15+ years of experience ranking sites in competitive niches. You combine deep technical SEO knowledge with content strategy, information architecture, and user experience expertise.

Your client wants to reach POSITION 1 in Google for: "${keyword}"
Domain: ${siteUrl}

## Your Analysis Framework

Evaluate the data below through ALL of these lenses:

### 1. SERP Intent Analysis
- What is the dominant SERP intent for "${keyword}"? (informational, transactional, commercial investigation, navigational, local)
- What content format does Google prefer for this query? (long-form guide, tool/calculator, product page, listicle, comparison, FAQ, video)
- Does the current ranking page MATCH the SERP intent? If not, this is the #1 problem.

### 2. Topical Authority & Content Gaps
- Does the site demonstrate topical authority around "${keyword}" through supporting content (related articles, guides, hub pages)?
- What supporting pages or content clusters are MISSING that competitors likely have?
- Are there keyword cannibalization issues (multiple pages competing for the same term)?

### 3. E-E-A-T Signals (Experience, Expertise, Authoritativeness, Trustworthiness)
- Does the page show first-hand experience or original data?
- Are there author bios, credentials, citations, or trust signals?
- Does the page link to authoritative sources?

### 4. On-Page Optimization (Deep)
- Title tag: keyword placement, emotional triggers, click-through optimization
- Meta description: compelling CTA, keyword inclusion, unique value proposition
- H1: exact match vs. natural variation, single H1 rule
- Heading hierarchy: logical H2→H3 structure, keyword variations in sub-headings
- Keyword density and semantic coverage (LSI terms, related entities)
- First paragraph: does it immediately address the query and include the keyword?
- Content depth: word count relative to top-ranking competitors (typically 1,500-3,000+ for competitive terms)
- Content freshness signals (dates, "updated" markers, current-year references)

### 5. Internal Linking Architecture
- How many internal links point TO this page? (hub page status)
- Are anchor texts descriptive and keyword-relevant (not "click here")?
- Is there a logical silo/cluster structure supporting this page?
- Which high-authority pages on the site should link to this page?

### 6. Technical SEO
- Canonical tag correctness
- Schema markup (is the RIGHT type used? Article, FAQPage, HowTo, Product, SoftwareApplication, etc.)
- URL structure (clean, keyword-containing, not too deep)
- Page speed signals from content structure (image optimization, code bloat)
- Mobile-friendliness indicators from HTML structure

### 7. Featured Snippet & SERP Feature Optimization
- Could this page win a featured snippet? If so, what format (paragraph, list, table)?
- Are there opportunities for FAQ rich results, How-To rich results, or sitelinks?
- Would adding a clear definition, numbered list, or comparison table help?

### 8. Backlink & Off-Page Strategy
- What types of pages would naturally link to content about "${keyword}"?
- What linkable assets could be created (original data, tools, infographics, studies)?
- Are there broken link building or resource page opportunities?

### 9. Conversion & UX Alignment
- Does the page serve the user's FULL intent (not just ranking, but satisfying the query)?
- Is there a clear next action (CTA) that matches the search intent?
- How is the content structured for scannability (short paragraphs, bullets, visuals)?

---

## Search Console Performance Data
`;

  pages.forEach((p) => {
    prompt += `- ${p.url}: ${p.clicks || 0} clicks, ${p.impressions || 0} impressions\n`;
  });

  prompt += `\n## Page-Level SEO Crawl Data\n`;
  pageAnalyses.forEach((a) => {
    if (!a.crawlSuccess) {
      prompt += `\n### ${a.url}\nCould not crawl: ${a.error || 'unknown error'}\n`;
      return;
    }
    prompt += `\n### ${a.url}\n`;
    prompt += `- Title: "${a.title || 'MISSING'}" (${a.title ? a.title.length : 0} chars)\n`;
    prompt += `- Meta Description: "${a.metaDescription || 'MISSING'}" (${a.metaDescription ? a.metaDescription.length : 0} chars)\n`;
    prompt += `- H1 tags: ${a.h1.length > 0 ? a.h1.map((h) => `"${h}"`).join(', ') : 'NONE'}\n`;
    prompt += `- H2 tags (${a.h2.length}): ${a.h2.length > 0 ? a.h2.slice(0, 10).map((h) => `"${h}"`).join(', ') : 'NONE'}\n`;
    prompt += `- H3 tags (${a.h3.length}): ${a.h3.length > 0 ? a.h3.slice(0, 8).map((h) => `"${h}"`).join(', ') : 'NONE'}\n`;
    prompt += `- Word count: ${a.wordCount}\n`;
    prompt += `- Keyword "${keyword}" found in: ${[a.keywordInTitle && 'title', a.keywordInH1 && 'H1', a.keywordInMetaDescription && 'meta description', a.keywordInFirstParagraph && 'first paragraph'].filter(Boolean).join(', ') || 'NONE of the key positions'}\n`;
    prompt += `- Keyword mentions in body: ${a.keywordMentions}\n`;
    prompt += `- Internal links: ${a.internalLinkCount}${a.internalLinks.length > 0 ? ' (paths: ' + a.internalLinks.slice(0, 12).join(', ') + ')' : ''}\n`;
    prompt += `- External links: ${a.externalLinkCount}\n`;
    prompt += `- Images: ${a.imageCount} total, ${a.imagesWithAlt} with alt, ${a.imagesWithoutAlt} without alt\n`;
    prompt += `- Schema: ${a.hasSchema ? 'Yes (' + a.schemaTypes.join(', ') + ')' : 'None'}\n`;
    prompt += `- Canonical: ${a.hasCanonical ? a.canonicalUrl : 'Not set'}\n`;
  });

  prompt += `
## Response Format
Return ONLY valid JSON with this exact structure:
{
  "strategy": {
    "targetPage": "the URL to focus optimization efforts on",
    "approach": "boost-current" OR "focus-alternative" OR "create-new",
    "summary": "5-8 sentences. Start with the SERP intent analysis — what does Google want for this query? Then explain whether the current page matches that intent. Then outline the high-level plan: what are the 3-4 biggest levers to pull? Be specific about WHY each lever matters for this particular keyword."
  },
  "checklist": [
    {
      "id": "1",
      "category": "one of: title-tag, meta-description, heading-structure, content, internal-linking, schema-markup, technical-seo, backlinks, images, featured-snippet, topical-authority, eeat",
      "task": "THE EXACT, SPECIFIC ACTION — see rules below",
      "page": "URL this action applies to",
      "priority": "high | medium | low",
      "impact": "1-2 sentence explanation of WHY this will help rankings for this specific keyword"
    }
  ]
}

## Checklist Rules — ABSOLUTELY CRITICAL
Every item must be IMMEDIATELY ACTIONABLE with zero ambiguity. Include EXACT text, code, or URLs.

WRONG: "Optimize the title tag for the keyword"
RIGHT: "Change title tag from \\"${topPage?.title || 'Current Title'}\\" to \\"${keyword} — Free Calculator & Analysis Tool | ${domain}\\" (places primary keyword first for maximum weight, adds emotional trigger 'Free', stays within 55 chars)"

WRONG: "Add a meta description"
RIGHT: "Set meta description to: \\"Use our free ${keyword} to estimate rental income, expenses, and ROI. Trusted by 6,000+ investors. Try it now — no credit card required.\\" (155 chars, includes keyword, CTA, social proof)"

WRONG: "Add internal links"
RIGHT: "Add internal link from /blog/how-to-invest-in-airbnb with anchor text \\"${keyword}\\" pointing to ${topUrl}. Add second link from /guides/str-revenue-projections with anchor text \\"calculate your rental income\\" pointing to ${topUrl}."

WRONG: "Add schema markup"
RIGHT: "Add SoftwareApplication schema: { \\"@context\\": \\"https://schema.org\\", \\"@type\\": \\"SoftwareApplication\\", \\"name\\": \\"${domain} ${keyword}\\", \\"applicationCategory\\": \\"FinanceApplication\\", \\"offers\\": { \\"@type\\": \\"Offer\\", \\"price\\": \\"0\\", \\"priceCurrency\\": \\"USD\\" } }"

WRONG: "Improve content"
RIGHT: "Add new H2 section \\"How to Use an ${keyword}\\" after the current second H2. Include a 4-step numbered walkthrough (300+ words): 1) Enter property address, 2) Adjust assumptions, 3) Review revenue projections, 4) Compare with long-term rental. This targets the 'how to' featured snippet opportunity."

WRONG: "Build backlinks"
RIGHT: "Create a linkable asset: \\"2026 Short-Term Rental Market Report\\" with original data from your platform (average ROI by city, top-performing markets). Pitch to BiggerPockets, Mashable Travel, and NerdWallet as a data source. Template outreach subject line: \\"Original STR data for your readers — 2026 market report\\""

Provide 15-22 checklist items. Cover ALL of these categories: title-tag, meta-description, heading-structure, content (multiple items), internal-linking (multiple items), schema-markup, technical-seo, backlinks, images, featured-snippet, topical-authority, eeat. Each item must explain its impact.`;

  return prompt;
}

function siteDomain(siteUrl) {
  try {
    return new URL(siteUrl.replace(/\/$/, '')).hostname.replace('www.', '');
  } catch {
    return siteUrl.replace(/https?:\/\//, '').replace('www.', '').replace(/\/$/, '');
  }
}

/* ------------------------------------------------------------------ */
/*  OpenAI API Call                                                   */
/* ------------------------------------------------------------------ */

async function callOpenAI(apiKey, prompt) {
  let response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a senior SEO strategist with 15+ years of experience in technical SEO, content strategy, and competitive analysis. You think through SERP intent, topical authority, E-E-A-T, content gaps, featured snippet opportunities, and conversion optimization. You provide extremely specific, actionable recommendations with exact text, URLs, code, and clear reasoning for why each action will improve rankings. Always respond with valid JSON only — no markdown fences, no explanation outside the JSON structure.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 6000,
      }),
    });
  } catch (fetchErr) {
    throw new Error(`Failed to reach OpenAI API: ${fetchErr.message}`);
  }

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errorBody = await response.json();
      errorDetail = errorBody.error?.message || JSON.stringify(errorBody);
    } catch {
      errorDetail = await response.text().catch(() => 'unknown');
    }
    if (response.status === 401) throw new Error('OpenAI API key is invalid or expired.');
    if (response.status === 429) throw new Error('OpenAI rate limit — please wait and try again.');
    if (response.status === 402 || response.status === 403) throw new Error('OpenAI billing/quota issue — check your account.');
    throw new Error(`OpenAI error (${response.status}): ${errorDetail}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';

  let cleaned = content.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    console.error('Failed to parse OpenAI response:', cleaned.substring(0, 500));
    throw new Error('AI returned invalid JSON — please retry');
  }
}
