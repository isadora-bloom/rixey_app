import { readFileSync } from 'fs'
import process from 'process'

const args = process.argv.slice(2)
const maxIdx = args.indexOf('--max')
const max = maxIdx !== -1 ? parseInt(args[maxIdx + 1], 10) : Infinity

// Tables that should always be paginated or limited
const bigTables = [
  'usage_logs',
  'messages',
  'direct_messages',
  'planning_notes',
  'ingest_review',
  'processed_emails',
  'processed_quo_messages',
  'processed_zoom_meetings',
  'wedding_guests',
  'activity_log',
  'notifications',
  'contact_messages',
]

const content = readFileSync('server/index.js', 'utf8')
const lines = content.split('\n')

const results = []

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]

  // Look for .from() calls with any of the big tables
  for (const table of bigTables) {
    const fromPattern = `from('${table}')`
    if (line.includes(fromPattern)) {
      // Collect the next 12 lines as context to check for pagination/limit methods
      const context = lines.slice(i, Math.min(i + 12, lines.length)).join('\n')

      // Check if the query chain contains select() but no pagination methods
      const hasSelect = /\.select\(/.test(context)
      const hasRange = /\.range\(/.test(context)
      const hasLimit = /\.limit\(/.test(context)
      const hasSingle = /\.single\(/.test(context)
      const hasMaybeSingle = /\.maybeSingle\(/.test(context)

      // If it has select() but no pagination, flag it
      if (hasSelect && !hasRange && !hasLimit && !hasSingle && !hasMaybeSingle) {
        // Check if the context ends (at a terminator: ; or await)
        const terminatorIdx = context.search(/[;]\s*$|await\s/)
        const queryChain = terminatorIdx !== -1 ? context.substring(0, terminatorIdx) : context.substring(0, 200)

        results.push({
          file: 'server/index.js',
          line: i + 1,
          table,
          query: queryChain.substring(0, 80),
        })
      }
    }
  }
}

for (const result of results) {
  console.log(`${result.file}:${result.line} .from('${result.table}')`)
}

console.log(`\nTotal: ${results.length}`)

if (results.length > max) {
  process.exit(1)
}
