// hq-importer-new-import-v2
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { requireHqShopOr404 } from '../lib/access.server'
import { listTemplatesSummary } from '../models/specTemplate.server'
import { listScrapers } from '../services/importer/scrapers.server'

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const url = new URL(request.url)
  const kind = (url.searchParams.get('kind') || '').toLowerCase()
  if (kind === 'variant') {
    const tpls = await listTemplatesSummary()
    return json(
      tpls.map(t => ({ id: t.id, name: t.name, kind: 'variant', fields: t.fieldsCount, variantsSummary: 'TBD' })),
    )
  }
  if (kind === 'scraper') {
    const scrapers = await listScrapers()
    return json(scrapers)
  }
  return json({ error: 'Missing or invalid kind' }, { status: 400 })
}

export default function TemplatesApi() {
  return null
}
