import { describe, expect, it } from 'vitest'
import { shouldEnableThemeScrollRestoration } from './theme-scroll-restoration'

describe('shouldEnableThemeScrollRestoration', () => {
  it('disables restoration when rbp_theme=1', () => {
    expect(shouldEnableThemeScrollRestoration('?rbp_theme=1')).toBe(false)
  })

  it('enables restoration when param missing', () => {
    expect(shouldEnableThemeScrollRestoration('?foo=bar')).toBe(true)
  })

  it('enables restoration when parsing fails', () => {
    expect(shouldEnableThemeScrollRestoration('%%%')).toBe(true)
  })

  it('normalizes search strings without leading ?', () => {
    expect(shouldEnableThemeScrollRestoration('rbp_theme=1')).toBe(false)
    expect(shouldEnableThemeScrollRestoration('rbp_theme=0')).toBe(true)
  })
})
