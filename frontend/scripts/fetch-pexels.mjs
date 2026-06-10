#!/usr/bin/env node
// Fetch curated Pexels photos into public/img/ and record attribution.
// Usage: node scripts/fetch-pexels.mjs [--force]
// Reads PEXELS_API_KEY from frontend/.env (gitignored); no dotenv needed.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const force = process.argv.includes('--force')

const SLOTS = [
  {
    file: 'hero.jpg',
    query: 'nurse senior woman sofa home smiling talking',
  },
  { file: 'journey-heart.jpg', query: 'senior man walking park exercise heart health' },
  { file: 'journey-knee.jpg', query: 'knee physiotherapy rehabilitation exercise' },
  { file: 'journey-diabetes.jpg', query: 'blood glucose meter diabetes monitoring' },
  { file: 'journey-copd.jpg', query: 'elderly person breathing exercise calm outdoors' },
]

function apiKey() {
  const env = readFileSync(join(root, '.env'), 'utf8')
  const line = env.split('\n').find((l) => l.startsWith('PEXELS_API_KEY='))
  if (!line) throw new Error('PEXELS_API_KEY not found in frontend/.env')
  return line.slice('PEXELS_API_KEY='.length).trim()
}

const key = apiKey()
const outDir = join(root, 'public', 'img')
mkdirSync(outDir, { recursive: true })
const creditsPath = join(outDir, 'pexels-credits.json')
const credits = existsSync(creditsPath) ? JSON.parse(readFileSync(creditsPath, 'utf8')) : {}

for (const slot of SLOTS) {
  const dest = join(outDir, slot.file)
  if (existsSync(dest) && !force) {
    console.log(`skip ${slot.file} (exists; use --force to refresh)`)
    continue
  }
  const url = new URL('https://api.pexels.com/v1/search')
  url.searchParams.set('query', slot.query)
  url.searchParams.set('orientation', 'landscape')
  url.searchParams.set('per_page', '5')
  const res = await fetch(url, { headers: { Authorization: key } })
  if (!res.ok) throw new Error(`Pexels search failed for "${slot.query}": HTTP ${res.status}`)
  const data = await res.json()
  const photo = data.photos?.[0]
  if (!photo) throw new Error(`No results for "${slot.query}"`)
  const src = photo.src.large2x ?? photo.src.large
  const img = await fetch(src)
  if (!img.ok) throw new Error(`Download failed for ${slot.file}: HTTP ${img.status}`)
  writeFileSync(dest, Buffer.from(await img.arrayBuffer()))
  credits[slot.file] = {
    photographer: photo.photographer,
    photographer_url: photo.photographer_url,
    pexels_url: photo.url,
  }
  console.log(`saved ${slot.file} <- ${photo.url}`)
}

writeFileSync(creditsPath, JSON.stringify(credits, null, 2) + '\n')
console.log('wrote pexels-credits.json')
