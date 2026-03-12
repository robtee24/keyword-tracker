import { authenticateRequest } from '../_config.js';
import { deductCredits } from '../_credits.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });

  const { siteUrl, keywords, projectId } = req.body || {};
  if (!keywords) return res.status(400).json({ error: 'keywords are required' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Generate a compelling blog article brief/outline for the following keyword(s): "${keywords}"

Website: ${siteUrl || 'Not specified'}

Create a detailed article title and description that would:
1. Target these keywords effectively
2. Provide genuine value to readers
3. Have strong search intent alignment
4. Be comprehensive enough for a 2000-3000 word article

Respond with a single paragraph (3-5 sentences) that describes the article topic, angle, key points to cover, and target audience. This will be used as the prompt to generate the full article. Do NOT use JSON — just return the plain text description.`,
        }],
      }),
    });

    if (!response.ok) throw new Error(`Claude API error (${response.status})`);

    const data = await response.json();
    const brief = data.content?.[0]?.text || '';

    await deductCredits(auth.user.id, 0.008 * 1.3, 'claude-sonnet-4', 'Blog brief generation', projectId || null);
    return res.status(200).json({ brief });
  } catch (err) {
    console.error('[BlogBrief] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
