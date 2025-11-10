// <!-- BEGIN RBP GENERATED: hq-import-settings-v1 -->
import { prisma } from '../../db.server'
import { enc } from '../crypto.server'

export async function listManualSeeds(supplierId: string) {
  return prisma.productSource.findMany({ where: { supplierId, source: 'manual' }, orderBy: { lastSeenAt: 'desc' } })
}

export async function addManualSeed(supplierId: string, url: string, label?: string) {
  return prisma.productSource.upsert({
    where: { product_source_supplier_url_unique: { supplierId, url } },
    update: { lastSeenAt: new Date(), source: 'manual', notes: label || undefined },
    create: { supplierId, url, source: 'manual', notes: label || undefined },
  })
}

export async function removeManualSeed(supplierId: string, url: string) {
  return prisma.productSource.delete({ where: { product_source_supplier_url_unique: { supplierId, url } } })
}

export async function getSchedule(supplierId: string) {
  return prisma.importSchedule.findFirst({ where: { supplierId, profile: 'price_avail' } })
}

export async function setSchedule(supplierId: string, enabled: boolean, cron: string) {
  const existing = await getSchedule(supplierId)
  if (existing) {
    return prisma.importSchedule.update({ where: { id: existing.id }, data: { enabled, cron } })
  }
  return prisma.importSchedule.create({ data: { supplierId, enabled, cron, profile: 'price_avail' } })
}

export async function saveCredentials(
  supplierId: string,
  username: string,
  password: string,
  totp?: string,
  updatedBy?: string,
) {
  const data = {
    supplierId,
    usernameEnc: enc(username),
    passwordEnc: enc(password),
    totpEnc: totp ? enc(String(totp)) : null,
    updatedBy,
  }
  const existing = await prisma.supplierCredentials.findFirst({ where: { supplierId } })
  if (existing) {
    return prisma.supplierCredentials.update({ where: { id: existing.id }, data })
  }
  return prisma.supplierCredentials.create({ data })
}
// NOTE: dec() intentionally not exposed here or in UI
// <!-- END RBP GENERATED: hq-import-settings-v1 -->
