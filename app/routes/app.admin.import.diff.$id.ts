import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { requireHQAccess } from '../services/auth/guards.server'
import { prisma } from '../db.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHQAccess(request)
  const id = String(params.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  const diff = await db.importDiff.findUnique({
    where: { id },
    select: { id: true, externalId: true, diffType: true, before: true, after: true, resolution: true },
  })
  if (!diff) return json({ ok: false, error: 'Not found' }, { status: 404 })
  return json({ ok: true, diff })
}
