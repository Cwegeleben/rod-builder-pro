// <!-- BEGIN RBP GENERATED: importer-price-avail-job-v1 -->
import { prisma } from '../db'
import { enc, dec } from '../../../../app/services/crypto.server'

export async function saveJar(supplierId: string, jarJson: string, ttlHours = 8) {
  const expires = new Date(Date.now() + ttlHours * 3600 * 1000)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  await db.supplierCookieJar.upsert({
    where: { supplierId },
    update: { jarEncrypted: enc(jarJson), lastLoginAt: new Date(), expiresAt: expires },
    create: { supplierId, jarEncrypted: enc(jarJson), lastLoginAt: new Date(), expiresAt: expires },
  })
}

export async function loadJar(supplierId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = prisma as any
  const row = await db.supplierCookieJar.findUnique({ where: { supplierId } })
  if (!row) return null
  if (row.expiresAt && row.expiresAt < new Date()) return null
  return dec(row.jarEncrypted)
}
// <!-- END RBP GENERATED: importer-price-avail-job-v1 -->
