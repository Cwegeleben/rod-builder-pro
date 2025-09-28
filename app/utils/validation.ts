// <!-- BEGIN RBP GENERATED: products-module-v3-0 -->
import { z } from 'zod'

export const SpecFieldSchema = z.object({
  id: z.string().optional(),
  key: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'boolean', 'select']),
  required: z.boolean().optional().default(false),
  storageMode: z.enum(['PRODUCT_FIELD', 'METAFIELD']).default('METAFIELD'),
  position: z.number().int().nonnegative().default(0),
  productField: z.enum(['TITLE', 'BODY_HTML', 'VENDOR', 'PRODUCT_TYPE', 'TAGS']).nullish(),
  namespace: z.string().nullish(),
  metafieldKey: z.string().nullish(),
  metafieldType: z.string().nullish(),
})

export const SpecTemplateSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().nullish(),
  handle: z.string().optional(),
  fields: z.array(SpecFieldSchema),
})

export type SpecTemplateInput = z.infer<typeof SpecTemplateSchema>
// <!-- END RBP GENERATED: products-module-v3-0 -->
