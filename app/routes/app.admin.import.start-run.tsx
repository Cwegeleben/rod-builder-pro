import { json, type ActionFunctionArgs } from '@remix-run/node'
import { requireHQAccess } from '../services/auth/guards.server'
import { prisma } from '../db.server'

// Starts an ImportRun row for the default supplier and returns the runId.
// Backend diffing/population should attach to this run asynchronously.
export async function action({ request }: ActionFunctionArgs) {
  await requireHQAccess(request)
  const supplierId = 'batson'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  const run = await db.importRun.create({
    data: {
      supplierId,
      status: 'started',
      summary: {},
    },
    select: { id: true },
  })
  return json({ ok: true, runId: run.id })
}

export default function StartRunActionRoute() {
  return null
}
