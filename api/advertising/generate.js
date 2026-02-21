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

  console.log(`[Advertising] Found ${keywords.length} keywords, ${Object.keys(volumeMap).length} volumes, ${Object.keys(intentMap).length} intents for ${siteUrl}`);

  // Build keyword context for AI (limit to top 200 by volume for token efficiency)
  const enriched = keywords.map((kw) => {
    const vol = volumeMap[kw.toLowerCase()];
    const intent = intentMap[kw.toLowerCase()];
    return { keyword: kw, volume: vol?.volume ?? null, competition: vol?.competition ?? null, competitionIndex: vol?.competitionIndex ?? null, intent: intent || null };
  });
  enriched.sort((a, b) => (b.volume || 0) - (a.volume || 0));
  const topKeywords = enriched.slice(0, 200);

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

  const prompt = `You are an expert Google Ads keyword strategist applying paid advertising best practices and marketing psychology.

${objectivesContext}

RANKING KEYWORDS (keyword | volume | competition | intent):
${keywordTable}

MATCH TYPE RULES:
- BROAD: 30-50 high-volume terms for Smart Bidding discovery. Include brand, product, and category terms. Mix ranking + suggested.
- PHRASE: 40-70 multi-word phrases with commercial/transactional intent. For comparison shoppers and solution-aware searches. Mix ranking + suggested.
- EXACT: 25-40 highest-converting terms. Brand protection, competitor names, bottom-funnel purchase-ready queries. Mix ranking + suggested.

NEGATIVE KEYWORD RULES (generate 100-150, organized by category):
Categories: Universal (free, cheap, DIY, tutorial, template, salary, jobs, careers, hiring, reddit, wiki, definition), Informational (what is, how does, explain, guide, meaning), Competitor Brand (brands advertiser shouldn't bid on), Complaints (scam, refund, cancel, lawsuit, broken, worst), Job Seekers (jobs, careers, hiring, salary, interview), Irrelevant (wrong industry/vertical terms), Wrong Product (wrong models/sizes/versions), Geographic (wrong locations if geo-focused).

CONVERSION SCORING (1-10):
10: purchase-ready (buy, pricing, quote, demo, trial, sign up)
8-9: urgency (near me, today, fast) or high commercial intent
6-7: comparison (best, vs, alternative, review, top)
4-5: problem-aware (how to fix, solve, improve)
1-3: informational (what is, definition, types of, history)
Boost score for keywords aligned with site's core offering and conversion goals.

For each keyword mark source as "ranking" (already ranks organically) or "suggested" (AI-recommended new term).

Respond with ONLY valid JSON:
{
  "broad": [{"keyword":"","source":"ranking","volume":0,"conversionScore":0}],
  "phrase": [{"keyword":"","source":"ranking","volume":0,"conversionScore":0}],
  "exact": [{"keyword":"","source":"ranking","volume":0,"conversionScore":0}],
  "negative": [{"keyword":"","category":""}],
  "summary": "2-3 sentence strategy overview"
}`;

  console.log(`[Advertising] Sending prompt with ${topKeywords.length} keywords to OpenAI...`);

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
      console.error(`[Advertising] OpenAI error: ${response.status}`, detail.substring(0, 500));
      throw new Error(`OpenAI error (${response.status}): ${detail.substring(0, 200)}`);
    }

    const json = await response.json();
    const raw = json.choices?.[0]?.message?.content || '';
    console.log(`[Advertising] Got response, length=${raw.length}, finish_reason=${json.choices?.[0]?.finish_reason}`);

    if (!raw) {
      throw new Error('OpenAI returned empty response');
    }

    // Handle potential truncation (finish_reason: 'length')
    let cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    // If JSON is truncated, try to repair by closing open structures
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.warn('[Advertising] JSON parse failed, attempting repair...');
      // Try to close any open arrays/objects
      let repaired = cleaned;
      const openBraces = (repaired.match(/{/g) || []).length;
      const closeBraces = (repaired.match(/}/g) || []).length;
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/\]/g) || []).length;
      // Remove trailing comma if present
      repaired = repaired.replace(/,\s*$/, '');
      // Close any unclosed structures
      for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
      try {
        parsed = JSON.parse(repaired);
        console.log('[Advertising] JSON repair succeeded');
      } catch {
        console.error('[Advertising] JSON repair failed. Raw response:', cleaned.substring(0, 500));
        throw new Error('Failed to parse AI response. The response may have been truncated.');
      }
    }

    const result = {
      broad: Array.isArray(parsed.broad) ? parsed.broad : [],
      phrase: Array.isArray(parsed.phrase) ? parsed.phrase : [],
      exact: Array.isArray(parsed.exact) ? parsed.exact : [],
      negative: Array.isArray(parsed.negative) ? parsed.negative : [],
      summary: parsed.summary || '',
      generatedAt: new Date().toISOString(),
    };

    console.log(`[Advertising] Generated: ${result.broad.length} broad, ${result.phrase.length} phrase, ${result.exact.length} exact, ${result.negative.length} negative`);

    // Save to Supabase
    try {
      const { error: dbErr } = await supabase.from('ad_keywords').upsert(
        { site_url: siteUrl, data: result, generated_at: result.generatedAt },
        { onConflict: 'site_url' }
      );
      if (dbErr) console.error('[Advertising] DB save error:', dbErr.message);
      else console.log('[Advertising] Saved to DB');
    } catch (err) {
      console.error('[Advertising] DB save exception:', err.message);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('[Advertising] Generation error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
