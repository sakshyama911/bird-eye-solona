/**
 * Heuristic safety score (0–100) for Solana token_security payloads.
 * Not financial advice; combines holder concentration + common rug indicators.
 */

function normalizeRatio(value) {
  if (value == null || Number.isNaN(value)) return null
  const n = Number(value)
  if (n > 1) return Math.min(1, n / 100)
  return Math.max(0, n)
}

export function scoreSolanaToken(security) {
  const risks = []
  if (!security || typeof security !== 'object') {
    return {
      score: 0,
      level: 'unknown',
      risks: ['Security data unavailable'],
      top10HolderPercent: null,
    }
  }

  let score = 100

  const top10Raw =
    security.top10HolderPercent ?? security.top10UserPercent ?? null
  const top10 = normalizeRatio(top10Raw)
  if (top10 != null) {
    const pct = top10 * 100
    if (pct >= 70) {
      score -= 40
      risks.push('Extreme top-10 holder concentration')
    } else if (pct >= 55) {
      score -= 28
      risks.push('Very high top-10 concentration')
    } else if (pct >= 45) {
      score -= 18
      risks.push('High top-10 holder concentration')
    } else if (pct >= 35) {
      score -= 10
      risks.push('Elevated top-10 concentration')
    }
  }

  const creatorPct = normalizeRatio(security.creatorPercentage)
  if (creatorPct != null && creatorPct > 0) {
    const c = creatorPct * 100
    if (c >= 20) {
      score -= 25
      risks.push('Creator holds a very large share')
    } else if (c >= 10) {
      score -= 15
      risks.push('Creator holds a large share')
    } else if (c >= 5) {
      score -= 8
      risks.push('Creator retains a notable share')
    }
  }

  if (security.mutableMetadata === true) {
    score -= 10
    risks.push('Metadata is mutable')
  }

  if (security.freezeable === true) {
    score -= 18
    risks.push('Freeze authority may be active')
  }

  if (security.transferFeeEnable === true) {
    score -= 12
    risks.push('Transfer fee extension enabled')
  }

  if (security.nonTransferable === true) {
    score -= 15
    risks.push('Non-transferable token')
  }

  if (security.jupStrictList === true) {
    score = Math.min(100, score + 8)
  }

  score = Math.max(0, Math.min(100, Math.round(score)))

  let level = 'red'
  if (score >= 70) level = 'green'
  else if (score >= 45) level = 'yellow'

  return {
    score,
    level,
    risks,
    top10HolderPercent: top10,
  }
}

export function riskLevelMeetsFilter(level, filter) {
  if (filter === 'all') return true
  if (filter === 'safe') return level === 'green' || level === 'yellow'
  return true
}
