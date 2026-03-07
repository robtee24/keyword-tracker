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

  const maxImages = Math.min(descriptions.length, 3);
  const toGenerate = descriptions.slice(0, maxImages);

  console.log(`[BlogImages] Generating ${toGenerate.length} images`);

  const results = [];
  for (let i = 0; i < toGenerate.length; i++) {
    const item = toGenerate[i];
    const desc = typeof item === 'string' ? item : item.description || '';
    const caption = typeof item === 'string' ? '' : item.caption || '';

    const prompt = `Create a premium, photorealistic blog article image. CONCEPT: ${desc}. CRITICAL: DO NOT include ANY text, words, letters, numbers, logos, watermarks, or typography of any kind. The image must be completely clean of all text and writing. STYLE: Ultra high-quality editorial photography, professional lighting, modern composition, rich colors, shallow depth of field where appropriate. Think top-tier magazine or brand campaign quality.`;

    try {
      console.log(`[BlogImages] Generating image ${i + 1}/${toGenerate.length}`);
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
          quality: 'hd',
          style: 'natural',
          response_format: 'url',
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => 'unknown');
        console.error(`[BlogImages] DALL-E error (${resp.status}):`, errText);
        results.push({ description: desc, caption, error: `DALL-E error (${resp.status})`, imageUrl: null });
        continue;
      }

      const data = await resp.json();
      const url = data.data?.[0]?.url;
      if (!url) {
        console.error('[BlogImages] No URL in response:', JSON.stringify(data).substring(0, 200));
        results.push({ description: desc, caption, error: 'No image URL returned', imageUrl: null });
        continue;
      }

      console.log(`[BlogImages] Image ${i + 1} generated successfully`);
      results.push({ description: desc, caption, imageUrl: url });
    } catch (err) {
      console.error(`[BlogImages] Image ${i + 1} error:`, err.message);
      results.push({ description: desc, caption, error: err.message, imageUrl: null });
    }
  }

  const successCount = results.filter(r => r.imageUrl).length;
  const errorCount = results.filter(r => !r.imageUrl).length;
  console.log(`[BlogImages] Done: ${successCount} success, ${errorCount} errors`);

  return res.status(200).json({
    images: results,
    errors: errorCount > 0 ? results.filter(r => !r.imageUrl).map(r => r.error) : undefined,
  });
}
