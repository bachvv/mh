import express from 'express'
import crypto from 'crypto'
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import { config } from 'dotenv'
import { Resend } from 'resend'
import Database from 'better-sqlite3'

// Load env
config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env') })

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 4400

app.use(express.json({ limit: '50mb' }))

// Access logging
const ACCESS_LOG_FILE = join(__dirname, 'data', 'access-log.json')

function loadAccessLog() {
  try {
    if (existsSync(ACCESS_LOG_FILE)) return JSON.parse(readFileSync(ACCESS_LOG_FILE, 'utf8'))
  } catch {}
  return []
}

function saveAccessLog(log) {
  writeFileSync(ACCESS_LOG_FILE, JSON.stringify(log, null, 2))
}

// Log page views (skip API/static requests)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/assets/') || req.path.startsWith('/images/') || req.path.includes('.')) {
    return next()
  }
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip
  const log = loadAccessLog()
  log.push({
    ip,
    path: req.path,
    ua: req.headers['user-agent'] || '',
    ts: new Date().toISOString(),
  })
  // Keep last 10000 entries
  if (log.length > 10000) log.splice(0, log.length - 10000)
  saveAccessLog(log)
  next()
})

// === Carat Club (SQLite) ===
const ccDb = new Database(join(__dirname, 'data', 'carat-club.db'))
ccDb.pragma('journal_mode = WAL')
ccDb.exec(`
  CREATE TABLE IF NOT EXISTS managers (store TEXT PRIMARY KEY, email TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sps (store TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY(store, name));
  CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY, sp TEXT NOT NULL, store TEXT NOT NULL,
    day TEXT NOT NULL, sku TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`)

// Store managers
app.get('/api/carat-club/managers', (req, res) => {
  const rows = ccDb.prepare('SELECT store, email FROM managers').all()
  const managers = {}
  for (const r of rows) managers[r.store] = r.email
  res.json({ managers })
})

app.post('/api/carat-club/managers', (req, res) => {
  const { store, email } = req.body
  if (!store || !email) return res.status(400).json({ error: 'store, email required' })
  ccDb.prepare('INSERT OR REPLACE INTO managers (store, email) VALUES (?, ?)').run(store, email.trim().toLowerCase())
  res.json({ ok: true })
})

app.delete('/api/carat-club/managers', (req, res) => {
  const { store } = req.body
  if (!store) return res.status(400).json({ error: 'store required' })
  ccDb.prepare('DELETE FROM managers WHERE store = ?').run(store)
  res.json({ ok: true })
})

// SP list per store
app.get('/api/carat-club/sps', (req, res) => {
  const store = (req.query.store || '').trim()
  const rows = ccDb.prepare('SELECT name FROM sps WHERE store = ? ORDER BY name').all(store)
  res.json({ sps: rows.map(r => r.name) })
})

app.post('/api/carat-club/sps', (req, res) => {
  const { store, name } = req.body
  if (!store || !name) return res.status(400).json({ error: 'store, name required' })
  ccDb.prepare('INSERT OR IGNORE INTO sps (store, name) VALUES (?, ?)').run(store, name.trim())
  res.json({ ok: true })
})

app.delete('/api/carat-club/sps', (req, res) => {
  const { store, name } = req.body
  if (!store || !name) return res.status(400).json({ error: 'store, name required' })
  ccDb.prepare('DELETE FROM sps WHERE store = ? AND name = ?').run(store, name)
  res.json({ ok: true })
})

// Entries
app.get('/api/carat-club', (req, res) => {
  const sp = (req.query.sp || '').trim()
  const store = (req.query.store || '').trim()
  if (!sp) return res.json({ entries: [] })
  const rows = ccDb.prepare('SELECT id, sp, store, day, sku, created_at as ts FROM entries WHERE LOWER(sp) = LOWER(?) AND store = ? ORDER BY created_at').all(sp, store)
  res.json({ entries: rows })
})

app.post('/api/carat-club', (req, res) => {
  const { sp, day, sku, store } = req.body
  if (!sp || !day || !sku) return res.status(400).json({ error: 'sp, day, sku required' })
  const id = crypto.randomUUID()
  ccDb.prepare('INSERT INTO entries (id, sp, store, day, sku) VALUES (?, ?, ?, ?, ?)').run(id, sp.trim(), store || '104', day, sku)
  res.json({ ok: true })
})

app.put('/api/carat-club/:id', (req, res) => {
  const { sku, day } = req.body
  const sets = []
  const params = []
  if (sku !== undefined) { sets.push('sku = ?'); params.push(sku) }
  if (day !== undefined) { sets.push('day = ?'); params.push(day) }
  if (sets.length === 0) return res.json({ ok: true })
  params.push(req.params.id)
  const result = ccDb.prepare(`UPDATE entries SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  if (result.changes === 0) return res.status(404).json({ error: 'not found' })
  res.json({ ok: true })
})

app.delete('/api/carat-club/all', (req, res) => {
  const sp = (req.query.sp || '').trim()
  const store = (req.query.store || '').trim()
  if (!sp) return res.status(400).json({ error: 'sp required' })
  ccDb.prepare('DELETE FROM entries WHERE LOWER(sp) = LOWER(?) AND store = ?').run(sp, store)
  res.json({ ok: true })
})

app.delete('/api/carat-club/:id', (req, res) => {
  const result = ccDb.prepare('DELETE FROM entries WHERE id = ?').run(req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'not found' })
  res.json({ ok: true })
})

const STYLES_DIR = join(__dirname, 'public', 'images', 'styles')
const DIST_STYLES_DIR = join(__dirname, 'dist', 'images', 'styles')

// Ensure styles directories exist
if (!existsSync(STYLES_DIR)) mkdirSync(STYLES_DIR, { recursive: true })
if (!existsSync(DIST_STYLES_DIR)) mkdirSync(DIST_STYLES_DIR, { recursive: true })

// Write to both public and dist
function writeStyleFile(filename, data) {
  writeFileSync(join(STYLES_DIR, filename), data)
  writeFileSync(join(DIST_STYLES_DIR, filename), data)
}

function deleteStyleFile(filename) {
  const pub = join(STYLES_DIR, filename)
  const dist = join(DIST_STYLES_DIR, filename)
  if (existsSync(pub)) unlinkSync(pub)
  if (existsSync(dist)) unlinkSync(dist)
}

// Temp: upload page/screenshot for inspection
app.post('/api/upload-html', (req, res) => {
  const { html, type } = req.body
  if (!html) return res.status(400).json({ error: 'content required' })
  if (type === 'image') {
    // Save base64 image
    const match = html.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!match) return res.status(400).json({ error: 'Invalid image data' })
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1]
    const filepath = join(__dirname, `uploaded-page.${ext}`)
    writeFileSync(filepath, Buffer.from(match[2], 'base64'))
    res.json({ ok: true, size: match[2].length, file: `uploaded-page.${ext}` })
  } else {
    const filepath = join(__dirname, 'uploaded-page.html')
    writeFileSync(filepath, html)
    res.json({ ok: true, size: html.length })
  }
})

app.get('/api/upload-page', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><title>Upload HTML</title><style>
body{font-family:sans-serif;max-width:600px;margin:2rem auto;padding:1rem}
textarea{width:100%;height:200px;margin:1rem 0}
button{padding:0.5rem 1.5rem;font-size:1rem;cursor:pointer}
#status{margin-top:1rem;color:#333}
</style></head><body>
<h2>Upload Saved HTML Page</h2>
<p>Save the Stock Enquiry page as HTML (Ctrl+S), then either paste the HTML or upload the file.</p>
<input type="file" id="fileInput" accept=".html,.htm,.mhtml">
<textarea id="html" placeholder="Or paste HTML here..."></textarea>
<br><button onclick="send()">Upload</button>
<div id="status"></div>
<script>
document.getElementById('fileInput').addEventListener('change', e => {
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ev => document.getElementById('html').value = ev.target.result;
  r.readAsText(f);
});
function send(){
  const html = document.getElementById('html').value;
  if(!html){document.getElementById('status').textContent='No HTML provided';return}
  fetch('/api/upload-html',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({html})})
  .then(r=>r.json()).then(d=>{document.getElementById('status').textContent='Uploaded! '+d.size+' chars'})
  .catch(e=>{document.getElementById('status').textContent='Error: '+e.message})
}
</script></body></html>`)
})

// Upload a cropped style image
app.post('/api/upload-style-image', (req, res) => {
  const { styleId, image } = req.body
  if (!styleId || !image) return res.status(400).json({ error: 'styleId and image required' })

  const match = image.match(/^data:image\/\w+;base64,(.+)$/)
  if (!match) return res.status(400).json({ error: 'Invalid base64 image' })

  const slug = styleId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
  const filename = `${slug}.png`
  const filepath = join(STYLES_DIR, filename)

  try {
    writeStyleFile(filename, Buffer.from(match[1], 'base64'))
    res.json({ url: `/images/styles/${filename}` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete an uploaded style image
app.delete('/api/delete-style-image', (req, res) => {
  const { styleId } = req.body
  if (!styleId) return res.status(400).json({ error: 'styleId required' })

  const slug = styleId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
  const filepath = join(STYLES_DIR, `${slug}.png`)

  try {
    deleteStyleFile(`${slug}.png`)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Assign an existing server image to a style (copy file)
app.post('/api/assign-style-image', (req, res) => {
  const { styleId, sourceFile } = req.body
  if (!styleId || !sourceFile) return res.status(400).json({ error: 'styleId and sourceFile required' })

  const sourcePath = join(STYLES_DIR, sourceFile)
  if (!existsSync(sourcePath)) return res.status(404).json({ error: 'Source file not found' })

  const slug = styleId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
  const filename = `${slug}.png`

  // Don't copy onto itself
  if (sourceFile === filename) return res.json({ url: `/images/styles/${filename}` })

  try {
    const data = readFileSync(sourcePath)
    writeStyleFile(filename, data)
    res.json({ url: `/images/styles/${filename}` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// List all cropped style images on the server
app.get('/api/style-images', (req, res) => {
  try {
    const files = readdirSync(STYLES_DIR).filter((f) => f.endsWith('.png'))
    const images = files.map((f) => ({
      filename: f,
      name: f.replace('.png', '').replace(/-/g, ' '),
      url: `/images/styles/${f}`,
    }))
    res.json({ images })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Catalog PDF persistence (keep last uploaded PDF per product type) ──
const CATALOG_DIR = join(__dirname, 'data', 'catalogs')
if (!existsSync(CATALOG_DIR)) mkdirSync(CATALOG_DIR, { recursive: true })

app.post('/api/upload-catalog-pdf', (req, res) => {
  const { productType, tier, filename, data } = req.body
  if (!productType || !data) return res.status(400).json({ error: 'productType and data required' })

  // Remove old PDFs for this product type + tier
  const prefix = `${productType}-${tier || 'default'}-`
  for (const f of readdirSync(CATALOG_DIR)) {
    if (f.startsWith(prefix)) unlinkSync(join(CATALOG_DIR, f))
  }

  const safeName = (filename || 'catalog.pdf').replace(/[^a-zA-Z0-9._-]/g, '_')
  const savedName = `${prefix}${safeName}`
  const buf = Buffer.from(data, 'base64')
  writeFileSync(join(CATALOG_DIR, savedName), buf)
  res.json({ ok: true, filename: savedName, size: buf.length })
})

app.get('/api/catalog-pdfs', (req, res) => {
  try {
    const files = readdirSync(CATALOG_DIR).filter(f => f.endsWith('.pdf'))
    res.json({ files: files.map(f => ({ filename: f, size: existsSync(join(CATALOG_DIR, f)) ? readFileSync(join(CATALOG_DIR, f)).length : 0 })) })
  } catch { res.json({ files: [] }) }
})

app.get('/api/catalog-pdf/:filename', (req, res) => {
  const filepath = join(CATALOG_DIR, req.params.filename)
  if (!existsSync(filepath)) return res.status(404).json({ error: 'Not found' })
  res.setHeader('Content-Type', 'application/pdf')
  res.send(readFileSync(filepath))
})

// ── Custom P-number mappings ─────────────────────────────────────
const PNUMBERS_DIR = join(__dirname, 'data')

app.get('/api/pnumbers/:productType', (req, res) => {
  const filepath = join(PNUMBERS_DIR, `${req.params.productType}-pnumbers.json`)
  try {
    res.json(JSON.parse(readFileSync(filepath, 'utf8')))
  } catch {
    res.json({})
  }
})

// Save/merge P-numbers for a product type
app.post('/api/save-pnumbers', (req, res) => {
  const { productType, pnumbers } = req.body
  if (!productType || !pnumbers || typeof pnumbers !== 'object') {
    return res.status(400).json({ error: 'productType and pnumbers object required' })
  }
  const filepath = join(PNUMBERS_DIR, `${productType}-pnumbers.json`)
  let existing = {}
  try { existing = JSON.parse(readFileSync(filepath, 'utf8')) } catch { /* new file */ }
  const merged = { ...existing, ...pnumbers }
  writeFileSync(filepath, JSON.stringify(merged, null, 2))
  res.json({ ok: true, count: Object.keys(merged).length, newEntries: Object.keys(pnumbers).length })
})

// Extract P-numbers from catalog pages using Claude Vision
app.post('/api/extract-pnumbers', async (req, res) => {
  const { productType, tier, pages, existingStyles } = req.body
  if (!pages?.length) return res.status(400).json({ error: 'pages required' })

  const apiKey = process.env.CATALOG_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'CATALOG_API_KEY not configured' })

  const client = new Anthropic({ apiKey })

  const styleList = (existingStyles || []).map(s =>
    `- "${s.name}" (id: "${s.id}")${s.diamondTypes ? ` [diamond types: ${s.diamondTypes.join(', ')}]` : ''}${s.diamondColors?.length ? ` [diamond colors: ${s.diamondColors.join(', ')}]` : ''}`
  ).join('\n')

  try {
    const results = []
    for (const page of pages) {
      const { pageNum, imageBase64 } = page
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: base64Data },
            },
            {
              type: 'text',
              text: `You are reading a ${productType || 'jewelry'} catalog page that contains P-number lookup tables for men's diamond wedding bands.

Each table has:
- A STYLE NAME in the header (e.g. "Brushed Centre & Polished Inverted Edge")
- A DIAMOND TYPE description (e.g. "Round Brilliant Third Channel", "Round Brilliant Black OR White Diamond")
- Rows for each TDW (Total Diamond Weight) value (e.g. .15, .25, .35, .50, .75, 1.00, 1.50)
- Columns for each METAL type: "10K White", "10K Yellow", "10K Rose", "14K White", etc., "Platinum", "Silver CZ"
- Some tables have a "Dia Type" column for diamond color (HI I2 or Black)

Known styles (match names to these IDs):
${styleList}

Extract ALL P-numbers. Return JSON with pipe-separated keys.

KEY FORMAT:
- Column "10K White" → goldColor="White", carat="10K"
- Column "14K Rose" → goldColor="Rose", carat="14K"
- "Platinum" → just "Platinum" (no goldColor or carat)
- "Silver CZ" → just "Silver CZ" (no goldColor or carat)

Diamond type handling:
- If a table has a "Dia Type" column with "HI I2" or "Black": use "White Diamonds" for HI I2, "Black Diamonds" for Black
- If a table does NOT have a "Dia Type" column: omit diamond type from key UNLESS the style has multiple diamond cut types (e.g. "Round Brilliant" AND "Princess Cut"), in which case use the short cut name (e.g. "Round Brilliant", "Princess Cut")

Key patterns:
- WITH diamond color + gold: "styleId|White Diamonds|White|10K|.15" or "styleId|Black Diamonds|Yellow|14K|.50"
- WITH diamond color + platinum: "styleId|White Diamonds|Platinum|.15"
- WITHOUT diamond type + gold: "styleId|White|10K|.15"
- WITHOUT diamond type + platinum: "styleId|Platinum|.15"
- WITH diamond cut + gold: "styleId|Round Brilliant|White|10K|.15"
- WITH diamond cut + platinum: "styleId|Princess Cut|Platinum|.15"

Examples:
- "10K White" column, Dia Type "HI I2": "style id|White Diamonds|White|10K|.15"
- "14K Rose" column, Dia Type "Black": "style id|Black Diamonds|Rose|14K|.50"
- "Platinum" column, Dia Type "Black": "style id|Black Diamonds|Platinum|.15"
- "Silver CZ" column, no Dia Type: "style id|Silver CZ|.15"
- "10K White" column, no Dia Type, single cut: "style id|White|10K|.15"

Rules:
- styleId = LOWERCASE style name matching known IDs
- Skip "n/a" or empty cells
- Include Silver CZ entries
- Read EVERY row and column — do not skip any
- Diamond weights: .15, .25, .35, .50, .75, 1.00, 1.50
- Gold colors exactly: White, Yellow, Rose
- Carats exactly: 10K, 14K, 18K

Return ONLY valid JSON:
{
  "entries": {
    "style id|White Diamonds|White|10K|.15": "pnumber",
    "style id|Platinum|.15": "pnumber",
    ...
  },
  "styleName": "The Style Name from the header",
  "count": 77
}

If multiple tables on one page, combine all entries.`,
            },
          ],
        }],
      })

      let parsed = { entries: {}, styleName: '', count: 0 }
      try {
        const text = response.content[0].text
        parsed = JSON.parse(text)
      } catch {
        const text = response.content[0].text
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try { parsed = JSON.parse(jsonMatch[0]) } catch { /* ignore */ }
        }
      }
      results.push({ pageNum, ...parsed })
    }

    res.json({ results })
  } catch (err) {
    console.error('Extract P-numbers error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Product categories (tiers) ──────────────────────────────────
const CATEGORIES_FILE = join(__dirname, 'data', 'product-categories.json')

function loadCategories() {
  try { return JSON.parse(readFileSync(CATEGORIES_FILE, 'utf8')) }
  catch { return {} }
}

function saveCategories(data) {
  writeFileSync(CATEGORIES_FILE, JSON.stringify(data, null, 2))
}

app.get('/api/categories/:productType', (req, res) => {
  const all = loadCategories()
  res.json(all[req.params.productType] || [])
})

app.post('/api/categories/:productType', (req, res) => {
  const { categories } = req.body
  if (!Array.isArray(categories)) return res.status(400).json({ error: 'categories[] required' })
  const all = loadCategories()
  all[req.params.productType] = categories
  saveCategories(all)
  res.json({ ok: true })
})

// ── Custom style definitions (from catalog processor) ───────────
const CUSTOM_STYLES_FILE = join(__dirname, 'data', 'custom-styles.json')

function loadCustomStyles() {
  try { return JSON.parse(readFileSync(CUSTOM_STYLES_FILE, 'utf8')) }
  catch { return {} }
}

function saveCustomStyles(data) {
  writeFileSync(CUSTOM_STYLES_FILE, JSON.stringify(data, null, 2))
}

// Get all custom styles (keyed by product type)
app.get('/api/custom-styles', (req, res) => {
  res.json(loadCustomStyles())
})

// Get custom styles for a specific product type
app.get('/api/custom-styles/:productType', (req, res) => {
  const all = loadCustomStyles()
  res.json(all[req.params.productType] || [])
})

// Save custom styles for a product type (merge with existing)
app.post('/api/custom-styles', (req, res) => {
  const { productType, styles } = req.body
  if (!productType || !Array.isArray(styles)) return res.status(400).json({ error: 'productType and styles[] required' })
  const all = loadCustomStyles()
  const existing = all[productType] || []
  // Merge: update by id, append new
  for (const s of styles) {
    const idx = existing.findIndex((e) => e.id === s.id)
    if (idx >= 0) existing[idx] = { ...existing[idx], ...s }
    else existing.push(s)
  }
  all[productType] = existing
  saveCustomStyles(all)
  res.json({ ok: true, count: existing.length })
})

// Delete a custom style
app.delete('/api/custom-styles/:productType/:styleId', (req, res) => {
  const all = loadCustomStyles()
  const list = all[req.params.productType] || []
  all[req.params.productType] = list.filter((s) => s.id !== req.params.styleId)
  saveCustomStyles(all)
  res.json({ ok: true })
})

// ── Watch SKU persistence ────────────────────────────────────────
const WATCH_SKUS_FILE = join(__dirname, 'data', 'watch-skus.json')
const DATA_DIR = join(__dirname, 'data')
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

function loadWatchSkus() {
  try { return JSON.parse(readFileSync(WATCH_SKUS_FILE, 'utf8')) }
  catch { return {} }
}

function saveWatchSkus(map) {
  writeFileSync(WATCH_SKUS_FILE, JSON.stringify(map, null, 2))
}

// Get all watch SKUs
app.get('/api/watch-skus', (req, res) => {
  res.json(loadWatchSkus())
})

// Save/update watch SKUs (merge) — rejects duplicates unless ?update=1
app.post('/api/watch-skus', (req, res) => {
  const incoming = req.body
  if (!incoming || typeof incoming !== 'object') return res.status(400).json({ error: 'Object required' })
  const isUpdate = req.query.update === '1'
  const current = loadWatchSkus()
  if (!isUpdate) {
    const skuToCode = {}
    for (const [code, sku] of Object.entries(current)) skuToCode[sku] = code
    const duplicates = []
    for (const [code, sku] of Object.entries(incoming)) {
      const upperCode = code.toUpperCase()
      if (current[upperCode]) duplicates.push(`Code ${upperCode} already exists`)
      else if (skuToCode[sku] && !incoming[skuToCode[sku]]) duplicates.push(`SKU ${sku} already paired to code ${skuToCode[sku]}`)
    }
    if (duplicates.length > 0) return res.status(409).json({ error: 'Duplicates found', duplicates })
  }
  Object.assign(current, incoming)
  saveWatchSkus(current)
  res.json({ ok: true, count: Object.keys(current).length })
})

// Delete a watch SKU
app.delete('/api/watch-skus/:code', (req, res) => {
  const code = req.params.code.toUpperCase()
  const current = loadWatchSkus()
  delete current[code]
  saveWatchSkus(current)
  res.json({ ok: true })
})

// Bulk replace all watch SKUs
app.put('/api/watch-skus', (req, res) => {
  const incoming = req.body
  if (!incoming || typeof incoming !== 'object') return res.status(400).json({ error: 'Object required' })
  saveWatchSkus(incoming)
  res.json({ ok: true, count: Object.keys(incoming).length })
})

// ── Generic product SKU persistence ──────────────────────────────────
const VALID_PRODUCT_TYPES = ['wedders', 'chains', 'rings', 'tennis', 'bangles', 'pendants']

function loadProductSkus(type) {
  try { return JSON.parse(readFileSync(join(DATA_DIR, `${type}-skus.json`), 'utf8')) }
  catch { return {} }
}

function saveProductSkus(type, map) {
  writeFileSync(join(DATA_DIR, `${type}-skus.json`), JSON.stringify(map, null, 2))
}

app.get('/api/product-skus/:productType', (req, res) => {
  const type = req.params.productType.toLowerCase()
  if (!VALID_PRODUCT_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid product type' })
  res.json(loadProductSkus(type))
})

app.post('/api/product-skus/:productType', (req, res) => {
  const type = req.params.productType.toLowerCase()
  if (!VALID_PRODUCT_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid product type' })
  const incoming = req.body
  if (!incoming || typeof incoming !== 'object') return res.status(400).json({ error: 'Object required' })
  const current = loadProductSkus(type)
  Object.assign(current, incoming)
  saveProductSkus(type, current)
  res.json({ ok: true, count: Object.keys(current).length })
})

app.put('/api/product-skus/:productType', (req, res) => {
  const type = req.params.productType.toLowerCase()
  if (!VALID_PRODUCT_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid product type' })
  const incoming = req.body
  if (!incoming || typeof incoming !== 'object') return res.status(400).json({ error: 'Object required' })
  saveProductSkus(type, incoming)
  res.json({ ok: true, count: Object.keys(incoming).length })
})

// Analyze catalog pages with Claude Vision
app.post('/api/analyze-catalog', async (req, res) => {
  const { productType, pages } = req.body
  if (!productType || !pages?.length) {
    return res.status(400).json({ error: 'productType and pages required' })
  }

  const apiKey = process.env.CATALOG_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'CATALOG_API_KEY not configured' })

  const client = new Anthropic({ apiKey })

  try {
    const results = []
    for (const page of pages) {
      const { pageNum, imageBase64 } = page
      // Strip data URL prefix if present
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: base64Data },
            },
            {
              type: 'text',
              text: `You are analyzing a jewelry catalog page for "${productType}" products.

Identify each distinct product/style shown on this page. For each product found, provide:
1. The style name (match to known names if possible: use common jewelry style names)
2. The bounding box coordinates in pixels (x, y, width, height) that tightly crops just that product image

Return ONLY valid JSON in this exact format, no other text:
{
  "items": [
    { "name": "Style Name", "x": 0, "y": 0, "w": 100, "h": 100, "confidence": 0.95 }
  ]
}

Rules:
- x,y is the top-left corner of the bounding box
- Coordinates should be in pixels relative to the full image dimensions
- Include ALL distinct products visible, even if partially shown
- confidence is 0-1 indicating how sure you are about the identification
- If no products are found, return { "items": [] }`,
            },
          ],
        }],
      })

      let items = []
      try {
        const text = response.content[0].text
        const parsed = JSON.parse(text)
        items = parsed.items || []
      } catch {
        // Try to extract JSON from response
        const text = response.content[0].text
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            items = JSON.parse(jsonMatch[0]).items || []
          } catch { /* ignore */ }
        }
      }
      results.push({ pageNum, items })
    }

    res.json({ results })
  } catch (err) {
    console.error('Claude API error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// OCR style names from catalog pages
app.post('/api/ocr-catalog', async (req, res) => {
  const { productType, pages } = req.body
  if (!pages?.length) {
    return res.status(400).json({ error: 'pages required' })
  }

  const apiKey = process.env.CATALOG_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'CATALOG_API_KEY not configured' })

  const client = new Anthropic({ apiKey })

  try {
    const results = []
    for (const page of pages) {
      const { pageNum, imageBase64 } = page
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: base64Data },
            },
            {
              type: 'text',
              text: `You are reading a ${productType || 'jewelry'} catalog page. Your job is to find ALL product/style names on this page.

Read EVERY piece of text on this page carefully. Extract all product or style names — these may appear as:
- Labels next to, above, or below product images
- Headers or titles on the page
- Multi-word names like "Round Brilliant Third Channel" or "Princess Channel Set"
- Text in any font size, orientation, or color

Return ONLY a JSON array of the full style names, no other text:
["Full Style Name 1", "Full Style Name 2", ...]

Rules:
- Include the COMPLETE name as written (do not shorten or abbreviate)
- Include ALL names, even if partially visible or in small text
- Read carefully — do not miss any text that could be a product/style name
- If a name spans multiple lines, combine into one string
- If no names are readable, return []`,
            },
          ],
        }],
      })

      let names = []
      try {
        const text = response.content[0].text
        names = JSON.parse(text)
        if (!Array.isArray(names)) names = []
      } catch {
        const text = response.content[0].text
        const match = text.match(/\[[\s\S]*\]/)
        if (match) {
          try { names = JSON.parse(match[0]) } catch { /* ignore */ }
        }
      }
      results.push({ pageNum, names })
    }

    res.json({ results })
  } catch (err) {
    console.error('OCR API error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Find by Photo: 2-step — Claude describes item + text filter, then Claude visually compares top candidates
app.post('/api/find-by-photo', async (req, res) => {
  const { imageBase64, category } = req.body
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' })

  const apiKey = process.env.CATALOG_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'CATALOG_API_KEY not configured' })

  const mediaMatch = imageBase64.match(/^data:(image\/\w+);base64,/)
  const mediaType = mediaMatch ? mediaMatch[1].replace('jpg', 'jpeg') : 'image/jpeg'
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
  const client = new Anthropic({ apiKey })

  try {
    // Step 1: Describe the jewelry item (fast model)
    const descResp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          { type: 'text', text: `Describe this jewelry item concisely. Return ONLY valid JSON:
{
  "description": "One sentence describing the item",
  "type": "ring|earring|pendant|necklace|bracelet|bangle|chain|watch|other",
  "metal": "yellow gold|white gold|rose gold|sterling silver|platinum|two-tone|unknown",
  "keywords": ["5-10 words: style, shape, stone type, setting, design details"]
}` },
        ],
      }],
    })

    let analysis = { description: '', type: 'other', metal: 'unknown', keywords: [] }
    try { analysis = JSON.parse(descResp.content[0].text) } catch {
      const m = descResp.content[0].text.match(/\{[\s\S]*\}/)
      if (m) try { analysis = JSON.parse(m[0]) } catch {}
    }

    // Step 2: Load catalog and text-filter candidates
    const catalogPath = join(__dirname, 'src', 'data', 'catalog.json')
    let catalogData
    try { catalogData = JSON.parse(readFileSync(catalogPath, 'utf8')) } catch {
      return res.status(500).json({ error: 'Could not load catalog' })
    }

    let products = []
    if (category && category !== 'all') {
      const catName = category.startsWith('catalog:') ? category.slice(8) : category
      products = (catalogData[catName] || []).map(p => ({ ...p, category: catName }))
    } else {
      for (const [cat, items] of Object.entries(catalogData))
        for (const p of items) products.push({ ...p, category: cat })
    }

    const catTypeMap = {
      'Rings': 'ring', 'Engagement': 'ring', 'Solitaires': 'ring', 'Wedders': 'ring',
      'Earrings': 'earring', 'Pendants': 'pendant', 'Pendants-Necklaces': 'pendant',
      'Bracelets-Bangles': 'bracelet', 'Chains': 'chain',
    }
    // Also match bangle -> bracelet-bangles, necklace -> chains/pendants
    const typeAliases = {
      'bangle': ['bracelet'], 'necklace': ['pendant', 'chain'],
      'pendant': ['necklace'], 'bracelet': ['bangle'],
    }

    const searchTerms = [...(analysis.keywords || []), analysis.metal]
      .filter(t => t && t !== 'unknown' && t !== 'other').map(t => t.toLowerCase())

    const aType = (analysis.type || '').toLowerCase()
    const acceptTypes = new Set([aType, ...(typeAliases[aType] || [])])

    // Score products by text match
    const scored = products.filter(p => p.m).map(p => {
      const name = p.n.toLowerCase()
      let score = 0
      const pType = catTypeMap[p.category] || 'other'
      if (aType !== 'other' && aType !== 'unknown') {
        if (acceptTypes.has(pType) || name.includes(aType)) score += 40
        else return null
      }
      for (const term of searchTerms) {
        if (term.length < 3) continue
        if (name.includes(term)) score += 5
      }
      return { p, score }
    }).filter(Boolean)

    scored.sort((a, b) => b.score - a.score)
    // Take top 15 candidates for visual comparison
    const candidates = scored.slice(0, 15)

    if (candidates.length === 0) {
      return res.json({ description: analysis.description, matches: [] })
    }

    // Step 3: Download candidate images and ask Claude to visually rank them
    const IMAGE_BASE = 'https://prod-sfcc-api.michaelhill.com/dw/image/v2/AANC_PRD/on/demandware.static/-/Sites-MHJ_Master/default/images'
    const https = await import('https')
    const http = await import('http')

    function fetchImageBase64(url) {
      return new Promise((resolve) => {
        const mod = url.startsWith('https') ? https : http
        mod.get(url, { timeout: 5000 }, (resp) => {
          if (resp.statusCode !== 200) { resolve(null); return }
          const chunks = []
          resp.on('data', c => chunks.push(c))
          resp.on('end', () => resolve(Buffer.concat(chunks).toString('base64')))
          resp.on('error', () => resolve(null))
        }).on('error', () => resolve(null))
      })
    }

    // Download candidate images in parallel (small 150px thumbnails)
    const imgPromises = candidates.map(async ({ p }) => {
      const url = `${IMAGE_BASE}/${p.m.split('-')[0]}/${p.m}?sw=100&sm=fit&q=50`
      const b64 = await fetchImageBase64(url)
      return { p, b64 }
    })
    const withImages = (await Promise.all(imgPromises)).filter(x => x.b64)

    // Build Claude message with user photo + candidate images
    const content = [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
      { type: 'text', text: 'This is the customer\'s photo. Compare it visually against these catalog products and rank the best matches:\n' },
    ]

    for (let i = 0; i < withImages.length; i++) {
      const { p, b64 } = withImages[i]
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } })
      content.push({ type: 'text', text: `[${i}] SKU: ${p.s} — ${p.n}` })
    }

    content.push({ type: 'text', text: `\nCompare the customer's photo visually against all ${withImages.length} product images above. Consider stone shape, size, count, setting style, metal color, band design, and overall appearance.

Return ONLY valid JSON — the top 10 best visual matches:
{ "matches": [{ "index": 0, "confidence": 95, "reason": "brief reason" }, ...] }
Order by visual similarity (best first). confidence 0-100.` })

    const rankResp = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content }],
    })

    let ranked = { matches: [] }
    try { ranked = JSON.parse(rankResp.content[0].text) } catch {
      const m2 = rankResp.content[0].text.match(/\{[\s\S]*\}/)
      if (m2) try { ranked = JSON.parse(m2[0]) } catch {}
    }

    const matches = (ranked.matches || []).map(m => {
      const item = withImages[m.index]
      if (!item) return null
      const p = item.p
      return {
        sku: p.s,
        name: p.n,
        image: `${IMAGE_BASE}/${p.m.split('-')[0]}/${p.m}?sw=600&sm=fit&q=80`,
        confidence: m.confidence,
        reason: m.reason,
        category: p.category,
      }
    }).filter(Boolean)

    res.json({ description: analysis.description, matches })
  } catch (err) {
    console.error('Find by photo error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Manager report URLs settings
const REPORT_URLS_FILE = join(__dirname, 'data', 'report_urls.json')

app.get('/api/report-urls', (req, res) => {
  try {
    if (existsSync(REPORT_URLS_FILE)) {
      res.json(JSON.parse(readFileSync(REPORT_URLS_FILE, 'utf8')))
    } else {
      res.json({ min: '', wps: '', hillnet: '' })
    }
  } catch { res.json({ min: '', wps: '', hillnet: '' }) }
})

app.post('/api/report-urls', (req, res) => {
  const { min, wps, hillnet } = req.body
  const data = { min: min || '', wps: wps || '', hillnet: hillnet || '' }
  writeFileSync(REPORT_URLS_FILE, JSON.stringify(data, null, 2))
  res.json({ ok: true })
})

// Upload report template image for reference
app.post('/api/upload-template', (req, res) => {
  const { imageBase64, fileName } = req.body
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' })
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
  const ext = (fileName || 'template.png').split('.').pop() || 'png'
  const outPath = join(__dirname, 'data', `report_template.${ext}`)
  writeFileSync(outPath, Buffer.from(base64Data, 'base64'))
  res.json({ ok: true, path: outPath })
})

// Save uploaded report images to disk
const REPORT_IMAGES_DIR = join(__dirname, 'data', 'report_images')
if (!existsSync(REPORT_IMAGES_DIR)) mkdirSync(REPORT_IMAGES_DIR, { recursive: true })

app.post('/api/save-report-image', (req, res) => {
  const { imageBase64, fileName } = req.body
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' })
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
  const ts = Date.now()
  const safeName = (fileName || 'report.png').replace(/[^a-zA-Z0-9._-]/g, '_')
  const outName = `${ts}_${safeName}`
  const outPath = join(REPORT_IMAGES_DIR, outName)
  writeFileSync(outPath, Buffer.from(base64Data, 'base64'))
  res.json({ ok: true, fileName: outName })
})

// OCR results cache
const OCR_CACHE_FILE = join(REPORT_IMAGES_DIR, '_ocr_cache.json')

function loadOcrCache() {
  try { return JSON.parse(readFileSync(OCR_CACHE_FILE, 'utf8')) } catch { return {} }
}

function saveOcrCache(cache) {
  writeFileSync(OCR_CACHE_FILE, JSON.stringify(cache, null, 2))
}

app.get('/api/saved-report-images', (req, res) => {
  try {
    if (!existsSync(REPORT_IMAGES_DIR)) return res.json([])
    const files = readdirSync(REPORT_IMAGES_DIR)
      .filter(f => /\.(png|jpg|jpeg|heic|heif)$/i.test(f))
      .sort((a, b) => b.localeCompare(a))
    const cache = loadOcrCache()
    const result = files.map(f => ({ fileName: f, cached: !!cache[f], ...(cache[f] || {}) }))
    res.json(result)
  } catch { res.json([]) }
})

app.delete('/api/saved-report-images', (req, res) => {
  try {
    if (existsSync(REPORT_IMAGES_DIR)) {
      const files = readdirSync(REPORT_IMAGES_DIR)
      for (const f of files) unlinkSync(join(REPORT_IMAGES_DIR, f))
    }
    if (existsSync(OCR_CACHE_FILE)) unlinkSync(OCR_CACHE_FILE)
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/saved-report-images/:fileName', (req, res) => {
  try {
    const safeName = req.params.fileName.replace(/[^a-zA-Z0-9._-]/g, '')
    const filePath = join(REPORT_IMAGES_DIR, safeName)
    if (existsSync(filePath)) unlinkSync(filePath)
    const cache = loadOcrCache()
    delete cache[safeName]
    saveOcrCache(cache)
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Serve saved report images
app.use('/api/report-images', express.static(REPORT_IMAGES_DIR))

// ── Spread Analysis file persistence ──
const SPREAD_DIR = join(__dirname, 'data', 'spread_analysis')
const SPREAD_PNL_DIR = join(SPREAD_DIR, 'pnl')
const SPREAD_FLOW_DIR = join(SPREAD_DIR, 'flow')
for (const d of [SPREAD_PNL_DIR, SPREAD_FLOW_DIR]) { if (!existsSync(d)) mkdirSync(d, { recursive: true }) }

// Helper: get pnl dir for a month (creates if needed)
function spreadPnlDir(month) {
  if (month) {
    const safe = month.replace(/[^0-9-]/g, '')
    const dir = join(SPREAD_PNL_DIR, safe)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    return dir
  }
  return SPREAD_PNL_DIR
}

app.post('/api/spread/upload', (req, res) => {
  const { fileBase64, fileName, type, month } = req.body
  if (!fileBase64 || !type) return res.status(400).json({ error: 'fileBase64 and type required' })
  if (!['pnl', 'flow'].includes(type)) return res.status(400).json({ error: 'type must be pnl or flow' })
  const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, '')
  const ts = Date.now()
  const safeName = (fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')
  const outName = `${ts}_${safeName}`
  const dir = type === 'pnl' ? spreadPnlDir(month) : SPREAD_FLOW_DIR
  writeFileSync(join(dir, outName), Buffer.from(base64Data, 'base64'))
  res.json({ ok: true, fileName: outName })
})

// List months that have P&L files
app.get('/api/spread/months', (req, res) => {
  try {
    const entries = readdirSync(SPREAD_PNL_DIR, { withFileTypes: true })
    const months = []
    // Check for files in root (legacy, no month)
    const rootFiles = entries.filter(e => e.isFile() && !e.name.startsWith('.'))
    if (rootFiles.length > 0) months.push({ month: 'unassigned', label: 'Unassigned', count: rootFiles.length })
    // Check month subdirectories
    for (const e of entries) {
      if (e.isDirectory() && /^\d{4}-\d{2}$/.test(e.name)) {
        const files = readdirSync(join(SPREAD_PNL_DIR, e.name)).filter(f => !f.startsWith('.'))
        if (files.length > 0) {
          const [y, m] = e.name.split('-')
          const label = new Date(+y, +m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          months.push({ month: e.name, label, count: files.length })
        }
      }
    }
    months.sort((a, b) => b.month.localeCompare(a.month))
    res.json(months)
  } catch { res.json([]) }
})

app.get('/api/spread/files/:type', (req, res) => {
  const { type } = req.params
  const { month } = req.query
  if (!['pnl', 'flow'].includes(type)) return res.status(400).json({ error: 'invalid type' })
  const dir = type === 'pnl' ? spreadPnlDir(month) : SPREAD_FLOW_DIR
  try {
    const files = readdirSync(dir, { withFileTypes: true }).filter(e => e.isFile() && !e.name.startsWith('.')).map(e => e.name).sort((a, b) => b.localeCompare(a))
    res.json(files)
  } catch { res.json([]) }
})

app.delete('/api/spread/files/:type/:fileName', (req, res) => {
  const { type, fileName } = req.params
  const { month } = req.query
  if (!['pnl', 'flow'].includes(type)) return res.status(400).json({ error: 'invalid type' })
  const dir = type === 'pnl' ? spreadPnlDir(month) : SPREAD_FLOW_DIR
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '')
  const filePath = join(dir, safeName)
  try {
    if (existsSync(filePath)) unlinkSync(filePath)
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.use('/api/spread/serve/pnl', express.static(SPREAD_PNL_DIR))
app.use('/api/spread/serve/flow', express.static(SPREAD_FLOW_DIR))
// Serve month-specific files
app.get('/api/spread/serve/pnl/:month/:fileName', (req, res) => {
  const { month, fileName } = req.params
  const safe = month.replace(/[^0-9-]/g, '')
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '')
  const filePath = join(SPREAD_PNL_DIR, safe, safeName)
  if (existsSync(filePath)) return res.sendFile(filePath)
  res.status(404).json({ error: 'Not found' })
})

// Staff roles persistence (per month)
function staffRolesPath(month) {
  const safe = (month || 'unassigned').replace(/[^0-9a-z-]/gi, '')
  return join(SPREAD_DIR, `staff_roles_${safe}.json`)
}

app.get('/api/spread/staff-roles', (req, res) => {
  const p = staffRolesPath(req.query.month)
  if (existsSync(p)) return res.json(JSON.parse(readFileSync(p, 'utf8')))
  res.json({})
})

app.post('/api/spread/staff-roles', (req, res) => {
  const { month, roles } = req.body || {}
  if (!roles || typeof roles !== 'object') return res.status(400).json({ error: 'roles required' })
  writeFileSync(staffRolesPath(month), JSON.stringify(roles, null, 2))
  res.json({ ok: true })
})

// Extract staff names from P&L files for categorization
app.post('/api/spread/extract-staff', async (req, res) => {
  const apiKey = process.env.CATALOG_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'CATALOG_API_KEY not configured' })

  const { month } = req.body || {}

  try {
    const pnlDir = spreadPnlDir(month)
    const pnlFiles = readdirSync(pnlDir).filter(f => !f.startsWith('.') && !statSync(join(pnlDir, f)).isDirectory())
    if (pnlFiles.length === 0) return res.status(400).json({ error: 'No P&L files uploaded for this month.' })

    const content = []
    for (const f of pnlFiles) {
      const filePath = join(pnlDir, f)
      const buf = readFileSync(filePath)
      const ext = f.split('.').pop().toLowerCase()
      if (ext === 'pdf') {
        content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } })
      } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
        continue
      } else {
        const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }
        const mime = mimeMap[ext] || 'image/png'
        content.push({ type: 'image', source: { type: 'base64', media_type: mime, data: buf.toString('base64') } })
      }
    }

    content.push({
      type: 'text',
      text: `Extract ALL individual staff/team member names from these reports. Look at column headers or row labels for person names (not "Total" or store names).

Return ONLY a JSON array of unique name strings, e.g.: ["Bach Vu", "Faye Sarmiento", "Nicholas Kuhn"]

Rules:
- Include every individual person name visible in any report
- Exclude "Total", store names, location names
- Deduplicate — each name appears once
- Return ONLY the JSON array, no other text.`
    })

    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content }],
    })

    let text = response.content[0].text.trim()
    text = text.replace(/^```json?\s*/im, '').replace(/\s*```\s*$/im, '')
    const start = text.indexOf('[')
    const end = text.lastIndexOf(']')
    if (start === -1 || end === -1) return res.status(400).json({ error: 'Could not extract staff names' })
    const names = JSON.parse(text.slice(start, end + 1))
    res.json({ staff: names })
  } catch (err) {
    console.error('Extract staff error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Spread Analysis — send P&L files + flow template to Claude for analysis
app.post('/api/spread/analyze', async (req, res) => {
  const apiKey = process.env.CATALOG_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'CATALOG_API_KEY not configured' })

  const { staffRoles, month, notes } = req.body || {}

  try {
    const pnlDir = spreadPnlDir(month)
    const pnlFiles = readdirSync(pnlDir).filter(f => !f.startsWith('.') && !statSync(join(pnlDir, f)).isDirectory())
    const flowFiles = readdirSync(SPREAD_FLOW_DIR).filter(f => !f.startsWith('.'))
    if (pnlFiles.length === 0) return res.status(400).json({ error: 'No P&L files uploaded. Upload at least one P&L report.' })
    if (flowFiles.length === 0) return res.status(400).json({ error: 'No flow template uploaded. Upload the analysis flow document.' })

    const content = []

    // Add flow template first
    for (const f of flowFiles) {
      const filePath = join(SPREAD_FLOW_DIR, f)
      const buf = readFileSync(filePath)
      const ext = f.split('.').pop().toLowerCase()
      if (ext === 'pdf') {
        content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } })
      } else {
        const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }
        const mime = mimeMap[ext] || 'image/png'
        content.push({ type: 'image', source: { type: 'base64', media_type: mime, data: buf.toString('base64') } })
      }
      content.push({ type: 'text', text: `Above: Analysis flow template (${f.replace(/^\d+_/, '')})` })
    }

    // Add P&L files
    for (const f of pnlFiles) {
      const filePath = join(pnlDir, f)
      const buf = readFileSync(filePath)
      const ext = f.split('.').pop().toLowerCase()
      if (ext === 'pdf') {
        content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } })
      } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
        content.push({ type: 'text', text: `[Spreadsheet file: ${f.replace(/^\d+_/, '')} — data extraction not supported for this format, use PDF or screenshot instead]` })
        continue
      } else {
        const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }
        const mime = mimeMap[ext] || 'image/png'
        content.push({ type: 'image', source: { type: 'base64', media_type: mime, data: buf.toString('base64') } })
      }
      content.push({ type: 'text', text: `Above: P&L data file (${f.replace(/^\d+_/, '')})` })
    }

    content.push({
      type: 'text',
      text: `You are a Michael Hill retail store analyst. You have been given:
1. A "Spread Analysis Sequence" flow template — this is the FRAMEWORK to follow step by step.
2. P&L reports and supporting data for the store.
${staffRoles && Object.keys(staffRoles).length > 0 ? `3. Staff roles confirmed by the Store Manager:
${Object.entries(staffRoles).map(([name, role]) => `   - ${name}: ${role}`).join('\n')}

Role key: SM = Store Manager, ASM = Assistant Store Manager, FT SP = Full-Time Sales Professional, PT SP = Part-Time Sales Professional, OA = Office Administrator` : ''}

IMPORTANT CONTEXT — Staff Structure Rules:
- Staff structure can be inferred from the confirmed roles above and the Minimums Planner paid hours
- Full-timers (FT SP): ~40 hours/week selling
- Part-timers (PT SP): less than 40 hours/week selling
- SM and ASM: fewer selling hours due to management duties — their paid hours reflect selling time only
- **SM Black Dot Expectation**: The SM is expected to achieve at MINIMUM a black dot result every week. If the SM is red dotting, flag as a critical concern — the SM sets the standard for the team.
- Office Administrator (OA): non-selling role, may appear in reports with minimal or zero sales hours
- MH week runs Monday to Sunday
- MH quarter structure: Month 1 = 4 weeks, Month 2 = 5 weeks, Month 3 = 4 weeks

Follow the flow template EXACTLY, working through each step in order:
- P&L Review — Check revenue, expenditure, GP, net profit to target. MUST include:
  * **EBIT Analysis**: Extract EBIT (Earnings Before Interest & Tax) actual vs budget. Calculate variance ($, %). Identify the key drivers of any EBIT shortfall or surplus.
  * **Repairs Analysis**: Extract repairs/maintenance costs actual vs budget. Flag if significantly over/under budget and identify trends.
  * **High-Variance Line Items**: Scan ALL P&L line items and flag ANY item where actual vs budget variance exceeds ±10% or ±$500. Present these in a table: | Line Item | Budget | Actual | Variance $ | Variance % |. This catches controllable costs the SM can influence.
- Staff Structure — Infer from MIN planner hours (40h = full-time, <40h = part-time, SM/2IC have reduced selling hours). Assess if structure matches store needs.
- Minimums Planner — Are planning levels correct? Is fair share doctrine in place? Are weekly goals realistic?
- Quarterly Minimums Summary — Performance trends, who's reaching targets, gold star consistency
- Store Manager Quarterly Minimums Summary — Store performance to goal, gold stars vs red dots, YTD variance. Flag any SM red dot weeks per the black dot expectation above.
- Individual Quarterly Summary — Each SP's performance to goal, categorise as: exceeding goal, close to target, or red dotting with significant impact
- Store Weekly Performance Summary — Compare individual stats to store average, trending up/down/stable
- Coaching Logs — No coaching log data is uploaded. Flag this: coaching must be verified in-store. Do NOT assume coaching is at 100% — list what should be checked (weekly coaching conducted? correct stat identified? behaviours being coached? strategy reviewed week-to-week?)
- Action Plans — GENERATE action plans based on the data analysis. For each SP who is underperforming, create a specific action plan with: the stat to focus on, the target improvement, specific behaviours to coach, and a timeline. Also create a store-level action plan addressing the biggest gaps.

For each step, analyze the uploaded data and provide specific findings with actual numbers from the reports. Where data is not available, note what's missing.

FORMATTING RULES (CRITICAL — follow exactly):
- Use ## for each main section heading (e.g. ## P&L Review, ## Staff Structure, etc.)
- Use ### for sub-headings within sections
- Use markdown tables with | for any data comparisons — example:
  | SP Name | Paid Hours | Nett Sales | ASV | TPH | IPS | Status |
  |---------|-----------|-----------|-----|-----|-----|--------|
  | Bach Vu | 189.48 | $28,934 | $381 | 0.40 | 1.05 | Close to target |
- Use bullet points for findings and observations
- Use **bold** for key numbers, names, and important findings
- Keep each section focused and concise with actual data

IMPORTANT for Individual Quarterly Summary:
- Include a TABLE of ALL SPs with their key metrics and category
- For EVERY SP, calculate and show: quarterly target, quarterly actual, variance ($ and %), and weekly breakdown of gold star / black dot / red dot results
- Categorise each SP into one of three groups:
  1. **Regularly exceeding goal** — up on target YTD
  2. **Close to target** — may be red dotting but performance trending up
  3. **Red dotting & having significant impact** — consistently below target, dragging store result
- ANY SP who is negative (below target) for the quarter MUST be explicitly flagged with their exact deficit in dollars and percentage. Do NOT skip or soften this — if they are behind, say so clearly.
- For each SP, quantify their individual deficit or surplus to targets
- Identify when they perform (sales periods/promos vs consistently)

IMPORTANT for Action Plans:
- Include a TABLE for each underperformer's action plan with: Focus Stat, Current, Target, Behaviours to Coach, Timeline
- Also create a store-level action plan table

At the end, provide a ## Summary with:
- Top 3 strengths
- Top 3 areas of concern
- Recommended priority actions table

Be specific and data-driven. Reference actual figures from the reports.${notes ? `\n\nADDITIONAL NOTES FROM STORE MANAGER:\n${notes}` : ''}`
    })

    // Stream response via SSE
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    const client = new Anthropic({ apiKey })
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 12000,
      messages: [{ role: 'user', content }],
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.text) {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
      }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    res.end()
  } catch (err) {
    console.error('Spread analysis error:', err)
    // If headers already sent, send error as SSE
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
      res.end()
    } else {
      res.status(500).json({ error: err.message })
    }
  }
})

// OCR from a saved image filename — returns cached result if available
app.post('/api/ocr-saved', async (req, res) => {
  const { fileName } = req.body
  if (!fileName) return res.status(400).json({ error: 'fileName required' })
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '')
  const filePath = join(REPORT_IMAGES_DIR, safeName)
  if (!existsSync(filePath)) return res.status(404).json({ error: 'Image not found' })

  // Check cache first
  const cache = loadOcrCache()
  if (cache[safeName]) return res.json(cache[safeName])

  // Not cached — run OCR
  const buf = readFileSync(filePath)
  const ext = safeName.split('.').pop().toLowerCase()
  const mime = ext === 'pdf' ? 'application/pdf' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
  const imageBase64 = `data:${mime};base64,${buf.toString('base64')}`
  req.body = { imageBase64 }

  // Wrap ocrReport to intercept successful result and cache it
  const origJson = res.json.bind(res)
  res.json = (data) => {
    if (!data.error) {
      cache[safeName] = data
      saveOcrCache(cache)
    }
    return origJson(data)
  }
  return ocrReport(req, res)
})

// OCR parse report image → extract KPIs matching managers report template
app.post('/api/ocr-report', (req, res) => ocrReport(req, res))

async function ocrReport(req, res) {
  const { imageBase64 } = req.body
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' })

  const apiKey = process.env.CATALOG_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'CATALOG_API_KEY not configured' })

  const client = new Anthropic({ apiKey })

  try {
    const isPdf = imageBase64.startsWith('data:application/pdf')
    const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, '')
    const mediaMatch = imageBase64.match(/^data:([^;]+);base64,/)
    const mediaType = mediaMatch ? mediaMatch[1] : 'image/png'

    // Include template if available for reference
    const content = []
    const templatePath = join(__dirname, 'data', 'report_template.png')
    if (existsSync(templatePath)) {
      const templateBase64 = readFileSync(templatePath).toString('base64')
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: templateBase64 },
      })
      content.push({
        type: 'text',
        text: 'Above is the TEMPLATE showing the desired report format. Below is the actual report screenshot to extract data from.',
      })
    }

    if (isPdf) {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64Data },
      })
    } else {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64Data },
      })
    }

    content.push({
      type: 'text',
      text: `You are reading a Michael Hill retail report screenshot.

FIRST: Identify the report type. Valid types are:
- "wps" = Weekly Performance Summary (has rows like PAID HOURS, TOTAL SALES, # OF TRANSACTIONS, # OF ITEMS, NETT SALES, AVERAGE SALE, ITEMS PER SALE, TRANSACTIONS PER HOUR, SALES PER HOUR, % OFF RETAIL, ABOVE/BELOW MIN SELL, CREDIT SALES, PCP ATTACH RATE per staff member with a Total column)
- "min" = Weekly Minimums Planner (has columns: Paid Hours, % Store Hours, Black Dot Target, Gold Star Target, Nett Sales, % Of Target, Stretch-Platinum Target)
- "onyx" = Onyx report (pink/magenta headers, has columns: Net Sales $, Customer Orders $, Qty, Trans, IPS, PCP%, GS GP%)

If this is NONE of those three types, return ONLY:
{"error": "invalid_report", "detected": "description of what you see"}

If it IS one of those types, extract the STORE TOTAL row data (the Total/summary row, not individual staff).

For WPS reports, extract from the "Total" column:
{
  "type": "wps",
  "year": 2026,
  "dateRange": "23 Feb - 01 Mar",
  "kpis": {
    "paid_hours": 212.8,
    "total_sales": 65917,
    "nett_sales": 45068,
    "num_transactions": 85,
    "num_items": 107,
    "avg_sale": 530,
    "ips": 1.07,
    "tph": 0.40,
    "sph": 310,
    "pct_off_retail": 34,
    "above_min_sell_pct": 75,
    "above_min_sell_count": 80,
    "below_min_sell_pct": 25,
    "below_min_sell_count": 27,
    "credit_sales_count": 17,
    "credit_sales_avg": 2192,
    "pcp_attach_rate": 19
  }
}

For MIN reports, extract the Total row AND count how many individual staff members achieved Gold Star (their nett_sales >= their gold_star_target):
{
  "type": "min",
  "year": 2026,
  "dateRange": "01 Mar 2026",
  "kpis": {
    "paid_hours": 213,
    "black_dot_target": 48959,
    "gold_star_target": 53216,
    "nett_sales": 45068,
    "pct_of_target": 85,
    "stretch_platinum_target": 63860,
    "pct_stretch_platinum": 71,
    "staff_count": 8,
    "gold_star_count": 3
  }
}
staff_count = total number of individual staff rows (excluding the Total row). Count each person's row carefully.
gold_star_count = number of staff whose individual Nett Sales >= their individual Gold Star Target. Compare EACH person's Nett Sales to THEIR Gold Star Target individually — do NOT use the store total % Of Target.

For ONYX reports, extract the store total row (e.g. "Metrotown Centre"):
{
  "type": "onyx",
  "year": 2026,
  "dateRange": "23 Feb - 01 Mar",
  "kpis": {
    "net_sales": 45068,
    "customer_orders": 9386,
    "qty": 107,
    "trans": 85,
    "ips": 1.07,
    "pcp_pct": 19.44,
    "gs_gp_pct": 56.03
  }
}

For WPS reports, ALSO extract individual staff member data in a "staff" array. Each staff entry should include the person's name and their individual KPIs:
{
  "type": "wps",
  "year": 2026,
  "dateRange": "23 Feb - 01 Mar",
  "kpis": { ... total row as above ... },
  "staff": [
    {
      "name": "Sarah K",
      "paid_hours": 32,
      "nett_sales": 8500,
      "avg_sale": 425,
      "ips": 0.95,
      "tph": 0.35,
      "sph": 266,
      "above_min_sell_pct": 60,
      "credit_sales_count": 2,
      "credit_sales_avg": 1800,
      "pcp_attach_rate": 12
    }
  ]
}
Include ALL staff members visible in the report. Use their name exactly as shown.

For ONYX reports, ALSO extract individual staff member data in a "staff" array:
{
  "type": "onyx",
  "year": 2026,
  "dateRange": "23 Feb - 01 Mar",
  "kpis": { ... store total row as above ... },
  "staff": [
    {
      "name": "Sarah K",
      "gs_gp_pct": 54.2
    }
  ]
}
Include ALL staff members visible in the report. Use their name exactly as shown. Extract gs_gp_pct (GS GP%) for each person.

For MIN reports, ALSO extract a "staff" array with just the names of each individual staff member listed:
{
  "type": "min",
  ...
  "staff": [
    {"name": "Sarah K"},
    {"name": "John D"}
  ]
}
Include ALL individual staff members visible in the report (excluding the Total row). Use their name exactly as shown.

Rules:
- Extract exact numbers as shown. Remove $ and % signs, commas.
- Use the dates shown in the report for dateRange and year.
- For the main "kpis" object, extract the TOTAL/store summary row.
- For the "staff" array (WPS only), extract each individual staff member's row.
- Return ONLY the JSON object, no other text.`,
    })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
    })

    let text = response.content[0].text.trim()
    // Strip markdown fences and any surrounding text — extract the JSON object
    text = text.replace(/^```json?\s*/im, '').replace(/\s*```\s*$/im, '')
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end === -1) {
      return res.status(400).json({ error: 'Could not read this image. Make sure it is a Managers Trade Report screenshot.' })
    }
    text = text.slice(start, end + 1)

    let result
    try { result = JSON.parse(text) } catch (parseErr) {
      console.error('JSON parse failed. Raw text:', text.slice(0, 300))
      return res.status(400).json({ error: 'Failed to parse report data. Try a clearer screenshot.' })
    }

    // Check if Claude detected a wrong report type
    if (result.error === 'invalid_report') {
      const detected = result.detected || 'unknown report type'
      return res.status(400).json({ error: `Not a valid report — detected "${detected}". Please upload WPS, MIN planner, or Onyx screenshots.` })
    }

    res.json(result)
  } catch (err) {
    console.error('OCR report error:', err)
    res.status(500).json({ error: err.message })
  }
}

// ── Booking System ──────────────────────────────────────────────
const BOOKING_DIR = join(__dirname, 'data', 'booking')
if (!existsSync(BOOKING_DIR)) mkdirSync(BOOKING_DIR, { recursive: true })

const SHORT_LINKS_FILE = join(BOOKING_DIR, 'short-links.json')

const STORES_FILE = join(BOOKING_DIR, 'stores.json')
const PROFESSIONALS_FILE = join(BOOKING_DIR, 'professionals.json')
const AVAILABILITY_FILE = join(BOOKING_DIR, 'availability.json')
const BOOKINGS_FILE = join(BOOKING_DIR, 'bookings.json')
const PERSONAL_TIME_FILE = join(BOOKING_DIR, 'personal-time.json')
const REMINDER_CONFIG_FILE = join(BOOKING_DIR, 'reminder-config.json')
const REMINDER_SENT_FILE = join(BOOKING_DIR, 'reminders-sent.json')

function loadJson(filepath, fallback = []) {
  try { return JSON.parse(readFileSync(filepath, 'utf8')) }
  catch { return fallback }
}
function saveJson(filepath, data) {
  writeFileSync(filepath, JSON.stringify(data, null, 2))
}

// Booking hash for passwordless customer access
const HASH_SECRET = 'mh-booking-2024'
function generateBookingHash(bookingId) {
  return crypto.createHmac('sha256', HASH_SECRET).update(bookingId).digest('hex').slice(0, 16)
}

// Email via Resend
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const EMAIL_FROM = process.env.EMAIL_FROM || 'notifications@synergytrading.net'

async function sendBookingEmail(to, subject, html, replyTo) {
  if (!resend) {
    console.log(`[Email stub] To: ${to} | Subject: ${subject}`)
    return
  }
  try {
    const opts = { from: EMAIL_FROM, to, subject, html }
    if (replyTo) opts.reply_to = replyTo
    const result = await resend.emails.send(opts)
    console.log(`[Email] Sent to ${to} | Subject: ${subject} | result:`, JSON.stringify(result))
  } catch (err) {
    console.error('Email send error:', err.message)
  }
}

// Test email endpoint
app.post('/api/booking/test-reminder', async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'email required' })
  await sendBookingEmail(email, 'Test Reminder - Michael Hill', `<h2>Appointment Reminder</h2>
    <p>This is a <strong>test</strong> reminder email.</p>
    <p>If you received this, appointment reminders are working correctly!</p>`)
  res.json({ ok: true, sent: email })
})

// ── URL Shortener (Bitly, cached) ──
const BITLY_TOKEN = process.env.BITLY_TOKEN || '34078ac222b144b3657fc2d6d000495090b6dd4e'

app.post('/api/shorten', async (req, res) => {
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'url required' })
  const cache = loadJson(SHORT_LINKS_FILE, {})
  if (cache[url]) return res.json({ short: cache[url] })
  try {
    const r = await fetch('https://api-ssl.bitly.com/v4/shorten', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BITLY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ long_url: url }),
    })
    const data = await r.json()
    if (data.link) {
      cache[url] = data.link
      saveJson(SHORT_LINKS_FILE, cache)
      return res.json({ short: data.link })
    }
    res.status(500).json({ error: data.message || 'Failed to shorten' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Stores CRUD ──
app.get('/api/booking/stores', (req, res) => {
  res.json(loadJson(STORES_FILE, []))
})

app.post('/api/booking/stores', (req, res) => {
  const { name, address } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  const stores = loadJson(STORES_FILE, [])
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  if (stores.find(s => s.id === id)) return res.status(409).json({ error: 'Store already exists' })
  stores.push({ id, name, address: address || '', timezone: 'America/Vancouver' })
  saveJson(STORES_FILE, stores)
  res.json({ ok: true, store: stores[stores.length - 1] })
})

app.put('/api/booking/stores/:id', (req, res) => {
  const stores = loadJson(STORES_FILE, [])
  const idx = stores.findIndex(s => s.id === req.params.id)
  if (idx < 0) return res.status(404).json({ error: 'Not found' })
  const { name, address, timezone, managerEmail } = req.body
  if (name) stores[idx].name = name
  if (address !== undefined) stores[idx].address = address
  if (timezone) stores[idx].timezone = timezone
  if (managerEmail !== undefined) stores[idx].managerEmail = managerEmail
  saveJson(STORES_FILE, stores)
  res.json({ ok: true, store: stores[idx] })
})

app.delete('/api/booking/stores/:id', (req, res) => {
  let stores = loadJson(STORES_FILE, [])
  stores = stores.filter(s => s.id !== req.params.id)
  saveJson(STORES_FILE, stores)
  res.json({ ok: true })
})

// ── Sales Professionals CRUD ──
app.get('/api/booking/professionals', (req, res) => {
  const pros = loadJson(PROFESSIONALS_FILE, [])
  const { store } = req.query
  if (store) return res.json(pros.filter(p => p.storeId === store))
  res.json(pros)
})

app.get('/api/booking/professionals/:slug', (req, res) => {
  const pros = loadJson(PROFESSIONALS_FILE, [])
  const pro = pros.find(p => p.slug === req.params.slug)
  if (!pro) return res.status(404).json({ error: 'Not found' })
  const stores = loadJson(STORES_FILE, [])
  const store = stores.find(s => s.id === pro.storeId)
  res.json({ ...pro, store: store || null })
})

app.post('/api/booking/professionals', (req, res) => {
  const { name, email, storeId, phone } = req.body
  if (!name || !email || !storeId) return res.status(400).json({ error: 'name, email, storeId required' })
  const pros = loadJson(PROFESSIONALS_FILE, [])
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  if (pros.find(p => p.slug === slug)) return res.status(409).json({ error: 'Professional with this name already exists' })
  const pro = { id: Date.now().toString(), slug, name, email, storeId, phone: phone || '', googleCalendarConnected: false }
  pros.push(pro)
  saveJson(PROFESSIONALS_FILE, pros)
  res.json({ ok: true, professional: pro })
})

app.get('/api/booking/slug-check/:slug', (req, res) => {
  const pros = loadJson(PROFESSIONALS_FILE, [])
  const slug = req.params.slug.toLowerCase().replace(/[^a-z0-9-]+/g, '')
  const taken = pros.some(p => p.slug === slug)
  res.json({ slug, available: !taken })
})

app.put('/api/booking/professionals/:id', (req, res) => {
  const pros = loadJson(PROFESSIONALS_FILE, [])
  const idx = pros.findIndex(p => p.id === req.params.id)
  if (idx < 0) return res.status(404).json({ error: 'Not found' })
  const { name, email, storeId, phone, slug } = req.body
  if (slug) {
    const clean = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '')
    if (!clean) return res.status(400).json({ error: 'Invalid slug' })
    if (pros.some(p => p.slug === clean && p.id !== req.params.id)) return res.status(409).json({ error: 'Slug already taken' })
    pros[idx].slug = clean
  }
  if (name) {
    pros[idx].name = name
    if (!slug) pros[idx].slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  }
  if (email) pros[idx].email = email
  if (storeId) pros[idx].storeId = storeId
  if (phone !== undefined) pros[idx].phone = phone
  if (req.body.defaultDuration !== undefined) pros[idx].defaultDuration = parseInt(req.body.defaultDuration) || 60
  if (req.body.bufferMinutes !== undefined) pros[idx].bufferMinutes = parseInt(req.body.bufferMinutes) || 0
  if (req.body.bookingTypes !== undefined) pros[idx].bookingTypes = req.body.bookingTypes
  saveJson(PROFESSIONALS_FILE, pros)
  res.json({ ok: true, professional: pros[idx] })
})

app.delete('/api/booking/professionals/:id', (req, res) => {
  let pros = loadJson(PROFESSIONALS_FILE, [])
  pros = pros.filter(p => p.id !== req.params.id)
  saveJson(PROFESSIONALS_FILE, pros)
  res.json({ ok: true })
})

// ── Availability ──
// Availability format: { professionalId, dayOfWeek (0-6), slots: [{start: "09:00", end: "09:30"}], date (optional for specific date overrides) }
app.get('/api/booking/availability/:professionalId', (req, res) => {
  const all = loadJson(AVAILABILITY_FILE, [])
  res.json(all.filter(a => a.professionalId === req.params.professionalId))
})

app.post('/api/booking/availability', (req, res) => {
  const { professionalId, dayOfWeek, slots, date } = req.body
  if (!professionalId || (dayOfWeek === undefined && !date)) return res.status(400).json({ error: 'professionalId and dayOfWeek or date required' })
  const all = loadJson(AVAILABILITY_FILE, [])
  // Remove existing for same professional + day/date
  const filtered = all.filter(a => {
    if (a.professionalId !== professionalId) return true
    if (date) return a.date !== date
    return a.dayOfWeek !== dayOfWeek
  })
  filtered.push({ professionalId, dayOfWeek: dayOfWeek ?? null, date: date || null, slots: slots || [] })
  saveJson(AVAILABILITY_FILE, filtered)
  res.json({ ok: true })
})

app.delete('/api/booking/availability', (req, res) => {
  const { professionalId, dayOfWeek, date } = req.body
  if (!professionalId) return res.status(400).json({ error: 'professionalId required' })
  let all = loadJson(AVAILABILITY_FILE, [])
  all = all.filter(a => {
    if (a.professionalId !== professionalId) return true
    if (date) return a.date !== date
    if (dayOfWeek !== undefined) return a.dayOfWeek !== dayOfWeek
    return false
  })
  saveJson(AVAILABILITY_FILE, all)
  res.json({ ok: true })
})

// ── Personal Time (blocked time) ──
app.get('/api/booking/personal-time/:professionalId', (req, res) => {
  const all = loadJson(PERSONAL_TIME_FILE, [])
  res.json(all.filter(pt => pt.professionalId === req.params.professionalId))
})

app.post('/api/booking/personal-time', (req, res) => {
  const { professionalId, date, start, end, label } = req.body
  if (!professionalId || !date || !start || !end) return res.status(400).json({ error: 'professionalId, date, start, and end required' })
  const all = loadJson(PERSONAL_TIME_FILE, [])
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  all.push({ id, professionalId, date, start, end, label: label || 'Personal Time' })
  saveJson(PERSONAL_TIME_FILE, all)
  res.json({ ok: true, id })
})

app.delete('/api/booking/personal-time/:id', (req, res) => {
  let all = loadJson(PERSONAL_TIME_FILE, [])
  all = all.filter(pt => pt.id !== req.params.id)
  saveJson(PERSONAL_TIME_FILE, all)
  res.json({ ok: true })
})

// Convert "HH:MM" to minutes since midnight
function timeToMinutes(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function minutesToTime(m) { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }

// Get available days for a professional (next 30 days)
app.get('/api/booking/available-days/:professionalId', (req, res) => {
  const { professionalId } = req.params
  const all = loadJson(AVAILABILITY_FILE, [])
  const proAvail = all.filter(a => a.professionalId === professionalId)
  if (!proAvail.length) return res.json({ days: [] })

  const days = []
  const today = new Date()
  for (let i = 1; i <= 30; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const iso = d.toISOString().split('T')[0]
    const dow = d.getDay()
    let avail = proAvail.find(a => a.date === iso)
    if (!avail) avail = proAvail.find(a => a.dayOfWeek === dow && !a.date)
    if (avail && avail.slots?.length) days.push(iso)
  }
  res.json({ days })
})

// Get available slots for a professional on a specific date
app.get('/api/booking/slots/:professionalId/:date', (req, res) => {
  const { professionalId, date } = req.params
  const all = loadJson(AVAILABILITY_FILE, [])
  const bookings = loadJson(BOOKINGS_FILE, [])
  const pros = loadJson(PROFESSIONALS_FILE, [])
  const pro = pros.find(p => p.id === professionalId)
  const duration = pro?.defaultDuration || 60
  const buffer = pro?.bufferMinutes || 0

  // Check for date-specific override first, then fall back to day of week
  const d = new Date(date + 'T00:00:00')
  const dow = d.getDay()

  let avail = all.find(a => a.professionalId === professionalId && a.date === date)
  if (!avail) avail = all.find(a => a.professionalId === professionalId && a.dayOfWeek === dow && !a.date)

  if (!avail || !avail.slots?.length) return res.json({ slots: [] })

  // Get booked time ranges (with buffer)
  const bookedRanges = bookings
    .filter(b => b.professionalId === professionalId && b.date === date && b.status !== 'declined' && b.status !== 'cancelled')
    .map(b => {
      const start = timeToMinutes(b.time)
      const dur = b.duration || duration
      return { start, end: start + dur }
    })

  // Add personal time blocks as blocked ranges
  const personalTime = loadJson(PERSONAL_TIME_FILE, [])
  personalTime
    .filter(pt => pt.professionalId === professionalId && pt.date === date)
    .forEach(pt => bookedRanges.push({ start: timeToMinutes(pt.start), end: timeToMinutes(pt.end) }))

  const overlaps = (slotStart, slotEnd) => bookedRanges.some(r => slotStart < r.end + buffer && slotEnd > r.start - buffer)

  // Generate individual time slots from availability blocks
  const available = []
  for (const block of avail.slots) {
    const blockStart = timeToMinutes(block.start)
    const blockEnd = timeToMinutes(block.end)
    for (let t = blockStart; t + duration <= blockEnd; t += 30) {
      const end = t + duration
      if (!overlaps(t, end)) {
        available.push({ start: minutesToTime(t), end: minutesToTime(end) })
      }
    }
  }
  res.json({ slots: available })
})

// ── Bookings CRUD ──
app.get('/api/booking/bookings', (req, res) => {
  const bookings = loadJson(BOOKINGS_FILE, [])
  const { professionalId, status } = req.query
  let filtered = bookings
  if (professionalId) filtered = filtered.filter(b => b.professionalId === professionalId)
  if (status) filtered = filtered.filter(b => b.status === status)
  res.json(filtered)
})

app.post('/api/booking/bookings', async (req, res) => {
  const { storeId, professionalId, bookingType, date, time, firstName, lastName, email, phone } = req.body
  if (!firstName) return res.status(400).json({ error: 'First name is required' })
  if (!email && !phone) return res.status(400).json({ error: 'Email or phone number is required' })
  if (!storeId || !professionalId || !date || !time) return res.status(400).json({ error: 'Store, professional, date, and time are required' })

  const bookings = loadJson(BOOKINGS_FILE, [])
  const pros = loadJson(PROFESSIONALS_FILE, [])
  const pro = pros.find(p => p.id === professionalId)
  const duration = pro?.defaultDuration || 60
  const buffer = pro?.bufferMinutes || 0

  // Check slot is still available (with duration + buffer overlap check)
  const reqStart = timeToMinutes(time)
  const reqEnd = reqStart + duration
  const conflict = bookings.find(b => {
    if (b.professionalId !== professionalId || b.date !== date) return false
    if (b.status === 'declined' || b.status === 'cancelled') return false
    const bStart = timeToMinutes(b.time)
    const bEnd = bStart + (b.duration || duration)
    return reqStart < bEnd + buffer && reqEnd > bStart - buffer
  })
  if (conflict) return res.status(409).json({ error: 'This time slot is no longer available' })

  const booking = {
    id: Date.now().toString(),
    storeId,
    professionalId,
    bookingType: bookingType || 'product-viewing',
    date,
    time,
    duration,
    firstName,
    lastName: lastName || '',
    email: email || '',
    phone: phone || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  booking.hash = generateBookingHash(booking.id)
  bookings.push(booking)
  saveJson(BOOKINGS_FILE, bookings)

  // Notify professional via email
  const stores = loadJson(STORES_FILE, [])
  const store = stores.find(s => s.id === storeId)
  if (pro?.email) {
    await sendBookingEmail(
      pro.notifyEmail || pro.email,
      `New Booking Request - ${firstName} ${lastName || ''}`,
      `<h2>New Booking Request</h2>
      <p><strong>Customer:</strong> ${firstName} ${lastName || ''}</p>
      <p><strong>Email:</strong> ${email || 'N/A'}</p>
      <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
      <p><strong>Type:</strong> ${(bookingType || 'product-viewing').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
      <p><strong>Store:</strong> ${store?.name || storeId}</p>
      <p><strong>Date:</strong> ${date}</p>
      <p><strong>Time:</strong> ${time}</p>
      <p>Please log in to accept or decline this booking.</p>`
    )
  }

  // Confirm to customer via email
  if (email) {
    const profileUrl = pro?.slug ? `https://mh.bachvu.com/sp/${pro.slug}?chat=${booking.hash}` : ''
    const contactBtn = profileUrl
      ? `<p style="margin-top:16px"><a href="${profileUrl}" style="display:inline-block;padding:10px 20px;background:#4c6335;color:#fff;text-decoration:none;border-radius:6px;">Contact ${pro?.name || 'Us'}</a></p>
         <p style="font-size:12px;color:#888;">Have questions? Click above to send a message, or simply reply to this email.</p>`
      : ''
    await sendBookingEmail(
      email,
      `Booking Received - ${store?.name || 'Michael Hill'}`,
      `<h2>Thank You for Your Booking!</h2>
      <p>Hi ${firstName}, your appointment request has been received and is pending confirmation.</p>
      <p><strong>With:</strong> ${pro?.name || 'Our team'}</p>
      <p><strong>Store:</strong> ${store?.name || ''}</p>
      <p><strong>Date:</strong> ${date}</p>
      <p><strong>Time:</strong> ${time}</p>
      <p><strong>Duration:</strong> ${duration} minutes</p>
      <p>You'll receive another email once your appointment is confirmed.</p>
      ${contactBtn}`,
      `booking+${booking.id}@bachvu.com`
    )
  }

  res.json({ ok: true, booking })
})

// Update booking status (accept/decline/reschedule)
app.put('/api/booking/bookings/:id', async (req, res) => {
  const bookings = loadJson(BOOKINGS_FILE, [])
  const idx = bookings.findIndex(b => b.id === req.params.id)
  if (idx < 0) return res.status(404).json({ error: 'Booking not found' })

  const { status, newDate, newTime, note, bookingType } = req.body
  const booking = bookings[idx]
  const oldDate = booking.date
  const oldTime = booking.time
  if (status) booking.status = status
  if (newDate) booking.date = newDate
  if (newTime) booking.time = newTime
  if (note) booking.note = note
  if (bookingType) booking.bookingType = bookingType
  booking.updatedAt = new Date().toISOString()

  bookings[idx] = booking
  saveJson(BOOKINGS_FILE, bookings)

  // Notify customer
  const pros = loadJson(PROFESSIONALS_FILE, [])
  const pro = pros.find(p => p.id === booking.professionalId)
  const stores = loadJson(STORES_FILE, [])
  const store = stores.find(s => s.id === booking.storeId)

  if (booking.email) {
    let subject, body
    const dur = booking.duration || 60
    const tz = store?.timezone || 'America/Vancouver'
    const bookingHash = booking.hash || generateBookingHash(booking.id)
    if (!booking.hash) { booking.hash = bookingHash; bookings[idx] = booking; saveJson(BOOKINGS_FILE, bookings) }
    const contactUrl = pro?.slug ? `https://mh.bachvu.com/sp/${pro.slug}?chat=${bookingHash}` : ''
    const contactFooter = contactUrl
      ? `<p style="margin-top:16px"><a href="${contactUrl}" style="display:inline-block;padding:10px 20px;background:#4c6335;color:#fff;text-decoration:none;border-radius:6px;">Contact ${pro?.name || 'Us'}</a></p>
         <p style="font-size:12px;color:#888;">Have questions? Click above to send a message, or simply reply to this email.</p>`
      : ''

    // Build Google Calendar link for customer
    function buildCalLink(b) {
      const datePart = b.date.replace(/-/g, '')
      const startMin = timeToMinutes(b.time)
      const endMin = startMin + dur
      const startT = b.time.replace(':', '') + '00'
      const endT = minutesToTime(endMin).replace(':', '') + '00'
      const title = encodeURIComponent(`Appointment with ${pro?.name || 'Michael Hill'}`)
      const details = encodeURIComponent(`At ${store?.name || 'Michael Hill'}${store?.address ? `, ${store.address}` : ''}`)
      const loc = encodeURIComponent(store?.address || store?.name || '')
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${datePart}T${startT}/${datePart}T${endT}&ctz=${encodeURIComponent(tz)}&details=${details}&location=${loc}`
    }

    if (status === 'accepted') {
      const calLink = buildCalLink(booking)
      subject = `Booking Confirmed - ${store?.name || 'Michael Hill'}`
      body = `<h2>Your Booking is Confirmed!</h2>
        <p>Your appointment with <strong>${pro?.name || 'our team'}</strong> has been confirmed.</p>
        <p><strong>Store:</strong> ${store?.name || ''}</p>
        <p><strong>Date:</strong> ${booking.date}</p>
        <p><strong>Time:</strong> ${booking.time}</p>
        <p><strong>Duration:</strong> ${dur} minutes</p>
        <p><a href="${calLink}" style="display:inline-block;padding:10px 20px;background:#4c6335;color:#fff;text-decoration:none;border-radius:6px;">Add to Google Calendar</a></p>
        <p>We look forward to seeing you!</p>
        ${contactFooter}`
    } else if (status === 'cancelled') {
      subject = `Booking Cancelled - ${store?.name || 'Michael Hill'}`
      body = `<h2>Booking Cancelled</h2>
        <p>Your booking with <strong>${pro?.name || 'our team'}</strong> on ${oldDate} at ${oldTime} has been cancelled.</p>
        ${note ? `<p><strong>Note:</strong> ${note}</p>` : ''}
        <p>Please visit our booking page to schedule a new appointment.</p>
        ${contactFooter}`
    } else if (status === 'declined') {
      subject = `Booking Update - ${store?.name || 'Michael Hill'}`
      body = `<h2>Booking Update</h2>
        <p>Unfortunately, your booking with <strong>${pro?.name || 'our team'}</strong> on ${oldDate} at ${oldTime} could not be confirmed.</p>
        ${note ? `<p><strong>Note:</strong> ${note}</p>` : ''}
        <p>Please visit our booking page to schedule a new appointment.</p>
        ${contactFooter}`
    } else if (newDate || newTime) {
      const calLink = buildCalLink(booking)
      subject = `Booking Rescheduled - ${store?.name || 'Michael Hill'}`
      body = `<h2>Your Booking Has Been Rescheduled</h2>
        <p>Your appointment with <strong>${pro?.name || 'our team'}</strong> has been updated.</p>
        <p><strong>New Date:</strong> ${booking.date}</p>
        <p><strong>New Time:</strong> ${booking.time}</p>
        <p><strong>Duration:</strong> ${dur} minutes</p>
        <p><strong>Store:</strong> ${store?.name || ''}</p>
        ${note ? `<p><strong>Note:</strong> ${note}</p>` : ''}
        <p><a href="${calLink}" style="display:inline-block;padding:10px 20px;background:#4c6335;color:#fff;text-decoration:none;border-radius:6px;">Add to Google Calendar</a></p>
        <p>We look forward to seeing you!</p>
        ${contactFooter}`
    }
    if (subject) {
      const replyTo = `booking+${booking.id}@bachvu.com`
      await sendBookingEmail(booking.email, subject, body, replyTo)
    }
  }

  // Google Calendar sync
  if (pro?.googleCalendarConnected) {
    if (status === 'accepted') {
      const calResult = await syncBookingToCalendar(booking.professionalId, booking.id)
      if (calResult.ok) console.log(`Calendar event created for booking ${booking.id}`)
      else console.log(`Calendar sync failed for booking ${booking.id}: ${calResult.error}`)
    } else if ((status === 'cancelled' || status === 'declined') && booking.googleCalendarEventId) {
      const calResult = await deleteCalendarEvent(booking.professionalId, booking.googleCalendarEventId)
      if (calResult.ok) console.log(`Calendar event deleted for booking ${booking.id}`)
      else console.log(`Calendar delete failed for booking ${booking.id}: ${calResult.error}`)
    } else if ((newDate || newTime) && booking.googleCalendarEventId) {
      const calResult = await updateCalendarEvent(booking.professionalId, booking)
      if (calResult.ok) console.log(`Calendar event updated for booking ${booking.id}`)
      else console.log(`Calendar update failed for booking ${booking.id}: ${calResult.error}`)
    }
  }

  res.json({ ok: true, booking })
})

app.delete('/api/booking/bookings/:id', (req, res) => {
  let bookings = loadJson(BOOKINGS_FILE, [])
  bookings = bookings.filter(b => b.id !== req.params.id)
  saveJson(BOOKINGS_FILE, bookings)
  res.json({ ok: true })
})

// Auto-decline expired pending bookings (runs every hour)
function autoDeclineExpired() {
  const bookings = loadJson(BOOKINGS_FILE, [])
  const today = new Date().toISOString().split('T')[0]
  let changed = false
  for (const b of bookings) {
    if (b.status === 'pending' && b.date < today) {
      b.status = 'expired'
      b.updatedAt = new Date().toISOString()
      changed = true
    }
  }
  if (changed) {
    saveJson(BOOKINGS_FILE, bookings)
    console.log('[Auto-expire] Expired past-due pending bookings')
  }
}
setInterval(autoDeclineExpired, 60 * 60 * 1000)
setTimeout(autoDeclineExpired, 5000) // run shortly after startup

// ── Google Calendar Sync ──
const GOOGLE_CLIENT_ID = '565529210106-1561m2330dqaqks6116vekq35saorlgs.apps.googleusercontent.com'
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''

// Exchange authorization code for tokens (authorization code flow)
app.post('/api/booking/google-calendar/connect', async (req, res) => {
  const { professionalId, code, redirectUri } = req.body
  if (!professionalId || !code) return res.status(400).json({ error: 'professionalId and code required' })
  if (!GOOGLE_CLIENT_SECRET) return res.status(500).json({ error: 'GOOGLE_CLIENT_SECRET not configured' })

  const pros = loadJson(PROFESSIONALS_FILE, [])
  const idx = pros.findIndex(p => p.id === professionalId)
  if (idx < 0) return res.status(404).json({ error: 'Professional not found' })

  try {
    // Exchange code for tokens
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    const tokens = await tokenResp.json()
    if (tokens.error) return res.status(400).json({ error: tokens.error_description || tokens.error })

    pros[idx].googleCalendarConnected = true
    pros[idx].googleCalendarTokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + (tokens.expires_in * 1000),
    }
    saveJson(PROFESSIONALS_FILE, pros)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/booking/google-calendar/disconnect', (req, res) => {
  const { professionalId } = req.body
  const pros = loadJson(PROFESSIONALS_FILE, [])
  const idx = pros.findIndex(p => p.id === professionalId)
  if (idx < 0) return res.status(404).json({ error: 'Professional not found' })
  pros[idx].googleCalendarConnected = false
  delete pros[idx].googleCalendarTokens
  saveJson(PROFESSIONALS_FILE, pros)
  res.json({ ok: true })
})

// Refresh access token if expired
async function refreshAccessToken(pro) {
  if (!pro.googleCalendarTokens?.refreshToken || !GOOGLE_CLIENT_SECRET) return null
  if (pro.googleCalendarTokens.expiresAt && Date.now() < pro.googleCalendarTokens.expiresAt - 60000) {
    return pro.googleCalendarTokens.accessToken // still valid
  }
  try {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: pro.googleCalendarTokens.refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    const data = await resp.json()
    if (data.error) { console.error('Token refresh failed:', data.error); return null }
    // Update stored tokens
    const pros = loadJson(PROFESSIONALS_FILE, [])
    const idx = pros.findIndex(p => p.id === pro.id)
    if (idx >= 0) {
      pros[idx].googleCalendarTokens.accessToken = data.access_token
      pros[idx].googleCalendarTokens.expiresAt = Date.now() + (data.expires_in * 1000)
      saveJson(PROFESSIONALS_FILE, pros)
    }
    return data.access_token
  } catch (err) {
    console.error('Token refresh error:', err.message)
    return null
  }
}

// Create a Google Calendar event for a booking
async function syncBookingToCalendar(professionalId, bookingId) {
  const pros = loadJson(PROFESSIONALS_FILE, [])
  const pro = pros.find(p => p.id === professionalId)
  if (!pro?.googleCalendarConnected || !pro?.googleCalendarTokens) return { ok: false, error: 'Calendar not connected' }

  const accessToken = await refreshAccessToken(pro)
  if (!accessToken) return { ok: false, error: 'Failed to get access token' }

  const bookings = loadJson(BOOKINGS_FILE, [])
  const booking = bookings.find(b => b.id === bookingId)
  if (!booking) return { ok: false, error: 'Booking not found' }

  const stores = loadJson(STORES_FILE, [])
  const store = stores.find(s => s.id === booking.storeId)

  const timezone = store?.timezone || 'America/Vancouver'
  const duration = booking.duration || 60
  const startDateTime = `${booking.date}T${booking.time}:00`
  const endMinutes = timeToMinutes(booking.time) + duration
  const endTime = minutesToTime(endMinutes)
  const endDateTime = `${booking.date}T${endTime}:00`

  const event = {
    summary: `Booking: ${booking.firstName} ${booking.lastName}`,
    description: `Customer: ${booking.firstName} ${booking.lastName}${booking.email ? `\nEmail: ${booking.email}` : ''}${booking.phone ? `\nPhone: ${booking.phone}` : ''}`,
    location: store?.address || store?.name || '',
    start: { dateTime: startDateTime, timeZone: timezone },
    end: { dateTime: endDateTime, timeZone: timezone },
  }

  try {
    const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    })
    const result = await resp.json()
    if (result.error) return { ok: false, error: result.error.message }

    // Store eventId on the booking
    const allBookings = loadJson(BOOKINGS_FILE, [])
    const bIdx = allBookings.findIndex(b => b.id === bookingId)
    if (bIdx >= 0) {
      allBookings[bIdx].googleCalendarEventId = result.id
      saveJson(BOOKINGS_FILE, allBookings)
    }

    return { ok: true, eventId: result.id }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// Update a Google Calendar event (for reschedule)
async function updateCalendarEvent(professionalId, booking) {
  const pros = loadJson(PROFESSIONALS_FILE, [])
  const pro = pros.find(p => p.id === professionalId)
  if (!pro?.googleCalendarConnected || !booking.googleCalendarEventId) return { ok: false }

  const accessToken = await refreshAccessToken(pro)
  if (!accessToken) return { ok: false, error: 'Failed to get access token' }

  const stores = loadJson(STORES_FILE, [])
  const store = stores.find(s => s.id === booking.storeId)
  const timezone = store?.timezone || 'America/Vancouver'
  const dur = booking.duration || 60

  const startDateTime = `${booking.date}T${booking.time}:00`
  const endMinutes = timeToMinutes(booking.time) + dur
  const endTimeStr = minutesToTime(endMinutes)
  const endDateTime = `${booking.date}T${endTimeStr}:00`

  try {
    const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${booking.googleCalendarEventId}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: `Booking: ${booking.firstName} ${booking.lastName}`,
        description: `Customer: ${booking.firstName} ${booking.lastName}${booking.email ? `\nEmail: ${booking.email}` : ''}${booking.phone ? `\nPhone: ${booking.phone}` : ''}`,
        location: store?.address || store?.name || '',
        start: { dateTime: startDateTime, timeZone: timezone },
        end: { dateTime: endDateTime, timeZone: timezone },
      }),
    })
    const result = await resp.json()
    if (result.error) return { ok: false, error: result.error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// Delete a Google Calendar event (for cancel/decline)
async function deleteCalendarEvent(professionalId, eventId) {
  const pros = loadJson(PROFESSIONALS_FILE, [])
  const pro = pros.find(p => p.id === professionalId)
  if (!pro?.googleCalendarConnected || !eventId) return { ok: false }

  const accessToken = await refreshAccessToken(pro)
  if (!accessToken) return { ok: false, error: 'Failed to get access token' }

  try {
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// Manual sync endpoint
app.post('/api/booking/google-calendar/sync', async (req, res) => {
  const { professionalId, bookingId } = req.body
  const result = await syncBookingToCalendar(professionalId, bookingId)
  if (!result.ok) return res.status(400).json(result)
  res.json(result)
})

// Geo cache for IP lookups
const GEO_CACHE_FILE = join(__dirname, 'data', 'geo-cache.json')

function loadGeoCache() {
  try {
    if (existsSync(GEO_CACHE_FILE)) return JSON.parse(readFileSync(GEO_CACHE_FILE, 'utf8'))
  } catch {}
  return {}
}

function saveGeoCache(cache) {
  writeFileSync(GEO_CACHE_FILE, JSON.stringify(cache))
}

async function resolveGeo(ips) {
  const cache = loadGeoCache()
  const unknown = ips.filter(ip => !cache[ip] && ip !== '127.0.0.1' && ip !== '::1')
  const unique = [...new Set(unknown)]

  // ip-api.com batch endpoint (free, max 100 per request, 15 req/min)
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100)
    try {
      const resp = await fetch('http://ip-api.com/batch?fields=query,city,regionName,country', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      })
      const results = await resp.json()
      for (const r of results) {
        if (r.city) {
          cache[r.query] = { city: r.city, region: r.regionName, country: r.country }
        }
      }
    } catch {}
  }

  saveGeoCache(cache)
  return cache
}

// Access log API
app.get('/api/access-log', async (req, res) => {
  const log = loadAccessLog()
  const ips = [...new Set(log.map(e => e.ip).filter(Boolean))]
  const geo = await resolveGeo(ips)

  const enriched = log.map(e => ({
    ...e,
    geo: geo[e.ip] || null,
  }))

  res.json(enriched)
})

// ── SP Profile & Product Images ──────────────────────────────────
const SP_UPLOADS_DIR = join(BOOKING_DIR, 'uploads')
if (!existsSync(SP_UPLOADS_DIR)) mkdirSync(SP_UPLOADS_DIR, { recursive: true })

// Upload profile picture for a professional
app.post('/api/booking/professionals/:id/profile-picture', (req, res) => {
  const { image } = req.body
  if (!image) return res.status(400).json({ error: 'image required' })
  const match = image.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!match) return res.status(400).json({ error: 'Invalid base64 image' })

  const pros = loadJson(PROFESSIONALS_FILE, [])
  const pro = pros.find(p => p.id === req.params.id)
  if (!pro) return res.status(404).json({ error: 'Professional not found' })

  const ext = match[1] === 'jpeg' ? 'jpg' : match[1]
  const filename = `profile-${pro.id}.${ext}`
  const filepath = join(SP_UPLOADS_DIR, filename)
  writeFileSync(filepath, Buffer.from(match[2], 'base64'))

  // Also write to dist if it exists
  const distUploadsDir = join(__dirname, 'dist', 'booking-uploads')
  if (existsSync(join(__dirname, 'dist'))) {
    if (!existsSync(distUploadsDir)) mkdirSync(distUploadsDir, { recursive: true })
    writeFileSync(join(distUploadsDir, filename), Buffer.from(match[2], 'base64'))
  }

  pro.profilePicture = `/booking-uploads/${filename}`
  saveJson(PROFESSIONALS_FILE, pros)
  res.json({ ok: true, url: pro.profilePicture })
})

// Update professional bio/tagline
app.put('/api/booking/professionals/:id/profile', (req, res) => {
  const pros = loadJson(PROFESSIONALS_FILE, [])
  const idx = pros.findIndex(p => p.id === req.params.id)
  if (idx < 0) return res.status(404).json({ error: 'Not found' })

  const { bio, tagline, specialties, notifyEmail } = req.body
  if (bio !== undefined) pros[idx].bio = bio
  if (tagline !== undefined) pros[idx].tagline = tagline
  if (specialties !== undefined) pros[idx].specialties = specialties
  if (notifyEmail !== undefined) pros[idx].notifyEmail = notifyEmail
  saveJson(PROFESSIONALS_FILE, pros)
  res.json({ ok: true, professional: pros[idx] })
})

// Serve uploads
app.use('/booking-uploads', express.static(SP_UPLOADS_DIR))

// ── Product Images for SP ──
const PRODUCT_IMAGES_FILE = join(BOOKING_DIR, 'product-images.json')

app.get('/api/booking/professionals/:id/products', (req, res) => {
  const all = loadJson(PRODUCT_IMAGES_FILE, [])
  res.json(all.filter(p => p.professionalId === req.params.id))
})

app.post('/api/booking/professionals/:id/products', (req, res) => {
  const { image, title, description, price } = req.body
  if (!image) return res.status(400).json({ error: 'image required' })

  const match = image.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!match) return res.status(400).json({ error: 'Invalid base64 image' })

  const ext = match[1] === 'jpeg' ? 'jpg' : match[1]
  const id = Date.now().toString()
  const filename = `product-${req.params.id}-${id}.${ext}`
  writeFileSync(join(SP_UPLOADS_DIR, filename), Buffer.from(match[2], 'base64'))

  const distUploadsDir = join(__dirname, 'dist', 'booking-uploads')
  if (existsSync(join(__dirname, 'dist'))) {
    if (!existsSync(distUploadsDir)) mkdirSync(distUploadsDir, { recursive: true })
    writeFileSync(join(distUploadsDir, filename), Buffer.from(match[2], 'base64'))
  }

  const all = loadJson(PRODUCT_IMAGES_FILE, [])
  const product = {
    id,
    professionalId: req.params.id,
    imageUrl: `/booking-uploads/${filename}`,
    title: title || '',
    description: description || '',
    price: price || '',
    createdAt: new Date().toISOString(),
  }
  all.push(product)
  saveJson(PRODUCT_IMAGES_FILE, all)
  res.json({ ok: true, product })
})

app.put('/api/booking/products/:productId', (req, res) => {
  const all = loadJson(PRODUCT_IMAGES_FILE, [])
  const idx = all.findIndex(p => p.id === req.params.productId)
  if (idx < 0) return res.status(404).json({ error: 'Not found' })
  const { title, description, price } = req.body
  if (title !== undefined) all[idx].title = title
  if (description !== undefined) all[idx].description = description
  if (price !== undefined) all[idx].price = price
  saveJson(PRODUCT_IMAGES_FILE, all)
  res.json({ ok: true, product: all[idx] })
})

app.delete('/api/booking/products/:productId', (req, res) => {
  const all = loadJson(PRODUCT_IMAGES_FILE, [])
  const product = all.find(p => p.id === req.params.productId)
  if (product) {
    const filename = product.imageUrl.split('/').pop()
    const filepath = join(SP_UPLOADS_DIR, filename)
    if (existsSync(filepath)) unlinkSync(filepath)
    const distPath = join(__dirname, 'dist', 'booking-uploads', filename)
    if (existsSync(distPath)) unlinkSync(distPath)
  }
  saveJson(PRODUCT_IMAGES_FILE, all.filter(p => p.id !== req.params.productId))
  res.json({ ok: true })
})

// Verify booking hash and auto-start conversation
app.get('/api/booking/verify-hash/:hash', (req, res) => {
  const bookings = loadJson(BOOKINGS_FILE, [])
  const booking = bookings.find(b => b.hash === req.params.hash)
  if (!booking) return res.status(404).json({ error: 'Invalid link' })

  const pros = loadJson(PROFESSIONALS_FILE, [])
  const pro = pros.find(p => p.id === booking.professionalId)

  // Auto-create or find conversation
  const convos = loadJson(CONVERSATIONS_FILE, [])
  let convo = null
  if (booking.email) {
    convo = convos.find(c => c.professionalId === booking.professionalId && c.customerEmail === booking.email)
  }
  if (!convo) {
    convo = {
      id: Date.now().toString(),
      professionalId: booking.professionalId,
      customerName: `${booking.firstName} ${booking.lastName}`.trim(),
      customerEmail: booking.email || '',
      customerPhone: booking.phone || '',
      createdAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
    }
    convos.push(convo)
    saveJson(CONVERSATIONS_FILE, convos)
  }

  res.json({
    customerName: `${booking.firstName} ${booking.lastName}`.trim(),
    customerEmail: booking.email,
    professionalId: booking.professionalId,
    professionalName: pro?.name || '',
    conversationId: convo.id,
  })
})

// ── Inbound Email Webhook (Resend) ──────────────────────────────────
app.post('/api/booking/inbound-email', async (req, res) => {
  try {
    // Resend sends event webhooks (email.sent, email.delivered etc) — ignore those
    if (req.body.type && req.body.type !== 'email.received') {
      return res.json({ ok: true })
    }

    const data = req.body.data || req.body
    const { from, to, subject, email_id, text, html } = data
    console.log(`[Inbound Email] From: ${from} | To: ${JSON.stringify(to)} | Subject: ${subject}`)

    // Get email body — fetch from Resend API if not in webhook payload
    let emailText = text || (html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '') || ''
    if (!emailText && email_id) {
      try {
        const emailData = await fetch(`https://api.resend.com/emails/${email_id}`, {
          headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` }
        }).then(r => r.json())
        emailText = emailData.text || (emailData.html ? emailData.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '') || ''
        console.log(`[Inbound Email] Fetched body: ${emailText.substring(0, 200)}`)
      } catch (err) {
        console.error('[Inbound Email] Failed to fetch email:', err.message)
      }
    }

    // Try to find booking by reply-to address (booking+{id}@bachvu.com)
    const toAddrs = Array.isArray(to) ? to : [to]
    const toAddr = toAddrs.find(a => a?.includes('booking+')) || toAddrs[0]
    let bookingId = null
    const addrMatch = toAddr?.match(/booking\+(\d+)@/)
    if (addrMatch) {
      bookingId = addrMatch[1]
    }

    // Fallback: find booking by sender email
    const senderEmail = (typeof from === 'string' ? from : from?.email || '').toLowerCase()
    const bookings = loadJson(BOOKINGS_FILE, [])
    let booking = bookingId ? bookings.find(b => b.id === bookingId) : null
    if (!booking && senderEmail) {
      // Find most recent accepted booking for this email
      booking = bookings
        .filter(b => b.email?.toLowerCase() === senderEmail)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
    }
    if (!booking) {
      console.log(`[Inbound Email] No booking found for ${senderEmail}`)
      return res.json({ ok: true })
    }
    console.log(`[Inbound Email] Matched booking ${booking.id} for ${booking.firstName} ${booking.lastName}`)

    // Get or create conversation
    const convos = loadJson(CONVERSATIONS_FILE, [])
    let convo = null
    if (booking.email) {
      convo = convos.find(c => c.professionalId === booking.professionalId && c.customerEmail === booking.email)
    }
    if (!convo) {
      convo = {
        id: Date.now().toString(),
        professionalId: booking.professionalId,
        customerName: `${booking.firstName} ${booking.lastName}`.trim(),
        customerEmail: booking.email || '',
        customerPhone: booking.phone || '',
        createdAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
      }
      convos.push(convo)
      saveJson(CONVERSATIONS_FILE, convos)
    }

    // Extract plain text content, strip email signatures/quoted text
    let content = (emailText || subject?.replace(/^Re:\s*/i, '') || '').trim()
    // Remove quoted reply (lines starting with >)
    content = content.split('\n').filter(l => !l.startsWith('>')).join('\n').trim()
    // Remove "On ... wrote:" blocks
    content = content.split(/\nOn .+ wrote:\s*$/m)[0].trim()
    // Remove common email footers
    content = content.split(/\n--\s*\n/)[0].trim()

    if (!content) {
      console.log('[Inbound Email] Empty message content after cleanup')
      return res.json({ ok: true })
    }

    // Create message
    const messages = loadJson(MESSAGES_FILE, [])
    const msg = {
      id: Date.now().toString(),
      conversationId: convo.id,
      sender: `${booking.firstName} ${booking.lastName}`.trim(),
      senderType: 'customer',
      content: content.substring(0, 2000),
      createdAt: new Date().toISOString(),
      source: 'email',
    }
    messages.push(msg)
    saveJson(MESSAGES_FILE, messages)

    // Update conversation lastMessageAt
    convo.lastMessageAt = msg.createdAt
    saveJson(CONVERSATIONS_FILE, convos)

    // Notify SP
    const pros = loadJson(PROFESSIONALS_FILE, [])
    const pro = pros.find(p => p.id === booking.professionalId)
    if (pro?.email) {
      await sendBookingEmail(
        pro.notifyEmail || pro.email,
        `New message from ${booking.firstName} ${booking.lastName}`.trim(),
        `<h2>New Message (via email reply)</h2>
        <p><strong>${booking.firstName} ${booking.lastName}</strong>:</p>
        <p>${content.substring(0, 500).replace(/\n/g, '<br>')}</p>`
      )
    }

    console.log(`[Inbound Email] Message created for booking ${bookingId}, convo ${convo.id}`)
    res.json({ ok: true })
  } catch (err) {
    console.error('[Inbound Email] Error:', err.message)
    res.status(500).json({ error: 'Internal error' })
  }
})

// ── Messaging System ──────────────────────────────────────────────
const CONVERSATIONS_FILE = join(BOOKING_DIR, 'conversations.json')
const MESSAGES_FILE = join(BOOKING_DIR, 'messages.json')

// Get or create a conversation between a customer and a professional
app.post('/api/booking/conversations', (req, res) => {
  const { professionalId, customerName, customerEmail, customerPhone } = req.body
  if (!professionalId || !customerName) return res.status(400).json({ error: 'professionalId and customerName required' })

  const convos = loadJson(CONVERSATIONS_FILE, [])

  // Check if conversation already exists for this customer + pro
  let existing = null
  if (customerEmail) {
    existing = convos.find(c => c.professionalId === professionalId && c.customerEmail === customerEmail)
  }
  if (!existing && customerPhone) {
    existing = convos.find(c => c.professionalId === professionalId && c.customerPhone === customerPhone)
  }

  if (existing) return res.json(existing)

  const convo = {
    id: Date.now().toString(),
    professionalId,
    customerName,
    customerEmail: customerEmail || '',
    customerPhone: customerPhone || '',
    createdAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
  }
  convos.push(convo)
  saveJson(CONVERSATIONS_FILE, convos)
  res.json(convo)
})

// Get conversations for a professional
app.get('/api/booking/conversations/:professionalId', (req, res) => {
  const convos = loadJson(CONVERSATIONS_FILE, [])
  const messages = loadJson(MESSAGES_FILE, [])
  const proConvos = convos
    .filter(c => c.professionalId === req.params.professionalId)
    .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
    .map(c => {
      const lastMsg = messages.filter(m => m.conversationId === c.id).pop()
      return { ...c, lastMessage: lastMsg?.content?.substring(0, 80) || '' }
    })
  res.json(proConvos)
})

// Get messages for a conversation
app.get('/api/booking/messages/:conversationId', (req, res) => {
  const messages = loadJson(MESSAGES_FILE, [])
  res.json(messages.filter(m => m.conversationId === req.params.conversationId))
})

// Send a message
app.post('/api/booking/messages', async (req, res) => {
  const { conversationId, sender, senderType, content } = req.body
  if (!conversationId || !content || !senderType) return res.status(400).json({ error: 'conversationId, content, senderType required' })

  const messages = loadJson(MESSAGES_FILE, [])
  const msg = {
    id: Date.now().toString(),
    conversationId,
    sender: sender || 'Anonymous',
    senderType, // 'customer' or 'professional'
    content,
    createdAt: new Date().toISOString(),
  }
  messages.push(msg)
  saveJson(MESSAGES_FILE, messages)

  // Update conversation lastMessageAt
  const convos = loadJson(CONVERSATIONS_FILE, [])
  const convo = convos.find(c => c.id === conversationId)
  if (convo) {
    convo.lastMessageAt = msg.createdAt
    saveJson(CONVERSATIONS_FILE, convos)

    // Email notify the other party
    if (senderType === 'customer' && convo.professionalId) {
      const pros = loadJson(PROFESSIONALS_FILE, [])
      const pro = pros.find(p => p.id === convo.professionalId)
      if (pro?.email) {
        await sendBookingEmail(pro.notifyEmail || pro.email, `New message from ${sender || convo.customerName}`,
          `<h2>New Message</h2><p><strong>${sender || convo.customerName}:</strong></p><p>${content.substring(0, 500)}</p>`)
      }
    }
  }

  res.json({ ok: true, message: msg })
})

// --- Reminder Config API ---
app.get('/api/booking/reminder-config', (req, res) => {
  const config = loadJson(REMINDER_CONFIG_FILE, { enabled: true, hoursBefore: 24 })
  res.json(config)
})

app.put('/api/booking/reminder-config', (req, res) => {
  const { enabled, hoursBefore } = req.body
  const config = loadJson(REMINDER_CONFIG_FILE, { enabled: true, hoursBefore: 24 })
  if (typeof enabled === 'boolean') config.enabled = enabled
  if (typeof hoursBefore === 'number' && hoursBefore > 0) config.hoursBefore = hoursBefore
  saveJson(REMINDER_CONFIG_FILE, config)
  res.json({ ok: true, config })
})

// --- Appointment Reminder Scheduler ---
function startReminderScheduler() {
  const CHECK_INTERVAL = 15 * 60 * 1000 // check every 15 minutes

  async function checkReminders() {
    try {
      const config = loadJson(REMINDER_CONFIG_FILE, { enabled: true, hoursBefore: 24 })
      if (!config.enabled) return

      const bookings = loadJson(BOOKINGS_FILE, [])
      const pros = loadJson(PROFESSIONALS_FILE, [])
      const stores = loadJson(STORES_FILE, [])
      const sent = loadJson(REMINDER_SENT_FILE, [])
      const sentSet = new Set(sent)

      const now = new Date()
      let newSent = false

      for (const booking of bookings) {
        if (booking.status !== 'accepted') continue
        if (!booking.email) continue
        if (sentSet.has(booking.id)) continue

        const store = stores.find(s => s.id === booking.storeId)
        const tz = store?.timezone || 'America/Vancouver'

        // Parse booking datetime in store timezone
        const bookingDateStr = `${booking.date}T${booking.time}:00`
        // Use Intl to get UTC offset for this timezone
        const bookingDate = new Date(bookingDateStr)
        // Approximate: create date in target timezone
        const tzNow = new Date(now.toLocaleString('en-US', { timeZone: tz }))
        const tzBooking = new Date(bookingDate.toLocaleString('en-US', { timeZone: tz }))
        // We want: bookingTime - now <= hoursBefore AND bookingTime > now
        const hoursUntil = (tzBooking - tzNow) / (1000 * 60 * 60)

        if (hoursUntil > 0 && hoursUntil <= config.hoursBefore) {
          const pro = pros.find(p => p.id === booking.professionalId)
          const dur = booking.duration || 60

          const bookingHash = booking.hash || generateBookingHash(booking.id)
          if (!booking.hash) { booking.hash = bookingHash; saveJson(BOOKINGS_FILE, bookings) }
          const profileUrl = pro?.slug ? `https://mh.bachvu.com/sp/${pro.slug}?chat=${bookingHash}` : ''
          const contactSection = profileUrl
            ? `<p style="margin-top:16px"><a href="${profileUrl}" style="display:inline-block;padding:10px 20px;background:#4c6335;color:#fff;text-decoration:none;border-radius:6px;">Contact ${pro?.name || 'Us'}</a></p>
               <p style="font-size:12px;color:#888;">Need to reschedule or have questions? Send a message through the link above.</p>`
            : (pro?.email ? `<p>Need to reach us? Email <a href="mailto:${pro.email}">${pro.email}</a></p>` : '')

          await sendBookingEmail(
            booking.email,
            `Appointment Reminder - ${store?.name || 'Michael Hill'}`,
            `<h2>Appointment Reminder</h2>
            <p>This is a friendly reminder about your upcoming appointment.</p>
            <p><strong>With:</strong> ${pro?.name || 'Our team'}</p>
            <p><strong>Store:</strong> ${store?.name || ''}</p>
            <p><strong>Date:</strong> ${booking.date}</p>
            <p><strong>Time:</strong> ${booking.time}</p>
            <p><strong>Duration:</strong> ${dur} minutes</p>
            ${store?.address ? `<p><strong>Address:</strong> ${store.address}</p>` : ''}
            <p>We look forward to seeing you!</p>
            ${contactSection}`
          )

          sentSet.add(booking.id)
          newSent = true
          console.log(`[Reminder] Sent reminder to ${booking.email} for booking ${booking.id} on ${booking.date} ${booking.time}`)
        }
      }

      if (newSent) {
        saveJson(REMINDER_SENT_FILE, [...sentSet])
      }

      // Cleanup: remove sent IDs for past bookings (older than 7 days)
      const cutoff = new Date(now)
      cutoff.setDate(cutoff.getDate() - 7)
      const activeIds = new Set(bookings.filter(b => new Date(b.date) >= cutoff).map(b => b.id))
      const pruned = [...sentSet].filter(id => activeIds.has(id))
      if (pruned.length < sentSet.size) {
        saveJson(REMINDER_SENT_FILE, pruned)
      }
    } catch (err) {
      console.error('[Reminder] Error checking reminders:', err.message)
    }
  }

  // Run immediately on startup, then every 15 minutes
  setTimeout(checkReminders, 10000)
  setInterval(checkReminders, CHECK_INTERVAL)
  console.log('[Reminder] Scheduler started (checking every 15 minutes)')
}

// --- Repairs search (Puppeteer scraper for jewelryrepairstudio.com) ---
let repairBrowser = null
let repairPage = null
let repairSessionTimer = null
const REPAIR_SESSION_TTL = 5 * 60 * 1000 // 5 min

async function getRepairSession() {
  const puppeteer = (await import('puppeteer')).default
  if (repairPage) {
    clearTimeout(repairSessionTimer)
    repairSessionTimer = setTimeout(closeRepairSession, REPAIR_SESSION_TTL)
    return repairPage
  }

  repairBrowser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  })
  repairPage = await repairBrowser.newPage()
  await repairPage.setViewport({ width: 1280, height: 900 })

  // Login to jewelryrepairstudio.com
  await repairPage.goto('https://jewelryrepairstudio.com/Login.aspx', { waitUntil: 'networkidle2', timeout: 30000 })
  await repairPage.evaluate((store, pass) => {
    document.getElementById('txtStoreNumber').value = store
    document.getElementById('txtPassword').value = pass
    const rdoCanada = document.getElementById('rdoCanada')
    if (rdoCanada) rdoCanada.checked = true
  }, process.env.REPAIR_STORE_NUMBER || '', process.env.REPAIR_PASSWORD || '')
  repairPage.evaluate(() => { fnLogin() }).catch(() => {})
  await repairPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})

  // MyStore.aspx does auto-postbacks — use CDP Fetch to block them
  const client = await repairPage.createCDPSession()
  await client.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] })
  let blockNavigation = true
  client.on('Fetch.requestPaused', async (event) => {
    try {
      if (blockNavigation && event.resourceType === 'Document' && event.request.url.includes('MyStore.aspx') && event.request.method === 'POST') {
        await client.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'Aborted' })
      } else {
        await client.send('Fetch.continueRequest', { requestId: event.requestId })
      }
    } catch {}
  })

  await repairPage.goto('https://jewelryrepairstudio.com/MyStore.aspx', { waitUntil: 'networkidle2', timeout: 30000 })
  repairPage._setBlockNav = (v) => { blockNavigation = v }

  repairSessionTimer = setTimeout(closeRepairSession, REPAIR_SESSION_TTL)
  console.log('[Repairs] Session ready')
  return repairPage
}

async function closeRepairSession() {
  try { if (repairBrowser) await repairBrowser.close() } catch {}
  repairBrowser = null
  repairPage = null
  repairSessionTimer = null
}

app.post('/api/repairs/search', async (req, res) => {
  const { query } = req.body
  if (!query || !query.trim()) return res.status(400).json({ error: 'Search query required' })

  try {
    const page = await getRepairSession()

    if (!page.url().includes('MyStore.aspx')) {
      await page.goto('https://jewelryrepairstudio.com/MyStore.aspx', { waitUntil: 'networkidle2', timeout: 30000 })
    }

    // Enter search query and submit
    page._setBlockNav(false)
    await page.evaluate((q) => {
      const input = document.getElementById('ContentPlaceHolder1_txtJobNumber')
      if (input) input.value = q
    }, query.trim())
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
      page.click('#ContentPlaceHolder1_btnSearch'),
    ])
    page._setBlockNav(true)
    await new Promise(r => setTimeout(r, 500))

    // Scrape results table
    const scrapedOrders = await page.evaluate(() => {
      const tables = document.querySelectorAll('table')
      for (const table of tables) {
        const headerRow = table.querySelector('tr')
        if (!headerRow) continue
        if (!headerRow.textContent.includes('Job #')) continue
        const headers = [...headerRow.querySelectorAll('th, td')].map(h => h.textContent.trim())
        const rows = [...table.querySelectorAll('tr')].slice(1)
        const results = []
        for (const row of rows) {
          const cells = [...row.querySelectorAll('td')].map(c => c.textContent.trim())
          if (cells.length < 5) continue
          const entry = {}
          headers.forEach((h, j) => { entry[h] = cells[j] || '' })
          results.push(entry)
        }
        return results
      }
      return []
    })

    const orders = scrapedOrders.map(o => ({
      jobNumber: o['Job #'] || '',
      dateIn: o['Date In'] || '',
      dueInStore: o['Due in Store'] || o['Due In Store'] || '',
      estimateDate: o['Estimate Date'] || '',
      invoiceDate: o['Invoice Date'] || '',
      lastUser: o['Last User'] || '',
      tracking: o['Tracking#'] || '',
      status: o['Rush'] || '',
    }))

    res.json({ orders })
  } catch (err) {
    console.error('[Repairs] Search error:', err.message)
    await closeRepairSession()
    res.status(500).json({ error: 'Search failed: ' + err.message })
  }
})

// In production, serve the built Vite app
const distDir = join(__dirname, 'dist')
if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('/{*path}', (req, res) => {
    res.sendFile(join(distDir, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`MH server running on http://localhost:${PORT}`)
  startReminderScheduler()
})
