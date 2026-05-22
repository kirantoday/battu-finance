┌─────────────────────────────────────────────────────┐
│  STEP 1: INGESTION (done once, nightly updates)     │
└─────────────────────────────────────────────────────┘

BIIB 10-K (200 pages of text)
  ↓
doc-parser.ts splits into sections:
  Section A: "Item 1 — Business Description" (pages 1-20)
  Section B: "Item 1A — Risk Factors" (pages 21-50)
  Section C: "Note 5 — Debt and Credit Facilities" (pages 140-145) ← WANT THIS
  Section D: "Note 9 — Income Taxes" (pages 146-152)
  ... etc
  ↓
chunker.ts splits each section into 512-token chunks:
  Chunk 1: "Note 5 — Debt... The Company entered into a $1.5 billion..."
  Chunk 2: "...revolving credit facility with Bank of America, N.A..."
  Chunk 3: "...bearing interest at SOFR plus 1.25%, maturing August 2029..."
  ↓
Voyage Finance-2 converts each chunk to 1024 numbers:
  Chunk 1 → [0.82, 0.31, -0.45, 0.67, ...] (1024 numbers)
  Chunk 2 → [0.79, 0.28, -0.41, 0.71, ...] (1024 numbers)
  Chunk 3 → [0.81, 0.29, -0.43, 0.69, ...] (1024 numbers)
  ↓
Store in battu.doc_chunks:
  | ticker | section  | chunk_text              | embedding          |
  | BIIB   | Note 5   | "...revolving credit..." | [0.79, 0.28, ...]  |
  | BIIB   | Note 5   | "...Bank of America..."  | [0.81, 0.29, ...]  |
  | BIIB   | Note 5   | "...SOFR plus 1.25%..."  | [0.80, 0.30, ...]  |

┌─────────────────────────────────────────────────────┐
│  STEP 2: RETRIEVAL (when user types LIQ BIIB)       │
└─────────────────────────────────────────────────────┘

User types: LIQ BIIB

Query: "revolving credit facility lender bank interest rate"
  ↓
Voyage Finance-2 converts query to numbers:
  Query → [0.80, 0.27, -0.42, 0.70, ...] (1024 numbers)
  ↓
pgvector searches doc_chunks:
  "Which stored chunks have numbers CLOSEST to the query numbers?"
  
  Chunk A (Note 5 — revolving credit):  distance = 0.02  ← VERY CLOSE
  Chunk B (Note 5 — Bank of America):   distance = 0.03  ← VERY CLOSE  
  Chunk C (Item 1 — iPhone revenue):    distance = 0.87  ← FAR AWAY
  Chunk D (Note 9 — income taxes):      distance = 0.71  ← FAR AWAY
  ↓
Returns TOP 5 closest chunks (the credit facility section)
  ↓
Send those 5 chunks to Claude Sonnet:
  "Here is text from BIIB's 10-K. Extract credit facility details."
  [chunk text: 3,000 tokens instead of 120,000 tokens]
  ↓
Claude extracts:
  lender: "Bank of America"
  amount: $1.5B
  rate: "SOFR + 1.25%"
  expiry: "August 2029"