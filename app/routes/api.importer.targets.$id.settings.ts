// <!-- BEGIN RBP GENERATED: importer-save-settings-v1 -->
import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { getTargetById } from '../server/importer/sites/targets'

type SettingsBody = {
  name?: unknown
  target?: unknown
  discoverSeedUrls?: unknown
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(x => typeof x === 'string')
}

function coerceUrls(v: unknown): string[] {
  if (typeof v === 'string') {
    return v
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
  }
  if (isStringArray(v)) return v.filter(Boolean)
  return []
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireHqShopOr404(request)
  const id = params.id || ''
  if (!id) return json({ error: 'Missing id' }, { status: 400 })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })

  let body: SettingsBody = {}
  const ctype = request.headers.get('content-type') || ''
  try {
    if (ctype.includes('application/json')) {
      body = (await request.json()) as SettingsBody
    } else {
      const form = await request.formData()
      body = {
        name: form.get('name') || undefined,
        target: form.get('target') || undefined,
        discoverSeedUrls: form.getAll('discoverSeedUrls')?.length
          ? form.getAll('discoverSeedUrls')
          : (form.get('discoverSeedUrls') as string | null) || undefined,
      }
    }
  } catch {
    return json({ error: 'Invalid request body' }, { status: 400 })
  }

  const nameRaw = typeof body.name === 'string' ? body.name.trim() : ''
  const targetId = typeof body.target === 'string' ? body.target : ''
  const discoverSeedUrls = coerceUrls(body.discoverSeedUrls)

  if (!nameRaw) return json({ error: 'Name is required' }, { status: 400 })
  const target = getTargetById(targetId)
  if (!target) return json({ error: 'Unknown target' }, { status: 400 })

  try {
    const { prisma } = await import('../db.server')
    const { renameTemplate } = await import('../models/specTemplate.server')

    // Load existing config (preserve any other keys, but only update settings)
    const tpl = await prisma.importTemplate.findUnique({ where: { id } })
    const existingCfg = (tpl?.importConfig as Record<string, unknown> | null) || {}
    const nextCfg = {
      ...existingCfg,
      settings: {
        name: nameRaw,
        target: target.id,
        discoverSeedUrls,
      },
    }

    // Keep SpecTemplate and ImportTemplate name in sync
    await renameTemplate(id, nameRaw)
    await prisma.importTemplate.update({ where: { id }, data: { name: nameRaw, importConfig: nextCfg } })

    return json({ ok: true, settings: { name: nameRaw, target: target.id, discoverSeedUrls } })
  } catch (err) {
    const message = (err as Error)?.message || 'Failed to save settings'
    return json({ error: message }, { status: 500 })
  }
}
// <!-- END RBP GENERATED: importer-save-settings-v1 -->
