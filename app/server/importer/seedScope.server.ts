// Seed scope enforcement helpers

/**
 * Return the list of allowed hostnames for seeds for a given target id.
 * Empty list means no restriction.
 */
export function allowedHostsForTarget(targetId: string): string[] {
  // Batson targets: restrict to batsonenterprises.com
  if (/^batson-/.test(targetId)) return ['batsonenterprises.com', 'www.batsonenterprises.com']
  return []
}

export function partitionUrlsByHost(
  urls: string[],
  allowedHosts: string[],
): {
  valid: string[]
  invalid: string[]
  invalidHosts: string[]
} {
  if (!allowedHosts.length) return { valid: urls.slice(), invalid: [], invalidHosts: [] }
  const valid: string[] = []
  const invalid: string[] = []
  const invalidHostsSet = new Set<string>()
  for (const s of urls) {
    try {
      const u = new URL(s)
      if (allowedHosts.includes(u.hostname)) valid.push(s)
      else {
        invalid.push(s)
        invalidHostsSet.add(u.hostname)
      }
    } catch {
      // treat parse failures as invalid
      invalid.push(s)
    }
  }
  return { valid, invalid, invalidHosts: Array.from(invalidHostsSet) }
}
