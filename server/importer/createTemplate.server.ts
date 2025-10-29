// <!-- BEGIN RBP GENERATED: importer-templates-zero-orphan-v1 -->
// @ts-nocheck
/* eslint-disable */
import { prisma } from '../../app/db.server'

export type CreateTwoPhaseInput = {
  name: string
  // Caller supplies remote create to keep server module pure/testable
  createRemote: () => Promise<{ remoteTemplateId: string; version: number }>
  // Optional hook to simulate failure at specific phase for testing
  failAt?: 'A' | 'B' | 'C'
}

export async function createTemplateTwoPhase(input: CreateTwoPhaseInput) {
  const { name, createRemote, failAt } = input
  // Phase A: local pending
  const pending = await prisma.specTemplate.create({
    data: { name, status: 'PENDING' },
  })
  if (failAt === 'A') throw new Error('Simulated failure at phase A')

  try {
    // Phase B: remote metaobject
    const remote = await createRemote()
    if (failAt === 'B') throw new Error('Simulated failure at phase B')

    // Phase C: local active + connect remote
    const active = await prisma.specTemplate.update({
      where: { id: pending.id },
      data: {
        status: 'ACTIVE',
        remoteTemplateId: remote.remoteTemplateId,
        remoteVersion: remote.version,
      },
    })
    if (failAt === 'C') throw new Error('Simulated failure at phase C')

    return { ok: true as const, template: active }
  } catch (err) {
    // Rollback: archive the pending row to prevent orphan
    await prisma.specTemplate.update({ where: { id: pending.id }, data: { status: 'ARCHIVED' } }).catch(() => {})
    return { ok: false as const, error: (err as Error).message }
  }
}
// <!-- END RBP GENERATED: importer-templates-zero-orphan-v1 -->
