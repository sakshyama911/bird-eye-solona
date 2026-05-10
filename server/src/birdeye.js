const BASE = 'https://public-api.birdeye.so'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export function createBirdeyeClient(apiKey, chain = 'solana') {
  if (!apiKey) {
    throw new Error('BIRDEYE_API_KEY is required')
  }

  const headers = {
    'X-API-KEY': apiKey,
    'x-chain': chain,
    Accept: 'application/json',
  }

  const minIntervalMs = Number(process.env.BIRDEYE_MIN_INTERVAL_MS) || 450
  const maxRetries = Math.max(1, Number(process.env.BIRDEYE_MAX_RETRIES) || 6)
  let lastRequestAt = 0

  async function pace() {
    const now = Date.now()
    const wait = Math.max(0, minIntervalMs - (now - lastRequestAt))
    if (wait > 0) await sleep(wait)
    lastRequestAt = Date.now()
  }

  async function fetchJson(path, searchParams = {}) {
    const url = new URL(path, BASE)
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    }

    let lastErr
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      await pace()
      const res = await fetch(url, { headers })
      const text = await res.text()
      let body
      try {
        body = text ? JSON.parse(text) : null
      } catch {
        body = { raw: text }
      }

      if (res.status === 429) {
        const ra = res.headers.get('retry-after')
        const sec = ra ? Number.parseInt(ra, 10) : NaN
        const backoffMs = Number.isFinite(sec) && sec > 0
          ? Math.min(sec * 1000, 120_000)
          : Math.min(2000 * 2 ** attempt, 60_000)
        lastErr = new Error(body?.message || 'Too many requests')
        lastErr.status = 429
        lastErr.body = body
        await sleep(backoffMs)
        continue
      }

      if (!res.ok) {
        const msg = body?.message || res.statusText || 'Birdeye request failed'
        const err = new Error(msg)
        err.status = res.status
        err.body = body
        throw err
      }
      return body
    }

    throw lastErr || new Error('Too many requests')
  }

  return {
    newListing({ limit = 20, timeTo, memePlatformEnabled = true } = {}) {
      return fetchJson('/defi/v2/tokens/new_listing', {
        limit,
        ...(timeTo != null ? { time_to: timeTo } : {}),
        meme_platform_enabled: memePlatformEnabled,
      })
    },
    tokenSecurity(address) {
      return fetchJson('/defi/token_security', { address })
    },
    tokenOverview(address) {
      return fetchJson('/defi/token_overview', {
        address,
        frames: '24h',
      })
    },
    historicalPriceUnix(address, unixtime) {
      return fetchJson('/defi/historical_price_unix', {
        address,
        ...(unixtime != null ? { unixtime } : {}),
        ui_amount_mode: 'raw',
      })
    },
  }
}
