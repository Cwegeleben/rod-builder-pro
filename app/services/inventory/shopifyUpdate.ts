// <!-- BEGIN RBP GENERATED: supplier-inventory-sync-v1 -->
// Batch Shopify metafield update for inventory quantities
interface UpdateItem {
  productId: string
  qty?: number | null
  lastCheck: Date
}

export async function updateInventoryMetafields(admin: any, items: UpdateItem[]): Promise<void> {
  const chunk = <T>(arr: T[], size: number) => {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
  }
  for (const group of chunk(items, 10)) {
    const metafields = group.map(g => ({
      productId: g.productId,
      metafields: [
        { namespace: 'rbp.meta', key: 'supplier_qty', type: 'number_integer', value: String(g.qty ?? 0) },
        {
          namespace: 'rbp.meta',
          key: 'supplier_last_check',
          type: 'single_line_text_field',
          value: g.lastCheck.toISOString(),
        },
      ],
    }))
    // Simplified placeholder mutation (bulk product update can be optimized later)
    for (const mf of metafields) {
      const GQL = `#graphql
        mutation SetMetafields($productId: ID!, $metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) { userErrors { field message } }
        }
      `
      await admin.graphql(GQL, {
        variables: {
          productId: mf.productId,
          metafields: mf.metafields.map(m => ({ ...m, ownerId: mf.productId })),
        },
      })
    }
  }
}
// <!-- END RBP GENERATED: supplier-inventory-sync-v1 -->
