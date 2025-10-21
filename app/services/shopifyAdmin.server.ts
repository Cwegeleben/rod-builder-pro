// <!-- BEGIN RBP GENERATED: gateway-token-bridge-v1 -->
import { prisma } from '../db.server'

// Fetch the stored OAuth access token for a given shop domain from your DB.
// Replace the query with your actual schema as needed.
export async function getShopAccessToken(shopDomain: string): Promise<string> {
  // Default to using the Remix Shopify Session table managed by @shopify/shopify-app-session-storage-prisma
  // which stores offline tokens with isOnline=false.
  const session = await prisma.session.findFirst({ where: { shop: shopDomain, isOnline: false } })
  if (!session?.accessToken) throw new Error(`No access token for ${shopDomain}`)
  return session.accessToken
}

// Optional convenience to return a lightweight admin client/config.
// We intentionally avoid importing 'shopify-api-node' here to keep the app build lean.
export async function getAdminClient(shopDomain: string): Promise<{ shopName: string; accessToken: string }> {
  const accessToken = await getShopAccessToken(shopDomain)
  return { shopName: shopDomain, accessToken }
}
// <!-- END RBP GENERATED: gateway-token-bridge-v1 -->
