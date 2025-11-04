import { describe, it, expect } from 'vitest'
import { allowedHostsForTarget, partitionUrlsByHost } from '../seedScope.server'

describe('seed scope helpers', () => {
  it('returns allowed hosts for Batson targets', () => {
    expect(allowedHostsForTarget('batson-rod-blanks')).toEqual(['batsonenterprises.com', 'www.batsonenterprises.com'])
    expect(allowedHostsForTarget('other')).toEqual([])
  })

  it('partitions urls by allowed hosts', () => {
    const urls = [
      'https://batsonenterprises.com/rod-blanks',
      'https://www.batsonenterprises.com/collections/blanks',
      'https://example.com/x',
      'not-a-url',
    ]
    const { valid, invalid, invalidHosts } = partitionUrlsByHost(urls, [
      'batsonenterprises.com',
      'www.batsonenterprises.com',
    ])
    expect(valid).toHaveLength(2)
    expect(invalid).toHaveLength(2)
    expect(invalidHosts).toContain('example.com')
  })
})
