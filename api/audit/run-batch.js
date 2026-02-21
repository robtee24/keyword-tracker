export const config = { maxDuration: 60 };

/**
 * POST /api/audit/run-batch
 * { siteUrl, pageUrls: string[], auditType }
 * Runs up to 5 audits in parallel and returns all results.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { siteUrl, pageUrls, auditType } = req.body || {};
  if (!siteUrl || !Array.isArray(pageUrls) || pageUrls.length === 0 || !auditType) {
    return res.status(400).json({ error: 'siteUrl, pageUrls[], and auditType are required' });
  }

  const baseUrl = `https://${req.headers.host}`;
  const batch = pageUrls.slice(0, 5);

  const results = await Promise.allSettled(
    batch.map(async (pageUrl) => {
      try {
        const resp = await fetch(`${baseUrl}/api/audit/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl, pageUrl, auditType }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.json();
      } catch (err) {
        return { pageUrl, auditType, score: 0, summary: '', strengths: [], recommendations: [], error: err.message };
      }
    })
  );

  const output = results.map((r) => r.status === 'fulfilled' ? r.value : r.reason);
  return res.status(200).json({ results: output });
}
