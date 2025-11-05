// <!-- BEGIN RBP GENERATED: importer-review-preview-v1 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { prisma } from '../db.server'
import { buildShopifyPreview, validateShopifyPreview } from '../../packages/importer/src/sync/shopify'

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const runId = String(params.runId || '')
  const rowId = String(params.rowId || '')
  try {
    const d = await prisma.importDiff.findUnique({ where: { id: rowId } })
    if (!d || d.importRunId !== runId) return json({ error: 'not_found' }, { status: 404 })
    const after = d.after as unknown as Record<string, unknown>
    if (!after) return json({ error: 'no_after_payload' }, { status: 400 })
    const preview = buildShopifyPreview(after, runId)
    const { ok, errors } = validateShopifyPreview(preview)
    return json({ preview, valid: ok, errors })
  } catch (err) {
    return json({ error: (err as Error)?.message || 'unknown' }, { status: 500 })
  }
}
// <!-- END RBP GENERATED: importer-review-preview-v1 -->
