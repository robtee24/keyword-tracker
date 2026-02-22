import { getSupabase } from '../db.js';

export const config = { maxDuration: 60 };

/**
 * POST /api/blog/opportunities
 * { siteUrl, objectives, existingKeywords, existingTopics }
 * Generates blog topic opportunities using AI.
 *
 * GET /api/blog/opportunities?siteUrl=...
 * Returns saved opportunities.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();

  if (req.method === 'GET') {
    const { siteUrl } = req.query;
    if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });
    if (!supabase) return res.status(200).json({ opportunities: [] });

    const { data, error } = await supabase
      .from('blog_opportunities')
      .select('*')
      .eq('site_url', siteUrl)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[BlogOpps] Fetch error:', error.message);
      return res.status(200).json({ opportunities: [] });
    }
    return res.status(200).json({ opportunities: data || [] });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { siteUrl, objectives, existingKeywords, existingTopics } = req.body || {};
  if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });

  const prompt = `You are an expert content strategist and SEO specialist. Generate a list of blog topic opportunities for this website.

WEBSITE: ${siteUrl}

BUSINESS OBJECTIVES:
${objectives || 'Not specified — infer from the website URL and existing keywords.'}

EXISTING KEYWORDS THE SITE RANKS FOR (top performers):
${(existingKeywords || []).slice(0, 100).join(', ') || 'None provided'}

EXISTING BLOG TOPICS ALREADY COVERED:
${(existingTopics || []).slice(0, 50).join(', ') || 'None provided'}

REQUIREMENTS:
1. Generate 15-25 blog topic ideas that would drive organic traffic and support business goals
2. Each topic should target a specific keyword or keyword cluster
3. Prioritize topics that fill content gaps (not already covered)
4. Include a mix of: how-to guides, comparison posts, listicles, case studies, data-driven content
5. For each topic, estimate search volume category (high/medium/low) and explain how it helps the business
6. Consider the content funnel: awareness, consideration, and decision-stage content

Respond with ONLY valid JSON:
{
  "opportunities": [
    {
      "title": "<proposed blog post title>",
      "targetKeyword": "<primary keyword to target>",
      "relatedKeywords": ["<3-5 related keywords>"],
      "searchVolume": "high" | "medium" | "low",
      "estimatedMonthlySearches": <number estimate>,
      "difficulty": "easy" | "medium" | "hard",
      "funnelStage": "awareness" | "consideration" | "decision",
      "description": "<2-3 sentences on how this blog helps the business goals>",
      "contentType": "how-to" | "listicle" | "comparison" | "case-study" | "guide" | "opinion" | "data-driven"
    }
  ]
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: `Generate blog topic opportunities for ${siteUrl}` },
        ],
        temperature: 0.4,
        max_tokens: 6000,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => 'unknown');
      throw new Error(`OpenAI error (${response.status}): ${detail}`);
    }

    const data = await response.json();
    let raw = data.choices?.[0]?.message?.content || '';
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      else throw new Error('Failed to parse AI response');
    }

    const opportunities = parsed.opportunities || [];

    if (supabase && opportunities.length > 0) {
      const rows = opportunities.map((opp) => ({
        site_url: siteUrl,
        title: opp.title,
        target_keyword: opp.targetKeyword,
        related_keywords: opp.relatedKeywords || [],
        search_volume: opp.searchVolume || 'medium',
        estimated_searches: opp.estimatedMonthlySearches || 0,
        difficulty: opp.difficulty || 'medium',
        funnel_stage: opp.funnelStage || 'awareness',
        description: opp.description || '',
        content_type: opp.contentType || 'guide',
        status: 'pending',
        created_at: new Date().toISOString(),
      }));

      const { error: insertErr } = await supabase.from('blog_opportunities').insert(rows);
      if (insertErr) console.error('[BlogOpps] Insert error:', insertErr.message);
    }

    return res.status(200).json({ opportunities });
  } catch (err) {
    console.error('[BlogOpps] Generation error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
