// <!-- BEGIN RBP GENERATED: products-module-v3-0 -->
/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../db.server'

export async function deleteField(id: string) {
  const db: any = prisma
  await db.specField.delete({ where: { id } })
}

export async function upsertField(input: {
  id?: string
  templateId: string
  key: string
  label: string
  type: string
  required?: boolean
  storageMode?: 'PRODUCT_FIELD' | 'METAFIELD'
  position?: number
  productField?: string | null
  namespace?: string | null
  metafieldKey?: string | null
  metafieldType?: string | null
}) {
  const db: any = prisma
  const data = {
    templateId: input.templateId,
    key: input.key,
    label: input.label,
    type: input.type,
    required: Boolean(input.required),
    storageMode: input.storageMode || 'METAFIELD',
    position: input.position ?? 0,
    productField: input.productField ?? null,
    namespace: input.namespace ?? null,
    metafieldKey: input.metafieldKey ?? null,
    metafieldType: input.metafieldType ?? null,
  }
  if (input.id) {
    return db.specField.update({ where: { id: input.id }, data })
  }
  return db.specField.create({ data })
}
// <!-- END RBP GENERATED: products-module-v3-0 -->
