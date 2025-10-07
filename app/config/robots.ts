// <!-- BEGIN RBP GENERATED: supplier-importer-v1 -->
// Simple robots.txt cache and allow/deny evaluation for supplier importer.
// Minimal implementation: supports only Disallow lines for User-agent: *
const robotsCache = new Map<string, { fetchedAt: number; text: string }>()

export async function fetchRobotsTxt(origin: string): Promise<string | null> {
  try {
    const url = new URL(origin)
    url.pathname = '/robots.txt'
    const key = url.origin
    const cached = robotsCache.get(key)
    if (cached && Date.now() - cached.fetchedAt < 60 * 60 * 1000) return cached.text
    const resp = await fetch(url.toString(), { method: 'GET' })
    if (!resp.ok) return null
    const text = await resp.text()
    robotsCache.set(key, { fetchedAt: Date.now(), text })
    return text
  } catch {
    return null
  }
}

export function isPathAllowed(robots: string | null, path: string): boolean {
  if (!robots) return true
  const lines = robots.split(/\r?\n/)
  let active = false
  const disallows: string[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    if (/^user-agent:\s*\*/i.test(line)) active = true
    else if (/^user-agent:/i.test(line)) active = false
    else if (active && /^disallow:/i.test(line)) {
      const value = line.split(':')[1]?.trim() || ''
      if (value) disallows.push(value)
    }
  }
  return !disallows.some(d => d !== '/' && path.startsWith(d))
}
// <!-- END RBP GENERATED: supplier-importer-v1 -->
