// <!-- BEGIN RBP GENERATED: staging-upsert-v1 -->
import crypto from 'crypto'
import { prisma } from '../../../../app/db.server'
import { deriveDesignStudioAnnotations } from '../../../../app/lib/designStudio/annotations.server'

export async function upsertStaging(
  supplierId: string,
  rec: {
    templateId?: string
    externalId: string
    title: string
    partType: string
    description?: string
    images: string[]
    rawSpecs: Record<string, unknown>
    normSpecs?: Record<string, unknown>
    priceMsrp?: number | null
    priceWh?: number | null
    availability?: string | null
  },
) {
  // Defensive coercion: ensure decimals are numbers or null only
  const toNumOrNull = (v: unknown): number | null | undefined => {
    if (v === undefined) return undefined
    if (v === null) return null
    if (typeof v === 'number') return isNaN(v) ? null : v
    if (typeof v === 'string') {
      const cleaned = v.replace(/[^\d.-]/g, '')
      if (!cleaned) return null
      const n = Number(cleaned)
      return isNaN(n) ? null : n
    }
    return null
  }
  const priceMsrp = toNumOrNull(rec.priceMsrp)
  const priceWh = toNumOrNull(rec.priceWh)
  const hash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify([
        rec.title,
        rec.partType,
        rec.rawSpecs,
        rec.normSpecs || {},
        rec.images,
        priceMsrp ?? null,
        priceWh ?? null,
        rec.availability ?? null,
      ]),
    )
    .digest('hex')
  const designStudio = deriveDesignStudioAnnotations({
    supplierKey: supplierId,
    partType: rec.partType,
    title: rec.title,
    rawSpecs: rec.rawSpecs,
    normSpecs: rec.normSpecs,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = prisma
  // Use named composite unique (supplierId, templateId, externalId)
  const whereKey: Record<string, unknown> = {
    part_staging_supplier_template_ext_unique: {
      supplierId,
      templateId: rec.templateId ?? null,
      externalId: rec.externalId,
    },
  }
  await client.partStaging.upsert({
    where: whereKey as never,
    update: {
      title: rec.title,
      partType: rec.partType,
      description: rec.description || '',
      images: rec.images,
      rawSpecs: rec.rawSpecs,
      normSpecs: rec.normSpecs || undefined,
      priceMsrp: priceMsrp ?? undefined,
      priceWh: priceWh ?? undefined,
      hashContent: hash,
      fetchedAt: new Date(),
      designStudioReady: designStudio.ready,
      designStudioFamily: designStudio.family || null,
      designStudioSeries: designStudio.series || null,
      designStudioRole: designStudio.role,
      designStudioCompatibility: designStudio.compatibility,
      designStudioCoverageNotes: designStudio.coverageNotes || null,
      designStudioSourceQuality: designStudio.sourceQuality || null,
      designStudioHash: designStudio.hash,
    },
    create: {
      supplierId,
      templateId: rec.templateId || null,
      externalId: rec.externalId,
      title: rec.title,
      partType: rec.partType,
      description: rec.description || '',
      images: rec.images,
      rawSpecs: rec.rawSpecs,
      normSpecs: rec.normSpecs || undefined,
      priceMsrp: priceMsrp ?? undefined,
      priceWh: priceWh ?? undefined,
      hashContent: hash,
      designStudioReady: designStudio.ready,
      designStudioFamily: designStudio.family || null,
      designStudioSeries: designStudio.series || null,
      designStudioRole: designStudio.role,
      designStudioCompatibility: designStudio.compatibility,
      designStudioCoverageNotes: designStudio.coverageNotes || null,
      designStudioSourceQuality: designStudio.sourceQuality || null,
      designStudioHash: designStudio.hash,
    },
  })
}
// <!-- END RBP GENERATED: staging-upsert-v1 -->
