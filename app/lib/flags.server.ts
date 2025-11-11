// Centralized feature flags for canonical product_db rollout

export function isProductDbEnabled(): boolean {
  const val = String(process.env.PRODUCT_DB_ENABLED || '')
    .trim()
    .toLowerCase()
  return val === '1' || val === 'true' || val === 'yes'
}

// Exclusive mode: hide legacy staging/review importer UI and steer users to canonical products
export function isProductDbExclusive(): boolean {
  const val = String(process.env.PRODUCT_DB_EXCLUSIVE || '')
    .trim()
    .toLowerCase()
  return val === '1' || val === 'true' || val === 'yes'
}
