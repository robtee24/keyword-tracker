/**
 * Extract the root domain from a GSC property URL, regular URL, or bare domain.
 * Strips protocol, sc-domain: prefix, www., and trailing slashes/paths.
 */
export function extractRootDomain(input) {
  let d = (input || '').trim().toLowerCase();
  d = d.replace(/^sc-domain:/, '');
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/^www\./, '');
  d = d.replace(/\/.*$/, '');
  return d;
}

const TWO_PART_TLDS = ['co.uk', 'com.au', 'co.nz', 'co.in', 'com.br', 'co.za', 'org.uk', 'net.au'];

function getBaseDomain(domain) {
  const parts = domain.split('.');
  if (parts.length <= 2) return domain;
  const lastTwo = parts.slice(-2).join('.');
  if (TWO_PART_TLDS.includes(lastTwo)) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

/**
 * Loose match: checks if two URLs/domains resolve to the same base domain.
 */
export function matchesDomain(urlA, urlB) {
  const a = extractRootDomain(urlA);
  const b = extractRootDomain(urlB);
  if (a === b) return true;
  return getBaseDomain(a) === getBaseDomain(b);
}
