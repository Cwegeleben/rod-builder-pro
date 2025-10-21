// <!-- BEGIN RBP GENERATED: hq-import-settings-v1 -->
import crypto from 'node:crypto'

const KEY = (process.env.SECRET_CREDENTIALS_KEY || '').padEnd(32, '0').slice(0, 32)
const IV_LEN = 12

export function enc(plain: string) {
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(KEY), iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct]).toString('base64url')
}

export function dec(b64: string) {
  const raw = Buffer.from(b64, 'base64url')
  const iv = raw.subarray(0, IV_LEN)
  const tag = raw.subarray(IV_LEN, IV_LEN + 16)
  const ct = raw.subarray(IV_LEN + 16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(KEY), iv)
  decipher.setAuthTag(tag)
  const pt = Buffer.concat([decipher.update(ct), decipher.final()])
  return pt.toString('utf8')
}
// <!-- END RBP GENERATED: hq-import-settings-v1 -->
