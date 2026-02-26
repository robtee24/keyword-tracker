import { getSupabase } from '../db.js';
import { authenticateRequest } from '../_config.js';

export const config = { maxDuration: 120 };

const PLATFORM_CRITERIA = {
  instagram: 'Instagram-specific: visual quality references, carousel structure, Reel hooks (first 3 seconds), hashtag strategy (mix of sizes), bio link CTA, Story highlights usage, alt text on images, caption length and formatting, engagement CTA placement.',
  linkedin: 'LinkedIn-specific: professional tone calibration, hook line strength (first 2 lines before "see more"), carousel/document post structure, hashtag count (3-5 optimal), CTA for comments/engagement, personal vs company voice, thought leadership positioning, post length optimization.',
  x: 'X/Twitter-specific: character efficiency, thread structure and numbering, hook tweet strength, ratio of text vs media, reply-worthy content, quote-tweet potential, hashtag restraint (0-2), timing relevance, thread CTA placement.',
  facebook: 'Facebook-specific: native video preference, Group engagement tactics, shareability factors, emotional resonance, comment-driving questions, link placement (comments vs post), audience targeting signals, event/community integration.',
  tiktok: 'TikTok-specific: hook in first 1-2 seconds, trend alignment, audio/sound usage, caption overlay readability, CTA timing, duet/stitch potential, hashtag challenge relevance, video length optimization, loop-ability.',
  pinterest: 'Pinterest-specific: vertical image format (2:3 ratio), keyword-rich descriptions, SEO title optimization, board categorization, Rich Pin eligibility, seasonal relevance, link destination quality, save-worthy visual design.',
};

const AUDIT_PROMPT = (platform) => `You are an expert ${platform} social media strategist and content auditor. Analyze the provided social media posts for quality, engagement potential, and platform-specific best practices.

EVALUATE EACH POST FOR:

1. HOOK QUALITY
- Does the first line/second grab attention?
- Would someone stop scrolling for this?
- Curiosity, value, or emotion trigger present?

2. CONTENT QUALITY
- Clarity of message
- Value delivered (insight, entertainment, education)
- Originality and unique perspective
- Writing quality and voice consistency

3. ENGAGEMENT OPTIMIZATION
- Call-to-action presence and strength
- Comment-driving elements (questions, polls, debates)
- Shareability / save-worthiness
- Conversation starters

4. FORMAT & STRUCTURE
- Platform-optimal formatting
- Visual element usage
- Content length appropriateness
- Readability (short paragraphs, line breaks, bullets)

5. PLATFORM-SPECIFIC CRITERIA
${PLATFORM_CRITERIA[platform] || ''}

6. STRATEGIC ALIGNMENT
- Content pillar consistency
- Brand voice alignment
- Funnel stage targeting (awareness, consideration, conversion)
- Audience relevance

SCORING: Rate 0-100 based on overall post effectiveness for ${platform}.`;

const RESPONSE_FORMAT = `
Respond with ONLY valid JSON:
{
  "score": <number 0-100>,
  "summary": "<2-3 sentence overview of the posts' quality>",
  "strengths": ["<3-5 specific things done well>"],
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "category": "<short category>",
      "issue": "<specific problem — quote exact text or reference specific post>",
      "recommendation": "<exact fix with rewritten example>",
      "howToFix": "<step-by-step instructions>",
      "impact": "<expected improvement>"
    }
  ]
}

RULES:
- Every recommendation MUST reference a specific post or element
- Every recommendation MUST provide an exact rewrite or fix
- Return 5-15 recommendations sorted by priority
- Return 3-5 strengths`;

/**
 * Crawl a social profile page and extract post text content.
 * Falls back gracefully if the page can't be fetched.
 */
async function crawlSocialProfile(profileUrl) {
  try {
    const resp = await fetch(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEAUTOBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return null;
    const html = await resp.text();

    // Extract text content from common social page patterns
    // Remove scripts, styles, nav elements
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#\d+;/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Extract meaningful chunks (likely post content)
    const lines = cleaned.split('\n').filter(l => l.trim().length > 20);
    const content = lines.slice(0, 200).join('\n');
    return content.slice(0, 15000) || null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const { siteUrl, projectId, platform, profileUrl, posts } = req.body || {};
  if (!siteUrl || !platform) {
    return res.status(400).json({ error: 'siteUrl and platform are required' });
  }

  // Need either a profile URL to crawl or posts array
  if (!profileUrl && (!posts || !Array.isArray(posts) || posts.length === 0)) {
    return res.status(400).json({ error: 'Either profileUrl or posts array is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });

  let postsText = '';
  let auditUrls = [];

  if (profileUrl) {
    // Crawl the social profile page
    const crawledContent = await crawlSocialProfile(profileUrl);
    if (!crawledContent) {
      return res.status(200).json({
        score: 0,
        summary: `Could not fetch content from ${profileUrl}. The page may require authentication or block automated access. Try connecting your ${platform} account for API access, or paste your post content manually.`,
        strengths: [],
        recommendations: [{
          priority: 'high',
          category: 'Access',
          issue: `Unable to crawl ${profileUrl}`,
          recommendation: `Connect your ${platform} account via the Connections page to enable API-based auditing, or paste individual post content.`,
          howToFix: 'Go to Connections > Social and connect your account.',
          impact: 'Enables comprehensive content auditing with full post data.',
        }],
      });
    }
    postsText = `Content crawled from ${profileUrl}:\n\n${crawledContent}`;
    auditUrls = [profileUrl];
  } else {
    postsText = posts.map((p, i) => `--- Post ${i + 1} ---\n${p.content || p}\n`).join('\n');
    auditUrls = posts.map((p) => p.url || '');
  }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `${AUDIT_PROMPT(platform)}\n\nHere are the ${platform} posts to audit:\n\n${postsText}\n\n${RESPONSE_FORMAT}`,
        }],
      }),
    });

    const data = await resp.json();
    const text = data.content?.[0]?.text || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');

    const supabase = getSupabase();
    if (supabase && projectId) {
      await supabase.from('social_audits').insert({
        project_id: projectId,
        site_url: siteUrl,
        platform,
        urls: auditUrls,
        score: result.score || 0,
        summary: result.summary || '',
        strengths: result.strengths || [],
        recommendations: result.recommendations || [],
      });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('[SocialAudit] Error:', err.message);
    return res.status(500).json({ error: 'Audit failed: ' + err.message });
  }
}
