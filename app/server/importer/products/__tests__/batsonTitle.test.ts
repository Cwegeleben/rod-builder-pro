import { describe, it, expect } from 'vitest'
import {
  buildBatsonBlankTitle,
  buildBatsonReelSeatTitle,
  type BatsonBlankSeriesContext,
  type BatsonBlankRow,
  type BatsonReelSeatCategoryContext,
  type BatsonReelSeatRow,
} from '../batsonTitle'

describe('buildBatsonBlankTitle', () => {
  it('RX6 Downrigger with finish', () => {
    const series: BatsonBlankSeriesContext = {
      brandName: 'Rainshadow',
      seriesDisplayName: 'RX6 Downrigger',
      seriesCore: 'RX6',
      techniqueLabel: 'Downrigger',
    }
    const row: BatsonBlankRow = {
      modelCode: 'RDR96MH-GB',
      lengthFtInRaw: '9\'6"',
      piecesRaw: '2',
      powerRaw: 'MH',
      finishOrColorRaw: 'Black Gloss',
    }
    expect(buildBatsonBlankTitle(series, row)).toBe(
      'Rainshadow RX6 9\'6" 2 pc Medium Heavy Downrigger Rod Blank – Black Gloss',
    )
  })

  it('Revelation RX7 spin with action', () => {
    const series: BatsonBlankSeriesContext = {
      brandName: 'Rainshadow',
      seriesDisplayName: 'Revelation RX7 Spin Bass Walleye Freshwater',
      seriesCore: 'Revelation RX7',
      techniqueLabel: 'Spin Bass/Walleye',
    }
    const row: BatsonBlankRow = {
      modelCode: 'RSU68L',
      lengthFtInRaw: '6\'8"',
      piecesRaw: '1',
      powerRaw: 'L',
      actionRaw: 'Fast',
    }
    expect(buildBatsonBlankTitle(series, row)).toBe(
      'Rainshadow Revelation RX7 6\'8" 1 pc Light Fast Spin Bass/Walleye Rod Blank',
    )
  })

  it('RX7 Surf 11 ft 2 pc Heavy', () => {
    const series: BatsonBlankSeriesContext = {
      brandName: 'Rainshadow',
      seriesDisplayName: 'RX7 Surf',
      seriesCore: 'RX7',
      techniqueLabel: 'Surf',
    }
    const row: BatsonBlankRow = {
      modelCode: 'SURF110H',
      lengthFtInRaw: '132', // inches
      piecesRaw: '2',
      powerRaw: 'H',
    }
    expect(buildBatsonBlankTitle(series, row)).toBe('Rainshadow RX7 11\'0" 2 pc Heavy Surf Rod Blank')
  })
})

describe('buildBatsonReelSeatTitle', () => {
  it('Alps AIP Contour Aluminum Reel Seat Size 20 – Matte Black', () => {
    const cat: BatsonReelSeatCategoryContext = { brandFallback: 'Alps', categoryType: 'Aluminum Reel Seat' }
    const row: BatsonReelSeatRow = {
      rawName: 'ALPS AIP Contour Reel Seat – Matte Black',
      codeRaw: 'AIP20M-B',
      familyName: 'AIP Contour',
      seatStyle: 'Contour',
      material: 'Aluminum',
      size: '20',
      finishColor: 'Matte Black',
    }
    expect(buildBatsonReelSeatTitle(cat, row)).toBe('Alps AIP Contour Aluminum Reel Seat Size 20 – Matte Black')
  })
  it('Forecast Aluminum Fly Reel Seat Size 16 – Black (code removed)', () => {
    const cat: BatsonReelSeatCategoryContext = { brandFallback: 'Forecast', categoryType: 'Aluminum Reel Seat' }
    const row: BatsonReelSeatRow = {
      rawName: '#16 Aluminum Fly Reel Seat w / BP Cap - Blk',
      brandRaw: 'Forecast Rod Components',
      codeRaw: 'A16BP-B',
      familyName: 'A16BP',
      material: 'Aluminum',
      seatStyle: 'Fly',
      size: '16',
      finishColor: 'Black',
    }
    expect(buildBatsonReelSeatTitle(cat, row)).toBe('Forecast Aluminum Fly Reel Seat Size 16 – Black')
  })

  it('Forecast Graphite Reverse Angle Long Trigger Reel Seat Size 20 – Black (code removed)', () => {
    const cat: BatsonReelSeatCategoryContext = { brandFallback: 'Forecast', categoryType: 'Graphite Reel Seat' }
    const row: BatsonReelSeatRow = {
      rawName: 'Graphite Reverse Angle Long Trigger Reel Seat Size 20 with Cushion Hood - Black',
      brandRaw: 'Forecast',
      codeRaw: 'GST20C-B',
      familyName: 'GST20C',
      material: 'Graphite',
      seatStyle: 'Reverse Angle Long Trigger',
      size: '20',
      finishColor: 'Black',
    }
    expect(buildBatsonReelSeatTitle(cat, row)).toBe(
      'Forecast Graphite Reverse Angle Long Trigger Reel Seat Size 20 – Black',
    )
  })

  it('Alps Aluminum Classic-Locking Fly Reel Seat Size 16 – Sg (code removed)', () => {
    const cat: BatsonReelSeatCategoryContext = { brandFallback: 'Alps', categoryType: 'Fly Reel Seat' }
    const row: BatsonReelSeatRow = {
      rawName: 'RA5 Classic-Locking Reel seat SG',
      brandRaw: 'Alps',
      codeRaw: 'RA5CLSKC-SG',
      familyName: 'RA5',
      seatStyle: 'Classic-Locking',
      material: 'Aluminum',
      size: '16',
      finishColor: 'SG',
    }
    expect(buildBatsonReelSeatTitle(cat, row)).toBe('Alps Aluminum Classic-Locking Reel Seat Size 16 – Sg')
  })

  it('Alps Fly Reel Seat Insert – Birdseye Maple (code removed)', () => {
    const cat: BatsonReelSeatCategoryContext = { brandFallback: 'Alps', categoryType: 'Fly Reel Seat' }
    const row: BatsonReelSeatRow = {
      rawName: 'RA5 insert Birdseye Maple',
      brandRaw: 'Alps',
      codeRaw: 'RA5-INS-BE',
      familyName: 'RA5',
      isInsertOnly: true,
      insertMaterial: 'Birdseye Maple',
    }
    expect(buildBatsonReelSeatTitle(cat, row)).toBe('Alps Fly Reel Seat Insert – Birdseye Maple')
  })

  it('Alps Down-Locking Reel Seat Trim Ring and Bottom Hood – Sg (code removed)', () => {
    const cat: BatsonReelSeatCategoryContext = { brandFallback: 'Alps', categoryType: 'Reel Seat Hardware' }
    const row: BatsonReelSeatRow = {
      rawName: 'RA5 Down-Locking Trim Ring and Bottom Hood SG',
      brandRaw: 'Alps',
      codeRaw: 'RA5DLMTR-SG',
      familyName: 'RA5',
      seatStyle: 'Down-Locking',
      hardwareKind: 'Reel Seat Trim Ring and Bottom Hood',
      finishColor: 'SG',
    }
    expect(buildBatsonReelSeatTitle(cat, row)).toBe('Alps Down-Locking Reel Seat Trim Ring and Bottom Hood – Sg')
  })
})
