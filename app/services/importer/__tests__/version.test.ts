import { describe, it, expect } from 'vitest'
import { prisma } from '../../../db.server'
import { ensureImporterVersion, REQUIRED_VERSION } from '../version'

describe('ensureImporterVersion', () => {
  it('throws when version mismatches, then passes after update', async () => {
    // Force a wrong version
    await prisma.importerVersion.upsert({
      where: { id: 1 },
      update: { version: '1.0-old' },
      create: { id: 1, version: '1.0-old' },
    })

    await expect(ensureImporterVersion()).rejects.toThrow(/outdated importer/i)

    // Fix version
    await prisma.importerVersion.update({ where: { id: 1 }, data: { version: REQUIRED_VERSION } })

    await expect(ensureImporterVersion()).resolves.toBeUndefined()
  })
})
