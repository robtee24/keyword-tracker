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

  const prompt = `You are an expert performance marketer and Google Ads keyword strategist. You apply professional paid advertising best practices, audience targeting methodology, and marketing psychology to build high-converting keyword lists.

${objectivesContext}

CURRENT RANKING KEYWORDS (keyword | monthly volume | competition | intent):
${keywordTable}

═══ GOOGLE ADS KEYWORD MATCH TYPE BEST PRACTICES ═══

BROAD MATCH STRATEGY:
- Use with Smart Bidding (Target CPA/ROAS) — broad match relies on Google's algorithm to find relevant searches
- Best for: high-volume discovery, finding new converting queries you haven't thought of
- Layer with audience signals (in-market, remarketing lists for search ads) for precision
- Always pair broad match campaigns with robust negative keyword lists
- Include brand terms, core product terms, and high-intent category terms
- Add audience layering in "observation" mode first to analyze performance, then "targeting" for top performers

PHRASE MATCH STRATEGY:
- Triggers when the meaning of the phrase is included in the search query
- Best for: balancing reach with precision — moderate volume, moderate control
- Include multi-word phrases with clear commercial or transactional intent
- Use for product category + modifier combinations (e.g., "best [product] for [use case]")
- Ideal for capturing comparison shoppers and solution-aware searchers

EXACT MATCH STRATEGY:
- Most precise — triggers only for searches with the same meaning
- Best for: highest-converting terms, brand terms, competitor terms, high-CPA keywords
- Include your most valuable converting terms — these justify higher bids
- Use for bottom-of-funnel, decision-stage queries
- Protect brand terms with exact match to prevent competitor poaching

═══ NEGATIVE KEYWORD BEST PRACTICES ═══

MUST-HAVE NEGATIVE CATEGORIES:
1. Universal negatives: free, cheap, DIY, how to, tutorial, template, sample, example, course, class, training, certification, salary, jobs, careers, hiring, interview, reddit, quora, wiki, definition, meaning
2. Competitor brand names the advertiser does NOT want to bid on (unless running competitor campaigns)
3. Irrelevant industries or verticals that share terminology with the site
4. Informational-only modifiers: what is, how does, explain, guide, vs, review, comparison (unless these are intentional campaigns)
5. Wrong geographic signals if there's a geo focus
6. Wrong product modifiers (wrong sizes, models, versions the site doesn't offer)
7. Refund/complaint/problem terms: complaint, lawsuit, scam, refund, cancel, problem, broken, worst

═══ CONVERSION PSYCHOLOGY FOR KEYWORD SELECTION ═══

Apply these principles when scoring conversion likelihood:
- Keywords indicating URGENCY (near me, today, fast, urgent, emergency) score higher — the searcher needs a solution NOW
- Keywords indicating PURCHASE READINESS (buy, order, pricing, quote, demo, trial, sign up, get started) score highest
- Keywords where the user is COMPARING OPTIONS (best, top, vs, alternative, compared, review) score moderately — they're close to deciding
- Keywords showing PROBLEM AWARENESS (how to fix, solve, prevent, improve) score moderately — they know the pain, may convert with the right offer
- Keywords that are purely INFORMATIONAL (what is, definition, meaning, history, types of) score lowest — early funnel, rarely convert on first click
- Apply JOBS TO BE DONE thinking: what job is the searcher hiring a solution for? Keywords aligned with the site's core job-to-be-done convert better
- Consider LOSS AVERSION: keywords framed around avoiding losses or problems ("stop losing", "prevent", "don't miss") signal higher urgency than gain-framed terms
- Factor in SOCIAL PROOF keywords: searches including "popular", "most used", "trusted", "recommended" indicate a buyer looking for validation

═══ AUDIENCE & INTENT ALIGNMENT ═══

- Prioritize TRANSACTIONAL keywords that directly align with the site's conversion goals
- Include COMPETITOR TRANSACTIONAL keywords — people searching for competitor products who aren't yet customers are valuable targets
- Include BRANDED NAVIGATIONAL keywords to protect brand traffic
- For suggested keywords, focus on terms the site SHOULD rank for based on its offerings but doesn't yet
- Consider LONG-TAIL variations that have lower competition but strong conversion signals
- Suggest keywords that target each stage of the buyer funnel (awareness → consideration → decision) but weight heavily toward decision stage

═══ CAMPAIGN STRUCTURE RECOMMENDATION ═══

The keyword lists should support this structure:
- BRAND campaign (exact match brand terms)
- NON-BRAND campaign (phrase/exact high-intent terms grouped by theme)
- COMPETITOR campaign (competitor brand + product terms)
- DISCOVERY campaign (broad match with smart bidding and audience layering)

INSTRUCTIONS:

1. **Broad Match**: Select 30-60 keywords. Include high-volume terms suitable for broad match with smart bidding. Mix ranking keywords AND suggested terms the site should target. Weight toward terms where Google's broad match algorithm can find valuable related queries.

2. **Phrase Match**: Select 40-80 keywords. Multi-word phrases with commercial/transactional intent. Include both ranking and suggested terms. Focus on phrases that capture solution-aware and comparison shoppers.

3. **Exact Match**: Select 30-50 keywords. The highest-converting, most specific terms. Include brand terms, competitor product names, and bottom-funnel terms with strong purchase signals. Both ranking and suggested.

4. **Negative Keywords**: Generate 100-200 negative keywords organized by category. Be thorough and expansive. Cover ALL the must-have categories listed above. Think about what searches would waste money for this specific site/industry.

For each keyword (except negatives), include:
- keyword: The keyword text
- source: "ranking" (already ranks in organic search) or "suggested" (AI-recommended)
- volume: Estimated monthly search volume (use exact data for ranking keywords, estimate for suggested)
- conversionScore: 1-10 based on the conversion psychology principles above (10 = highest likelihood)

For negative keywords, include:
- keyword: The keyword text
- category: The category (Informational, Job Seekers, DIY/Free, Irrelevant, Competitor Brand, Complaints, Geographic, Wrong Product, Universal)

Respond with ONLY valid JSON:
{
  "broad": [{ "keyword": "", "source": "ranking"|"suggested", "volume": 0, "conversionScore": 0 }],
  "phrase": [{ "keyword": "", "source": "ranking"|"suggested", "volume": 0, "conversionScore": 0 }],
  "exact": [{ "keyword": "", "source": "ranking"|"suggested", "volume": 0, "conversionScore": 0 }],
  "negative": [{ "keyword": "", "category": "" }],
  "summary": "<2-3 sentence strategy overview covering the recommended campaign approach, key opportunities, and primary conversion drivers>"
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
        max_tokens: 12000,
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
