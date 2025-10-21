// <!-- BEGIN RBP GENERATED: hq-import-settings-v1 -->
import { prisma } from '../../db.server'
import { enc } from '../crypto.server'

export async function listManualSeeds(supplierId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  return db.productSource.findMany({ where: { supplierId, source: 'manual' }, orderBy: { lastSeenAt: 'desc' } })
}

export async function addManualSeed(supplierId: string, url: string, label?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  return db.productSource.upsert({
    where: { product_source_supplier_url_unique: { supplierId, url } },
    update: { lastSeenAt: new Date(), source: 'manual', notes: label || undefined },
    create: { supplierId, url, source: 'manual', notes: label || undefined },
  })
}

export async function removeManualSeed(supplierId: string, url: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  return db.productSource.delete({ where: { product_source_supplier_url_unique: { supplierId, url } } })
}

export async function getSchedule(supplierId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  return db.importSchedule.findFirst({ where: { supplierId, profile: 'price_avail' } })
}

export async function setSchedule(supplierId: string, enabled: boolean, cron: string) {
  const existing = await getSchedule(supplierId)
  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = prisma as any
    return db.importSchedule.update({ where: { id: existing.id }, data: { enabled, cron } })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  return db.importSchedule.create({ data: { supplierId, enabled, cron, profile: 'price_avail' } })
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  const existing = await db.supplierCredentials.findFirst({ where: { supplierId } })
  if (existing) {
    return db.supplierCredentials.update({ where: { id: existing.id }, data })
  }
  return db.supplierCredentials.create({ data })
}
// NOTE: dec() intentionally not exposed here or in UI
// <!-- END RBP GENERATED: hq-import-settings-v1 -->
