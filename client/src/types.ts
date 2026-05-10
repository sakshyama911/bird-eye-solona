export type RiskLevel = 'green' | 'yellow' | 'red' | 'unknown'

export type RadarRow = {
  address: string
  symbol: string
  name: string
  logoURI: string | null
  source: string
  liquidityAddedAt: string
  listingAgeLabel: string
  listingLiquidityUsd: number | null
  price: number | null
  priceChange24hPercent: number | null
  range?: '1d' | '7d' | '30d'
  momentumPercent?: number | null
  momentumComputed?: boolean
  liquidity: number | null
  volume24hUsd: number | null
  holders: number | null
  safety: {
    score: number
    level: RiskLevel
    risks: string[]
    top10HolderPercent: number | null
  }
  rawErrors: { security: string | null; overview: string | null }
}

export type RadarResponse = {
  updatedAt: string
  chain: string
  range?: '1d' | '7d' | '30d'
  items: RadarRow[]
  filter: string
  cached: boolean
  staleAfterError?: boolean
  warning?: string
  birdeyeCallsTotal?: number
}

export type TokenDetailsResponse = {
  updatedAt: string
  chain: string
  address: string
  name: string | null
  symbol: string | null
  logoURI: string | null
  price: number | null
  liquidity: number | null
  volume24hUsd: number | null
  holders: number | null
  top10HolderPercent: number | null
  safety: { score: number; level: RiskLevel; risks: string[] }
  changes: { d1: number | null; d7: number | null; d30: number | null }
  cached: boolean
}
