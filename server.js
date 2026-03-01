import express from 'express'
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import { config } from 'dotenv'

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
