// <!-- BEGIN RBP GENERATED: supplier-inventory-sync-v1 -->
/**
 * Seed or update a SupplierAuthProfile.
 * Usage (example):
 *  DOMAIN=example-supplier.com LOGIN_URL=https://example-supplier.com/login USERNAME=demo PASSWORD=secret \
 *    ts-node scripts/dev/seedSupplierAuth.ts
 * (Or compile via ts-node/register, or adapt to plain JS if needed.)
 */
import { prisma } from '../../app/db.server'
import { encryptSecret } from '../../app/services/inventory/playwrightAuth'

interface EnvConfig {
  domain: string
  loginUrl: string
  username: string
  password: string
}

function loadConfig(): EnvConfig {
  const domain = process.env.DOMAIN || 'example-supplier.com'
  const loginUrl = process.env.LOGIN_URL || `https://${domain}/login`
  const username = process.env.USERNAME || 'demo'
  const password = process.env.PASSWORD || 'demo-password'
  return { domain, loginUrl, username, password }
}

async function main() {
  const cfg = loadConfig()
  const passwordEnc = encryptSecret(cfg.password)
  const rec = await prisma.supplierAuthProfile.upsert({
    where: { supplierDomain_username: { supplierDomain: cfg.domain, username: cfg.username } },
    update: { loginUrl: cfg.loginUrl, passwordEnc },
    create: { supplierDomain: cfg.domain, loginUrl: cfg.loginUrl, username: cfg.username, passwordEnc },
  })
  console.log('[seedSupplierAuth] Upserted SupplierAuthProfile:', {
    id: rec.id,
    supplierDomain: rec.supplierDomain,
    username: rec.username,
    loginUrl: rec.loginUrl,
    hasCookieJar: !!rec.cookieJarJson,
  })
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
// <!-- END RBP GENERATED: supplier-inventory-sync-v1 -->
