import { getSupabase } from '../db.js';

export const config = { maxDuration: 60 };

/**
 * POST /api/ai/classify-intents
 * { siteUrl, keywords: string[], objectives: SiteObjectives }
 *
 * Uses GPT-4o-mini to classify keyword intent using the organization's
 * specific objectives, core offerings, and business context. Results
 * are cached in Supabase so the same keywords aren't re-classified.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { siteUrl, keywords, objectives } = req.body || {};
  if (!siteUrl || !Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ error: 'siteUrl and keywords array are required' });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
  }

  const supabase = getSupabase();

  // 1. Check cache for already-classified keywords
  let cached = {};
  if (supabase) {
    try {
      const lowerKws = keywords.map((k) => k.toLowerCase());
      const allCached = [];
      for (let i = 0; i < lowerKws.length; i += 50) {
        const batch = lowerKws.slice(i, i + 50);
        const { data } = await supabase
          .from('keyword_intents')
          .select('keyword, intent')
          .eq('site_url', siteUrl)
          .in('keyword', batch);
        if (data) allCached.push(...data);
      }
      for (const row of allCached) {
        cached[row.keyword.toLowerCase()] = row.intent;
      }
    } catch (err) {
      console.error('[ClassifyIntents] Cache read error:', err.message);
    }
  }

  // 2. Find keywords that need classification
  const uncached = keywords.filter((kw) => !cached[kw.toLowerCase()]);

  if (uncached.length === 0) {
    return res.status(200).json({ intents: cached, fromCache: true });
  }

  // 3. Build prompt with business context and classify in batches
  const INTENT_TYPES = [
    'Transactional',
    'Product',
    'Educational',
    'Navigational',
    'Local',
    'Branded',
    'Competitor Navigational',
    'Competitor Transactional',
  ];

  const businessContext = buildBusinessContext(objectives || {});
  const freshIntents = {};

  const BATCH_SIZE = 80;
  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);
    try {
      const classified = await classifyBatch(openaiKey, siteUrl, batch, businessContext, INTENT_TYPES);
      Object.assign(freshIntents, classified);
    } catch (err) {
      console.error('[ClassifyIntents] Batch error:', err.message);
    }
  }

  // 4. Save fresh classifications to cache
  if (supabase && Object.keys(freshIntents).length > 0) {
    try {
      const rows = Object.entries(freshIntents).map(([kw, intent]) => ({
        site_url: siteUrl,
        keyword: kw.toLowerCase(),
        intent,
        classified_at: new Date().toISOString(),
      }));
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await supabase
          .from('keyword_intents')
          .upsert(batch, { onConflict: 'site_url,keyword' });
        if (error) console.error('[ClassifyIntents] Cache write error:', error.message);
      }
    } catch (err) {
      console.error('[ClassifyIntents] Cache save error:', err.message);
    }
  }

  const allIntents = { ...cached, ...freshIntents };
  return res.status(200).json({ intents: allIntents, classified: Object.keys(freshIntents).length });
}

function buildBusinessContext(obj) {
  const parts = [];

  if (obj.siteType) parts.push(`Business type: ${obj.siteType}`);
  if (obj.primaryObjective) parts.push(`Primary goal: ${obj.primaryObjective}`);
  if (obj.secondaryObjectives?.length) {
    parts.push(`Secondary goals: ${obj.secondaryObjectives.join(', ')}`);
  }
  if (obj.coreOfferings?.length) {
    const offerings = obj.coreOfferings
      .filter((o) => o.name)
      .map((o) => `${o.name}${o.topKeyword ? ` (key term: "${o.topKeyword}")` : ''}${o.description ? ` — ${o.description}` : ''}`)
      .join('; ');
    if (offerings) parts.push(`Core products/services: ${offerings}`);
  }
  if (obj.targetAudience) parts.push(`Target audience: ${obj.targetAudience}`);
  if (obj.geographicFocus) parts.push(`Geographic focus: ${obj.geographicFocus}`);
  if (obj.competitors) parts.push(`Competitors: ${obj.competitors}`);
  if (obj.uniqueValue) parts.push(`Unique value: ${obj.uniqueValue}`);
  if (obj.conversionGoals) parts.push(`Conversion goals: ${obj.conversionGoals}`);

  return parts.join('\n');
}

async function classifyBatch(apiKey, siteUrl, keywords, businessContext, intentTypes) {
  const prompt = `You are an SEO intent classifier. Given a business profile and a list of search keywords, classify each keyword's search intent from the perspective of THIS SPECIFIC BUSINESS.

BUSINESS PROFILE:
Website: ${siteUrl}
${businessContext}

INTENT TYPES (pick exactly one per keyword):
- Transactional: The searcher wants to buy, sign up, use a tool, or take action on something this business offers
- Product: The searcher is comparing, evaluating, or researching products/services in this business's category
- Educational: The searcher wants to learn, understand, or find information — they're not ready to buy
- Navigational: The searcher is looking for a specific website or page (not this business's brand)
- Local: The searcher is looking for something nearby or location-specific
- Branded: The keyword contains this business's own brand name
- Competitor Navigational: The keyword references a competitor — the user is looking for that competitor's site
- Competitor Transactional: The keyword references a competitor but with purchase/comparison intent — these users are still open to alternatives

IMPORTANT RULES:
- A keyword like "what is [product category]" is Educational even if this business sells that product
- A keyword like "[product category] software" is Transactional if this business IS that software
- Keywords containing competitor brand names should be Competitor Navigational or Competitor Transactional
- Keywords directly about this business's core offerings (matching their key terms) lean Transactional
- Generic industry terms without action words are usually Educational
- "best [category]" or "[x] vs [y]" are Product intent (comparison shopping)

KEYWORDS TO CLASSIFY:
${keywords.map((kw, i) => `${i + 1}. ${kw}`).join('\n')}

Respond with ONLY a JSON object mapping each keyword (lowercase) to its intent. Example:
{"keyword one": "Transactional", "keyword two": "Educational"}`;

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
          content: 'You are an SEO expert. Respond with valid JSON only — no markdown fences, no explanation.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => 'unknown');
    throw new Error(`OpenAI error (${response.status}): ${detail}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';

  let cleaned = content.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    const parsed = JSON.parse(cleaned);
    const result = {};
    const validIntents = new Set(intentTypes);
    for (const [kw, intent] of Object.entries(parsed)) {
      if (validIntents.has(intent)) {
        result[kw.toLowerCase()] = intent;
      }
    }
    return result;
  } catch {
    console.error('[ClassifyIntents] Failed to parse AI response:', cleaned.substring(0, 300));
    return {};
  }
}
