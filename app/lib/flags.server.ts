// Centralized feature flags (canonical product_db rollout + design studio v1)

function readBooleanFlag(value: string | undefined): boolean {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

export function isProductDbEnabled(): boolean {
  return readBooleanFlag(process.env.PRODUCT_DB_ENABLED)
}

// Exclusive mode: hide legacy staging/review importer UI and steer users to canonical products
export function isProductDbExclusive(): boolean {
  return readBooleanFlag(process.env.PRODUCT_DB_EXCLUSIVE)
}

export function isDesignStudioFeatureEnabled(): boolean {
  return readBooleanFlag(process.env.DESIGN_STUDIO_V1)
}
