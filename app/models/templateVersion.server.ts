// Versioning utilities for SpecTemplate
import { prisma } from '../db.server'
// Prisma types inferred via client at runtime; no direct model types imported to avoid unused warnings

export interface FieldShape {
  id?: string
  key: string
  label: string
  type: string
  required: boolean
  position: number
  storage: string
  coreFieldPath?: string | null
  metafieldNamespace?: string | null
  metafieldKey?: string | null
  metafieldType?: string | null
}

export interface TemplateSnapshotData {
  name: string
  fields: FieldShape[]
}

export async function loadTemplateSnapshotData(templateId: string): Promise<TemplateSnapshotData | null> {
  const tpl = await prisma.specTemplate.findUnique({
    where: { id: templateId },
    include: { fields: { orderBy: { position: 'asc' } } },
  })
  if (!tpl) return null
  return {
    name: tpl.name,
    fields: tpl.fields.map(f => ({
      id: f.id,
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      position: f.position,
      storage: f.storage,
      coreFieldPath: f.coreFieldPath,
      metafieldNamespace: f.metafieldNamespace,
      metafieldKey: f.metafieldKey,
      metafieldType: f.metafieldType,
    })),
  }
}

export async function snapshotTemplate(templateId: string) {
  const data = await loadTemplateSnapshotData(templateId)
  if (!data) throw new Error('Template not found')
  // Determine next version number
  const last = await prisma.templateVersion.findFirst({
    where: { templateId },
    orderBy: { versionNumber: 'desc' },
    select: { versionNumber: true },
  })
  const nextVersion = (last?.versionNumber || 0) + 1
  const created = await prisma.templateVersion.create({
    data: {
      templateId,
      versionNumber: nextVersion,
      // Ensure type compatibility with InputJsonValue
      dataJson: JSON.parse(JSON.stringify(data)),
    },
  })
  // Update lastPublishedVersionId on SpecTemplate
  return created
}

export interface DiffResult {
  added: FieldShape[]
  removed: FieldShape[]
  changed: Array<{ key: string; before: FieldShape; after: FieldShape; changes: string[] }>
  unchangedCount: number
}

function fieldKeyMap(fields: FieldShape[]) {
  const m = new Map<string, FieldShape>()
  for (const f of fields) m.set(f.key, f)
  return m
}

export function diffTemplate(published: TemplateSnapshotData | null, current: TemplateSnapshotData | null): DiffResult {
  const pubFields = published?.fields || []
  const curFields = current?.fields || []
  const pubMap = fieldKeyMap(pubFields)
  const curMap = fieldKeyMap(curFields)
  const added: FieldShape[] = []
  const removed: FieldShape[] = []
  const changed: Array<{ key: string; before: FieldShape; after: FieldShape; changes: string[] }> = []
  let unchangedCount = 0

  for (const f of curFields) {
    if (!pubMap.has(f.key)) {
      added.push(f)
      continue
    }
    const before = pubMap.get(f.key)!
    const after = f
    const diffs: string[] = []
    if (before.label !== after.label) diffs.push('label')
    if (before.type !== after.type) diffs.push('type')
    if (before.required !== after.required) diffs.push('required')
    if (before.storage !== after.storage) diffs.push('storage')
    if (before.coreFieldPath !== after.coreFieldPath) diffs.push('coreFieldPath')
    if (before.metafieldNamespace !== after.metafieldNamespace) diffs.push('metafieldNamespace')
    if (before.metafieldKey !== after.metafieldKey) diffs.push('metafieldKey')
    if (before.metafieldType !== after.metafieldType) diffs.push('metafieldType')
    if (diffs.length) changed.push({ key: f.key, before, after, changes: diffs })
    else unchangedCount += 1
  }
  for (const f of pubFields) {
    if (!curMap.has(f.key)) removed.push(f)
  }
  return { added, removed, changed, unchangedCount }
}

export async function loadPublishedSnapshot(templateId: string): Promise<TemplateSnapshotData | null> {
  const ver = await prisma.templateVersion.findFirst({
    where: { templateId },
    orderBy: { versionNumber: 'desc' },
  })
  if (!ver) return null
  return ver.dataJson as unknown as TemplateSnapshotData
}
