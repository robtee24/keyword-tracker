import { getSupabase } from '../db.js';
import { authenticateRequest } from '../_config.js';
import { extractRootDomain } from '../_domainMatch.js';

export const config = { maxDuration: 120 };

async function callClaude(systemPrompt, userMessage) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => 'unknown');
      throw new Error(`Claude API error (${response.status}): ${detail}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  } finally {
    clearTimeout(timeout);
  }
}

const SYSTEM_PROMPT = `You are an elite content strategist and SEO specialist who finds blog topics that drive qualified traffic and convert visitors into customers.

PRINCIPLES:
1. SEARCHABLE > SHAREABLE — Prioritize capturing existing search demand.
2. BUYER STAGES — Mix awareness (30%), consideration (35%), decision (25%), implementation (10%).
3. TRANSACTIONAL FOCUS — Prioritize topics where ranking drives revenue directly.
4. CONTENT TYPES — how-to, listicle, comparison, case-study, guide, template, alternative.
5. QUICK WINS — Low competition + decent volume + high relevance.
6. CONTENT GAPS — Keywords the site should rank for but doesn't yet.

Respond ONLY with valid JSON. No markdown, no code fences.`;

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

  let gscKeywordData = '';
  let searchVolumeData = '';
  const normalizedDomain = extractRootDomain(siteUrl);

  if (supabase) {
    try {
      const dbPromises = [];

      const kwQuery = supabase
        .from('keywords')
        .select('keyword')
        .eq('site_url', siteUrl)
        .order('last_seen_at', { ascending: false })
        .limit(100);
      dbPromises.push(kwQuery);

      dbPromises.push(
        supabase
          .from('search_volumes')
          .select('keyword, avg_monthly_searches, competition')
          .eq('site_url', siteUrl)
          .order('avg_monthly_searches', { ascending: false })
          .limit(50)
      );

      dbPromises.push(
        supabase
          .from('gsc_cache')
          .select('response_data')
          .eq('site_url', siteUrl)
          .eq('query_type', 'keywords')
          .order('fetched_date', { ascending: false })
          .limit(1)
          .maybeSingle()
      );

      const [kwResult, volResult, gscResult] = await Promise.all(dbPromises);

      if (kwResult.data?.length > 0) {
        gscKeywordData = kwResult.data.map(k => k.keyword).join(', ');
      }

      if (volResult.data?.length > 0) {
        searchVolumeData = volResult.data
          .map(v => `"${v.keyword}" (${v.avg_monthly_searches}/mo, ${v.competition || '?'})`)
          .join('\n');
      }

      const gscRows = gscResult.data?.response_data?.rows;
      if (gscRows?.length > 0) {
        const topRows = gscRows
          .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
          .slice(0, 50);
        gscKeywordData = topRows.map(r => {
          const kw = r.keys?.[0] || r.keyword || '';
          return `"${kw}" — ${r.clicks || 0} clicks, ${r.impressions || 0} impr, pos ${(r.position || 0).toFixed(1)}`;
        }).join('\n');
      }

      console.log(`[BlogOpps] DB done (${Date.now() - startTime}ms) — ${kwResult.data?.length || 0} kw, ${volResult.data?.length || 0} vol`);
    } catch (dbErr) {
      console.error('[BlogOpps] DB warning:', dbErr.message);
    }
  }

  const topicCount = seriesTheme ? (count || 5) : 10;
  const seriesLine = seriesTheme
    ? `\nSERIES: "${seriesTheme}" — generate ${topicCount} articles forming a cohesive progression.\n`
    : '';

  const userMessage = `Generate ${topicCount} blog topic ideas for ${siteUrl}.
${seriesLine}
OBJECTIVES: ${objectives || 'Infer from URL and keywords.'}

${gscKeywordData ? `GSC KEYWORDS:\n${gscKeywordData}` : 'No GSC data — infer from URL.'}
${searchVolumeData ? `\nSEARCH VOLUMES:\n${searchVolumeData}` : ''}
${(existingTopics || []).length > 0 ? `\nALREADY COVERED (avoid): ${existingTopics.slice(0, 30).join(', ')}` : ''}

Return JSON: {"opportunities":[{"title":"...","targetKeyword":"...","relatedKeywords":["..."],"searchVolume":"high|medium|low","estimatedMonthlySearches":0,"difficulty":"easy|medium|hard","funnelStage":"awareness|consideration|decision","description":"...","contentType":"how-to|listicle|comparison|case-study|guide|template|alternative"}]}`;

  try {
    console.log(`[BlogOpps] Calling Claude... (${Date.now() - startTime}ms elapsed)`);
    let raw = await callClaude(SYSTEM_PROMPT, userMessage);
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

    const batchId = crypto.randomUUID();

    const now = new Date().toISOString();

    if (supabase && opportunities.length > 0) {
      const { error: tableErr } = await supabase.from('blog_opportunities').select('id').limit(1);
      if (tableErr) {
        console.error('[BlogOpps] Table not accessible:', tableErr.message);
        const fallback = opportunities.map((opp) => ({ ...opp, created_at: now, batch_id: batchId }));
        return res.status(200).json({
          opportunities: fallback,
          batchId,
          warning: `Ideas generated but the blog_opportunities table is not accessible: ${tableErr.message}. Run migration 007_blog_opportunities.sql in Supabase SQL Editor.`,
        });
      }

      const fullRow = (opp) => ({
        site_url: siteUrl, project_id: projectId || null, batch_id: batchId,
        title: opp.title, target_keyword: opp.targetKeyword,
        related_keywords: opp.relatedKeywords || [], search_volume: opp.searchVolume || 'medium',
        estimated_searches: opp.estimatedMonthlySearches || 0, difficulty: opp.difficulty || 'medium',
        funnel_stage: opp.funnelStage || 'awareness', description: opp.description || '',
        content_type: opp.contentType || 'guide', status: 'pending', created_at: now,
      });

      const coreRow = (opp) => ({
        site_url: siteUrl, project_id: projectId || null,
        title: opp.title, target_keyword: opp.targetKeyword || '',
        description: opp.description || '', status: 'pending', created_at: now,
      });

      const minRow = (opp) => ({
        site_url: siteUrl, project_id: projectId || null,
        title: opp.title, status: 'pending', created_at: now,
      });

      let inserted = null;
      const errors = [];

      for (const [label, mapper] of [['full', fullRow], ['core', coreRow], ['minimal', minRow]]) {
        console.log(`[BlogOpps] Attempting ${label} batch insert...`);
        const result = await supabase.from('blog_opportunities').insert(opportunities.map(mapper)).select();
        if (!result.error && result.data?.length > 0) {
          inserted = result.data;
          console.log(`[BlogOpps] ${label} batch insert succeeded: ${inserted.length} rows`);
          break;
        }
        const errMsg = result.error?.message || `returned ${result.data?.length || 0} rows`;
        errors.push(`${label}: ${errMsg}`);
        console.warn(`[BlogOpps] ${label} batch insert failed:`, errMsg);
      }

      if (!inserted) {
        console.warn('[BlogOpps] All batch inserts failed — trying one-by-one with minimal columns');
        const singles = [];
        for (const opp of opportunities) {
          const { data: d, error: e } = await supabase.from('blog_opportunities').insert(minRow(opp)).select().single();
          if (!e && d) singles.push(d);
          else console.error('[BlogOpps] Single insert failed for:', opp.title, e?.message);
        }
        if (singles.length > 0) {
          inserted = singles;
          console.log(`[BlogOpps] Single insert succeeded: ${inserted.length}/${opportunities.length} rows`);
        }
      }

      if (!inserted || inserted.length === 0) {
        console.error('[BlogOpps] ALL insert attempts failed:', errors.join(' | '));
        const fallback = opportunities.map((opp) => ({ ...opp, created_at: now, batch_id: batchId }));
        return res.status(200).json({
          opportunities: fallback,
          batchId,
          warning: `Ideas generated but could not be saved to database (${errors[0] || 'unknown error'}). Use "Retry Save" to try again.`,
        });
      }

      console.log(`[BlogOpps] Saved ${inserted.length} opportunities (${Date.now() - startTime}ms total)`);
      return res.status(200).json({ opportunities: inserted, batchId });
    }

    console.log(`[BlogOpps] Done (${Date.now() - startTime}ms total)`);
    const withDates = opportunities.map((opp) => ({ ...opp, created_at: now, batch_id: batchId }));
    return res.status(200).json({ opportunities: withDates, batchId });
  } catch (err) {
    console.error('[BlogOpps] Generation error:', err.message, err.stack);
    return res.status(500).json({ error: err.message });
  }
}
