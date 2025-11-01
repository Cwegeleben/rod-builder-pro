// <!-- BEGIN RBP GENERATED: importer-save-settings-v1 -->
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { ActionFunctionArgs } from '@remix-run/node'
import { action } from '../api.importer.targets.$id.settings'

let prisma: typeof import('../../db.server').prisma

describe('importer-save-settings-v1 — POST /api/importer/targets/:id/settings', () => {
  beforeAll(async () => {
    process.env.ALLOW_HQ_OVERRIDE = '1'
    prisma = (await import('../../db.server')).prisma
  })

  afterAll(async () => {
    // no-op
  })

  it('saves name, target, and discoverSeedUrls (happy path)', async () => {
    // Arrange: create template rows
    const spec = await prisma.specTemplate.create({ data: { name: 'Save Settings Test' } })
    await prisma.importTemplate.create({ data: { id: spec.id, name: spec.name, importConfig: {} } })

    const req = new Request(`http://localhost/api/importer/targets/${spec.id}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hq-override': '1' },
      body: JSON.stringify({
        name: 'Updated Name',
        target: 'batson-rod-blanks',
        discoverSeedUrls: ['https://batsonenterprises.com/rod-blanks'],
      }),
    })

    // Act
    const res = await action({ request: req, params: { id: spec.id } } as unknown as ActionFunctionArgs)
    expect(res.status).toBe(200)
    const payload = (await res.json()) as
      | { error: string }
      | { ok: boolean; settings: { name: string; target: string; discoverSeedUrls: string[] } }
    if ('error' in payload) throw new Error(`unexpected error: ${payload.error}`)
    expect(payload.ok).toBe(true)
    expect(payload.settings).toEqual({
      name: 'Updated Name',
      target: 'batson-rod-blanks',
      discoverSeedUrls: ['https://batsonenterprises.com/rod-blanks'],
    })

    // Assert DB
    const row = await prisma.importTemplate.findUnique({ where: { id: spec.id } })
    expect(row?.name).toBe('Updated Name')
    const cfg = (row?.importConfig as Record<string, unknown>) || {}
    const settings = (cfg['settings'] as Record<string, unknown>) || {}
    expect(settings).toMatchObject(payload.settings)
  })

  it('rejects unknown target (validation error)', async () => {
    const spec = await prisma.specTemplate.create({ data: { name: 'Save Settings Invalid' } })
    await prisma.importTemplate.create({ data: { id: spec.id, name: spec.name, importConfig: {} } })

    const req = new Request(`http://localhost/api/importer/targets/${spec.id}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hq-override': '1' },
      body: JSON.stringify({ name: 'X', target: 'nope', discoverSeedUrls: [] }),
    })
    const res = await action({ request: req, params: { id: spec.id } } as unknown as ActionFunctionArgs)
    expect(res.status).toBe(400)
    const payload = (await res.json()) as { error?: string }
    expect(typeof payload.error).toBe('string')
  })
})
// <!-- END RBP GENERATED: importer-save-settings-v1 -->
