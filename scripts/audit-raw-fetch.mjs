/**
 * Counts raw fetch(\`${API_URL}...\`) calls in src/, which bypass apiFetch.
 * Target: 0. Agent C1/A1 are reducing the count in parallel.
 *
 *   node scripts/audit-raw-fetch.mjs --max 149
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, dirname, join, sep } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcRoot = join(root, 'src')
const maxIdx = process.argv.indexOf('--max')
const MAX = maxIdx > -1 ? Number(process.argv[maxIdx + 1]) : Infinity

const SKIP = new Set(['node_modules', '.git', 'dist', 'backups'])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      walk(path, out)
    } else if (/\.(jsx?|mjs)$/.test(name)) {
      out.push(path)
    }
  }
  return out
}

const files = walk(srcRoot)
const results = new Map()
let total = 0

const pattern = /fetch\(\`\$\{API_URL\}/g

for (const file of files) {
  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')
  const matches = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineMatches = [...line.matchAll(pattern)]
    if (lineMatches.length > 0) {
      matches.push({ line: i + 1, count: lineMatches.length })
      total += lineMatches.length
    }
  }

  if (matches.length > 0) {
    results.set(file, matches)
  }
}

for (const [file, matches] of results) {
  const count = matches.reduce((sum, m) => sum + m.count, 0)
  console.log(`${file}: ${count}`)
}

console.log(`\nTotal: ${total}`)

if (total > MAX) {
  process.exit(1)
}
