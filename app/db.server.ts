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
    } catch (err) {
      console.warn('[startup] schema check failed (non-fatal):', err)
    }
  })()
}

export { prisma }
