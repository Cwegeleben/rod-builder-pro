import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '../../../db.server'
import { ensureImporterVersion, REQUIRED_VERSION } from '../version'

describe('ensureImporterVersion', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('throws when version mismatches, then passes after update', async () => {
    // Start with an existing row at the wrong version
    type FindUniqueReturn = Awaited<ReturnType<typeof prisma.importerVersion.findUnique>>
    vi.spyOn(prisma.importerVersion, 'findUnique').mockResolvedValue({ id: 1, version: '1.0-old' } as FindUniqueReturn)
    await expect(ensureImporterVersion()).rejects.toThrow(/Outdated importer/i)

    // Now simulate it being updated to the required version and passing
    vi.spyOn(prisma.importerVersion, 'findUnique').mockResolvedValue({
      id: 1,
      version: REQUIRED_VERSION,
    } as FindUniqueReturn)
    await expect(ensureImporterVersion()).resolves.toBeUndefined()
  })
})
