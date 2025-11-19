import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '../db.server'

// Token-gated stop endpoint to cancel the active run for a template (if any)
// GET/POST: /resources/importer/stop/:templateId?token=smoke-ok
export async function loader(args: LoaderFunctionArgs) {
  return handle(args)
}
export async function action(args: ActionFunctionArgs) {
  return handle(args)
}

async function handle({ params, request }: LoaderFunctionArgs | ActionFunctionArgs) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token') || ''
  if (token !== 'smoke-ok') return json({ error: 'unauthorized' }, { status: 401 })
  const templateId = String(params.templateId || '')
  if (!templateId) return json({ error: 'templateId required' }, { status: 400 })

  try {
    const tpl = await prisma.importTemplate.findUnique({ where: { id: templateId } })
    const runId = tpl?.preparingRunId || ''
    if (!runId) return json({ ok: true, cancelled: false, reason: 'no_active_run' })

    const run = await prisma.importRun.findUnique({ where: { id: runId } })
    if (!run) return json({ ok: true, cancelled: false, reason: 'run_not_found' })

    const terminal = new Set(['staged', 'failed', 'cancelled', 'success', 'stuck']).has(run.status)
    if (terminal) {
      // Clear slot if it still points here
      try {
        await prisma.importTemplate.update({ where: { id: templateId }, data: { preparingRunId: null } })
      } catch {
        /* ignore */
      }
      return json({ ok: true, cancelled: false, alreadyTerminal: true })
    }

    // Mark cancelRequested in summary.control, leaving the worker to transition the status
    const summary = (run.summary as unknown as { options?: unknown; control?: Record<string, unknown> } | null) || {}
    const nextSummary = { ...(summary || {}), control: { ...(summary?.control || {}), cancelRequested: true } }
    try {
      await prisma.importRun.update({ where: { id: runId }, data: { summary: nextSummary as unknown as object } })
    } catch {
      /* ignore */
    }
    try {
      await prisma.importLog.create({
        data: { templateId, runId, type: 'prepare:cancel', payload: { via: 'token-stop' } },
      })
    } catch {
      /* ignore */
    }

    return json({ ok: true, cancelled: true, runId })
  } catch (e) {
    return json({ error: (e as Error)?.message || 'stop failed' }, { status: 500 })
  }
}

export default function ImporterStopTemplate() {
  return null
}
