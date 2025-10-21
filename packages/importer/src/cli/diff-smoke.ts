// <!-- BEGIN RBP GENERATED: importer-normalize-diff-v1 -->
import { applyNormalizationToStaging } from '../pipelines/applyNormalization'
import { diffStagingToCanonical } from '../pipelines/diff'

async function main() {
  const supplier = process.env.SUPPLIER_ID || 'batson'
  await applyNormalizationToStaging(supplier)
  const runId = await diffStagingToCanonical(supplier)
  console.log(`diff runId=${runId}`)
}
main().catch(e => {
  console.error(e)
  process.exit(1)
})
// <!-- END RBP GENERATED: importer-normalize-diff-v1 -->
