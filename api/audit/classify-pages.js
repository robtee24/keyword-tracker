export const config = { maxDuration: 120 };

import crypto from 'crypto';

/**
 * POST /api/audit/classify-pages
 * Accepts { urls: string[] } and groups them by structural template.
 * Fetches a sample of pages, fingerprints their DOM structure,
 * and clusters URLs sharing the same template.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { urls } = req.body || {};
  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'urls array is required' });
  }

  try {
    const pathGroups = groupByPathPattern(urls);
    const templateGroups = [];
    let templateIdx = 0;

    for (const group of pathGroups) {
      if (group.urls.length === 1) {
        templateGroups.push({
          templateId: `t-${templateIdx++}`,
          representative: group.urls[0],
          urls: group.urls,
          count: 1,
          isDynamic: false,
          isBlog: isBlogUrl(group.urls[0]),
          pattern: getPathDisplay(group.urls[0]),
        });
        continue;
      }

      // For groups with multiple URLs, fingerprint a sample
      const sample = group.urls.slice(0, 3);
      const fingerprints = await Promise.allSettled(
        sample.map((url) => fingerprintPage(url))
      );

      const validFingerprints = fingerprints
        .filter((r) => r.status === 'fulfilled' && r.value)
        .map((r) => r.value);

      if (validFingerprints.length === 0) {
        templateGroups.push({
          templateId: `t-${templateIdx++}`,
          representative: group.urls[0],
          urls: group.urls,
          count: group.urls.length,
          isDynamic: group.urls.length > 2,
          isBlog: group.urls.some(isBlogUrl),
          pattern: group.pattern,
        });
        continue;
      }

      // Check if all sampled pages share the same structure
      const uniqueHashes = new Set(validFingerprints.map((f) => f.hash));

      if (uniqueHashes.size === 1) {
        // Same template -- group all URLs together
        const isBlog = group.urls.some(isBlogUrl);
        templateGroups.push({
          templateId: `t-${templateIdx++}`,
          representative: group.urls[0],
          urls: group.urls,
          count: group.urls.length,
          isDynamic: !isBlog && group.urls.length > 2,
          isBlog,
          pattern: group.pattern,
          structure: validFingerprints[0].structure,
        });
      } else {
        // Different structures -- each URL is unique
        for (const url of group.urls) {
          templateGroups.push({
            templateId: `t-${templateIdx++}`,
            representative: url,
            urls: [url],
            count: 1,
            isDynamic: false,
            isBlog: isBlogUrl(url),
            pattern: getPathDisplay(url),
          });
        }
      }
    }

    // Sort: non-dynamic unique pages first, then dynamic groups by count desc
    templateGroups.sort((a, b) => {
      if (a.isDynamic !== b.isDynamic) return a.isDynamic ? 1 : -1;
      return b.count - a.count;
    });

    const totalPages = urls.length;
    const uniqueTemplates = templateGroups.length;
    const dynamicGroups = templateGroups.filter((g) => g.isDynamic).length;
    const blogGroups = templateGroups.filter((g) => g.isBlog).length;
    const auditablePages = templateGroups.reduce((sum, g) => {
      if (g.isBlog) return sum + g.count;
      return sum + 1;
    }, 0);

    return res.json({
      totalPages,
      uniqueTemplates,
      dynamicGroups,
      blogGroups,
      auditablePages,
      groups: templateGroups,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to classify pages', details: err.message });
  }
}

function isBlogUrl(url) {
  const lower = url.toLowerCase();
  return /\/(blog|posts|articles|news|stories|journal|updates)\//i.test(lower);
}

function getPathDisplay(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * Group URLs by their path pattern.
 * URLs like /locations/new-york and /locations/chicago share pattern /locations/{slug}.
 */
function groupByPathPattern(urls) {
  const patternMap = new Map();

  for (const url of urls) {
    let pathname;
    try { pathname = new URL(url).pathname; } catch { continue; }

    const segments = pathname.split('/').filter(Boolean);
    // Build pattern: keep directory segments, replace the last segment with {slug}
    // if there are many URLs sharing the same prefix
    const patternKey = segments.length <= 1
      ? pathname
      : '/' + segments.slice(0, -1).join('/') + '/{slug}';

    if (!patternMap.has(patternKey)) {
      patternMap.set(patternKey, { pattern: patternKey, urls: [] });
    }
    patternMap.get(patternKey).urls.push(url);
  }

  // For groups with only 1 URL, the pattern IS the full path
  const result = [];
  for (const group of patternMap.values()) {
    if (group.urls.length === 1) {
      group.pattern = getPathDisplay(group.urls[0]);
    }
    result.push(group);
  }

  return result;
}

/**
 * Fetch a page and extract a structural fingerprint.
 */
async function fingerprintPage(url) {
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'SEAUTO-AuditBot/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    return extractFingerprint(html);
  } catch {
    return null;
  }
}

/**
 * Extract a structural fingerprint from HTML.
 * Captures the tag hierarchy and semantic structure without content.
 */
function extractFingerprint(html) {
  // Extract tags in order (simplified DOM structure)
  const tagRegex = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
  const semanticTags = new Set([
    'header', 'nav', 'main', 'section', 'article', 'aside',
    'footer', 'form', 'table', 'ul', 'ol', 'div', 'h1', 'h2', 'h3',
  ]);

  const structure = [];
  let match;
  while ((match = tagRegex.exec(html)) !== null) {
    const [, isClose, tag] = match;
    const lower = tag.toLowerCase();
    if (semanticTags.has(lower)) {
      structure.push(isClose ? `/${lower}` : lower);
    }
  }

  // Count structural elements
  const tagCounts = {};
  for (const t of structure) {
    if (!t.startsWith('/')) {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }
  }

  // Build fingerprint string from tag sequence + counts
  const seq = structure.join('>');
  const countStr = Object.entries(tagCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(',');

  const fingerprint = `${seq}||${countStr}`;
  const hash = crypto.createHash('md5').update(fingerprint).digest('hex');

  return {
    hash,
    structure: countStr,
    tagCount: Object.values(tagCounts).reduce((s, v) => s + v, 0),
  };
}
