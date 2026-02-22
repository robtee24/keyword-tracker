export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { pageUrl, siteUrl } = req.body || {};
  if (!pageUrl) return res.status(400).json({ error: 'pageUrl is required' });

  try {
    const startTime = Date.now();
    const html = await fetchHtml(pageUrl);
    const fetchMs = Date.now() - startTime;

    const crawl = {
      url: pageUrl,
      fetchTimeMs: fetchMs,
      htmlSize: html.length,

      title: extractTag(html, 'title'),
      metaDescription: extractMeta(html, 'description'),
      metaKeywords: extractMeta(html, 'keywords'),
      canonical: extractCanonical(html),
      robots: extractMeta(html, 'robots'),
      viewport: extractMetaProperty(html, 'viewport') || '',

      ogTags: extractOgTags(html),
      twitterTags: extractTwitterTags(html),

      headings: extractHeadings(html),
      bodyText: extractBodyText(html),
      wordCount: 0,

      images: extractImages(html, pageUrl),
      internalLinks: extractLinks(html, pageUrl, true),
      externalLinks: extractLinks(html, pageUrl, false),
      navLinks: extractNavLinks(html, pageUrl),

      existingSchema: extractSchema(html),
      forms: extractForms(html),

      styles: extractStyleData(html),
      linkedStylesheets: extractLinkedStylesheets(html, pageUrl),
    };

    crawl.wordCount = crawl.bodyText.split(/\s+/).filter(Boolean).length;

    let homePageStyles = null;
    if (siteUrl) {
      try {
        const homeUrl = new URL(siteUrl).origin + '/';
        if (homeUrl !== pageUrl) {
          homePageStyles = await crawlHomePageStyles(homeUrl);
        }
      } catch { /* non-critical */ }
    }

    return res.status(200).json({
      crawl,
      homePageStyles,
      summary: buildSummary(crawl),
    });
  } catch (err) {
    return res.status(200).json({ error: `Failed to crawl page: ${err.message}` });
  }
}

async function fetchHtml(url) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'SEAUTO-BuildBot/1.0', Accept: 'text/html' },
    signal: AbortSignal.timeout(15000),
    redirect: 'follow',
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.text();
}

function extractTag(html, tag) {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

function extractMeta(html, name) {
  const m = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, 'i'));
  return m ? m[1].trim() : '';
}

function extractMetaProperty(html, name) {
  const m = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, 'i'));
  return m ? m[1].trim() : '';
}

function extractCanonical(html) {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i)
    || html.match(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["']/i);
  return m ? m[1].trim() : '';
}

function extractOgTags(html) {
  const get = (prop) => {
    const m = html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']*)["']`, 'i'))
      || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:${prop}["']`, 'i'));
    return m ? m[1].trim() : '';
  };
  return { title: get('title'), description: get('description'), image: get('image'), type: get('type'), url: get('url') };
}

function extractTwitterTags(html) {
  const get = (prop) => {
    const m = html.match(new RegExp(`<meta[^>]+name=["']twitter:${prop}["'][^>]+content=["']([^"']*)["']`, 'i'))
      || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']twitter:${prop}["']`, 'i'));
    return m ? m[1].trim() : '';
  };
  return { card: get('card'), title: get('title'), description: get('description'), image: get('image') };
}

function extractHeadings(html) {
  const headings = [];
  const regex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text) headings.push({ level: match[1].toUpperCase(), text });
  }
  return headings.slice(0, 50);
}

function extractBodyText(html) {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<header[\s\S]*?<\/header>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
}

function extractImages(html, pageUrl) {
  const images = [];
  const regex = /<img([^>]*)>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const attrs = match[1];
    const src = extractAttr(attrs, 'src') || extractAttr(attrs, 'data-src');
    const alt = extractAttr(attrs, 'alt');
    const width = extractAttr(attrs, 'width');
    const height = extractAttr(attrs, 'height');
    const loading = extractAttr(attrs, 'loading');
    if (src) {
      let fullSrc = src;
      try { fullSrc = new URL(src, pageUrl).href; } catch { /* keep relative */ }
      images.push({ src: fullSrc, alt: alt || '', width, height, loading: loading || '' });
    }
  }
  return images.slice(0, 100);
}

function extractAttr(attrString, name) {
  const m = attrString.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'))
    || attrString.match(new RegExp(`${name}=([^\\s>]+)`, 'i'));
  return m ? m[1] : null;
}

function extractLinks(html, pageUrl, internal) {
  const base = new URL(pageUrl);
  const links = [];
  const seen = new Set();
  const regex = /<a([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const href = extractAttr(match[1], 'href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;
    try {
      const u = new URL(href, pageUrl);
      const isInternal = u.hostname === base.hostname;
      if (isInternal === internal && !seen.has(u.href)) {
        seen.add(u.href);
        const text = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        links.push({ href: u.href, text: text || '' });
      }
    } catch { /* skip */ }
  }
  return links.slice(0, 200);
}

function extractNavLinks(html, pageUrl) {
  const navMatch = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/i);
  if (!navMatch) return [];
  const navHtml = navMatch[1];
  const links = [];
  const regex = /<a([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(navHtml)) !== null) {
    const href = extractAttr(match[1], 'href');
    if (!href) continue;
    try {
      const u = new URL(href, pageUrl);
      const text = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      links.push({ href: u.href, text: text || '' });
    } catch { /* skip */ }
  }
  return links;
}

function extractSchema(html) {
  const schemas = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      schemas.push(parsed);
    } catch { /* skip malformed */ }
  }
  return schemas;
}

function extractForms(html) {
  const forms = [];
  const formRegex = /<form([^>]*)>([\s\S]*?)<\/form>/gi;
  let match;
  while ((match = formRegex.exec(html)) !== null) {
    const action = extractAttr(match[1], 'action') || '';
    const method = extractAttr(match[1], 'method') || 'get';
    const fields = [];
    const inputRegex = /<(?:input|textarea|select)([^>]*)>/gi;
    let inputMatch;
    while ((inputMatch = inputRegex.exec(match[2])) !== null) {
      const type = extractAttr(inputMatch[1], 'type') || 'text';
      const name = extractAttr(inputMatch[1], 'name') || '';
      const placeholder = extractAttr(inputMatch[1], 'placeholder') || '';
      if (name && type !== 'hidden') {
        fields.push({ type, name, placeholder });
      }
    }
    if (fields.length > 0) forms.push({ action, method, fields });
  }
  return forms;
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
  const spacing = [...new Set((allCss.match(/(?:padding|margin|gap)\s*:\s*([^;}\n]+)/gi) || []).map(s => s.trim()))].slice(0, 15);
  const transitions = [...new Set((allCss.match(/transition\s*:\s*([^;}\n]+)/gi) || []).map(s => s.trim()))].slice(0, 5);

  return {
    colors, fonts, googleFonts,
    cssVariables: cssVars.slice(0, 30),
    borderRadius, shadows, buttonStyles, spacing, transitions,
    totalInlineCssLength: allCss.length,
  };
}

function extractLinkedStylesheets(html, pageUrl) {
  const sheets = [];
  const regex = /<link[^>]+rel=["']stylesheet["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const href = extractAttr(match[0], 'href');
    if (href) {
      try { sheets.push(new URL(href, pageUrl).href); } catch { sheets.push(href); }
    }
  }
  return sheets.slice(0, 20);
}

async function crawlHomePageStyles(homeUrl) {
  try {
    const html = await fetchHtml(homeUrl);
    return extractStyleData(html);
  } catch {
    return null;
  }
}

function buildSummary(crawl) {
  const parts = [];
  parts.push(`${crawl.wordCount.toLocaleString()} words`);
  parts.push(`${crawl.headings.length} headings`);
  parts.push(`${crawl.images.length} images (${crawl.images.filter(i => !i.alt).length} missing alt)`);
  parts.push(`${crawl.internalLinks.length} internal links`);
  parts.push(`${crawl.externalLinks.length} external links`);
  if (crawl.existingSchema.length) parts.push(`${crawl.existingSchema.length} schema markup(s)`);
  if (crawl.forms.length) parts.push(`${crawl.forms.length} form(s)`);
  parts.push(`${(crawl.htmlSize / 1024).toFixed(0)}KB HTML`);
  parts.push(`${crawl.fetchTimeMs}ms load time`);
  return parts.join(' · ');
}
