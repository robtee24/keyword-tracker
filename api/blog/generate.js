import { getSupabase } from '../db.js';

export const config = { maxDuration: 120 };

/**
 * POST /api/blog/generate
 * { siteUrl, title, targetKeyword, relatedKeywords, description, objectives, opportunityId }
 * Generates a full blog post using AI.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { siteUrl, title, targetKeyword, relatedKeywords, description, objectives, opportunityId } = req.body || {};
  if (!siteUrl || !title) return res.status(400).json({ error: 'siteUrl and title are required' });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });

  const prompt = `You are an expert content writer and SEO specialist. Write a complete, publish-ready blog post.

WEBSITE: ${siteUrl}
BUSINESS OBJECTIVES: ${objectives || 'Infer from the website'}

BLOG POST DETAILS:
Title: ${title}
Target Keyword: ${targetKeyword || 'Infer from title'}
Related Keywords to Include: ${(relatedKeywords || []).join(', ') || 'None specified'}
Topic Context: ${description || 'Write based on the title'}

REQUIREMENTS:
1. Write 1500-2500 words of high-quality, original content
2. Use the target keyword naturally 3-5 times (no keyword stuffing)
3. Include related keywords where natural
4. Structure with clear H2 and H3 subheadings
5. Write a compelling introduction that hooks the reader
6. Include actionable takeaways and specific examples
7. End with a clear conclusion and call-to-action
8. Write in a professional but approachable tone
9. Include suggestions for images/visuals in [brackets]
10. Provide a meta description (under 155 characters)

Respond with ONLY valid JSON:
{
  "title": "<optimized title with target keyword>",
  "metaDescription": "<compelling meta description under 155 chars>",
  "slug": "<url-friendly-slug>",
  "content": "<full blog post in markdown format>",
  "wordCount": <number>,
  "suggestedImages": ["<image description for each suggested visual>"],
  "internalLinkSuggestions": ["<pages on the site this post should link to>"]
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: `Write a blog post: "${title}"` },
        ],
        temperature: 0.5,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => 'unknown');
      throw new Error(`OpenAI error (${response.status}): ${detail}`);
    }

    const data = await response.json();
    let raw = data.choices?.[0]?.message?.content || '';
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

    return res.status(200).json({ blog });
  } catch (err) {
    console.error('[BlogGenerate] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
