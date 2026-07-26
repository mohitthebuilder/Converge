import { createHash } from 'crypto'
import { supabaseServer } from '@/lib/db/supabase-server'

export interface ExistingDoc {
  contentHash: string | null
  documentDate: string | null
}

export interface DocumentRow {
  connection_id: string
  source_type: string
  source_id: string
  source_url: string
  title: string
  content: string
  author: string | null
  doc_type: string
  content_hash: string
  document_date: string
}

// Real content hash (previous scheme was base64-prefix of first 24 bytes —
// edits past byte 24 were never detected). Same 32-char column width.
export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 32)
}

// One paginated query replaces N sequential per-item lookups during sync.
// Throws on DB error — a partial map would silently re-sync everything.
export async function fetchExistingDocs(connectionId: string): Promise<Map<string, ExistingDoc>> {
  const map = new Map<string, ExistingDoc>()
  const PAGE = 1000
  let from = 0

  while (true) {
    const { data, error } = await supabaseServer
      .from('document')
      .select('source_id, content_hash, document_date')
      .eq('connection_id', connectionId)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)

    if (error) throw new Error(`fetchExistingDocs failed: ${error.message}`)
    if (!data || data.length === 0) break

    for (const row of data) {
      map.set(row.source_id, { contentHash: row.content_hash, documentDate: row.document_date })
    }
    if (data.length < PAGE) break
    from += PAGE
  }

  return map
}

const MAX_BATCH_ROWS = 100
const MAX_BATCH_BYTES = 5 * 1024 * 1024 // stay well under REST payload limits with large documents

export async function batchUpsertDocuments(rows: DocumentRow[]): Promise<void> {
  let batch: DocumentRow[] = []
  let batchBytes = 0

  async function flush() {
    if (batch.length === 0) return
    let { error } = await supabaseServer
      .from('document')
      .upsert(batch, { onConflict: 'connection_id,source_id' })
    if (error) {
      // One retry for transient failures, then log loudly — visible in Vercel logs
      ;({ error } = await supabaseServer
        .from('document')
        .upsert(batch, { onConflict: 'connection_id,source_id' }))
      if (error) console.error(`[SYNC] batch upsert failed (${batch.length} rows lost): ${error.message}`)
    }
    batch = []
    batchBytes = 0
  }

  for (const row of rows) {
    const rowBytes = row.content.length
    if (batch.length >= MAX_BATCH_ROWS || (batchBytes + rowBytes > MAX_BATCH_BYTES && batch.length > 0)) {
      await flush()
    }
    batch.push(row)
    batchBytes += rowBytes
  }
  await flush()
}

export async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      await fn(items[i])
    }
  })
  await Promise.all(workers)
}
