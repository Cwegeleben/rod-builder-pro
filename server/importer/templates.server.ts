// <!-- BEGIN RBP GENERATED: importer-templates-zero-orphan-v1 -->
import { prisma } from '../../app/db.server'

export type RemoteTemplate = { id: string; name: string; version?: number }

export async function listLocalTemplates() {
  const rows = await prisma.specTemplate.findMany({ include: { fields: { orderBy: { position: 'asc' } } } })
  return rows
}

// NOTE: The caller should pass remote list (Shopify Admin) to keep this module pure/testable.
export async function reconcileTemplates(remotes: RemoteTemplate[]) {
  const locals = await prisma.specTemplate.findMany()
  const remoteByName = new Map(remotes.map(r => [r.name, r]))
  const localByName = new Map(locals.map(l => [l.name, l]))

  let adopted = 0
  let archived = 0

  // Adopt remote-only
  for (const r of remotes) {
    if (!localByName.has(r.name)) {
      await prisma.specTemplate.create({
        data: { name: r.name, status: 'ACTIVE' as any, remoteTemplateId: r.id, remoteVersion: r.version ?? null },
      })
      adopted++
    }
  }

  // Archive local-only (not found remotely)
  for (const l of locals) {
    if (!remoteByName.has(l.name) && l.status !== ('ARCHIVED' as any)) {
      await prisma.specTemplate.update({ where: { id: l.id }, data: { status: 'ARCHIVED' as any } })
      archived++
    }
  }

  return { adopted, archived }
}

// Webhook handlers (to be wired by route or shopify server):
export async function onRemoteDeleted(remoteId: string) {
  await prisma.specTemplate.updateMany({ where: { remoteTemplateId: remoteId }, data: { status: 'ARCHIVED' as any } })
}

export async function onRemoteUpdated(remote: RemoteTemplate) {
  // Update linkage and version; ensure local exists
  const existing = await prisma.specTemplate.findFirst({ where: { remoteTemplateId: remote.id } })
  if (existing) {
    await prisma.specTemplate.update({
      where: { id: existing.id },
      data: { name: remote.name, remoteVersion: remote.version ?? null },
    })
  } else {
    await prisma.specTemplate.create({
      data: {
        name: remote.name,
        status: 'ACTIVE' as any,
        remoteTemplateId: remote.id,
        remoteVersion: remote.version ?? null,
      },
    })
  }
}
// <!-- END RBP GENERATED: importer-templates-zero-orphan-v1 -->
