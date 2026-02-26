import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function WatchesPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [watchMap, setWatchMap] = useState({})
  const [loaded, setLoaded] = useState(false)
  const [code, setCode] = useState('')
  const [sku, setSku] = useState('')
  const [msg, setMsg] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/watch-skus')
      .then((r) => r.json())
      .then((data) => { setWatchMap(data); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  const normalizedCode = code.trim().toUpperCase()
  const existingSku = normalizedCode ? (watchMap[normalizedCode] || '') : ''

  useEffect(() => {
    setSku(existingSku)
    setMsg(null)
  }, [normalizedCode])

  async function handleSave() {
    if (!normalizedCode || !sku.trim()) return
    // Check for duplicate SKU on a different code
    const dupCode = Object.entries(watchMap).find(([k, v]) => v === sku.trim() && k !== normalizedCode)
    if (dupCode) { setMsg(`SKU already paired to ${dupCode[0]}`); setTimeout(() => setMsg(null), 3000); return }
    // Check for duplicate code (not in edit mode)
    if (!editMode && watchMap[normalizedCode]) { setMsg(`Code ${normalizedCode} already exists`); setTimeout(() => setMsg(null), 3000); return }
    const next = { ...watchMap, [normalizedCode]: sku.trim() }
    setWatchMap(next)
    try {
      const url = editMode ? '/api/watch-skus?update=1' : '/api/watch-skus'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [normalizedCode]: sku.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        setMsg(data.duplicates?.[0] || 'Save failed')
        setWatchMap(watchMap) // revert
        setTimeout(() => setMsg(null), 3000)
        return
      }
      setMsg('Saved')
    } catch {
      setMsg('Save failed')
    }
    setEditMode(false)
    setTimeout(() => setMsg(null), 2000)
  }

  async function handleDelete(key) {
    const next = { ...watchMap }
    delete next[key]
    setWatchMap(next)
    try {
      await fetch(`/api/watch-skus/${encodeURIComponent(key)}`, { method: 'DELETE' })
    } catch { /* ignore */ }
  }

  function handleCopySku(val) {
    navigator.clipboard.writeText(val).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  function handleGetPrice(val) {
    window.open('https://hillnetapps.michaelhill.global/stock/StockEnquiry', '_blank')
    navigator.clipboard.writeText(val).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    }).catch(() => {})
  }

  const entries = Object.entries(watchMap).sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="watches-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/findsku')}>SKU Finder</button>
        <h1>Watches</h1>
        {isAdmin && (
          <button className="watches-pair-btn" onClick={() => navigate('/watch-pair')}>Pair</button>
        )}
      </div>

      {!loaded && <p className="wedder-result-prompt">Loading...</p>}

      <div className="watches-lookup-card">
        <div className="wedder-step-label">Enter 4 Digit Code</div>
        <div className="watches-code-hint">At the back of the watch</div>
        <div className="watches-input-row">
          <input
            className="watches-code-input"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.slice(0, 6))}
            placeholder="Enter 4 digit code"
            maxLength={6}
          />
          {normalizedCode && existingSku && !editMode && (
            <div className="wedder-result-found">
              <span className="wedder-result-label">SKU</span>
              <div className="wedder-result-sku-row">
                <span className="wedder-result-sku">{existingSku}</span>
                <button
                  className="wedder-copy-btn"
                  onClick={() => handleCopySku(existingSku)}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <button
                className="wedder-price-btn"
                onClick={() => handleGetPrice(existingSku)}
              >
                Get Price
              </button>
              {isAdmin && (
                <button
                  className="watches-edit-btn"
                  onClick={() => { setEditMode(true); setSku(existingSku) }}
                  style={{ marginTop: '0.5rem' }}
                >
                  Edit
                </button>
              )}
            </div>
          )}
          {normalizedCode && !existingSku && (
            <span className="watches-not-found">No SKU saved for this code</span>
          )}
        </div>

        {isAdmin && normalizedCode && (editMode || !existingSku) && (
          <div className="watches-save-row">
            <input
              className="watches-sku-input"
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Enter SKU..."
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            />
            <button
              className="wedder-sku-save-btn"
              onClick={handleSave}
              disabled={!sku.trim()}
            >
              Save
            </button>
            {editMode && (
              <button
                className="wc-btn wc-btn--sm wc-btn--outline"
                onClick={() => { setEditMode(false); setSku(existingSku) }}
              >
                Cancel
              </button>
            )}
            {msg && <span className="wedder-sku-msg">{msg}</span>}
          </div>
        )}
      </div>

      {entries.length > 0 && (
        <div className="watches-list-card">
          <button
            className="wedder-upload-toggle"
            onClick={() => setShowAll((p) => !p)}
            style={{ marginBottom: showAll ? '0.75rem' : 0 }}
          >
            {showAll ? 'Hide' : 'Show'} All Pairs ({entries.length})
          </button>
          {showAll && (
            <div className="watches-list">
              {entries.map(([k, v]) => (
                <div key={k} className="watches-list-row">
                  <span className="watches-list-code">{k}</span>
                  <span className="watches-list-sku">{v}</span>
                  {isAdmin && (
                    <button
                      className="watches-list-delete"
                      onClick={() => handleDelete(k)}
                      title="Remove"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default WatchesPage
