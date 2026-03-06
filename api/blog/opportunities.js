import { getSupabase } from '../db.js';
import { authenticateRequest } from '../_config.js';
import { extractRootDomain } from '../_domainMatch.js';

export const config = { maxDuration: 120 };

async function callClaude(systemPrompt, userMessage, maxTokens = 8000) {
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

const SYSTEM_PROMPT = `You are an elite content strategist and SEO specialist. Your expertise is finding blog topics that drive qualified traffic and convert visitors into customers.

CONTENT STRATEGY PRINCIPLES (from proven frameworks):

1. SEARCHABLE vs SHAREABLE — Every piece must be one or both. Prioritize searchable (captures existing demand) over shareable (creates demand).

2. BUYER STAGE TARGETING — Map topics to the buyer journey using keyword modifiers:
   - AWARENESS: "what is," "how to," "guide to," "introduction to" — educational content that builds trust
   - CONSIDERATION: "best," "top," "vs," "alternatives," "comparison" — helps prospects evaluate options
   - DECISION: "pricing," "reviews," "demo," "trial," "buy" — converts prospects to customers
   - IMPLEMENTATION: "templates," "examples," "tutorial," "setup" — retains and activates customers

3. CONTENT TYPES TO MIX:
   - Use-Case Content: [persona] + [use-case] for long-tail keywords
   - Hub and Spoke: comprehensive overview + related subtopics
   - Template Libraries: high-intent keywords + immediate value
   - Comparison/Alternative Pages: capture competitive search traffic
   - Data-Driven Content: original insights that earn links and shares
   - Case Studies: Challenge → Solution → Results → Learnings

4. PRIORITIZATION SCORING:
   - Customer Impact (40%): How many prospects search for this?
   - Content-Market Fit (30%): Does this naturally lead to the product/service?
   - Search Potential (20%): Volume, difficulty, growth trend
   - Resource Requirements (10%): Can we create authoritative content here?

5. TRANSACTIONAL INTENT FOCUS:
   - Prioritize topics where the searcher has buying intent or is evaluating solutions
   - Find keywords where ranking would directly drive revenue
   - Look for "money keywords" — terms people search right before making a purchase decision
   - Include bottom-of-funnel content that competitors neglect

6. KEYWORD INTELLIGENCE:
   - Identify topic clusters (group related keywords)
   - Find quick wins (low competition + decent volume + high relevance)
   - Spot content gaps (keywords the site should rank for but doesn't)
   - Consider search intent behind every keyword`;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();

  if (req.method === 'GET') {
    const { siteUrl, projectId } = req.query;
    if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });
    if (!supabase) return res.status(200).json({ opportunities: [] });

    let query = supabase
      .from('blog_opportunities')
      .select('*')
      .eq('site_url', siteUrl)
      .order('created_at', { ascending: false });
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;

    if (error) {
      console.error('[BlogOpps] Fetch error:', error.message);
      return res.status(200).json({ opportunities: [] });
    }
    return res.status(200).json({ opportunities: data || [] });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) {
    console.error('[BlogOpps] Auth failed — no valid token');
    return res.status(401).json({ error: 'Authentication required. Please sign in again.' });
  }

  const { siteUrl, objectives, existingKeywords, existingTopics, projectId, seriesTheme, count } = req.body || {};
  if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[BlogOpps] ANTHROPIC_API_KEY not set');
    return res.status(500).json({ error: 'AI service is not configured. Please contact support.' });
  }

  console.log(`[BlogOpps] Generating topics for ${siteUrl} (project: ${projectId})`);
  const startTime = Date.now();

  // Pull real GSC keyword data from the database
  let gscKeywordData = '';
  let searchVolumeData = '';
  const normalizedDomain = extractRootDomain(siteUrl);

  if (supabase) {
    try {
      // Fetch keywords — try by site_url first, then by project_id, then by domain match
      let keywords = null;
      const { data: kw1 } = await supabase
        .from('keywords')
        .select('keyword, first_seen_at, last_seen_at')
        .eq('site_url', siteUrl)
        .order('last_seen_at', { ascending: false })
        .limit(200);

      if (kw1 && kw1.length > 0) {
        keywords = kw1;
      } else if (projectId) {
        const { data: kw2 } = await supabase
          .from('keywords')
          .select('keyword, first_seen_at, last_seen_at')
          .eq('project_id', projectId)
          .order('last_seen_at', { ascending: false })
          .limit(200);
        if (kw2 && kw2.length > 0) keywords = kw2;
      }

      if (!keywords || keywords.length === 0) {
        const { data: kwAll } = await supabase
          .from('keywords')
          .select('keyword, site_url, first_seen_at, last_seen_at')
          .order('last_seen_at', { ascending: false })
          .limit(1000);
        if (kwAll) {
          keywords = kwAll.filter(k => extractRootDomain(k.site_url) === normalizedDomain);
        }
      }

      if (keywords && keywords.length > 0) {
        gscKeywordData = keywords.map(k => k.keyword).join(', ');
      }

      // Fetch search volume data if available
      let volumes = null;
      const { data: v1 } = await supabase
        .from('search_volumes')
        .select('keyword, avg_monthly_searches, competition')
        .eq('site_url', siteUrl)
        .order('avg_monthly_searches', { ascending: false })
        .limit(100);

      if (v1 && v1.length > 0) {
        volumes = v1;
      } else {
        const { data: vAll } = await supabase
          .from('search_volumes')
          .select('keyword, avg_monthly_searches, competition, site_url')
          .order('avg_monthly_searches', { ascending: false })
          .limit(500);
        if (vAll) {
          volumes = vAll.filter(v => extractRootDomain(v.site_url) === normalizedDomain);
        }
      }

      if (volumes && volumes.length > 0) {
        searchVolumeData = volumes
          .map(v => `"${v.keyword}" (${v.avg_monthly_searches}/mo, competition: ${v.competition || 'unknown'})`)
          .join('\n');
      }

      // Fetch recent GSC performance data (clicks, impressions, position)
      // Try exact siteUrl, then match by domain
      let gscRows = null;
      const { data: gscCache } = await supabase
        .from('gsc_cache')
        .select('response_data')
        .eq('site_url', siteUrl)
        .eq('query_type', 'keywords')
        .order('fetched_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (gscCache?.response_data?.rows) {
        gscRows = gscCache.response_data.rows;
      } else {
        // Try domain-matched lookup
        const { data: allCaches } = await supabase
          .from('gsc_cache')
          .select('response_data, site_url')
          .eq('query_type', 'keywords')
          .order('fetched_date', { ascending: false })
          .limit(20);

        if (allCaches) {
          const match = allCaches.find(c => extractRootDomain(c.site_url) === normalizedDomain);
          if (match?.response_data?.rows) gscRows = match.response_data.rows;
        }
      }

      if (gscRows && gscRows.length > 0) {
        const topRows = gscRows
          .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
          .slice(0, 80);
        const gscLines = topRows.map(r => {
          const keyword = r.keys?.[0] || r.keyword || '';
          return `"${keyword}" — ${r.clicks || 0} clicks, ${r.impressions || 0} impressions, position ${(r.position || 0).toFixed(1)}`;
        });
        gscKeywordData = gscLines.join('\n');
      }
    } catch (dbErr) {
      console.error('[BlogOpps] DB fetch warning:', dbErr.message);
    }
  }

  const topicCount = seriesTheme ? (count || 5) : 15;
  const seriesContext = seriesTheme
    ? `\nSERIES THEME: This is a blog SERIES about "${seriesTheme}". Generate ${topicCount} articles that form a cohesive series, building on each other in a logical progression. Each article should be distinct but related to the overall theme.\n`
    : '';

  const userMessage = `Generate ${topicCount} high-impact blog topic ideas for this website.

WEBSITE: ${siteUrl}
${seriesContext}
BUSINESS OBJECTIVES:
${objectives || 'Not specified — analyze the website URL and keyword data to infer business model, target audience, and revenue goals.'}

${gscKeywordData ? `GOOGLE SEARCH CONSOLE DATA (keywords the site currently ranks for with performance):
${gscKeywordData}

Analyze these keywords carefully:
- What topics is the site already getting traffic for? Build on strengths.
- What related topics are MISSING? Find the gaps.
- Which keywords have high impressions but low clicks? These need dedicated content.
- Which keywords have high position (10+)? These are opportunities to create definitive content and move up.
` : 'NO GSC DATA AVAILABLE — Infer relevant keywords from the website URL and business objectives.'}

${searchVolumeData ? `SEARCH VOLUME DATA:
${searchVolumeData}
` : ''}

EXISTING BLOG TOPICS ALREADY COVERED (avoid duplicating):
${(existingTopics || []).slice(0, 50).join(', ') || 'None — this is a fresh start'}

ADDITIONAL RANKED KEYWORDS:
${(existingKeywords || []).slice(0, 100).join(', ') || 'See GSC data above'}

CRITICAL REQUIREMENTS:
1. Focus heavily on TRANSACTIONAL and DECISION-STAGE keywords — topics where ranking would directly drive leads or sales
2. Include a strategic mix across ALL buyer stages (awareness 30%, consideration 35%, decision 25%, implementation 10%)
3. Each topic MUST target a specific, realistic keyword or keyword cluster
4. Prioritize topics that fill content gaps — things the site SHOULD rank for but doesn't yet
5. Include "vs" and "alternative" comparison content where relevant
6. Include at least 2-3 topics targeting long-tail, low-competition keywords for quick wins
7. Every topic must have a clear connection to driving business revenue
8. Consider what questions potential customers ask before buying

Respond with ONLY valid JSON:
{
  "opportunities": [
    {
      "title": "<SEO-optimized blog post title that matches search intent>",
      "targetKeyword": "<exact primary keyword to target — must be a real search query>",
      "relatedKeywords": ["<3-5 related/LSI keywords>"],
      "searchVolume": "high" | "medium" | "low",
      "estimatedMonthlySearches": <realistic number estimate>,
      "difficulty": "easy" | "medium" | "hard",
      "funnelStage": "awareness" | "consideration" | "decision",
      "description": "<2-3 sentences: WHY this topic matters for the business, what search intent it captures, and how it drives revenue>",
      "contentType": "how-to" | "listicle" | "comparison" | "case-study" | "guide" | "opinion" | "data-driven" | "template" | "alternative"
    }
  ]
}`;

  try {
    console.log(`[BlogOpps] Calling Claude... (${Date.now() - startTime}ms elapsed)`);
    let raw = await callClaude(SYSTEM_PROMPT, userMessage, 8000);
    console.log(`[BlogOpps] Claude responded (${Date.now() - startTime}ms elapsed), parsing...`);
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      else {
        console.error('[BlogOpps] Unparseable response:', raw.substring(0, 500));
        throw new Error('Failed to parse AI response');
      }
    }

    const opportunities = parsed.opportunities || [];
    console.log(`[BlogOpps] Parsed ${opportunities.length} opportunities`);

    if (supabase && opportunities.length > 0) {
      const rows = opportunities.map((opp) => ({
        site_url: siteUrl,
        project_id: projectId || null,
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
      if (insertErr) {
        console.error('[BlogOpps] Insert error:', insertErr.message);
        return res.status(200).json({ opportunities, warning: 'Generated but failed to save: ' + insertErr.message });
      }
    }

    console.log(`[BlogOpps] Done (${Date.now() - startTime}ms total)`);
    return res.status(200).json({ opportunities });
  } catch (err) {
    console.error('[BlogOpps] Generation error:', err.message, err.stack);
    return res.status(500).json({ error: err.message });
  }
}
