import { prisma } from '../../app/db.server'
import { SANDBOX_TENANT_SEEDS } from '../../app/lib/designStudio/tenantSeeds'

type Seed = (typeof SANDBOX_TENANT_SEEDS)[number]

function resolveTargets(): Seed[] {
  const raw = process.env.SHOP_DOMAINS || process.env.SHOP_DOMAIN || ''
  const requested = raw
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
  if (!requested.length) return SANDBOX_TENANT_SEEDS
  const filtered = SANDBOX_TENANT_SEEDS.filter(seed => requested.includes(seed.shopDomain))
  if (!filtered.length) {
    throw new Error(
      `[seedDesignStudioTenants] No sandbox seed matched SHOP_DOMAINS=${requested.join(',')}. Known domains: ${SANDBOX_TENANT_SEEDS.map(seed => seed.shopDomain).join(', ')}`,
    )
  }
  return filtered
}

async function upsertSeed(seed: Seed) {
  const record = await prisma.tenantSettings.upsert({
    where: { shopDomain: seed.shopDomain },
    update: {
      designStudioEnabled: seed.enabled,
      designStudioTier: seed.tier,
      designStudioConfig: seed.config,
    },
    create: {
      shopDomain: seed.shopDomain,
      designStudioEnabled: seed.enabled,
      designStudioTier: seed.tier,
      designStudioConfig: seed.config,
    },
  })
  console.log(
    `[seedDesignStudioTenants] Upserted ${record.shopDomain} (tier=${record.designStudioTier}, enabled=${record.designStudioEnabled})`,
  )
}

async function main() {
  const seeds = resolveTargets()
  for (const seed of seeds) {
    await upsertSeed(seed)
  }
}

main()
  .catch(err => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
