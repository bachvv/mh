import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  wedderStyles,
  wedderMetals,
  wedderWidths,
  wedderFinishes,
  wedderPNumbers,
} from '../data/wedders'

// Step 1 — pick a style/profile
function StylePicker({ selected, onSelect }) {
  return (
    <div className="wedder-step">
      <div className="wedder-step-label">Style / Profile</div>
      <div className="wedder-style-grid">
        {wedderStyles.map((s) => (
          <button
            key={s.id}
            className={`wedder-style-card${selected === s.id ? ' wedder-style-card--active' : ''}`}
            onClick={() => onSelect(s.id)}
          >
            <div className="wedder-style-img-wrap">
              <img
                src={s.image}
                alt={s.name}
                className="wedder-style-img"
                onError={(e) => { e.target.style.display = 'none' }}
              />
            </div>
            <span className="wedder-style-name">{s.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// Generic button-group selector
function OptionPicker({ label, options, selected, onSelect }) {
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

function WeddersPage() {
  const navigate = useNavigate()

  const [style, setStyle]   = useState(null)
  const [metal, setMetal]   = useState(null)
  const [width, setWidth]   = useState(null)
  const [finish, setFinish] = useState(null)

  const allSelected = style && metal && width && finish
  const pKey    = allSelected ? `${style}|${metal}|${width}|${finish}` : null
  const pNumber = pKey ? wedderPNumbers[pKey] : null

  function handleReset() {
    setStyle(null)
    setMetal(null)
    setWidth(null)
    setFinish(null)
  }

  const selectedStyle = wedderStyles.find((s) => s.id === style)

  return (
    <div className="wedders-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/dev')}>Dev</button>
        <h1>Wedders Concierge</h1>
      </div>

      <div className="wedder-finder-v2">
        {/* ── Left column: style image preview ── */}
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

        {/* ── Right column: selectors ── */}
        <div className="wedder-selectors-col">
          <StylePicker selected={style} onSelect={(v) => { setStyle(v) }} />

          <OptionPicker
            label="Metal"
            options={wedderMetals}
            selected={metal}
            onSelect={setMetal}
          />

          <OptionPicker
            label="Width"
            options={wedderWidths}
            selected={width}
            onSelect={setWidth}
          />

          <OptionPicker
            label="Finish"
            options={wedderFinishes}
            selected={finish}
            onSelect={setFinish}
          />

          {/* ── Result ── */}
          <div className="wedder-result">
            {!allSelected && (
              <p className="wedder-result-prompt">Select all options above to find the P number</p>
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

          {(style || metal || width || finish) && (
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
