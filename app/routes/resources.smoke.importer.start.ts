import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
// Note: avoid importing prisma at module top to prevent constructor-time failures; import lazily in the loader
// import type { Prisma } from '@prisma/client'
import { guardSmokeRoute } from '../lib/smokes.server'

export const loader = async (args: LoaderFunctionArgs) => {
  try {
    guardSmokeRoute(args)
    // Lazy import prisma to reduce risk of top-level import errors
    const { prisma } = await import('../db.server')
    // Ensure minimal importer tables exist synchronously before first write
    try {
      await prisma.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS ImportRun (id TEXT PRIMARY KEY NOT NULL, supplierId TEXT NOT NULL, startedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, finishedAt DATETIME, status TEXT NOT NULL, progress TEXT, summary TEXT)',
      )
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS ImportRun_supplier_idx ON ImportRun(supplierId)')
    } catch (e) {
      // proceed; if this fails, the create below will surface a clearer error
      console.warn('[smoke:start] ensure ImportRun failed:', e)
    }
    // Create a minimal ImportRun using raw SQL to avoid JSON column conversion issues
    const id = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string
    await prisma.$executeRawUnsafe(
      'INSERT INTO ImportRun (id, supplierId, status) VALUES (?, ?, ?)',
      id,
      'smoke',
      'started',
    )
    return json({ ok: true, runId: id })
  } catch (e) {
    const msg = (e as Error)?.message || 'Unexpected error'
    return json({ ok: false, error: msg }, { status: 500 })
  }
}

export const handle = { private: true }
