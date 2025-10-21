// <!-- BEGIN RBP GENERATED: importer-version-test-green-v1 -->
import { prisma } from '../../db.server'

export const REQUIRED_VERSION = '2.0-scrape'

export async function ensureImporterVersion(): Promise<void> {
  // Do not upsert here; that can hide a mismatch during tests
  const row = await prisma.importerVersion.findUnique({ where: { id: 1 } })
  if (!row) {
    await prisma.importerVersion.create({ data: { id: 1, version: REQUIRED_VERSION } })
    return
  }
  if (row.version !== REQUIRED_VERSION) {
    throw new Error(`Outdated importer. Current ${row.version}, required ${REQUIRED_VERSION}. Run the upgrade script.`)
  }
}
// <!-- END RBP GENERATED: importer-version-test-green-v1 -->
