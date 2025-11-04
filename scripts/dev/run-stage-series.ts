import { startImportFromOptions } from '../../app/services/importer/runOptions.server'

const url = process.env.SOURCE_URL || 'https://batsonenterprises.com/rod-blanks/solid-glass-heavy-duty'

async function main() {
  const runId = await startImportFromOptions({
    mode: 'discover',
    includeSeeds: false,
    manualUrls: [url],
    skipSuccessful: false,
    notes: 'dev-stage-series',
    templateKey: 'batson.product.v2',
    useSeriesParser: true,
  })
  console.log('Run created:', runId)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
