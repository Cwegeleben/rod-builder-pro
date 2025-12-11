export type DiffKind = 'add' | 'change' | 'delete'

export interface FieldChange {
  field: string
  before: unknown
  after: unknown
}

export interface ProductSnapshot {
  brand?: string
  series?: string
  material?: string
  color?: string
  msrp?: number
  availability?: string
  category: string
  family?: string
  designStudioReady?: boolean
  attributes: Record<string, unknown>
}

export interface ProductDiff {
  supplier: string
  supplierSiteId?: string | null
  productCode: string
  category: string
  family?: string
  kind: DiffKind
  before?: ProductSnapshot
  after?: ProductSnapshot
  changedFields?: FieldChange[]
}
