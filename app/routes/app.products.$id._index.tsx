import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { Page, Layout, Card, Text, InlineStack, Button } from '@shopify/polaris'
import { authenticate } from '../shopify.server'
import { prisma } from '../db.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  await authenticate.admin(request)
  const { id } = params
  if (!id) return json({ error: 'missing id' }, { status: 400 })
  const useCanonical = process.env.PRODUCT_DB_ENABLED === '1'
  if (useCanonical) {
    // Fetch canonical product and its latest version via raw query for maximum compatibility
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string
        supplierId: string
        productCode: string
        title: string
        type: string | null
        status: string
        updatedAt: string
        latestVersionId: string | null
        description: string | null
        images: string | null
        normSpecs: string | null
        rawSpecs: string | null
        priceMsrp: number | null
        priceWholesale: number | null
        availability: string | null
        fetchedAt: string | null
      }>
    >(
      `SELECT p.id, p.supplierId, p.sku AS productCode, p.title, p.type, p.status, p.updatedAt, p.latestVersionId,
              v.description, v.images, v.normSpecs, v.rawSpecs, v.priceMsrp, v.priceWholesale, v.availability, v.fetchedAt
         FROM Product p
         LEFT JOIN ProductVersion v ON v.id = p.latestVersionId
        WHERE p.id = ?
        LIMIT 1`,
      id,
    )
    if (!rows || rows.length === 0) return json({ error: 'not found', id }, { status: 404 })
    const r = rows[0]
    // Attempt to parse JSON fields when present
    const safeParse = (s: unknown) => {
      if (typeof s !== 'string') return null
      try {
        return JSON.parse(s)
      } catch {
        return null
      }
    }
    const product = {
      id: r.id,
      supplierId: r.supplierId,
      productCode: r.productCode,
      title: r.title,
      type: r.type,
      status: r.status,
      updatedAt: r.updatedAt,
      latestVersionId: r.latestVersionId,
      version: {
        description: r.description,
        images: safeParse(r.images) as unknown,
        normSpecs: safeParse(r.normSpecs) as unknown,
        rawSpecs: safeParse(r.rawSpecs) as unknown,
        priceMsrp: r.priceMsrp != null ? Number(r.priceMsrp) : null,
        priceWholesale: r.priceWholesale != null ? Number(r.priceWholesale) : null,
        availability: r.availability,
        fetchedAt: r.fetchedAt,
      },
    }
    return json({ id, product, canonical: true })
  }
  // Legacy path (Shopify Admin): keep minimal response for now
  return json({ id, canonical: false })
}

export default function ProductDetail() {
  const data = useLoaderData<typeof loader>() as
    | { id: string; canonical: false }
    | {
        id: string
        canonical: true
        product: {
          id: string
          supplierId: string
          productCode: string
          title: string
          type: string | null
          status: string
          updatedAt: string
          latestVersionId: string | null
          version: {
            description: string | null
            images: unknown
            normSpecs: unknown
            rawSpecs: unknown
            priceMsrp: number | null
            priceWholesale: number | null
            availability: string | null
            fetchedAt: string | null
          }
        }
      }
  const canonical = 'canonical' in data && data.canonical
  const title = canonical ? data.product.title : 'Product'
  return (
    <Page title={canonical ? 'Canonical Product' : 'Product'} backAction={{ url: '/app/products' }}>
      <Layout>
        <Layout.Section>
          <Card>
            <div className="p-m space-y-m">
              <Text as="h2" variant="headingMd">
                Summary
              </Text>
              {canonical ? (
                <div className="space-y-s">
                  <Text as="p">Title: {title}</Text>
                  <Text as="p">Product Code: {data.product.productCode}</Text>
                  <Text as="p">Supplier: {data.product.supplierId}</Text>
                  <Text as="p">Type: {data.product.type || '-'}</Text>
                  <Text as="p">Status: {data.product.status}</Text>
                  <Text as="p">Updated: {data.product.updatedAt}</Text>
                  <InlineStack gap="200">
                    <Button
                      variant="tertiary"
                      disabled={process.env.PRODUCT_DB_ENABLED !== '1'}
                      onClick={async () => {
                        try {
                          const resp = await fetch(`/api/products/${data.product.id}/publish`, { method: 'POST' })
                          const jr = await resp.json()
                          const msg: string = jr?.ok
                            ? `Dry-run totals: created ${jr.created}, updated ${jr.updated}, failed ${jr.failed}`
                            : (jr?.error as string) || 'Dry-run failed'
                          const w = window as unknown as { shopifyToast?: { success?: (m: string) => void } }
                          w.shopifyToast?.success?.(msg)
                        } catch (e) {
                          const w = window as unknown as { shopifyToast?: { error?: (m: string) => void } }
                          w.shopifyToast?.error?.((e as Error)?.message || 'Dry-run failed')
                        }
                      }}
                    >
                      Dry‑run publish
                    </Button>
                    <Button
                      variant="primary"
                      tone="success"
                      disabled={process.env.PRODUCT_DB_ENABLED !== '1'}
                      onClick={async () => {
                        const w = window as unknown as {
                          confirm?: (m: string) => boolean
                          shopifyToast?: { success?: (m: string) => void; error?: (m: string) => void }
                        }
                        const ok =
                          typeof w.confirm === 'function'
                            ? w.confirm('Publish this product to Shopify now?')
                            : confirm('Publish this product to Shopify now?')
                        if (!ok) return
                        try {
                          const resp = await fetch(`/api/products/${data.product.id}/publish`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ dryRun: false }),
                          })
                          const jr = await resp.json()
                          const msg: string = jr?.ok
                            ? `Published: created ${jr.created}, updated ${jr.updated}, failed ${jr.failed}`
                            : (jr?.error as string) || 'Publish failed'
                          w.shopifyToast?.success?.(msg)
                        } catch (e) {
                          w.shopifyToast?.error?.((e as Error)?.message || 'Publish failed')
                        }
                      }}
                    >
                      Publish to Shopify
                    </Button>
                  </InlineStack>
                </div>
              ) : (
                <Text as="p" tone="subdued">
                  Product ID: {data.id}
                </Text>
              )}
            </div>
          </Card>
        </Layout.Section>
        {canonical ? (
          <Layout.Section>
            <Card>
              <div className="p-m space-y-m">
                <Text as="h2" variant="headingMd">
                  Latest version
                </Text>
                <div className="space-y-s">
                  <Text as="p">Description: {data.product.version.description || '-'}</Text>
                  <Text as="p">Availability: {data.product.version.availability || '-'}</Text>
                  <Text as="p">
                    Price: MSRP {data.product.version.priceMsrp ?? '-'} | Wholesale{' '}
                    {data.product.version.priceWholesale ?? '-'}
                  </Text>
                  <Text as="p">Fetched: {data.product.version.fetchedAt || '-'}</Text>
                  {/* Images preview */}
                  {(() => {
                    const imgs = data.product.version.images as unknown as unknown[] | null
                    const urls = Array.isArray(imgs)
                      ? ((imgs as unknown[]).filter(u => typeof u === 'string') as string[])
                      : []
                    if (!urls.length) return null
                    return (
                      <details>
                        <summary style={{ cursor: 'pointer' }}>Images ({urls.length})</summary>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 6 }}>
                          {urls.map(u => (
                            <a
                              key={u}
                              href={u}
                              target="_blank"
                              rel="noreferrer"
                              style={{ border: '1px solid var(--p-color-border-subdued)', borderRadius: 4, padding: 4 }}
                            >
                              <img src={u} alt="" style={{ display: 'block', height: 96, width: 'auto' }} />
                            </a>
                          ))}
                        </div>
                      </details>
                    )
                  })()}
                  {/* Attribute/spec details */}
                  {(() => {
                    const rawUnknown = data.product.version.rawSpecs as unknown
                    const rawObj =
                      rawUnknown && typeof rawUnknown === 'object' ? (rawUnknown as Record<string, unknown>) : null
                    // Pick the first object-like among raw.spec, raw.raw, or raw itself
                    let specObj: Record<string, unknown> | null = null
                    if (rawObj && typeof rawObj === 'object') {
                      const candidate1 = (rawObj as Record<string, unknown>)['spec']
                      const candidate2 = (rawObj as Record<string, unknown>)['raw']
                      if (candidate1 && typeof candidate1 === 'object') specObj = candidate1 as Record<string, unknown>
                      else if (candidate2 && typeof candidate2 === 'object')
                        specObj = candidate2 as Record<string, unknown>
                      else specObj = rawObj
                    }
                    const attrs: Record<string, unknown> = specObj && typeof specObj === 'object' ? specObj : {}
                    const entries = Object.entries(attrs).filter(entry => {
                      const v = entry[1]
                      if (v == null) return false
                      const s = Array.isArray(v) ? v.join(', ') : String(v)
                      return s.trim().length > 0
                    })
                    if (!entries.length) return null
                    return (
                      <details>
                        <summary style={{ cursor: 'pointer' }}>Attributes ({entries.length})</summary>
                        <div style={{ maxHeight: 320, overflow: 'auto', paddingTop: 4 }}>
                          <table className="text-xs" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                              {entries.map(([k, v]) => {
                                const val = Array.isArray(v) ? v.join(', ') : String(v)
                                return (
                                  <tr key={k}>
                                    <td style={{ verticalAlign: 'top', padding: '2px 6px', fontWeight: 500 }}>{k}</td>
                                    <td style={{ verticalAlign: 'top', padding: '2px 6px' }}>{val || '-'}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    )
                  })()}
                  {/* Raw JSON dumps (debug) */}
                  <details>
                    <summary style={{ cursor: 'pointer' }}>Raw JSON</summary>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 6 }}>
                      <div>
                        <Text as="h3" variant="headingSm">
                          rawSpecs
                        </Text>
                        <pre
                          style={{
                            whiteSpace: 'pre-wrap',
                            maxHeight: 240,
                            overflow: 'auto',
                            border: '1px solid var(--p-color-border-subdued)',
                            padding: 8,
                            borderRadius: 4,
                          }}
                        >
                          {JSON.stringify(data.product.version.rawSpecs, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <Text as="h3" variant="headingSm">
                          normSpecs
                        </Text>
                        <pre
                          style={{
                            whiteSpace: 'pre-wrap',
                            maxHeight: 240,
                            overflow: 'auto',
                            border: '1px solid var(--p-color-border-subdued)',
                            padding: 8,
                            borderRadius: 4,
                          }}
                        >
                          {JSON.stringify(data.product.version.normSpecs, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </Card>
          </Layout.Section>
        ) : null}
      </Layout>
    </Page>
  )
}
