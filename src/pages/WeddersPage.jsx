import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { wedderStyles, wedderPNumbers } from '../data/wedders'

// ── Style selector cards ──────────────────────────────────────────
function StylePicker({ selected, onSelect }) {
  const plain     = wedderStyles.filter((s) => s.category === 'Plain')
  const patterned = wedderStyles.filter((s) => s.category === 'Patterned')

  return (
    <div className="wedder-step">
      <div className="wedder-step-label">Style / Profile</div>

      <div className="wedder-style-category-label">Plain</div>
      <div className="wedder-style-grid">
        {plain.map((s) => <StyleCard key={s.id} style={s} selected={selected} onSelect={onSelect} />)}
      </div>

      <div className="wedder-style-category-label" style={{ marginTop: '0.75rem' }}>Patterned</div>
      <div className="wedder-style-grid">
        {patterned.map((s) => <StyleCard key={s.id} style={s} selected={selected} onSelect={onSelect} />)}
      </div>
    </div>
  )
}

function StyleCard({ style, selected, onSelect }) {
  return (
    <button
      className={`wedder-style-card${selected === style.id ? ' wedder-style-card--active' : ''}`}
      onClick={() => onSelect(style.id)}
    >
      <div className="wedder-style-img-wrap">
        <img
          src={style.image}
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

  const selectedStyle = wedderStyles.find((s) => s.id === styleId) ?? null
  const noFinish      = selectedStyle && selectedStyle.finishes.length === 0

  // Reset downstream selections when style changes
  function handleStyleSelect(id) {
    const s = wedderStyles.find((st) => st.id === id)
    setStyleId(id)
    if (metal  && !s.metals.includes(metal))    setMetal(null)
    if (width  && !s.widths.includes(width))    setWidth(null)
    if (finish && !s.finishes.includes(finish)) setFinish(null)
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

  function handleReset() {
    setStyleId(null)
    setMetal(null)
    setWidth(null)
    setFinish(null)
  }

  const anythingSelected = styleId || metal || width || finish

  return (
    <div className="wedders-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/dev')}>Dev</button>
        <h1>Wedders Concierge</h1>
      </div>

      <div className="wedder-finder-v2">
        {/* ── Left: style preview image ── */}
        <div className="wedder-preview-col">
          <div className="wedder-preview-img-wrap">
            {selectedStyle ? (
              <img
                src={selectedStyle.image}
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
          <StylePicker selected={styleId} onSelect={handleStyleSelect} />

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
              </div>
            )}
            {allSelected && !pNumber && (
              <p className="wedder-result-not-found">No P number found for this combination</p>
            )}
          </div>

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
