// Structure-aware chunker. Keeps sections intact when they fit in the context
// window; splits on paragraph boundaries when they don't.

import type { DocumentSection } from './doc-parser'

export interface Chunk {
  sectionKey:    string
  sectionLabel:  string
  chunkIdx:      number
  text:          string
  tokenEstimate: number
  importance:    'high' | 'medium' | 'low'
  filingType:    string
}

const MAX_TOKENS_INTACT    = 4_000
const MAX_TOKENS_PER_CHUNK = 4_000

function splitAtParagraphs(text: string, maxTokens: number): string[] {
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 0)
  const chunks: string[] = []
  let current = ''
  let currentTokens = 0

  for (const para of paragraphs) {
    const paraTokens = Math.ceil(para.length / 4)
    if (currentTokens + paraTokens > maxTokens && current) {
      chunks.push(current.trim())
      current = para
      currentTokens = paraTokens
    } else {
      current += (current ? '\n\n' : '') + para
      currentTokens += paraTokens
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

export function chunkSections(sections: DocumentSection[]): Chunk[] {
  const chunks: Chunk[] = []

  for (const section of sections) {
    if (section.tokenEstimate <= MAX_TOKENS_INTACT) {
      chunks.push({
        sectionKey:    section.sectionKey,
        sectionLabel:  section.sectionLabel,
        chunkIdx:      0,
        text:          section.text,
        tokenEstimate: section.tokenEstimate,
        importance:    section.importance,
        filingType:    section.filingType,
      })
      continue
    }

    const parts = splitAtParagraphs(section.text, MAX_TOKENS_PER_CHUNK)
    parts.forEach((part, i) => {
      chunks.push({
        sectionKey:    section.sectionKey,
        sectionLabel:  section.sectionLabel,
        chunkIdx:      i,
        text:          `${section.sectionLabel}:\n${part}`,
        tokenEstimate: Math.ceil(part.length / 4),
        importance:    section.importance,
        filingType:    section.filingType,
      })
    })
  }

  return chunks
}
