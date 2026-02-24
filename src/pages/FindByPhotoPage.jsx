import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import catalog from '../data/catalog.json'

const IMAGE_BASE = 'https://prod-sfcc-api.michaelhill.com/dw/image/v2/AANC_PRD/on/demandware.static/-/Sites-MHJ_Master/default/images'
const IMAGES_KEY = 'wedder-style-images'
const SKU_KEY = 'wedder-skus'

function loadStyleImages() {
  try { return JSON.parse(localStorage.getItem(IMAGES_KEY)) || {} }
  catch { return {} }
}

function loadSkuMap() {
  try { return JSON.parse(localStorage.getItem(SKU_KEY)) || {} }
  catch { return {} }
}

function getImageUrl(product) {
  return `${IMAGE_BASE}/${product.p}/${product.m}?sw=600&sm=fit&q=80`
}

// Extract color histogram from an image via canvas
function getColorHistogram(canvas, ctx) {
  const w = canvas.width
  const h = canvas.height
  const data = ctx.getImageData(0, 0, w, h).data
  const bins = 8
  const hist = new Float64Array(bins * bins * bins)
  const step = 256 / bins
  let total = 0

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a < 128) continue
    const rBin = Math.min(Math.floor(data[i] / step), bins - 1)
    const gBin = Math.min(Math.floor(data[i + 1] / step), bins - 1)
    const bBin = Math.min(Math.floor(data[i + 2] / step), bins - 1)
    hist[rBin * bins * bins + gBin * bins + bBin]++
    total++
  }

  if (total > 0) {
    for (let i = 0; i < hist.length; i++) hist[i] /= total
  }
  return hist
}

function compareHistograms(a, b) {
  let intersection = 0
  for (let i = 0; i < a.length; i++) {
    intersection += Math.min(a[i], b[i])
  }
  return intersection
}

function imageToHistogram(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const size = 64
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, size, size)
      resolve(getColorHistogram(canvas, ctx))
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// Build categories from catalog + special ones
const CATALOG_CATEGORIES = Object.keys(catalog).sort((a, b) => {
  return (catalog[b]?.length || 0) - (catalog[a]?.length || 0)
})

const CATEGORIES = [
  ...CATALOG_CATEGORIES.map(cat => ({
    id: `catalog:${cat}`,
    label: `${cat} (${catalog[cat].length})`,
  })),
  { id: 'wedders-local', label: 'Wedders (Saved Styles)' },
]

function FindByPhotoPage() {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [category, setCategory] = useState(CATEGORIES[0].id)
  const [progress, setProgress] = useState('')

  const processFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      const src = e.target.result
      setPreview(src)
      setLoading(true)
      setResults(null)
      setProgress('Analyzing photo...')

      const uploadHist = await imageToHistogram(src)
      if (!uploadHist) {
        setResults([])
        setLoading(false)
        return
      }

      let matches = []

      if (category === 'wedders-local') {
        const styleImages = loadStyleImages()
        const skuMap = loadSkuMap()
        const entries = Object.entries(styleImages)
        for (const [styleId, imgSrc] of entries) {
          const hist = await imageToHistogram(imgSrc)
          if (!hist) continue
          const score = compareHistograms(uploadHist, hist)
          const styleSkus = []
          for (const [pKey, sku] of Object.entries(skuMap)) {
            if (pKey.startsWith(styleId + '|') && sku) {
              styleSkus.push(sku)
            }
          }
          matches.push({ id: styleId, name: styleId, score, image: imgSrc, skus: styleSkus })
        }
      } else if (category.startsWith('catalog:')) {
        const catName = category.slice(8)
        const products = catalog[catName] || []
        for (let idx = 0; idx < products.length; idx++) {
          const p = products[idx]
          if (!p.m) continue
          if (idx % 10 === 0) setProgress(`Comparing ${idx + 1}/${products.length}...`)
          const url = getImageUrl(p)
          const hist = await imageToHistogram(url)
          if (!hist) continue
          const score = compareHistograms(uploadHist, hist)
          matches.push({
            id: p.s,
            name: p.n,
            score,
            image: url,
            sku: p.s,
          })
        }
      }

      matches.sort((a, b) => b.score - a.score)
      setResults(matches.slice(0, 12))
      setLoading(false)
      setProgress('')
    }
    reader.readAsDataURL(file)
  }, [category])

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const currentCat = CATEGORIES.find(c => c.id === category)

  return (
    <div className="fbp-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/findsku')}>SKU Finder</button>
        <h1>Find by Photo</h1>
      </div>

      <div className="fbp-category-select">
        <label className="fbp-cat-label">Category</label>
        <select
          className="fbp-cat-dropdown"
          value={category}
          onChange={(e) => { setCategory(e.target.value); setResults(null) }}
        >
          {CATEGORIES.map(c => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="fbp-upload-card">
        <div
          className={`fbp-dropzone${dragOver ? ' fbp-dropzone--active' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => { if (e.target.files[0]) processFile(e.target.files[0]); e.target.value = '' }}
          />
          {preview ? (
            <img src={preview} alt="Uploaded" className="fbp-preview-img" />
          ) : (
            <>
              <div className="fbp-dropzone-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
              <span className="fbp-dropzone-text">Drop a photo here or tap to upload</span>
              <span className="fbp-dropzone-hint">Matches against {currentCat?.label}</span>
            </>
          )}
        </div>
        {preview && (
          <button
            className="fbp-clear-btn"
            onClick={() => { setPreview(null); setResults(null) }}
          >
            Clear
          </button>
        )}
      </div>

      {loading && (
        <div className="fbp-loading">{progress || 'Comparing images...'}</div>
      )}

      {results && results.length === 0 && !loading && (
        <div className="fbp-empty">No matches found in this category.</div>
      )}

      {results && results.length > 0 && !loading && (
        <div className="fbp-results">
          <div className="wedder-step-label">Best Matches</div>
          <div className="fbp-results-grid">
            {results.map((m, i) => (
              <div key={m.id + '-' + i} className="fbp-result-card">
                <div className="fbp-result-img-wrap">
                  <img src={m.image} alt={m.name} className="fbp-result-img" />
                </div>
                <div className="fbp-result-info">
                  <span className="fbp-result-name">{m.name}</span>
                  <span className="fbp-result-score">{Math.round(m.score * 100)}% match</span>
                  {m.pNumber && (
                    <span className="fbp-result-skus">{m.pNumber}</span>
                  )}
                  {m.sku && (
                    <span className="fbp-result-skus">SKU: {m.sku}</span>
                  )}
                  {m.skus && m.skus.length > 0 && (
                    <span className="fbp-result-skus">
                      {m.skus.slice(0, 3).join(', ')}
                      {m.skus.length > 3 && ` +${m.skus.length - 3}`}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default FindByPhotoPage
