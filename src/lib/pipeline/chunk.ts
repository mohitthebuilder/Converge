const TARGET_TOKENS = 500
const MAX_CHUNK_TOKENS = 600
const OVERLAP_TOKENS = 75
const CHARS_PER_TOKEN = 3
const MAX_CHUNK_CHARS = 1800

export interface TableMeta {
  is_table: true
  table_title: string | null
  row_range: string
  total_rows: number
  columns: string[]
}

export interface Chunk {
  content: string
  chunkIndex: number
  tokenCount: number
  tableMeta?: TableMeta
}

export function chunkDocument(text: string, docType: string): Chunk[] {
  if (!text || text.trim().length === 0) return []

  if (docType === 'application/vnd.google-apps.presentation') {
    return chunkBySlides(text)
  }

  if (docType === 'application/vnd.google-apps.spreadsheet') {
    return chunkSpreadsheet(text)
  }

  return chunkWithTableDetection(text)
}

// ── Markdown table detection ──

interface TableSegment { type: 'table'; title: string | null; headers: string[]; rows: string[] }
interface ProseSegment { type: 'prose'; content: string }
type Segment = TableSegment | ProseSegment

function isTableRow(line: string): boolean {
  const t = line.trim()
  return t.startsWith('|') && t.endsWith('|') && t.length > 2
}

function isSeparatorRow(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim())
}

function parseTableCells(row: string): string[] {
  return row.split('|').slice(1, -1).map(c => c.trim())
}

function extractSegments(text: string): Segment[] {
  const lines = text.split('\n')
  const segments: Segment[] = []
  let proseLines: string[] = []
  let i = 0

  while (i < lines.length) {
    if (isTableRow(lines[i]) && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      let title: string | null = null
      for (let j = proseLines.length - 1; j >= 0; j--) {
        const candidate = proseLines[j].trim()
        if (candidate) {
          if (candidate.startsWith('#') || (candidate.length < 120 && j === proseLines.length - 1)) {
            title = candidate.replace(/^#+\s*/, '')
            proseLines.pop()
          }
          break
        }
      }

      if (proseLines.length > 0) {
        const content = proseLines.join('\n').trim()
        if (content) segments.push({ type: 'prose', content })
        proseLines = []
      }

      const headers = parseTableCells(lines[i])
      i += 2

      const rows: string[] = []
      while (i < lines.length && isTableRow(lines[i]) && !isSeparatorRow(lines[i])) {
        rows.push(parseTableCells(lines[i]).join(' | '))
        i++
      }

      if (rows.length > 0) {
        segments.push({ type: 'table', title, headers, rows })
      }
    } else {
      proseLines.push(lines[i])
      i++
    }
  }

  if (proseLines.length > 0) {
    const content = proseLines.join('\n').trim()
    if (content) segments.push({ type: 'prose', content })
  }

  return segments
}

// ── Table chunking (core logic) ──

function formatTableContent(
  title: string | null, headers: string[], rows: string[],
  startRow: number, endRow: number, totalRows: number
): string {
  const titleLine = title
    ? `Table: ${title} (rows ${startRow}-${endRow} of ${totalRows})`
    : `Table (rows ${startRow}-${endRow} of ${totalRows})`
  const headerLine = `Columns: ${headers.join(' | ')}`
  return `${titleLine}\n${headerLine}\n${rows.join('\n')}`
}

function chunkTableRows(headers: string[], rows: string[], title: string | null): Chunk[] {
  const totalRows = rows.length
  if (totalRows === 0) return []

  const fullContent = formatTableContent(title, headers, rows, 1, totalRows, totalRows)
  if (estimateTokens(fullContent) <= MAX_CHUNK_TOKENS) {
    return [{
      content: fullContent,
      chunkIndex: 0,
      tokenCount: estimateTokens(fullContent),
      tableMeta: { is_table: true, table_title: title, row_range: `1-${totalRows}`, total_rows: totalRows, columns: headers },
    }]
  }

  const chunks: Chunk[] = []
  let currentRows: string[] = []
  let startRow = 1

  for (let i = 0; i < rows.length; i++) {
    const testRows = [...currentRows, rows[i]]
    const testContent = formatTableContent(title, headers, testRows, startRow, startRow + testRows.length - 1, totalRows)

    if (estimateTokens(testContent) > MAX_CHUNK_TOKENS && currentRows.length > 0) {
      const content = formatTableContent(title, headers, currentRows, startRow, startRow + currentRows.length - 1, totalRows)
      const range = `${startRow}-${startRow + currentRows.length - 1}`
      chunks.push({
        content,
        chunkIndex: chunks.length,
        tokenCount: estimateTokens(content),
        tableMeta: { is_table: true, table_title: title, row_range: range, total_rows: totalRows, columns: headers },
      })
      startRow += currentRows.length
      currentRows = [rows[i]]
    } else {
      // Rule 4: single row exceeding limit stays as its own chunk (relaxed limit)
      currentRows.push(rows[i])
    }
  }

  if (currentRows.length > 0) {
    const content = formatTableContent(title, headers, currentRows, startRow, startRow + currentRows.length - 1, totalRows)
    const range = `${startRow}-${startRow + currentRows.length - 1}`
    chunks.push({
      content,
      chunkIndex: chunks.length,
      tokenCount: estimateTokens(content),
      tableMeta: { is_table: true, table_title: title, row_range: range, total_rows: totalRows, columns: headers },
    })
  }

  return chunks
}

// ── Spreadsheet (entire content is a table) ──

function chunkSpreadsheet(text: string): Chunk[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length === 0) return []

  const headers: string[] = []
  const cells = lines[0].split(' | ')
  for (const cell of cells) {
    const colonIdx = cell.indexOf(': ')
    if (colonIdx > 0) headers.push(cell.substring(0, colonIdx))
  }

  if (headers.length === 0) return chunkByParagraphs(text)

  return chunkTableRows(headers, lines, null)
}

// ── Mixed content: detect tables, chunk prose separately ──

function chunkWithTableDetection(text: string): Chunk[] {
  const segments = extractSegments(text)

  if (segments.every(s => s.type === 'prose')) {
    return chunkByParagraphs(text)
  }

  const chunks: Chunk[] = []
  let idx = 0

  for (const segment of segments) {
    if (segment.type === 'table') {
      for (const tc of chunkTableRows(segment.headers, segment.rows, segment.title)) {
        tc.chunkIndex = idx++
        chunks.push(tc)
      }
    } else {
      for (const pc of chunkByParagraphs(segment.content)) {
        pc.chunkIndex = idx++
        chunks.push(pc)
      }
    }
  }

  return chunks
}

// ── Slides chunking (unchanged) ──

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

// ── Paragraph chunking (unchanged) ──

function splitAtSentenceBoundaries(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text]
  const parts: string[] = []
  let current = ''

  for (const sentence of sentences) {
    const combined = current + sentence
    if ((estimateTokens(combined) > MAX_CHUNK_TOKENS || combined.length > MAX_CHUNK_CHARS) && current) {
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
