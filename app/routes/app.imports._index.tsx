// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
/* eslint-disable @typescript-eslint/no-explicit-any */
// Index route for /app/imports. Composes the admin portal Imports home UI.
import ImportsHome from '../../src/apps/admin.portal/app/routes/app.imports._index'
import { useLocation, useLoaderData } from '@remix-run/react'
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
// import { isProductDbExclusive } from '../lib/flags.server'

type LoaderData = {
  templates: Array<{ id: string; name?: string; state: string; hadFailures?: boolean; lastRunAt?: string | null }>
  logs: Array<{ at: string; templateId: string; runId: string; type: string; payload?: unknown }>
  templateNames: Record<string, string>
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const { prisma } = await import('../db.server')
  try {
    const rows = await (prisma as any).importTemplate.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, state: true, hadFailures: true, lastRunAt: true },
    })
    // Grab recent logs (global view)
    const logs = await (prisma as any).importLog.findMany({ orderBy: { at: 'desc' }, take: 25 })
    const templateNames = Object.fromEntries(rows.map((r: any) => [r.id, r.name || r.id])) as Record<string, string>
    return json<LoaderData>({ templates: rows, logs, templateNames })
  } catch {
    return json<LoaderData>({ templates: [], logs: [], templateNames: {} })
  }
}

export default function ImportsIndexRoute() {
  const location = useLocation()
  const data = useLoaderData<typeof loader>() as LoaderData
  // <!-- BEGIN RBP GENERATED: importer-v2-3-batson-series-v1 -->
  // Display validation status only in the Imports list; no validation triggers/actions here.
  // Passing through server state for badges; actions (validate/test) remain in Settings.
  return (
    <ImportsHome
      search={location.search}
      initialDbTemplates={data.templates}
      initialLogs={data.logs}
      templateNames={data.templateNames}
    />
  )
  // <!-- END RBP GENERATED: importer-v2-3-batson-series-v1 -->
}
// <!-- END RBP GENERATED: importer-v2-3 -->
