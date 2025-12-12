#!/usr/bin/env tsx
import { loadDesignStorefrontOptions } from '../../app/lib/designStudio/storefront.server'
import { getDesignStudioAccess } from '../../app/lib/designStudio/access.server'

const defaultShop = process.env.SHOP_DOMAIN || process.env.SHOP || 'rbp-hq-dev.myshopify.com'
const roles = process.argv.slice(2)

if (!roles.length) {
  console.error('Usage: tsx scripts/diagnostics/dumpDesignStudioOptions.ts <role...>')
  process.exit(1)
}

async function run(role: string) {
  const fakeRequest = new Request(`http://localhost/api/design-studio/options?role=${role}&shop=${defaultShop}`)
  const access = await getDesignStudioAccess(fakeRequest)
  const { options, issues } = await loadDesignStorefrontOptions({ access, role: role as any })
  const sample = options[0] || null
  console.log(JSON.stringify({ role, count: options.length, sample, issues }, null, 2))
}

for (const role of roles) {
  await run(role)
}
