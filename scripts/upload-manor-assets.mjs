// Upload manor brand assets to Supabase Storage + insert metadata rows
// Usage: node scripts/upload-manor-assets.mjs
//
// Images are uploaded as-is (full resolution for download quality).
// Edit the ASSETS array below to set title + description before running.

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { extname, join, basename } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import * as dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env') })

const SUPABASE_URL          = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET                = 'manor-assets'
const SOURCE_DIR            = 'C:\\Users\\Ismar\\Downloads\\Untitled design'

// ── Edit these labels before running ────────────────────────────────────────
// Files are named 1.png → 6.png — update title/description for each.
const ASSET_META = {
  '1.png': { title: 'Rixey Manor Logo — Dark',     description: 'Full logo on dark background. Use for light-coloured invitations, programs, or websites.' },
  '2.png': { title: 'Rixey Manor Logo — Light',    description: 'Full logo on light background. Use for signage, stationery, or printed materials.' },
  '3.png': { title: 'Rixey Manor Sketch',          description: 'Pen & ink sketch of the manor. Great for save-the-dates, wedding websites, or programmes.' },
  '4.png': { title: 'Rixey Manor Crest',           description: 'Manor crest / icon mark. Use as a standalone graphic for menus, table numbers, or favours.' },
  '5.png': { title: 'Rixey Manor — Horizontal Logo', description: 'Wide format version of the logo. Ideal for website headers or banner prints.' },
  '6.png': { title: 'Rixey Manor — Monogram',      description: 'Monogram / minimal mark. Perfect for wax seals, embossing, or subtle branding.' },
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets()
  const exists = buckets?.some(b => b.name === BUCKET)
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true })
    if (error) throw error
    console.log(`✓ Created bucket "${BUCKET}"`)
  } else {
    console.log(`✓ Bucket "${BUCKET}" already exists`)
  }
}

async function uploadFile(fileName) {
  const filePath   = join(SOURCE_DIR, fileName)
  const fileBuffer = readFileSync(filePath)
  const storagePath = fileName  // e.g. "1.png"
  const meta = ASSET_META[fileName] || { title: fileName, description: '' }

  // Upload to storage
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, { contentType: 'image/png', upsert: true })
  if (upErr) throw upErr

  // Get public URL
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

  // Upsert metadata row
  const { error: dbErr } = await supabase
    .from('manor_assets')
    .upsert({
      title:        meta.title,
      description:  meta.description,
      storage_path: storagePath,
      file_name:    fileName,
      mime_type:    'image/png',
      sort_order:   parseInt(fileName) || 0,
    }, { onConflict: 'storage_path' })
  if (dbErr) throw dbErr

  console.log(`✓ ${fileName} → ${meta.title}`)
  console.log(`  ${publicUrl}`)
}

async function run() {
  console.log('Uploading manor assets…\n')
  await ensureBucket()

  const files = readdirSync(SOURCE_DIR).filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp'))
  for (const file of files.sort()) {
    await uploadFile(file)
  }
  console.log('\nDone! Run the SQL migration (add_manor_assets.sql) in Supabase first if you haven\'t already.')
}

run().catch(err => { console.error(err); process.exit(1) })
