// Structure-aware HTML → sections.
// 10-K / 10-Q: pulled into Item-level chunks, with Item 8 further split into Notes.
// S-3 / 424B:  split at heading boundaries; falls back to a single large section.

export interface DocumentSection {
  sectionKey:    string     // 'note_5_debt', 'item_7_mda'
  sectionLabel:  string     // 'Note 5 — Debt and Credit Facilities'
  sectionType:   'item' | 'note' | 'paragraph'
  itemNumber:    string     // '5', '7', '1A'
  text:          string
  tokenEstimate: number     // chars / 4 (rough)
  importance:    'high' | 'medium' | 'low'
  filingType:    string     // '10-K', 'S-3', '424B3', ...
}

const HIGH_KEYWORDS = [
  'debt', 'credit facility', 'revolving', 'borrowing', 'credit agreement',
  'shelf', 'registration', 'offering', 'liquidity', 'cash',
  'financing', 'capital resources', 'covenant', 'maturity', 'interest rate',
  'bank', 'lender', 'revolver', 'rofl', 'line of credit',
  'legal counsel', 'law firm', 'auditor', 'going concern',
  'litigation', 'legal proceedings',
]

const MEDIUM_KEYWORDS = [
  'risk', 'management', 'discussion', 'analysis', 'operations',
  'investment', 'securities', 'dividend', 'equity',
]

const SECTION_PATTERNS_10K: Array<{
  pattern: RegExp
  key:     string
  label:   string
  type:    'item'
  num:     string
}> = [
  { pattern: /ITEM\s+1[^A-Z\d][\s.]+BUSINESS/i,             key: 'item_1_business',   label: 'Item 1 — Business',             type: 'item', num: '1'  },
  { pattern: /ITEM\s+1A[\s.]+RISK\s+FACTORS/i,              key: 'item_1a_risk',      label: 'Item 1A — Risk Factors',        type: 'item', num: '1A' },
  { pattern: /ITEM\s+2[\s.]+PROPERTIES/i,                   key: 'item_2_properties', label: 'Item 2 — Properties',           type: 'item', num: '2'  },
  { pattern: /ITEM\s+3[\s.]+LEGAL\s+PROCEEDINGS/i,          key: 'item_3_legal',      label: 'Item 3 — Legal Proceedings',    type: 'item', num: '3'  },
  { pattern: /ITEM\s+7[\s.]+MANAGEMENT.{1,30}DISCUSSION/i,  key: 'item_7_mda',        label: 'Item 7 — MD&A',                 type: 'item', num: '7'  },
  { pattern: /ITEM\s+8[\s.]+FINANCIAL\s+STATEMENTS/i,       key: 'item_8_financials', label: 'Item 8 — Financial Statements', type: 'item', num: '8'  },
  { pattern: /ITEM\s+9A[\s.]+CONTROLS/i,                    key: 'item_9a_controls',  label: 'Item 9A — Controls',            type: 'item', num: '9A' },
  // Auditor's report letter — header lives inside Item 8 but is the actual
  // section where the auditor firm's name appears (with a signature block).
  { pattern: /REPORT\s+OF\s+INDEPENDENT\s+REGISTERED/i,      key: 'auditor_report',    label: 'Report of Independent Registered Public Accounting Firm', type: 'item', num: 'AUDIT' },
]

// 20-F (foreign private issuers — Canadian / European / Asian companies listed
// in the US) uses different Item numbering. We reuse the 10-K parsing machinery
// since Notes structure and auditor report are similar; only the Item-level
// boundaries differ.
const SECTION_PATTERNS_20F: Array<{
  pattern: RegExp
  key:     string
  label:   string
  type:    'item'
  num:     string
}> = [
  { pattern: /ITEM\s+3[\s.]+KEY\s+INFORMATION/i,                key: 'item_3_key_info',       label: 'Item 3 — Key Information',                  type: 'item', num: '3'  },
  { pattern: /ITEM\s+4[\s.]+INFORMATION\s+ON\s+THE\s+COMPANY/i, key: 'item_4_company',        label: 'Item 4 — Information on the Company',       type: 'item', num: '4'  },
  { pattern: /ITEM\s+5[\s.]+OPERATING\s+AND\s+FINANCIAL/i,      key: 'item_5_mda',            label: 'Item 5 — Operating and Financial Review',   type: 'item', num: '5'  },
  { pattern: /ITEM\s+6[\s.]+DIRECTORS/i,                        key: 'item_6_directors',      label: 'Item 6 — Directors, Senior Management',     type: 'item', num: '6'  },
  { pattern: /ITEM\s+7[\s.]+MAJOR\s+SHAREHOLDERS/i,             key: 'item_7_shareholders',   label: 'Item 7 — Major Shareholders',               type: 'item', num: '7'  },
  { pattern: /ITEM\s+8[\s.]+FINANCIAL\s+INFORMATION/i,          key: 'item_8_financial_info', label: 'Item 8 — Financial Information',            type: 'item', num: '8'  },
  { pattern: /ITEM\s+1[57][\s.]+CONTROLS/i,                     key: 'item_15_controls',      label: 'Item 15 — Controls and Procedures',         type: 'item', num: '15' },
  // 20-F lets the issuer pick Item 17 OR Item 18 for the financial statements
  // (Item 18 is the more common choice; it requires fuller US-GAAP/IFRS-IASB
  // reconciliation). Match either as a Notes-bearing section.
  { pattern: /ITEM\s+17[\s.]+FINANCIAL\s+STATEMENTS/i,          key: 'item_17_statements',    label: 'Item 17 — Financial Statements',            type: 'item', num: '17' },
  { pattern: /ITEM\s+18[\s.]+FINANCIAL\s+STATEMENTS/i,          key: 'item_18_statements',    label: 'Item 18 — Financial Statements',            type: 'item', num: '18' },
  { pattern: /ITEM\s+19[\s.]+EXHIBITS/i,                        key: 'item_19_exhibits',      label: 'Item 19 — Exhibits',                        type: 'item', num: '19' },
  // Auditor letter — same PCAOB-mandated header on 20-F filings as on 10-K.
  { pattern: /REPORT\s+OF\s+INDEPENDENT\s+REGISTERED/i,         key: 'auditor_report',        label: 'Report of Independent Registered Public Accounting Firm', type: 'item', num: 'AUDIT' },
]

// 40-F (Canadian issuers under the Multi-Jurisdictional Disclosure System) is
// structurally a wrapper around the issuer's Canadian Annual Information Form
// + audited statements. SEC formatting is Parts I/II/III rather than Items;
// Part II reliably contains the audited financial statements + Notes.
const SECTION_PATTERNS_40F: Array<{
  pattern: RegExp
  key:     string
  label:   string
  type:    'item'
  num:     string
}> = [
  { pattern: /PART\s+I\b/i,                              key: 'part_1',         label: 'Part I — Annual Information',     type: 'item', num: 'I'    },
  { pattern: /PART\s+II\b/i,                             key: 'part_2',         label: 'Part II — Financial Statements',  type: 'item', num: 'II'   },
  { pattern: /PART\s+III\b/i,                            key: 'part_3',         label: 'Part III — Additional Information', type: 'item', num: 'III' },
  { pattern: /REPORT\s+OF\s+INDEPENDENT\s+REGISTERED/i,  key: 'auditor_report', label: 'Report of Independent Registered Public Accounting Firm', type: 'item', num: 'AUDIT' },
]

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<table[^>]*>/gi, '\n[TABLE]\n')
    .replace(/<\/table>/gi, '\n[/TABLE]\n')
    .replace(/<tr[^>]*>/gi, '\n')
    .replace(/<\/tr>/gi, '')
    .replace(/<td[^>]*>/gi, ' | ')
    .replace(/<th[^>]*>/gi, ' | ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<h[1-6][^>]*>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/\s{3,}/g, '\n\n')
    .trim()
}

function scoreImportance(label: string, text: string): 'high' | 'medium' | 'low' {
  const combined = (label + ' ' + text.slice(0, 500)).toLowerCase()
  const highHits = HIGH_KEYWORDS.filter(k => combined.includes(k)).length
  const medHits  = MEDIUM_KEYWORDS.filter(k => combined.includes(k)).length
  if (highHits >= 2) return 'high'
  if (highHits >= 1 || medHits >= 2) return 'medium'
  return 'low'
}

export function parseDocument(html: string, filingType: string): DocumentSection[] {
  const text = stripHtml(html)
  const sections: DocumentSection[] = []

  const is10K = filingType === '10-K' || filingType === '10-K/A' || filingType === '10-Q' || filingType === '10-Q/A'
  const is20F = filingType === '20-F' || filingType === '20-F/A'
  const is40F = filingType === '40-F' || filingType === '40-F/A'

  if (is10K || is20F || is40F) {
    // Pick the right pattern set per issuer type. 10-K/10-Q share US Items;
    // 20-F has its own Item numbering; 40-F (Canadian MJDS) uses Parts.
    const patternSet =
        is40F ? SECTION_PATTERNS_40F
      : is20F ? SECTION_PATTERNS_20F
      :         SECTION_PATTERNS_10K

    // Pass 1: find Item-level boundaries
    const itemBoundaries: Array<{ idx: number; key: string; label: string; type: 'item'; num: string }> = []
    for (const pat of patternSet) {
      const match = text.match(pat.pattern)
      if (match) {
        const idx = text.indexOf(match[0])
        if (idx >= 0) itemBoundaries.push({ idx, key: pat.key, label: pat.label, type: 'item', num: pat.num })
      }
    }
    itemBoundaries.sort((a, b) => a.idx - b.idx)

    // Pass 2: slice content for each Item; further sub-split Item 8 by Notes
    for (let i = 0; i < itemBoundaries.length; i++) {
      const start   = itemBoundaries[i].idx
      const end     = i + 1 < itemBoundaries.length ? itemBoundaries[i + 1].idx : text.length
      const content = text.slice(start, end).trim()
      const { key, label, num } = itemBoundaries[i]

      // Sub-split Notes inside any Financial Statements section. Keys map to:
      //   10-K → item_8_financials
      //   20-F → item_8_financial_info (Item 8), item_17_statements, item_18_statements
      //   40-F → part_2 (Canadian MJDS Annual Information Form audited statements)
      const isFinancialSection =
           key === 'item_8_financials'
        || key === 'item_8_financial_info'
        || key === 'item_17_statements'
        || key === 'item_18_statements'
        || key === 'part_2'
      if (isFinancialSection) {
        const noteMatches = [...content.matchAll(/(?:NOTE|note)\s+(\d+)[.\s—–-]+([^\n]{5,80})/g)]
        if (noteMatches.length > 0) {
          for (let j = 0; j < noteMatches.length; j++) {
            const noteStart = noteMatches[j].index!
            const noteEnd   = j + 1 < noteMatches.length ? noteMatches[j + 1].index! : content.length
            const noteText  = content.slice(noteStart, noteEnd).trim()
            const noteNum   = noteMatches[j][1]
            const noteTitle = noteMatches[j][2].trim().slice(0, 80)
            const noteLabel = `Note ${noteNum} — ${noteTitle}`
            const noteKey   = `note_${noteNum}_${noteTitle.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30)}`

            sections.push({
              sectionKey:    noteKey,
              sectionLabel:  noteLabel,
              sectionType:   'note',
              itemNumber:    noteNum,
              text:          noteLabel + ':\n' + noteText,
              tokenEstimate: Math.ceil(noteText.length / 4),
              importance:    scoreImportance(noteLabel, noteText),
              filingType,
            })
          }
          continue  // don't also emit Item 8 as a giant single section
        }
      }

      sections.push({
        sectionKey:    key,
        sectionLabel:  label,
        sectionType:   'item',
        itemNumber:    num,
        text:          label + ':\n' + content,
        tokenEstimate: Math.ceil(content.length / 4),
        importance:    scoreImportance(label, content),
        filingType,
      })
    }

    // Fallback: no Items detected — emit paragraph-sized chunks
    if (sections.length === 0) {
      const paragraphs = text.split(/\n{3,}/).filter(p => p.trim().length > 100)
      paragraphs.forEach((p, i) => {
        sections.push({
          sectionKey:    `paragraph_${i}`,
          sectionLabel:  `Section ${i + 1}`,
          sectionType:   'paragraph',
          itemNumber:    String(i),
          text:          p.trim(),
          tokenEstimate: Math.ceil(p.length / 4),
          importance:    scoreImportance('', p),
          filingType,
        })
      })
    }
  } else {
    // S-3, 424B — split at major headings
    const headingPattern = /^([A-Z][A-Z\s,()&'/]{5,60})$/gm
    const headings = [...text.matchAll(headingPattern)]
    if (headings.length > 2) {
      for (let i = 0; i < headings.length; i++) {
        const start   = headings[i].index!
        const end     = i + 1 < headings.length ? headings[i + 1].index! : text.length
        const content = text.slice(start, end).trim()
        const label   = headings[i][1].trim()
        sections.push({
          sectionKey:    `section_${i}_${label.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30)}`,
          sectionLabel:  label,
          sectionType:   'paragraph',
          itemNumber:    String(i),
          text:          label + ':\n' + content,
          tokenEstimate: Math.ceil(content.length / 4),
          importance:    scoreImportance(label, content),
          filingType,
        })
      }
    } else {
      sections.push({
        sectionKey:    'full_document',
        sectionLabel:  filingType + ' Filing',
        sectionType:   'paragraph',
        itemNumber:    '0',
        text:          text.slice(0, 40000),
        tokenEstimate: Math.ceil(Math.min(text.length, 40000) / 4),
        importance:    'high',
        filingType,
      })
    }
  }

  return sections.filter(s => s.tokenEstimate > 10)
}
