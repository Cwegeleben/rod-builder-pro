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
  {
    id: 'batson-guides-tops',
    label: 'Batson — Guides & Tip Tops',
    url: 'https://batsonenterprises.com/guides-tip-tops',
    siteId: 'batson-guides-tops',
  },
  {
    id: 'batson-grips',
    label: 'Batson — Grips',
    url: 'https://batsonenterprises.com/grips',
    siteId: 'batson-grips',
  },
  {
    id: 'batson-end-caps-gimbals',
    label: 'Batson — End Caps & Gimbals',
    url: 'https://batsonenterprises.com/end-caps-gimbals',
    siteId: 'batson-end-caps-gimbals',
  },
  {
    id: 'batson-trim-pieces',
    label: 'Batson — Trim Pieces',
    url: 'https://batsonenterprises.com/trim-pieces',
    siteId: 'batson-trim-pieces',
  },
]

export function getTargetById(id: string): ImportTarget | undefined {
  return KNOWN_IMPORT_TARGETS.find(t => t.id === id)
}
// <!-- END RBP GENERATED: importer-known-targets-v1 -->
