import { getSupabase } from '../db.js';

export const config = { maxDuration: 60 };

const AD_AUDIT_PROMPTS = {
  google: `You are an expert Google Ads auditor. Analyze the provided Google Ads campaign/account data (CSV export) and provide specific, actionable recommendations.

EVALUATE:
- Wasted spend: keywords with high spend and zero/low conversions
- Negative keyword gaps: irrelevant search terms consuming budget
- Quality Score issues: expected CTR, ad relevance, landing page experience
- Bid strategy alignment: does the strategy match campaign goals and conversion volume?
- Account structure: ad group themes, keyword count per ad group
- Ad extensions: missing sitelinks, callouts, structured snippets
- Keyword cannibalization: campaigns competing against each other
- Search term mining: high-intent terms not being bid on
- Match type optimization: broad vs phrase vs exact distribution
- Impression share and competitive positioning

THRESHOLDS:
- Non-brand QS target ≥7, red flag <5
- Brand QS target 10, red flag <8
- CTR target ≥1.5%, red flag <1%
- Conversion Rate target ≥8%, red flag <3%
- Keywords with 50+ clicks and 0 conversions → flag for pause

Every recommendation must reference specific data from the export. No generic advice.`,

  meta: `You are an expert Meta/Facebook/Instagram Ads auditor. Analyze the provided Meta Ads data and provide specific, actionable recommendations.

EVALUATE:
- Creative fatigue: frequency >3-4, CTR declining >15-20% over 7 days, CPM rising >30-40%
- Audience overlap: ad sets cannibalizing each other (>30% overlap = consolidate)
- Tracking health: pixel/CAPI configuration, event match quality
- Campaign structure: Advantage+ vs Manual appropriateness
- Budget distribution: campaigns under/overspending relative to performance
- Ad format performance: which formats are underperforming
- Retargeting windows: are conversion windows optimized
- Frequency capping: are users oversaturated
- Creative variants: are winning patterns being replicated

Every recommendation must reference specific data from the export. No generic advice.`,

  linkedin: `You are an expert LinkedIn Ads auditor specializing in B2B campaigns. Analyze the provided LinkedIn Ads data.

EVALUATE:
- CTR benchmarks: LinkedIn average is 0.4-0.6% for sponsored content
- Audience quality: job titles, company sizes, seniority targeting
- Lead gen form friction: number of fields, completion rates
- Budget efficiency: cost per lead vs industry benchmarks ($50-150 B2B)
- Campaign objective alignment: awareness vs consideration vs conversion
- Content format performance: single image, carousel, video, document ads
- Audience size: too narrow (<50K) or too broad (>500K) for objective
- Bid strategy: manual CPC vs automated delivery optimization

Every recommendation must reference specific data from the export. No generic advice.`,

  reddit: `You are an expert Reddit Ads auditor. Analyze the provided Reddit Ads campaign data.

EVALUATE:
- Community targeting: subreddit relevance, community size, engagement rates
- Creative fit: does ad copy/creative match Reddit's authentic tone
- Bid efficiency: CPC/CPM relative to performance
- Interest vs community targeting: which approach works better
- Ad format performance: promoted posts, conversation ads, video
- Conversion tracking: pixel placement, attribution windows
- Frequency: are users seeing the same ad too often
- Dayparting opportunities: when does the target audience browse Reddit

Every recommendation must reference specific data from the export. No generic advice.`,

  budget: `You are an expert in cross-channel advertising budget optimization. Analyze the provided multi-channel spend data.

EVALUATE:
- Channel-level ROAS/CPA comparison
- Marginal returns: where is the next dollar most efficient
- Wasted spend across all channels: campaigns/ad sets with zero or negative ROI
- Budget pacing: are campaigns underspending or overspending
- Seasonal patterns: should budgets shift based on historical patterns
- Channel mix optimization: optimal allocation across Google, Meta, LinkedIn, etc.
- Budget scenario modeling: what happens at +/- 20% total budget
- Diminishing returns curve: identify inflection points per channel

Every recommendation must reference specific data from the export. No generic advice.`,

  performance: `You are an expert in advertising performance diagnostics. Analyze the provided campaign performance data.

EVALUATE:
- CPA spike diagnosis: isolate what caused cost increases (creative, audience, competition)
- Anomaly detection: unusual CPC spikes, CVR drops, spend surges, impression drops
- Day/hour performance: when do ads perform best/worst, scheduling optimization
- Geographic performance: underperforming geos eating budget, high-performing ones underfunded
- Device performance: mobile vs desktop vs tablet splits and bid adjustments
- Landing page conversion rates by campaign/ad group
- Funnel drop-off points: click → landing page → form/cart → conversion

Every recommendation must reference specific data from the export. No generic advice.`,

  creative: `You are an expert in advertising creative and landing page optimization. Analyze the provided ad copy and landing page data.

EVALUATE:
- Ad copy performance: which headlines, descriptions, and CTAs perform best
- Creative fatigue signals: declining CTR/engagement over time
- Ad copy variants: are winning patterns being replicated with enough variation
- Landing page alignment: does the ad promise match the landing page delivery
- Landing page conversion optimization: hero section, CTAs, trust signals, form friction
- A/B test opportunities: what should be tested next based on current data
- Creative diversity: are enough formats and angles being tested

Every recommendation must reference specific data from the export. No generic advice.`,

  attribution: `You are an expert in advertising attribution and tracking. Analyze the provided attribution/tracking data.

EVALUATE:
- Attribution model comparison: last-click vs first-click vs linear vs time-decay
- Conversion path analysis: average touchpoints before conversion
- Cross-channel attribution: which campaigns assist vs close
- Tracking coverage: are all conversion events being captured
- UTM consistency: are UTM parameters properly standardized
- Conversion lag: how long from first click to conversion by channel
- View-through vs click-through: is view-through inflating results
- Data discrepancies: platform reporting vs analytics differences

Every recommendation must reference specific data from the export. No generic advice.`,

  structure: `You are an expert in advertising account structure and organization. Analyze the provided account structure data.

EVALUATE:
- Campaign segmentation: are campaigns properly split by objective, funnel stage, product
- Over-segmentation: too many campaigns/ad sets fragmenting data and budget
- Under-segmentation: dissimilar targeting/products lumped together hiding performance
- Naming conventions: are campaigns, ad sets, and ads consistently named
- Budget allocation: is budget distributed according to priority and performance
- Consolidation opportunities: which campaigns/ad sets should be merged
- Algorithmic delivery: do campaigns have enough conversion volume for automated bidding

Every recommendation must reference specific data from the export. No generic advice.`,
};

async function runAdAudit(openaiKey, csvData, auditType, fileName) {
  const prompt = AD_AUDIT_PROMPTS[auditType];
  if (!prompt) throw new Error(`Unknown ad audit type: ${auditType}`);

  const truncatedData = csvData.length > 15000 ? csvData.slice(0, 15000) + '\n... [data truncated]' : csvData;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: `Analyze this advertising data export (file: ${fileName}):\n\n${truncatedData}\n\nReturn a JSON object with this exact structure (no markdown, no code fences):\n{\n  "score": <number 0-100>,\n  "summary": "<2-3 sentence overview>",\n  "strengths": ["<strength 1>", "<strength 2>", ...],\n  "recommendations": [\n    {\n      "priority": "high"|"medium"|"low",\n      "category": "<category>",\n      "issue": "<specific problem found in the data>",\n      "recommendation": "<exact what to do>",\n      "howToFix": "<step-by-step instructions>",\n      "impact": "<estimated impact>"\n    }\n  ]\n}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  let content = data.choices?.[0]?.message?.content || '';
  content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try {
    return JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
    }
    return { score: 0, summary: 'Failed to parse audit results.', strengths: [], recommendations: [] };
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return res.status(500).json({ error: 'OpenAI API key not configured' });

  const { siteUrl, auditType, fileName, csvData } = req.body || {};
  if (!siteUrl || !auditType || !csvData) {
    return res.status(400).json({ error: 'Missing required fields: siteUrl, auditType, csvData' });
  }

  const validTypes = Object.keys(AD_AUDIT_PROMPTS);
  if (!validTypes.includes(auditType)) {
    return res.status(400).json({ error: `Invalid auditType. Must be one of: ${validTypes.join(', ')}` });
  }

  try {
    const result = await runAdAudit(openaiKey, csvData, auditType, fileName || 'export.csv');

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error: delErr } = await supabase
          .from('page_audits')
          .delete()
          .eq('site_url', siteUrl)
          .eq('page_url', fileName || 'export.csv')
          .eq('audit_type', `ad-${auditType}`);
        if (delErr) console.error('Delete old ad audit error:', delErr);

        const { error: insErr } = await supabase
          .from('page_audits')
          .insert({
            site_url: siteUrl,
            page_url: fileName || 'export.csv',
            audit_type: `ad-${auditType}`,
            score: result.score || 0,
            summary: result.summary || '',
            strengths: result.strengths || [],
            recommendations: result.recommendations || [],
          });
        if (insErr) console.error('Insert ad audit error:', insErr);
      } catch (dbErr) {
        console.error('DB save error:', dbErr);
      }
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Ad audit error:', err);
    return res.status(500).json({ error: err.message || 'Audit failed' });
  }
}
