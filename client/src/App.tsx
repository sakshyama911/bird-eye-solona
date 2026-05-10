import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'
import type {
  RadarResponse,
  RadarRow,
  RiskLevel,
  TokenDetailsResponse,
} from './types'

const SOL_MINT = 'So11111111111111111111111111111111111111112'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

const LS_THEME = 'bird-eye-theme'
const LS_FILTER = 'bird-eye-filter'
const LS_RANGE = 'bird-eye-range'

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

function IconSun({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" strokeLinecap="round" />
    </svg>
  )
}

function IconMoon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconRefresh({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M21 2v6h-6M3 12a9 9 0 0115.18-6.18L21 8M3 22v-6h6M21 12a9 9 0 01-15.18 6.18L3 16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" strokeLinecap="round" />
    </svg>
  )
}

function IconExternal({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M18 13v6a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function riskBadgeClasses(level: RiskLevel) {
  switch (level) {
    case 'green':
      return 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-400/25 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06)]'
    case 'yellow':
      return 'bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-amber-400/25 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06)]'
    case 'red':
      return 'bg-red-500/12 text-red-600 dark:text-red-400 ring-red-400/25 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06)]'
    default:
      return 'bg-slate-500/12 text-slate-600 dark:text-slate-400 ring-slate-400/20'
  }
}

function formatUsd(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

function formatPrice(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—'
  if (n >= 1) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
  if (n >= 0.0001) return `$${n.toFixed(6)}`
  return `$${n.toExponential(2)}`
}

function formatPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function formatTop10(p: number | null | undefined) {
  if (p == null || Number.isNaN(p)) return '—'
  return `${(p * 100).toFixed(1)}%`
}

function jupiterUrl(mint: string) {
  return `https://jup.ag/swap/${SOL_MINT}-${mint}`
}

function raydiumUrl(mint: string) {
  return `https://raydium.io/swap/?inputMint=${SOL_MINT}&outputMint=${mint}`
}

type SortKey = 'recency' | 'safety' | 'momentum' | 'volume' | 'liquidity'

export default function App() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return true
    const saved = localStorage.getItem(LS_THEME)
    if (saved === 'light') return false
    if (saved === 'dark') return true
    // default to dark for premium feel
    return true
  })
  const [data, setData] = useState<RadarResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [apiFilter, setApiFilter] = useState<'safe' | 'all'>(() => {
    if (typeof window === 'undefined') return 'safe'
    const saved = localStorage.getItem(LS_FILTER)
    return saved === 'all' ? 'all' : 'safe'
  })
  const [range, setRange] = useState<'1d' | '7d' | '30d'>(() => {
    if (typeof window === 'undefined') return '1d'
    const saved = localStorage.getItem(LS_RANGE)
    return saved === '7d' || saved === '30d' ? saved : '1d'
  })
  const [sortKey, setSortKey] = useState<SortKey>('recency')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  // Advanced filters (client-side)
  const [minSafety, setMinSafety] = useState(0)
  const [maxTop10, setMaxTop10] = useState(100) // percent
  const [minLiquidityUsd, setMinLiquidityUsd] = useState(0)
  const [minVolumeUsd, setMinVolumeUsd] = useState(0)
  const [minMomentum, setMinMomentum] = useState(-1000) // percent

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerRow, setDrawerRow] = useState<RadarRow | null>(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [drawerError, setDrawerError] = useState<string | null>(null)
  const [drawerData, setDrawerData] = useState<TokenDetailsResponse | null>(
    null,
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem(LS_THEME, dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    localStorage.setItem(LS_FILTER, apiFilter)
  }, [apiFilter])

  useEffect(() => {
    localStorage.setItem(LS_RANGE, range)
  }, [range])

  const load = useCallback(
    async (opts?: { refresh?: boolean }) => {
      setLoading(true)
      setError(null)
      try {
        const q = new URLSearchParams({
          filter: apiFilter,
          range,
          ...(opts?.refresh ? { refresh: '1' } : {}),
        })
        const res = await fetch(`${API_BASE}/api/radar?${q}`)
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(body.message || body.error || `HTTP ${res.status}`)
        }
        setData(body as RadarResponse)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Request failed')
        setData(null)
      } finally {
        setLoading(false)
      }
    },
    [apiFilter, range],
  )

  useEffect(() => {
    void load()
  }, [load])

  const sorted = useMemo(() => {
    const items = data?.items ?? []
    const filteredByQuery = query.trim()
      ? items.filter(
          (r) =>
            r.symbol.toLowerCase().includes(query.toLowerCase()) ||
            r.name.toLowerCase().includes(query.toLowerCase()) ||
            r.address.toLowerCase().includes(query.toLowerCase()),
        )
      : items

    const filtered = filteredByQuery.filter((r) => {
      if ((r.safety?.score ?? 0) < minSafety) return false
      const top10 = r.safety?.top10HolderPercent
      if (top10 != null && top10 * 100 > maxTop10) return false
      const liq = r.liquidity ?? r.listingLiquidityUsd ?? null
      if (liq != null && liq < minLiquidityUsd) return false
      const vol = r.volume24hUsd
      if (vol != null && vol < minVolumeUsd) return false
      const mom = r.momentumPercent ?? r.priceChange24hPercent
      if (mom != null && mom < minMomentum) return false
      return true
    })

    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'safety':
          return (a.safety.score - b.safety.score) * dir
        case 'momentum': {
          const pa = (a.momentumPercent ?? a.priceChange24hPercent) ?? -Infinity
          const pb = (b.momentumPercent ?? b.priceChange24hPercent) ?? -Infinity
          return (pa - pb) * dir
        }
        case 'volume': {
          const va = a.volume24hUsd ?? -1
          const vb = b.volume24hUsd ?? -1
          return (va - vb) * dir
        }
        case 'liquidity': {
          const la = a.liquidity ?? a.listingLiquidityUsd ?? -1
          const lb = b.liquidity ?? b.listingLiquidityUsd ?? -1
          return (la - lb) * dir
        }
        case 'recency':
        default: {
          const ta = new Date(a.liquidityAddedAt).getTime()
          const tb = new Date(b.liquidityAddedAt).getTime()
          return (ta - tb) * dir
        }
      }
    })
  }, [
    data,
    query,
    sortKey,
    sortDir,
    minSafety,
    maxTop10,
    minLiquidityUsd,
    minVolumeUsd,
    minMomentum,
  ])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const copy = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr)
      setCopied(addr)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied(null)
    }
  }

  const openDrawer = useCallback(async (row: RadarRow) => {
    setDrawerRow(row)
    setDrawerOpen(true)
    setDrawerLoading(true)
    setDrawerError(null)
    setDrawerData(null)
    try {
      const res = await fetch(`${API_BASE}/api/token/${row.address}`)
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.message || body.error || `HTTP ${res.status}`)
      }
      setDrawerData(body as TokenDetailsResponse)
    } catch (e) {
      setDrawerError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setDrawerLoading(false)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const safeShare =
    data?.items?.filter((r) => r.safety.level === 'green' || r.safety.level === 'yellow').length ?? 0

  const securityErrorMessage = data?.items?.find((r) => r.rawErrors?.security)?.rawErrors.security

  const resetFilters = () => {
    setMinSafety(0)
    setMaxTop10(100)
    setMinLiquidityUsd(0)
    setMinVolumeUsd(0)
    setMinMomentum(-1000)
    setQuery('')
    setApiFilter('all')
  }

  return (
    <div className="min-h-screen">
      <nav className="border-line/60 sticky top-0 z-50 border-b bg-[rgb(var(--surface-deep)/0.85)] backdrop-blur-md backdrop-saturate-150">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="bg-accent/15 text-accent ring-accent/25 flex h-10 w-10 items-center justify-center rounded-xl ring-1">
              <span className="font-display text-lg font-bold tracking-tight">B</span>
            </div>
            <div className="hidden min-[380px]:block">
              <p className="font-display text-ink text-sm font-semibold tracking-tight">Bird Eye</p>
              <p className="text-ink-faint text-2xs font-medium uppercase tracking-wider">
                Birdeye data layer
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <a
              href="https://docs.birdeye.so/"
              target="_blank"
              rel="noreferrer"
              className="text-ink-muted hover:text-accent hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium transition sm:inline-flex"
            >
              API docs
              <IconExternal className="h-3.5 w-3.5 opacity-60" />
            </a>
            <a
              href="https://discord.gg/tbKbCmU5fM"
              target="_blank"
              rel="noreferrer"
              className="text-ink-muted hover:text-accent hidden rounded-lg px-2 py-1.5 text-sm font-medium transition md:inline"
            >
              Discord
            </a>
            <span className="bg-accent/10 text-accent ring-accent/20 hidden rounded-full px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide ring-1 sm:inline">
              BIP · Sprint 4
            </span>
            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              className="text-ink-muted hover:bg-surface-elevated hover:text-ink ring-line flex h-10 w-10 items-center justify-center rounded-xl ring-1 transition"
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <IconSun className="h-5 w-5" /> : <IconMoon className="h-5 w-5" />}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void load({ refresh: true })}
              className="font-display bg-accent text-slate-950 hover:bg-accent-dim flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-glow transition disabled:opacity-50"
            >
              <IconRefresh className={cn('h-4 w-4', loading && 'animate-spin')} />
              <span className="hidden sm:inline">{loading ? 'Syncing…' : 'Sync data'}</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-[1440px] px-4 pb-20 pt-10 sm:px-6 lg:px-10">
        <header className="animate-fade-in mb-12 max-w-4xl">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="bg-surface-elevated text-accent ring-line rounded-full px-3 py-1 text-2xs font-semibold uppercase tracking-widest ring-1">
              May 9 – May 16, 2026
            </span>
            <span className="text-ink-faint text-2xs font-medium uppercase tracking-widest">
              New token radar · Solana
            </span>
          </div>
          <h1 className="font-display text-gradient mb-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
            The watchlist for serious degens
          </h1>
          <p className="text-ink-muted max-w-2xl text-base leading-relaxed sm:text-lg">
            Fresh listings from Birdeye, scored for holder concentration and common rug signals—so you
            scan what passes a first sanity check, not every launch on the timeline.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { k: 'Sprint', v: '4 of 4', sub: 'Birdeye Data BIP' },
              { k: 'Ship bar', v: '50+ calls', sub: 'Minimum qualification' },
            ].map((card) => (
              <div
                key={card.k}
                className="panel-glass rounded-2xl px-4 py-3.5 transition hover:shadow-glow"
              >
                <p className="text-ink-faint text-2xs font-semibold uppercase tracking-wider">{card.k}</p>
                <p className="font-display text-ink mt-1 text-lg font-semibold tracking-tight">{card.v}</p>
                <p className="text-ink-muted mt-0.5 text-xs">{card.sub}</p>
              </div>
            ))}
          </div>
        </header>

        {data && (
          <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Tokens in view"
              value={String(data.items.length)}
              hint={apiFilter === 'safe' ? 'Safe + medium filter' : 'All risk levels'}
            />
            <StatCard
              label="Passing filter"
              value={String(safeShare)}
              hint="Green or yellow tier"
            />
            <StatCard
              label="Birdeye calls"
              value={typeof data.birdeyeCallsTotal === 'number' ? String(data.birdeyeCallsTotal) : '—'}
              hint="Server-side total"
            />
            <StatCard
              label="Data freshness"
              value={data.cached ? 'Cached' : 'Live pull'}
              hint={new Date(data.updatedAt).toLocaleTimeString()}
            />
          </section>
        )}

        <section className="panel-glass mb-8 rounded-2xl p-1">
          <div className="rounded-[0.9rem] bg-[rgb(var(--surface)/0.4)] p-4 sm:p-5 dark:bg-[rgb(var(--surface-deep)/0.35)]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-display text-ink text-sm font-semibold">Watchlist mode</p>
                <p className="text-ink-muted mt-0.5 text-xs">
                  Default surfaces tokens that are not flagged high-risk by our heuristic.
                </p>
                <div className="mt-3 inline-flex rounded-xl bg-[rgb(var(--surface-deep)/0.65)] p-1 ring-1 ring-[rgb(var(--line)/0.5)] dark:bg-black/25">
                  <button
                    type="button"
                    onClick={() => setApiFilter('safe')}
                    className={cn(
                      'font-display rounded-lg px-4 py-2 text-sm font-semibold transition',
                      apiFilter === 'safe'
                        ? 'bg-surface-elevated text-ink shadow-card'
                        : 'text-ink-muted hover:text-ink',
                    )}
                  >
                    Safe + medium
                  </button>
                  <button
                    type="button"
                    onClick={() => setApiFilter('all')}
                    className={cn(
                      'font-display rounded-lg px-4 py-2 text-sm font-semibold transition',
                      apiFilter === 'all'
                        ? 'bg-surface-elevated text-ink shadow-card'
                        : 'text-ink-muted hover:text-ink',
                    )}
                  >
                    All risks
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-ink-faint text-2xs font-semibold uppercase tracking-wider">
                    Range
                  </span>
                  <div className="inline-flex rounded-xl bg-[rgb(var(--surface-deep)/0.65)] p-1 ring-1 ring-[rgb(var(--line)/0.5)] dark:bg-black/25">
                    {(['1d', '7d', '30d'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRange(r)}
                        className={cn(
                          'font-display rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                          range === r
                            ? 'bg-surface-elevated text-ink shadow-card'
                            : 'text-ink-muted hover:text-ink',
                        )}
                      >
                        {r.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex w-full flex-col gap-3 sm:max-w-md lg:items-end">
                <label className="relative w-full">
                  <IconSearch className="text-ink-faint pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <input
                    type="search"
                    placeholder="Filter by name, symbol, or address…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="font-sans text-ink placeholder:text-ink-faint/80 ring-line focus:ring-accent w-full rounded-xl border-0 bg-[rgb(var(--surface-elevated)/0.9)] py-3 pl-10 pr-4 text-sm ring-1 transition focus:ring-2 dark:bg-black/35"
                  />
                </label>
                {data && (
                  <p className="text-ink-faint text-2xs">
                    Last ingest{' '}
                    <time dateTime={data.updatedAt} className="text-ink-muted font-mono text-xs">
                      {new Date(data.updatedAt).toLocaleString()}
                    </time>
                    {data.staleAfterError && (
                      <span className="text-amber-600 dark:text-amber-400"> · stale snapshot</span>
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <FilterNumber
                label="Min safety"
                value={minSafety}
                onChange={setMinSafety}
                min={0}
                max={100}
                step={1}
              />
              <FilterNumber
                label="Max top10 %"
                value={maxTop10}
                onChange={setMaxTop10}
                min={0}
                max={100}
                step={1}
              />
              <FilterNumber
                label="Min liquidity ($)"
                value={minLiquidityUsd}
                onChange={setMinLiquidityUsd}
                min={0}
                max={1_000_000}
                step={1000}
              />
              <FilterNumber
                label="Min vol 24h ($)"
                value={minVolumeUsd}
                onChange={setMinVolumeUsd}
                min={0}
                max={5_000_000}
                step={1000}
              />
              <FilterNumber
                label={`Min ${range.toUpperCase()} Δ (%)`}
                value={minMomentum}
                onChange={setMinMomentum}
                min={-100}
                max={500}
                step={1}
              />
            </div>
          </div>
        </section>

        {data?.warning && (
          <div
            className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3.5 text-sm text-amber-900 shadow-inset dark:border-amber-400/25 dark:text-amber-100"
            role="status"
          >
            {data.warning}
          </div>
        )}

        {error && (
          <div
            className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/[0.07] px-4 py-3.5 text-sm text-red-800 shadow-inset dark:text-red-200"
            role="alert"
          >
            <strong className="font-display font-semibold">Radar unavailable. </strong>
            {error}
            <div className="text-ink-muted mt-2 text-xs leading-relaxed">
              {/too many|rate|429/i.test(error) ? (
                <>
                  Birdeye is rate-limiting. Space out refreshes or increase{' '}
                  <code className="font-mono text-[11px] text-ink">BIRDEYE_MIN_INTERVAL_MS</code> /{' '}
                  <code className="font-mono text-[11px] text-ink">RADAR_CACHE_MS</code> in{' '}
                  <code className="font-mono text-[11px] text-ink">.env</code>.
                </>
              ) : (
                <>
                  Confirm <code className="font-mono text-[11px]">BIRDEYE_API_KEY</code> on the API.
                  <code className="font-mono text-[11px]"> /defi/v2/tokens/new_listing</code> may need
                  Standard tier access.
                </>
              )}
            </div>
          </div>
        )}

        {securityErrorMessage && (
          <div
            className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3.5 text-sm text-amber-900 shadow-inset dark:border-amber-400/25 dark:text-amber-100"
            role="status"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-600 dark:text-amber-400">!</span>
              <strong className="font-semibold text-amber-900 dark:text-amber-100">Limited API Permissions</strong>
            </div>
            <p className="mt-1 opacity-80">
              Your Birdeye API key returned an error for security data: <code className="font-mono text-[12px]">{securityErrorMessage}</code>. 
              Tokens are appearing with a 0 safety score because security checks could not be performed.
            </p>
          </div>
        )}

        <div className="panel-glow overflow-hidden rounded-2xl shadow-card-lg">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
              <thead>
                <tr className="from-surface-elevated/98 border-line/80 sticky top-0 z-10 border-b bg-gradient-to-b to-transparent text-2xs font-semibold uppercase tracking-wider backdrop-blur-md">
                  <th className="text-ink-muted px-5 py-4 font-semibold">Asset</th>
                  <th className="text-ink-muted px-4 py-4 font-semibold">
                    <SortBtn
                      label="Listed"
                      active={sortKey === 'recency'}
                      dir={sortDir}
                      onClick={() => toggleSort('recency')}
                    />
                  </th>
                  <th className="text-ink-muted px-4 py-4 font-semibold">
                    <SortBtn
                      label="Safety"
                      active={sortKey === 'safety'}
                      dir={sortDir}
                      onClick={() => toggleSort('safety')}
                    />
                  </th>
                  <th className="text-ink-muted px-4 py-4 font-semibold">Top 10</th>
                  <th className="text-ink-muted px-4 py-4 font-semibold">
                    <SortBtn
                      label={range === '1d' ? '24h' : range.toUpperCase()}
                      active={sortKey === 'momentum'}
                      dir={sortDir}
                      onClick={() => toggleSort('momentum')}
                    />
                  </th>
                  <th className="text-ink-muted px-4 py-4 font-semibold">Price</th>
                  <th className="text-ink-muted px-4 py-4 font-semibold">
                    <SortBtn
                      label="Liq"
                      active={sortKey === 'liquidity'}
                      dir={sortDir}
                      onClick={() => toggleSort('liquidity')}
                    />
                  </th>
                  <th className="text-ink-muted px-4 py-4 font-semibold">
                    <SortBtn
                      label="Vol"
                      active={sortKey === 'volume'}
                      dir={sortDir}
                      onClick={() => toggleSort('volume')}
                    />
                  </th>
                  <th className="text-ink-muted px-5 py-4 text-right font-semibold">Routes</th>
                </tr>
              </thead>
              <tbody className="divide-line/40 divide-y">
                {loading && !data?.items?.length ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-20 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                        <div className="from-accent/20 h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--line)/0.35)]">
                          <div
                            className="h-full w-1/3 animate-shimmer rounded-full bg-gradient-to-r from-transparent via-accent to-transparent bg-[length:200%_100%]"
                          />
                        </div>
                        <p className="text-ink-muted text-sm">Pulling listings and security profiles…</p>
                      </div>
                    </td>
                  </tr>
                ) : sorted.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-20 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                        <div className="bg-surface-elevated text-ink-faint flex h-12 w-12 items-center justify-center rounded-full ring-1 ring-line">
                           <IconSearch className="h-6 w-6 opacity-40" />
                        </div>
                        <div>
                          <p className="text-ink font-semibold">No tokens match your filters</p>
                          <p className="text-ink-muted mt-1 text-sm">
                            {data && data.items.length > 0 
                              ? `All ${data.items.length} tokens are currently hidden by your safety, liquidity, or volume settings.`
                              : "Try changing your watchlist mode to 'All risks'."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="mt-2 text-sm font-semibold text-accent hover:text-accent-dim transition"
                        >
                          Reset all filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sorted.map((row, i) => (
                    <Row
                      key={row.address}
                      row={row}
                      copied={copied}
                      onCopy={copy}
                      onOpen={() => void openDrawer(row)}
                      style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="border-line/50 mt-14 border-t pt-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:justify-between">
            <div className="max-w-lg">
              <p className="font-display text-ink text-sm font-semibold">Built for Birdeye Data Sprint 4</p>
              <p className="text-ink-muted mt-2 text-sm leading-relaxed">
                Tag{' '}
                <a
                  href="https://twitter.com/birdeye_data"
                  className="text-accent hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  @birdeye_data
                </a>{' '}
                and use <span className="font-mono text-xs text-ink">#BirdeyeAPI</span> when you ship.
                Submit via Superteam Earn before May 16.
              </p>
            </div>
            <div className="text-ink-muted font-mono text-2xs space-y-1.5 leading-relaxed">
              <p>
                <span className="text-ink-faint">GET</span> /defi/v2/tokens/new_listing
              </p>
              <p>
                <span className="text-ink-faint">GET</span> /defi/token_security
              </p>
              <p>
                <span className="text-ink-faint">GET</span> /defi/token_overview
              </p>
              <p className="text-ink-faint pt-2 font-sans text-xs">
                Heuristic scores only — not investment advice. Verify on-chain.
              </p>
            </div>
          </div>
        </footer>
      </main>

      <TokenDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        row={drawerRow}
        loading={drawerLoading}
        error={drawerError}
        data={drawerData}
      />
    </div>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="panel-glass rounded-2xl px-4 py-4">
      <p className="text-ink-faint text-2xs font-semibold uppercase tracking-wider">{label}</p>
      <p className="font-display text-ink mt-1 text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-ink-muted mt-0.5 text-xs">{hint}</p>
    </div>
  )
}

function FilterNumber({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  step: number
}) {
  return (
    <label className="rounded-xl bg-[rgb(var(--surface-elevated)/0.75)] p-3 ring-1 ring-[rgb(var(--line)/0.5)] dark:bg-black/25">
      <div className="flex items-center justify-between gap-3">
        <span className="text-ink-faint text-2xs font-semibold uppercase tracking-wider">
          {label}
        </span>
        <span className="text-ink font-mono text-xs tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-[rgb(var(--accent))] mt-2 w-full"
      />
    </label>
  )
}

function SortBtn({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold transition',
        active ? 'text-accent' : 'text-ink-muted hover:text-ink',
      )}
    >
      {label}
      <span className="text-[10px] opacity-70" aria-hidden>
        {active ? (dir === 'desc' ? '↓' : '↑') : '·'}
      </span>
    </button>
  )
}

function Row({
  row,
  copied,
  onCopy,
  onOpen,
  style,
}: {
  row: RadarRow
  copied: string | null
  onCopy: (a: string) => void
  onOpen: () => void
  style?: CSSProperties
}) {
  const mom = row.momentumPercent ?? row.priceChange24hPercent
  const momClass =
    mom == null
      ? 'text-ink-muted'
      : mom > 0
        ? 'text-emerald-500 dark:text-emerald-400'
        : mom < 0
          ? 'text-red-500 dark:text-red-400'
          : 'text-ink-muted'

  return (
    <tr
      style={style}
      className="animate-fade-in hover:bg-[rgb(var(--accent)/0.04)] group cursor-pointer transition-colors"
      onClick={onOpen}
    >
      <td className="px-5 py-4">
        <div className="flex items-start gap-3.5">
          {row.logoURI ? (
            <img
              src={row.logoURI}
              alt=""
              className="ring-line mt-0.5 h-11 w-11 shrink-0 rounded-2xl bg-slate-200 object-cover ring-1 dark:bg-slate-800"
            />
          ) : (
            <div className="font-display bg-accent/15 text-accent ring-accent/20 mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xs font-bold ring-1">
              {(row.symbol?.slice(0, 2) || '•').toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-display text-ink truncate text-[15px] font-semibold tracking-tight">
              {row.name}
            </div>
            <div className="text-ink-muted mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
              <span className="font-mono">{row.symbol}</span>
              <span className="text-ink-faint">·</span>
              <span className="capitalize">{row.source}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="font-mono text-2xs text-ink-faint bg-surface-deep/80 rounded-md px-1.5 py-0.5 dark:bg-black/40">
                {row.address.slice(0, 4)}…{row.address.slice(-4)}
              </code>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onCopy(row.address)
                }}
                className="text-accent hover:text-accent-dim text-2xs font-semibold uppercase tracking-wide transition"
              >
                {copied === row.address ? 'Copied' : 'Copy'}
              </button>
            </div>
            {row.safety.risks.length > 0 && (
              <ul className="text-ink-muted mt-2 max-w-[280px] space-y-0.5 text-2xs leading-snug">
                {row.safety.risks.slice(0, 2).map((r) => (
                  <li key={r} className="flex gap-1.5">
                    <span className="text-ink-faint shrink-0">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </td>
      <td className="text-ink-muted px-4 py-4 align-top whitespace-nowrap">
        <div className="font-mono text-sm text-ink">{row.listingAgeLabel}</div>
        <div className="text-ink-faint mt-0.5 font-mono text-2xs">
          {row.liquidityAddedAt ? new Date(row.liquidityAddedAt).toLocaleString() : '—'}
        </div>
      </td>
      <td className="px-4 py-4 align-top">
        <span
          className={cn(
            'font-display inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ring-1',
            riskBadgeClasses(row.safety.level),
          )}
        >
          {row.safety.level === 'green'
            ? 'Safe'
            : row.safety.level === 'yellow'
              ? 'Medium'
              : row.safety.level === 'red'
                ? 'High'
                : 'N/A'}
          <span className="text-ink-faint ml-1.5 font-mono text-2xs font-normal">{row.safety.score}</span>
        </span>
      </td>
      <td className="text-ink px-4 py-4 align-top font-mono text-sm tabular-nums">
        {formatTop10(row.safety.top10HolderPercent)}
      </td>
      <td className={cn('px-4 py-4 align-top font-mono text-sm tabular-nums', momClass)}>
        {formatPct(mom)}
      </td>
      <td className="text-ink px-4 py-4 align-top font-mono text-sm tabular-nums">
        {formatPrice(row.price)}
      </td>
      <td className="text-ink px-4 py-4 align-top font-mono text-xs tabular-nums">
        {formatUsd(row.liquidity ?? row.listingLiquidityUsd)}
      </td>
      <td className="text-ink px-4 py-4 align-top font-mono text-xs tabular-nums">
        {formatUsd(row.volume24hUsd)}
      </td>
      <td className="px-5 py-4 align-top text-right">
        <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:justify-end sm:gap-2">
          <a
            href={jupiterUrl(row.address)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-deep/80 text-accent ring-line hover:bg-accent/10 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide ring-1 transition dark:bg-black/35"
          >
            Jupiter
            <IconExternal className="h-3 w-3 opacity-60" />
          </a>
          <a
            href={raydiumUrl(row.address)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-deep/80 text-ink-muted ring-line hover:text-accent inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide ring-1 transition dark:bg-black/35"
          >
            Raydium
            <IconExternal className="h-3 w-3 opacity-60" />
          </a>
        </div>
      </td>
    </tr>
  )
}

function TokenDrawer({
  open,
  onClose,
  row,
  loading,
  error,
  data,
}: {
  open: boolean
  onClose: () => void
  row: RadarRow | null
  loading: boolean
  error: string | null
  data: TokenDetailsResponse | null
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close details"
      />

      <aside className="panel-glass absolute inset-y-0 left-0 w-full max-w-[720px] overflow-y-auto rounded-r-3xl p-5 shadow-card-lg sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-ink-faint text-2xs font-semibold uppercase tracking-wider">
              Token details
            </p>
            <h2 className="font-display text-ink mt-1 truncate text-2xl font-semibold tracking-tight">
              {row?.name ?? data?.name ?? '—'}{' '}
              <span className="text-ink-muted font-mono text-sm">
                {row?.symbol ?? data?.symbol ?? ''}
              </span>
            </h2>
            <p className="text-ink-muted mt-2 font-mono text-xs">
              {row?.address ?? data?.address ?? ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ring-line hover:bg-surface-elevated text-ink-muted hover:text-ink inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1 transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-[rgb(var(--surface-elevated)/0.75)] p-4 ring-1 ring-[rgb(var(--line)/0.5)] dark:bg-black/25">
            <p className="text-ink-faint text-2xs font-semibold uppercase tracking-wider">
              Safety
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={cn(
                  'font-display inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ring-1',
                  riskBadgeClasses(row?.safety.level ?? data?.safety.level ?? 'unknown'),
                )}
              >
                {(row?.safety.level ?? data?.safety.level) || 'unknown'}
                <span className="text-ink-faint ml-1.5 font-mono text-2xs font-normal">
                  {row?.safety.score ?? data?.safety.score ?? '—'}
                </span>
              </span>
            </div>
            <ul className="text-ink-muted mt-3 space-y-1 text-xs">
              {(data?.safety.risks ?? row?.safety.risks ?? []).slice(0, 8).map((r) => (
                <li key={r} className="flex gap-2">
                  <span className="text-ink-faint">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-[rgb(var(--surface-elevated)/0.75)] p-4 ring-1 ring-[rgb(var(--line)/0.5)] dark:bg-black/25">
            <p className="text-ink-faint text-2xs font-semibold uppercase tracking-wider">
              Momentum
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MetricPill label="1D" value={formatPct(data?.changes.d1 ?? row?.priceChange24hPercent)} />
              <MetricPill label="7D" value={formatPct(data?.changes.d7 ?? null)} />
              <MetricPill label="30D" value={formatPct(data?.changes.d30 ?? null)} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Metric label="Price" value={formatPrice(data?.price ?? row?.price)} />
              <Metric label="Top10" value={formatTop10((row?.safety.top10HolderPercent ?? data?.top10HolderPercent) ?? null)} />
              <Metric label="Liquidity" value={formatUsd(data?.liquidity ?? row?.liquidity ?? row?.listingLiquidityUsd)} />
              <Metric label="Vol 24h" value={formatUsd(data?.volume24hUsd ?? row?.volume24hUsd)} />
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {row?.address && (
            <>
              <a
                href={jupiterUrl(row.address)}
                target="_blank"
                rel="noreferrer"
                className="bg-surface-deep/80 text-accent ring-line hover:bg-accent/10 inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide ring-1 transition dark:bg-black/35"
              >
                Open in Jupiter <IconExternal className="h-3.5 w-3.5 opacity-60" />
              </a>
              <a
                href={raydiumUrl(row.address)}
                target="_blank"
                rel="noreferrer"
                className="bg-surface-deep/80 text-ink-muted ring-line hover:text-accent inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide ring-1 transition dark:bg-black/35"
              >
                Open in Raydium <IconExternal className="h-3.5 w-3.5 opacity-60" />
              </a>
            </>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-[rgb(var(--line)/0.55)] bg-[rgb(var(--surface)/0.35)] p-4 text-sm text-ink-muted dark:bg-black/20">
          {loading ? 'Loading token details…' : error ? error : ' '}
        </div>
      </aside>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[rgb(var(--surface-deep)/0.65)] px-3 py-2 ring-1 ring-[rgb(var(--line)/0.4)] dark:bg-black/25">
      <p className="text-ink-faint text-2xs font-semibold uppercase tracking-wider">{label}</p>
      <p className="text-ink mt-0.5 font-mono text-xs">{value}</p>
    </div>
  )
}

function MetricPill({ label, value }: { label: string; value: string }) {
  const isNeg = value.startsWith('-')
  const isPos = value.startsWith('+')
  return (
    <div
      className={cn(
        'rounded-xl px-3 py-2 ring-1 ring-[rgb(var(--line)/0.4)]',
        isPos && 'bg-emerald-500/10 text-emerald-500',
        isNeg && 'bg-red-500/10 text-red-500',
        !isPos && !isNeg && 'bg-[rgb(var(--surface-deep)/0.65)] text-ink-muted dark:bg-black/25',
      )}
    >
      <p className="text-2xs font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-0.5 font-mono text-xs tabular-nums">{value}</p>
    </div>
  )
}
