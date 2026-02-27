import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function loadSkuMap(storageKey) {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {}
  } catch { return {} }
}

function saveSkuMap(storageKey, map) {
  localStorage.setItem(storageKey, JSON.stringify(map))
}

function buildSkuIndex(skuMap) {
  const idx = {}
  for (const [pKey, sku] of Object.entries(skuMap)) {
    if (sku) idx[sku.toUpperCase()] = pKey
  }
  return idx
}

function parsePKey(pKey, styles) {
  const parts = pKey.split('|')
  const style = styles.find((s) => s.id === parts[0])
  if (!style) return null
  return { styleId: parts[0], options: parts.slice(1) }
}

// ── Style selector cards ──────────────────────────────────────────
function StylePicker({ styles, selected, onSelect, cacheBust }) {
  const byCategory = {}
  for (const s of styles) {
    const cat = s.category || 'All'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(s)
  }
  const categories = Object.keys(byCategory)

  return (
    <div className="wedder-step">
      <div className="wedder-step-label">Style</div>
      {categories.map((cat, i) => (
        <div key={cat}>
          {categories.length > 1 && (
            <div className="wedder-style-category-label" style={i > 0 ? { marginTop: '0.75rem' } : undefined}>
              {cat}
            </div>
          )}
          <div className="wedder-style-grid">
            {byCategory[cat].map((s) => (
              <StyleCard key={s.id} style={s} selected={selected} onSelect={onSelect} cacheBust={cacheBust} />
            ))}
          </div>
        </div>
      ))}
      {styles.length === 0 && (
        <p className="wedder-result-prompt">No styles in this tier yet</p>
      )}
    </div>
  )
}

function StyleCard({ style, selected, onSelect, cacheBust }) {
  const imgSrc = cacheBust ? `${style.image}?v=${cacheBust}` : style.image
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

function StyleUploadSlot({ style, onAssign, onClear, onPickServer, cacheBust }) {
  const inputRef = useRef(null)
  const imgSrc = cacheBust ? `${style.image}?v=${cacheBust}` : style.image
  return (
    <div className="wedder-upload-thumb">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => { if (e.target.files[0]) onAssign(e.target.files[0]); e.target.value = '' }}
      />
      <img
        src={imgSrc}
        alt={style.name}
        className="wedder-upload-thumb-img"
        onClick={() => inputRef.current?.click()}
        title="Click to upload new"
        onError={(e) => { e.target.style.display = 'none' }}
      />
      <div className="wedder-upload-thumb-actions">
        <button className="wedder-upload-thumb-pick" onClick={onPickServer} title="Pick from server">&#x1f4c2;</button>
        <button className="wedder-upload-thumb-remove" onClick={onClear} title="Remove">&times;</button>
      </div>
      <span className="wedder-upload-thumb-name">{style.name}</span>
    </div>
  )
}

function ServerImagePicker({ onSelect, onClose, cacheBust }) {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/style-images')
      .then((r) => r.json())
      .then((data) => { setImages(data.images || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="server-picker-overlay" onClick={onClose}>
      <div className="server-picker" onClick={(e) => e.stopPropagation()}>
        <div className="server-picker-header">
          <span className="server-picker-title">Select Image from Server</span>
          <button className="wedder-upload-thumb-remove" onClick={onClose}>&times;</button>
        </div>
        {loading && <p className="wedder-result-prompt">Loading...</p>}
        <div className="server-picker-grid">
          {images.map((img) => (
            <button
              key={img.filename}
              className="server-picker-item"
              onClick={() => onSelect(img.filename)}
              title={img.name}
            >
              <img
                src={`${img.url}?v=${cacheBust}`}
                alt={img.name}
                className="server-picker-img"
                onError={(e) => { e.target.style.display = 'none' }}
              />
              <span className="server-picker-name">{img.name}</span>
            </button>
          ))}
        </div>
        {!loading && images.length === 0 && (
          <p className="wedder-result-prompt">No cropped images found on server</p>
        )}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────
// optionDefs: [{ key: 'metals', label: 'Metal' }, { key: 'widths', label: 'Width' }, ...]
// Each style object must have arrays matching the keys (e.g. style.metals, style.widths)
// pNumbers keyed by "styleId|opt1|opt2|..." in optionDefs order
export default function ProductFinder({
  productName,
  styles: baseStyles,
  pNumbers: basePNumbers,
  tiers,
  optionDefs,
  backPath = '/findsku',
  cropPath,
  storageKey,
}) {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const skuKey = storageKey || `${productName.toLowerCase()}-skus`
  const [customStyles, setCustomStyles] = useState([])
  const [customPNumbers, setCustomPNumbers] = useState({})
  const [serverTiers, setServerTiers] = useState(null)

  useEffect(() => {
    fetch(`/api/custom-styles/${productName.toLowerCase()}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCustomStyles(data) })
      .catch(() => {})
    fetch(`/api/pnumbers/${productName.toLowerCase()}`)
      .then((r) => r.json())
      .then((data) => { if (data && typeof data === 'object') setCustomPNumbers(data) })
      .catch(() => {})
    fetch(`/api/categories/${productName.toLowerCase()}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data) && data.length > 0) setServerTiers(data) })
      .catch(() => {})
  }, [productName])

  const effectiveTiers = serverTiers || tiers

  // Merge: base styles + custom styles (custom ones that don't duplicate base ids)
  const styles = [...baseStyles, ...customStyles.filter((c) => !baseStyles.some((b) => b.id === c.id))]
  const pNumbers = { ...basePNumbers, ...customPNumbers }

  const [styleId, setStyleId] = useState(null)
  const [selections, setSelections] = useState({}) // { metals: '10K', widths: '6mm', ... }
  const [openTiers, setOpenTiers] = useState({})
  const [showUpload, setShowUpload] = useState({})

  const [skuMap, setSkuMap]       = useState(() => loadSkuMap(skuKey))
  const [skuInput, setSkuInput]   = useState('')
  const [skuSearch, setSkuSearch] = useState('')
  const [skuMsg, setSkuMsg]       = useState(null)

  const [imgVersion, setImgVersion] = useState(Date.now())
  const [pickerForStyle, setPickerForStyle] = useState(null) // style id to assign server image to
  const [priceCopied, setPriceCopied] = useState(false)

  function handleGetPrice(sku) {
    // Open Stock Enquiry with SKU pre-filled in the URL
    window.open('https://hillnetapps.michaelhill.global/stock/StockEnquiry', '_blank')
    navigator.clipboard.writeText(sku).then(() => {
      setPriceCopied(true)
      setTimeout(() => setPriceCopied(false), 3000)
    }).catch(() => { /* clipboard may fail on non-https */ })
  }

  function toggleTier(tierId) {
    setOpenTiers((prev) => ({ ...prev, [tierId]: !prev[tierId] }))
  }

  function toggleUpload(tierId) {
    setShowUpload((prev) => ({ ...prev, [tierId]: !prev[tierId] }))
  }

  const selectedStyle = styles.find((s) => s.id === styleId) ?? null
  const activeTier = selectedStyle?.tier ?? null

  // Check if a conditional option's dependency is satisfied
  function isDepSatisfied(def, sels) {
    if (!def.dependsOn) return true
    const { key, value, values } = def.dependsOn
    if (values) return values.includes(sels[key])
    return sels[key] === value
  }

  function handleStyleSelect(id) {
    const s = styles.find((st) => st.id === id)
    setStyleId(id)

    // Build selections respecting the cascade: each option narrows valid P-number keys
    const prefix = id + '|'
    let matchingKeys = Object.keys(pNumbers).filter((k) => k.startsWith(prefix))
    const next = {}
    let segIdx = 1

    for (const def of optionDefs) {
      const styleOpts = s[def.key] || []
      if (styleOpts.length === 0) { next[def.key] = null; continue }
      if (!isDepSatisfied(def, next)) { next[def.key] = null; continue }

      // Get valid values at this segment
      const vals = new Set()
      for (const k of matchingKeys) {
        const parts = k.split('|')
        if (parts.length > segIdx) vals.add(parts[segIdx])
      }
      const valid = styleOpts.filter((v) => vals.has(v))
      // If no P-number segments at this depth, use all style-defined options
      const available = valid.length > 0 ? valid : styleOpts

      // Pick: keep previous selection if valid, else first valid, else null
      const prev = selections[def.key]
      if (available.includes(prev)) {
        next[def.key] = prev
      } else if (available.length === 1) {
        next[def.key] = available[0]
      } else {
        next[def.key] = available[0] || null
      }

      // Narrow keys
      if (next[def.key] && vals.has(next[def.key])) {
        matchingKeys = matchingKeys.filter((k) => k.split('|')[segIdx] === next[def.key])
      }
      segIdx++
    }
    setSelections(next)
  }

  // Build P-number key from selections — skip options with unsatisfied dependsOn
  const activeOptionDefs = optionDefs.filter(
    (def) => selectedStyle && (selectedStyle[def.key] || []).length > 0 && isDepSatisfied(def, selections)
  )

  // Cascading filter: derive available options for each def from P-number keys
  // Each step narrows the matching keys based on prior selections
  const filteredOptions = (() => {
    if (!selectedStyle) return {}
    const prefix = styleId + '|'
    let matchingKeys = Object.keys(pNumbers).filter((k) => k.startsWith(prefix))
    const result = {}
    let segIdx = 1 // segment 0 = styleId
    let broken = false

    for (const def of optionDefs) {
      if (broken) { result[def.key] = []; continue }
      const styleOpts = selectedStyle[def.key] || []
      if (styleOpts.length === 0) { result[def.key] = []; continue }
      if (!isDepSatisfied(def, selections)) { result[def.key] = []; continue }

      // Extract unique values at current segment position from matching keys
      const vals = new Set()
      for (const k of matchingKeys) {
        const parts = k.split('|')
        if (parts.length > segIdx) vals.add(parts[segIdx])
      }
      // Preserve style-defined order, only keep values that exist in P-numbers
      // If no P-number segments exist at this depth, show all style-defined options
      const filtered = styleOpts.filter((v) => vals.has(v))
      result[def.key] = filtered.length > 0 ? filtered : styleOpts

      // Narrow matching keys by current selection
      const sel = selections[def.key]
      if (sel && vals.has(sel)) {
        matchingKeys = matchingKeys.filter((k) => k.split('|')[segIdx] === sel)
        segIdx++
      } else if (filtered.length === 0) {
        // No P-number segments at this depth — don't break the cascade
        segIdx++
      } else {
        // No valid selection — stop narrowing, later defs get empty
        segIdx++
        broken = true
      }
    }
    return result
  })()

  // Auto-select when filtered options leave only one choice or current selection is invalid
  const filteredKey = JSON.stringify(Object.entries(filteredOptions).map(([k, v]) => [k, v.length, v.includes(selections[k])]))
  useEffect(() => {
    if (!selectedStyle) return
    let changed = false
    const next = { ...selections }
    for (const def of optionDefs) {
      const opts = filteredOptions[def.key] || []
      if (opts.length === 0) continue
      if (!opts.includes(next[def.key])) {
        next[def.key] = opts.length === 1 ? opts[0] : null
        changed = true
      }
    }
    if (changed) setSelections(next)
  }, [filteredKey])

  const allSelected = selectedStyle && activeOptionDefs.every((def) => selections[def.key])

  let pKey = null
  if (allSelected) {
    const parts = [styleId, ...activeOptionDefs.map((def) => selections[def.key])]
    pKey = parts.join('|')
  }
  const pNumber = pKey ? pNumbers[pKey] : null
  const existingSku = pKey ? (skuMap[pKey] || '') : ''

  useEffect(() => {
    setSkuInput(existingSku)
    setSkuMsg(null)
  }, [pKey])

  function handleSaveSku() {
    if (!pKey || !skuInput.trim()) return
    const next = { ...skuMap, [pKey]: skuInput.trim() }
    setSkuMap(next)
    saveSkuMap(skuKey, next)
    setSkuMsg('Saved')
    setTimeout(() => setSkuMsg(null), 2000)
  }

  const handleSkuSearch = useCallback((value) => {
    setSkuSearch(value)
    if (!value.trim()) return
    const idx = buildSkuIndex(skuMap)
    const match = idx[value.trim().toUpperCase()]
    if (match) {
      const sel = parsePKey(match, styles)
      if (sel) {
        setStyleId(sel.styleId)
        const s = styles.find((st) => st.id === sel.styleId)
        const next = {}
        const defs = optionDefs.filter((d) => (s[d.key] || []).length > 0)
        defs.forEach((def, i) => { next[def.key] = sel.options[i] || null })
        setSelections(next)
        if (s) setOpenTiers((prev) => ({ ...prev, [s.tier]: true }))
      }
    }
  }, [skuMap, styles, optionDefs])

  function handleReset() {
    setStyleId(null)
    setSelections({})
    setSkuSearch('')
  }

  async function handleAssignImage(sid, file) {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const res = await fetch('/api/upload-style-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ styleId: sid, image: e.target.result }),
        })
        if (res.ok) setImgVersion(Date.now())
      } catch (err) {
        console.error('Upload failed:', err)
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleClearImage(id) {
    try {
      await fetch('/api/delete-style-image', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ styleId: id }),
      })
      setImgVersion(Date.now())
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  async function handlePickServerImage(sourceFile) {
    if (!pickerForStyle || !sourceFile) return
    try {
      const res = await fetch('/api/assign-style-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ styleId: pickerForStyle, sourceFile }),
      })
      if (res.ok) setImgVersion(Date.now())
    } catch (err) {
      console.error('Assign failed:', err)
    }
    setPickerForStyle(null)
  }

  const anythingSelected = styleId || Object.values(selections).some(Boolean)

  const stylesByTier = {}
  for (const tier of effectiveTiers) {
    stylesByTier[tier.id] = styles.filter((s) => s.tier === tier.id)
  }

  // ── Search: by style name or P-number/SKU ──
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const searchRef = useRef(null)

  const searchResults = (() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    const results = []

    // Search styles by name
    for (const s of styles) {
      if (s.name.toLowerCase().includes(q)) {
        const tier = effectiveTiers.find((t) => t.id === s.tier)
        results.push({ type: 'style', style: s, tierLabel: tier?.label || s.tier, label: s.name })
      }
    }

    // Search Blue Tag SKUs (saved locally)
    for (const [pKey, blueSku] of Object.entries(skuMap)) {
      if (!blueSku) continue
      if (blueSku.toLowerCase().includes(q)) {
        const parts = pKey.split('|')
        const s = styles.find((st) => st.id === parts[0])
        if (!s) continue
        const pNum = pNumbers[pKey]
        const tier = effectiveTiers.find((t) => t.id === s.tier)
        const optLabels = parts.slice(1).join(' / ')
        results.push({
          type: 'pnumber',
          pKey,
          style: s,
          tierLabel: tier?.label || s.tier,
          label: `${blueSku} — ${s.name} (${optLabels})${pNum ? ` [${pNum.startsWith('P') ? pNum : 'P' + pNum}]` : ''}`,
        })
      }
      if (results.length >= 15) break
    }

    // Search P-numbers / SKUs
    for (const [pKey, pNum] of Object.entries(pNumbers)) {
      if (results.length >= 15) break
      const sku = pNum.startsWith('P') ? pNum.slice(1) : pNum
      const pFull = pNum.startsWith('P') ? pNum : `P${pNum}`
      if (sku.includes(q) || pFull.toLowerCase().includes(q)) {
        // Skip if already found via Blue Tag SKU
        if (results.some((r) => r.pKey === pKey)) continue
        const parts = pKey.split('|')
        const s = styles.find((st) => st.id === parts[0])
        if (!s) continue
        const tier = effectiveTiers.find((t) => t.id === s.tier)
        const optLabels = parts.slice(1).join(' / ')
        results.push({
          type: 'pnumber',
          pKey,
          style: s,
          tierLabel: tier?.label || s.tier,
          label: `${pFull} — ${s.name} (${optLabels})`,
        })
      }
    }

    return results
  })()

  function handleSearchSelect(result) {
    if (result.type === 'style') {
      handleStyleSelect(result.style.id)
      setOpenTiers((prev) => ({ ...prev, [result.style.tier]: true }))
    } else {
      const parts = result.pKey.split('|')
      const s = result.style
      setStyleId(s.id)
      const next = {}
      const defs = optionDefs.filter((d) => (s[d.key] || []).length > 0)
      defs.forEach((def, i) => { next[def.key] = parts[i + 1] || null })
      setSelections(next)
      setOpenTiers((prev) => ({ ...prev, [s.tier]: true }))
    }
    setSearchQuery('')
    setSearchFocused(false)
    searchRef.current?.blur()
  }

  return (
    <div className="wedders-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(backPath)}>SKU Finder</button>
        <h1>{productName}</h1>
      </div>

      {/* Search bar */}
      <div className="pf-search-wrap">
        <input
          ref={searchRef}
          className="pf-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
          placeholder="Search by style name or SKU..."
        />
        {searchQuery && (
          <button className="pf-search-clear" onClick={() => { setSearchQuery(''); searchRef.current?.focus() }}>&times;</button>
        )}
        {searchFocused && searchQuery.trim() && (
          <div className="pf-search-results">
            {searchResults.length === 0 && (
              <div className="pf-search-empty">No results found</div>
            )}
            {searchResults.map((r, i) => (
              <button
                key={i}
                className="pf-search-result-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSearchSelect(r)}
              >
                <span className="pf-search-result-label">{r.label}</span>
                <span className="pf-search-result-tier">{r.tierLabel}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tier sections */}
      {effectiveTiers.map((tier) => {
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
                    <div className="wedder-finder-v2">
                      <div className="wedder-selectors-col">
                        <StylePicker
                          styles={tierStyles}
                          selected={isTierActive ? styleId : null}
                          onSelect={handleStyleSelect}
                          cacheBust={imgVersion}
                        />

                        {isTierActive && (
                          <>
                            {optionDefs.map((def) => {
                              const opts = filteredOptions[def.key] || []
                              if (opts.length === 0) return null
                              return (
                                <OptionPicker
                                  key={def.key}
                                  label={def.label}
                                  options={opts}
                                  selected={selections[def.key]}
                                  onSelect={(v) => {
                                    setSelections((prev) => {
                                      const next = { ...prev, [def.key]: v }
                                      // Clear downstream selections so they auto-pick from new filtered options
                                      const defIdx = optionDefs.indexOf(def)
                                      for (let i = defIdx + 1; i < optionDefs.length; i++) {
                                        next[optionDefs[i].key] = null
                                      }
                                      return next
                                    })
                                  }}
                                />
                              )
                            })}

                            <div className="wedder-result">
                              {!allSelected && (
                                <p className="wedder-result-prompt">
                                  Select all options above to find the P number
                                </p>
                              )}
                              {allSelected && pNumber && (() => {
                                const sku = pNumber.startsWith('P') ? pNumber.slice(1) : pNumber
                                return (
                                  <div className="wedder-result-found">
                                    <span className="wedder-result-label">SKU</span>
                                    <div className="wedder-result-sku-row">
                                      <span className="wedder-result-sku">{sku}</span>
                                      <button
                                        className="wedder-copy-btn"
                                        onClick={async () => {
                                          try {
                                            await navigator.clipboard.writeText(sku)
                                            setPriceCopied(true)
                                            setTimeout(() => setPriceCopied(false), 2000)
                                          } catch {}
                                        }}
                                      >
                                        {priceCopied ? 'Copied' : 'Copy'}
                                      </button>
                                    </div>
                                    <button
                                      className="wedder-price-btn"
                                      onClick={() => handleGetPrice(sku)}
                                    >
                                      Get Price
                                    </button>
                                  </div>
                                )
                              })()}
                              {allSelected && !pNumber && (
                                <p className="wedder-result-not-found">No P number found for this combination</p>
                              )}
                            </div>

                            {allSelected && pNumber && (
                              <div className="wedder-sku-entry">
                                <div className="wedder-step-label">Blue Tag SKU</div>
                                <div className="wedder-sku-entry-row">
                                  <input
                                    className="wedder-sku-entry-input"
                                    type="text"
                                    value={skuInput}
                                    onChange={(e) => setSkuInput(e.target.value)}
                                    placeholder="Enter Blue Tag SKU..."
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

      {/* Server image picker modal */}
      {pickerForStyle && (
        <ServerImagePicker
          onSelect={handlePickServerImage}
          onClose={() => setPickerForStyle(null)}
          cacheBust={imgVersion}
        />
      )}
    </div>
  )
}
