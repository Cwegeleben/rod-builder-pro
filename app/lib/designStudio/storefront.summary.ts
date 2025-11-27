import type { DesignStorefrontOption, DesignStorefrontPartRole } from './storefront.mock'

export type DesignStorefrontSummary = {
  totalParts: number
  selectedParts: number
  subtotal: number
}

export function summarizeSelections(
  selections: Partial<Record<DesignStorefrontPartRole, DesignStorefrontOption | null>>,
  basePrice: number,
  expectedRoles?: Iterable<DesignStorefrontPartRole>,
): DesignStorefrontSummary {
  const uniqueRoles: DesignStorefrontPartRole[] = expectedRoles
    ? Array.from(new Set(Array.from(expectedRoles)))
    : (Object.keys(selections) as DesignStorefrontPartRole[])

  const selected = uniqueRoles.filter(role => selections[role]).length
  const subtotal = basePrice + uniqueRoles.reduce((sum, role) => sum + (selections[role]?.price ?? 0), 0)

  return {
    totalParts: uniqueRoles.length,
    selectedParts: selected,
    subtotal,
  }
}
