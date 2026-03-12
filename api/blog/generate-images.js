import { authenticateRequest } from '../_config.js';
import { generateImage } from '../_imageGen.js';
import { enforceCredits, deductCredits } from '../_credits.js';
import sharp from 'sharp';

export const config = { maxDuration: 300 };

const MODEL_COSTS = {
  'dall-e-3': 0.04,
  'gpt-image-1': 0.04,
};

function buildTextOverlaySvg(text, width, height) {
  if (!text) return null;

  const maxCharsPerLine = 35;
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length > maxCharsPerLine) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    }
  }
  if (currentLine) lines.push(currentLine.trim());

  const fontSize = Math.min(48, Math.max(28, Math.floor(width / 25)));
  const lineHeight = fontSize * 1.35;
  const blockHeight = lines.length * lineHeight + 40;
  const yStart = height - blockHeight - 40;

  const textElements = lines.map((line, i) => {
    const y = yStart + 30 + (i + 1) * lineHeight;
    const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return `<text x="${width / 2}" y="${y}" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing="0.5">${escaped}</text>`;
  }).join('\n');

  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(0,0,0,0)" />
        <stop offset="30%" stop-color="rgba(0,0,0,0)" />
        <stop offset="100%" stop-color="rgba(0,0,0,0.75)" />
      </linearGradient>
    </defs>
    <rect x="0" y="${yStart - 20}" width="${width}" height="${height - yStart + 20}" fill="url(#grad)" />
    ${textElements}
  </svg>`);
}

async function downloadImage(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to download image: ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

function isDataUrl(url) {
  return url && url.startsWith('data:');
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const { descriptions, model } = req.body || {};
  if (!descriptions || !Array.isArray(descriptions) || descriptions.length === 0) {
    return res.status(400).json({ error: 'descriptions array is required' });
  }

  const imageModel = model || 'dall-e-3';
  const maxImages = Math.min(descriptions.length, 5);
  const toGenerate = descriptions.slice(0, maxImages);

  console.log(`[BlogImages] Generating ${toGenerate.length} images with model: ${imageModel}`);

  const rawCost = MODEL_COSTS[imageModel] || 0.04;
  const creditCost = rawCost * 1.3;
  const totalEstimatedCost = creditCost * toGenerate.length;
  if (!(await enforceCredits(auth.user.id, totalEstimatedCost, res))) return;

  const results = [];
  for (let i = 0; i < toGenerate.length; i++) {
    const item = toGenerate[i];
    const desc = typeof item === 'string' ? item : item.description || '';
    const caption = typeof item === 'string' ? '' : item.caption || '';

    const prompt = `Create a premium, photorealistic blog article image. CONCEPT: ${desc}. CRITICAL RULE: DO NOT include ANY text, words, letters, numbers, logos, watermarks, or typography of any kind. The image must be completely clean of all text and writing — text will be added separately with perfect typography. STYLE: Ultra high-quality editorial photography, professional lighting, modern composition, rich colors. Leave clean space in the lower third for text overlay. Think top-tier magazine or brand campaign quality.`;

    try {
      console.log(`[BlogImages] Generating image ${i + 1}/${toGenerate.length}`);
      const { imageUrl } = await generateImage(prompt, { model: imageModel, size: '1792x1024' });

      await deductCredits(auth.user.id, creditCost, imageModel, `Blog image ${i + 1}/${toGenerate.length}`);

      if (caption) {
        try {
          console.log(`[BlogImages] Compositing text onto image ${i + 1}`);
          const imgBuffer = isDataUrl(imageUrl)
            ? Buffer.from(imageUrl.split(',')[1], 'base64')
            : await downloadImage(imageUrl);

          const metadata = await sharp(imgBuffer).metadata();
          const w = metadata.width || 1792;
          const h = metadata.height || 1024;

          const overlaySvg = buildTextOverlaySvg(caption, w, h);
          const composited = await sharp(imgBuffer)
            .composite([{ input: overlaySvg, top: 0, left: 0 }])
            .jpeg({ quality: 90 })
            .toBuffer();

          const b64 = composited.toString('base64');
          const dataUrl = `data:image/jpeg;base64,${b64}`;
          console.log(`[BlogImages] Image ${i + 1} composited successfully`);
          results.push({ description: desc, caption, imageUrl: dataUrl });
        } catch (compErr) {
          console.warn(`[BlogImages] Text composite failed, using original:`, compErr.message);
          results.push({ description: desc, caption, imageUrl });
        }
      } else {
        results.push({ description: desc, caption, imageUrl });
      }
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
