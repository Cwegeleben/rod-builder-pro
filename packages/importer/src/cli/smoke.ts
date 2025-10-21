// <!-- BEGIN RBP GENERATED: importer-smoke-v1 -->
import { crawlBatson } from '../crawlers/batsonCrawler'

async function main() {
  const seeds = (process.env.BATSON_SEEDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  if (seeds.length === 0) {
    console.error('Set BATSON_SEEDS to one or more category/series URLs')
    process.exit(1)
  }
  const count = await crawlBatson(seeds)
  console.log(`staged=${count}`)
}
main().catch(e => {
  console.error(e)
  process.exit(1)
})
// <!-- END RBP GENERATED: importer-smoke-v1 -->
