export function normalize(text: string, docType: string): string {
  let cleaned = text

  // Remove null bytes and control characters (except newlines/tabs)
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // Normalize line endings
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Collapse 3+ consecutive newlines into 2
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')

  // Remove leading/trailing whitespace per line
  cleaned = cleaned
    .split('\n')
    .map(line => line.trim())
    .join('\n')

  // CSV (from Google Sheets): convert to readable rows
  if (docType === 'application/vnd.google-apps.spreadsheet') {
    cleaned = normalizeCSV(cleaned)
  }

  // Collapse multiple spaces into one
  cleaned = cleaned.replace(/ {2,}/g, ' ')

  return cleaned.trim()
}

function normalizeCSV(csv: string): string {
  const lines = csv.split('\n').filter(line => line.trim())
  if (lines.length === 0) return ''

  const headers = lines[0].split(',').map(h => h.trim())
  const rows = lines.slice(1)

  return rows
    .map(row => {
      const values = row.split(',').map(v => v.trim())
      return headers
        .map((header, i) => `${header}: ${values[i] || ''}`)
        .join(' | ')
    })
    .join('\n')
}
