// <!-- BEGIN RBP GENERATED: gateway-token-bridge-v1 -->
import { isHqShop } from '../../lib/access.server'

// Check that the current authenticated admin request originates from the HQ shop.
// Replace or extend this with your RBAC as needed.
export async function requireHQAccess(request: Request) {
  const ok = await isHqShop(request)
  if (!ok) {
    throw new Response('Forbidden', { status: 403 })
  }
}
// <!-- END RBP GENERATED: gateway-token-bridge-v1 -->
