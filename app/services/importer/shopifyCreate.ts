// <!-- BEGIN RBP GENERATED: supplier-importer-v1 -->
import type { NormalizedItem } from './mapping'

interface CreateResult {
  id?: string
  status: 'created' | 'error'
  error?: string
  dedupeKey: string
}

// Minimal product create. Relies on admin graphql client passed in.
export async function createDraftProducts(admin: any, items: NormalizedItem[]): Promise<CreateResult[]> {
  const results: CreateResult[] = []
  for (const item of items) {
    try {
      const images = item.images?.filter(Boolean).map(url => ({ src: url })) || []
      const metafieldsInput = [
        { namespace: 'rbp.meta', key: 'isImported', type: 'boolean', value: 'true' },
        { namespace: 'rbp.meta', key: 'productType', type: 'single_line_text_field', value: item.productType },
        { namespace: 'rbp.access', key: 'level', type: 'single_line_text_field', value: 'none' },
        { namespace: 'rbp.access', key: 'tenants', type: 'json', value: '[]' },
        { namespace: 'rbp.access', key: 'tiers', type: 'json', value: '[]' },
      ]
      const price = item.price ?? 0
      const GQL = `#graphql
        mutation CreateProduct($input: ProductInput!) {
          productCreate(input: $input) { product { id title } userErrors { field message } }
        }
      `
      const variables = {
        input: {
          title: item.title,
          productType: item.productType,
          vendor: item.vendor || undefined,
          descriptionHtml: item.description || undefined,
          status: 'DRAFT',
          metafields: metafieldsInput,
          images,
          variants: [
            {
              price: price.toFixed(2),
              sku: item.sku || undefined,
            },
          ],
        },
      }
      const resp = await admin.graphql(GQL, { variables })
      const data = await resp.json()
      const userErrors = data?.data?.productCreate?.userErrors
      if (userErrors?.length) {
        results.push({
          status: 'error',
          error: userErrors.map((e: any) => e.message).join('; '),
          dedupeKey: item.dedupeKey,
        })
      } else {
        const id = data?.data?.productCreate?.product?.id
        results.push({ status: 'created', id, dedupeKey: item.dedupeKey })
      }
    } catch (e) {
      results.push({ status: 'error', error: e instanceof Error ? e.message : 'unknown', dedupeKey: item.dedupeKey })
    }
  }
  return results
}
// <!-- END RBP GENERATED: supplier-importer-v1 -->
