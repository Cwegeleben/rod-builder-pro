// <!-- BEGIN RBP GENERATED: importer-normalize-diff-v1 -->
import crypto from 'crypto'
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
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify([r.title, r.partType, norm.specs, r.images]))
      .digest('hex')
    await prisma.partStaging.update({
      where: { supplierId_externalId: { supplierId: r.supplierId, externalId: r.externalId } },
      data: { normSpecs: norm.specs as any, hashContent: hash },
    })
  }
}
// <!-- END RBP GENERATED: importer-normalize-diff-v1 -->
