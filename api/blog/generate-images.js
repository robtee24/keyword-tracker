import { authenticateRequest } from '../_config.js';

export const config = { maxDuration: 120 };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });

  const { descriptions } = req.body || {};
  if (!descriptions || !Array.isArray(descriptions) || descriptions.length === 0) {
    return res.status(400).json({ error: 'descriptions array is required' });
  }

  const maxImages = Math.min(descriptions.length, 5);
  const toGenerate = descriptions.slice(0, maxImages);

  const results = [];
  for (const desc of toGenerate) {
    const prompt = `Professional, high-quality blog header image: ${desc}. Clean modern style, suitable for a professional blog article. No text or watermarks.`;
    try {
      const resp = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt,
          n: 1,
          size: '1792x1024',
          quality: 'standard',
          style: 'natural',
          response_format: 'url',
        }),
      });

      if (!resp.ok) {
        results.push({ description: desc, error: `Failed (${resp.status})`, imageUrl: null });
        continue;
      }

      const data = await resp.json();
      const url = data.data?.[0]?.url;
      results.push({ description: desc, imageUrl: url || null, revisedPrompt: data.data?.[0]?.revised_prompt || '' });
    } catch (err) {
      results.push({ description: desc, error: err.message, imageUrl: null });
    }
  }

  return res.status(200).json({ images: results });
}
