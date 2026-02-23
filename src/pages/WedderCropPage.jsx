import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const CATALOG_DEFS = [
  { id: 1, label: 'Catalog 1', desc: 'Flat' },
  { id: 2, label: 'Catalog 2', desc: 'High Dome + Round High Dome' },
  { id: 3, label: 'Catalog 3', desc: 'Lite Half Round + Half Round' },
  { id: 4, label: 'Catalog 4', desc: 'Bevel Two Tone + Flat Groove + Vert Side Bevel' },
  { id: 5, label: 'Catalog 5', desc: 'Flat Bevel + Reverse Bevel' },
]

// ── Crop canvas component ──────────────────────────────────────
function CropCanvas({ imageSrc, crops, onCropsChange, catalogId }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [imgEl, setImgEl] = useState(null)
  const [drawing, setDrawing] = useState(false)
  const [startPt, setStartPt] = useState(null)
  const [currentRect, setCurrentRect] = useState(null)
  const [scale, setScale] = useState(1)
  const [editIdx, setEditIdx] = useState(null)

  // Load image
  useEffect(() => {
    if (!imageSrc) return
    const img = new Image()
    img.onload = () => setImgEl(img)
    img.src = imageSrc
  }, [imageSrc])

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !imgEl) return
    const container = containerRef.current
    const maxW = container.clientWidth
    const s = Math.min(maxW / imgEl.width, 1)
    setScale(s)
    canvas.width = imgEl.width * s
    canvas.height = imgEl.height * s
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height)

    // Draw existing crops
    const allRects = [...(crops || [])]
    allRects.forEach((r, i) => {
      ctx.strokeStyle = i === editIdx ? '#c49a3c' : '#010101'
      ctx.lineWidth = 2
      ctx.setLineDash(i === editIdx ? [6, 3] : [])
      ctx.strokeRect(r.x * s, r.y * s, r.w * s, r.h * s)
      ctx.setLineDash([])
      // Label
      ctx.fillStyle = i === editIdx ? '#c49a3c' : '#010101'
      ctx.font = `bold ${Math.max(12, 14 * s)}px Inter, sans-serif`
      const label = r.name || `Region ${i + 1}`
      ctx.fillText(label, r.x * s + 4, r.y * s - 6)
    })

    // Current drawing rect
    if (currentRect) {
      ctx.strokeStyle = '#4c6335'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 4])
      ctx.strokeRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h)
      ctx.setLineDash([])
    }
  }, [imgEl, crops, currentRect, editIdx])

  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  function handleDown(e) {
    e.preventDefault()
    const pos = getPos(e)
    // Check if clicking an existing crop to select it
    const clickedIdx = (crops || []).findIndex(r =>
      pos.x >= r.x * scale && pos.x <= (r.x + r.w) * scale &&
      pos.y >= r.y * scale && pos.y <= (r.y + r.h) * scale
    )
    if (clickedIdx >= 0 && !e.shiftKey) {
      setEditIdx(clickedIdx)
      return
    }
    setEditIdx(null)
    setDrawing(true)
    setStartPt(pos)
    setCurrentRect(null)
  }

  function handleMove(e) {
    if (!drawing || !startPt) return
    e.preventDefault()
    const pos = getPos(e)
    setCurrentRect({
      x: Math.min(startPt.x, pos.x),
      y: Math.min(startPt.y, pos.y),
      w: Math.abs(pos.x - startPt.x),
      h: Math.abs(pos.y - startPt.y),
    })
  }

  function handleUp() {
    if (!drawing || !currentRect || currentRect.w < 10 || currentRect.h < 10) {
      setDrawing(false)
      setCurrentRect(null)
      return
    }
    // Convert from canvas coords to image coords
    const newCrop = {
      x: Math.round(currentRect.x / scale),
      y: Math.round(currentRect.y / scale),
      w: Math.round(currentRect.w / scale),
      h: Math.round(currentRect.h / scale),
      name: '',
    }
    onCropsChange([...(crops || []), newCrop])
    setEditIdx((crops || []).length)
    setDrawing(false)
    setCurrentRect(null)
  }

  if (!imageSrc) return null

  return (
    <div className="wc-canvas-area" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="wc-canvas"
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={handleUp}
        onMouseLeave={handleUp}
        onTouchStart={handleDown}
        onTouchMove={handleMove}
        onTouchEnd={handleUp}
      />
      {editIdx !== null && crops[editIdx] && (
        <CropEditor
          crop={crops[editIdx]}
          index={editIdx}
          onChange={(updated) => {
            const next = [...crops]
            next[editIdx] = updated
            onCropsChange(next)
          }}
          onDelete={() => {
            onCropsChange(crops.filter((_, i) => i !== editIdx))
            setEditIdx(null)
          }}
          onDeselect={() => setEditIdx(null)}
        />
      )}
    </div>
  )
}

function CropEditor({ crop, index, onChange, onDelete, onDeselect }) {
  return (
    <div className="wc-crop-editor">
      <div className="wc-crop-editor-row">
        <label className="wc-crop-editor-label">Name</label>
        <input
          className="wc-crop-editor-input"
          type="text"
          value={crop.name}
          onChange={(e) => onChange({ ...crop, name: e.target.value })}
          placeholder={`Region ${index + 1}`}
        />
      </div>
      <div className="wc-crop-editor-row">
        <span className="wc-crop-editor-coords">
          {crop.x}, {crop.y} — {crop.w}x{crop.h}px
        </span>
      </div>
      <div className="wc-crop-editor-actions">
        <button className="wc-btn wc-btn--sm" onClick={onDeselect}>Done</button>
        <button className="wc-btn wc-btn--sm wc-btn--danger" onClick={onDelete}>Remove</button>
      </div>
    </div>
  )
}

// ── Drop zone for uploading ────────────────────────────────────
function DropZone({ onImageLoad, label, desc }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => onImageLoad(e.target.result)
    reader.readAsDataURL(file)
  }

  return (
    <div
      className={`wc-dropzone${dragOver ? ' wc-dropzone--active' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        handleFile(e.dataTransfer.files[0])
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFile(e.target.files[0])}
      />
      <div className="wc-dropzone-label">{label}</div>
      <div className="wc-dropzone-desc">{desc}</div>
      <div className="wc-dropzone-hint">Drop image or click to upload</div>
    </div>
  )
}

// ── Preview component ──────────────────────────────────────────
function CropPreview({ imageSrc, crop }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!imageSrc || !crop) return
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current
      canvas.width = 200
      canvas.height = 200
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, 200, 200)
      ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, 200, 200)
    }
    img.src = imageSrc
  }, [imageSrc, crop])

  return (
    <div className="wc-preview-item">
      <canvas ref={canvasRef} className="wc-preview-canvas" width={200} height={200} />
      <span className="wc-preview-name">{crop.name || 'Unnamed'}</span>
    </div>
  )
}

// ── Download helper ────────────────────────────────────────────
function downloadCrop(imageSrc, crop) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 200
      canvas.height = 200
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, 200, 200)
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const filename = (crop.name || 'crop').toLowerCase().replace(/\s+/g, '-')
        a.download = `${filename}.png`
        a.click()
        URL.revokeObjectURL(url)
        resolve()
      }, 'image/png')
    }
    img.src = imageSrc
  })
}

// ── Main page ──────────────────────────────────────────────────
function WedderCropPage() {
  const navigate = useNavigate()
  const [catalogs, setCatalogs] = useState({}) // { 1: { src, crops: [] }, ... }
  const [activeTab, setActiveTab] = useState(1)

  const handleImageLoad = useCallback((catalogId, src) => {
    setCatalogs((prev) => ({
      ...prev,
      [catalogId]: { src, crops: prev[catalogId]?.crops || [] },
    }))
  }, [])

  const handleCropsChange = useCallback((catalogId, crops) => {
    setCatalogs((prev) => ({
      ...prev,
      [catalogId]: { ...prev[catalogId], crops },
    }))
  }, [])

  // Gather all crops across all catalogs for preview
  const allCrops = CATALOG_DEFS.flatMap((def) => {
    const cat = catalogs[def.id]
    if (!cat || !cat.crops?.length) return []
    return cat.crops.map((c) => ({ ...c, catalogId: def.id, src: cat.src }))
  })

  async function handleDownloadAll() {
    for (const c of allCrops) {
      await downloadCrop(c.src, c)
    }
  }

  const activeCat = catalogs[activeTab]

  return (
    <div className="wc-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/wedders')}>Wedders</button>
        <h1>Crop Style Images</h1>
      </div>

      <p className="wc-instructions">
        Upload catalog images, draw crop rectangles around each ring style, name them, then download.
        Hold <strong>Shift + click</strong> inside an existing region to start a new one on top.
      </p>

      {/* Tab bar */}
      <div className="wc-tabs">
        {CATALOG_DEFS.map((def) => (
          <button
            key={def.id}
            className={`wc-tab${activeTab === def.id ? ' wc-tab--active' : ''}${catalogs[def.id] ? ' wc-tab--loaded' : ''}`}
            onClick={() => setActiveTab(def.id)}
          >
            <span className="wc-tab-num">{def.id}</span>
            {catalogs[def.id] && <span className="wc-tab-dot" />}
          </button>
        ))}
      </div>

      {/* Active catalog */}
      <div className="wc-workspace">
        <div className="wc-catalog-info">
          <span className="wc-catalog-label">{CATALOG_DEFS[activeTab - 1].label}</span>
          <span className="wc-catalog-desc">{CATALOG_DEFS[activeTab - 1].desc}</span>
        </div>

        {!activeCat?.src ? (
          <DropZone
            label={CATALOG_DEFS[activeTab - 1].label}
            desc={CATALOG_DEFS[activeTab - 1].desc}
            onImageLoad={(src) => handleImageLoad(activeTab, src)}
          />
        ) : (
          <>
            <div className="wc-image-actions">
              <button
                className="wc-btn wc-btn--sm wc-btn--outline"
                onClick={() => setCatalogs((prev) => {
                  const next = { ...prev }
                  delete next[activeTab]
                  return next
                })}
              >
                Replace Image
              </button>
              <span className="wc-crop-count">
                {activeCat.crops?.length || 0} region{(activeCat.crops?.length || 0) !== 1 ? 's' : ''}
              </span>
            </div>
            <CropCanvas
              imageSrc={activeCat.src}
              crops={activeCat.crops || []}
              onCropsChange={(crops) => handleCropsChange(activeTab, crops)}
              catalogId={activeTab}
            />
          </>
        )}
      </div>

      {/* Preview all crops */}
      {allCrops.length > 0 && (
        <div className="wc-preview-section">
          <div className="wc-preview-header">
            <h2 className="wc-preview-title">Cropped Styles ({allCrops.length})</h2>
            <button className="wc-btn" onClick={handleDownloadAll}>
              Download All
            </button>
          </div>
          <div className="wc-preview-grid">
            {allCrops.map((c, i) => (
              <CropPreview key={`${c.catalogId}-${i}`} imageSrc={c.src} crop={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default WedderCropPage
