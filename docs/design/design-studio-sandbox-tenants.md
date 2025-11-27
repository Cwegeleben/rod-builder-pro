# Design Studio Sandbox Tenants

These sandbox tenants cover the Starter, Core, and Plus tiers so the Design Studio rollout can be validated without touching production data. The canonical seed data lives in `app/lib/designStudio/tenantSeeds.ts` and can be upserted into any environment with `scripts/dev/seedDesignStudioTenants.ts`.

## Seed matrix

| Domain                          | Tier    | Enabled features                               | Notes                                                                                 |
| ------------------------------- | ------- | ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| `starter-sandbox.myshopify.com` | STARTER | Read-only marketing tiles, no wizard           | Mirrors Starter limits so teams can validate copy/CTA placement before enabling Core. |
| `core-sandbox.myshopify.com`    | CORE    | Full wizard (baseline → review), exports to S3 | Primary pilot tenant; uses RBP fulfillment only.                                      |
| `plus-sandbox.myshopify.com`    | PLUS    | Wizard + saved builds + dropship + exports     | Exercises Plus capabilities, including supplier-fulfilled families.                   |

## Config shape

The config embedded in each seed includes:

- `wizardSteps`: ordered list of enabled wizard sections (`baseline`, `blank`, `components`, `review`).
- `curatedFamilies`: default families surfaced in admin dashboards and storefront wizard (handle, label, fulfillment mode, coverage score, notes).
- `componentRoles`: required vs optional roles/collections to surface.
- `featureFlags`: toggles for saved builds, export to S3, and dropship workflows.
- `sla`: lightweight SLA contract (hours to review / approve) for dashboards.
- `copy`: hero + success messaging overrides for proxy routes.

See `app/lib/designStudio/tenantSeeds.ts` for the exact literal values.

## Running the seed script

```bash
# Seed all sandbox tenants into the current DATABASE_URL
pnpm tsx scripts/dev/seedDesignStudioTenants.ts

# Seed a single tenant by domain
SHOP_DOMAINS=core-sandbox.myshopify.com pnpm tsx scripts/dev/seedDesignStudioTenants.ts
```

The script uses Prisma upserts, so it is safe to run multiple times. It updates `TenantSettings.designStudioEnabled`, `TenantSettings.designStudioTier`, and `TenantSettings.designStudioConfig` with the sandbox defaults.

Set `DESIGN_STUDIO_V1=1` (or `true`) in the environment to turn on the global gate before hitting `/app/design-studio` or the Design Studio columns on `/app/products`.
