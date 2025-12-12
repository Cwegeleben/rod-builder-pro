// <!-- BEGIN RBP GENERATED: importer-normalize-diff-v1 -->
// crypto no longer needed; hashing performed in upsertStaging
import { prisma } from '../../../../app/db.server'
import { normalize } from './normalize'
import { normalizeBatsonProduct } from '../../../../app/services/suppliers/batsonNormalize.server'

const extractImageUrls = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string' && !!entry)
}

export async function applyNormalizationToStaging(supplierId: string) {
  const rows = await prisma.partStaging.findMany({ where: { supplierId } })
  for (const r of rows) {
    const rawSpecs = (r.rawSpecs as unknown as Record<string, unknown>) || {}
    const description = r.description || ''
    const isBatsonSupplier = supplierId.toLowerCase().includes('batson')
    const images = extractImageUrls(r.images)
    const heroImage = images.length ? images[0] : null
    const normSpecs = isBatsonSupplier
      ? (normalizeBatsonProduct({
          externalId: r.externalId,
          partType: r.partType,
          title: r.title,
          description,
          rawSpecs,
          availability: r.availability || null,
          priceMsrp: (r.priceMsrp as number | null) ?? null,
          images,
          imageUrl: heroImage,
        }) as Record<string, unknown> | null)
      : normalize({
          title: r.title,
          partType: r.partType,
          rawSpecs,
          description,
        }).specs
    // Content hash recomputed inside upsertStaging; local hash not needed here.
    // Use dynamic upsert helper instead of direct update for broader compatibility
    const { upsertStaging } = await import('../staging/upsert')
    await upsertStaging(r.supplierId, {
      templateId: (r as { templateId?: string | null }).templateId || undefined,
      externalId: r.externalId,
      title: r.title,
      partType: r.partType,
      description: r.description || '',
      images,
      rawSpecs: (r.rawSpecs as unknown as Record<string, unknown>) || {},
      normSpecs: normSpecs || {},
    })
  }
}
// <!-- END RBP GENERATED: importer-normalize-diff-v1 -->
