import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const WEDDER_IMAGES_KEY = 'wedder-style-images'
const WEDDER_SKUS_KEY = 'wedder-skus'
const WATCH_SKUS_KEY = 'watch-skus'

function loadJson(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {} }
  catch { return {} }
}

function saveJson(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

function estimateSize(key) {
  const val = localStorage.getItem(key)
  if (!val) return 0
  return new Blob([val]).size
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ImageAdminPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  useEffect(() => {
    if (!isAdmin) navigate('/concierge', { replace: true })
  }, [isAdmin, navigate])

  if (!isAdmin) return null
  const [wedderImages, setWedderImages] = useState(() => loadJson(WEDDER_IMAGES_KEY))
  const [wedderSkus, setWedderSkus] = useState(() => loadJson(WEDDER_SKUS_KEY))
  const [watchSkus, setWatchSkus] = useState(() => loadJson(WATCH_SKUS_KEY))
  const [msg, setMsg] = useState(null)
  const uploadRef = useRef(null)

  function showMsg(text) {
    setMsg(text)
    setTimeout(() => setMsg(null), 3000)
  }

  // Wedder images
  const wedderImageEntries = Object.entries(wedderImages)
  const wedderSkuEntries = Object.entries(wedderSkus).filter(([, v]) => v)
  const watchSkuEntries = Object.entries(watchSkus)

  function removeWedderImage(styleId) {
    const next = { ...wedderImages }
    delete next[styleId]
    setWedderImages(next)
    saveJson(WEDDER_IMAGES_KEY, next)
    showMsg(`Removed image for ${styleId}`)
  }

  function clearAllWedderImages() {
    setWedderImages({})
    saveJson(WEDDER_IMAGES_KEY, {})
    showMsg('All wedder images cleared')
  }

  function removeWedderSku(pKey) {
    const next = { ...wedderSkus }
    delete next[pKey]
    setWedderSkus(next)
    saveJson(WEDDER_SKUS_KEY, next)
  }

  function clearAllWedderSkus() {
    setWedderSkus({})
    saveJson(WEDDER_SKUS_KEY, {})
    showMsg('All wedder SKUs cleared')
  }

  function removeWatchSku(code) {
    const next = { ...watchSkus }
    delete next[code]
    setWatchSkus(next)
    saveJson(WATCH_SKUS_KEY, next)
  }

  function clearAllWatchSkus() {
    setWatchSkus({})
    saveJson(WATCH_SKUS_KEY, {})
    showMsg('All watch SKUs cleared')
  }

  // Export all data as JSON
  function handleExport() {
    const data = {
      wedderImages: loadJson(WEDDER_IMAGES_KEY),
      wedderSkus: loadJson(WEDDER_SKUS_KEY),
      watchSkus: loadJson(WATCH_SKUS_KEY),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sku-finder-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    showMsg('Exported')
  }

  // Import data from JSON
  function handleImport(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        if (data.wedderImages) {
          const merged = { ...wedderImages, ...data.wedderImages }
          setWedderImages(merged)
          saveJson(WEDDER_IMAGES_KEY, merged)
        }
        if (data.wedderSkus) {
          const merged = { ...wedderSkus, ...data.wedderSkus }
          setWedderSkus(merged)
          saveJson(WEDDER_SKUS_KEY, merged)
        }
        if (data.watchSkus) {
          const merged = { ...watchSkus, ...data.watchSkus }
          setWatchSkus(merged)
          saveJson(WATCH_SKUS_KEY, merged)
        }
        showMsg('Imported successfully')
      } catch {
        showMsg('Invalid file format')
      }
    }
    reader.readAsText(file)
  }

  const totalSize = estimateSize(WEDDER_IMAGES_KEY) + estimateSize(WEDDER_SKUS_KEY) + estimateSize(WATCH_SKUS_KEY)

  return (
    <div className="img-admin-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/concierge')}>SKU Finder</button>
        <h1>Image Admin</h1>
      </div>

      {msg && <div className="wedder-upload-msg" style={{ marginBottom: '1rem' }}>{msg}</div>}

      {/* Stats */}
      <div className="img-admin-section">
        <div className="img-admin-stats">
          <div className="img-admin-stat">
            <span className="img-admin-stat-value">{wedderImageEntries.length}</span>
            <span className="img-admin-stat-label">Style Images</span>
          </div>
          <div className="img-admin-stat">
            <span className="img-admin-stat-value">{wedderSkuEntries.length}</span>
            <span className="img-admin-stat-label">Wedder SKUs</span>
          </div>
          <div className="img-admin-stat">
            <span className="img-admin-stat-value">{watchSkuEntries.length}</span>
            <span className="img-admin-stat-label">Watch SKUs</span>
          </div>
          <div className="img-admin-stat">
            <span className="img-admin-stat-value">{formatBytes(totalSize)}</span>
            <span className="img-admin-stat-label">Storage Used</span>
          </div>
        </div>
        <div className="img-admin-actions">
          <button className="img-admin-btn" onClick={handleExport}>Export All</button>
          <button className="img-admin-btn" onClick={() => uploadRef.current?.click()}>Import</button>
          <input
            ref={uploadRef}
            type="file"
            accept=".json"
            hidden
            onChange={(e) => { handleImport(e.target.files[0]); e.target.value = '' }}
          />
        </div>
      </div>

      {/* Wedder Style Images */}
      <div className="img-admin-section">
        <div className="img-admin-section-title">
          Wedder Style Images
          <span className="img-admin-count">{wedderImageEntries.length} images</span>
        </div>
        {wedderImageEntries.length === 0 ? (
          <p className="img-admin-empty">No style images uploaded yet</p>
        ) : (
          <div className="img-admin-grid">
            {wedderImageEntries.map(([id, src]) => (
              <div key={id} className="img-admin-item">
                <img src={src} alt={id} className="img-admin-thumb" />
                <span className="img-admin-label">{id}</span>
                <button
                  className="img-admin-remove"
                  onClick={() => removeWedderImage(id)}
                  title="Remove"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
        {wedderImageEntries.length > 0 && (
          <div className="img-admin-actions">
            <button className="img-admin-btn img-admin-btn--danger" onClick={clearAllWedderImages}>
              Clear All Images
            </button>
          </div>
        )}
      </div>

      {/* Wedder SKUs */}
      <div className="img-admin-section">
        <div className="img-admin-section-title">
          Wedder SKU Mappings
          <span className="img-admin-count">{wedderSkuEntries.length} entries</span>
        </div>
        {wedderSkuEntries.length === 0 ? (
          <p className="img-admin-empty">No wedder SKUs saved yet</p>
        ) : (
          <div className="watches-list">
            {wedderSkuEntries.map(([pKey, sku]) => (
              <div key={pKey} className="watches-list-row">
                <span className="watches-list-code" style={{ width: 'auto', flex: 1, fontSize: '0.78rem', letterSpacing: 0 }}>{pKey}</span>
                <span className="watches-list-sku" style={{ flex: 'none' }}>{sku}</span>
                <button className="watches-list-delete" onClick={() => removeWedderSku(pKey)} title="Remove">&times;</button>
              </div>
            ))}
          </div>
        )}
        {wedderSkuEntries.length > 0 && (
          <div className="img-admin-actions">
            <button className="img-admin-btn img-admin-btn--danger" onClick={clearAllWedderSkus}>
              Clear All Wedder SKUs
            </button>
          </div>
        )}
      </div>

      {/* Watch SKUs */}
      <div className="img-admin-section">
        <div className="img-admin-section-title">
          Watch SKU Mappings
          <span className="img-admin-count">{watchSkuEntries.length} entries</span>
        </div>
        {watchSkuEntries.length === 0 ? (
          <p className="img-admin-empty">No watch SKUs saved yet</p>
        ) : (
          <div className="watches-list">
            {watchSkuEntries.map(([code, sku]) => (
              <div key={code} className="watches-list-row">
                <span className="watches-list-code">{code}</span>
                <span className="watches-list-sku">{sku}</span>
                <button className="watches-list-delete" onClick={() => removeWatchSku(code)} title="Remove">&times;</button>
              </div>
            ))}
          </div>
        )}
        {watchSkuEntries.length > 0 && (
          <div className="img-admin-actions">
            <button className="img-admin-btn img-admin-btn--danger" onClick={clearAllWatchSkus}>
              Clear All Watch SKUs
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ImageAdminPage
