// <!-- BEGIN RBP GENERATED: importer-logs-recent-v1 -->
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const { prisma } = await import('../db.server')

  try {
    const logs = (await (prisma as any).importLog.findMany({ orderBy: { at: 'desc' }, take: 25 })) as Array<{
      at: string
      templateId: string
      runId: string
      type: string
      payload?: unknown
    }>
    const templates = (await (prisma as any).importTemplate.findMany({ select: { id: true, name: true } })) as Array<{
      id: string
      name?: string | null
    }>
    const templateNames = Object.fromEntries(templates.map(t => [t.id, t.name || t.id])) as Record<string, string>
    return json({ logs, templateNames })
  } catch {
    return json({ logs: [], templateNames: {} })
  }
}

export default function ImporterLogsApi() {
  return null
}
// <!-- END RBP GENERATED: importer-logs-recent-v1 -->
