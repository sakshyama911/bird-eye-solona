import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })
dotenv.config({ path: path.join(__dirname, '../.env') })
import { createBirdeyeClient } from './birdeye.js'
import { riskLevelMeetsFilter, scoreSolanaToken } from './safety.js'

const PORT = Number(process.env.PORT) || 8787
/** Longer default cache to avoid burning rate limits on refresh */
const CACHE_MS = Number(process.env.RADAR_CACHE_MS) || 15 * 60 * 1000
const CHAIN = process.env.BIRDEYE_CHAIN || 'solana'
/** Max new listings to enrich per pull (each = 2 API calls + shared listing call) */
const RADAR_TOKEN_LIMIT = Math.min(
  20,
  Math.max(1, Number(process.env.RADAR_TOKEN_LIMIT) || 10),
)
const LISTING_FETCH_LIMIT = Math.min(20, RADAR_TOKEN_LIMIT)

const TOKEN_DETAILS_CACHE_MS =
  Number(process.env.TOKEN_DETAILS_CACHE_MS) || 5 * 60 * 1000

const apiStats = {
  birdeyeCalls: 0,
  lastRadarAt: null,
  lastError: null,
}

let radarCache = {
  expires: 0,
  payload: null,
}

let tokenDetailsCache = new Map()

function trackCall() {
  apiStats.birdeyeCalls += 1
}

async function withTracking(promise) {
  trackCall()
  return promise
}

function clampRange(range) {
  if (range === '7d' || range === '30d') return range
  return '1d'
}

function msSince(iso) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Date.now() - t
}

function formatDuration(ms) {
  if (ms == null) return '—'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

async function computeRangeMomentumPercent(client, address, currentPrice, range) {
  if (!currentPrice || typeof currentPrice !== 'number') return null
  if (range === '1d') return null
  if (CHAIN !== 'solana') return null

  const nowSec = Math.floor(Date.now() / 1000)
  const days = range === '7d' ? 7 : 30
  const past = nowSec - days * 86400

  const pastRes = await withTracking(client.historicalPriceUnix(address, past))
  const pastPrice = pastRes?.success ? pastRes?.data?.value ?? null : null
  if (!pastPrice || typeof pastPrice !== 'number') return null
  if (pastPrice === 0) return null
  return ((currentPrice - pastPrice) / pastPrice) * 100
}

async function enrichListingRow(client, item, range) {
  const address = item.address
  let securityRaw = null
  let overviewRaw = null
  let securityError = null
  let overviewError = null

  try {
    securityRaw = await withTracking(client.tokenSecurity(address))
  } catch (e) {
    securityError = e.message
  }

  try {
    overviewRaw = await withTracking(client.tokenOverview(address))
  } catch (e) {
    overviewError = e.message
  }

  const secData =
    securityRaw?.success && securityRaw?.data ? securityRaw.data : null
  const safety = scoreSolanaToken(secData)

  const ov =
    overviewRaw?.success && overviewRaw?.data ? overviewRaw.data : null

  const listingAgeMs = msSince(item.liquidityAddedAt)

  const currentPrice = ov?.price ?? null
  const momentum1d = ov?.priceChange24hPercent ?? null
  let momentumPercent = momentum1d
  let momentumComputed = false

  if (range === '7d' || range === '30d') {
    try {
      const computed = await computeRangeMomentumPercent(
        client,
        address,
        currentPrice,
        range,
      )
      if (computed != null) {
        momentumPercent = computed
        momentumComputed = true
      }
    } catch {
      // ignore; keep 1d fallback
    }
  }

  return {
    address,
    symbol: item.symbol,
    name: item.name,
    logoURI: item.logoURI,
    source: item.source,
    liquidityAddedAt: item.liquidityAddedAt,
    listingAgeLabel: formatDuration(listingAgeMs),
    listingLiquidityUsd: item.liquidity ?? null,
    price: currentPrice,
    priceChange24hPercent: momentum1d,
    range,
    momentumPercent,
    momentumComputed,
    liquidity: ov?.liquidity ?? null,
    volume24hUsd: ov?.v24hUSD ?? null,
    holders: ov?.holder ?? null,
    safety: {
      score: safety.score,
      level: safety.level,
      risks: safety.risks,
      top10HolderPercent: safety.top10HolderPercent,
    },
    rawErrors: {
      security: securityError,
      overview: overviewError,
    },
  }
}

async function buildRadarPayload(client, range) {
  const listingRes = await withTracking(
    client.newListing({
      limit: LISTING_FETCH_LIMIT,
      memePlatformEnabled: true,
    }),
  )

  if (!listingRes?.success) {
    const msg = listingRes?.message || 'new_listing failed'
    throw new Error(msg)
  }

  const items = (listingRes?.data?.items ?? []).slice(0, RADAR_TOKEN_LIMIT)

  const enriched = []
  for (const item of items) {
    enriched.push(await enrichListingRow(client, item, range))
  }

  enriched.sort((a, b) => {
    const ta = new Date(a.liquidityAddedAt || 0).getTime()
    const tb = new Date(b.liquidityAddedAt || 0).getTime()
    return tb - ta
  })

  return {
    updatedAt: new Date().toISOString(),
    chain: CHAIN,
    range,
    items: enriched,
  }
}

function createApp() {
  const app = express()
  app.use(cors({ origin: process.env.CORS_ORIGIN || true }))
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.get('/api/stats', (_req, res) => {
    res.json({
      birdeyeCallsTotal: apiStats.birdeyeCalls,
      lastRadarAt: apiStats.lastRadarAt,
      lastError: apiStats.lastError,
      cacheTtlMs: CACHE_MS,
    })
  })

  app.get('/api/radar', async (req, res) => {
    const filter = req.query.filter === 'all' ? 'all' : 'safe'
    const bypass =
      req.query.refresh === '1' || req.query.refresh === 'true'
    const range = clampRange(req.query.range)

    try {
      const apiKey = process.env.BIRDEYE_API_KEY
      if (!apiKey) {
        res.status(500).json({
          error: 'Server misconfiguration',
          message: 'Set BIRDEYE_API_KEY on the server',
        })
        return
      }

      const now = Date.now()
      if (
        !bypass &&
        radarCache.payload &&
        radarCache.payload.range === range &&
        radarCache.expires > now
      ) {
        const payload = applyFilter(radarCache.payload, filter, range)
        res.json({
          ...payload,
          cached: true,
          birdeyeCallsTotal: apiStats.birdeyeCalls,
        })
        return
      }

      const client = createBirdeyeClient(apiKey, CHAIN)
      const payload = await buildRadarPayload(client, range)
      apiStats.lastRadarAt = payload.updatedAt
      apiStats.lastError = null

      radarCache = {
        expires: now + CACHE_MS,
        payload,
      }

      res.json({
        ...applyFilter(payload, filter, range),
        cached: false,
        birdeyeCallsTotal: apiStats.birdeyeCalls,
      })
    } catch (err) {
      apiStats.lastError = err.message
      const status =
        typeof err.status === 'number' &&
        err.status >= 400 &&
        err.status < 600
          ? err.status
          : 502

      if (radarCache.payload) {
        res.json({
          ...applyFilter(radarCache.payload, filter, range),
          cached: true,
          staleAfterError: true,
          warning:
            err.message?.includes?.('Too many') || err.status === 429
              ? 'Birdeye rate limited this request—you are seeing the last good scan. Wait a few minutes before Refresh.'
              : `Could not refresh: ${err.message}. Showing cached data.`,
          birdeyeCallsTotal: apiStats.birdeyeCalls,
        })
        return
      }

      res.status(status).json({
        error: 'Radar fetch failed',
        message: err.message,
        birdeyeCallsTotal: apiStats.birdeyeCalls,
      })
    }
  })

  app.get('/api/token/:address', async (req, res) => {
    const address = req.params.address
    const now = Date.now()
    const cached = tokenDetailsCache.get(address)
    if (cached && cached.expires > now) {
      res.json({ ...cached.payload, cached: true })
      return
    }

    try {
      const apiKey = process.env.BIRDEYE_API_KEY
      if (!apiKey) {
        res.status(500).json({
          error: 'Server misconfiguration',
          message: 'Set BIRDEYE_API_KEY on the server',
        })
        return
      }

      const client = createBirdeyeClient(apiKey, CHAIN)
      const securityRaw = await withTracking(client.tokenSecurity(address))
      const overviewRaw = await withTracking(client.tokenOverview(address))

      const secData =
        securityRaw?.success && securityRaw?.data ? securityRaw.data : null
      const safety = scoreSolanaToken(secData)
      const ov =
        overviewRaw?.success && overviewRaw?.data ? overviewRaw.data : null

      const price = ov?.price ?? null
      let change7d = null
      let change30d = null
      if (CHAIN === 'solana' && price != null) {
        try {
          change7d = await computeRangeMomentumPercent(
            client,
            address,
            price,
            '7d',
          )
        } catch {
          change7d = null
        }
        try {
          change30d = await computeRangeMomentumPercent(
            client,
            address,
            price,
            '30d',
          )
        } catch {
          change30d = null
        }
      }

      const payload = {
        updatedAt: new Date().toISOString(),
        chain: CHAIN,
        address,
        name: ov?.name ?? null,
        symbol: ov?.symbol ?? null,
        logoURI: ov?.logoURI ?? null,
        price,
        liquidity: ov?.liquidity ?? null,
        volume24hUsd: ov?.v24hUSD ?? null,
        holders: ov?.holder ?? null,
        top10HolderPercent:
          safety.top10HolderPercent ?? secData?.top10HolderPercent ?? null,
        safety: {
          score: safety.score,
          level: safety.level,
          risks: safety.risks,
        },
        changes: {
          d1: ov?.priceChange24hPercent ?? null,
          d7: change7d,
          d30: change30d,
        },
      }

      tokenDetailsCache.set(address, {
        expires: now + TOKEN_DETAILS_CACHE_MS,
        payload,
      })

      res.json({ ...payload, cached: false })
    } catch (err) {
      const status =
        typeof err.status === 'number' &&
        err.status >= 400 &&
        err.status < 600
          ? err.status
          : 502
      res.status(status).json({
        error: 'Token fetch failed',
        message: err.message,
        birdeyeCallsTotal: apiStats.birdeyeCalls,
      })
    }
  })

  return app
}

function applyFilter(payload, filter, range) {
  const items = (payload.items || []).filter((row) =>
    riskLevelMeetsFilter(row.safety?.level || 'unknown', filter),
  )
  return { ...payload, items, filter, range }
}

const app = createApp()
app.listen(PORT, () => {
  console.log(`Bird Eye API listening on http://localhost:${PORT}`)
})

export { createApp }
