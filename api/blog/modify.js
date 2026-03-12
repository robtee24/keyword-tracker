import { getSupabase } from '../db.js';
import { authenticateRequest } from '../_config.js';
import { deductCredits } from '../_credits.js';

export const config = { maxDuration: 120 };

async function callClaude(systemPrompt, userMessage, maxTokens = 16000) {
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

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const { articleId, currentContent, currentTitle, modifyPrompt, projectId } = req.body || {};
  if (!articleId || !currentContent || !modifyPrompt) {
    return res.status(400).json({ error: 'articleId, currentContent, and modifyPrompt are required' });
  }

  const systemPrompt = `You are an expert content editor. The user has an existing blog article and wants specific modifications. Apply the requested changes while maintaining the article's quality, voice, and SEO optimization. Return the FULL modified article, not just the changed parts.`;

  const userMessage = `Here is the current blog article:

TITLE: ${currentTitle}

CONTENT:
${currentContent}

MODIFICATION REQUEST:
${modifyPrompt}

Apply the requested modifications to the article. Maintain the same markdown formatting, heading structure, and overall quality.

Respond with ONLY valid JSON:
{
  "title": "<article title — keep the same unless the modification specifically asks to change it>",
  "content": "<the full modified article in markdown format>",
  "wordCount": <number>,
  "changesSummary": "<1-2 sentence summary of what was changed>"
}`;

  try {
    let raw = await callClaude(systemPrompt, userMessage, 16000);
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
      else throw new Error('Failed to parse AI response');
    }

    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const { data: updated, error } = await supabase
      .from('blog_articles')
      .update({
        title: result.title || currentTitle,
        content: result.content || currentContent,
        previous_content: currentContent,
        word_count: result.wordCount || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', articleId)
      .select()
      .single();

    if (error) {
      console.error('[BlogModify] Update error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    await deductCredits(auth.user.id, 0.03 * 1.3, 'claude-sonnet-4', 'Blog article modification', projectId || null);
    return res.status(200).json({ article: updated, changesSummary: result.changesSummary });
  } catch (err) {
    console.error('[BlogModify] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
