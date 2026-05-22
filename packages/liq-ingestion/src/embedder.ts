// Voyage Finance-2 embedding client.
// Uses raw fetch (not the voyageai SDK) — Voyage's REST surface is simple
// enough that the SDK dependency is overkill.

const VOYAGE_BASE  = 'https://api.voyageai.com/v1'
const VOYAGE_MODEL = 'voyage-finance-2'

// Defaults are sized for the paid tier. Override via env for free tier:
//   VOYAGE_BATCH_SIZE     default 32    (free tier: set to 1)
//   VOYAGE_RATE_LIMIT_MS  default 150   (free tier: set to 22000 — 3 RPM)
//   VOYAGE_RETRIES        default 3     — exponential backoff on 429
const BATCH_SIZE    = parseInt(process.env.VOYAGE_BATCH_SIZE     ?? '32',  10)
const RATE_LIMIT_MS = parseInt(process.env.VOYAGE_RATE_LIMIT_MS  ?? '150', 10)
const MAX_RETRIES   = parseInt(process.env.VOYAGE_RETRIES        ?? '3',   10)

// Voyage's API hard-caps a single embeddings request at 120K tokens.
// We pack to 100K to leave headroom for tokenizer variance (our char/4
// heuristic underestimates token count for dense financial text like
// tables, footnotes, and ticker-heavy passages).
const MAX_BATCH_TOKENS = 100_000

// Rough token estimate. Voyage uses a BPE tokenizer similar to OpenAI's —
// ~4 chars/token for English prose, less for tables/numbers. We deliberately
// round down (chars/3.5) to over-estimate tokens and stay safely under cap.
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}

let lastCallTime = 0

async function rateLimitedCall<T>(fn: () => Promise<T>): Promise<T> {
  const elapsed = Date.now() - lastCallTime
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(r => setTimeout(r, RATE_LIMIT_MS - elapsed))
  }
  lastCallTime = Date.now()
  return fn()
}

async function voyageEmbed(
  texts:     string[],
  inputType: 'document' | 'query',
): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY
  if (!key) throw new Error('VOYAGE_API_KEY not set')

  let attempt = 0
  while (true) {
    const res = await fetch(`${VOYAGE_BASE}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:      VOYAGE_MODEL,
        input:      texts,
        input_type: inputType,
      }),
    })

    if (res.ok) {
      const json = await res.json() as { data: Array<{ embedding: number[] }> }
      return json.data.map(d => d.embedding)
    }

    // Retry on rate limits with exponential backoff (30s, 60s, 120s)
    if (res.status === 429 && attempt < MAX_RETRIES) {
      const waitMs = 30_000 * Math.pow(2, attempt)
      console.warn(`[voyage] 429 rate-limited — retry ${attempt + 1}/${MAX_RETRIES} after ${waitMs / 1000}s`)
      await new Promise(r => setTimeout(r, waitMs))
      attempt++
      continue
    }

    const err = await res.text()
    throw new Error(`Voyage API error ${res.status}: ${err}`)
  }
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const results: number[][] = []
  let i = 0
  while (i < texts.length) {
    // Build the next batch: take up to BATCH_SIZE chunks, but cut early if
    // the cumulative token estimate would exceed MAX_BATCH_TOKENS. This
    // prevents large 10-Ks (e.g. STI at 162K tokens in 32 chunks) from
    // tripping Voyage's 120K-tokens-per-request cap.
    const batch: string[] = []
    let tokens = 0
    while (
      i + batch.length < texts.length
      && batch.length < BATCH_SIZE
    ) {
      const next     = texts[i + batch.length]
      const nextTok  = estimateTokens(next)
      // Always include at least one chunk per batch, even if it alone
      // exceeds the cap — the API will reject it, but truncating chunks
      // is a separate concern handled upstream.
      if (batch.length > 0 && tokens + nextTok > MAX_BATCH_TOKENS) break
      batch.push(next)
      tokens += nextTok
    }

    const embeddings = await rateLimitedCall(() => voyageEmbed(batch, 'document'))
    results.push(...embeddings)
    i += batch.length

    if (i < texts.length) {
      console.log(`  Embedded ${i}/${texts.length} chunks (${tokens.toLocaleString()} tok in batch)`)
    }
  }
  return results
}

export async function embedQuery(text: string): Promise<number[]> {
  const embeddings = await rateLimitedCall(() => voyageEmbed([text], 'query'))
  return embeddings[0]
}
