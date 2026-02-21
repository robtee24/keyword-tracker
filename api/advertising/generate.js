import { getSupabase } from '../db.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OpenAI API key not configured' });

  const { siteUrl, objectives } = req.body || {};
  if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });

  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database not configured' });

  // Gather keyword data: keywords, search volumes, intents
  const [kwRes, volRes, intentRes] = await Promise.all([
    supabase.from('keywords').select('keyword, first_seen_at, last_seen_at').eq('site_url', siteUrl),
    supabase.from('search_volumes').select('keyword, avg_monthly_searches, competition, competition_index').eq('site_url', siteUrl),
    supabase.from('keyword_intents').select('keyword, intent').eq('site_url', siteUrl),
  ]);

  const keywords = (kwRes.data || []).map((k) => k.keyword);
  const volumeMap = {};
  for (const v of volRes.data || []) {
    volumeMap[v.keyword.toLowerCase()] = {
      volume: v.avg_monthly_searches,
      competition: v.competition,
      competitionIndex: v.competition_index,
    };
  }
  const intentMap = {};
  for (const i of intentRes.data || []) {
    intentMap[i.keyword.toLowerCase()] = i.intent;
  }

  // Build keyword context for AI (limit to top 500 by volume for token efficiency)
  const enriched = keywords.map((kw) => {
    const vol = volumeMap[kw.toLowerCase()];
    const intent = intentMap[kw.toLowerCase()];
    return { keyword: kw, volume: vol?.volume ?? null, competition: vol?.competition ?? null, competitionIndex: vol?.competitionIndex ?? null, intent: intent || null };
  });
  enriched.sort((a, b) => (b.volume || 0) - (a.volume || 0));
  const topKeywords = enriched.slice(0, 500);

  const objectivesContext = objectives
    ? `
SITE OBJECTIVES:
- Site Type: ${objectives.siteType || 'unknown'}
- Primary Objective: ${objectives.primaryObjective || 'unknown'}
- Secondary Objectives: ${objectives.secondaryObjectives?.join(', ') || 'none'}
- Core Offerings: ${objectives.coreOfferings?.map((o) => `${o.name} (${o.description})`).join('; ') || 'unknown'}
- Target Audience: ${objectives.targetAudience || 'unknown'}
- Geographic Focus: ${objectives.geographicFocus || 'unknown'}
- Competitors: ${objectives.competitors || 'unknown'}
- Unique Value: ${objectives.uniqueValue || 'unknown'}
- Conversion Goals: ${objectives.conversionGoals || 'unknown'}
`
    : '';

  const keywordTable = topKeywords
    .map((k) => `${k.keyword} | vol:${k.volume ?? '?'} | comp:${k.competition ?? '?'} | intent:${k.intent ?? '?'}`)
    .join('\n');

  const prompt = `You are a Google Ads keyword strategist. Analyze the site's keywords and objectives to build optimized keyword lists for a Google Ads campaign.

${objectivesContext}

CURRENT RANKING KEYWORDS (keyword | monthly volume | competition | intent):
${keywordTable}

INSTRUCTIONS:
1. **Broad Match**: Select 30-60 broad match keywords. Prefer high-volume terms with transactional or commercial intent. Include BOTH keywords the site already ranks for AND new suggested terms likely to drive conversions. Mark each as "ranking" or "suggested".

2. **Phrase Match**: Select 40-80 phrase match keywords. These should be more specific multi-word phrases with clear purchase intent. Include both ranking and suggested terms.

3. **Exact Match**: Select 30-50 exact match keywords. These should be the highest-converting, most specific terms. Include both ranking and suggested terms.

4. **Negative Keywords**: Generate 80-150 negative keywords organized by category. These should prevent wasted ad spend — terms that attract non-converting traffic (informational, competitor brands the advertiser wouldn't want, irrelevant modifiers, job seekers, DIY, free, etc.).

For each keyword (except negatives), include:
- The keyword text
- Whether it's "ranking" (already ranks in organic search) or "suggested" (AI-recommended)
- Estimated monthly search volume (use exact data for ranking keywords, estimate for suggested)
- A conversion likelihood score (1-10, where 10 = most likely to convert)

For negative keywords, include:
- The keyword text
- The category (e.g., "Informational", "Job Seekers", "DIY/Free", "Irrelevant", "Competitor Brand", etc.)

Respond with ONLY valid JSON:
{
  "broad": [{ "keyword": "", "source": "ranking"|"suggested", "volume": 0, "conversionScore": 0 }],
  "phrase": [{ "keyword": "", "source": "ranking"|"suggested", "volume": 0, "conversionScore": 0 }],
  "exact": [{ "keyword": "", "source": "ranking"|"suggested", "volume": 0, "conversionScore": 0 }],
  "negative": [{ "keyword": "", "category": "" }],
  "summary": "<2-3 sentence strategy overview>"
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: `Generate the Google Ads keyword lists for site: ${siteUrl}` },
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => 'unknown');
      throw new Error(`OpenAI error (${response.status}): ${detail}`);
    }

    const json = await response.json();
    const raw = json.choices?.[0]?.message?.content || '';
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const result = {
      broad: Array.isArray(parsed.broad) ? parsed.broad : [],
      phrase: Array.isArray(parsed.phrase) ? parsed.phrase : [],
      exact: Array.isArray(parsed.exact) ? parsed.exact : [],
      negative: Array.isArray(parsed.negative) ? parsed.negative : [],
      summary: parsed.summary || '',
      generatedAt: new Date().toISOString(),
    };

    // Save to Supabase
    try {
      await supabase.from('ad_keywords').upsert(
        { site_url: siteUrl, data: result, generated_at: result.generatedAt },
        { onConflict: 'site_url' }
      );
    } catch (err) {
      console.error('[Advertising] DB save error:', err.message);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('[Advertising] Generation error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
