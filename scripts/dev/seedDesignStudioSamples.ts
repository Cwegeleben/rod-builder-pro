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
    normSpecs: {
      series: 'Rainshadow Eternity RX10',
      length_in: 90,
      power: 'MH',
      action: 'F',
      finish: 'Matte Clear',
    },
    priceMsrp: new Prisma.Decimal('299.99'),
    priceWh: new Prisma.Decimal('199.95'),
  },
  {
    externalId: 'RS-REVELATION-70ML',
    title: 'Rainshadow Revelation 7\'0" ML',
    partType: 'Rod Blank',
    description: 'Versatile RX7 Revelation blank for finesse applications.',
    normSpecs: {
      series: 'Rainshadow Revelation RX7',
      length_in: 84,
      power: 'ML',
      action: 'MF',
      finish: 'Gloss Carbon',
    },
    priceMsrp: new Prisma.Decimal('189.99'),
    priceWh: new Prisma.Decimal('134.50'),
  },
  {
    externalId: 'ALPS-TC-GUIDE-SET',
    title: 'ALPS Titanium Guide Set (10pc)',
    partType: 'Guide Set',
    description: 'Titanium frame guide set optimized for saltwater builds.',
    normSpecs: {
      series: 'ALPS Titanium',
      finish: 'Polished',
      pieces: 10,
    },
    priceMsrp: new Prisma.Decimal('129.00'),
    priceWh: new Prisma.Decimal('98.25'),
  },
  {
    externalId: 'ALPS-TRIGGER-SEAT-MH',
    title: 'ALPS Trigger Seat Medium-Heavy',
    partType: 'Reel Seat',
    description: 'Graphite trigger seat sized for medium-heavy bass rods.',
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
    normSpecs: {
      series: 'Rainshadow Immortal',
      length_in: 86,
      power: 'M',
      action: 'MF',
      finish: 'Gloss Carbon',
    },
    priceMsrp: new Prisma.Decimal('219.99'),
    priceWh: new Prisma.Decimal('154.80'),
  },
  {
    externalId: 'RS-REVELATION-76H',
    title: 'Rainshadow Revelation 7\'6" H',
    partType: 'Rod Blank',
    description: 'Heavy-power RX7 Revelation blank for flipping and punching.',
    normSpecs: {
      series: 'Rainshadow Revelation RX7',
      length_in: 90,
      power: 'H',
      action: 'F',
      finish: 'Satin Carbon',
    },
    priceMsrp: new Prisma.Decimal('209.99'),
    priceWh: new Prisma.Decimal('149.50'),
  },
  {
    externalId: 'ALPS-CARBON-GRIP-L',
    title: 'ALPS Carbon Fiber Split Grip (Large)',
    partType: 'Grip Kit',
    description: 'Lightweight carbon fiber grip kit with EVA accents.',
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
