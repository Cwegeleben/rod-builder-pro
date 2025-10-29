// <!-- BEGIN RBP GENERATED: label-driven-mapping-v1-0 -->
// Batson Blanks template fields: keys, labels, synonyms, and type metadata.
// This guides the label-driven matcher to find appropriate values in scraped KVs.

import type { TemplateField } from '../../mapping/labelDrivenMatcher'

export const BatsonBlanksTemplateFields: TemplateField[] = [
  { key: 'series', label: 'Series', synonyms: ['product series'] },
  { key: 'model', label: 'Model', synonyms: ['product code', 'code', 'sku'] },
  { key: 'length_in', label: 'Length', synonyms: ['item length', 'length (in)'], type: 'feet-inches', required: true },
  { key: 'pieces', label: 'Pieces', synonyms: ['number of pieces', 'sections'], type: 'number' },
  { key: 'color', label: 'Color', synonyms: ['blank color'] },
  { key: 'action', label: 'Action', synonyms: [] },
  { key: 'power', label: 'Power', synonyms: [] },
  { key: 'material', label: 'Material', synonyms: ['construction'] },
  { key: 'line_lb', label: 'Line Weight', synonyms: ['line rating'], type: 'range-lb' },
  { key: 'lure_oz', label: 'Lure Weight', synonyms: ['lure rating'], type: 'range-oz' },
  { key: 'butt_od', label: 'Butt Diameter', synonyms: ['butt dia', 'butt diameter'], type: 'number' },
  { key: 'tip_size', label: 'Tip Top Size', synonyms: ['tip-top size', 'tip size'], type: 'number' },
  { key: 'application', label: 'Application', synonyms: ['use case'] },
  { key: 'price_msrp', label: 'MSRP', synonyms: ['price', 'retail price'], type: 'currency' },
]
// <!-- END RBP GENERATED: label-driven-mapping-v1-0 -->
