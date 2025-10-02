import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Text, Card, BlockStack, InlineStack, List, Link as PolarisLink } from '@shopify/polaris'
import { authenticate } from '../shopify.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)
  return json({})
}

export default function DocsIndex() {
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingLg">
          Help & FAQ
        </Text>

        <BlockStack gap="200">
          <Text as="h3" variant="headingMd">
            What are product spec templates?
          </Text>
          <Text as="p">
            Templates define the structured fields your products should capture. You can store values in core product
            fields or product metafields. Publish to sync template definitions to your shop.
          </Text>
        </BlockStack>

        <BlockStack gap="200">
          <Text as="h3" variant="headingMd">
            How does publishing work?
          </Text>
          <Text as="p">
            Changes you make are kept locally until you Publish. Publishing upserts one metaobject per template so that
            other parts of the app can read them. We also support an optional product metafield that references the
            selected template.
          </Text>
          <List>
            <List.Item>
              Metaobject type: <code>rbp_template</code> (one entry per template).
            </List.Item>
            <List.Item>
              Optional Product metafield: <code>rbp/product_spec_template</code> of type
              <code> metaobject_reference</code> points to the chosen template.
            </List.Item>
          </List>
        </BlockStack>

        <BlockStack gap="200">
          <Text as="h3" variant="headingMd">
            Where are field values stored?
          </Text>
          <Text as="p">For each field you choose a storage method:</Text>
          <List>
            <List.Item>
              <b>Core</b>: maps to a built-in product property (e.g., title, vendor).
            </List.Item>
            <List.Item>
              <b>Metafield</b>: stored under a namespace and key on the product.
            </List.Item>
          </List>
          <Text as="p">
            Best practice: use a stable namespace per template (or app), and a key derived from the field name. By
            default we suggest namespace <code>rbp_{'{template}'}</code> and key from the field label. Avoid using the
            product title in the namespace—namespaces should not vary per product.
          </Text>
        </BlockStack>

        <BlockStack gap="200">
          <Text as="h3" variant="headingMd">
            Tips
          </Text>
          <List>
            <List.Item>Use short, lowercase keys (letters, numbers, underscores).</List.Item>
            <List.Item>Keep namespace consistent to group related fields.</List.Item>
            <List.Item>Only publish when ready; you can discard unpublished changes.</List.Item>
          </List>
        </BlockStack>

        <InlineStack>
          <PolarisLink url="/app/products/templates">Back to templates</PolarisLink>
        </InlineStack>
      </BlockStack>
    </Card>
  )
}
