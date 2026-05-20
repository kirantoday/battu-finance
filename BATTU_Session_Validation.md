# BATTU — Claude Code Session: Data Validation Test Suite

## Paste this entire prompt into Claude Code

---

Read CLAUDE.md before doing anything.

We are building the BATTU Finance Screen data validation test suite.
The goal is to verify that BATTU's data from Polygon + FMP + Benzinga + EDGAR
matches real-world financial data, so we can be confident before showing
the product to institutional clients.

This session builds THREE things:

1. A ground truth seed file with hand-verifiable data for 12 tickers
2. A validation runner that hits live BATTU APIs and compares against ground truth
3. An HTML report that shows pass/fail for every field with % deviation

---

## Context

- Stack: Node.js / TypeScript / Hono backend / pnpm workspaces
- APIs available: Polygon.io (POLYGON_API_KEY), FMP (FMP_API_KEY), Benzinga (BENZINGA_API_KEY)
- All env vars in .env.local
- This validation suite lives at: packages/validation/

---

## Step 1 — Create packages/validation/package.json

```json
{
  "name": "@battu/validation",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "validate": "tsx src/runner.ts",
    "report": "tsx src/runner.ts --report",
    "seed": "tsx src/seedFetcher.ts"
  },
  "dependencies": {
    "tsx": "^4.0.0",
    "chalk": "^5.0.0",
    "dotenv": "^16.0.0"
  }
}
```

---

## Step 2 — Create packages/validation/src/groundTruth.ts

This file contains hand-verifiable ground truth data.
Every value here can be independently checked against:
- Yahoo Finance (finance.yahoo.com)
- Macrotrends (macrotrends.net)
- SEC EDGAR directly (sec.gov)
- Koyfin free tier (koyfin.com)

Use the following 12 tickers — chosen to cover different sectors,
sizes, and edge cases that matter for BATTU users:

AAPL  — mega cap tech (most-watched, best to validate)
MSFT  — mega cap tech
NVDA  — high-growth semiconductor
BIIB  — biotech (critical for LIQ screen — has shelf registration)
MRNA  — biotech (has ATM program, good LIQ test)
JPM   — large cap financials
TSLA  — volatile, high-profile
META  — ad-tech
AMZN  — e-commerce / cloud
XOM   — energy (different financial structure)
SPY   — ETF (edge case — some fields N/A)
PLTR  — small-mid cap tech (good for estimates test)

The ground truth file must:

1. Define a TypeScript interface `GroundTruthRecord` with every field
2. Define tolerance bands per field type:
   - PRICE fields: 1% tolerance (prices move, snapshot comparison)
   - FINANCIAL fields: 0.5% tolerance (should be exact from filings)
   - RATIO fields: 3% tolerance (can vary by calculation methodology)
   - ESTIMATE fields: 5% tolerance (slight source differences acceptable)
   - LIQ fields: 5% tolerance (filing extraction has some variance)
3. Include the source used to verify each value and the verification date
4. Flag fields as SKIP for SPY where the metric is not applicable (ETF)

Structure:

```typescript
export type ToleranceBand = 'price' | 'financial' | 'ratio' | 'estimate' | 'liq'

export const TOLERANCE: Record<ToleranceBand, number> = {
  price:     0.01,  // 1%
  financial: 0.005, // 0.5%
  ratio:     0.03,  // 3%
  estimate:  0.05,  // 5%
  liq:       0.05,  // 5%
}

export interface GroundTruthField {
  value: number | null    // null = SKIP (not applicable)
  band: ToleranceBand
  source: string          // 'yahoo' | 'macrotrends' | 'edgar' | 'koyfin'
  verifiedAt: string      // ISO date string
  notes?: string
}

export interface GroundTruthRecord {
  ticker: string
  // DES fields
  marketCapB: GroundTruthField        // in billions
  sharesOutstandingM: GroundTruthField // in millions
  peRatioTTM: GroundTruthField
  epsTTM: GroundTruthField
  dividendYield: GroundTruthField     // as decimal e.g. 0.005 = 0.5%
  beta: GroundTruthField
  // FA fields — most recent fiscal year (use FY2024 or FY2023 depending on availability)
  revenueB: GroundTruthField          // in billions
  grossMargin: GroundTruthField       // as decimal
  operatingMargin: GroundTruthField
  netMargin: GroundTruthField
  totalDebtB: GroundTruthField
  cashAndEquivB: GroundTruthField
  // EE fields — NTM consensus
  epsEstimateNTM: GroundTruthField
  revenueEstimateNTMB: GroundTruthField
  // ANR fields
  analystConsensus: GroundTruthField  // 1=Strong Sell, 2=Sell, 3=Hold, 4=Buy, 5=Strong Buy
  priceTargetConsensus: GroundTruthField
  // HP fields
  closePrice1YrAgo: GroundTruthField  // price exactly 1yr ago — use Yahoo HP tab
  // LIQ fields (only for BIIB and MRNA — others set to null/SKIP)
  liqCashRunwayQtrs: GroundTruthField
  liqTotalLiquidityB: GroundTruthField
}

export const GROUND_TRUTH: Record<string, GroundTruthRecord> = {
  // Populate with current values fetched from Yahoo Finance / Macrotrends
  // Run `pnpm seed` to auto-fetch a starting point, then manually verify key fields
  AAPL: { ... },
  // ... all 12 tickers
}
```

Populate GROUND_TRUTH with realistic placeholder values that the seed
fetcher will overwrite. Use these approximate values as starting points
(they will be auto-refreshed by the seed command):

AAPL:  marketCap ~$3T, revenue ~$391B, grossMargin ~0.46
MSFT:  marketCap ~$3.1T, revenue ~$245B, grossMargin ~0.70
NVDA:  marketCap ~$2.8T, revenue ~$130B, grossMargin ~0.75
BIIB:  marketCap ~$25B, revenue ~$9.8B, cashRunway ~13 quarters
MRNA:  marketCap ~$15B, revenue ~$3.2B
JPM:   marketCap ~$700B, revenue ~$162B (note: bank, margins differ)
TSLA:  marketCap ~$550B, revenue ~$97B, grossMargin ~0.18
META:  marketCap ~$1.4T, revenue ~$164B, grossMargin ~0.81
AMZN:  marketCap ~$2.1T, revenue ~$620B, grossMargin ~0.48
XOM:   marketCap ~$500B, revenue ~$398B, grossMargin ~0.35
SPY:   most fields null (ETF — skip fundamentals)
PLTR:  marketCap ~$180B, revenue ~$3.5B

---

## Step 3 — Create packages/validation/src/seedFetcher.ts

This script auto-populates ground truth values from Yahoo Finance
(via yfinance-compatible public APIs) as a starting point.
The analyst then manually verifies key fields before running validation.

The seed fetcher must:

1. Fetch from Yahoo Finance unofficial API (no key needed):
   https://query1.finance.yahoo.com/v10/finance/quoteSummary/{ticker}
   ?modules=summaryDetail,defaultKeyStatistics,financialData,earningsTrends,recommendationTrend

2. For each ticker in GROUND_TRUTH, fetch and map:
   - marketCap → summaryDetail.marketCap.raw
   - sharesOutstanding → defaultKeyStatistics.sharesOutstanding.raw
   - peRatioTTM → summaryDetail.trailingPE.raw
   - epsTTM → defaultKeyStatistics.trailingEps.raw
   - dividendYield → summaryDetail.dividendYield.raw
   - beta → summaryDetail.beta.raw
   - grossMargin → financialData.grossMargins.raw
   - operatingMargin → financialData.operatingMargins.raw
   - netMargin → financialData.profitMargins.raw
   - totalDebt → financialData.totalDebt.raw
   - cashAndEquiv → financialData.totalCash.raw
   - epsEstimateNTM → earningsTrends[0].epsEstimate.avg.raw
   - analystConsensus → financialData.recommendationMean.raw
   - priceTargetConsensus → financialData.targetMeanPrice.raw
   - revenue → financialData.totalRevenue.raw

3. Write the fetched values back into groundTruth.ts with:
   - source: 'yahoo-seed'
   - verifiedAt: today's ISO date
   - notes: 'AUTO-SEEDED — manually verify before using as ground truth'

4. Print a summary table showing which fields were fetched vs missing

5. Add a warning at the top of the output:
   "⚠ These values are auto-seeded from Yahoo Finance. 
    Manually verify against Bloomberg terminal before client demos.
    Key fields to verify manually: EE (analyst estimates), ANR (ratings),
    LIQ (cash runway — not available from Yahoo, must use SEC filings directly)."

---

## Step 4 — Create packages/validation/src/batchuApiClient.ts

HTTP client that calls BATTU's live API endpoints to fetch the same fields.
The validation runner will compare BATTU API responses against ground truth.

Base URL: read from env BATTU_API_URL (default: http://localhost:3000)

Implement these fetch functions:

```typescript
fetchDES(ticker: string): Promise<DESResponse>
  → GET /api/v1/fundamentals/profile/{ticker}
  → Returns: marketCap, sharesOutstanding, peRatio, eps, dividendYield, beta

fetchFA(ticker: string): Promise<FAResponse>
  → GET /api/v1/fundamentals/financials/{ticker}?period=annual&limit=1
  → Returns: revenue, grossMargin, operatingMargin, netMargin, totalDebt, cash

fetchEE(ticker: string): Promise<EEResponse>
  → GET /api/v1/fundamentals/estimates/{ticker}
  → Returns: epsEstimateNTM, revenueEstimateNTM

fetchANR(ticker: string): Promise<ANRResponse>
  → GET /api/v1/fundamentals/grades/{ticker}
  → Returns: consensusRating (numeric), priceTarget

fetchHP(ticker: string, date: string): Promise<HPResponse>
  → GET /api/v1/market/ohlcv/{ticker}?from={date}&to={date}&timespan=day
  → Returns: close price for given date

fetchLIQ(ticker: string): Promise<LIQResponse>
  → GET /api/v1/liq/{ticker}
  → Returns: cashRunwayQtrs, totalLiquidityB, cashAndEquivB

fetchPrice(ticker: string): Promise<PriceResponse>
  → GET /api/v1/market/price/{ticker}
  → Returns: current price (for price tolerance validation only)
```

Handle errors gracefully — if an endpoint returns 404 or 500,
mark that field as ERROR in the validation result, don't crash the runner.

---

## Step 5 — Create packages/validation/src/validator.ts

Core comparison logic.

```typescript
interface ValidationResult {
  ticker: string
  field: string
  groundTruth: number | null
  battuValue: number | null
  deviation: number | null      // as decimal, e.g. 0.023 = 2.3%
  tolerance: number
  status: 'PASS' | 'FAIL' | 'SKIP' | 'ERROR' | 'MISSING_ENDPOINT'
  notes?: string
}

function compareField(
  ticker: string,
  field: string,
  groundTruth: GroundTruthField,
  battuValue: number | null,
): ValidationResult

function validateTicker(
  ticker: string,
  groundTruth: GroundTruthRecord,
  battuData: AllBattuResponses,
): ValidationResult[]

function validateAll(
  groundTruth: Record<string, GroundTruthRecord>,
): Promise<ValidationResult[]>
```

Comparison logic:
- If groundTruth.value is null → status = SKIP
- If battuValue is null/undefined → status = MISSING_ENDPOINT
- deviation = abs(battuValue - groundTruth.value) / abs(groundTruth.value)
- If deviation <= tolerance → PASS
- If deviation > tolerance → FAIL
- Special case: price fields — recalculate tolerance against live price
  (price fields are expected to drift — flag but don't fail hard)

---

## Step 6 — Create packages/validation/src/runner.ts

Main entry point. Orchestrates the full validation run.

Must:

1. Load .env.local
2. Check all required env vars are present (POLYGON_API_KEY, FMP_API_KEY, BATTU_API_URL)
3. Run validateAll() against all 12 tickers
4. Print live progress: "Validating AAPL... ✓" as each ticker completes
5. Print summary to console:

```
════════════════════════════════════════════════════════
  BATTU Data Validation Report
  Run at: 2026-05-20 14:32:01
════════════════════════════════════════════════════════

  AAPL    ████████████████████  18/20 PASS  1 FAIL  1 SKIP
  MSFT    ████████████████████  20/20 PASS  0 FAIL  0 SKIP
  NVDA    ████████████████████  17/20 PASS  2 FAIL  1 SKIP
  BIIB    ████████████████████  20/22 PASS  0 FAIL  2 SKIP
  ...

  ─────────────────────────────────────────────────────
  TOTAL   226/240 fields PASS  (94.2%)
          8 FAIL  |  6 SKIP  |  0 ERROR

  ❌ FAILURES:
  NVDA  epsEstimateNTM    BATTU: 2.84  TRUTH: 3.10  deviation: 8.4%  (tolerance: 5%)
  TSLA  grossMargin       BATTU: 0.16  TRUTH: 0.18  deviation: 11.1% (tolerance: 0.5%)

  ⚠ WARNINGS (price drift — expected):
  AAPL  closePrice1YrAgo  BATTU: 171.50  TRUTH: 169.20  deviation: 1.4%

════════════════════════════════════════════════════════
```

6. If --report flag passed, also write:
   packages/validation/reports/validation-{timestamp}.json
   with full ValidationResult[] array

7. Exit with code 1 if any FAIL results exist (useful for CI)
8. Exit with code 0 if all PASS or SKIP

---

## Step 7 — Create packages/validation/src/htmlReport.ts

Generates a standalone HTML file for sharing with D. Boral or team.

packages/validation/reports/latest.html

The HTML report must:

1. Be completely self-contained (no external dependencies)
2. Use the same dark terminal color scheme as BATTU:
   - Background: #0A0E1A
   - Green: #10B981 for PASS
   - Red: #EF4444 for FAIL
   - Amber: #F59E0B for SKIP/WARNING
   - Text: #E8E8E8
3. Show a header with:
   - "BATTU Finance Screen — Data Validation Report"
   - Run timestamp
   - Overall score (e.g. "94.2% PASS RATE")
   - Large colored pass/fail indicator
4. Show a summary table per ticker with colored pass/fail counts
5. Show a detailed table for each ticker with:
   - Field name
   - Ground truth value (source + verified date)
   - BATTU value
   - Deviation %
   - Status badge (PASS/FAIL/SKIP in color)
6. Show a "Fields Requiring Manual Bloomberg Verification" section at bottom:
   - EE (earnings estimates) — FMP lag vs Bloomberg, recommend Bloomberg lab check
   - ANR (analyst ratings) — firm-level vs analyst-level attribution gap
   - LIQ (cash runway) — BATTU-unique screen, verify raw calculation against 10-Q manually

---

## Step 8 — Add npm script to root package.json

Add to the root pnpm workspace:

```json
"validate": "pnpm --filter @battu/validation run validate",
"validate:report": "pnpm --filter @battu/validation run report",
"seed:groundtruth": "pnpm --filter @battu/validation run seed"
```

---

## Step 9 — Create packages/validation/README.md

Document exactly how to use this for the D. Boral demo preparation:

```markdown
# BATTU Data Validation Suite

## Quick start
pnpm seed:groundtruth    # Auto-fetch starting values from Yahoo Finance
pnpm validate            # Run validation against live BATTU API
pnpm validate:report     # Run + generate HTML report

## Before the D. Boral demo — checklist
[ ] Run seed to get latest Yahoo Finance values
[ ] Manually verify AAPL, NVDA, BIIB against Koyfin or Macrotrends
[ ] If Bloomberg lab access available — verify EE and ANR fields
[ ] Run full validation — target 90%+ pass rate before demo
[ ] Open reports/latest.html and review all FAIL fields
[ ] Fix any FAIL > 10% deviation in FMP or Polygon client code
[ ] Re-run until clean

## How to interpret results
PASS   = within tolerance band for that field type
FAIL   = deviation exceeds tolerance — investigate data source
SKIP   = field not applicable for this ticker (e.g. ETF has no P/E)
ERROR  = BATTU endpoint returned error — fix the API route first

## Tolerance bands
price:     1%   — prices move, snapshot timing causes small variance
financial: 0.5% — exact from filings, should match almost perfectly
ratio:     3%   — minor methodology differences (TTM vs FY, etc.)
estimate:  5%   — consensus aggregation differences across sources
liq:       5%   — Claude extraction has minor variance on prose fields

## Fields you cannot verify without Bloomberg
EE  epsEstimateNTM       — FMP shows consensus, Bloomberg shows named analysts
ANR analystConsensus     — FMP shows firm-level, Bloomberg shows named analysts
     (These fields will PASS tolerance check — the gap is attribution, not value)

## LIQ screen verification (no Bloomberg needed)
LIQ data comes from SEC filings directly. To verify manually:
1. Go to sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={ticker}
2. Find latest 10-Q — check cash + investments on balance sheet
3. Find latest S-3 — check offering amount on cover page
4. Find all 424B3/424B5 since S-3 — sum the offering amounts
5. Compare to BATTU LIQ screen output
If BATTU matches your manual calculation → correct by definition
```

---

## Execution order

Do all steps in order. After creating each file, confirm it compiles
with `pnpm --filter @battu/validation tsc --noEmit` before proceeding.

After all files are created:
1. Run `pnpm seed:groundtruth` and show me the output
2. Run `pnpm validate` against the dev API and show me the full console output
3. Generate the HTML report and confirm it was written to reports/latest.html

If the BATTU API endpoints don't exist yet (they won't in early sessions),
the validator should return MISSING_ENDPOINT for those fields rather than
crashing. This lets us run the suite incrementally as screens are built.

Do not proceed to building screens until this validation suite compiles
and runs without errors (even if all results are MISSING_ENDPOINT).
The suite is the foundation for confident shipping.
CLAUDEEOF
echo "done"