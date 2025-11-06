import { describe, it, expect, beforeEach } from 'vitest'
import { sanitizeMetafields, summarizeSpecs } from './shopify'

function mf(namespace: string, key: string, type: string, value: unknown) {
  return { namespace, key, type, value: typeof value === 'string' ? value : JSON.stringify(value) }
}

describe('sanitizeMetafields', () => {
  const NS = 'rbp'
  const SPEC_NS = 'rbp.spec'

  beforeEach(() => {
    delete process.env.SPECS_MAX_BYTES
  })

  it('sanitizes single_line_text_field by stripping newlines and clamping length', () => {
    const long = 'x'.repeat(300)
    const arr = [mf(NS, 'supplier_external_id', 'single_line_text_field', `abc\n\rdef${long}`)]
    const { metafields, warnings } = sanitizeMetafields(arr)
    expect(warnings.length).toBe(0)
    expect(metafields[0].value.includes('\n')).toBe(false)
    expect(metafields[0].value.length).toBeLessThanOrEqual(255)
  })

  it('coerces numbers and drops invalid numeric values', () => {
    const arr = [
      mf(SPEC_NS, 'pieces', 'number_integer', '5'),
      mf(SPEC_NS, 'line_lb_max', 'number_integer', 'not-an-int'),
      mf(SPEC_NS, 'lure_oz_min', 'number_decimal', '1.25'),
      mf(SPEC_NS, 'lure_oz_max', 'number_decimal', 'oops'),
    ]
    const { metafields, warnings } = sanitizeMetafields(arr)
    const keys = metafields.map(m => m.key)
    expect(keys).toContain('pieces')
    expect(keys).toContain('lure_oz_min')
    expect(keys).not.toContain('line_lb_max')
    expect(keys).not.toContain('lure_oz_max')
    expect(warnings.some(w => w.includes('invalid integer'))).toBe(true)
    expect(warnings.some(w => w.includes('invalid decimal'))).toBe(true)
  })

  it('enforces list shape and clamps items', () => {
    const bad = mf(SPEC_NS, 'applications', 'list.single_line_text_field', '{bad json}')
    const good = mf(SPEC_NS, 'applications', 'list.single_line_text_field', ['one', 'two\nline', 'x'.repeat(300)])
    const { metafields, warnings } = sanitizeMetafields([bad, good])
    // bad dropped
    expect(warnings.some(w => w.includes('invalid list json'))).toBe(true)
    const kept = metafields.find(m => m.key === 'applications')!
    const arr = JSON.parse(kept.value)
    expect(Array.isArray(arr)).toBe(true)
    expect(arr[1].includes('\n')).toBe(false)
    expect(arr[2].length).toBeLessThanOrEqual(255)
  })

  it('summarizes oversized rbp.specs and adds specs_full_hash', () => {
    // Force small budget so we exercise truncation
    process.env.SPECS_MAX_BYTES = '200'
    const big = { desc: 'y'.repeat(1000), series: 'RX7', pieces: 2 }
    const arr = [mf(NS, 'specs', 'json', big)]
    const { metafields, warnings } = sanitizeMetafields(arr)
    const specs = metafields.find(m => m.namespace === NS && m.key === 'specs')!
    expect(Buffer.byteLength(specs.value, 'utf8')).toBeLessThanOrEqual(200)
    const fullHash = metafields.find(m => m.namespace === NS && m.key === 'specs_full_hash')
    expect(fullHash).toBeTruthy()
    expect(warnings.some(w => w.includes('truncated to summary'))).toBe(true)
  })
})

describe('summarizeSpecs', () => {
  it('produces a stable hash and summary picks known keys', () => {
    const input = { series: 'RX7', pieces: 2, unknown: 'ignore' }
    const { summary, hash } = summarizeSpecs(input)
    expect(summary.series).toBe('RX7')
    expect(summary.pieces).toBe(2)
    expect('unknown' in summary).toBe(true) // present but undefined is ok
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(10)
  })
})
