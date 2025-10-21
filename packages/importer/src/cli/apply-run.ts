// <!-- BEGIN RBP GENERATED: shopify-sync-v1 -->
import { upsertShopifyForRun } from '../sync/shopify'

async function main() {
  const runId = process.argv[2] || process.env.IMPORT_RUN_ID
  if (!runId) {
    console.error('usage: tsx packages/importer/src/cli/apply-run.ts <runId>')
    process.exit(1)
  }
  const shopName = process.env.SHOPIFY_SHOP
  const accessToken = process.env.SHOPIFY_TOKEN
  if (!shopName || !accessToken) {
    console.error('Set SHOPIFY_SHOP and SHOPIFY_TOKEN')
    process.exit(1)
  }
  await upsertShopifyForRun(runId, { shopName, accessToken })
  console.log(`applied run ${runId}`)
}
main().catch(e => {
  console.error(e)
  process.exit(1)
})
// <!-- END RBP GENERATED: shopify-sync-v1 -->
