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
    // Choose the most recent TEST_SUMMARY log to carry runId forward
    const last = await (prisma as any).importLog.findFirst({
      where: { templateId, type: 'TEST_SUMMARY' },
      orderBy: { at: 'desc' },
      select: { runId: true },
    })
    const runId = String(last?.runId || '')
    await (prisma as any).importTemplate.update({
      where: { id: templateId },
      data: { state: 'APPROVED' },
    })
    await (prisma as any).importLog.create({
      data: { templateId, runId: runId || `approve-${Date.now()}`, type: 'APPROVED', payload: {} },
    })
    return json({ ok: true })
  } catch (e) {
    return json({ error: (e as Error)?.message || 'Approve failed' }, { status: 400 })
  }
}

export default function ApproveApi() {
  return null
}
// <!-- END RBP GENERATED: importer-v2-3 -->
