/**
 * Test Query Runner
 *
 * Runs all 20 test queries against the live pipeline and captures results
 * for comparison against ground truth.
 *
 * Usage: node synthetic-data/test-queries.mjs
 * Requires: dev server running on port 3000, synthetic data seeded
 */

import { readFileSync, writeFileSync } from 'fs'

const APP_URL = 'http://localhost:3000'

async function runQuery(query) {
  const res = await fetch(`${APP_URL}/api/query/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })

  if (!res.ok) {
    return { error: `HTTP ${res.status}`, sources: [], answer: '', latencyMs: 0 }
  }

  const text = await res.text()
  const events = text
    .split('\n\n')
    .filter(e => e.startsWith('data: '))
    .map(e => {
      try { return JSON.parse(e.slice(6)) }
      catch { return null }
    })
    .filter(Boolean)

  const sourcesEvent = events.find(e => e.type === 'sources')
  const textEvents = events.filter(e => e.type === 'text')
  const doneEvent = events.find(e => e.type === 'done')

  return {
    sources: sourcesEvent?.sources || [],
    answer: textEvents.map(e => e.content).join(''),
    latencyMs: doneEvent?.latencyMs || 0,
  }
}

async function main() {
  console.log('=== Test Query Runner ===\n')

  const queriesFile = JSON.parse(
    readFileSync(new URL('./queries.json', import.meta.url), 'utf-8')
  )

  const results = []

  for (const q of queriesFile.queries) {
    process.stdout.write(`[${q.id}] ${q.query.slice(0, 60)}...`)

    const start = Date.now()
    const result = await runQuery(q.query)
    const wallMs = Date.now() - start

    const sourcesTitles = result.sources.map(s => s.title)

    results.push({
      id: q.id,
      query: q.query,
      level: q.level,
      persona: q.persona,
      expected_sources: q.expected_sources,
      actual_sources: sourcesTitles,
      ground_truth: q.ground_truth,
      actual_answer: result.answer,
      latency_ms: result.latencyMs,
      wall_ms: wallMs,
      source_count: result.sources.length,
    })

    console.log(` ${wallMs}ms | ${result.sources.length} sources | ${result.answer.length} chars`)
  }

  // Write results
  const outPath = new URL('./test-results.json', import.meta.url)
  writeFileSync(outPath, JSON.stringify(results, null, 2))
  console.log(`\nResults written to synthetic-data/test-results.json`)

  // Print summary
  console.log('\n=== SUMMARY ===\n')
  for (const r of results) {
    console.log(`--- ${r.id} (${r.level}) ---`)
    console.log(`Query: ${r.query}`)
    console.log(`Sources: ${r.actual_sources.join(', ') || 'NONE'}`)
    console.log(`Answer (first 300 chars): ${r.actual_answer.slice(0, 300)}`)
    console.log(`Latency: ${r.latency_ms}ms (wall: ${r.wall_ms}ms)`)
    console.log('')
  }

  process.exit(0)
}

main().catch(err => {
  console.error('FATAL:', err.message)
  process.exit(1)
})
