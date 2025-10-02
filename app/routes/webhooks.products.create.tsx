import type { ActionFunctionArgs } from '@remix-run/node'
import { authenticate } from '../shopify.server'
import { getTemplateForProductType } from '../models/productTypeTemplate.server'
import { assignTemplateRefToProduct } from '../models/shopMetaobjects.server'

type ProductCreatePayload = {
  admin_graphql_api_id?: string
  product_type?: string
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, webhookId, payload, admin } = await authenticate.webhook(request)
  console.log(`Received ${topic} for ${shop} (${webhookId})`)
  const body = payload as unknown as ProductCreatePayload
  const productId = body.admin_graphql_api_id
  const productType = (body.product_type || '').trim()
  if (!productId) return new Response()
  if (!productType) return new Response()
  try {
    const templateId = await getTemplateForProductType(productType)
    const hasGraphql = (
      a: unknown,
    ): a is { graphql: (q: string, i?: { variables?: Record<string, unknown> }) => Promise<Response> } => {
      if (!a) return false
      const g = (a as Record<string, unknown>).graphql
      return typeof g === 'function'
    }
    if (templateId && hasGraphql(admin)) {
      await assignTemplateRefToProduct(admin, productId, templateId)
      console.log(`Assigned template ${templateId} to product ${productId} based on type ${productType}`)
    }
  } catch (e) {
    console.warn('Failed to assign template on products/create', e)
  }
  return new Response()
}
