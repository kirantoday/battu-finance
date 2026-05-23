# BATTU — Finance Screen · CLAUDE.md

> Read this file at the start of every Claude Code session before touching any code.

---

## Project Identity

| Key | Value |
|---|---|
| Product | BATTU — Finance Screen |
| Company | Regapps Inc. |
| Tagline | Institutional-grade market intelligence. Not $27,000. |
| Repo | `battu-finance` |
| Live URL | battu.finance (target) |
| Primary target | Equity analysts at hedge funds <$500M AUM |
| Secondary | Independent analysts, SFO investment teams, sell-side research desks |
| Related product | 13F Copilot (13fcopilot.com) — shares Supabase instance |
| Bloomberg parity | 23 of 26 commands at ≥85% parity · 2 commands beat BBG · 3 not buildable |

---

## Repository Structure

```
battu-finance/
  apps/
    web/          # React + Vite + TypeScript frontend
    api/          # Hono backend (Node.js/TypeScript) — Railway
  packages/
    db/           # Drizzle schema — battu schema only
    shared/       # Types, constants, tool definitions
    edgar/        # SEC EDGAR fetcher + Claude LIQ extractor
    data/         # Polygon, FMP, Benzinga API clients
  CLAUDE.md
  .env.local      # Never commit
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Charts | Lightweight Charts (TradingView open source) |
| Styling | Tailwind CSS — dark terminal theme only |
| Backend | Hono (Node.js/TypeScript) — Railway |
| Database | Supabase PostgreSQL — `battu` schema (shared with 13F Copilot) |
| ORM | Drizzle ORM |
| Auth | Supabase Auth + JWT |
| Cache | Upstash Redis — 15-min price TTL |
| Payments | Stripe |
| AI | Claude API (Haiku → SIMPLE, Sonnet → PLANNED/AGENT/LIQ) |
| Live data | Polygon.io WebSocket |
| Package mgr | pnpm workspaces |

---

## Environment Variables

```bash
# Shared with 13F Copilot — same values
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
DATABASE_URL=           # port 6543 transaction pooler — REQUIRED

# BATTU-specific
POLYGON_API_KEY=        # Polygon.io Starter $79/mo
FMP_API_KEY=            # Financial Modeling Prep Professional $49/mo
BENZINGA_API_KEY=       # Benzinga Pro API $99/mo
ANTHROPIC_API_KEY=      # Claude API
UPSTASH_REDIS_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

---

## Database — battu Schema

**CRITICAL:** Use `battu` schema. Never touch `public` schema (13F Copilot).
Same Supabase instance. Same `DATABASE_URL`. Zero extra cost.

```
battu.users               id, email, tier, org_id, stripe_customer_id, created_at
battu.organizations       id, name, domain, seat_count, stripe_subscription_id
battu.watchlists          id, user_id, name, tickers text[]
battu.portfolios          id, user_id, positions jsonb
battu.saved_screens       id, user_id, command text, params jsonb, pinned bool
battu.alerts              id, user_id, ticker text, condition text, threshold numeric, active bool
battu.liq_cache           ticker PK, computed_at, data jsonb, source_filings jsonb
battu.query_history       id, user_id, query, tier, tokens_used, created_at
```

13F data: read-only from `public.holdings` and `public.filers`. Never write to `public`.

---

## Keyboard UX — No Bloomberg Keyboard Needed

BATTU runs in any browser. Zero hardware required.

| Bloomberg Key | Action | BATTU Equivalent |
|---|---|---|
| Green GO | Execute command | **Enter** |
| Red CANCEL | Go back | **Escape** |
| Yellow EQUITY | Asset class select | Not needed (equity-only) |
| MENU | Screen menu | **Ctrl+K** — command palette |
| PAGE FWD/BACK | Navigate panels | **Tab / Shift+Tab** |
| ↑ ↓ arrows | Command history | **↑ ↓** in command bar |
| HELP HELP | Get help | **?** or **/help** |

### Sticky Active Ticker (CRITICAL UX)

Once a ticker is set, all subsequent commands apply to it without retyping:

```
> DES AAPL     ← active ticker = AAPL
> GP           ← shows AAPL chart (no ticker needed)
> FA           ← shows AAPL financials
> EE           ← shows AAPL estimates
> LIQ          ← shows AAPL cash runway
> DES MSFT     ← switches context to MSFT
> GP 1Y        ← shows MSFT 1-year chart
```

Active ticker stored in Zustand global state. Displayed in top-right of terminal header.

### Command Bar Behaviour
- Monospace font, amber blinking cursor
- Up/down arrow = command history (last 50, stored localStorage)
- Tab = autocomplete ticker from active watchlist
- Ctrl+K = command palette (all 26 commands with descriptions)
- Commands are UPPERCASE, params are lowercase

---

## Full Command Reference — 26 Commands

### P0 — Must ship for D. Boral demo (Week 6)

#### DES {ticker} — Security Description
**BBG parity: ~95%**
- Source: FMP profile + Polygon snapshot + SEC EDGAR
- Shows: company name, exchange, sector, market cap, shares outstanding, float, current price, bid/ask, day range, 52w high/low, P/E, EPS TTM, dividend yield, beta, avg volume, next earnings date, CEO, employees, description, CIK + SEC links
- Gap: Bloomberg shows real-time exchange-direct bid/ask. BATTU shows SIP-consolidated (negligible for research)
- BATTU advantage: inline 13F ownership summary, direct SECF links

#### GP {ticker} {timeframe} — Price Chart
**BBG parity: ~95%**
- Source: Polygon REST (history) + WebSocket (live)
- Timeframes: 1D / 1W / 1M / 3M / 1Y / 5Y
- Shows: candlestick (OHLC), volume bars, SMA, EMA, RSI, MACD, Bollinger Bands, VWAP (intraday), peer overlay
- Gap: Bloomberg GP has drawing/annotation tools — add post-launch

#### GIP {ticker} — Intraday Graph
**BBG parity: ~90%**
- Source: Polygon WebSocket + 1/5/15/30/60-min aggs
- Shows: real-time streaming price, pre-market + after-hours, VWAP, volume profile
- Note: Free tier users get 15-min delayed. Real-time requires paid BATTU tier.

#### HP {ticker} — Historical Price Table
**BBG parity: 100%**
- Source: Polygon REST /v2/aggs
- Shows: daily OHLCV 20+ years, split/dividend-adjusted prices, CSV export

#### QR {ticker} — Quote Recap
**BBG parity: ~90%**
- Source: Polygon Snapshot API
- Shows: last, bid, ask, open, high, low, close, VWAP, volume, change%, 52w range, pre/post market
- Gap: Bloomberg QR shows L2 order book depth. Polygon Starter doesn't. Not needed for research.

#### FA {ticker} — Financial Analysis
**BBG parity: ~95%**
- Source: FMP Financials API
- Shows: income statement, balance sheet, cash flow — 10yr annual + quarterly, YoY growth, key ratios (margins, ROE, ROA, ROIC)
- Gap: Bloomberg pulls segment/geographic revenue from filing footnotes. FMP has limited segment data.

#### NI {ticker} — Company News
**BBG parity: ~90%**
- Source: Benzinga API filtered by ticker
- Shows: breaking news, earnings releases (real numbers), analyst rating changes, M&A, 8-K alerts, press releases — color-coded by type
- BATTU advantage: Benzinga often faster than Bloomberg on earnings number drops

#### LIQ {ticker} — Cash Runway + Shelf Life  ⭐ BATTU EXCLUSIVE
**BBG parity: N/A — Bloomberg has no equivalent screen**
- Source: FMP (cash/burn) + SEC EDGAR (S-3, 424B, 10-K) + Claude Sonnet (extraction)
- Shows: cash & equivalents, short-term investments, undrawn credit facility + expiry, shelf registration total, 424B ATM drawdowns YTD, remaining shelf, quarterly cash burn, cash runway in quarters, total liquidity, source filing links
- This is your #1 differentiator. No competitor has it. See full spec below.

#### WL — Live Watchlist
**Source:** Polygon WebSocket
- Shows: ticker, price, change%, volume, green/red tick flash on every trade
- Persisted to battu.watchlists

---

### P1 — Growth screens (Weeks 8–10)

#### GPC {t1} {t2} ... — Peer Comparison Chart
**BBG parity: ~90%**
- Source: Polygon (prices) — up to 6 tickers, rebased to 100

#### RV {ticker} — Relative Valuation
**BBG parity: ~90%**
- Source: FMP Ratios + Peers
- Shows: P/E NTM/LTM, EV/EBITDA, P/Sales, P/Book, PEG, sector median, 5yr avg vs peers
- Gap: Bloomberg lets you customize exact peer basket easily. BATTU starts with FMP auto-peers + user can manually edit.

#### OWN {ticker} — Institutional Ownership  ⭐ WE BEAT BLOOMBERG
**Source:** 13F Copilot pipeline
- Shows: top 20 holders, shares, % of float, QoQ change, new/exited flags
- BATTU advantages: exit ratio scoring, M&A reclassification, corrected CIK mapping, cross-fund analysis, AI /ask queries over 13F data

#### EQS — Equity Screener
**BBG parity: ~85%**
- Source: FMP Screener API
- Filters: market cap, sector, country, P/E, P/B, EV/EBITDA, revenue growth, EPS growth, dividend yield
- Gap: Bloomberg has 5,000+ screening fields. FMP has ~50. Sufficient for 90% of use cases.

#### EE {ticker} — Earnings Estimates
**BBG parity: ~85%**
- Source: FMP Financial Estimates API
- Shows: consensus EPS (NTM, current qtr, next qtr), revenue estimate, high/low/mean, analyst count, revision history, surprise history
- Gap: Bloomberg shows individual named analyst estimates. FMP shows consensus only. 2-6hr lag vs Bloomberg minutes.

#### ANR {ticker} — Analyst Recommendations
**BBG parity: ~85%**
- Source: FMP Grades API + Price Target API
- Shows: rating + prior rating, price target + prior, grading firm, change date, consensus summary, history
- Gap: Bloomberg shows individual analyst names. FMP shows firm name only.

#### EVTS / ERN — Earnings Calendar
**BBG parity: ~90%**
- Source: FMP Earnings Calendar
- Shows: upcoming earnings dates, consensus EPS estimate, prior actuals

#### MOST — Market Movers
**BBG parity: ~95%**
- Source: Polygon /v2/snapshot movers
- Shows: top gainers, losers, most active — pre-market + regular hours

#### SECF {ticker} — SEC Filings
**BBG parity: 100%**
- Source: SEC EDGAR (free, same data Bloomberg uses)
- Shows: 10-K, 10-Q, 8-K, 13F, DEF 14A, S-3, 424B, Form 4

#### DVD {ticker} — Dividend History
**BBG parity: 100%**
- Source: FMP Dividends API

#### COMP {ticker} — Comparable Companies
**BBG parity: ~85%**
- Source: FMP Peers API

#### SCTR — Sector Analysis
**BBG parity: ~85%**
- Source: FMP Sector Performance

#### W — World Market Monitor
**BBG parity: ~85%**
- Source: Polygon (equities/futures) + FMP (FX/macro)
- Shows: major indices, futures, FX rates, commodities

#### /ask {natural language} — AI Query
**Source:** Claude API + all data tools (3-tier routing)
- Routes: SIMPLE (Haiku, <2s) → PLANNED (Sonnet, 5-8s) → AGENT (Sonnet + tool loop, 15-30s)
- Has no Bloomberg equivalent. This is a BATTU-native feature.

---

### P2 — Post-launch

#### ECO — Economic Calendar
**BBG parity: ~90%**
- Source: FRED API (free) — all major US macro releases
- Gap: Bloomberg covers global (ECB, BOJ) in real-time. Add World Bank/IMF APIs for global coverage.

#### HDS {ticker} — Historical Description
**BBG parity: ~70%** (partial)
- Source: FMP (current) + SEC archived 10-K filings via EDGAR
- Gap: Bloomberg has curated editorial database of historical descriptions. BATTU shows archived 10-K filings — functional workaround.

#### SPLC {ticker} — Supply Chain
**BBG parity: ~40%** (partial)
- Source: SEC 10-K filings + Claude Sonnet extraction
- Shows: customers >10% revenue (SEC-mandated disclosure), supplier names if disclosed, competitor list
- Gap: Bloomberg SPLC is a 12-year proprietary database of 200,000 relationships. We can only show SEC-disclosed data. Known limitation.

#### PORT — Portfolio Analytics
**BBG parity: ~70%** (partial)
- Source: Internal (user-entered positions)
- Shows: P&L, sector exposure, beta-weighted exposure, benchmark comparison
- Gap: No Barra-style factor model. No prime broker feed integration. Add post-launch.

---

### Not Building (Never)

| Command | Reason |
|---|---|
| AX (Dealer Axes) | Bloomberg proprietary dealer network feed. No API. Not relevant to our target users (research analysts). |
| MSG / IB (Bloomberg Messaging) | 325,000-user network built over 40 years. Impossible to replicate. Use Slack. |
| BRC (Broker Research) | Licensed sell-side PDFs. Goldman/MS charge $500k-$5M/yr. No API exists. |
| BI (Bloomberg Intelligence) | 350 in-house analysts writing proprietary research. Pure editorial content. |

---

## LIQ Screen — Full Implementation Spec

**The #1 differentiating screen. No competitor has it. Build before D. Boral demo.**

### Data flow
```
1. Check battu.liq_cache
   → If computed_at < 90 days: return cached immediately

2. FMP structured fields (fast, no AI needed):
   cash_and_equivalents
   short_term_investments
   quarterly_operating_cash_flow (from CFO)
   quarterly_capex
   quarterly_burn = abs(CFO) + abs(capex)

3. EDGAR: find latest S-3 for ticker
   CIK resolution: reuse 13F Copilot filer audit logic
   Endpoint: https://efts.sec.gov/LATEST/search-index?q={ticker}&forms=S-3

4. Claude Sonnet: extract from S-3 prose
   → shelf_registration_total (dollar amount)
   → atm_program_details

5. EDGAR: fetch all 424B3/424B5 since S-3 filing date
   → Sum aggregate offering amounts = total_drawdowns

6. EDGAR: fetch latest 10-K
   Claude Sonnet: extract from Notes to Financial Statements
   → credit_facility_total
   → credit_facility_drawn
   → credit_facility_expiry

7. Compute:
   remaining_shelf  = shelf_total - total_drawdowns
   undrawn_credit   = credit_total - credit_drawn
   total_liquidity  = cash + investments + undrawn_credit + remaining_shelf
   cash_runway_qtrs = (cash + investments) / quarterly_burn

8. Store in battu.liq_cache with source_filings jsonb
9. Return to client
```

### Output format
```
BATTU> LIQ BIIB

═══════════════════════════════════════════════════
  LIQ  BIOGEN INC  (BIIB US)         as of Q1 2025
═══════════════════════════════════════════════════
  Cash & Equivalents        $1.243B
  Short-term Investments    $2.871B
  Undrawn Credit Facility   $1.000B   (expires Jun 2027)
  ───────────────────────────────────────────────
  TOTAL LIQUIDITY           $5.114B

  Shelf Registration        $3.000B   (S-3 filed Apr 2024)
  424B Drawdowns YTD        $450M     (3 transactions)
  REMAINING SHELF           $2.550B

  Quarterly Cash Burn       $312M     (CFO + capex)
  CASH RUNWAY               13.2 qtrs  =  3.3 years
═══════════════════════════════════════════════════
  Sources: 10-Q Feb 2025  |  S-3 Apr 2024  |  3x 424B5
```

### LIQ Rules
- Always show source filing links — analyst must click and verify
- Amber `⚠ DATA MAY BE STALE` if computed_at > 90 days
- If no S-3 found: "No shelf registration on file"
- If credit facility not in 10-K: "Credit facility not found"
- Cache aggressively — Claude extraction takes 5-10s

---

## AI Query Architecture

```
Classify query → Haiku (~$0.0001)
  ↓
SIMPLE   → Haiku — single fact, 1-2s
PLANNED  → Sonnet — multi-step, 5-8s
AGENT    → Sonnet + tool loop — open-ended, 15-30s
```

### Tool definitions — packages/shared/tools.ts
```typescript
get_price             // Polygon — price, change%, volume, bid/ask
get_ohlcv             // Polygon — historical OHLCV
get_fundamentals      // FMP — P/E, EV/EBITDA, market cap, margins
get_financials        // FMP — full IS/BS/CF
get_peers             // FMP — peer tickers
get_news              // Benzinga — news by ticker
get_13f_ownership     // 13F Copilot DB — holders, QoQ change
get_13f_activity      // 13F Copilot DB — who bought/sold by quarter
get_liq               // LIQ cache + EDGAR
screen_equities       // FMP screener
get_macro             // FRED — economic series
get_earnings_calendar // FMP — upcoming earnings
```

---

## API Endpoints

### Polygon — packages/data/polygon.ts
```
WebSocket:  wss://socket.polygon.io/stocks
REST aggs:  /v2/aggs/ticker/{ticker}/range/{mult}/{span}/{from}/{to}
Snapshot:   /v2/snapshot/locale/us/markets/stocks/tickers/{ticker}
Movers:     /v2/snapshot/locale/us/markets/stocks/{gainers|losers}
```

### FMP — packages/data/fmp.ts
```
Profile:      /profile/{ticker}
Income:       /income-statement/{ticker}?limit=10&period=annual
Balance:      /balance-sheet-statement/{ticker}?limit=10
Cash flow:    /cash-flow-statement/{ticker}?limit=10
Ratios:       /ratios/{ticker}
Peers:        /stock_peers?symbol={ticker}
Estimates:    /analyst-estimates/{ticker}
Grades:       /grade/{ticker}
Price target: /price-target-consensus?symbol={ticker}
Screener:     /stock-screener?...
Earnings cal: /earnings-calendar?from=...&to=...
```

### News Provider — packages/data/src/newsFactory.ts
BATTU uses a pluggable news provider. Switch by changing ONE env var:
```
NEWS_PROVIDER=newsapi    ← development (free, newsapi.org)
NEWS_PROVIDER=benzinga   ← production (paid, $99/mo, benzinga.com)
```
No code changes needed to switch. The factory handles everything. All routes
and screens call `newsProvider.getTickerNews(...)` etc. — they never know which
implementation is behind the interface.

### NewsAPI — packages/data/src/newsapi.ts (dev provider)
```
Base:           https://newsapi.org/v2
Auth:           X-Api-Key header
Ticker news:    /everything?q={ticker}&language=en&sortBy=publishedAt
Top headlines:  /top-headlines?category=business&language=en
Search:         /everything?q={query}&language=en&sortBy=relevancy
```
Free tier: 100 req/day, CORS blocked (backend only), ~15min delay. Category
field is derived from headline keyword detection (earnings / analyst / ma /
macro / general).

### Benzinga — packages/data/src/benzinga.ts (prod provider)
```
Base:           https://api.benzinga.com/api/v2
Auth:           token query param
Ticker news:    /news?tickers={ticker}&pageSize=20&displayOutput=full
Top headlines:  /news?pageSize=20&displayOutput=full
Search:         /news?q={query}&pageSize=20&displayOutput=full
```
Paid tier: real-time, financial-specific, native ticker tagging, earnings alerts
typically faster than the wires. Category mapped from Benzinga's `channels` field.

### To switch to Benzinga when ready
1. Get Benzinga API key ($99/mo at benzinga.com/apis)
2. In `.env.local` set: `NEWS_PROVIDER=benzinga`
3. In `.env.local` set: `BENZINGA_API_KEY=your_key`
4. Restart API server
5. Done — no code changes

### Market Data Provider — packages/data/src/marketFactory.ts
Pluggable market data — switch by changing ONE env var:
```
MARKET_PROVIDER=yahoo    ← development (free, no key needed)
MARKET_PROVIDER=massive  ← production (paid, $29/mo, massive.com)
```

### Yahoo Finance — packages/data/src/yahoo.ts (dev provider)
```
Base:        https://query1.finance.yahoo.com
Quote+bars:  /v8/finance/chart/{ticker}?interval={interval}&range={range}
Movers:      /v1/finance/screener/predefined/saved?scrIds={screen}&count=20
Auth:        none — User-Agent header REQUIRED on every request
```
Free, no key, real-time prices (slight delay). Yahoo 401s without a browser-like
User-Agent — keep that header in place for every fetch.

### Massive/Polygon — packages/data/src/massive.ts (prod provider)
```
Base:    https://api.polygon.io (api.massive.com also works)
Quote:   /v2/snapshot/locale/us/markets/stocks/tickers/{ticker}
Bars:    /v2/aggs/ticker/{ticker}/range/{mult}/{span}/{from}/{to}
Movers:  /v2/snapshot/locale/us/markets/stocks/{gainers|losers}
Auth:    Authorization: Bearer {POLYGON_API_KEY}
```
Paid — $29/mo Starter plan required for the snapshot endpoint. Polygon has no
true "most active" endpoint; the implementation falls back to gainers when
`direction='active'` is requested.

### Timeframe mapping (TIMEFRAME_MAP in @battu/shared)
```
1D  → range=1d,   interval=5m
1W  → range=5d,   interval=30m
1M  → range=1mo,  interval=1d
3M  → range=3mo,  interval=1d
6M  → range=6mo,  interval=1d
1Y  → range=1y,   interval=1d
5Y  → range=5y,   interval=1wk
10Y → range=10y,  interval=1mo
```

### To switch to Massive when ready
1. Sign up at massive.com, get Starter plan ($29/mo)
2. In `.env.local` set: `MARKET_PROVIDER=massive`
3. `POLYGON_API_KEY` is already set — no extra key needed
4. Restart API server — done, no code changes

### EDGAR — packages/edgar/
```
Submissions: https://data.sec.gov/submissions/CIK{cik10}.json
EFTS search: https://efts.sec.gov/LATEST/search-index?q={ticker}&forms=S-3,424B3,424B5,10-K,10-Q
Document:    https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/{filename}
```
Reuse CIK resolution from 13F Copilot filer audit.

---

## Key Architectural Decisions

### 1. Shared Supabase — battu schema
`DATABASE_URL` identical to 13F Copilot. Port 6543 transaction pooler required. Zero extra cost.

### 2. Sticky Active Ticker
```typescript
// Zustand store
interface TerminalState {
  activeTicker: string | null
  setActiveTicker: (ticker: string) => void
  commandHistory: string[]
  pushCommand: (cmd: string) => void
}
```
Every screen reads `activeTicker`. Every DES/GP/FA command writes it.

### 3. Command Parser — apps/web/src/lib/commandParser.ts
```typescript
parseCommand("DES AAPL")        → { screen: "DES", ticker: "AAPL" }
parseCommand("GP MSFT 1Y")      → { screen: "GP", ticker: "MSFT", tf: "1Y" }
parseCommand("GP")              → { screen: "GP", ticker: activeTicker }
parseCommand("GPC AAPL MSFT")   → { screen: "GPC", tickers: ["AAPL","MSFT"] }
parseCommand("/ask who buys X") → { screen: "ASK", query: "who buys X" }
```
Commands UPPERCASE, params lowercase, ticker UPPERCASE.

### 4. Polygon WebSocket Singleton
One WS connection per browser session. Subscribe/unsubscribe on screen change.
Price state in Zustand. Green/red flash via CSS animation on tick.

### 5. LIQ Cache
Never call EDGAR + Claude on every render. Cache in `battu.liq_cache`.
Show `Last computed: X days ago · [Refresh]` on screen.

### 6. Theme System

Three themes available. Default: `amber`. User preference saved to localStorage key `battu-theme`.

Themes: `amber` (Amber Terminal) | `ice` (Ice Blue) | `phosphor` (Green Phosphor)

ALL colors must use CSS variables — never hardcode hex values in components:

```
var(--battu-bg)           page background
var(--battu-surface)      card/panel background
var(--battu-border)       borders and dividers
var(--battu-text)         primary text
var(--battu-muted)        secondary/label text
var(--battu-accent)       brand accent (amber/blue/green)
var(--battu-positive)     gains, positive values
var(--battu-negative)     losses, negative values
var(--battu-warning)      warnings, alerts
var(--battu-cursor)       command bar cursor
var(--battu-header-bg)    top bar background
var(--battu-cmd-bg)       command bar background
var(--battu-screen-bg)    main content area
var(--battu-ticker-bg)    live ticker bar
var(--battu-label-color)  field labels
var(--battu-value-color)  field values
var(--battu-title-color)  screen titles (DES, GP, etc.)
var(--battu-glow)         phosphor glow (none for amber/ice)
```

Theme switching: `applyThemeToDom()` in `apps/web/src/store/terminal.ts`
Theme shortcut: `Ctrl+T` opens full preview modal
Theme buttons: `AMB | ICE | PHO` in top-right header
No light mode.

#### LABEL VISIBILITY RULE

- Row labels and field labels: `var(--battu-muted)` — they recede
- Data values (prices, amounts, ratios): `var(--battu-value-color)` — they stand out
- Key/headline values (price, total liquidity): `var(--battu-accent)` or color-coded
- Section headers: `var(--battu-accent)`, 9px, letter-spacing 3px, font-weight 600
- Never use the same color for both label and value on the same row

---

## Pricing Tiers

| Tier | Price | Key Limits |
|---|---|---|
| `free` | $0 | 15-min delayed, 2yr history, 3 watchlist tickers, DES/GP/FA only, no LIQ, no /ask |
| `analyst` | $99/mo | Real-time, 10yr history, all screens, LIQ, /ask 50/mo, OWN, EQS |
| `professional` | $349/seat/mo | Unlimited /ask, all P1 screens, portfolio, alerts, API 1k/day |
| `institutional` | $499/seat/mo | Multi-seat org, SSO, compliance export, SLA, dedicated support |

---

## Screen Component Structure

```
apps/web/src/screens/
  DES/index.tsx
  GP/index.tsx + Chart.tsx + Controls.tsx
  FA/index.tsx + StatementTable.tsx
  NI/index.tsx + NewsItem.tsx
  LIQ/index.tsx + LIQTable.tsx + SourceLinks.tsx
  WL/index.tsx + WatchlistRow.tsx
  QR/index.tsx
  EE/index.tsx
  ANR/index.tsx
  RV/index.tsx
  OWN/index.tsx
  EQS/index.tsx + ScreenerFilters.tsx
  GPC/index.tsx
  EVTS/index.tsx
  MOST/index.tsx
  SECF/index.tsx
  shared/
    CommandBar.tsx      # Global command input — always visible
    TickerHeader.tsx    # Active ticker + price in top bar
    CommandPalette.tsx  # Ctrl+K overlay
    LoadingSkeleton.tsx
    ErrorBoundary.tsx
```

---

## API Route Structure

```
/api/v1/
  market/price/:ticker
  market/ohlcv/:ticker
  market/movers/:direction
  fundamentals/profile/:ticker
  fundamentals/financials/:ticker
  fundamentals/ratios/:ticker
  fundamentals/peers/:ticker
  fundamentals/estimates/:ticker
  fundamentals/grades/:ticker
  fundamentals/screener (POST)
  news/:ticker
  liq/:ticker (GET — cached)
  liq/:ticker/refresh (POST — force recompute)
  ownership/:ticker
  ai/query (POST — { query: string })
  user/watchlist
  user/portfolio
  user/alerts
  billing/webhook
```

---

## Build Roadmap

| Phase | Weeks | Goal |
|---|---|---|
| 0 · Foundation | 1–2 | Monorepo, Hono, Drizzle battu schema, Supabase Auth, Polygon WS, command bar + router, dark UI shell |
| 1 · Core Screens | 3–5 | DES, GP, FA, NI, WL — full P0 workflow end-to-end |
| 2 · LIQ Screen | 6 | EDGAR fetcher, FMP cash/burn, Claude S-3+10-K extraction, liq_cache, LIQ UI |
| 3 · AI Layer | 7 | 3-tier router, all tools, /ask command, streaming |
| 4 · Growth Screens | 8–9 | OWN, GPC, RV, EQS, EE, ANR, EVTS, MOST, SECF |
| 5 · Auth + Billing | 10 | Stripe, tiers, seat management, SSO |
| 6 · Launch | 11–12 | ECO, mobile, onboarding, waitlist → beta, Product Hunt |

**D. Boral demo target: End of Week 6 — show DES + GP + FA + LIQ for a biotech ticker.**

---

## Claude Code Session Guidelines

- Read CLAUDE.md before every session
- Use `--dangerously-skip-permissions` for unattended builds
- One screen per session where possible
- Commit after each working screen: `feat: {COMMAND} screen working`
- Never hardcode API keys
- Every screen needs: loading skeleton + error boundary + empty state
- All monetary values: format as $X.XB (billions) or $XXXm (millions)
- Timestamps: "X days ago" with hover for exact date
- Mobile: responsive but desktop-first
- Commands UPPERCASE, params lowercase

---

## Current Build Status

| Screen | Status |
|---|---|
| DES | ⬜ Not started |
| GP | ⬜ Not started |
| FA | ⬜ Not started |
| NI | ⬜ Not started |
| LIQ | ⬜ Not started — P0 priority |
| WL | ⬜ Not started |
| QR | ⬜ Not started |
| Auth + Billing | ⬜ Not started — Week 10 |
| All P1 screens | ⬜ Not started — Weeks 8-9 |

---
## Data Validation Suite

Location: packages/validation/
Run before every demo: pnpm validate
Run to generate report: pnpm validate:report
Seed ground truth: pnpm seed:groundtruth
Target: 90%+ pass rate before any client demo

Tolerance bands:
  price:     1%   (prices drift — expected)
  financial: 0.5% (exact from filings)
  ratio:     3%   (methodology differences)
  estimate:  5%   (consensus aggregation)
  liq:       5%   (Claude extraction variance)

If a screen returns MISSING_ENDPOINT — the API route
doesn't exist yet. Build the screen first, then re-run.
---

*Regapps Inc. · BATTU Finance Screen · Confidential · May 2026*