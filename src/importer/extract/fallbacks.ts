// <!-- BEGIN RBP GENERATED: importer-extractor-templates-v2 -->
import crypto from 'crypto'

export function slugFromPath(url: string): string | null {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/').filter(Boolean)
    const last = parts[parts.length - 1]
    if (!last) return null
    return last
      .replace(/\.[a-zA-Z0-9]+$/, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/(^-|-$)/g, '')
      .toLowerCase()
  } catch {
    return null
  }
}

export function hash(url: string): string {
  return crypto.createHash('sha1').update(url).digest('hex').slice(0, 12)
}
// <!-- END RBP GENERATED: importer-extractor-templates-v2 -->
