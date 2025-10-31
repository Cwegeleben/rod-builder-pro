// <!-- BEGIN RBP GENERATED: importer-discover-batson-series-v1 -->
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { crawlBatsonRodBlanksListing } from '../batsonListing'

describe('Batson rod-blanks listing discovery', () => {
  it('discovers series URLs from listing HTML', () => {
    const html = readFileSync(new URL('../__fixtures__/batson-rod-blanks.html', import.meta.url), 'utf-8')
    const { seeds, debug } = crawlBatsonRodBlanksListing(html, 'https://batsonenterprises.com')
    expect(seeds.length).toBeGreaterThan(0)
    expect(debug.deduped).toBe(seeds.length)
    // Ensure the sample points at rod-blanks series
    expect(seeds[0].url).toContain('/rod-blanks/')
  })
})
// <!-- END RBP GENERATED: importer-discover-batson-series-v1 -->
