import { prisma } from '../db.server'

export async function upsertMapping(productType: string, templateId: string) {
  return prisma.productTypeTemplateMap.upsert({
    where: { productType },
    update: { templateId },
    create: { productType, templateId },
  })
}

export async function deleteMapping(productType: string) {
  return prisma.productTypeTemplateMap.delete({ where: { productType } })
}

export async function listMappings() {
  return prisma.productTypeTemplateMap.findMany({ orderBy: { productType: 'asc' } })
}

export async function getTemplateForProductType(productType: string) {
  const m = await prisma.productTypeTemplateMap.findUnique({ where: { productType } })
  return m?.templateId ?? null
}
