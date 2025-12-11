import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFindUnique } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
}))

vi.mock('../../../db.server', () => ({
  prisma: {
    importerVersion: {
      findUnique: mockFindUnique,
    },
  },
}))

import { ensureImporterVersion, REQUIRED_VERSION } from '../version'

describe('ensureImporterVersion', () => {
  beforeEach(() => mockFindUnique.mockReset())

  it('throws when version mismatches, then passes after update', async () => {
    // Start with an existing row at the wrong version
    mockFindUnique.mockResolvedValueOnce({ id: 1, version: '1.0-old' })
    await expect(ensureImporterVersion()).rejects.toThrow(/Outdated importer/i)

    // Now simulate it being updated to the required version and passing
    mockFindUnique.mockResolvedValueOnce({ id: 1, version: REQUIRED_VERSION })
    await expect(ensureImporterVersion()).resolves.toBeUndefined()
  })
})
