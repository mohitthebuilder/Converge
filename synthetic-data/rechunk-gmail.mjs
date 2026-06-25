/**
 * Rechunk oversized Gmail chunks with MAX_CHUNK_TOKENS enforcement.
 *
 * TARGETED approach: only deletes chunks that failed embedding (embedding IS NULL),
 * finds their parent documents, re-chunks only those docs, and re-embeds.
 * Does NOT touch already-embedded chunks.
 *
 * Usage: node synthetic-data/rechunk-gmail.mjs
 * Requires: .env.local, dev server running on port 3000
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP_URL = 'http://localhost:3000'

function headers() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }
}

async function rest(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: headers(), ...options })
  if (!res.ok) throw new Error(`${options.method || 'GET'} ${path}: ${res.status} ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function main() {
  const connections = await rest('connection?source_type=eq.gmail&select=id')
  if (!connections.length) { console.log('No Gmail connections.'); return }
  const connIds = connections.map(c => c.id)
  console.log(`Gmail connections: ${connIds.length}`)

  for (const connId of connIds) {
    console.log(`\nConnection ${connId}:`)

    // Find chunks without embeddings for this connection's docs
    const docs = await rest(`document?connection_id=eq.${connId}&select=id`)
    if (!docs.length) { console.log('  No docs'); continue }

    const docIds = docs.map(d => d.id)
    const BATCH = 20
    const failedDocIds = new Set()

    for (let i = 0; i < docIds.length; i += BATCH) {
      const batch = docIds.slice(i, i + BATCH)
      try {
        const unembedded = await rest(`chunk?document_id=in.(${batch.join(',')})&embedding=is.null&select=document_id`)
        if (unembedded) {
          for (const c of unembedded) failedDocIds.add(c.document_id)
        }
      } catch { /* no chunks for these docs */ }
    }

    if (failedDocIds.size === 0) {
      console.log('  All chunks embedded — nothing to do')
      continue
    }

    console.log(`  ${failedDocIds.size} docs have un-embedded chunks`)

    // Delete ONLY the un-embedded chunks for those docs
    const failedIds = [...failedDocIds]
    let deleted = 0
    for (let i = 0; i < failedIds.length; i += BATCH) {
      const batch = failedIds.slice(i, i + BATCH)
      try {
        await rest(`chunk?document_id=in.(${batch.join(',')})&embedding=is.null`, { method: 'DELETE' })
      } catch { /* fine */ }
      deleted += batch.length
    }
    console.log(`  Deleted un-embedded chunks for ${deleted} docs`)

    // Re-chunk those docs via API
    console.log('  Re-chunking...')
    const chunkRes = await fetch(`${APP_URL}/api/pipeline/chunk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: connId }),
    })
    const chunkResult = await chunkRes.json()
    console.log(`  Chunked: ${chunkResult.processedDocs} docs → ${chunkResult.totalChunks} new chunks`)

    // Embed in pages (paginated endpoint handles 200 at a time)
    let totalEmbedded = 0
    let hasMore = true
    while (hasMore) {
      console.log(`  Embedding page (${totalEmbedded} done so far)...`)
      const embedRes = await fetch(`${APP_URL}/api/pipeline/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: connId }),
      })
      const result = await embedRes.json()
      totalEmbedded += result.embedded
      hasMore = result.remaining && result.remaining !== 0
    }
    console.log(`  Total embedded: ${totalEmbedded}`)
  }

  console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })
