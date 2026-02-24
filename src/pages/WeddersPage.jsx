import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { wedderStyles, wedderPNumbers } from '../data/wedders'
import { useAuth } from '../auth/AuthContext'

const STORAGE_KEY = 'wedder-skus'
const IMAGES_KEY  = 'wedder-style-images'

const TIERS = [
  { id: 'Gold',    label: 'Gold Wedders' },
  { id: 'Diamond', label: 'Diamond Wedders' },
]

function loadSkuMap() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch { return {} }
}

function saveSkuMap(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

function loadStyleImages() {
  try {
    return JSON.parse(localStorage.getItem(IMAGES_KEY)) || {}
  } catch { return {} }
}

function saveStyleImages(map) {
  localStorage.setItem(IMAGES_KEY, JSON.stringify(map))
}

function filenameToStyleId(filename) {
  const name = filename.replace(/\.[^.]+$/, '').toLowerCase().trim()
  const slug = name.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ')

  const exact = wedderStyles.find((s) => s.id.toLowerCase() === name || s.id.toLowerCase() === slug)
  if (exact) return exact.id

  const partial = wedderStyles.find((s) => {
    const sid = s.id.toLowerCase()
    return sid.startsWith(slug) || slug.startsWith(sid)
  })
  if (partial) return partial.id

  const coreWords = (str) => str.replace(/\b(the|and|of|a|an)\b/g, '').replace(/\s+/g, ' ').trim()
  const slugCore = coreWords(slug)
  const fuzzy = wedderStyles.find((s) => {
    const sidCore = coreWords(s.id.toLowerCase())
    return sidCore === slugCore || sidCore.startsWith(slugCore) || slugCore.startsWith(sidCore)
  })
  if (fuzzy) return fuzzy.id

  return null
}

function buildSkuIndex(skuMap) {
  const idx = {}
  for (const [pKey, sku] of Object.entries(skuMap)) {
    if (sku) idx[sku.toUpperCase()] = pKey
  }
  return idx
}

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
function StylePicker({ styles, selected, onSelect, styleImages }) {
  const plain     = styles.filter((s) => s.category === 'Plain')
  const patterned = styles.filter((s) => s.category === 'Patterned')

  return (
    <div className="wedder-step">
      <div className="wedder-step-label">Style / Profile</div>

      {plain.length > 0 && (
        <>
          <div className="wedder-style-category-label">Plain</div>
          <div className="wedder-style-grid">
            {plain.map((s) => <StyleCard key={s.id} style={s} selected={selected} onSelect={onSelect} customImage={styleImages[s.id]} />)}
          </div>
        </>
      )}

      {patterned.length > 0 && (
        <>
          <div className="wedder-style-category-label" style={{ marginTop: '0.75rem' }}>Patterned</div>
          <div className="wedder-style-grid">
            {patterned.map((s) => <StyleCard key={s.id} style={s} selected={selected} onSelect={onSelect} customImage={styleImages[s.id]} />)}
          </div>
        </>
      )}

      {plain.length === 0 && patterned.length === 0 && (
        <p className="wedder-result-prompt">No styles in this tier yet</p>
      )}
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

function StyleUploadSlot({ style, image, onAssign, onClear }) {
  const inputRef = useRef(null)
  return (
    <div className={`wedder-upload-thumb${image ? '' : ' wedder-upload-thumb--empty'}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => { if (e.target.files[0]) onAssign(e.target.files[0]); e.target.value = '' }}
      />
      {image ? (
        <>
          <img
            src={image}
            alt={style.name}
            className="wedder-upload-thumb-img"
            onClick={() => inputRef.current?.click()}
            title="Click to replace"
          />
          <button className="wedder-upload-thumb-remove" onClick={onClear} title="Remove">&times;</button>
        </>
      ) : (
        <div
          className="wedder-upload-thumb-placeholder"
          onClick={() => inputRef.current?.click()}
          title="Click to upload"
        />
      )}
      <span className="wedder-upload-thumb-name">{style.name}</span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────
function WeddersPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const [styleId, setStyleId] = useState(null)
  const [metal,   setMetal]   = useState(null)
  const [width,   setWidth]   = useState(null)
  const [finish,  setFinish]  = useState(null)

  // Tier collapse state – both collapsed by default
  const [openTiers, setOpenTiers] = useState({})
  // Per-tier image upload panel visibility
  const [showUpload, setShowUpload] = useState({})
  const [uploadMsg, setUploadMsg]   = useState({})
  const uploadRefs = useRef({})

  function toggleTier(tierId) {
    setOpenTiers((prev) => ({ ...prev, [tierId]: !prev[tierId] }))
  }

  function toggleUpload(tierId) {
    setShowUpload((prev) => ({ ...prev, [tierId]: !prev[tierId] }))
  }

  // SKU state
  const [skuMap, setSkuMap]       = useState(loadSkuMap)
  const [skuInput, setSkuInput]   = useState('')
  const [skuSearch, setSkuSearch] = useState('')
  const [skuMsg, setSkuMsg]       = useState(null)

  // Style images state
  const [styleImages, setStyleImages] = useState(loadStyleImages)

  function handleImageFiles(files, tierStyles, tierId) {
    const next = { ...styleImages }
    let matched = 0
    let unmatched = []
    const pending = []
    const tierIds = new Set(tierStyles.map((s) => s.id))

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      const sid = filenameToStyleId(file.name)
      if (!sid || !tierIds.has(sid)) {
        unmatched.push(file.name)
        continue
      }
      pending.push(new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          next[sid] = e.target.result
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
      const msg = parts.join(' — ')
      setUploadMsg((prev) => ({ ...prev, [tierId]: msg }))
      setTimeout(() => setUploadMsg((prev) => ({ ...prev, [tierId]: null })), 5000)
    })
  }

  function handleAssignImage(sid, file) {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const next = { ...styleImages, [sid]: e.target.result }
      setStyleImages(next)
      saveStyleImages(next)
    }
    reader.readAsDataURL(file)
  }

  function handleClearImage(id) {
    const next = { ...styleImages }
    delete next[id]
    setStyleImages(next)
    saveStyleImages(next)
  }

  const selectedStyle = wedderStyles.find((s) => s.id === styleId) ?? null
  const noFinish      = selectedStyle && selectedStyle.finishes.length === 0
  const activeTier    = selectedStyle?.tier ?? null

  function handleStyleSelect(id) {
    const s = wedderStyles.find((st) => st.id === id)
    setStyleId(id)
    const newMetal = s.metals.includes('10K') ? '10K' : (metal && s.metals.includes(metal) ? metal : null)
    setMetal(newMetal)
    if (width && !s.widths.includes(width)) setWidth(null)
    if (s.finishes.length > 0) {
      const newFinish = s.finishes.includes('Polished') ? 'Polished' : (finish && s.finishes.includes(finish) ? finish : null)
      setFinish(newFinish)
    } else {
      setFinish(null)
    }
  }

  const allSelected = selectedStyle && metal && width && (noFinish || finish)
  let pKey = null
  if (allSelected) {
    pKey = noFinish
      ? `${styleId}|${metal}|${width}`
      : `${styleId}|${metal}|${width}|${finish}`
  }
  const pNumber = pKey ? wedderPNumbers[pKey] : null
  const existingSku = pKey ? (skuMap[pKey] || '') : ''

  useEffect(() => {
    setSkuInput(existingSku)
    setSkuMsg(null)
  }, [pKey])

  function handleSaveSku() {
    if (!pKey || !skuInput.trim()) return
    const next = { ...skuMap, [pKey]: skuInput.trim() }
    setSkuMap(next)
    saveSkuMap(next)
    setSkuMsg('Saved')
    setTimeout(() => setSkuMsg(null), 2000)
  }

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
        const foundStyle = wedderStyles.find((s) => s.id === sel.styleId)
        if (foundStyle) setOpenTiers((prev) => ({ ...prev, [foundStyle.tier]: true }))
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

  // Group styles by tier
  const stylesByTier = {}
  for (const tier of TIERS) {
    stylesByTier[tier.id] = wedderStyles.filter((s) => s.tier === tier.id)
  }

  return (
    <div className="wedders-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/findsku')}>SKU Finder</button>
        <h1>SKU Finder</h1>
      </div>

      {/* ── SKU Search ── */}
      <div className="wedder-sku-search">
        <div className="wedder-step-label">Search by Sample SKU</div>
        <div className="wedder-sku-search-row">
          <input
            className="wedder-sku-search-input"
            type="text"
            value={skuSearch}
            onChange={(e) => handleSkuSearch(e.target.value)}
            placeholder="Enter Sample SKU"
          />
          {skuSearch && !buildSkuIndex(skuMap)[skuSearch.trim().toUpperCase()] && (
            <span className="wedder-sku-search-miss">Not found</span>
          )}
          {skuSearch && buildSkuIndex(skuMap)[skuSearch.trim().toUpperCase()] && (
            <span className="wedder-sku-search-hit">Found</span>
          )}
        </div>
      </div>

      {/* ── Tier sections ── */}
      {TIERS.map((tier) => {
        const tierStyles = stylesByTier[tier.id]
        const isOpen = !!openTiers[tier.id]
        const isEmpty = tierStyles.length === 0
        const isTierActive = activeTier === tier.id

        return (
          <div key={tier.id} className={`wedder-tier${isOpen ? ' wedder-tier--open' : ''}`}>
            <button className="wedder-tier-header" onClick={() => toggleTier(tier.id)}>
              <span className="wedder-tier-chevron">{isOpen ? '▾' : '▸'}</span>
              <span className="wedder-tier-label">{tier.label}</span>
              <span className="wedder-tier-count">
                {isEmpty ? 'Coming soon' : `${tierStyles.length} style${tierStyles.length !== 1 ? 's' : ''}`}
              </span>
            </button>

            {isOpen && (
              <div className="wedder-tier-body">
                {isEmpty ? (
                  <p className="wedder-result-prompt" style={{ padding: '0.5rem 0' }}>No styles in this tier yet</p>
                ) : (
                  <>
                    {/* Per-tier admin actions */}
                    {isAdmin && (
                      <div className="wedder-tier-actions">
                        <button
                          className="wedder-upload-toggle"
                          onClick={() => navigate(`/wedder-crop?tier=${tier.id}`)}
                          title={`Crop ${tier.label} images`}
                        >
                          Crop
                        </button>
                        <button
                          className="wedder-upload-toggle"
                          onClick={() => toggleUpload(tier.id)}
                          title={`Upload ${tier.label} images`}
                        >
                          {showUpload[tier.id] ? 'Hide Images' : 'Images'}
                        </button>
                      </div>
                    )}

                    {/* Per-tier upload panel */}
                    {showUpload[tier.id] && (
                      <div className="wedder-upload-panel">
                        <div
                          className="wedder-upload-dropzone"
                          onClick={() => uploadRefs.current[tier.id]?.click()}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault()
                            handleImageFiles(e.dataTransfer.files, tierStyles, tier.id)
                          }}
                        >
                          <input
                            ref={(el) => { uploadRefs.current[tier.id] = el }}
                            type="file"
                            accept="image/*"
                            multiple
                            hidden
                            onChange={(e) => { handleImageFiles(e.target.files, tierStyles, tier.id); e.target.value = '' }}
                          />
                          <span className="wedder-upload-dropzone-text">
                            Drop cropped images here or click to upload
                          </span>
                          <span className="wedder-upload-dropzone-hint">
                            Filenames must match style names (e.g. flat.png, high-dome.png)
                          </span>
                        </div>
                        {uploadMsg[tier.id] && <p className="wedder-upload-msg">{uploadMsg[tier.id]}</p>}
                        <div className="wedder-upload-grid">
                          {tierStyles.map((s) => (
                            <StyleUploadSlot
                              key={s.id}
                              style={s}
                              image={styleImages[s.id]}
                              onAssign={(file) => handleAssignImage(s.id, file)}
                              onClear={() => handleClearImage(s.id)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Finder for this tier */}
                    <div className="wedder-finder-v2">
                      <div className="wedder-preview-col">
                        <div className="wedder-preview-img-wrap">
                          {selectedStyle && isTierActive ? (
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

                      <div className="wedder-selectors-col">
                        <StylePicker
                          styles={tierStyles}
                          selected={isTierActive ? styleId : null}
                          onSelect={handleStyleSelect}
                          styleImages={styleImages}
                        />

                        {isTierActive && (
                          <>
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

                            <div className="wedder-result">
                              {!allSelected && (
                                <p className="wedder-result-prompt">
                                  Select all options above to find the P number
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

                            {isAdmin && allSelected && pNumber && (
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
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}

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
