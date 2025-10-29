// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../../../../../app/db.server'

export const importerRepo = {
  async get(templateId: string) {
    const tpl = await (prisma as any).importTemplate.findUnique({ where: { id: templateId } })
    return tpl ?? null
  },
  async upsert(
    templateId: string,
    patch: Partial<{
      name: string
      importConfig: unknown
      state: string
      lastRunAt?: string | Date | null
      hadFailures?: boolean
    }>,
  ) {
    return (prisma as any).importTemplate.upsert({
      where: { id: templateId },
      create: {
        id: templateId,
        name: patch.name ?? templateId,
        importConfig: patch.importConfig ?? {},
        state: patch.state ?? 'NEEDS_SETTINGS',
        hadFailures: !!patch.hadFailures,
        ...(patch.lastRunAt ? { lastRunAt: new Date(patch.lastRunAt) } : {}),
      },
      update: {
        ...(patch.name ? { name: patch.name } : {}),
        ...(patch.importConfig ? { importConfig: patch.importConfig } : {}),
        ...(patch.state ? { state: patch.state } : {}),
        ...(patch.hadFailures != null ? { hadFailures: !!patch.hadFailures } : {}),
        ...(patch.lastRunAt ? { lastRunAt: new Date(patch.lastRunAt) } : {}),
      },
    })
  },
  async appendLog(templateId: string, runId: string, type: string, payload: unknown) {
    await (prisma as any).importLog.create({
      data: { templateId, runId, type, payload },
    })
  },
  async listLogs(templateId: string, limit = 50) {
    return (prisma as any).importLog.findMany({
      where: { templateId },
      orderBy: { at: 'desc' },
      take: limit,
    })
  },
}
// <!-- END RBP GENERATED: importer-v2-3 -->
