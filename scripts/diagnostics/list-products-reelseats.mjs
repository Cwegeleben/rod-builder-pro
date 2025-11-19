#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
;(async () => {
  const count = await prisma.$queryRawUnsafe('SELECT COUNT(*) c FROM Product WHERE type=\'Reel Seat\'')
  console.log('count', count)
  const sample = await prisma.$queryRawUnsafe('SELECT sku,title FROM Product WHERE type=\'Reel Seat\' ORDER BY createdAt DESC LIMIT 10')
  console.log('sample', sample)
  await prisma.$disconnect()
})().catch(e => { console.error(e); process.exit(1) })
