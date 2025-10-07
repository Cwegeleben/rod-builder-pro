// <!-- BEGIN RBP GENERATED: supplier-importer-rate-limit-v1 -->
/** Simple in-memory sliding window rate limiter.
 * Not clustered / multi-instance safe (Fly scale considerations: move to Redis later).
 */
interface BucketEntry {
  ts: number
}

const buckets = new Map<string, BucketEntry[]>()

export interface RateLimitConfig {
  key: string // fully qualified key (route + shop)
  limit: number // maximum events allowed
  windowMs: number // sliding window size
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetInMs: number
  used: number
}

export function checkRateLimit(cfg: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const windowStart = now - cfg.windowMs
  const arr = buckets.get(cfg.key) || []
  // prune
  const filtered = arr.filter(e => e.ts >= windowStart)
  if (filtered.length !== arr.length) buckets.set(cfg.key, filtered)
  const used = filtered.length
  if (used < cfg.limit) {
    filtered.push({ ts: now })
    buckets.set(cfg.key, filtered)
    return { allowed: true, remaining: cfg.limit - (used + 1), resetInMs: cfg.windowMs, used: used + 1 }
  }
  const oldest = filtered[0]
  const resetInMs = oldest ? oldest.ts + cfg.windowMs - now : cfg.windowMs
  return { allowed: false, remaining: 0, resetInMs, used }
}

export function assertRateLimit(cfg: RateLimitConfig) {
  const res = checkRateLimit(cfg)
  if (!res.allowed) {
    throw new Response(JSON.stringify({ error: 'Rate limited', retryInMs: res.resetInMs }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil(res.resetInMs / 1000)) },
    })
  }
  return res
}

// Testing helper
export function _resetRateLimitBuckets() {
  buckets.clear()
}
// <!-- END RBP GENERATED: supplier-importer-rate-limit-v1 -->
