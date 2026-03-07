import { getSupabase } from '../db.js';
import { authenticateRequest } from '../_config.js';

export const config = { maxDuration: 120 };

async function fetchHtml(url) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'SEAUTO-BrandBot/1.0', Accept: 'text/html' },
    signal: AbortSignal.timeout(15000),
    redirect: 'follow',
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.text();
}

function extractAttr(str, attr) {
  const m = str.match(new RegExp(`${attr}=["']([^"']*)["']`, 'i'));
  return m ? m[1] : '';
}

function extractMeta(html, name) {
  const m = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, 'i'));
  return m ? m[1].trim() : '';
}

function extractOgTag(html, prop) {
  const m = html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']*)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:${prop}["']`, 'i'));
  return m ? m[1].trim() : '';
}

function extractLogos(html, baseUrl) {
  const logos = [];
  const seen = new Set();

  const headerMatch = html.match(/<header[\s\S]*?<\/header>/i) || html.match(/<nav[\s\S]*?<\/nav>/i);
  const headerHtml = headerMatch ? headerMatch[0] : html.slice(0, Math.min(html.length, 5000));

  const imgRegex = /<img([^>]*)>/gi;
  let m;
  while ((m = imgRegex.exec(headerHtml)) !== null) {
    const attrs = m[1];
    const src = extractAttr(attrs, 'src') || extractAttr(attrs, 'data-src');
    const alt = extractAttr(attrs, 'alt') || '';
    const cls = extractAttr(attrs, 'class') || '';
    const id = extractAttr(attrs, 'id') || '';
    if (!src) continue;

    const isLogo = /logo/i.test(cls) || /logo/i.test(id) || /logo/i.test(alt) || /logo/i.test(src);
    if (!isLogo && logos.length > 0) continue;

    try {
      const fullUrl = new URL(src, baseUrl).href;
      if (!seen.has(fullUrl)) {
        seen.add(fullUrl);
        logos.push({ url: fullUrl, alt, type: logos.length === 0 ? 'primary' : 'secondary' });
      }
    } catch { /* skip bad urls */ }
  }

  const faviconMatch = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]+href=["']([^"']*)["']/i);
  if (faviconMatch) {
    try {
      const faviconUrl = new URL(faviconMatch[1], baseUrl).href;
      if (!seen.has(faviconUrl)) {
        logos.push({ url: faviconUrl, alt: 'Favicon', type: 'icon' });
      }
    } catch { /* skip */ }
  }

  return logos;
}

function extractStyleData(html) {
  const inlineStyles = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  while ((styleMatch = styleRegex.exec(html)) !== null) {
    inlineStyles.push(styleMatch[1]);
  }
  const allCss = inlineStyles.join('\n');

  const colorMatches = allCss.match(/(?:color|background(?:-color)?)\s*:\s*([^;}\n]+)/gi) || [];
  const colors = [...new Set(colorMatches.map(c => c.trim()))].slice(0, 30);

  const fontMatches = allCss.match(/font-family\s*:\s*([^;}\n]+)/gi) || [];
  const fonts = [...new Set(fontMatches.map(f => f.trim()))].slice(0, 10);

  const googleFontMatch = html.match(/fonts\.googleapis\.com\/css2?\?family=([^"'&]+)/i);
  const googleFonts = googleFontMatch ? decodeURIComponent(googleFontMatch[1]) : '';

  const cssVars = allCss.match(/--[a-zA-Z0-9-]+\s*:\s*[^;]+/g) || [];
  const borderRadius = [...new Set((allCss.match(/border-radius\s*:\s*([^;}\n]+)/gi) || []).map(s => s.trim()))].slice(0, 10);
  const shadows = [...new Set((allCss.match(/box-shadow\s*:\s*([^;}\n]+)/gi) || []).map(s => s.trim()))].slice(0, 5);
  const buttonStyles = (allCss.match(/\.btn[^{]*\{[^}]+\}/gi) || allCss.match(/button[^{]*\{[^}]+\}/gi) || []).slice(0, 5);
  const transitions = [...new Set((allCss.match(/transition\s*:\s*([^;}\n]+)/gi) || []).map(s => s.trim()))].slice(0, 5);

  return { colors, fonts, googleFonts, cssVariables: cssVars.slice(0, 30), borderRadius, shadows, buttonStyles, transitions };
}

function extractHeadings(html) {
  const headings = [];
  const regex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text) headings.push({ level: match[1].toUpperCase(), text });
  }
  return headings.slice(0, 30);
}

function extractBodyText(html) {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  return text.replace(/\s+/g, ' ').trim().slice(0, 3000);
}

async function callClaude(systemPrompt, userMessage, maxTokens = 8000) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);

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
    signal: controller.signal,
  });

  clearTimeout(timer);
  if (!response.ok) {
    const detail = await response.text().catch(() => 'unknown');
    throw new Error(`Claude API error (${response.status}): ${detail}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

const BRAND_SYSTEM_PROMPT = `You are a brand identity analyst. Given raw data extracted from a website's homepage (HTML content, CSS styles, headings, images), you analyze and structure the brand's visual identity and voice.

Return ONLY valid JSON with this exact structure:
{
  "brand_style": "<1-2 sentence overall brand style description, e.g. 'Modern minimalist with bold sans-serif typography and a blue-dominant palette conveying trust and professionalism'>",
  "fonts": {
    "heading": { "family": "<font family name>", "weight": "<e.g. 700, bold>", "style": "<normal or italic>" },
    "body": { "family": "<font family name>", "weight": "<e.g. 400, normal>", "style": "<normal or italic>" },
    "other": ["<any additional fonts detected>"]
  },
  "font_styling": {
    "headingCase": "<uppercase | capitalize | lowercase | none>",
    "letterSpacing": "<e.g. 0.05em, normal>",
    "lineHeight": "<e.g. 1.5, 1.6>"
  },
  "colors": [
    { "hex": "#XXXXXX", "name": "<descriptive name>", "role": "<primary | secondary | accent | background | text | border>" }
  ],
  "tagline": "<the site's tagline if found, or null>",
  "mission_statement": "<a professional mission statement generated from the site's content and apparent purpose — 1-2 sentences>",
  "button_styles": [
    { "css": "<key CSS properties as a string, e.g. 'background: #2563eb; color: white; border-radius: 8px; padding: 12px 24px; font-weight: 600'>", "label": "<e.g. Get Started>", "variant": "<primary | secondary | outline>" }
  ],
  "spacing": {
    "borderRadius": "<most common border-radius, e.g. 8px>",
    "shadows": "<most common box-shadow, or 'none'>",
    "padding": "<typical section padding pattern>"
  },
  "voice_and_tone": "<2-3 sentence description of the brand's voice and tone based on the copy>"
}

RULES:
- Extract 5-10 colors maximum, normalized to hex codes. Always include at least: primary brand color, text color, background color.
- If Google Fonts are detected, use those font names. Otherwise infer from CSS font-family declarations.
- For button_styles, describe 1-3 button variants found (primary CTA, secondary, outline/ghost).
- The mission_statement should sound professional and authentic to the brand — not generic.
- Detect heading capitalization by examining the actual heading text provided.
- Be specific with color names (e.g. "Deep Navy" not just "Blue").`;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateRequest(req);
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const { siteUrl, projectId, generateColors, currentColors } = req.body || {};
  if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required' });

  if (generateColors && currentColors) {
    return handleGenerateColors(res, currentColors);
  }

  if (!projectId) return res.status(400).json({ error: 'projectId is required' });

  try {
    const baseUrl = siteUrl.endsWith('/') ? siteUrl : siteUrl + '/';
    const html = await fetchHtml(baseUrl);

    const styles = extractStyleData(html);
    const logos = extractLogos(html, baseUrl);
    const headings = extractHeadings(html);
    const bodyText = extractBodyText(html);
    const metaDesc = extractMeta(html, 'description');
    const ogDesc = extractOgTag(html, 'description');
    const ogImage = extractOgTag(html, 'image');
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || '';

    if (ogImage && logos.length === 0) {
      logos.push({ url: ogImage, alt: 'OG Image', type: 'primary' });
    }

    const crawlSummary = `
SITE: ${siteUrl}
PAGE TITLE: ${title}
META DESCRIPTION: ${metaDesc}
OG DESCRIPTION: ${ogDesc}

HEADINGS:
${headings.map(h => `${h.level}: ${h.text}`).join('\n')}

BODY TEXT (first 2000 chars):
${bodyText.slice(0, 2000)}

CSS FONTS: ${styles.fonts.join(', ') || 'none detected'}
GOOGLE FONTS: ${styles.googleFonts || 'none'}
CSS COLORS: ${styles.colors.join(', ') || 'none detected'}
CSS VARIABLES: ${styles.cssVariables.slice(0, 15).join(', ') || 'none'}
BUTTON CSS: ${styles.buttonStyles.join('\n') || 'none detected'}
BORDER RADIUS: ${styles.borderRadius.join(', ') || 'none'}
SHADOWS: ${styles.shadows.join(', ') || 'none'}
TRANSITIONS: ${styles.transitions.join(', ') || 'none'}
LOGO URLs: ${logos.map(l => l.url).join(', ') || 'none found'}`;

    let raw = await callClaude(BRAND_SYSTEM_PROMPT, `Analyze this website's brand identity:\n\n${crawlSummary}`);
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let analysis;
    try {
      analysis = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) analysis = JSON.parse(jsonMatch[0]);
      else throw new Error('Failed to parse AI brand analysis');
    }

    const profile = {
      project_id: projectId,
      site_url: siteUrl,
      brand_style: analysis.brand_style || '',
      logos: logos.length > 0 ? logos : [],
      fonts: analysis.fonts || {},
      font_styling: analysis.font_styling || {},
      colors: analysis.colors || [],
      tagline: analysis.tagline || null,
      mission_statement: analysis.mission_statement || '',
      button_styles: analysis.button_styles || [],
      spacing: analysis.spacing || {},
      voice_and_tone: analysis.voice_and_tone || '',
      raw_crawl_data: { styles, headings: headings.slice(0, 10), title, metaDesc },
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (supabase) {
      const { data: existing } = await supabase
        .from('brand_profiles')
        .select('id')
        .eq('project_id', projectId)
        .maybeSingle();

      if (existing) {
        await supabase.from('brand_profiles').update(profile).eq('project_id', projectId);
      } else {
        await supabase.from('brand_profiles').insert(profile);
      }
    }

    return res.status(200).json({ profile });
  } catch (err) {
    console.error('[BrandCrawl] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function handleGenerateColors(res, currentColors) {
  try {
    const colorList = currentColors.map(c => `${c.hex} (${c.name || c.role})`).join(', ');
    const raw = await callClaude(
      'You are a color theory expert. Generate complementary colors that match a given palette. Return ONLY a JSON array of color objects.',
      `Given this brand color palette: ${colorList}

Generate 4-5 additional complementary colors that would work well with this palette. Consider:
- A lighter tint for backgrounds/cards
- A darker shade for hover states
- An accent that complements without clashing
- A subtle neutral for borders/dividers

Return ONLY a JSON array:
[{ "hex": "#XXXXXX", "name": "<descriptive name>", "role": "<accent | background | hover | border | highlight>" }]`
    );

    let cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    let colors;
    try {
      colors = JSON.parse(cleaned);
    } catch {
      const arrMatch = cleaned.match(/\[[\s\S]*\]/);
      if (arrMatch) colors = JSON.parse(arrMatch[0]);
      else throw new Error('Failed to parse generated colors');
    }

    return res.status(200).json({ colors });
  } catch (err) {
    console.error('[BrandCrawl] Color generation error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
