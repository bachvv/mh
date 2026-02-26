import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const INITIAL_ROWS = 10

function emptyRow() {
  return { code: '', sku: '' }
}

function WatchPairPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [rows, setRows] = useState(() => Array.from({ length: INITIAL_ROWS }, emptyRow))
  const [saved, setSaved] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
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
    setTimeout(() => lastRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }

  const [errorMsg, setErrorMsg] = useState('')

  async function handleSave() {
    const pairs = {}
    let added = 0
    const seenCodes = {}
    const seenSkus = {}
    const existingSkuToCode = {}
    for (const [k, v] of Object.entries(existingPairs)) existingSkuToCode[v] = k

    for (let i = 0; i < rows.length; i++) {
      const code = rows[i].code.trim().toUpperCase()
      const sku = rows[i].sku.trim()
      if (!code || !sku) continue
      // Duplicate code within batch
      if (seenCodes[code]) { setErrorMsg(`Duplicate code ${code} in rows`); setTimeout(() => setErrorMsg(''), 3000); return }
      // Duplicate SKU within batch
      if (seenSkus[sku]) { setErrorMsg(`Duplicate SKU ${sku} in rows`); setTimeout(() => setErrorMsg(''), 3000); return }
      // Code already exists
      if (existingPairs[code]) { setErrorMsg(`Code ${code} already exists`); setTimeout(() => setErrorMsg(''), 3000); return }
      // SKU already paired to another code
      if (existingSkuToCode[sku]) { setErrorMsg(`SKU ${sku} already paired to ${existingSkuToCode[sku]}`); setTimeout(() => setErrorMsg(''), 3000); return }
      seenCodes[code] = true
      seenSkus[sku] = true
      pairs[code] = sku
      added++
    }
    if (added === 0) return

    try {
      const res = await fetch('/api/watch-skus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pairs),
      })
      if (!res.ok) {
        const data = await res.json()
        setErrorMsg(data.duplicates?.[0] || 'Save failed')
        setTimeout(() => setErrorMsg(''), 3000)
        return
      }
      setSaved(true)
      setSavedCount(added)
      setRows(prev => {
        const remaining = prev.filter(r => !r.code.trim() || !r.sku.trim())
        return remaining.length > 0 ? remaining : Array.from({ length: INITIAL_ROWS }, emptyRow)
      })
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setSaved(false)
    }
  }

  function handleKeyDown(e, i) {
    if (e.key === 'Enter') {
      e.preventDefault()
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

  const [existingPairs, setExistingPairs] = useState({})
  const [showExisting, setShowExisting] = useState(false)

  useEffect(() => {
    fetch('/api/watch-skus')
      .then((r) => r.json())
      .then((data) => setExistingPairs(data))
      .catch(() => {})
  }, [saved])

  const [editingKey, setEditingKey] = useState(null)
  const [editSku, setEditSku] = useState('')

  const existingEntries = Object.entries(existingPairs).sort((a, b) => a[0].localeCompare(b[0]))

  async function handleEditSave(key) {
    if (!editSku.trim()) return
    try {
      await fetch('/api/watch-skus?update=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: editSku.trim() }),
      })
      setExistingPairs(prev => ({ ...prev, [key]: editSku.trim() }))
    } catch {}
    setEditingKey(null)
  }

  async function handleDeletePair(key) {
    try {
      await fetch(`/api/watch-skus/${encodeURIComponent(key)}`, { method: 'DELETE' })
      setExistingPairs(prev => { const next = { ...prev }; delete next[key]; return next })
    } catch {}
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
          {errorMsg && <span className="wp-saved-msg" style={{ color: '#e74c3c' }}>{errorMsg}</span>}
          {saved && <span className="wp-saved-msg">Saved {savedCount} pairs</span>}
          <button
            className="wp-save-btn"
            onClick={handleSave}
            disabled={filledCount === 0}
          >
            Save ({filledCount})
          </button>
        </div>
      </div>

      <div className="watches-list-card">
        <button
          className="wedder-upload-toggle"
          onClick={() => setShowExisting((p) => !p)}
          style={{ marginBottom: showExisting ? '0.75rem' : 0 }}
        >
          {showExisting ? 'Hide' : 'Show'} All Pairs ({existingEntries.length})
        </button>
        {showExisting && (
          existingEntries.length > 0 ? (
            <div className="watches-list">
              {existingEntries.map(([k, v]) => (
                <div key={k} className="watches-list-row">
                  <span className="watches-list-code">{k}</span>
                  {editingKey === k ? (
                    <>
                      <input
                        className="wp-input wp-input-sku"
                        style={{ flex: 1 }}
                        value={editSku}
                        onChange={(e) => setEditSku(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(k); if (e.key === 'Escape') setEditingKey(null) }}
                        autoFocus
                      />
                      <button className="watches-edit-btn" onClick={() => handleEditSave(k)}>Save</button>
                      <button className="watches-edit-btn" onClick={() => setEditingKey(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="watches-list-sku">{v}</span>
                      {isAdmin && (
                        <>
                          <button
                            className="watches-edit-btn"
                            onClick={() => { setEditingKey(k); setEditSku(v) }}
                          >
                            Edit
                          </button>
                          <button
                            className="watches-list-delete"
                            onClick={() => handleDeletePair(k)}
                            title="Remove"
                          >
                            &times;
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="wedder-result-prompt">No pairs saved yet</p>
          )
        )}
      </div>
    </div>
  )
}

export default WatchPairPage
