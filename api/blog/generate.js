import { getSupabase } from '../db.js';
import { authenticateRequest } from '../_config.js';
import { enforcePlanLimit, incrementUsage } from '../_plans.js';

export const config = { maxDuration: 120 };

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

const SYSTEM_PROMPT = `You are an expert content writer, SEO specialist, and subject matter authority. You write compelling, well-researched blog posts that rank well in search engines and genuinely help readers.

CONTENT STRATEGY PRINCIPLES:
- Every piece must be SEARCHABLE (captures existing demand via keywords) or SHAREABLE (creates demand via novel insights), ideally both
- Match search intent exactly — answer what the searcher wants
- Lead with value — the reader should learn something in the first 100 words
- Use the "skyscraper" approach: be more comprehensive, more current, and more actionable than competing content
- Include original frameworks, specific data points, and expert-level insights — never generic filler

WRITING QUALITY STANDARDS:
- Hook readers in the first sentence with a specific problem, surprising stat, or counterintuitive insight
- Every paragraph must earn its place — cut anything that doesn't inform, persuade, or entertain
- Use concrete examples and case studies, not abstract advice
- Write at a professional but conversational level — authoritative without being dry
- Vary sentence length and structure for rhythm
- Use transition phrases that create narrative flow between sections

SEO BEST PRACTICES:
- Place the target keyword in the title, first paragraph, at least 2 subheadings, and naturally throughout
- Use related/LSI keywords to build topical authority
- Structure with a clear heading hierarchy (H2 > H3) that mirrors search patterns
- Write a compelling meta description that drives clicks (under 155 chars)
- Include internal linking opportunities
- Optimize for featured snippets with concise, quotable definitions and lists

CONTENT STRUCTURE:
- Strong hook introduction (problem/pain point/surprising insight)
- Clear value proposition (what the reader will learn)
- Logical flow with 5-7+ substantive sections
- Actionable takeaways in each section
- Compelling conclusion with clear CTA`;

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

  const userMessage = `Write a complete, publish-ready blog post.

WEBSITE: ${siteUrl}
BUSINESS OBJECTIVES: ${objectives || 'Infer from the website'}

BLOG POST DETAILS:
Title: ${title}
Target Keyword: ${targetKeyword || 'Infer from title'}
Related Keywords to Include: ${(relatedKeywords || []).join(', ') || 'None specified'}
Topic Context: ${description || 'Write based on the title'}

REQUIREMENTS:
1. Write 2000-3000 words of high-quality, original content
2. Use the target keyword naturally 3-5 times (no keyword stuffing)
3. Include related keywords where they fit naturally
4. Structure with clear H2 and H3 subheadings (at least 5-7 subheadings)
5. Write a compelling introduction that hooks the reader with a specific problem or insight
6. Include actionable takeaways, specific examples, data points, and expert insights
7. Use short paragraphs (2-3 sentences max), bullet points, and numbered lists for scanability
8. End with a clear conclusion and call-to-action
9. Write in a professional but approachable tone — authoritative without being dry
10. Suggest 3-5 images with detailed descriptions in the suggestedImages array
11. Provide a meta description (under 155 characters)
12. Make every section substantive — no padding or filler content

Respond with ONLY valid JSON:
{
  "title": "<optimized title with target keyword>",
  "metaDescription": "<compelling meta description under 155 chars>",
  "slug": "<url-friendly-slug>",
  "content": "<full blog post in markdown format>",
  "wordCount": <number>,
  "suggestedImages": ["<detailed image description for AI generation — describe the scene, style, colors, composition>"],
  "internalLinkSuggestions": ["<pages on the site this post should link to>"]
}`;

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
    return res.status(500).json({ error: err.message });
  }
}
