// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'

export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const ct = request.headers.get('content-type') || ''
  const read = async () => {
    if (/application\/json/i.test(ct)) return (await request.json().catch(() => ({}))) as Record<string, unknown>
    const fd = await request.formData().catch(() => null)
    const o: Record<string, unknown> = {}
    if (fd) {
      const id = String(fd.get('templateId') || '').trim()
      if (id) o.templateId = id
    }
    return o
  }
  const { templateId } = (await read()) as { templateId?: string }
  if (!templateId) return json({ error: 'Missing templateId' }, { status: 400 })
  const { prisma } = await import('../db.server')
  try {
    // Log reset and move back to READY_TO_TEST; clear hadFailures
    await (prisma as any).importLog.create({
      data: { templateId, runId: `reset-${Date.now()}`, type: 'RESET', payload: {} },
    })
    await (prisma as any).importTemplate.update({
      where: { id: templateId },
      data: { state: 'READY_TO_TEST', hadFailures: false },
    })
    return json({ ok: true })
  } catch (e) {
    return json({ error: (e as Error)?.message || 'Reset failed' }, { status: 400 })
  }
}

export default function ResetApi() {
  return null
}
// <!-- END RBP GENERATED: importer-v2-3 -->
