import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { getDesignStudioAccess } from '../lib/designStudio/access.server'
import { loadDesignStorefrontConfig } from '../lib/designStudio/storefront.server'

export async function loader({ request }: LoaderFunctionArgs) {
  const access = await getDesignStudioAccess(request)
  if (!access.enabled) {
    return json({ error: access.reason }, { status: 403 })
  }

  try {
    const config = await loadDesignStorefrontConfig(access)
    return json({ config })
  } catch (error) {
    console.error('[designStudio] Failed to load config', error)
    return json({ error: 'CONFIG_UNAVAILABLE' }, { status: 500 })
  }
}
