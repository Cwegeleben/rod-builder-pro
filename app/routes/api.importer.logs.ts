// <!-- BEGIN RBP GENERATED: importer-logs-recent-v1 -->
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const { prisma } = await import('../db.server')

  try {
    const url = new URL(request.url)
    const take = Math.min(200, Math.max(1, Number(url.searchParams.get('take') || 25)))
    const sinceRaw = url.searchParams.get('since') || ''
    const beforeRaw = url.searchParams.get('before') || ''

    const parseSince = (s: string): Date | undefined => {
      if (!s) return undefined
      const now = Date.now()
      if (/^\d+h$/.test(s)) return new Date(now - Number(s.replace('h', '')) * 60 * 60 * 1000)
      if (/^\d+d$/.test(s)) return new Date(now - Number(s.replace('d', '')) * 24 * 60 * 60 * 1000)
      const d = new Date(s)
      return isNaN(d.getTime()) ? undefined : d
    }
    const parseBefore = (s: string): Date | undefined => {
      if (!s) return undefined
      const d = new Date(s)
      return isNaN(d.getTime()) ? undefined : d
    }

    const since = parseSince(sinceRaw)
    const before = parseBefore(beforeRaw)

    const where: any = {}
    if (since || before) where.at = {}
    if (since) where.at.gte = since
    if (before) where.at.lt = before

    const logs = (await (prisma as any).importLog.findMany({
      where,
      orderBy: { at: 'desc' },
      take,
    })) as Array<{
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
