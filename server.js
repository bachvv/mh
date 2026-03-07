import express from 'express'
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import { config } from 'dotenv'
import { createTransport } from 'nodemailer'

// Load env
config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env') })

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 4400

app.use(express.json({ limit: '50mb' }))

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
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
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
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const mediaMatch = imageBase64.match(/^data:(image\/\w+);base64,/)
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

    content.push({
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64Data },
    })

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

For MIN reports, extract the Total row:
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
    "pct_stretch_platinum": 71
  }
}

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

Rules:
- Extract exact numbers as shown. Remove $ and % signs, commas.
- Use the dates shown in the report for dateRange and year.
- Only extract the TOTAL/store summary row, not individual staff rows.
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

const STORES_FILE = join(BOOKING_DIR, 'stores.json')
const PROFESSIONALS_FILE = join(BOOKING_DIR, 'professionals.json')
const AVAILABILITY_FILE = join(BOOKING_DIR, 'availability.json')
const BOOKINGS_FILE = join(BOOKING_DIR, 'bookings.json')

function loadJson(filepath, fallback = []) {
  try { return JSON.parse(readFileSync(filepath, 'utf8')) }
  catch { return fallback }
}
function saveJson(filepath, data) {
  writeFileSync(filepath, JSON.stringify(data, null, 2))
}

// Email transporter (configure via env vars)
let emailTransporter = null
if (process.env.SMTP_HOST) {
  emailTransporter = createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

async function sendBookingEmail(to, subject, html) {
  if (!emailTransporter) {
    console.log(`[Email stub] To: ${to} | Subject: ${subject}`)
    return
  }
  try {
    await emailTransporter.sendMail({
      from: process.env.SMTP_FROM || 'bookings@michaelhill.com',
      to,
      subject,
      html,
    })
  } catch (err) {
    console.error('Email send error:', err.message)
  }
}

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
  stores.push({ id, name, address: address || '' })
  saveJson(STORES_FILE, stores)
  res.json({ ok: true, store: stores[stores.length - 1] })
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
  res.json(pro)
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

app.put('/api/booking/professionals/:id', (req, res) => {
  const pros = loadJson(PROFESSIONALS_FILE, [])
  const idx = pros.findIndex(p => p.id === req.params.id)
  if (idx < 0) return res.status(404).json({ error: 'Not found' })
  const { name, email, storeId, phone } = req.body
  if (name) {
    pros[idx].name = name
    pros[idx].slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  }
  if (email) pros[idx].email = email
  if (storeId) pros[idx].storeId = storeId
  if (phone !== undefined) pros[idx].phone = phone
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

// Get available slots for a professional on a specific date
app.get('/api/booking/slots/:professionalId/:date', (req, res) => {
  const { professionalId, date } = req.params
  const all = loadJson(AVAILABILITY_FILE, [])
  const bookings = loadJson(BOOKINGS_FILE, [])

  // Check for date-specific override first, then fall back to day of week
  const d = new Date(date + 'T00:00:00')
  const dow = d.getDay()

  let avail = all.find(a => a.professionalId === professionalId && a.date === date)
  if (!avail) avail = all.find(a => a.professionalId === professionalId && a.dayOfWeek === dow && !a.date)

  if (!avail || !avail.slots?.length) return res.json({ slots: [] })

  // Filter out already booked slots
  const bookedSlots = bookings
    .filter(b => b.professionalId === professionalId && b.date === date && b.status !== 'declined')
    .map(b => b.time)

  const available = avail.slots.filter(s => !bookedSlots.includes(s.start))
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
  const { storeId, professionalId, date, time, firstName, lastName, email, phone } = req.body
  if (!firstName) return res.status(400).json({ error: 'First name is required' })
  if (!email && !phone) return res.status(400).json({ error: 'Email or phone number is required' })
  if (!storeId || !professionalId || !date || !time) return res.status(400).json({ error: 'Store, professional, date, and time are required' })

  const bookings = loadJson(BOOKINGS_FILE, [])

  // Check slot is still available
  const conflict = bookings.find(b =>
    b.professionalId === professionalId && b.date === date && b.time === time && b.status !== 'declined'
  )
  if (conflict) return res.status(409).json({ error: 'This time slot is no longer available' })

  const booking = {
    id: Date.now().toString(),
    storeId,
    professionalId,
    date,
    time,
    firstName,
    lastName: lastName || '',
    email: email || '',
    phone: phone || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  bookings.push(booking)
  saveJson(BOOKINGS_FILE, bookings)

  // Notify professional via email
  const pros = loadJson(PROFESSIONALS_FILE, [])
  const pro = pros.find(p => p.id === professionalId)
  const stores = loadJson(STORES_FILE, [])
  const store = stores.find(s => s.id === storeId)
  if (pro?.email) {
    await sendBookingEmail(
      pro.email,
      `New Booking Request - ${firstName} ${lastName || ''}`,
      `<h2>New Booking Request</h2>
      <p><strong>Customer:</strong> ${firstName} ${lastName || ''}</p>
      <p><strong>Email:</strong> ${email || 'N/A'}</p>
      <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
      <p><strong>Store:</strong> ${store?.name || storeId}</p>
      <p><strong>Date:</strong> ${date}</p>
      <p><strong>Time:</strong> ${time}</p>
      <p>Please log in to accept or decline this booking.</p>`
    )
  }

  res.json({ ok: true, booking })
})

// Update booking status (accept/decline/reschedule)
app.put('/api/booking/bookings/:id', async (req, res) => {
  const bookings = loadJson(BOOKINGS_FILE, [])
  const idx = bookings.findIndex(b => b.id === req.params.id)
  if (idx < 0) return res.status(404).json({ error: 'Booking not found' })

  const { status, newDate, newTime, note } = req.body
  const booking = bookings[idx]
  const oldDate = booking.date
  const oldTime = booking.time

  if (status) booking.status = status
  if (newDate) booking.date = newDate
  if (newTime) booking.time = newTime
  if (note) booking.note = note
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
    if (status === 'accepted') {
      subject = `Booking Confirmed - ${store?.name || 'Michael Hill'}`
      body = `<h2>Your Booking is Confirmed!</h2>
        <p>Your appointment with <strong>${pro?.name || 'our team'}</strong> has been confirmed.</p>
        <p><strong>Store:</strong> ${store?.name || ''}</p>
        <p><strong>Date:</strong> ${booking.date}</p>
        <p><strong>Time:</strong> ${booking.time}</p>
        <p>We look forward to seeing you!</p>`
    } else if (status === 'declined') {
      subject = `Booking Update - ${store?.name || 'Michael Hill'}`
      body = `<h2>Booking Update</h2>
        <p>Unfortunately, your booking with <strong>${pro?.name || 'our team'}</strong> on ${oldDate} at ${oldTime} could not be confirmed.</p>
        ${note ? `<p><strong>Note:</strong> ${note}</p>` : ''}
        <p>Please visit our booking page to schedule a new appointment.</p>`
    } else if (newDate || newTime) {
      subject = `Booking Rescheduled - ${store?.name || 'Michael Hill'}`
      body = `<h2>Your Booking Has Been Rescheduled</h2>
        <p>Your appointment with <strong>${pro?.name || 'our team'}</strong> has been updated.</p>
        <p><strong>New Date:</strong> ${booking.date}</p>
        <p><strong>New Time:</strong> ${booking.time}</p>
        <p><strong>Store:</strong> ${store?.name || ''}</p>
        ${note ? `<p><strong>Note:</strong> ${note}</p>` : ''}
        <p>We look forward to seeing you!</p>`
    }
    if (subject) await sendBookingEmail(booking.email, subject, body)
  }

  res.json({ ok: true, booking })
})

app.delete('/api/booking/bookings/:id', (req, res) => {
  let bookings = loadJson(BOOKINGS_FILE, [])
  bookings = bookings.filter(b => b.id !== req.params.id)
  saveJson(BOOKINGS_FILE, bookings)
  res.json({ ok: true })
})

// ── Google Calendar Sync ──
// Store Google Calendar tokens for professionals
app.post('/api/booking/google-calendar/connect', (req, res) => {
  const { professionalId, accessToken, refreshToken } = req.body
  if (!professionalId) return res.status(400).json({ error: 'professionalId required' })
  const pros = loadJson(PROFESSIONALS_FILE, [])
  const idx = pros.findIndex(p => p.id === professionalId)
  if (idx < 0) return res.status(404).json({ error: 'Professional not found' })
  pros[idx].googleCalendarConnected = true
  pros[idx].googleCalendarTokens = { accessToken, refreshToken }
  saveJson(PROFESSIONALS_FILE, pros)
  res.json({ ok: true })
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

// Sync a booking to Google Calendar (creates event)
app.post('/api/booking/google-calendar/sync', async (req, res) => {
  const { professionalId, bookingId } = req.body
  const pros = loadJson(PROFESSIONALS_FILE, [])
  const pro = pros.find(p => p.id === professionalId)
  if (!pro?.googleCalendarTokens?.accessToken) return res.status(400).json({ error: 'Google Calendar not connected' })

  const bookings = loadJson(BOOKINGS_FILE, [])
  const booking = bookings.find(b => b.id === bookingId)
  if (!booking) return res.status(404).json({ error: 'Booking not found' })

  const stores = loadJson(STORES_FILE, [])
  const store = stores.find(s => s.id === booking.storeId)

  // Create Google Calendar event
  const startDateTime = `${booking.date}T${booking.time}:00`
  const [h, m] = booking.time.split(':').map(Number)
  const endMin = m + 30
  const endH = h + Math.floor(endMin / 60)
  const endM = endMin % 60
  const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
  const endDateTime = `${booking.date}T${endTime}:00`

  const event = {
    summary: `Booking: ${booking.firstName} ${booking.lastName}`,
    description: `Customer: ${booking.firstName} ${booking.lastName}\nEmail: ${booking.email}\nPhone: ${booking.phone}`,
    location: store?.address || store?.name || '',
    start: { dateTime: startDateTime, timeZone: 'Pacific/Auckland' },
    end: { dateTime: endDateTime, timeZone: 'Pacific/Auckland' },
  }

  try {
    const https = await import('https')
    const postData = JSON.stringify(event)
    const result = await new Promise((resolve, reject) => {
      const r = https.request({
        hostname: 'www.googleapis.com',
        path: '/calendar/v3/calendars/primary/events',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${pro.googleCalendarTokens.accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      }, (resp) => {
        let data = ''
        resp.on('data', c => data += c)
        resp.on('end', () => {
          try { resolve(JSON.parse(data)) } catch { resolve({ error: data }) }
        })
      })
      r.on('error', reject)
      r.write(postData)
      r.end()
    })
    res.json({ ok: true, event: result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
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

  const { bio, tagline, specialties } = req.body
  if (bio !== undefined) pros[idx].bio = bio
  if (tagline !== undefined) pros[idx].tagline = tagline
  if (specialties !== undefined) pros[idx].specialties = specialties
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
        await sendBookingEmail(pro.email, `New message from ${sender || convo.customerName}`,
          `<h2>New Message</h2><p><strong>${sender || convo.customerName}:</strong></p><p>${content.substring(0, 500)}</p>`)
      }
    }
  }

  res.json({ ok: true, message: msg })
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
})
