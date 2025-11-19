import { describe, it, expect } from 'vitest'
import {
  buildBatsonReelSeatTitle,
  inferReelSeatFamily,
  BatsonReelSeatCategoryContext,
  BatsonReelSeatRow,
} from '../batsonTitle'

const catAluminum: BatsonReelSeatCategoryContext = {
  brandFallback: 'Alps',
  categoryType: 'Aluminum Reel Seat',
}

describe('Reel seat family map + title builder', () => {
  it('infers Dual Trigger from code prefix and builds title', () => {
    const fam = inferReelSeatFamily({
      code: 'DALT20-XXX',
      slug: undefined,
      series: 'ALPS Aluminum Dual Trigger',
    }).family
    expect(fam).toBe('Dual Trigger')
    const row: BatsonReelSeatRow = {
      rawName: 'ALPS Aluminum Dual Trigger',
      brandRaw: 'ALPS',
      codeRaw: 'DALT20-XXX',
      size: '20',
      material: 'Aluminum',
      finishColor: 'Black',
      series: 'ALPS Aluminum Dual Trigger',
    }
    expect(buildBatsonReelSeatTitle(catAluminum, row)).toBe('Alps Dual Trigger Aluminum Reel Seat Size 20 – Black')
  })

  it('infers AIP Contour from slug and builds title', () => {
    const fam = inferReelSeatFamily({
      code: 'AIP20M-CWG-MB',
      slug: '/reel-seats/alps-aip-contour-reel-seat-matte-black',
      series: 'ALPS AIP Contour Reel Seat',
    }).family
    expect(fam).toBe('AIP Contour')
    const row: BatsonReelSeatRow = {
      rawName: 'ALPS AIP Contour Reel Seat Matte Black',
      brandRaw: 'ALPS',
      codeRaw: 'AIP20M-CWG-MB',
      size: '20',
      material: 'Aluminum',
      finishColor: 'Matte Black',
      slug: '/reel-seats/alps-aip-contour-reel-seat-matte-black',
      series: 'ALPS AIP Contour Reel Seat',
    }
    expect(buildBatsonReelSeatTitle(catAluminum, row)).toBe('Alps AIP Contour Aluminum Reel Seat Size 20 – Matte Black')
  })

  it('falls back to non-family title when no rules match', () => {
    const fam = inferReelSeatFamily({
      code: 'A16BP-B',
      slug: '/reel-seats/alps-aluminum-reel-seat-black',
      series: 'ALPS Aluminum Reel Seat',
    }).family
    expect(fam).toBeNull()
    const row: BatsonReelSeatRow = {
      rawName: 'ALPS Aluminum Reel Seat Black',
      brandRaw: 'ALPS',
      codeRaw: 'A16BP-B',
      size: '16',
      material: 'Aluminum',
      finishColor: 'Black',
      slug: '/reel-seats/alps-aluminum-reel-seat-black',
      series: 'ALPS Aluminum Reel Seat',
    }
    expect(buildBatsonReelSeatTitle(catAluminum, row)).toBe('Alps Aluminum Reel Seat Size 16 – Black')
  })

  it('infers VTG Soft Touch generically from series/slug/title', () => {
    const row: BatsonReelSeatRow = {
      rawName: 'ALPS VTG Soft Touch Spin Seat',
      brandRaw: 'ALPS',
      codeRaw: 'VTG18S-N',
      size: '18',
      material: 'Graphite Filled Nylon',
      finishColor: 'Black',
      slug: '/reel-seats/alps-vtg-soft-touch-spin-seat',
      series: 'ALPS VTG Soft Touch Spin Seat',
    }
    const title = buildBatsonReelSeatTitle(catAluminum, row)
    expect(title).toBe('Alps VTG Soft Touch Graphite Filled Nylon Reel Seat Size 18 – Black')
    expect(/VTG18S/i.test(title)).toBe(false)
  })

  it('defaults brand to Batson when no brand detected but a family is inferred', () => {
    const catNoBrand: BatsonReelSeatCategoryContext = { categoryType: 'Aluminum Reel Seat' }
    const row: BatsonReelSeatRow = {
      rawName: 'VTG Soft Touch Spin Seat',
      // brandRaw intentionally missing
      codeRaw: 'VTG18S-N',
      size: '18',
      material: 'Graphite Filled Nylon',
      finishColor: 'Black',
      slug: '/reel-seats/vtg-soft-touch-spin-seat',
      series: 'VTG Soft Touch Spin Seat',
    }
    const title = buildBatsonReelSeatTitle(catNoBrand, row)
    expect(title).toBe('Batson VTG Soft Touch Graphite Filled Nylon Reel Seat Size 18 – Black')
  })
})
