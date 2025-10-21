// <!-- BEGIN RBP GENERATED: importer-normalize-diff-v1 -->
export function validate(partType: string, specs: Record<string, unknown>) {
  const errs: string[] = []
  const need = (k: string) => {
    if (specs[k] == null || specs[k] === '') errs.push(`missing ${k}`)
  }

  switch (partType) {
    case 'blank':
      need('length_in')
      need('power')
      break
    case 'guide':
      need('ring_size')
      need('frame_material')
      break
    case 'seat':
      need('size_mm')
      break
    case 'grip':
      need('length_in')
      break
    case 'tip_top':
      need('tube_size')
      need('ring_size')
      break
  }
  return errs
}
// <!-- END RBP GENERATED: importer-normalize-diff-v1 -->
