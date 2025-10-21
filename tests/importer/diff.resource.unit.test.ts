import { describe, it, expect, vi } from 'vitest'

vi.mock('../../app/services/auth/guards.server', () => ({ requireHQAccess: vi.fn(async () => true) }))

const mockFindUnique = vi.fn()
vi.mock('../../app/db.server', () => ({
  prisma: { importDiff: { findUnique: (...args: unknown[]) => mockFindUnique(...(args as unknown[])) } },
}))

import { loader } from '../../app/routes/app.admin.import.diff.$id'

const mkReq = (id: string) => new Request(`http://test/app/admin/import/diff/${id}`)

describe('diff resource loader', () => {
  it('returns 404 when not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    const res = (await loader({ request: mkReq('missing'), params: { id: 'missing' } } as unknown as Parameters<
      typeof loader
    >[0])) as Response
    expect(res.status).toBe(404)
  })

  it('returns before/after when found', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'd1',
      before: { a: 1 },
      after: { b: 2 },
      diffType: 'add',
      externalId: 'x',
      resolution: null,
    })
    const res = (await loader({ request: mkReq('d1'), params: { id: 'd1' } } as unknown as Parameters<
      typeof loader
    >[0])) as Response
    interface DiffBody {
      ok: boolean
      diff?: { id: string; before?: unknown; after?: unknown }
    }
    const body = (await (res as Response).json()) as DiffBody
    expect(body.ok).toBe(true)
    expect(body.diff?.id).toBe('d1')
    const after = body.diff?.after as Record<string, unknown>
    expect(after?.b).toBe(2)
  })
})
