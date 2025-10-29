// hq-importer-new-import-v2
import { prisma } from '../db.server'
import type { AliasMemory, AxesMap } from '../services/importer/zeroConfigMapper.server'

export type RunMappingSnapshot = {
  id: string
  runId: string
  templateId: string
  scraperId: string
  mapping: {
    aliases: AliasMemory
    axes: AxesMap
  }
  createdAt: Date
}

export async function loadTemplateAliases(templateId: string): Promise<AliasMemory> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  const rows: Array<{ labelNorm: string; fieldKey: string; source: string; confidence: number }> =
    await db.templateAlias.findMany({
      where: { templateId },
      select: { labelNorm: true, fieldKey: true, source: true, confidence: true },
    })
  return rows.map(r => ({
    label: r.labelNorm,
    fieldKey: r.fieldKey,
    source: (r.source as 'auto' | 'manual') || 'manual',
    confidence: r.confidence,
  }))
}

export async function rememberTemplateAlias(
  templateId: string,
  labelNorm: string,
  fieldKey: string,
  source: 'manual' | 'auto' = 'manual',
  confidence = 1.0,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  await db.templateAlias.upsert({
    where: { template_alias_unique: { templateId, labelNorm } },
    create: { templateId, labelNorm, fieldKey, source, confidence },
    update: { fieldKey, source, confidence },
  })
}

export async function saveRunMappingSnapshot(args: {
  runId: string
  templateId: string
  scraperId: string
  aliases: AliasMemory
  axes: { o1?: string; o2?: string; o3?: string }
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  const mapping = {
    aliases: args.aliases,
    axes: args.axes,
  }
  await db.runMappingSnapshot.upsert({
    where: { runId: args.runId },
    create: { runId: args.runId, templateId: args.templateId, scraperId: args.scraperId, mapping },
    update: { templateId: args.templateId, scraperId: args.scraperId, mapping },
  })
}

export async function loadRunMappingSnapshot(runId: string): Promise<RunMappingSnapshot | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  const row = (await db.runMappingSnapshot.findUnique({ where: { runId } })) as RunMappingSnapshot | null
  return row
}

export async function saveRunItemMapping(args: {
  runId: string
  itemKey: string
  applied: Record<string, unknown>
  diagnostics: { missing?: string[]; sources?: Record<string, unknown> }
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  await db.runItemMapping.upsert({
    where: { run_item_mapping_unique: { runId: args.runId, itemKey: args.itemKey } },
    create: { runId: args.runId, itemKey: args.itemKey, applied: args.applied, diagnostics: args.diagnostics },
    update: { applied: args.applied, diagnostics: args.diagnostics },
  })
}
