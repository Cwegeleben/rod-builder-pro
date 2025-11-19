import { describe, it, expect } from 'vitest'
import { normalizeFinalTitle } from '../server/importer/products/batsonTitle'

describe('normalizeFinalTitle (cleanup)', () => {
  it('collapses spaces around slashes (R / S -> R/S)', () => {
    expect(normalizeFinalTitle('Batson Wide R / S Reel Seat')).toBe('Batson Wide R/S Reel Seat')
  })

  it('fixes W / -> W/ shorthand', () => {
    expect(normalizeFinalTitle('Batson Alum Trigger W / Reel Seat')).toBe('Batson Alum Trigger W/ Reel Seat')
  })

  it('decodes HTML entities for inch marks', () => {
    expect(normalizeFinalTitle('Batson .835&quot; OD 4.85&quot; Length Reel Seat')).toBe(
      'Batson .835" OD 4.85" Length Reel Seat',
    )
  })

  it('closes degree parentheses for trolling butts (30 and 130)', () => {
    expect(normalizeFinalTitle('Batson Regular / Curved (30 Reel Seat')).toBe('Batson Regular/Curved (30°) Reel Seat')
    expect(normalizeFinalTitle('Batson Regular / Curved (130 Reel Seat')).toBe('Batson Regular/Curved (130°) Reel Seat')
  })
})
