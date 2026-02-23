import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const STORAGE_KEY = 'watch-skus'

function loadWatchMap() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} }
  catch { return {} }
}

function saveWatchMap(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

const INITIAL_ROWS = 10

function emptyRow() {
  return { code: '', sku: '' }
}

function WatchPairPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [rows, setRows] = useState(() => Array.from({ length: INITIAL_ROWS }, emptyRow))
  const [saved, setSaved] = useState(false)
  const lastRowRef = useRef(null)

  // Redirect non-admins
  useEffect(() => {
    if (!isAdmin) navigate('/watches')
  }, [isAdmin, navigate])

  function updateRow(i, field, value) {
    setRows(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      return next
    })
    setSaved(false)
  }

  function removeRow(i) {
    setRows(prev => {
      if (prev.length <= 1) return [emptyRow()]
      return prev.filter((_, idx) => idx !== i)
    })
    setSaved(false)
  }

  function addRows(count = 5) {
    setRows(prev => [...prev, ...Array.from({ length: count }, emptyRow)])
    // Scroll to new rows after render
    setTimeout(() => lastRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }

  function handleSave() {
    const map = loadWatchMap()
    let added = 0
    for (const row of rows) {
      const code = row.code.trim().toUpperCase()
      const sku = row.sku.trim()
      if (code && sku) {
        map[code] = sku
        added++
      }
    }
    if (added === 0) return
    saveWatchMap(map)
    setSaved(true)
    // Clear filled rows after save
    setRows(prev => {
      const remaining = prev.filter(r => !r.code.trim() || !r.sku.trim())
      return remaining.length > 0 ? remaining : Array.from({ length: INITIAL_ROWS }, emptyRow)
    })
    setTimeout(() => setSaved(false), 3000)
  }

  function handleKeyDown(e, i) {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Move to next row's code input
      const nextInput = document.querySelector(`[data-row="${i + 1}"][data-field="code"]`)
      if (nextInput) {
        nextInput.focus()
      } else {
        addRows(1)
        setTimeout(() => {
          const newInput = document.querySelector(`[data-row="${i + 1}"][data-field="code"]`)
          newInput?.focus()
        }, 50)
      }
    }
  }

  const filledCount = rows.filter(r => r.code.trim() && r.sku.trim()).length

  return (
    <div className="wp-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/watches')}>Watches</button>
        <h1>Pair Watches</h1>
      </div>

      <div className="wp-card">
        <div className="wp-table-header">
          <span className="wp-col-code">Code</span>
          <span className="wp-col-sku">SKU</span>
          <span className="wp-col-action"></span>
        </div>
        <div className="wp-table-body">
          {rows.map((row, i) => (
            <div
              key={i}
              className="wp-table-row"
              ref={i === rows.length - 1 ? lastRowRef : null}
            >
              <input
                className="wp-input wp-input-code"
                data-row={i}
                data-field="code"
                type="text"
                value={row.code}
                onChange={(e) => updateRow(i, 'code', e.target.value.slice(0, 6))}
                onKeyDown={(e) => { if (e.key === 'Tab' && !e.shiftKey) return; handleKeyDown(e, i) }}
                placeholder="Code"
                maxLength={6}
              />
              <input
                className="wp-input wp-input-sku"
                data-row={i}
                data-field="sku"
                type="text"
                value={row.sku}
                onChange={(e) => updateRow(i, 'sku', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                placeholder="SKU"
              />
              <button
                className="wp-row-remove"
                onClick={() => removeRow(i)}
                title="Remove row"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="wp-actions">
        <button className="wp-add-btn" onClick={() => addRows(5)}>
          + Add Rows
        </button>
        <div className="wp-actions-right">
          {saved && <span className="wp-saved-msg">Saved {filledCount || ''} pairs</span>}
          <button
            className="wp-save-btn"
            onClick={handleSave}
            disabled={filledCount === 0}
          >
            Save ({filledCount})
          </button>
        </div>
      </div>
    </div>
  )
}

export default WatchPairPage
