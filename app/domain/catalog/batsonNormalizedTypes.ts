export type AvailabilityState = 'inStock' | 'outOfStock' | 'discontinued' | 'preorder'

interface NormalizedUniversal<F extends string> {
  brand: string
  series: string
  family: F
  material: string
  productCode: string
  msrp?: number
  availability?: AvailabilityState
  color?: string
}

export type BlankFamily =
  | 'spinningBlank'
  | 'castingBlank'
  | 'flyBlank'
  | 'surfBlank'
  | 'saltwaterBlank'
  | 'centerPinBlank'
  | 'iceBlank'
  | 'glassBlank'
  | 'compositeBlank'
  | 'trollingBlank'

export interface NormalizedBlank extends NormalizedUniversal<BlankFamily> {
  itemTotalLengthIn: number
  numberOfPieces: number
  power: string
  action: string
  application: string[]
  blankType: string
  materialConstruction: string
  lineRating: string
  lureRating: string
  tipOD_mm: number
  buttOD_mm: number
  blankWeightOz: number
  intrinsicPower_g?: number
  actionAngle_deg?: number
  ern?: number
  tenInDiameter_mm?: number
  twentyInDiameter_mm?: number
  thirtyInDiameter_mm?: number
  finish?: string
  notes?: string
  suitableFor?: string[]
}

export type GuideFamily =
  | 'singleFootGuide'
  | 'doubleFootGuide'
  | 'flyGuide'
  | 'castingBoatGuide'
  | 'microGuide'
  | 'rollerGuide'
  | 'guideKit'

export interface NormalizedGuide extends NormalizedUniversal<GuideFamily> {
  frameMaterial: string
  frameMaterialCode?: string
  frameFinish: string
  ringMaterial: string
  ringMaterialCode?: string
  ringSize: number
  tubeSize?: number
  footType: string
  height_mm: number
  weightOz: number
  footLength_mm?: number
  frameProfile?: string
  usageHints?: string
  kitContents?: string[]
}

export type TipTopFamily =
  | 'castingTipTop'
  | 'spinningTipTop'
  | 'flyTipTop'
  | 'rollerTipTop'
  | 'microTipTop'
  | 'boatTipTop'

export interface NormalizedTipTop extends NormalizedUniversal<TipTopFamily> {
  frameMaterial: string
  frameMaterialCode?: string
  frameFinish: string
  ringMaterial: string
  ringMaterialCode?: string
  ringSize: number
  tubeSize: number
  tipTopType: 'Standard' | 'Heavy Duty' | 'Medium Duty' | 'Boat' | 'Fly' | 'Micro'
  displayName: string
  weightOz?: number
  height_mm?: number
  notes?: string
  pricingTier?: string
}

export type GripFamily =
  | 'splitGrip'
  | 'rearGrip'
  | 'foreGrip'
  | 'fullWells'
  | 'halfWells'
  | 'fightingButt'
  | 'switchGrip'
  | 'carbonSplitGrip'
  | 'carbonRearGrip'
  | 'winnGrip'
  | 'iceGrip'

export interface NormalizedGrip extends NormalizedUniversal<GripFamily> {
  itemLengthIn: number
  insideDiameterIn: number
  frontODIn: number
  rearODIn: number
  profileShape: string
  weight_g?: number
  urethaneFilled?: boolean
  winnPattern?: string
  texture?: string
  notes?: string
}

export type ReelSeatFamily =
  | 'spinningSeat'
  | 'castingSeat'
  | 'triggerCastingSeat'
  | 'flySeat'
  | 'trollingSeat'
  | 'saltwaterSeat'
  | 'iceSeat'
  | 'railSeat'

export interface NormalizedReelSeat extends NormalizedUniversal<ReelSeatFamily> {
  seatSize: string
  itemLengthIn: number
  insideDiameterIn: number
  bodyOutsideDiameterIn: number
  seatOrientation: 'upLock' | 'downLock' | 'trigger' | 'pistol'
  hoodOutsideDiameterIn?: number
  insertMaterial?: string
  threadSpec?: string
  hardwareFinish?: string
  weightOz?: number
}

export type TrimFamily =
  | 'trimRing'
  | 'pipeExtension'
  | 'windingCheck'
  | 'lockingRing'
  | 'hookKeeper'
  | 'decorativeTrim'
  | 'buttWrap'
  | 'carbonTube'

export interface NormalizedTrim extends NormalizedUniversal<TrimFamily> {
  itemLengthIn: number
  insideDiameterIn: number
  outsideDiameterIn: number
  heightIn?: number
  weightOz?: number
  plating?: string
  pattern?: string
  notes?: string
}

export type EndCapFamily =
  | 'buttCap'
  | 'rubberCap'
  | 'evaCap'
  | 'pvcCap'
  | 'fightingButtCap'
  | 'gimbal'
  | 'aluminumCap'
  | 'carbonButtCap'

export interface NormalizedEndCap extends NormalizedUniversal<EndCapFamily> {
  itemLengthIn: number
  insideDiameterIn: number
  outsideDiameterIn: number
  endCapDepthIn?: number
  weightOz?: number
  hardwareInterface?: string
  notes?: string
}

export type BatsonNormalizedRecord =
  | NormalizedBlank
  | NormalizedGuide
  | NormalizedTipTop
  | NormalizedGrip
  | NormalizedReelSeat
  | NormalizedTrim
  | NormalizedEndCap
