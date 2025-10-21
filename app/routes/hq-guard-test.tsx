import type { LoaderFunctionArgs } from '@remix-run/node'
import { requireHQAccess } from '../services/auth/guards.server'

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHQAccess(request)
  return null
}

export default function HqGuardTest() {
  return null
}

export const handle = { private: true }
