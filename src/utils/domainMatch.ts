/**
 * Extract the root domain from a GSC property URL, regular URL, or bare domain.
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
 * Check if a GSC property matches a project's root domain.
 * e.g. "sc-domain:example.com" matches "example.com"
 *      "https://www.example.com/" matches "example.com"
 *      "https://other.com/" does NOT match "example.com"
 */
export function matchesRootDomain(gscProperty: string, projectDomain: string): boolean {
  return extractRootDomain(gscProperty) === extractRootDomain(projectDomain);
}
