// <!-- BEGIN RBP GENERATED: staging-upsert-v1 -->
import crypto from 'crypto'
import { prisma } from '../../../../app/db.server'

export async function upsertStaging(
  supplierId: string,
  rec: {
    externalId: string
    title: string
    partType: string
    description?: string
    images: string[]
    rawSpecs: Record<string, unknown>
  },
) {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify([rec.title, rec.partType, rec.rawSpecs, rec.images]))
    .digest('hex')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = prisma
  await client.partStaging.upsert({
    where: { supplierId_externalId: { supplierId, externalId: rec.externalId } },
    update: {
      title: rec.title,
      partType: rec.partType,
      description: rec.description || '',
      images: rec.images,
      rawSpecs: rec.rawSpecs,
      hashContent: hash,
      fetchedAt: new Date(),
    },
    create: {
      supplierId,
      externalId: rec.externalId,
      title: rec.title,
      partType: rec.partType,
      description: rec.description || '',
      images: rec.images,
      rawSpecs: rec.rawSpecs,
      hashContent: hash,
    },
  })
}
// <!-- END RBP GENERATED: staging-upsert-v1 -->
