const TARGET_TOKENS = 500
const OVERLAP_TOKENS = 75
const CHARS_PER_TOKEN = 4

interface Chunk {
  content: string
  chunkIndex: number
  tokenCount: number
}

export function chunkDocument(text: string, docType: string): Chunk[] {
  if (!text || text.trim().length === 0) return []

  // Slides: each slide is a natural chunk
  if (docType === 'application/vnd.google-apps.presentation') {
    return chunkBySlides(text)
  }

  // Everything else: paragraph-aware chunking
  return chunkByParagraphs(text)
}

function chunkBySlides(text: string): Chunk[] {
  const slides = text.split(/\n{2,}/).filter(s => s.trim().length > 0)

  return slides.map((slide, i) => ({
    content: slide.trim(),
    chunkIndex: i,
    tokenCount: estimateTokens(slide),
  }))
}

function chunkByParagraphs(text: string): Chunk[] {
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 0)
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

      // Start new chunk with overlap from end of previous
      const overlapText = getOverlapText(current)
      current = overlapText ? `${overlapText}\n\n${paragraph}` : paragraph
    } else {
      current = combined
    }
  }

  // Don't forget the last chunk
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
