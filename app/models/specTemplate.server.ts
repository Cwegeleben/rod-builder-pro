// <!-- BEGIN RBP GENERATED: products-module-v3-0 -->
/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../db.server'

// Local lightweight types to avoid dependency on generated Prisma types at dev-time
export interface SpecTemplateLite {
  id: string
  title: string
  handle: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}

export interface SpecFieldLite {
  id: string
  templateId: string
  key: string
  label: string
  type: string
  required: boolean
  storageMode: 'PRODUCT_FIELD' | 'METAFIELD'
  position: number
  productField?: 'TITLE' | 'BODY_HTML' | 'VENDOR' | 'PRODUCT_TYPE' | 'TAGS' | null
  namespace?: string | null
  metafieldKey?: string | null
  metafieldType?: string | null
}

export type TemplateWithFields = SpecTemplateLite & { fields: SpecFieldLite[] }

function toHandle(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function listTemplates(
  params: {
    q?: string
    sort?: 'updatedAt' | 'title'
    direction?: 'asc' | 'desc'
    page?: number
    perPage?: number
    minFields?: number
    maxFields?: number
  } = {},
) {
  const { q, sort = 'updatedAt', direction = 'desc', page = 1, perPage = 25, minFields, maxFields } = params
  const where: any = {}
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { handle: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ]
  }
  const orderBy: any = { [sort]: direction }
  const db: any = prisma
  const [total, items] = await Promise.all([
    db.specTemplate.count({ where }),
    db.specTemplate.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      include: { fields: true },
    }),
  ])

  const filteredItems = (items as TemplateWithFields[]).filter(t => {
    const count = t.fields.length
    if (minFields != null && count < minFields) return false
    if (maxFields != null && count > maxFields) return false
    return true
  })

  return { total, items: filteredItems }
}

export async function getTemplateById(id: string) {
  const db: any = prisma
  return db.specTemplate.findUnique({ where: { id }, include: { fields: { orderBy: { position: 'asc' } } } })
}

export async function createTemplate(data: { title: string; description?: string | null }) {
  const handleBase = toHandle(data.title || 'template')
  let handle = handleBase || 'template'
  let i = 1
  const db: any = prisma
  while (await db.specTemplate.findUnique({ where: { handle } })) {
    handle = `${handleBase}-${i++}`
  }
  return db.specTemplate.create({ data: { title: data.title, description: data.description ?? null, handle } })
}

export async function updateTemplate(
  id: string,
  data: Partial<Pick<SpecTemplateLite, 'title' | 'description' | 'handle'>>,
) {
  // If title changes and handle not provided, derive a new unique handle
  const patch: any = { ...data }
  if (data.title && !data.handle) {
    const handleBase = toHandle(data.title)
    let handle = handleBase || 'template'
    let i = 1
    const db: any = prisma
    while (true) {
      const exists = await db.specTemplate.findFirst({ where: { handle, NOT: { id } } })
      if (!exists) break
      handle = `${handleBase}-${i++}`
    }
    patch.handle = handle
  }
  const db: any = prisma
  return db.specTemplate.update({ where: { id }, data: patch })
}

export async function deleteTemplates(ids: string[]) {
  const db: any = prisma
  await db.specField.deleteMany({ where: { templateId: { in: ids } } })
  await db.specTemplate.deleteMany({ where: { id: { in: ids } } })
}

export async function upsertTemplateWithFields(input: {
  id?: string
  title: string
  description?: string | null
  handle?: string
  fields: Array<Partial<SpecFieldLite> & { id?: string; key: string; label: string; type: string; position?: number }>
}) {
  const { id, title, description, handle, fields } = input

  let template: SpecTemplateLite
  if (id) {
    const db: any = prisma
    template = await db.specTemplate.update({
      where: { id },
      data: { title, description: description ?? null, handle },
    })
    await db.specField.deleteMany({
      where: { templateId: id, id: { notIn: fields.filter(f => f.id).map(f => String(f.id)) } },
    })
  } else {
    template = await createTemplate({ title, description: description ?? null })
  }

  for (const [index, f] of fields.entries()) {
    const base = {
      templateId: template.id,
      key: f.key!,
      label: f.label!,
      type: f.type!,
      required: Boolean(f.required),
      storageMode: f.storageMode as any,
      position: f.position ?? index,
      productField: f.productField as any,
      namespace: f.namespace ?? null,
      metafieldKey: f.metafieldKey ?? null,
      metafieldType: f.metafieldType ?? null,
    }
    const db: any = prisma
    if (f.id) {
      await db.specField.update({ where: { id: String(f.id) }, data: base })
    } else {
      await db.specField.create({ data: base })
    }
  }

  return getTemplateById(template.id)
}
// <!-- END RBP GENERATED: products-module-v3-0 -->
