const TARGET_TOKENS = 500
const MAX_CHUNK_TOKENS = 1500
const OVERLAP_TOKENS = 75
const CHARS_PER_TOKEN = 4

interface Chunk {
  content: string
  chunkIndex: number
  tokenCount: number
}

export function chunkDocument(text: string, docType: string): Chunk[] {
  if (!text || text.trim().length === 0) return []

  if (docType === 'application/vnd.google-apps.presentation') {
    return chunkBySlides(text)
  }

  return chunkByParagraphs(text)
}

function chunkBySlides(text: string): Chunk[] {
  const slides = text.split(/\n{2,}/).filter(s => s.trim().length > 0)
  const chunks: Chunk[] = []
  let idx = 0

  for (const slide of slides) {
    if (estimateTokens(slide) > MAX_CHUNK_TOKENS) {
      for (const sub of splitAtSentenceBoundaries(slide)) {
        chunks.push({ content: sub.trim(), chunkIndex: idx++, tokenCount: estimateTokens(sub) })
      }
    } else {
      chunks.push({ content: slide.trim(), chunkIndex: idx++, tokenCount: estimateTokens(slide) })
    }
  }

  return chunks
}

function splitAtSentenceBoundaries(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text]
  const parts: string[] = []
  let current = ''

  for (const sentence of sentences) {
    const combined = current + sentence
    if (estimateTokens(combined) > MAX_CHUNK_TOKENS && current) {
      parts.push(current)
      current = sentence
    } else {
      current = combined
    }
  }
  if (current.trim()) parts.push(current)
  return parts
}

function chunkByParagraphs(text: string): Chunk[] {
  const rawParagraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 0)

  const paragraphs: string[] = []
  for (const p of rawParagraphs) {
    if (estimateTokens(p) > MAX_CHUNK_TOKENS) {
      paragraphs.push(...splitAtSentenceBoundaries(p))
    } else {
      paragraphs.push(p)
    }
  }

  const chunks: Chunk[] = []
  let current = ''
  let chunkIndex = 0

  for (const paragraph of paragraphs) {
    const combined = current ? `${current}\n\n${paragraph}` : paragraph
    const combinedTokens = estimateTokens(combined)

    if (combinedTokens > TARGET_TOKENS && current) {
      chunks.push({
        content: current.trim(),
        chunkIndex: chunkIndex++,
        tokenCount: estimateTokens(current),
      })

      const overlapText = getOverlapText(current)
      current = overlapText ? `${overlapText}\n\n${paragraph}` : paragraph
    } else {
      current = combined
    }
  }

  if (current.trim()) {
    chunks.push({
      content: current.trim(),
      chunkIndex: chunkIndex,
      tokenCount: estimateTokens(current),
    })
  }

  return chunks
}

function getOverlapText(text: string): string {
  const targetChars = OVERLAP_TOKENS * CHARS_PER_TOKEN
  if (text.length <= targetChars) return text

  // Take from the end, break at sentence boundary
  const tail = text.slice(-targetChars)
  const sentenceBreak = tail.indexOf('. ')
  if (sentenceBreak !== -1 && sentenceBreak < tail.length * 0.5) {
    return tail.slice(sentenceBreak + 2)
  }
  return tail
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}
