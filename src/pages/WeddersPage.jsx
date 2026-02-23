import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { wedderStyles, wedderPNumbers } from '../data/wedders'

const STORAGE_KEY = 'wedder-skus'
const IMAGES_KEY  = 'wedder-style-images'

function loadSkuMap() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch { return {} }
}

function saveSkuMap(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

// Style images stored as { "style-id": "data:image/png;base64,..." }
function loadStyleImages() {
  try {
    return JSON.parse(localStorage.getItem(IMAGES_KEY)) || {}
  } catch { return {} }
}

function saveStyleImages(map) {
  localStorage.setItem(IMAGES_KEY, JSON.stringify(map))
}

// Normalize filename to match style id: "flat-bevel.png" → "Flat Bevel"
function filenameToStyleId(filename) {
  const name = filename.replace(/\.[^.]+$/, '').toLowerCase()
  // Try exact match first
  const exact = wedderStyles.find((s) => s.id.toLowerCase() === name)
  if (exact) return exact.id
  // Try slug match: "flat-bevel" → "Flat Bevel"
  const slug = name.replace(/-/g, ' ')
  const slugMatch = wedderStyles.find((s) => s.id.toLowerCase() === slug)
  if (slugMatch) return slugMatch.id
  return null
}

// Build reverse lookup: SKU → { styleId, metal, width, finish }
function buildSkuIndex(skuMap) {
  const idx = {}
  for (const [pKey, sku] of Object.entries(skuMap)) {
    if (sku) idx[sku.toUpperCase()] = pKey
  }
  return idx
}

// Parse a pKey back into selection fields
function parsePKey(pKey) {
  const parts = pKey.split('|')
  const style = wedderStyles.find((s) => s.id === parts[0])
  if (!style) return null
  const noFinish = style.finishes.length === 0
  return {
    styleId: parts[0],
    metal: parts[1],
    width: parts[2],
    finish: noFinish ? null : (parts[3] || null),
  }
}

// ── Style selector cards ──────────────────────────────────────────
function StylePicker({ selected, onSelect, styleImages }) {
  const plain     = wedderStyles.filter((s) => s.category === 'Plain')
  const patterned = wedderStyles.filter((s) => s.category === 'Patterned')

  return (
    <div className="wedder-step">
      <div className="wedder-step-label">Style / Profile</div>

      <div className="wedder-style-category-label">Plain</div>
      <div className="wedder-style-grid">
        {plain.map((s) => <StyleCard key={s.id} style={s} selected={selected} onSelect={onSelect} customImage={styleImages[s.id]} />)}
      </div>

      <div className="wedder-style-category-label" style={{ marginTop: '0.75rem' }}>Patterned</div>
      <div className="wedder-style-grid">
        {patterned.map((s) => <StyleCard key={s.id} style={s} selected={selected} onSelect={onSelect} customImage={styleImages[s.id]} />)}
      </div>
    </div>
  )
}

function StyleCard({ style, selected, onSelect, customImage }) {
  const imgSrc = customImage || style.image
  return (
    <button
      className={`wedder-style-card${selected === style.id ? ' wedder-style-card--active' : ''}`}
      onClick={() => onSelect(style.id)}
    >
      <div className="wedder-style-img-wrap">
        <img
          src={imgSrc}
          alt={style.name}
          className="wedder-style-img"
          onError={(e) => { e.target.style.display = 'none' }}
        />
      </div>
      <span className="wedder-style-name">{style.name}</span>
    </button>
  )
}

// ── Generic button group ──────────────────────────────────────────
function OptionPicker({ label, options, selected, onSelect }) {
  if (!options || options.length === 0) return null
  return (
    <div className="wedder-step">
      <div className="wedder-step-label">{label}</div>
      <div className="wedder-choice-options">
        {options.map((opt) => (
          <button
            key={opt}
            className={`wedder-choice-btn${selected === opt ? ' wedder-choice-btn--active' : ''}`}
            onClick={() => onSelect(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────
function WeddersPage() {
  const navigate = useNavigate()

  const [styleId, setStyleId] = useState(null)
  const [metal,   setMetal]   = useState(null)
  const [width,   setWidth]   = useState(null)
  const [finish,  setFinish]  = useState(null)

  // SKU state
  const [skuMap, setSkuMap]       = useState(loadSkuMap)
  const [skuInput, setSkuInput]   = useState('')
  const [skuSearch, setSkuSearch] = useState('')
  const [skuMsg, setSkuMsg]       = useState(null)

  // Style images state
  const [styleImages, setStyleImages] = useState(loadStyleImages)
  const [showUpload, setShowUpload]   = useState(false)
  const [uploadMsg, setUploadMsg]     = useState(null)
  const uploadRef = useRef(null)

  function handleImageFiles(files) {
    const next = { ...styleImages }
    let matched = 0
    let unmatched = []
    const pending = []

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      const styleId = filenameToStyleId(file.name)
      if (!styleId) {
        unmatched.push(file.name)
        continue
      }
      pending.push(new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          next[styleId] = e.target.result
          matched++
          resolve()
        }
        reader.readAsDataURL(file)
      }))
    }

    Promise.all(pending).then(() => {
      setStyleImages({ ...next })
      saveStyleImages(next)
      const parts = []
      if (matched) parts.push(`${matched} image${matched > 1 ? 's' : ''} saved`)
      if (unmatched.length) parts.push(`${unmatched.length} not matched: ${unmatched.join(', ')}`)
      setUploadMsg(parts.join(' — '))
      setTimeout(() => setUploadMsg(null), 5000)
    })
  }

  function handleClearImage(id) {
    const next = { ...styleImages }
    delete next[id]
    setStyleImages(next)
    saveStyleImages(next)
  }

  const selectedStyle = wedderStyles.find((s) => s.id === styleId) ?? null
  const noFinish      = selectedStyle && selectedStyle.finishes.length === 0

  // Apply defaults (10K, Polished) when style changes
  function handleStyleSelect(id) {
    const s = wedderStyles.find((st) => st.id === id)
    setStyleId(id)

    // Default metal to 10K if available
    const newMetal = s.metals.includes('10K') ? '10K' : (metal && s.metals.includes(metal) ? metal : null)
    setMetal(newMetal)

    // Keep width if valid, else clear
    if (width && !s.widths.includes(width)) setWidth(null)

    // Default finish to Polished if available
    if (s.finishes.length > 0) {
      const newFinish = s.finishes.includes('Polished') ? 'Polished' : (finish && s.finishes.includes(finish) ? finish : null)
      setFinish(newFinish)
    } else {
      setFinish(null)
    }
  }

  // Build P-number key
  const allSelected = selectedStyle && metal && width && (noFinish || finish)
  let pKey = null
  if (allSelected) {
    pKey = noFinish
      ? `${styleId}|${metal}|${width}`
      : `${styleId}|${metal}|${width}|${finish}`
  }
  const pNumber = pKey ? wedderPNumbers[pKey] : null

  // Get existing SKU for this combination
  const existingSku = pKey ? (skuMap[pKey] || '') : ''

  // Pre-fill SKU input when combination changes
  useEffect(() => {
    setSkuInput(existingSku)
    setSkuMsg(null)
  }, [pKey])

  // Save SKU
  function handleSaveSku() {
    if (!pKey || !skuInput.trim()) return
    const next = { ...skuMap, [pKey]: skuInput.trim() }
    setSkuMap(next)
    saveSkuMap(next)
    setSkuMsg('Saved')
    setTimeout(() => setSkuMsg(null), 2000)
  }

  // SKU search
  const handleSkuSearch = useCallback((value) => {
    setSkuSearch(value)
    if (!value.trim()) return
    const idx = buildSkuIndex(skuMap)
    const match = idx[value.trim().toUpperCase()]
    if (match) {
      const sel = parsePKey(match)
      if (sel) {
        setStyleId(sel.styleId)
        setMetal(sel.metal)
        setWidth(sel.width)
        setFinish(sel.finish)
      }
    }
  }, [skuMap])

  function handleReset() {
    setStyleId(null)
    setMetal(null)
    setWidth(null)
    setFinish(null)
    setSkuSearch('')
  }

  const anythingSelected = styleId || metal || width || finish

  return (
    <div className="wedders-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/concierge')}>Concierge</button>
        <h1>Concierge</h1>
        <button
          className="wedder-upload-toggle"
          onClick={() => setShowUpload(!showUpload)}
          title="Upload style images"
        >
          {showUpload ? 'Hide Images' : 'Images'}
        </button>
      </div>

      {/* ── Image upload panel ── */}
      {showUpload && (
        <div className="wedder-upload-panel">
          <div
            className="wedder-upload-dropzone"
            onClick={() => uploadRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              handleImageFiles(e.dataTransfer.files)
            }}
          >
            <input
              ref={uploadRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => { handleImageFiles(e.target.files); e.target.value = '' }}
            />
            <span className="wedder-upload-dropzone-text">
              Drop cropped images here or click to upload
            </span>
            <span className="wedder-upload-dropzone-hint">
              Filenames must match style names (e.g. flat.png, high-dome.png, bevel-two-tone.png)
            </span>
          </div>
          {uploadMsg && <p className="wedder-upload-msg">{uploadMsg}</p>}
          <div className="wedder-upload-grid">
            {wedderStyles.map((s) => (
              <div key={s.id} className={`wedder-upload-thumb${styleImages[s.id] ? '' : ' wedder-upload-thumb--empty'}`}>
                {styleImages[s.id] ? (
                  <>
                    <img src={styleImages[s.id]} alt={s.name} className="wedder-upload-thumb-img" />
                    <button className="wedder-upload-thumb-remove" onClick={() => handleClearImage(s.id)} title="Remove">&times;</button>
                  </>
                ) : (
                  <div className="wedder-upload-thumb-placeholder" />
                )}
                <span className="wedder-upload-thumb-name">{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SKU Search ── */}
      <div className="wedder-sku-search">
        <div className="wedder-step-label">Search by Sample SKU</div>
        <div className="wedder-sku-search-row">
          <input
            className="wedder-sku-search-input"
            type="text"
            value={skuSearch}
            onChange={(e) => handleSkuSearch(e.target.value)}
            placeholder="Enter Sample SKU to find combination..."
          />
          {skuSearch && !buildSkuIndex(skuMap)[skuSearch.trim().toUpperCase()] && (
            <span className="wedder-sku-search-miss">Not found</span>
          )}
          {skuSearch && buildSkuIndex(skuMap)[skuSearch.trim().toUpperCase()] && (
            <span className="wedder-sku-search-hit">Found</span>
          )}
        </div>
      </div>

      <div className="wedder-finder-v2">
        {/* ── Left: style preview image ── */}
        <div className="wedder-preview-col">
          <div className="wedder-preview-img-wrap">
            {selectedStyle ? (
              <img
                src={styleImages[selectedStyle.id] || selectedStyle.image}
                alt={selectedStyle.name}
                className="wedder-preview-img"
                onError={(e) => { e.target.style.display = 'none' }}
              />
            ) : (
              <div className="wedder-preview-placeholder">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="8" />
                  <circle cx="12" cy="12" r="4" />
                </svg>
                <span>Select a style</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: selectors ── */}
        <div className="wedder-selectors-col">
          <StylePicker selected={styleId} onSelect={handleStyleSelect} styleImages={styleImages} />

          <OptionPicker
            label="Metal"
            options={selectedStyle?.metals ?? []}
            selected={metal}
            onSelect={setMetal}
          />

          <OptionPicker
            label="Width"
            options={selectedStyle?.widths ?? []}
            selected={width}
            onSelect={setWidth}
          />

          {!noFinish && (
            <OptionPicker
              label="Finish"
              options={selectedStyle?.finishes ?? []}
              selected={finish}
              onSelect={setFinish}
            />
          )}

          {/* ── Result ── */}
          <div className="wedder-result">
            {!allSelected && (
              <p className="wedder-result-prompt">
                {selectedStyle
                  ? 'Select all options above to find the P number'
                  : 'Choose a style to begin'}
              </p>
            )}
            {allSelected && pNumber && (
              <div className="wedder-result-found">
                <span className="wedder-result-label">P Number</span>
                <span className="wedder-result-p">{pNumber}</span>
                {existingSku && (
                  <span className="wedder-result-sku-existing">Sample SKU: {existingSku}</span>
                )}
              </div>
            )}
            {allSelected && !pNumber && (
              <p className="wedder-result-not-found">No P number found for this combination</p>
            )}
          </div>

          {/* ── SKU input ── */}
          {allSelected && pNumber && (
            <div className="wedder-sku-entry">
              <div className="wedder-step-label">Sample SKU</div>
              <div className="wedder-sku-entry-row">
                <input
                  className="wedder-sku-entry-input"
                  type="text"
                  value={skuInput}
                  onChange={(e) => setSkuInput(e.target.value)}
                  placeholder="Enter Sample SKU..."
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveSku() }}
                />
                <button
                  className="wedder-sku-save-btn"
                  onClick={handleSaveSku}
                  disabled={!skuInput.trim()}
                >
                  Save
                </button>
                {skuMsg && <span className="wedder-sku-msg">{skuMsg}</span>}
              </div>
            </div>
          )}

          {anythingSelected && (
            <button className="wedder-reset-btn" onClick={handleReset}>Reset</button>
          )}
        </div>
      </div>

      {/* ── Price lookup iframe ── */}
      {pNumber && (
        <div className="wedder-price-section">
          <div className="wedder-price-header">
            <span className="wedder-price-label">Price Lookup</span>
            <span className="wedder-price-pnum">{pNumber}</span>
          </div>
          <div className="wedder-iframe-wrap">
            <iframe
              src={`https://placeholder.internal/price?p=${pNumber}`}
              title={`Price for ${pNumber}`}
              className="wedder-price-iframe"
              frameBorder="0"
              allowFullScreen
            />
            <div className="wedder-iframe-overlay">
              <span>Price iframe — URL to be configured</span>
              <code>{pNumber}</code>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WeddersPage
