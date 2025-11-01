// <!-- BEGIN RBP GENERATED: importer-crawlB-polaris-v1 -->
import { extractBatsonAttributeGrid, type BlankSpec, type BatsonGridRowRaw } from '../batsonAttributeGrid'
import { toShopifyPreview } from '../shopifyMapper'

type ParsedRows = Array<{ raw: BatsonGridRowRaw; spec: BlankSpec }>
export type ProductModel = (html: string, baseUrl?: string) => { rows: ParsedRows }
export type ShopifyMapper = (seriesTitle: string, rows: ParsedRows) => { product: unknown }

export const PRODUCT_MODELS: Record<string, ProductModel> = {
  'batson-attribute-grid': extractBatsonAttributeGrid,
}

export const SHOPIFY_MAPPERS: Record<string, ShopifyMapper> = {
  'batson-attribute-grid': toShopifyPreview,
}
// <!-- END RBP GENERATED: importer-crawlB-polaris-v1 -->
