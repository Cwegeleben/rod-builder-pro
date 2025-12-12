import path from 'node:path'
import { Prisma, PrismaClient } from '@prisma/client'

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${path.resolve(process.cwd(), 'prisma/dev.sqlite')}`
  console.log('[seedDesignStudioSamples] Defaulting DATABASE_URL to', process.env.DATABASE_URL)
}

const prisma = new PrismaClient()

const SUPPLIER_ID = 'batson'
const SUPPLIER_SLUG = 'batson'
const SUPPLIER_NAME = 'Batson Enterprises'

const SAMPLE_PARTS = [
  {
    externalId: 'RS-ETERNITY-76MH',
    title: 'Rainshadow Eternity RX10 7\'6" MH-F',
    partType: 'Rod Blank',
    description: 'Premium RX10 blank for mid-heavy bass builds.',
    images: ['https://cdn.rbp.dev/samples/rs-eternity-76mh.jpg'],
    normSpecs: {
      series: 'Rainshadow Eternity RX10',
      length_in: 90,
      pieces: 1,
      power: 'MH',
      action: 'F',
      finish: 'Matte Clear',
      tip_top_size: 4.5,
      butt_dia_in: 0.54,
      weight_oz: 1.9,
      applications: 'Bass / Freshwater',
    },
    priceMsrp: new Prisma.Decimal('299.99'),
    priceWh: new Prisma.Decimal('199.95'),
  },
  {
    externalId: 'RS-REVELATION-70ML',
    title: 'Rainshadow Revelation 7\'0" ML',
    partType: 'Rod Blank',
    description: 'Versatile RX7 Revelation blank for finesse applications.',
    images: ['https://cdn.rbp.dev/samples/rs-revelation-70ml.jpg'],
    normSpecs: {
      series: 'Rainshadow Revelation RX7',
      length_in: 84,
      pieces: 1,
      power: 'ML',
      action: 'MF',
      finish: 'Gloss Carbon',
      tip_top_size: 4.0,
      butt_dia_in: 0.48,
      weight_oz: 1.6,
      applications: 'Finesse / Freshwater',
    },
    priceMsrp: new Prisma.Decimal('189.99'),
    priceWh: new Prisma.Decimal('134.50'),
  },
  {
    externalId: 'ALPS-MXN-5',
    title: 'ALPS MXN Size 5 Single Foot Guide',
    partType: 'Guide',
    description: 'MXN running guide with polished titanium frame and SiC ring.',
    images: ['https://cdn.rbp.dev/samples/alps-mxn-guide-5.jpg'],
    normSpecs: {
      series: 'ALPS MXN',
      ring_size: 5,
      frame_material: 'SS316',
      ring_material: 'SIC',
      finish: 'TiChrome',
      height_mm: 15.2,
      weight_oz: 0.05,
      foot_type: 'single',
    },
    priceMsrp: new Prisma.Decimal('5.25'),
    priceWh: new Prisma.Decimal('3.95'),
  },
  {
    externalId: 'ALPS-TITANIUM-TOP-6-55',
    title: 'ALPS Titanium Size 6 / 5.5 Tube Tip Top',
    partType: 'Tip Top',
    description: 'Titanium frame tip top with premium SiC ring.',
    images: ['https://cdn.rbp.dev/samples/alps-titanium-tip-top.jpg'],
    normSpecs: {
      series: 'ALPS Titanium',
      ring_size: 6,
      tube_size: 5.5,
      frame_material: 'TI',
      ring_material: 'SIC',
      finish: 'Polished',
      height_mm: 28,
    },
    priceMsrp: new Prisma.Decimal('12.50'),
    priceWh: new Prisma.Decimal('8.75'),
  },
  {
    externalId: 'ALPS-TRIGGER-SEAT-MH',
    title: 'ALPS Trigger Seat Medium-Heavy',
    partType: 'Reel Seat',
    description: 'Graphite trigger seat sized for medium-heavy bass rods.',
    images: ['https://cdn.rbp.dev/samples/alps-trigger-seat-mh.jpg'],
    normSpecs: {
      series: 'ALPS Graphite',
      power: 'MH',
      action: 'F',
      finish: 'Black',
    },
    priceMsrp: new Prisma.Decimal('34.00'),
    priceWh: new Prisma.Decimal('22.75'),
  },
  {
    externalId: 'RS-IMMORTAL-72M',
    title: 'Rainshadow Immortal 7\'2" M',
    partType: 'Rod Blank',
    description: 'Immortal series blank for mid-power freshwater builds.',
    images: ['https://cdn.rbp.dev/samples/rs-immortal-72m.jpg'],
    normSpecs: {
      series: 'Rainshadow Immortal',
      length_in: 86,
      pieces: 1,
      power: 'M',
      action: 'MF',
      finish: 'Gloss Carbon',
      tip_top_size: 4.2,
      butt_dia_in: 0.5,
      weight_oz: 1.7,
      applications: 'All-Purpose / Freshwater',
    },
    priceMsrp: new Prisma.Decimal('219.99'),
    priceWh: new Prisma.Decimal('154.80'),
  },
  {
    externalId: 'RS-REVELATION-76H',
    title: 'Rainshadow Revelation 7\'6" H',
    partType: 'Rod Blank',
    description: 'Heavy-power RX7 Revelation blank for flipping and punching.',
    images: ['https://cdn.rbp.dev/samples/rs-revelation-76h.jpg'],
    normSpecs: {
      series: 'Rainshadow Revelation RX7',
      length_in: 90,
      pieces: 1,
      power: 'H',
      action: 'F',
      finish: 'Satin Carbon',
      tip_top_size: 5.0,
      butt_dia_in: 0.6,
      weight_oz: 2.1,
      applications: 'Heavy Cover / Freshwater',
    },
    priceMsrp: new Prisma.Decimal('209.99'),
    priceWh: new Prisma.Decimal('149.50'),
  },
  {
    externalId: 'ALPS-CARBON-GRIP-L',
    title: 'ALPS Carbon Fiber Split Grip (Large)',
    partType: 'Grip Kit',
    description: 'Lightweight carbon fiber grip kit with EVA accents.',
    images: ['https://cdn.rbp.dev/samples/alps-carbon-grip-l.jpg'],
    normSpecs: {
      series: 'ALPS Carbon',
      pieces: 3,
      finish: 'Carbon / EVA',
    },
    priceMsrp: new Prisma.Decimal('74.95'),
    priceWh: new Prisma.Decimal('52.10'),
  },
  {
    externalId: 'ALPS-BUTT-CAP-XL',
    title: 'ALPS Aluminum Butt Cap XL',
    partType: 'Butt Cap',
    description: 'Anodized aluminum butt cap sized for saltwater builds.',
    images: ['https://cdn.rbp.dev/samples/alps-butt-cap-xl.jpg'],
    normSpecs: {
      series: 'ALPS Aluminum',
      finish: 'Anodized Blue',
      size: 'XL',
    },
    priceMsrp: new Prisma.Decimal('24.00'),
    priceWh: new Prisma.Decimal('16.80'),
  },
]

async function main() {
  const existing = await prisma.supplier.findFirst({ where: { slug: SUPPLIER_SLUG } })
  let supplierId = SUPPLIER_ID
  if (existing) {
    supplierId = existing.id
    await prisma.supplier.update({
      where: { id: existing.id },
      data: { name: SUPPLIER_NAME, active: true, urlRoot: existing.urlRoot || 'https://batsonenterprises.com' },
    })
  } else {
    const created = await prisma.supplier.create({
      data: {
        id: SUPPLIER_ID,
        slug: SUPPLIER_SLUG,
        name: SUPPLIER_NAME,
        urlRoot: 'https://batsonenterprises.com',
      },
    })
    supplierId = created.id
  }

  const externalIds = SAMPLE_PARTS.map(part => part.externalId)

  await prisma.designStudioAnnotationAudit
    .deleteMany({
      where: { product: { supplierId, productCode: { in: externalIds } } },
    })
    .catch(() => {})

  await prisma.product.deleteMany({ where: { supplierId, productCode: { in: externalIds } } })
  await prisma.partStaging.deleteMany({ where: { supplierId, externalId: { in: externalIds } } })

  const now = new Date()
  for (const part of SAMPLE_PARTS) {
    await prisma.partStaging.create({
      data: {
        supplierId,
        externalId: part.externalId,
        title: part.title,
        partType: part.partType,
        description: part.description,
        images: (part.images as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        rawSpecs: part.normSpecs as Prisma.JsonObject,
        normSpecs: part.normSpecs as Prisma.JsonObject,
        priceMsrp: part.priceMsrp,
        priceWh: part.priceWh,
        fetchedAt: now,
      },
    })
  }

  console.log(`[seedDesignStudioSamples] Inserted ${SAMPLE_PARTS.length} staging rows for ${supplierId}`)
}

main()
  .catch(error => {
    console.error('[seedDesignStudioSamples] fatal', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
