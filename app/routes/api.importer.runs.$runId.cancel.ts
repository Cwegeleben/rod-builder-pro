import { json, type ActionFunctionArgs } from '@remix-run/node'
import { isHqShop } from '../lib/access.server'
import { prisma } from '../db.server'
import { kickTemplate } from '../services/importer/orchestrator.server'

// Hardened cancellation endpoint with slot clearing + queued promotion
// POST /api/importer/runs/:runId/cancel
export async function action({ request, params }: ActionFunctionArgs) {
  const ok = await isHqShop(request)
  if (!ok) return json({ error: 'hq_required' }, { status: 403 })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })
  const runId = String(params.runId || '')
  if (!runId) return json({ error: 'Missing run id' }, { status: 400 })

  try {
    const run = await prisma.importRun.findUnique({ where: { id: runId } })
    if (!run) return json({ error: 'Not found' }, { status: 404 })

    const terminalStatuses = new Set(['staged', 'failed', 'cancelled', 'stuck', 'success'])
    const alreadyTerminal = terminalStatuses.has(run.status)

    // Extract templateId from summary.options if present
    const summaryObj =
      (run.summary as unknown as {
        options?: { templateId?: string; notes?: string }
        control?: Record<string, unknown>
      } | null) || null
    const opts = summaryObj?.options || {}
    const inferredTemplateId = opts.templateId || (opts.notes ? opts.notes.replace(/^prepare:/, '') : '') || ''
    const templateId = inferredTemplateId && inferredTemplateId !== 'n/a' ? inferredTemplateId : null

    // Mark cancelRequested unless already terminal (idempotent)
    if (!alreadyTerminal) {
      const control = { ...(summaryObj?.control || {}) }
      control.cancelRequested = true
      const nextSummary = { ...(summaryObj || {}), options: opts, control }
      await prisma.importRun.update({ where: { id: runId }, data: { summary: nextSummary as unknown as object } })
    }

    // Clear template slot if pointing to this run
    let clearedSlot = false
    if (templateId) {
      try {
        const tpl = await prisma.importTemplate.findUnique({ where: { id: templateId } })
        if (tpl?.preparingRunId === runId) {
          await prisma.importTemplate.update({ where: { id: templateId }, data: { preparingRunId: null } })
          clearedSlot = true
        }
      } catch {
        /* ignore slot clear errors */
      }
    }

    // Log cancellation (best-effort) under real templateId or 'n/a'
    try {
      await prisma.importLog.create({
        data: { templateId: templateId || 'n/a', runId, type: 'prepare:cancel', payload: { alreadyTerminal } },
      })
    } catch {
      /* swallow log errors */
    }

    // If we cleared the slot, attempt queued promotion
    if (clearedSlot && templateId) {
      try {
        await kickTemplate(templateId)
      } catch {
        /* ignore promotion errors */
      }
    }

    return json({ ok: true, alreadyTerminal, clearedSlot })
  } catch (err) {
    return json({ error: (err as Error)?.message || 'cancel failed' }, { status: 500 })
  }
}
