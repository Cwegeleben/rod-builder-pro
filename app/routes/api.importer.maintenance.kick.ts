import { json, type ActionFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { kickTemplate } from '../services/importer/orchestrator.server'

// POST /api/importer/maintenance/kick
// HQ-only: attempts to promote the next queued run for a template when the slot is free.
export async function action({ request }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })

  try {
    let templateId = ''
    const ct = request.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      const body = (await request.json()) as Record<string, unknown>
      if (typeof body?.templateId === 'string') templateId = body.templateId
    }
    if (!templateId) {
      const url = new URL(request.url)
      templateId = url.searchParams.get('templateId') || ''
    }
    if (!templateId) return json({ error: 'Missing templateId' }, { status: 400 })

    await kickTemplate(templateId)
    return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return json({ error: (err as Error)?.message || 'kick failed' }, { status: 500 })
  }
}

export default function ImporterMaintenanceKick() {
  return null
}
