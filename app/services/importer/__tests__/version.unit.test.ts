import { describe, it, expect } from 'vitest'
import { prisma } from '../../../db.server'
import { ensureImporterVersion, REQUIRED_VERSION } from '../version'

describe('ensureImporterVersion', () => {
  it('throws when version mismatches, then passes after update', async () => {
    // Clean slate
    await prisma.importerVersion.deleteMany({})
    // Force a wrong version row
    await prisma.importerVersion.create({ data: { id: 1, version: '1.0-old' } })
    await expect(ensureImporterVersion()).rejects.toThrow(/Outdated importer/i)
    // Fix version and verify pass
    await prisma.importerVersion.update({ where: { id: 1 }, data: { version: REQUIRED_VERSION } })
    await expect(ensureImporterVersion()).resolves.toBeUndefined()
  })
})
