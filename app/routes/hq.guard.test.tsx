import type { LoaderFunctionArgs } from '@remix-run/node'
import { requireHQAccess } from '../services/auth/guards.server'

// Minimal route to exercise the HQ 403 ErrorBoundary banner without requiring Shopify embedding.
// Non-HQ (or unauthenticated) requests will trigger a 403 handled by the root ErrorBoundary.
export async function loader({ request }: LoaderFunctionArgs) {
  await requireHQAccess(request)
  return null
}

export default function HqGuardTest() {
  return null
}

export const handle = { private: true }
