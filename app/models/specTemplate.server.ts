// SENTINEL: products-workspace-v3-0 (Data access helpers)
// BEGIN products-workspace-v3-0
import { prisma } from '../db.server'

export async function listTemplatesSummary() {
  // @ts-expect-error prisma type for custom models will exist after generate
  const templates = await prisma.specTemplate.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { fields: true } } },
  })
  return (templates as Array<{ id: string; name: string; _count: { fields: number }; updatedAt: Date }>).map(t => ({
    id: t.id,
    name: t.name,
    fieldsCount: t._count.fields,
    updatedAt: new Date(t.updatedAt).toISOString(),
  }))
}

export async function createTemplate(name: string) {
  // @ts-expect-error prisma type for custom models will exist after generate
  const created = await prisma.specTemplate.create({ data: { name } })
  return created
}

export async function deleteTemplates(ids: string[]) {
  // @ts-expect-error prisma type for custom models will exist after generate
  await prisma.specTemplate.deleteMany({ where: { id: { in: ids } } })
}

export async function getTemplateWithFields(id: string) {
  // @ts-expect-error prisma type for custom models will exist after generate
  return prisma.specTemplate.findUnique({
    where: { id },
    include: { fields: { orderBy: { position: 'asc' } } },
  })
}

export async function renameTemplate(id: string, name: string) {
  // @ts-expect-error prisma type for custom models will exist after generate
  return prisma.specTemplate.update({ where: { id }, data: { name } })
}
// END products-workspace-v3-0
