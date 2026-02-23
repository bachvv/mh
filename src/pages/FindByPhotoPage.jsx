import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import earringsData from '../data/earrings.json'

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

// Extract color histogram from an image via canvas
function getColorHistogram(canvas, ctx) {
  const w = canvas.width
  const h = canvas.height
  const data = ctx.getImageData(0, 0, w, h).data
  // 8 bins per channel = 512 total bins
  const bins = 8
  const hist = new Float64Array(bins * bins * bins)
  const step = 256 / bins
  let total = 0

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a < 128) continue // skip transparent
    const rBin = Math.min(Math.floor(data[i] / step), bins - 1)
    const gBin = Math.min(Math.floor(data[i + 1] / step), bins - 1)
    const bBin = Math.min(Math.floor(data[i + 2] / step), bins - 1)
    hist[rBin * bins * bins + gBin * bins + bBin]++
    total++
  }

  // Normalize
  if (total > 0) {
    for (let i = 0; i < hist.length; i++) hist[i] /= total
  }
  return hist
}

// Compare two histograms using histogram intersection (higher = more similar)
function compareHistograms(a, b) {
  let intersection = 0
  for (let i = 0; i < a.length; i++) {
    intersection += Math.min(a[i], b[i])
  }
  return intersection // 0..1 range
}

// Load an image src into a small canvas and return its histogram
function imageToHistogram(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const size = 64 // downsample for speed
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

const CATEGORIES = [
  { id: 'earrings', label: 'Earrings' },
  { id: 'wedders', label: 'Wedders' },
]

function FindByPhotoPage() {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [category, setCategory] = useState('earrings')

  const processFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      const src = e.target.result
      setPreview(src)
      setLoading(true)
      setResults(null)

      // Get histogram of uploaded photo
      const uploadHist = await imageToHistogram(src)
      if (!uploadHist) {
        setResults([])
        setLoading(false)
        return
      }

      let matches = []

      if (category === 'earrings') {
        // Compare against earring product images
        for (const item of earringsData) {
          const hist = await imageToHistogram(item.image)
          if (!hist) continue
          const score = compareHistograms(uploadHist, hist)
          matches.push({
            styleId: item.pNumber,
            name: item.name,
            score,
            image: item.image,
            pNumber: item.pNumber,
            sourceUrl: item.sourceUrl,
          })
        }
      } else {
        // Compare against wedder style images from localStorage
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

          matches.push({ styleId, name: styleId, score, image: imgSrc, skus: styleSkus })
        }
      }

      matches.sort((a, b) => b.score - a.score)
      setResults(matches.slice(0, 6))
      setLoading(false)
    }
    reader.readAsDataURL(file)
  }, [category])

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const hintText = category === 'earrings'
    ? `Matches against ${earringsData.length} earring products`
    : 'Matches against saved wedder style images'

  return (
    <div className="fbp-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/concierge')}>SKU Finder</button>
        <h1>Find by Photo</h1>
      </div>

      <div className="fbp-category-toggle">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            className={`fbp-cat-btn${category === c.id ? ' fbp-cat-btn--active' : ''}`}
            onClick={() => { setCategory(c.id); setResults(null) }}
          >
            {c.label}
          </button>
        ))}
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
              <span className="fbp-dropzone-hint">{hintText}</span>
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
        <div className="fbp-loading">Comparing images...</div>
      )}

      {results && results.length === 0 && !loading && (
        <div className="fbp-empty">
          {category === 'earrings'
            ? 'No earring images available.'
            : 'No style images saved yet. Upload style images on the Wedders page first.'}
        </div>
      )}

      {results && results.length > 0 && !loading && (
        <div className="fbp-results">
          <div className="wedder-step-label">Best Matches</div>
          <div className="fbp-results-grid">
            {results.map((m, i) => (
              <div key={m.styleId + '-' + i} className="fbp-result-card">
                <div className="fbp-result-img-wrap">
                  <img src={m.image} alt={m.name} className="fbp-result-img" />
                </div>
                <div className="fbp-result-info">
                  <span className="fbp-result-name">{m.name}</span>
                  <span className="fbp-result-score">{Math.round(m.score * 100)}% match</span>
                  {m.pNumber && (
                    <span className="fbp-result-skus">{m.pNumber}</span>
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
