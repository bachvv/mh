import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const STORAGE_KEY = 'watch-skus'

function loadWatchMap() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch { return {} }
}

function saveWatchMap(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

function WatchesPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [watchMap, setWatchMap] = useState(loadWatchMap)
  const [code, setCode] = useState('')
  const [sku, setSku] = useState('')
  const [msg, setMsg] = useState(null)
  const [editMode, setEditMode] = useState(false)

  const normalizedCode = code.trim().toUpperCase()
  const existingSku = normalizedCode ? (watchMap[normalizedCode] || '') : ''

  useEffect(() => {
    setSku(existingSku)
    setMsg(null)
  }, [normalizedCode])

  function handleSave() {
    if (!normalizedCode || !sku.trim()) return
    const next = { ...watchMap, [normalizedCode]: sku.trim() }
    setWatchMap(next)
    saveWatchMap(next)
    setMsg('Saved')
    setEditMode(false)
    setTimeout(() => setMsg(null), 2000)
  }

  function handleDelete(key) {
    const next = { ...watchMap }
    delete next[key]
    setWatchMap(next)
    saveWatchMap(next)
  }

  const entries = Object.entries(watchMap).sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="watches-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/concierge')}>SKU Finder</button>
        <h1>Watches</h1>
        {isAdmin && (
          <button className="watches-pair-btn" onClick={() => navigate('/watch-pair')}>Pair</button>
        )}
      </div>

      <div className="watches-lookup-card">
        <div className="wedder-step-label">Enter Watch Code</div>
        <div className="watches-input-row">
          <input
            className="watches-code-input"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.slice(0, 6))}
            placeholder="e.g. 1234"
            maxLength={6}
          />
          {normalizedCode && existingSku && !editMode && (
            <div className="watches-result">
              <span className="watches-result-label">SKU</span>
              <span className="watches-result-sku">{existingSku}</span>
              {isAdmin && (
                <button
                  className="watches-edit-btn"
                  onClick={() => { setEditMode(true); setSku(existingSku) }}
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
          <div className="wedder-step-label">Saved Codes</div>
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
        </div>
      )}
    </div>
  )
}

export default WatchesPage
