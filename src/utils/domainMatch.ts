/**
 * Extract the domain from a GSC property URL, regular URL, or bare domain.
 * Strips protocol, sc-domain: prefix, www., and trailing slashes/paths.
 */
export function extractRootDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^sc-domain:/, '');
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/^www\./, '');
  d = d.replace(/\/.*$/, '');
  return d;
}

/**
 * Extract the registrable base domain (e.g. "example.com" from "app.example.com").
 * Simple heuristic: takes the last two segments, or last three for known
 * two-part TLDs like .co.uk, .com.au, etc.
 */
function getBaseDomain(domain: string): string {
  const parts = domain.split('.');
  if (parts.length <= 2) return domain;

  const twoPartTlds = ['co.uk', 'com.au', 'co.nz', 'co.in', 'com.br', 'co.za', 'org.uk', 'net.au'];
  const lastTwo = parts.slice(-2).join('.');
  if (twoPartTlds.includes(lastTwo)) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

/**
 * Loose match: checks if a GSC property belongs to the same base domain
 * as the project domain. Handles subdomains, sc-domain: prefix, www, etc.
 *
 * e.g. "sc-domain:example.com" matches "example.com"
 *      "https://www.example.com/" matches "example.com"
 *      "https://app.example.com/" matches "example.com"
 *      "https://other.com/" does NOT match "example.com"
 */
export function matchesRootDomain(gscProperty: string, projectDomain: string): boolean {
  const gscDomain = extractRootDomain(gscProperty);
  const projDomain = extractRootDomain(projectDomain);

  if (gscDomain === projDomain) return true;

  return getBaseDomain(gscDomain) === getBaseDomain(projDomain);
}
