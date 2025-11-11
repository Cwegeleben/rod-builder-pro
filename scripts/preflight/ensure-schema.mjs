// Ensure critical SQLite schema columns exist to avoid runtime errors when migration history is incomplete.
// Safe to run repeatedly; only applies ALTERs when missing.

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function columnExists(table, column) {
  try {
    const rows = await prisma.$queryRawUnsafe(`PRAGMA table_info('${table}')`)
    return Array.isArray(rows) && rows.some(r => String(r.name) === column)
  } catch {
    return false
  }
}

async function tableExists(name) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`
    )
    return Array.isArray(rows) && rows.length > 0
  } catch {
    return false
  }
}

async function ensureSpecTemplateStatus() {
  const hasTable = await tableExists('SpecTemplate')
  if (!hasTable) return
  const hasCol = await columnExists('SpecTemplate', 'status')
  if (hasCol) return
  // Add as TEXT with default 'ACTIVE' to satisfy NOT NULL constraint for existing rows
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "SpecTemplate" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE'`
  )
}

async function ensureImportTemplatePreparingRunId() {
  const hasTable = await tableExists('ImportTemplate')
  if (!hasTable) return
  const hasCol = await columnExists('ImportTemplate', 'preparingRunId')
  if (hasCol) return
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ImportTemplate" ADD COLUMN "preparingRunId" TEXT`
  )
  try {
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "ImportTemplate_preparingRunId_idx" ON "ImportTemplate"("preparingRunId")`
    )
  } catch {
    // ignore
  }
}

export async function ensure() {
  try {
    await ensureSpecTemplateStatus()
    await ensureImportTemplatePreparingRunId()
    await ensureImportRunProgressColumn()
    await ensureProductSourceTable()
    await ensurePartStagingPublishColumns()
    await ensurePublishTelemetryTable()
    await ensureSqliteJsonTypes()
  } catch {
    // best-effort
  } finally {
    await prisma.$disconnect()
  }
}

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  ensure().then(() => process.exit(0)).catch(() => process.exit(0))
}

// Create ProductSource table if missing (SQLite only)
async function ensureProductSourceTable() {
  const hasTable = await tableExists('ProductSource')
  if (hasTable) return
  // Minimal schema aligned with prisma model
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "ProductSource" (
      "id" TEXT PRIMARY KEY,
      "supplierId" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "externalId" TEXT,
      "source" TEXT NOT NULL,
      "notes" TEXT,
      "firstSeenAt" DATETIME NOT NULL DEFAULT (datetime('now')),
      "lastSeenAt" DATETIME NOT NULL DEFAULT (datetime('now'))
    )
  `)
  try {
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "product_source_supplier_url_unique" ON "ProductSource"("supplierId", "url")`
    )
  } catch {
    // ignore
  }
}

// Ensure PublishTelemetry table exists (SQLite only)
async function ensurePublishTelemetryTable() {
  const hasTable = await tableExists('PublishTelemetry')
  if (hasTable) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "PublishTelemetry" (
      "id" TEXT PRIMARY KEY,
      "productIds" TEXT,
      "attempted" INTEGER NOT NULL DEFAULT 0,
      "created" INTEGER NOT NULL DEFAULT 0,
      "updated" INTEGER NOT NULL DEFAULT 0,
      "skipped" INTEGER NOT NULL DEFAULT 0,
      "failed" INTEGER NOT NULL DEFAULT 0,
      "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "finishedAt" DATETIME,
      "durationMs" INTEGER,
      "diag" TEXT
    )
  `)
  try {
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "PublishTelemetry_startedAt_idx" ON "PublishTelemetry"("startedAt")`
    )
  } catch {
    // ignore
  }
}

// Ensure PartStaging publish back-write columns exist (SQLite only)
async function ensurePartStagingPublishColumns() {
  const hasTable = await tableExists('PartStaging')
  if (!hasTable) return

  const addIfMissing = async (col, typeSql) => {
    const hasCol = await columnExists('PartStaging', col)
    if (hasCol) return
    await prisma.$executeRawUnsafe(`ALTER TABLE "PartStaging" ADD COLUMN "${col}" ${typeSql}`)
  }

  // Prisma maps Json to TEXT in SQLite; timestamps use DATETIME
  await addIfMissing('shopifyProductId', 'TEXT')
  await addIfMissing('shopifyVariantIds', 'TEXT')
  await addIfMissing('publishedAt', 'DATETIME')
  await addIfMissing('publishStatus', 'TEXT')
  await addIfMissing('publishResult', 'TEXT')
}

// Detect and fix tables created with JSONB column types in SQLite.
// Prisma expects JSON columns to be declared as JSON (or TEXT fallback), not JSONB.
async function ensureSqliteJsonTypes() {
  // Helper: read column type for a table
  async function getColumnTypes(table) {
    try {
      const rows = await prisma.$queryRawUnsafe(`PRAGMA table_info('${table}')`)
      const out = {}
      for (const r of rows) {
        out[String(r.name)] = String(r.type || '').toUpperCase()
      }
      return out
    } catch {
      return {}
    }
  }

  // Rebuild helpers (SQLite pattern: create new table, copy, drop old, rename)
  async function rebuildImportRun() {
    await prisma.$executeRawUnsafe(`PRAGMA defer_foreign_keys=ON;`)
    await prisma.$executeRawUnsafe(`PRAGMA foreign_keys=OFF;`)
  await prisma.$executeRawUnsafe(`CREATE TABLE "new_ImportRun" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "supplierId" TEXT NOT NULL,
        "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "finishedAt" DATETIME,
        "status" TEXT NOT NULL,
    "summary" TEXT
      );`)
    await prisma.$executeRawUnsafe(`INSERT INTO "new_ImportRun" ("id","supplierId","startedAt","finishedAt","status","summary")
      SELECT "id","supplierId","startedAt","finishedAt","status","summary" FROM "ImportRun";`)
    await prisma.$executeRawUnsafe(`DROP TABLE "ImportRun";`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "new_ImportRun" RENAME TO "ImportRun";`)
    await prisma.$executeRawUnsafe(`PRAGMA foreign_keys=ON;`)
    await prisma.$executeRawUnsafe(`PRAGMA defer_foreign_keys=OFF;`)
  }

  async function rebuildImportDiff() {
    await prisma.$executeRawUnsafe(`PRAGMA defer_foreign_keys=ON;`)
    await prisma.$executeRawUnsafe(`PRAGMA foreign_keys=OFF;`)
  await prisma.$executeRawUnsafe(`CREATE TABLE "new_ImportDiff" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "importRunId" TEXT NOT NULL,
        "externalId" TEXT NOT NULL,
        "diffType" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "validation" TEXT,
        "resolution" TEXT,
        "resolvedBy" TEXT,
        "resolvedAt" DATETIME
      );`)
    await prisma.$executeRawUnsafe(`INSERT INTO "new_ImportDiff" ("id","importRunId","externalId","diffType","before","after","validation","resolution","resolvedBy","resolvedAt")
      SELECT "id","importRunId","externalId","diffType","before","after","validation","resolution","resolvedBy","resolvedAt" FROM "ImportDiff";`)
    await prisma.$executeRawUnsafe(`DROP TABLE "ImportDiff";`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "new_ImportDiff" RENAME TO "ImportDiff";`)
    await prisma.$executeRawUnsafe(`PRAGMA foreign_keys=ON;`)
    await prisma.$executeRawUnsafe(`PRAGMA defer_foreign_keys=OFF;`)
  }

  async function rebuildPartStaging() {
    await prisma.$executeRawUnsafe(`PRAGMA defer_foreign_keys=ON;`)
    await prisma.$executeRawUnsafe(`PRAGMA foreign_keys=OFF;`)
  await prisma.$executeRawUnsafe(`CREATE TABLE "new_PartStaging" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "supplierId" TEXT NOT NULL,
        "externalId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "partType" TEXT NOT NULL,
        "description" TEXT,
    "images" TEXT,
    "rawSpecs" TEXT,
    "normSpecs" TEXT,
        "priceMsrp" DECIMAL,
        "priceWh" DECIMAL,
        "hashContent" TEXT NOT NULL DEFAULT '',
        "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "shopifyProductId" TEXT,
    "shopifyVariantIds" TEXT,
        "publishedAt" DATETIME,
        "publishStatus" TEXT,
    "publishResult" TEXT
      );`)
    await prisma.$executeRawUnsafe(`INSERT INTO "new_PartStaging" (
        "id","supplierId","externalId","title","partType","description","images","rawSpecs","normSpecs",
        "priceMsrp","priceWh","hashContent","fetchedAt","shopifyProductId","shopifyVariantIds","publishedAt","publishStatus","publishResult"
      ) SELECT 
        "id","supplierId","externalId","title","partType","description","images","rawSpecs","normSpecs",
        "priceMsrp","priceWh","hashContent","fetchedAt","shopifyProductId","shopifyVariantIds","publishedAt","publishStatus","publishResult"
      FROM "PartStaging";`)
    await prisma.$executeRawUnsafe(`DROP TABLE "PartStaging";`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "new_PartStaging" RENAME TO "PartStaging";`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PartStaging_supplierId_externalId_key" ON "PartStaging"("supplierId", "externalId");`)
    await prisma.$executeRawUnsafe(`PRAGMA foreign_keys=ON;`)
    await prisma.$executeRawUnsafe(`PRAGMA defer_foreign_keys=OFF;`)
  }

  // Only run in SQLite
  const isSqlite = true
  if (!isSqlite) return

  if (await tableExists('ImportRun')) {
    const t = await getColumnTypes('ImportRun')
    if (t.summary && t.summary !== 'TEXT') {
      await rebuildImportRun()
    }
  }
  if (await tableExists('ImportDiff')) {
    const t = await getColumnTypes('ImportDiff')
    if ((t.before && t.before !== 'TEXT') || (t.after && t.after !== 'TEXT') || (t.validation && t.validation !== 'TEXT')) {
      await rebuildImportDiff()
    }
  }
  if (await tableExists('PartStaging')) {
    const t = await getColumnTypes('PartStaging')
    const needs = ['images','rawSpecs','normSpecs','publishResult','shopifyVariantIds'].some(k => (t[k]||'') !== 'TEXT')
    if (needs) {
      await rebuildPartStaging()
    }
  }
}

// Ensure ImportRun.progress JSON column exists (SQLite only)
async function ensureImportRunProgressColumn() {
  const hasTable = await tableExists('ImportRun')
  if (!hasTable) return
  const hasCol = await columnExists('ImportRun', 'progress')
  if (hasCol) return
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "ImportRun" ADD COLUMN "progress" JSON`)
  } catch {
    // ignore
  }
}
