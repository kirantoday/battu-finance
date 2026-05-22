// pgvector + BM25 hybrid search over battu.doc_chunks.
// Storage uses upsert semantics — re-ingesting a filing wipes its old chunks
// first so we never end up with stale duplicates.

import { pgSql } from '@battu/db'
import { embedQuery } from './embedder'
import type { Chunk } from './chunker'

export interface StoredChunk {
  id:          string
  ticker:      string
  cik:         string
  filingType:  string
  filingDate:  string
  accessionNo: string
  section:     string
  chunkIdx:    number
  chunkText:   string
}

interface SearchHit {
  id:        string
  chunkText: string
  section:   string
  rank:      number
}

// ── Storage ─────────────────────────────────────────────────────────────────

export async function storeChunks(
  ticker:      string,
  cik:         string,
  filingType:  string,
  filingDate:  string,
  accessionNo: string,
  chunks:      Chunk[],
  embeddings:  number[][],
): Promise<void> {
  // Wipe any existing chunks for this exact filing first
  await pgSql`
    DELETE FROM battu.doc_chunks
    WHERE ticker       = ${ticker}
      AND filing_type  = ${filingType}
      AND accession_no = ${accessionNo}
  `

  for (let i = 0; i < chunks.length; i++) {
    const chunk     = chunks[i]
    const embedding = embeddings[i]
    const embStr    = `[${embedding.join(',')}]`

    await pgSql`
      INSERT INTO battu.doc_chunks
        (ticker, cik, filing_type, filing_date, accession_no,
         section, chunk_idx, chunk_text, embedding)
      VALUES
        (${ticker}, ${cik}, ${filingType}, ${filingDate}, ${accessionNo},
         ${chunk.sectionLabel}, ${chunk.chunkIdx}, ${chunk.text},
         ${embStr}::vector)
    `
  }
}

export async function updateFilingIndex(
  ticker:      string,
  cik:         string,
  filingType:  string,
  filingDate:  string,
  accessionNo: string,
  status:      string,
  chunkCount:  number,
  errorMsg?:   string,
): Promise<void> {
  await pgSql`
    INSERT INTO battu.filing_index
      (ticker, cik, filing_type, filing_date, accession_no,
       status, chunk_count, chunks_embedded, processed_at, error_msg)
    VALUES
      (${ticker}, ${cik}, ${filingType}, ${filingDate}, ${accessionNo},
       ${status}, ${chunkCount}, ${chunkCount}, NOW(), ${errorMsg ?? null})
    ON CONFLICT (ticker, filing_type, accession_no) DO UPDATE SET
      status          = EXCLUDED.status,
      chunk_count     = EXCLUDED.chunk_count,
      chunks_embedded = EXCLUDED.chunks_embedded,
      processed_at    = NOW(),
      error_msg       = EXCLUDED.error_msg
  `
}

export async function isFilingProcessed(
  ticker:      string,
  filingType:  string,
  accessionNo: string,
): Promise<boolean> {
  const rows = await pgSql`
    SELECT id FROM battu.filing_index
    WHERE ticker = ${ticker}
      AND filing_type = ${filingType}
      AND accession_no = ${accessionNo}
      AND status = 'done'
  `
  return rows.length > 0
}

// ── Search ──────────────────────────────────────────────────────────────────

/**
 * Resolve a logical filingType into the actual `filing_type` values stored
 * in battu.doc_chunks. 'S-3' is treated as a family covering S-3, S-3/A and
 * S-3ASR — rows store the actual form filed.
 */
function filingTypeFamily(filingType: string): string[] {
  if (filingType === 'S-3') return ['S-3', 'S-3/A', 'S-3ASR']
  return [filingType]
}

async function vectorSearch(
  ticker:         string,
  filingType:     string,
  queryEmbedding: number[],
  topK:           number,
): Promise<SearchHit[]> {
  const embStr = `[${queryEmbedding.join(',')}]`
  const types  = filingTypeFamily(filingType)
  const rows = await pgSql`
    SELECT id::text AS id, chunk_text, section,
           ROW_NUMBER() OVER (ORDER BY embedding <=> ${embStr}::vector) AS rank
    FROM battu.doc_chunks
    WHERE ticker      = ${ticker}
      AND filing_type IN ${pgSql(types)}
    ORDER BY embedding <=> ${embStr}::vector
    LIMIT ${topK * 2}
  ` as unknown as Array<{ id: string; chunk_text: string; section: string; rank: number | string }>
  return rows.map(r => ({
    id:        r.id,
    chunkText: r.chunk_text,
    section:   r.section,
    rank:      Number(r.rank),
  }))
}

/**
 * BM25 uses `|` (OR), not `&` (AND). `&` required every term to appear in the
 * same chunk — far too strict for queries like
 * "PricewaterhouseCoopers Deloitte KPMG Ernst Young auditor opinion". With OR,
 * ts_rank still favors chunks that match more terms, so semantics survive.
 */
function toTsQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 2)
    .join(' | ')
}

async function bm25Search(
  ticker:     string,
  filingType: string,
  query:      string,
  topK:       number,
): Promise<SearchHit[]> {
  const tsQuery = toTsQuery(query)
  if (!tsQuery) return []

  const types = filingTypeFamily(filingType)
  const rows = await pgSql`
    SELECT id::text AS id, chunk_text, section,
           ROW_NUMBER() OVER (ORDER BY ts_rank(ts_vector, q) DESC) AS rank
    FROM battu.doc_chunks,
         to_tsquery('english', ${tsQuery}) q
    WHERE ticker      = ${ticker}
      AND filing_type IN ${pgSql(types)}
      AND ts_vector   @@ q
    ORDER BY ts_rank(ts_vector, q) DESC
    LIMIT ${topK * 2}
  ` as unknown as Array<{ id: string; chunk_text: string; section: string; rank: number | string }>
  return rows.map(r => ({
    id:        r.id,
    chunkText: r.chunk_text,
    section:   r.section,
    rank:      Number(r.rank),
  }))
}

function rrfFusion(
  vectorResults: SearchHit[],
  bm25Results:   SearchHit[],
  topK:          number,
  k:             number = 60,
): Array<{ chunkText: string; section: string; score: number }> {
  const scores = new Map<string, { chunkText: string; section: string; score: number }>()

  for (const r of vectorResults) {
    const s = scores.get(r.id) ?? { chunkText: r.chunkText, section: r.section, score: 0 }
    s.score += 1 / (k + r.rank)
    scores.set(r.id, s)
  }
  for (const r of bm25Results) {
    const s = scores.get(r.id) ?? { chunkText: r.chunkText, section: r.section, score: 0 }
    s.score += 1 / (k + r.rank)
    scores.set(r.id, s)
  }

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

/** Combined vector + BM25 search fused via RRF. */
export async function hybridSearch(
  ticker:     string,
  filingType: string,
  query:      string,
  topK:       number = 5,
): Promise<Array<{ chunkText: string; section: string }>> {
  const [queryEmbedding, bm25] = await Promise.all([
    embedQuery(query),
    bm25Search(ticker, filingType, query, topK),
  ])
  const vector = await vectorSearch(ticker, filingType, queryEmbedding, topK)
  return rrfFusion(vector, bm25, topK)
}
