// SENTINEL: products-workspace-v3-0 (Data access helpers)
// BEGIN products-workspace-v3-0
import { prisma } from '../db.server'

export async function listTemplatesSummary() {
  const templates = await prisma.specTemplate.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { fields: true } } },
  })
  return templates.map((t: { id: string; name: string; updatedAt: Date; _count: { fields: number } }) => ({
    id: t.id,
    name: t.name,
    fieldsCount: t._count.fields,
    updatedAt: new Date(t.updatedAt).toISOString(),
  }))
}

async function nextUniqueName(base: string) {
  // Find existing names that match base or base (n)
  const existing = await prisma.specTemplate.findMany({
    where: {
      OR: [{ name: base }, { name: { startsWith: base + ' (' } }],
    },
    select: { name: true },
  })
  if (existing.length === 0) return base
  // Compute max suffix
  let max = 1
  for (const { name } of existing) {
    if (name === base) {
      max = Math.max(max, 1)
      continue
    }
    const m = name.match(/^(.+) \((\d+)\)$/)
    if (m && m[1] === base) {
      const n = parseInt(m[2], 10)
      if (!Number.isNaN(n)) max = Math.max(max, n)
    }
  }
  return `${base} (${max + 1})`
}

export async function createTemplate(name: string) {
  const unique = await nextUniqueName(name)
  const created = await prisma.specTemplate.create({ data: { name: unique } })
  return created
}

export async function deleteTemplates(ids: string[]) {
  await prisma.specTemplate.deleteMany({ where: { id: { in: ids } } })
}

export async function getTemplateWithFields(id: string) {
  return prisma.specTemplate.findUnique({
    where: { id },
    include: { fields: { orderBy: { position: 'asc' } } },
  })
}

export async function renameTemplate(id: string, name: string) {
  // If the desired name is taken by another template, pick a unique variant
  const desired = name.trim()
  if (!desired) return prisma.specTemplate.update({ where: { id }, data: { name } })
  const taken = await prisma.specTemplate.findFirst({ where: { name: desired, NOT: { id } }, select: { id: true } })
  const finalName = taken ? await nextUniqueName(desired) : desired
  return prisma.specTemplate.update({ where: { id }, data: { name: finalName } })
}
// END products-workspace-v3-0
