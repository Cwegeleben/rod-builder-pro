import { describe, it, expect } from 'vitest'
import { summarizeValidationEntries, type DesignStudioValidationEntry } from '../validation'

function buildEntry(overrides: Partial<DesignStudioValidationEntry>): DesignStudioValidationEntry {
  return {
    panelId: 'step:guides',
    severity: 'info',
    code: 'test',
    message: 'Test issue',
    role: 'guide_set',
    optionId: 'opt-1',
    source: 'selection',
    ...overrides,
  }
}

describe('summarizeValidationEntries', () => {
  it('returns null when there are no entries', () => {
    expect(summarizeValidationEntries([])).toBeNull()
    expect(summarizeValidationEntries(null)).toBeNull()
  })

  it('prefers error severity when mixed with warnings', () => {
    const entries = [buildEntry({ severity: 'warning', code: 'warn' }), buildEntry({ severity: 'error', code: 'err' })]
    expect(summarizeValidationEntries(entries)).toEqual({ severity: 'error', count: 1 })
  })

  it('falls back to warning when no errors exist', () => {
    const entries = [
      buildEntry({ severity: 'warning', code: 'warn-1' }),
      buildEntry({ severity: 'warning', code: 'warn-2' }),
    ]
    expect(summarizeValidationEntries(entries)).toEqual({ severity: 'warning', count: 2 })
  })

  it('returns info summary when only info entries exist', () => {
    const entries = [buildEntry({ severity: 'info', code: 'heads-up' })]
    expect(summarizeValidationEntries(entries)).toEqual({ severity: 'info', count: 1 })
  })
})
