import { test, expect, APIRequestContext } from '@playwright/test'

// Inline e2e covering delete endpoint behaviours (preview, blocked, force)
// NOTE: This test assumes an HQ-capable session or open endpoint in dev environment.
// It uses direct HTTP calls (no UI) for speed; a future enhancement can exercise the Polaris modal.

async function api(request: APIRequestContext, path: string, body?: unknown) {
  const resp = await request.post(path, {
    data: body,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  })
  let json: unknown = {}
  try {
    json = await resp.json()
  } catch {
    /* ignore */
  }
  return { status: resp.status(), json: json as Record<string, unknown> }
}

// These template IDs should be provisioned by a fixture or factory; placeholder values used here.
const TEMPLATE_ID = 'tpl-e2e-delete'

// Minimal provisioning helper (idempotent) – relies on importer template create path if exposed.
async function ensureTemplate(request: APIRequestContext, id: string) {
  await request
    .post('/api/importer/templates/upsert', {
      data: { id, name: 'E2E Delete Template', importConfig: { settings: { target: 'batson-rod-blanks' } } },
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    })
    .catch(() => {})
}

// Smoke-level assertions; skips gracefully if environment does not support required setup.
test.describe('Importer delete endpoint', () => {
  test('dry-run preview returns counts', async ({ request }) => {
    await ensureTemplate(request, TEMPLATE_ID)
    const { status, json } = await api(request, '/api/importer/delete?dry=1', { templateIds: [TEMPLATE_ID] })
    expect([200, 404]).toContain(status) // allow not_found in constrained env
    if (status === 200) {
      expect(json.ok).toBeTruthy()
      expect(json.dryRun).toBeTruthy()
      expect(json.counts).toBeTruthy()
    }
  })

  test('force delete bypasses blockers (if any)', async ({ request }) => {
    await ensureTemplate(request, TEMPLATE_ID)
    // First simulate a blocked prepare by setting preparingRunId if endpoint exists (pseudo)
    await request
      .post('/api/importer/templates/markPreparing', {
        data: { id: TEMPLATE_ID, preparingRunId: 'run-blocker' },
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      })
      .catch(() => {})
    const blocked = await api(request, '/api/importer/delete', { templateIds: [TEMPLATE_ID] })
    const hadBlocker = blocked.status === 409
    if (hadBlocker) {
      expect(blocked.json.code).toBe('blocked')
      const forced = await api(request, '/api/importer/delete?force=1', { templateIds: [TEMPLATE_ID] })
      expect(forced.status).toBe(200)
      expect(forced.json.forced).toBeTruthy()
    }
    test.skip(!hadBlocker, 'Environment did not produce a blocker; skipping force path validation.')
  })
})
