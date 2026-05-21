# BATTU Data Validation Suite

Verifies BATTU's data (Polygon + FMP + Benzinga + EDGAR) against a hand-verifiable
ground-truth file. Target: 90%+ pass rate before any client demo.

## Quick start

```bash
pnpm seed:groundtruth    # Auto-fetch starting values from Yahoo Finance
pnpm validate            # Run validation against live BATTU API
pnpm validate:report     # Run + write JSON snapshot + HTML report
```

The HTML report is written to `packages/validation/reports/latest.html`.

## Before the D. Boral demo — checklist

- [ ] Run `pnpm seed:groundtruth` to get latest Yahoo Finance values
- [ ] Manually verify AAPL, NVDA, BIIB against Koyfin or Macrotrends
- [ ] If Bloomberg lab access is available — verify EE and ANR fields
- [ ] Fill `closePrice1YrAgo` by hand from Yahoo HP tab (not in summary feed)
- [ ] Fill LIQ fields (BIIB, MRNA) from SEC filings directly
- [ ] Run `pnpm validate:report` — target 90%+ pass rate
- [ ] Open `reports/latest.html` and review every FAIL field
- [ ] Fix any FAIL > 10% deviation in the FMP or Polygon client code
- [ ] Re-run until clean

## How to interpret results

| Status            | Meaning |
|-------------------|---------|
| `PASS`            | Within tolerance band for that field type |
| `FAIL`            | Deviation exceeds tolerance — investigate data source |
| `WARNING`         | Price-band field outside tolerance — expected drift, not a hard failure |
| `SKIP`            | Field not applicable for this ticker (e.g. ETF has no P/E) |
| `ERROR`           | BATTU endpoint reached but returned bad data — fix the API route |
| `MISSING_ENDPOINT`| API route not built yet (or returned `Not yet implemented`) |

Runner exit code is `1` only on `FAIL` or `ERROR`. `MISSING_ENDPOINT` is treated
as "not built yet" and exits `0`, so the suite is safe to run incrementally.

## Tolerance bands

| Band       | Tolerance | Rationale |
|------------|-----------|-----------|
| `price`    | 1%        | Prices move — snapshot timing causes small variance |
| `financial`| 0.5%      | Exact from filings, should match almost perfectly |
| `ratio`    | 3%        | Methodology differences (TTM vs FY, etc.) |
| `estimate` | 5%        | Consensus aggregation differs across sources |
| `liq`      | 5%        | Claude extraction has minor variance on prose fields |

Tolerances live in `src/groundTruth.ts → TOLERANCE`.

## Fields you cannot verify without Bloomberg

| Field                  | Why |
|------------------------|-----|
| `EE.epsEstimateNTM`    | FMP shows consensus only; Bloomberg shows named analysts |
| `ANR.analystConsensus` | FMP firm-level; Bloomberg named-analyst attribution |

Both will PASS tolerance — the gap is attribution, not value.

## LIQ screen verification (no Bloomberg needed)

LIQ data comes from SEC filings directly. To verify manually:

1. Go to `sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={ticker}`
2. Find the latest 10-Q — check cash + investments on the balance sheet
3. Find the latest S-3 — check the offering amount on the cover page
4. Find every 424B3/424B5 since the S-3 — sum the offering amounts
5. Compare to BATTU's LIQ screen output

If BATTU matches your manual calculation → correct by definition.

## Re-running the seed

`pnpm seed:groundtruth` overwrites the `GROUND_TRUTH` block in
`src/groundTruth.ts` (everything between `// ── GROUND_TRUTH START ──` and
`// ── GROUND_TRUTH END ──`). Hand-curated values inside the block will be
**lost**. Hand-edits to types, helpers, or tolerance constants outside the
block are preserved.

If you've done substantial manual verification, commit the file before
re-running the seed.

## File layout

```
packages/validation/
  src/
    groundTruth.ts       # types + tolerance + GROUND_TRUTH constant (12 tickers)
    seedFetcher.ts       # Yahoo Finance → rewrites GROUND_TRUTH block
    battuApiClient.ts    # HTTP wrappers for /api/v1/* with MISSING_ENDPOINT detection
    validator.ts         # Field-by-field comparison logic
    runner.ts            # Console summary + JSON + HTML output
    htmlReport.ts        # Self-contained dark-themed HTML
  reports/               # Output dir (gitignored)
  README.md
```
