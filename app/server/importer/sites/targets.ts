// <!-- BEGIN RBP GENERATED: importer-known-targets-v1 -->
export type ImportTarget = { id: string; label: string; url: string; siteId: string }

export const KNOWN_IMPORT_TARGETS: ImportTarget[] = [
  {
    id: 'batson-rod-blanks',
    label: 'Batson — Rod Blanks',
    url: 'https://batsonenterprises.com/rod-blanks',
    siteId: 'batson-rod-blanks',
  },
  {
    id: 'batson-reel-seats',
    label: 'Batson — Reel Seats',
    url: 'https://batsonenterprises.com/reel-seats',
    siteId: 'batson-reel-seats',
  },
]

export function getTargetById(id: string): ImportTarget | undefined {
  return KNOWN_IMPORT_TARGETS.find(t => t.id === id)
}
// <!-- END RBP GENERATED: importer-known-targets-v1 -->
