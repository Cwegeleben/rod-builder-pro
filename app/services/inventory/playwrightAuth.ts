// <!-- BEGIN RBP GENERATED: supplier-inventory-sync-v1 -->
// Headless auth + cookie reuse (placeholder implementation without actual Playwright dependency wiring)
import crypto from 'node:crypto'
import { prisma } from '../../db.server'

const ALGO = 'aes-256-gcm'
function getKey(): Buffer {
  const key = process.env.RBP_SECRET_KEY || 'dev-secret-key-dev-secret-key-32b'
  return crypto.createHash('sha256').update(key).digest()
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

export function decryptSecret(enc: string): string {
  const data = Buffer.from(enc, 'base64')
  const iv = data.subarray(0, 12)
  const tag = data.subarray(12, 28)
  const payload = data.subarray(28)
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(payload), decipher.final()])
  return dec.toString('utf8')
}

export interface AuthSessionResult {
  cookieJar: Record<string, unknown>
  status: 'ok' | 'auth_fail'
}

// Placeholder: would launch Playwright, login, return cookies.
export async function ensureAuthSession(profileId: string): Promise<AuthSessionResult> {
  const profile = await prisma.supplierAuthProfile.findUnique({ where: { id: profileId } })
  if (!profile) return { cookieJar: {}, status: 'auth_fail' }
  // Simulate cookie reuse
  if (profile.cookieJarJson) return { cookieJar: profile.cookieJarJson as any, status: 'ok' }
  // Pretend we logged in and set cookie jar
  const cookieJar = { session: 'dummy' }
  await prisma.supplierAuthProfile.update({ where: { id: profileId }, data: { cookieJarJson: cookieJar } })
  return { cookieJar, status: 'ok' }
}
// <!-- END RBP GENERATED: supplier-inventory-sync-v1 -->
