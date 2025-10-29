// SENTINEL: products-workspace-v3-0 (Data access helpers)
// BEGIN products-workspace-v3-0
import { prisma } from '../db.server'
import { buildCoreFieldDefsForTemplate } from './specTemplateCoreFields'

export async function listTemplatesSummary() {
  // Robust against missing 'cost' column in production by avoiding Prisma's implicit column list.
  // 1) Detect if 'cost' column exists via PRAGMA (SQLite only).
  let hasCost = false
  try {
    const cols = await prisma.$queryRawUnsafe<Array<{ name: string }>>("PRAGMA table_info('SpecTemplate')")
    hasCost = Array.isArray(cols) && cols.some(c => c.name === 'cost')
  } catch {
    hasCost = false
  }
  // 2) Read templates via raw SQL selecting only existing columns
  type Row = { id: string; name: string; updatedAt: string; cost?: number | null }
  const baseSql = hasCost
    ? `SELECT id, name, updatedAt, cost FROM SpecTemplate ORDER BY updatedAt DESC`
    : `SELECT id, name, updatedAt FROM SpecTemplate ORDER BY updatedAt DESC`
  const rows = await prisma.$queryRawUnsafe<Row[]>(baseSql)
  // 3) Compute fields count per template
  const counts = await prisma.$queryRawUnsafe<Array<{ templateId: string; fieldsCount: number }>>(
    `SELECT templateId, COUNT(*) as fieldsCount FROM SpecField GROUP BY templateId`,
  )
  const countByTpl = new Map(counts.map(c => [c.templateId, Number(c.fieldsCount || 0)]))
  // <!-- BEGIN RBP GENERATED: importer-templates-orphans-v1 -->
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    fieldsCount: countByTpl.get(r.id) || 0,
    updatedAt: new Date(r.updatedAt).toISOString(),
    cost: hasCost ? (typeof r.cost === 'number' ? r.cost : (r.cost ?? null)) : null,
  }))
  // <!-- END RBP GENERATED: importer-templates-orphans-v1 -->
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

  // Load current core fields (by coreFieldPath) so we can remap their keys to the new prefix
  const currentCore = await prisma.specField.findMany({
    where: { templateId: id, storage: 'CORE', coreFieldPath: { not: null } },
    select: { id: true, key: true, coreFieldPath: true },
  })
  const newDefs = buildCoreFieldDefsForTemplate(finalName)
  const defsByPath = new Map(newDefs.map(d => [d.coreFieldPath, d]))

  // Collect updates only for fields whose path matches known core definitions
  const updates: Array<ReturnType<typeof prisma.specField.update>> = []
  for (const f of currentCore) {
    if (!f.coreFieldPath) continue
    const next = defsByPath.get(f.coreFieldPath)
    if (next && next.key !== f.key) {
      updates.push(prisma.specField.update({ where: { id: f.id }, data: { key: next.key } }))
    }
  }

  return prisma.$transaction([prisma.specTemplate.update({ where: { id }, data: { name: finalName } }), ...updates])
}
// END products-workspace-v3-0
