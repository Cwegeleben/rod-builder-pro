// <!-- BEGIN RBP GENERATED: supplier-importer-v1 -->
// Simple per-origin throttle to avoid overwhelming supplier sites.
// Token bucket style with minimal state kept in-memory (multiple app instances not coordinated yet).

type Bucket = { tokens: number; lastRefill: number }
const buckets = new Map<string, Bucket>()

const REFILL_INTERVAL_MS = 1000
const TOKENS_PER_INTERVAL = 5 // allow 5 requests / second baseline
const MAX_TOKENS = 10

export async function throttle(origin: string): Promise<void> {
  const now = Date.now()
  let b = buckets.get(origin)
  if (!b) {
    b = { tokens: MAX_TOKENS, lastRefill: now }
    buckets.set(origin, b)
  }
  // Refill
  const elapsed = now - b.lastRefill
  if (elapsed >= REFILL_INTERVAL_MS) {
    const intervals = Math.floor(elapsed / REFILL_INTERVAL_MS)
    b.tokens = Math.min(MAX_TOKENS, b.tokens + intervals * TOKENS_PER_INTERVAL)
    b.lastRefill = now
  }
  // Wait for token
  while (b.tokens <= 0) {
    await new Promise(r => setTimeout(r, 100))
    const n2 = Date.now()
    const elapsed2 = n2 - b.lastRefill
    if (elapsed2 >= REFILL_INTERVAL_MS) {
      const intervals2 = Math.floor(elapsed2 / REFILL_INTERVAL_MS)
      b.tokens = Math.min(MAX_TOKENS, b.tokens + intervals2 * TOKENS_PER_INTERVAL)
      b.lastRefill = n2
    }
  }
  b.tokens -= 1
}
// <!-- END RBP GENERATED: supplier-importer-v1 -->
