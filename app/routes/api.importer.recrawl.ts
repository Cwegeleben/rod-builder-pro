// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
/* eslint-disable @typescript-eslint/no-explicit-any */
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'

// Fire-and-forget Recrawl endpoint
// POST body: { templateId: string }
// Returns: { ok: true }
export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })

  let body: Record<string, unknown> = {}
  try {
    const ct = request.headers.get('content-type') || ''
    if (/application\/json/i.test(ct)) body = ((await request.json()) as Record<string, unknown>) || {}
    else {
      const fd = await request.formData()
      body = Object.fromEntries(Array.from(fd.entries()))
    }
  } catch {
    // ignore
  }

  const templateId = typeof body.templateId === 'string' ? (body.templateId as string) : ''
  if (!templateId) return json({ error: 'templateId required' }, { status: 400 })

  const { prisma } = await import('../db.server')
  // Ensure template exists (best-effort)
  try {
    const tpl = await (prisma as any).importTemplate.findUnique({ where: { id: templateId }, select: { id: true } })
    if (!tpl) return json({ error: 'Template not found' }, { status: 404 })
  } catch {
    // If schema missing, still attempt best-effort pathway
  }

  // Logging is handled in importerMachine.recrawlRunNow; do not duplicate here.

  // Kick background recrawl (best-effort, non-blocking)
  try {
    setTimeout(() => {
      ;(async () => {
        try {
          const mod = await import('../../src/apps/admin.portal/app/state/importerMachine')
          // Call the Logic-Pass recrawl; this updates in-memory state and self-logs within that module
          await mod.importerActions.recrawlRunNow(templateId)
        } catch {
          // ignore background errors; UI will capture via logs if available
        }
      })()
    }, 0)
  } catch {
    // ignore
  }

  return json({ ok: true })
}

export default function ImporterRecrawlApi() {
  return null
}
// <!-- END RBP GENERATED: importer-v2-3 -->
