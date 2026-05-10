# Bird Eye — New token radar & safety feed

Early-stage dashboard for the **Birdeye Data Sprint 4** (May 9–16, 2026): discover fresh Solana listings, layer on `token_security` + `token_overview`, and focus the table on tokens that look less reckless on first pass.

## What it uses (Birdeye)

| Endpoint | Role |
|----------|------|
| `GET /defi/v2/tokens/new_listing` | Latest listings (includes `liquidityAddedAt`, symbol, liquidity, source) |
| `GET /defi/token_security` | Holder concentration, metadata mutability, Jupiter strict list, freeze / fee hints |
| `GET /defi/token_overview` | Price, `priceChange24hPercent`, liquidity, `v24hUSD`, holders |

> **Plan note:** In the public docs, **new listing** is marked **Standard** tier. Lite/free keys may return `403` on `new_listing`; security + overview are **Lite**-eligible. Use a key with Standard (or trial) access for the full radar.

The API server counts outbound Birdeye calls (`GET /api/stats`) so you can verify **50+ calls** during development.

## Quick start

**Requirements:** Node 20+

```bash
cd bird-eye
cp .env.example .env
# Add BIRDEYE_API_KEY=... from https://bds.birdeye.so

npm install
npm run dev
```

- **UI:** http://localhost:5173 (Vite proxies `/api` → Express)
- **API:** http://localhost:8787  
  - `GET /api/radar?filter=safe` — default watchlist (green + yellow only)  
  - `GET /api/radar?filter=all` — include high risk  
  - `GET /api/radar?refresh=1` — bypass the 5‑minute server cache  
  - `GET /api/stats` — total Birdeye calls and last error

## Deploy

**Frontend (e.g. Vercel / Netlify)**  
Set project root to `client`, build command `npm run build`, output `dist`. Set **`VITE_API_BASE_URL`** to your public API origin (no trailing slash).

**Backend (e.g. Railway, Render, Fly)**  
Run `npm run start -w server` (or `node server/src/index.js` from `server` after install). Set **`BIRDEYE_API_KEY`**, optional **`CORS_ORIGIN`** to your frontend URL, and **`PORT`** if the host requires it.

### GitHub Actions Secrets
If you are using GitHub Actions for deployment, you should add your Birdeye API key as a secret:
1. Go to your repository on GitHub.
2. Navigate to **Settings** > **Secrets and variables** > **Actions**.
3. Click **New repository secret**.
4. Name: `BIRDEYE_API_KEY`
5. Value: (Your Birdeye API key)

## Product behavior

- **Safety score (0–100)** combines top‑10 concentration, creator balance share, mutability, freeze / transfer‑fee flags, and a small bonus if `jupStrictList` is true. **Green / yellow / red** are thresholds on that score—not a guarantee.
- **Server cache & limits:** Responses are cached **15 minutes** by default; outbound calls are **paced** (~450 ms apart) with **429 retries**. Only the **latest N listings** are enriched (`RADAR_TOKEN_LIMIT`, default 10) to reduce burst traffic. On rate limit failure, the API may return **stale cached data** with a warning instead of an empty error.
- **Default filter:** “Safe + medium” maps to server-side filtering of red/unknown rows.

## Bonus ideas

- Telegram / Discord webhook when a new **green** token appears (compare `address` set between polls).
- WebSocket `token_new_listing` for true real-time (docs “websocket” extras).

## License

MIT — built for the Birdeye Data Sprint demo track.
# bird-eye-solona
# bird-eye-solona
