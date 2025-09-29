// SENTINEL: products-workspace-v3-0 (Data access helpers)
// BEGIN products-workspace-v3-0
import { prisma } from '../db.server'

export async function addField(params: {
  templateId: string
  key: string
  label: string
  type: 'text' | 'number' | 'boolean' | 'select'
  required?: boolean
  storage: 'CORE' | 'METAFIELD'
  coreFieldPath?: string | null
  metafieldNamespace?: string | null
  metafieldKey?: string | null
  metafieldType?: string | null
}) {
  // @ts-expect-error prisma type for custom models will exist after generate
  const maxPos = await prisma.specField.aggregate({
    where: { templateId: params.templateId },
    _max: { position: true },
  })
  const position = (maxPos._max.position ?? 0) + 1
  // @ts-expect-error prisma type for custom models will exist after generate
  return prisma.specField.create({
    data: { ...params, position },
  })
}

export async function updateField(id: string, data: Record<string, FormDataEntryValue>) {
  const patch: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (['required'].includes(k)) patch[k] = v === 'on' || v === 'true'
    else patch[k] = v
  }
  // @ts-expect-error prisma type for custom models will exist after generate
  return prisma.specField.update({ where: { id }, data: patch })
}

export async function deleteField(id: string) {
  // @ts-expect-error prisma type for custom models will exist after generate
  return prisma.specField.delete({ where: { id } })
}

export async function reorderField(id: string, direction: 'up' | 'down') {
  // @ts-expect-error prisma type for custom models will exist after generate
  const current = await prisma.specField.findUnique({ where: { id } })
  if (!current) return null
  // @ts-expect-error prisma type for custom models will exist after generate
  const swapWith = await prisma.specField.findFirst({
    where: {
      templateId: current.templateId,
      position: direction === 'up' ? { lt: current.position } : { gt: current.position },
    },
    orderBy: { position: direction === 'up' ? 'desc' : 'asc' },
  })
  if (!swapWith) return current
  await prisma.$transaction([
    // @ts-expect-error prisma type for custom models will exist after generate
    prisma.specField.update({ where: { id: current.id }, data: { position: swapWith.position } }),
    // @ts-expect-error prisma type for custom models will exist after generate
    prisma.specField.update({ where: { id: swapWith.id }, data: { position: current.position } }),
  ])
  // @ts-expect-error prisma type for custom models will exist after generate
  return prisma.specField.findUnique({ where: { id } })
}
// END products-workspace-v3-0
