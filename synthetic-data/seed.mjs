/**
 * Synthetic Data Ingestion Script
 *
 * Inserts Orion company documents into Supabase, then uses the existing
 * pipeline endpoints to chunk and embed them.
 *
 * Usage: node synthetic-data/seed.mjs
 * Requires: .env.local with Supabase and OpenAI keys, dev server running on port 3000
 */

import { readFileSync } from 'fs'
import { config } from 'dotenv'
import { createHash } from 'crypto'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP_URL = 'http://localhost:3000'

function supabaseHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }
}

async function supabaseRest(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`
  const res = await fetch(url, {
    headers: supabaseHeaders(),
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase ${options.method || 'GET'} ${path} failed: ${res.status} ${text}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function ensureSyntheticUser() {
  const email = 'synthetic@orion.dev'

  const existing = await supabaseRest(`users?email=eq.${email}&select=id`)
  if (existing && existing.length > 0) {
    console.log(`  User exists: ${existing[0].id}`)
    return existing[0].id
  }

  const [created] = await supabaseRest('users', {
    method: 'POST',
    body: JSON.stringify({ email, name: 'Orion PM (Synthetic)' }),
  })
  console.log(`  User created: ${created.id}`)
  return created.id
}

async function ensureSyntheticConnection(userId, sourceType) {
  const existing = await supabaseRest(
    `connection?user_id=eq.${userId}&source_type=eq.${sourceType}&select=id`
  )
  if (existing && existing.length > 0) {
    console.log(`  Connection exists (${sourceType}): ${existing[0].id}`)
    return existing[0].id
  }

  const [created] = await supabaseRest('connection', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      source_type: sourceType,
      oauth_token: 'synthetic-token',
      refresh_token: 'synthetic-refresh',
      status: 'active',
    }),
  })
  console.log(`  Connection created (${sourceType}): ${created.id}`)
  return created.id
}

async function clearExistingSyntheticDocs(connectionId) {
  const existing = await supabaseRest(
    `document?connection_id=eq.${connectionId}&select=id`
  )
  if (existing && existing.length > 0) {
    console.log(`  Clearing ${existing.length} existing synthetic documents...`)
    await supabaseRest(`document?connection_id=eq.${connectionId}`, {
      method: 'DELETE',
    })
  }
}

async function insertDocuments(connectionId, documents) {
  let inserted = 0
  for (const doc of documents) {
    const contentHash = createHash('sha256').update(doc.content).digest('base64').slice(0, 32)

    try {
      await supabaseRest('document', {
        method: 'POST',
        body: JSON.stringify({
          connection_id: connectionId,
          source_type: doc.source_type,
          source_id: doc.id,
          source_url: doc.source_url,
          title: doc.title,
          content: doc.content,
          author: doc.author,
          doc_type: doc.doc_type,
          content_hash: contentHash,
        }),
      })
      inserted++
      process.stdout.write(`  Inserted ${inserted}/${documents.length}: ${doc.title}\n`)
    } catch (err) {
      console.error(`  FAILED: ${doc.title} — ${err.message}`)
    }
  }
  return inserted
}

async function runPipelineStep(endpoint, connectionId, stepName) {
  console.log(`\n${stepName}...`)
  const res = await fetch(`${APP_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectionId }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${stepName} failed: ${res.status} ${text}`)
  }

  const result = await res.json()
  console.log(`  Result:`, JSON.stringify(result))
  return result
}

async function main() {
  console.log('=== Synthetic Data Ingestion ===\n')

  console.log('1. Loading documents...')
  const documents = JSON.parse(
    readFileSync(new URL('./documents.json', import.meta.url), 'utf-8')
  )
  console.log(`  Loaded ${documents.length} documents`)

  console.log('\n2. Ensuring synthetic user...')
  const userId = await ensureSyntheticUser()

  const sourceTypes = [...new Set(documents.map(d => d.source_type))]
  console.log(`  Source types found: ${sourceTypes.join(', ')}`)

  const connectionIds = {}
  for (const sourceType of sourceTypes) {
    console.log(`\n3. Ensuring synthetic connection (${sourceType})...`)
    connectionIds[sourceType] = await ensureSyntheticConnection(userId, sourceType)
  }

  for (const sourceType of sourceTypes) {
    const connId = connectionIds[sourceType]
    console.log(`\n4. Clearing existing synthetic data (${sourceType})...`)
    await clearExistingSyntheticDocs(connId)
  }

  console.log('\n5. Inserting documents...')
  let totalInserted = 0
  for (const sourceType of sourceTypes) {
    const connId = connectionIds[sourceType]
    const typeDocs = documents.filter(d => d.source_type === sourceType)
    console.log(`  Inserting ${typeDocs.length} ${sourceType} documents...`)
    const inserted = await insertDocuments(connId, typeDocs)
    totalInserted += inserted
  }
  console.log(`  Total inserted: ${totalInserted}/${documents.length}`)

  let totalChunks = 0
  let totalEmbeddings = 0
  for (const sourceType of sourceTypes) {
    const connId = connectionIds[sourceType]
    const chunkResult = await runPipelineStep('/api/pipeline/chunk', connId, `6. Chunking (${sourceType})`)
    totalChunks += chunkResult.totalChunks || 0
    const embedResult = await runPipelineStep('/api/pipeline/embed', connId, `7. Embedding (${sourceType})`)
    totalEmbeddings += embedResult.embedded || 0
  }

  console.log('\n=== DONE ===')
  console.log(`Documents: ${totalInserted}`)
  console.log(`Chunks: ${totalChunks}`)
  console.log(`Embeddings: ${totalEmbeddings}`)

  process.exit(0)
}

main().catch(err => {
  console.error('\nFATAL:', err.message)
  process.exit(1)
})
