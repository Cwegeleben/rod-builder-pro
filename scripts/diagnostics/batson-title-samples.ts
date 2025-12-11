import { buildBatsonTitle } from '../../packages/importer/src/lib/titleBuild/batson'

type Sample = {
  sku: string
  description: string
  rawSpecs: Record<string, unknown>
  expected: string
}

const samples: Sample[] = [
  // Standard Tip Top 316 Stainless Steel 5.0 Tube – Alconite 8 Ring
  {
    sku: 'FTT5.0-8C',
    description: 'Forecast Alconite Tip Top 5.0 Tube 8 Ring SS316 Frame',
    rawSpecs: {
      code: 'FTT5.0-8C',
      tube_size: 5,
      ring_size: 8,
      frame_material: 'SS316',
      ring_material: 'AL',
      original_title: 'Forecast Alconite Tip Top 5.0 Tube 8 Ring SS316 Frame',
    },
    expected: 'Standard Tip Top 316 Stainless Steel 5.0 Tube – Alconite 8 Ring',
  },
  // Heavy Duty Tip Top Titanium 6.0 Tube – Silicon Carbide 10 Ring
  {
    sku: 'HTT6.0-10B',
    description: 'Heavy Duty Boat Top SiC Ring Titanium Frame 6.0 Tube',
    rawSpecs: {
      code: 'HTT6.0-10B',
      tube_size: 6,
      ring_size: 10,
      frame_material: 'Ti',
      ring_material: 'SIC',
      original_title: 'Heavy Duty Boat Top SiC Ring Titanium Frame 6.0 Tube',
    },
    expected: 'Heavy Duty Tip Top Titanium 6.0 Tube – Silicon Carbide 10 Ring',
  },
  // Boat Tip Top 316 Stainless Steel 5.5 Tube – Hardloy 8 Ring
  {
    sku: 'BTT5.5-8',
    description: 'Boat Tip Top Hardloy Ring 5.5 Tube',
    rawSpecs: {
      code: 'BTT5.5-8',
      tube_size: 5.5,
      ring_size: 8,
      frame_material: 'SS316',
      ring_material: 'HRA',
      original_title: 'Boat Tip Top Hardloy Ring 5.5 Tube',
    },
    expected: 'Boat Tip Top 316 Stainless Steel 5.5 Tube – Hardloy 8 Ring',
  },
]

async function main() {
  let failures = 0
  for (const sample of samples) {
    const title = buildBatsonTitle({ title: sample.description, rawSpecs: sample.rawSpecs })
    const ok = title === sample.expected
    if (!ok) failures++
    console.log(`[batson-title-samples] ${sample.sku}: ${title}`)
    if (!ok) {
      console.error(`  Expected: ${sample.expected}`)
    }
  }
  if (failures) {
    throw new Error(`${failures} sample(s) did not match expected output`)
  }
}

main().catch(err => {
  console.error('[batson-title-samples] failed', err)
  process.exitCode = 1
})
