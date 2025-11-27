import crypto from 'node:crypto'
import type { DesignStudioAnnotation } from './annotations.server'
import { prisma } from '../../db.server'

export async function recordDesignStudioAudit({
  productId,
  productVersionId,
  ds,
  source = 'admin',
}: {
  productId: string
  productVersionId?: string | null
  ds: DesignStudioAnnotation
  source?: string
}) {
  try {
    const last = await prisma.$queryRawUnsafe<Array<{ designStudioHash: string }>>(
      'SELECT designStudioHash FROM DesignStudioAnnotationAudit WHERE productId = ? ORDER BY recordedAt DESC LIMIT 1',
      productId,
    )
    if (last?.[0]?.designStudioHash === ds.hash) return
    await prisma.$executeRawUnsafe(
      `INSERT INTO DesignStudioAnnotationAudit (
         id, productId, productVersionId, designStudioHash, ready, family, series, role,
         coverageNotes, sourceQuality, compatibility, recordedAt, source
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
      crypto.randomUUID(),
      productId,
      productVersionId ?? null,
      ds.hash,
      ds.ready ? 1 : 0,
      ds.family ?? null,
      ds.series ?? null,
      ds.role ?? null,
      ds.coverageNotes ?? null,
      ds.sourceQuality ?? null,
      ds.compatibility ? JSON.stringify(ds.compatibility) : null,
      source,
    )
  } catch {
    /* ignore audit failures */
  }
}
