// <!-- BEGIN RBP GENERATED: gateway-token-bridge-v1 -->
import { prisma } from '../../db.server'
import { getShopAccessToken } from '../shopifyAdmin.server'
import { upsertShopifyForRun } from '../../../packages/importer/src/sync/shopify'

export async function applyImportRunToShop(params: {
  runId: string
  shopDomain: string
  approvedOnly?: boolean
  deleteOverride?: boolean
}) {
  const { runId, shopDomain, approvedOnly, deleteOverride } = params
  // Ensure the run exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  const run = await db.importRun.findUnique({ where: { id: runId } })
  if (!run) throw new Error(`ImportRun not found: ${runId}`)

  const token = await getShopAccessToken(shopDomain)
  const results = await upsertShopifyForRun(runId, {
    shopName: shopDomain,
    accessToken: token,
    approvedOnly: Boolean(approvedOnly),
    deleteOverride: Boolean(deleteOverride),
  })
  return { ok: true as const, runId, shopDomain, results }
}
// <!-- END RBP GENERATED: gateway-token-bridge-v1 -->
