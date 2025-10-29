import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node'
import { requireHQAccess } from '../services/auth/guards.server'
import { prisma } from '../db.server'
import { getTemplateWithFields } from '../models/specTemplate.server'
import {
  loadTemplateAliases,
  rememberTemplateAlias,
  saveRunMappingSnapshot,
} from '../models/importerMappingSnapshot.server'
import type { AliasMemory, AxesMap } from '../services/importer/zeroConfigMapper.server'
import { normalizeLabel } from '../services/importer/zeroConfigMapper.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHQAccess(request)
  const runId = String(params.runId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  const snap = await db.runMappingSnapshot.findUnique({ where: { runId } })
  if (!snap) return json({ ok: true, snapshot: null })
  const templateId: string = snap.templateId
  const tpl = await getTemplateWithFields(templateId).catch(() => null)
  const fields = tpl?.fields?.map(f => ({ key: f.key, label: f.label, required: !!f.required })) || []
  const aliases = await loadTemplateAliases(templateId)
  return json({ ok: true, snapshot: { templateId, scraperId: snap.scraperId, mapping: snap.mapping }, fields, aliases })
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireHQAccess(request)
  const runId = String(params.runId)
  const ct = request.headers.get('content-type') || ''
  const body = /application\/json/i.test(ct) ? await request.json().catch(() => ({})) : {}
  const intent = String((body as Record<string, unknown>)['intent'] || '')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  const snap = await db.runMappingSnapshot.findUnique({ where: { runId } })
  if (!snap) return json({ ok: false, error: 'NO_SNAPSHOT' }, { status: 404 })
  const templateId: string = snap.templateId
  if (intent === 'set-alias') {
    const label = String((body as Record<string, unknown>)['label'] || '').trim()
    const fieldKey = String((body as Record<string, unknown>)['fieldKey'] || '').trim()
    const remember = Boolean((body as Record<string, unknown>)['remember'])
    if (!label || !fieldKey) return json({ ok: false, error: 'Missing label/fieldKey' }, { status: 400 })
    // Update snapshot mapping.aliases
    const mapping = (snap.mapping as { aliases?: AliasMemory; axes?: AxesMap }) || {}
    const aliases: AliasMemory = Array.isArray(mapping.aliases) ? mapping.aliases.slice() : []
    const norm = normalizeLabel(label)
    const idx = aliases.findIndex(a => a.label === norm)
    if (idx >= 0) aliases[idx] = { ...aliases[idx], label: norm, fieldKey, source: 'manual', confidence: 1.0 }
    else aliases.push({ label: norm, fieldKey, source: 'manual', confidence: 1.0 })
    await saveRunMappingSnapshot({ runId, templateId, scraperId: snap.scraperId, aliases, axes: mapping.axes || {} })
    if (remember) await rememberTemplateAlias(templateId, norm, fieldKey, 'manual', 1.0)
    return json({ ok: true })
  }
  if (intent === 'set-axes') {
    const axes = ((body as Record<string, unknown>)['axes'] || {}) as AxesMap
    const mapping = (snap.mapping as { aliases?: AliasMemory; axes?: AxesMap }) || {}
    const aliases: AliasMemory = Array.isArray(mapping.aliases) ? mapping.aliases : []
    await saveRunMappingSnapshot({ runId, templateId, scraperId: snap.scraperId, aliases, axes })
    return json({ ok: true })
  }
  return json({ ok: false, error: 'Unsupported intent' }, { status: 400 })
}

export default function ImporterMappingsApi() {
  return null
}
