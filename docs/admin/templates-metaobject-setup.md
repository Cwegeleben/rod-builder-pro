# Templates storage: metaobjects and product metafield

Last updated: 2025-09-30

This app stores product spec templates as Shopify metaobjects and optionally links products to a template via a metaobject reference metafield.

## 1) Create the metaobject definition

Settings → Custom data → Metaobjects → Add definition

- Type API handle: `rbp_template`
- Name: Product spec template
- Display name template: `{{ name }}`
- Access: Admin
- Fields:
  - `template_id` (Single line text, required)
  - `name` (Single line text, required)
  - `fields_json` (JSON, required)
  - `version` (Integer or text, optional)
  - `updated_at` (Date and time, optional)

The app sets the metaobject handle to `template_id` so updates are idempotent.

## 2) Optional: product metafield for template reference

Settings → Custom data → Products → Add definition

- Name: Spec template
- Namespace and key: `rbp.product_spec_template`
- Type: Metaobject
- Metaobject type: `rbp_template`
- Access: Admin

With this metafield, products can reference a template by metaobject reference rather than a string id.

## 3) App scopes and re-authentication

Update app scopes (shopify.app.\*.toml) to include:

- `read_metaobjects,write_metaobjects`
- Keep `write_products` for product metafields.

After deploying scope changes, merchants must re-authorize the app. The app listens to `app/scopes_update` webhook.

## 4) Publish flow

When you click Publish in the Templates UI, the app upserts one metaobject per template (`rbp_template`). Each entry stores:

- `template_id`: the app’s UUID
- `name`: template name
- `fields_json`: array of fields with mapping, required, type, and position
- `version`: currently `1`
- `updated_at`: ISO timestamp

Optionally, assigning a template to a product writes a `metaobject_reference` to `rbp/product_spec_template`.
