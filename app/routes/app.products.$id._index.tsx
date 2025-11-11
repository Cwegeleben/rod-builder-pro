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
        sku: string
        title: string
        type: string | null
        status: string
        updatedAt: string
        latestVersionId: string | null
        description: string | null
        images: string | null
        normSpecs: string | null
        priceMsrp: number | null
        priceWholesale: number | null
        availability: string | null
        fetchedAt: string | null
      }>
    >(
      `SELECT p.id, p.supplierId, p.sku, p.title, p.type, p.status, p.updatedAt, p.latestVersionId,
              v.description, v.images, v.normSpecs, v.priceMsrp, v.priceWholesale, v.availability, v.fetchedAt
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
      sku: r.sku,
      title: r.title,
      type: r.type,
      status: r.status,
      updatedAt: r.updatedAt,
      latestVersionId: r.latestVersionId,
      version: {
        description: r.description,
        images: safeParse(r.images) as unknown,
        normSpecs: safeParse(r.normSpecs) as unknown,
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
          sku: string
          title: string
          type: string | null
          status: string
          updatedAt: string
          latestVersionId: string | null
          version: {
            description: string | null
            images: unknown
            normSpecs: unknown
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
                  <Text as="p">SKU: {data.product.sku}</Text>
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
                </div>
              </div>
            </Card>
          </Layout.Section>
        ) : null}
      </Layout>
    </Page>
  )
}
