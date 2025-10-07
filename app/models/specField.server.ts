// SENTINEL: products-workspace-v3-0 (Data access helpers)
// BEGIN products-workspace-v3-0
import { prisma } from '../db.server'
import { CORE_FIELD_PATH_SET } from './specTemplateCoreFields'

export function isCoreFieldRecord(f: { storage: string; coreFieldPath: string | null }) {
  return f.storage === 'CORE' && !!f.coreFieldPath && CORE_FIELD_PATH_SET.has(f.coreFieldPath)
}

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
  const maxPos = await prisma.specField.aggregate({
    where: { templateId: params.templateId },
    _max: { position: true },
  })
  const position = (maxPos._max.position ?? 0) + 1
  return prisma.specField.create({
    data: { ...params, position },
  })
}

export async function updateField(id: string, data: Record<string, FormDataEntryValue>) {
  const patch: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (['required'].includes(k)) patch[k] = v === 'on' || v === 'true'
    else if (['coreFieldPath', 'metafieldNamespace', 'metafieldKey', 'metafieldType'].includes(k))
      patch[k] = v === '' ? null : v
    else patch[k] = v
  }
  // If switching storage, clear the other mapping fields explicitly
  if (patch['storage'] === 'CORE') {
    patch['metafieldNamespace'] = null
    patch['metafieldKey'] = null
    patch['metafieldType'] = null
  } else if (patch['storage'] === 'METAFIELD') {
    patch['coreFieldPath'] = null
  }
  return prisma.specField.update({ where: { id }, data: patch })
}

export async function deleteField(id: string) {
  return prisma.specField.delete({ where: { id } })
}

export async function reorderField(id: string, direction: 'up' | 'down') {
  const current = await prisma.specField.findUnique({ where: { id } })
  if (!current) return null
  // Prevent reordering core fields
  if (isCoreFieldRecord({ storage: current.storage, coreFieldPath: current.coreFieldPath })) return current
  const swapWith = await prisma.specField.findFirst({
    where: {
      templateId: current.templateId,
      position: direction === 'up' ? { lt: current.position } : { gt: current.position },
    },
    orderBy: { position: direction === 'up' ? 'desc' : 'asc' },
  })
  if (!swapWith) return current
  // Do not swap with a core field (keep core block anchored)
  if (isCoreFieldRecord({ storage: swapWith.storage, coreFieldPath: swapWith.coreFieldPath })) return current
  await prisma.$transaction([
    prisma.specField.update({ where: { id: current.id }, data: { position: swapWith.position } }),
    prisma.specField.update({ where: { id: swapWith.id }, data: { position: current.position } }),
  ])
  return prisma.specField.findUnique({ where: { id } })
}
// END products-workspace-v3-0
