import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient
  // Internal one-time guard to avoid running schema fix multiple times per process
  // eslint-disable-next-line no-var
  var __schemaFixDone: boolean | undefined
}

if (process.env.NODE_ENV !== 'production') {
  if (!global.prisma) {
    global.prisma = new PrismaClient()
  }
}

const prisma: PrismaClient = global.prisma || new PrismaClient()

// Lightweight runtime safety net: ensure SpecTemplate.cost exists in SQLite when
// Prisma migrations are unable to run (e.g., existing DB without baseline).
// This is safe to run repeatedly; guarded and idempotent.
if (process.env.NODE_ENV === 'production' && !global.__schemaFixDone) {
  global.__schemaFixDone = true
  // Fire-and-forget to avoid blocking module load; errors are logged but non-fatal
  void (async () => {
    try {
      // Only for SQLite (our current provider); PRAGMA works only there
      // If provider changes, this block will harmlessly fail and be skipped
      const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>("PRAGMA table_info('SpecTemplate')")
      const hasCost = Array.isArray(rows) && rows.some(r => r.name === 'cost')
      if (!hasCost) {
        await prisma.$executeRawUnsafe('ALTER TABLE SpecTemplate ADD COLUMN cost REAL')
      }
      const hasImgUrl = Array.isArray(rows) && rows.some(r => r.name === 'productImageUrl')
      if (!hasImgUrl) {
        await prisma.$executeRawUnsafe('ALTER TABLE SpecTemplate ADD COLUMN productImageUrl TEXT')
      }
      const hasAvail = Array.isArray(rows) && rows.some(r => r.name === 'supplierAvailability')
      if (!hasAvail) {
        await prisma.$executeRawUnsafe('ALTER TABLE SpecTemplate ADD COLUMN supplierAvailability TEXT')
      }
      // importer-v2-3: ensure essential importer tables exist to avoid 500s before migrations apply
      const tbls = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
        "SELECT name FROM sqlite_master WHERE type='table'",
      )
      const has = (n: string) => Array.isArray(tbls) && tbls.some(t => t.name === n)

      // ImportTemplate
      if (!has('ImportTemplate')) {
        await prisma.$executeRawUnsafe(
          "CREATE TABLE IF NOT EXISTS ImportTemplate (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, importConfig TEXT NOT NULL DEFAULT '{}', state TEXT NOT NULL DEFAULT 'NEEDS_SETTINGS', lastRunAt DATETIME, hadFailures BOOLEAN NOT NULL DEFAULT 0)",
        )
        await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS ImportTemplate_state_idx ON ImportTemplate(state)')
      }
      // ImportLog
      if (!has('ImportLog')) {
        await prisma.$executeRawUnsafe(
          'CREATE TABLE IF NOT EXISTS ImportLog (id TEXT PRIMARY KEY NOT NULL, templateId TEXT NOT NULL, runId TEXT NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(templateId) REFERENCES ImportTemplate(id) ON DELETE CASCADE ON UPDATE CASCADE)',
        )
        await prisma.$executeRawUnsafe(
          'CREATE INDEX IF NOT EXISTS ImportLog_tpl_run_type_idx ON ImportLog(templateId, runId, type)',
        )
      }

      // ImportRun
      if (!has('ImportRun')) {
        await prisma.$executeRawUnsafe(
          'CREATE TABLE IF NOT EXISTS ImportRun (id TEXT PRIMARY KEY NOT NULL, supplierId TEXT NOT NULL, startedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, finishedAt DATETIME, status TEXT NOT NULL, progress TEXT, summary TEXT)',
        )
        await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS ImportRun_supplier_idx ON ImportRun(supplierId)')
      }
      // ImportDiff
      if (!has('ImportDiff')) {
        await prisma.$executeRawUnsafe(
          'CREATE TABLE IF NOT EXISTS ImportDiff (id TEXT PRIMARY KEY NOT NULL, importRunId TEXT NOT NULL, externalId TEXT NOT NULL, diffType TEXT NOT NULL, before TEXT, after TEXT, validation TEXT, resolution TEXT, resolvedBy TEXT, resolvedAt DATETIME)',
        )
        await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS ImportDiff_run_idx ON ImportDiff(importRunId)')
      }
      // PartStaging
      if (!has('PartStaging')) {
        await prisma.$executeRawUnsafe(
          "CREATE TABLE IF NOT EXISTS PartStaging (id TEXT PRIMARY KEY NOT NULL, supplierId TEXT NOT NULL, externalId TEXT NOT NULL, title TEXT NOT NULL, partType TEXT NOT NULL, description TEXT, images TEXT, rawSpecs TEXT, normSpecs TEXT, priceMsrp REAL, priceWh REAL, hashContent TEXT NOT NULL DEFAULT '', fetchedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, shopifyProductId TEXT, shopifyVariantIds TEXT, publishedAt DATETIME, publishStatus TEXT, publishResult TEXT)",
        )
        await prisma.$executeRawUnsafe(
          'CREATE UNIQUE INDEX IF NOT EXISTS PartStaging_supplier_external_unique ON PartStaging(supplierId, externalId)',
        )
      }
      // ProductSource (seeds)
      if (!has('ProductSource')) {
        await prisma.$executeRawUnsafe(
          'CREATE TABLE IF NOT EXISTS ProductSource (id TEXT PRIMARY KEY NOT NULL, supplierId TEXT NOT NULL, url TEXT NOT NULL, externalId TEXT, source TEXT NOT NULL, notes TEXT, firstSeenAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, lastSeenAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)',
        )
        await prisma.$executeRawUnsafe(
          'CREATE UNIQUE INDEX IF NOT EXISTS ProductSource_supplier_url_unique ON ProductSource(supplierId, url)',
        )
      }
    } catch (err) {
      console.warn('[startup] schema check failed (non-fatal):', err)
    }
  })()
}

export { prisma }
