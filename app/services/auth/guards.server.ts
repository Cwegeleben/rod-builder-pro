// <!-- BEGIN RBP GENERATED: gateway-token-bridge-v1 -->
import { isHqShop } from '../../lib/access.server'

// Check that the current authenticated admin request originates from the HQ shop.
// Replace or extend this with your RBAC as needed.
export async function requireHQAccess(request: Request) {
  const ok = await isHqShop(request)
  if (!ok) {
    const err = new Error('Forbidden: HQ Access required') as Error & { status?: number }
    err.status = 403
    throw err
  }
}
// <!-- END RBP GENERATED: gateway-token-bridge-v1 -->
