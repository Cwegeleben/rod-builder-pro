import { isRemoteHybridEnabled } from './remoteTemplates.server'

type AdminApi = { graphql: (query: string, init?: { variables?: Record<string, unknown> }) => Promise<Response> }

// Simple in-process debounce lock per shop. Best-effort across instances.
const lastRunByShop = new Map<string, number>()
const TEN_MIN = 10 * 60 * 1000

export function shouldRunAutoSync(shop: string | undefined): boolean {
  if (!shop) return false
  if (isRemoteHybridEnabled()) return false
  const now = Date.now()
  const last = lastRunByShop.get(shop) || 0
  return now - last > TEN_MIN
}

export function markAutoSyncRun(shop: string | undefined) {
  if (!shop) return
  lastRunByShop.set(shop, Date.now())
}

export async function syncOrphanTemplates(admin: AdminApi): Promise<{ adopted: number; error?: string }> {
  // Mirrors the logic used in resources/spec-templates.ts -> action: 'syncAllOrphans'
  const TYPE = 'rbp_template'
  const first = 100
  let after: string | null = null
  let adopted = 0
  try {
    const GQL = `#graphql
      query List($type: String!, $first: Int!, $after: String) {
        metaobjects(type: $type, first: $first, after: $after) {
          edges { cursor node { handle templateId: field(key: "template_id") { value } nameField: field(key:"name"){ value } fieldsJsonField: field(key:"fields_json"){ value } } }
          pageInfo { hasNextPage endCursor }
        }
      }
    `
    // Fetch local ids through an API call to keep this module self-contained
    // We avoid importing prisma here to prevent heavy coupling.
    const { prisma } = await import('../db.server')
    const existing = await prisma.specTemplate.findMany({ select: { id: true } })
    const local = new Set(existing.map(r => r.id))
    while (true) {
      const resp = await admin.graphql(GQL, { variables: { type: TYPE, first, after } })
      if (!resp.ok) break
      const jr = (await resp.json()) as {
        data?: {
          metaobjects?: {
            edges: Array<{
              cursor: string
              node: {
                handle?: string
                templateId?: { value?: string | null } | null
                nameField?: { value?: string | null } | null
                fieldsJsonField?: { value?: string | null } | null
              }
            }>
            pageInfo: { hasNextPage: boolean; endCursor?: string | null }
          }
        }
      }
      const edges = jr?.data?.metaobjects?.edges || []
      for (const e of edges) {
        const node = e.node
        const id = node?.templateId?.value || node?.handle
        if (!id || local.has(id)) continue
        const nameVal = node?.nameField?.value || id
        let fields: Array<Record<string, unknown>> = []
        try {
          const raw = node?.fieldsJsonField?.value
          const arr = raw ? JSON.parse(raw) : []
          if (Array.isArray(arr)) fields = arr as Array<Record<string, unknown>>
        } catch {
          /* ignore */
        }
        try {
          await prisma.specTemplate.create({ data: { id, name: nameVal } })
          for (const [idx, f] of fields.entries()) {
            await prisma.specField.create({
              data: {
                id: (f.id as string) || undefined,
                templateId: id,
                key: String(f.key || `field_${idx + 1}`),
                label: String(f.label || f.key || `Field ${idx + 1}`),
                type: ((): 'text' | 'number' | 'boolean' | 'select' => {
                  const vt = (f as { type?: string }).type
                  return vt === 'number' || vt === 'boolean' || vt === 'select' ? vt : 'text'
                })(),
                required: Boolean((f as { required?: boolean }).required),
                position:
                  typeof (f as { position?: number }).position === 'number'
                    ? ((f as { position?: number }).position as number)
                    : idx + 1,
                storage: ((f as { storage?: string }).storage as string) === 'METAFIELD' ? 'METAFIELD' : 'CORE',
                coreFieldPath:
                  ((f as { mapping?: { coreFieldPath?: string | null } }).mapping?.coreFieldPath as string) || null,
                metafieldNamespace:
                  ((f as { mapping?: { metafield?: { namespace?: string | null } } }).mapping?.metafield
                    ?.namespace as string) || null,
                metafieldKey:
                  ((f as { mapping?: { metafield?: { key?: string | null } } }).mapping?.metafield?.key as string) ||
                  null,
                metafieldType:
                  ((f as { mapping?: { metafield?: { type?: string | null } } }).mapping?.metafield?.type as string) ||
                  null,
              },
            })
          }
          local.add(id)
          adopted += 1
        } catch {
          /* ignore per-orphan errors */
        }
      }
      const pi = jr?.data?.metaobjects?.pageInfo
      if (pi?.hasNextPage && pi?.endCursor) after = pi.endCursor
      else break
    }
  } catch (e) {
    return { adopted, error: e instanceof Error ? e.message : 'sync failed' }
  }
  return { adopted }
}
