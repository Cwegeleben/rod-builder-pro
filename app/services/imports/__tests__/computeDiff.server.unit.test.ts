import { describe, expect, it } from 'vitest'
import { buildSnapshotFromSource, computeDiff } from '../computeDiff.server'

describe('computeDiff', () => {
  it('detects adds, deletes, and changes with attribute diffs', () => {
    const supplier = 'batson'
    const existing = [
      buildSnapshotFromSource({
        supplier,
        productCode: 'IMMWS84MH',
        category: 'blank',
        family: 'castingBlank',
        brand: 'Rainshadow',
        series: 'Immortal',
        msrp: 189.99,
        attributes: { power: 'MH', action: 'F' },
      }),
      buildSnapshotFromSource({
        supplier,
        productCode: 'HXN10',
        category: 'guide',
        family: 'doubleFootGuide',
        attributes: { ringSize: 10 },
      }),
    ]

    const staging = [
      // changed blank
      buildSnapshotFromSource({
        supplier,
        productCode: 'IMMWS84MH',
        category: 'blank',
        family: 'castingBlank',
        brand: 'Rainshadow',
        series: 'Immortal',
        msrp: 199.99,
        attributes: { power: 'MH', action: 'XF' },
      }),
      // new item
      buildSnapshotFromSource({
        supplier,
        productCode: 'NEW-GUIDE',
        category: 'guide',
        family: 'singleFootGuide',
        attributes: { ringSize: 6 },
      }),
    ]

    const { diffs, summary } = computeDiff(existing, staging)

    expect(summary).toEqual({ adds: 1, changes: 1, deletes: 1 })

    const changeDiff = diffs.find(diff => diff.productCode === 'IMMWS84MH')
    expect(changeDiff?.kind).toBe('change')
    expect(changeDiff?.changedFields).toEqual([
      { field: 'msrp', before: 189.99, after: 199.99 },
      { field: 'attributes.action', before: 'F', after: 'XF' },
    ])

    const addDiff = diffs.find(diff => diff.kind === 'add')
    expect(addDiff?.productCode).toBe('NEW-GUIDE')

    const deleteDiff = diffs.find(diff => diff.kind === 'delete')
    expect(deleteDiff?.productCode).toBe('HXN10')
  })
})
