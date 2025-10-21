// <!-- BEGIN RBP GENERATED: gateway-token-bridge-v1 -->
// Simple CLI that invokes the gateway route to apply an import run to a shop.

async function main() {
  const runId = process.argv[2] || process.env.IMPORT_RUN_ID
  const shop = process.env.SHOP || process.env.SHOPIFY_SHOP
  const endpoint = process.env.GATEWAY_URL || 'http://localhost:3000/app/admin/import/apply-run'
  const auth = process.env.GATEWAY_AUTH || '' // Optionally supply bearer/session for local tests

  if (!runId || !shop) {
    console.error('usage: pnpm -s importer:apply:gw <RUN_ID> (env SHOP=<domain>.myshopify.com)')
    process.exit(1)
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(auth ? { authorization: `Bearer ${auth}` } : {}),
    },
    body: JSON.stringify({ runId, shop }),
  })

  let json: unknown
  try {
    json = await res.json()
  } catch {
    console.error('Non-JSON response from gateway', await res.text())
    process.exit(1)
  }

  const data = json as { ok?: boolean; error?: string }
  if (!res.ok || !data.ok) {
    console.error('Gateway apply failed:', json)
    process.exit(1)
  }
  console.log('Applied via gateway:', json)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
// <!-- END RBP GENERATED: gateway-token-bridge-v1 -->
