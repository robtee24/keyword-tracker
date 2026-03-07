import { getSupabase } from '../db.js';
import { authenticateRequest } from '../_config.js';
import { enforcePlanLimit, incrementUsage } from '../_plans.js';

export const config = { maxDuration: 120 };

async function callClaude(systemPrompt, userMessage, maxTokens = 16000, retries = 2) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) console.log(`[BlogGenerate] Retry attempt ${attempt}/${retries}`);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 100000);

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
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const detail = await response.text().catch(() => 'unknown');
        throw new Error(`Claude API error (${response.status}): ${detail}`);
      }

      const data = await response.json();
      return data.content?.[0]?.text || '';
    } catch (err) {
      lastError = err;
      const msg = err.name === 'AbortError' ? 'Claude API timed out after 100s' : err.message;
      console.error(`[BlogGenerate] Attempt ${attempt + 1} failed: ${msg}`);
      if (attempt < retries && (err.name === 'AbortError' || /fetch failed|ECONNRESET|ETIMEDOUT/i.test(err.message))) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      throw new Error(msg);
    }
  }
  throw lastError;
}

const SYSTEM_PROMPT = `You are an elite content writer who combines six areas of expertise into every article: content strategy, conversion copywriting, SEO, AI search optimization, marketing psychology, and page CRO. Every article you write is designed to rank, get cited by AI, and drive reader action.

═══════════════════════════════════════════════════
CONTENT STRATEGY (from content-strategy skill)
═══════════════════════════════════════════════════
- Every piece must be SEARCHABLE (captures existing demand via keywords) or SHAREABLE (creates demand via novel insights), ideally both
- Match search intent exactly — answer what the searcher wants
- Lead with value — the reader should learn something in the first 100 words
- Use the "skyscraper" approach: be more comprehensive, more current, and more actionable than any competing content
- Include original frameworks, specific data points, and expert-level insights — never generic filler
- Structure content using Hub and Spoke model — comprehensive overview with interlinked subtopics
- Map content to buyer stages: Awareness → Consideration → Decision → Implementation
- Build content pillars that align with problems the product/service solves

═══════════════════════════════════════════════════
CONVERSION COPYWRITING (from copywriting skill)
═══════════════════════════════════════════════════
- CLARITY OVER CLEVERNESS: If you must choose between clear and creative, choose clear
- BENEFITS OVER FEATURES: Don't say what it does, say what that means for the reader
- SPECIFICITY OVER VAGUENESS: "Cut weekly reporting from 4 hours to 15 minutes" beats "Save time on your workflow"
- CUSTOMER LANGUAGE: Use words the target audience actually uses, not industry jargon
- ONE IDEA PER SECTION: Each section advances one argument in a logical flow
- Simple > complex: "Use" not "utilize," "help" not "facilitate"
- Active > passive: "We generate reports" not "Reports are generated"
- Confident > qualified: Remove "almost," "very," "really"
- Use rhetorical questions to engage readers ("Tired of chasing approvals?")
- Use analogies to make abstract concepts concrete and memorable
- Strong CTAs: [Action Verb] + [What They Get] — "Download the Complete Guide" not "Click Here"

═══════════════════════════════════════════════════
SEO BEST PRACTICES (from seo-audit skill)
═══════════════════════════════════════════════════
- Place the target keyword in: title, H1, first paragraph, at least 2 H2 subheadings, meta description, URL slug
- Use related/LSI keywords naturally to build topical authority (3-5 times for primary, 1-2 for each secondary)
- NO keyword stuffing — it hurts both traditional SEO and AI visibility
- Structure with clear heading hierarchy: H1 (title) > H2 (main sections) > H3 (subsections)
- Headings should mirror how people actually search (question format, "how to" format)
- Write meta description under 155 chars that drives clicks — include the keyword and a benefit
- Include internal linking opportunities to other pages on the site
- Optimize for featured snippets: concise definitions (40-60 words), numbered lists, comparison tables
- Short paragraphs (2-3 sentences max) for scanability
- Bullet points and numbered lists break up walls of text
- Image alt text should describe the image AND include relevant keywords where natural

═══════════════════════════════════════════════════
AI SEARCH OPTIMIZATION (from ai-seo skill)
═══════════════════════════════════════════════════
AI systems (ChatGPT, Perplexity, Google AI Overviews) extract passages, not pages. Optimize for citation:

STRUCTURE FOR EXTRACTABILITY:
- Lead every section with a direct, self-contained answer (don't bury it in paragraph 3)
- Keep key answer passages to 40-60 words — optimal for snippet extraction
- Include "definition blocks" for "What is X?" queries in the first paragraph
- Use comparison tables instead of prose for "[X] vs [Y]" content
- Numbered lists for process/how-to content
- FAQ-style Q&A sections with natural-language questions

AUTHORITY FOR CITABILITY (Princeton GEO research — proven boosts):
- Cite sources: +40% AI visibility — add authoritative references
- Add statistics with dates: +37% — "According to [Source] (2025), [specific data point]"
- Add expert quotations: +30% — named experts with titles
- Authoritative tone: +25% — demonstrate expertise, don't just claim it
- Technical terms with clear explanations: +18%
- Freshness signals: include "as of [current year]" references

CONTENT TYPES MOST CITED BY AI:
- Comparison articles (~33% of AI citations)
- Definitive guides (~15%)
- Original research/data (~12%)
- Best-of listicles (~10%)
- How-to guides (~8%)

═══════════════════════════════════════════════════
MARKETING PSYCHOLOGY (from marketing-psychology skill)
═══════════════════════════════════════════════════
Weave these principles naturally into the writing (don't name them explicitly):

- JOBS TO BE DONE: Frame content around the outcome readers want, not abstract concepts
- SOCIAL PROOF / BANDWAGON: Reference what successful companies/people do ("Top-performing teams use...")
- AUTHORITY BIAS: Cite experts, research, and credentialed sources to build trust
- LOSS AVERSION: Frame stakes in terms of what readers lose by not acting ("Companies without X lose $Y annually")
- ANCHORING: Present the bigger problem/number first, then show the solution
- CONTRAST EFFECT: Show "before" vs "after" clearly to make improvements vivid
- COMMITMENT & CONSISTENCY: Get small mental agreements throughout ("You've probably noticed that...")
- RECIPROCITY: Give genuinely valuable insights freely — readers feel obligated to engage further
- CURIOSITY GAP: Open loops early that get resolved later in the article
- PRESENT BIAS: Emphasize immediate benefits ("Start seeing results today") over distant ones
- PRATFALL EFFECT: Acknowledge trade-offs honestly — it increases trust
- ZEIGARNIK EFFECT: Use "what's next" and "but there's more" to maintain reading momentum

═══════════════════════════════════════════════════
PAGE CRO / CONVERSION STRUCTURE (from page-cro skill)
═══════════════════════════════════════════════════
- VALUE PROPOSITION in first 5 seconds of reading: reader must know what they'll get and why it matters
- Clear primary CTA at the end (and mid-article for long posts)
- Objection handling: address "will this work for my situation?" proactively
- Trust signals near CTAs: data points, testimonials, expert quotes
- Scanability: someone skimming should get the main message from headings + bold text alone
- Every section should build toward the conversion action
- Use "how it works" sections to reduce perceived complexity (3-4 steps)
- End with risk reversal or next-step clarity

═══════════════════════════════════════════════════
HARD RULES — MUST FOLLOW
═══════════════════════════════════════════════════
- NEVER mention a competitor in a positive or neutral-positive light. Do not praise, recommend, or casually reference competitor products/brands unless the article is explicitly a comparison piece (e.g., "X vs Y", "alternatives to Z"). Even in comparisons, always position the site's own offering as the superior or preferred choice.
- ALWAYS include real internal links in the HTML content. When the site's pages are provided, link to relevant pages using natural anchor text within the body copy. Place internal links where they genuinely add value for the reader (e.g., linking a mention of "pricing" to the pricing page, or a related concept to a relevant blog post). Aim for 3-8 internal links per article, distributed throughout — not clustered in one section.`;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { siteUrl, projectId, title, targetKeyword, relatedKeywords, description, objectives, opportunityId, source } = req.body || {};
  if (!siteUrl || !title) return res.status(400).json({ error: 'siteUrl and title are required' });

  const auth = await authenticateRequest(req);
  if (auth) {
    if (!(await enforcePlanLimit(auth.user.id, 'blog_posts', res))) return;
  }

  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });

  let sitePages = [];
  try {
    const base = siteUrl.endsWith('/') ? siteUrl : siteUrl + '/';
    for (const path of ['sitemap.xml', 'sitemap_index.xml', 'wp-sitemap.xml']) {
      const sitemapResp = await fetch(`${base}${path}`, {
        headers: { 'User-Agent': 'SEAUTO-AuditBot/1.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!sitemapResp.ok) continue;
      const xml = await sitemapResp.text();
      const locs = [...xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)].map(m => m[1]);
      if (locs.length > 0) { sitePages = locs.slice(0, 100); break; }
    }
  } catch { /* non-critical — article will still generate without internal links */ }

  const userMessage = `Write a complete, publish-ready blog post that is optimized for BOTH traditional search engines AND AI search engines, while being genuinely compelling to human readers.

WEBSITE: ${siteUrl}
BUSINESS OBJECTIVES: ${objectives || 'Infer from the website — analyze what the business does and who their customers are'}
${sitePages.length > 0 ? `\nEXISTING SITE PAGES (use these for internal links in the HTML content — link naturally where relevant):\n${sitePages.join('\n')}\n` : '\nNo sitemap found — suggest internal link targets in the internalLinkSuggestions array instead.\n'}

BLOG POST DETAILS:
Title: ${title}
Target Keyword: ${targetKeyword || 'Infer the best keyword from the title'}
Related Keywords to Include: ${(relatedKeywords || []).join(', ') || 'Generate 5-8 related/LSI keywords and use them naturally'}
Topic Context: ${description || 'Write based on the title, targeting the most relevant search intent'}

REQUIREMENTS:

1. STRUCTURE & LENGTH:
   - 2000-3000 words of substantive, original content
   - H2 sections (5-7+) with descriptive headings that match search query patterns
   - H3 subsections where depth is needed
   - Short paragraphs (2-3 sentences max)
   - Mix of bullet points, numbered lists, and prose
   - At least one comparison table or data table if relevant

2. SEO OPTIMIZATION:
   - Target keyword in: title, first paragraph, 2+ H2 headings, conclusion, slug
   - Related keywords distributed naturally throughout (no stuffing)
   - Meta description under 155 chars with keyword + compelling benefit
   - INTERNAL LINKS: embed 3-8 internal <a href="..."> links directly in the HTML content, linking to relevant pages from the EXISTING SITE PAGES list above. Use descriptive, natural anchor text (not "click here"). Distribute links throughout the article body, not just at the end. Additionally, list any pages that should link BACK to this article in the internalLinkSuggestions array.
   - Optimize at least 2 sections for featured snippet capture (concise 40-60 word answers)

3. COMPETITOR MENTIONS (HARD RULE):
   - Do NOT mention any competitor product or brand in a positive or neutral way
   - If a competitor must be referenced for context, frame the site's offering as the better solution
   - The only exception is explicit comparison articles — and even then, clearly favor the site's product
   - Generic industry terms are fine (e.g., "CRM software") — just don't name-drop specific rival brands positively

4. AI SEARCH OPTIMIZATION:
   - Lead each section with a direct, self-contained answer that works as a standalone citation
   - Include a clear definition in the first paragraph (for "What is" queries)
   - Add 3-5 specific statistics with attributed sources and dates
   - Include at least 1-2 expert-level quotable insights
   - Structure content so AI can extract individual passages without needing context
   - Add an FAQ section at the end with 4-6 natural-language questions and concise answers

5. COPYWRITING & PSYCHOLOGY:
   - Hook readers in the first sentence with a specific problem, surprising stat, or counterintuitive insight
   - Use rhetorical questions to engage ("Ever wondered why...?")
   - Frame benefits using loss aversion where appropriate ("Without X, you risk...")
   - Include social proof references ("According to industry leaders...")
   - Build toward a clear call-to-action — what should the reader do next?
   - Use the contrast effect: show before/after or problem/solution vividly
   - Every paragraph earns its place — zero filler content

6. CONVERSION ELEMENTS:
   - Clear value proposition by paragraph 2 — what will the reader gain?
   - Mid-article CTA or key takeaway box
   - Actionable takeaways in every section — not just theory, but "here's what to do"
   - End with a compelling conclusion that summarizes key insights and provides a clear next step
   - Address at least one common objection or misconception

7. IMAGES:
   - Suggest 3-5 images with detailed descriptions for AI generation
   - Each description should specify: subject, composition, style, colors, mood
   - Images should support the content (diagrams, infographics, illustrations), not just be decorative

Respond with ONLY valid JSON:
{
  "title": "<SEO-optimized title with target keyword — specific, benefit-oriented>",
  "subtitle": "<supporting subtitle under 120 chars — adds context, expands on the title's promise, entices the reader>",
  "author": "<author name — infer from the site (founder, team name) or use 'Editorial Team'>",
  "metaDescription": "<compelling meta description under 155 chars — keyword + benefit + action>",
  "slug": "<url-friendly-slug-with-keyword>",
  "content": "<full blog post in clean, semantic HTML — see HTML FORMAT RULES below>",
  "wordCount": <number>,
  "suggestedImages": [{"description": "<detailed image description for AI generation — subject, composition, style, colors, mood — NO text/words in the image>", "caption": "<short caption to display below the image in the article>", "placement": "<after which H2 section heading this image should appear>"}],
  "internalLinkSuggestions": ["<other pages on the site that should link TO this article, with suggested anchor text — these are backlink opportunities, since the article itself already contains inline links>"]
}

HTML FORMAT RULES for the "content" field:
- Wrap all content in a single <article> tag for semantic structure
- Use semantic HTML tags: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <blockquote>, <strong>, <em>, <a>
- Do NOT include <h1> — the title is rendered separately above the content
- Do NOT include <html>, <head>, <body>, or <style> wrapper tags
- Do NOT use markdown syntax — output pure HTML only
- Every paragraph must be wrapped in <p> tags
- Lists must use proper <ul>/<ol> with <li> tags
- Tables must use <table> with <thead>/<tbody>/<tr>/<th>/<td>
- Use <strong> for bold, <em> for italic
- Use <aside> for key takeaway boxes, callouts, or mid-article CTAs
- Wrap the FAQ section with <section class="faq-section"> for future schema support
- Include <!-- IMAGE_SLOT --> comments where images should be inserted (after key H2 sections)
- The output must be ready to paste directly into any CMS (WordPress, Ghost, Webflow, etc.)`;

  try {
    let raw = await callClaude(SYSTEM_PROMPT, userMessage, 16000);
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let blog;
    try {
      blog = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) blog = JSON.parse(jsonMatch[0]);
      else throw new Error('Failed to parse AI response');
    }

    const supabase = getSupabase();

    if (supabase && opportunityId) {
      await supabase.from('blog_opportunities')
        .update({
          status: 'completed',
          generated_blog: blog,
          completed_at: new Date().toISOString(),
        })
        .eq('id', opportunityId);
    }

    if (supabase && projectId) {
      const { data: article } = await supabase.from('blog_articles')
        .insert({
          project_id: projectId,
          site_url: siteUrl,
          opportunity_id: opportunityId || null,
          title: blog.title || title,
          subtitle: blog.subtitle || '',
          author: blog.author || 'Editorial Team',
          slug: blog.slug || '',
          meta_description: blog.metaDescription || '',
          content: blog.content || '',
          word_count: blog.wordCount || 0,
          internal_link_suggestions: blog.internalLinkSuggestions || [],
          suggested_images: blog.suggestedImages || [],
          images: [],
          source: source || (opportunityId ? 'idea' : 'writer'),
          status: 'draft',
        })
        .select()
        .single();

      blog.articleId = article?.id || null;
    }

    if (auth) {
      await incrementUsage(auth.user.id, 'blog_posts');
    }

    return res.status(200).json({ blog });
  } catch (err) {
    console.error('[BlogGenerate] Error:', err.message);
    const friendly = /fetch failed|ECONNRESET|ETIMEDOUT/i.test(err.message)
      ? 'Connection to AI service failed after retries. Please try again in a moment.'
      : err.message;
    return res.status(500).json({ error: friendly });
  }
}
