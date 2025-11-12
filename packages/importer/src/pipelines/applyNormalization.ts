// <!-- BEGIN RBP GENERATED: importer-normalize-diff-v1 -->
// crypto no longer needed; hashing performed in upsertStaging
import { prisma } from '../../../../app/db.server'
import { normalize } from './normalize'

export async function applyNormalizationToStaging(supplierId: string) {
  const rows = await prisma.partStaging.findMany({ where: { supplierId } })
  for (const r of rows) {
    const norm = normalize({
      title: r.title,
      partType: r.partType,
      rawSpecs: (r.rawSpecs as unknown as Record<string, unknown>) || {},
      description: r.description || '',
    })
    // Content hash recomputed inside upsertStaging; local hash not needed here.
    // Use dynamic upsert helper instead of direct update for broader compatibility
    const { upsertStaging } = await import('../staging/upsert')
    await upsertStaging(r.supplierId, {
      templateId: (r as { templateId?: string | null }).templateId || undefined,
      externalId: r.externalId,
      title: r.title,
      partType: r.partType,
      description: r.description || '',
      images: (r.images as unknown as string[]) || [],
      rawSpecs: (r.rawSpecs as unknown as Record<string, unknown>) || {},
      normSpecs: (norm.specs as Record<string, unknown>) || {},
    })
  }
}
// <!-- END RBP GENERATED: importer-normalize-diff-v1 -->
