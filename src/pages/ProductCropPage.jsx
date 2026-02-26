import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

// ── Crop canvas component ──────────────────────────────────────
function CropCanvas({ imageSrc, crops, onCropsChange, styleNames }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [imgEl, setImgEl] = useState(null)
  const [drawing, setDrawing] = useState(false)
  const [startPt, setStartPt] = useState(null)
  const [currentRect, setCurrentRect] = useState(null)
  const [scale, setScale] = useState(1)
  const [editIdx, setEditIdx] = useState(null)

  useEffect(() => {
    if (!imageSrc) return
    const img = new Image()
    img.onload = () => setImgEl(img)
    img.src = imageSrc
  }, [imageSrc])

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

    const allRects = [...(crops || [])]
    allRects.forEach((r, i) => {
      ctx.strokeStyle = i === editIdx ? '#c49a3c' : '#010101'
      ctx.lineWidth = 2
      ctx.setLineDash(i === editIdx ? [6, 3] : [])
      ctx.strokeRect(r.x * s, r.y * s, r.w * s, r.h * s)
      ctx.setLineDash([])
      ctx.fillStyle = i === editIdx ? '#c49a3c' : '#010101'
      ctx.font = `bold ${Math.max(12, 14 * s)}px Inter, sans-serif`
      const label = r.name || `Region ${i + 1}`
      ctx.fillText(label, r.x * s + 4, r.y * s - 6)
    })

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
          styleNames={styleNames}
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

function CropEditor({ crop, index, onChange, onDelete, onDeselect, styleNames }) {
  return (
    <div className="wc-crop-editor">
      <div className="wc-crop-editor-row">
        <label className="wc-crop-editor-label">Name</label>
        {styleNames?.length > 0 ? (
          <select
            className="wc-crop-editor-input"
            value={crop.name}
            onChange={(e) => onChange({ ...crop, name: e.target.value })}
          >
            <option value="">— Select style —</option>
            {styleNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        ) : (
          <input
            className="wc-crop-editor-input"
            type="text"
            value={crop.name}
            onChange={(e) => onChange({ ...crop, name: e.target.value })}
            placeholder={`Region ${index + 1}`}
          />
        )}
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

async function renderPdfPage(pdfDoc, pageNum, scale = 3) {
  const page = await pdfDoc.getPage(pageNum)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas.toDataURL('image/png')
}

function DropZone({ onImageLoad, label, desc }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [pdfPages, setPdfPages] = useState(null) // { doc, thumbs: [dataUrl], count }
  const [loading, setLoading] = useState(false)

  async function handleFile(file) {
    if (!file) return

    // Image file
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => onImageLoad(e.target.result)
      reader.readAsDataURL(file)
      return
    }

    // PDF file
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      setLoading(true)
      try {
        const arrayBuffer = await file.arrayBuffer()
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        const count = pdfDoc.numPages

        if (count === 1) {
          // Single page — render at high res and use directly
          const dataUrl = await renderPdfPage(pdfDoc, 1)
          onImageLoad(dataUrl)
          setLoading(false)
          return
        }

        // Multi-page — render thumbnails for page picker
        const thumbs = []
        for (let i = 1; i <= count; i++) {
          const thumb = await renderPdfPage(pdfDoc, i, 0.5)
          thumbs.push(thumb)
        }
        setPdfPages({ doc: pdfDoc, thumbs, count })
      } catch (err) {
        console.error('PDF load failed:', err)
      }
      setLoading(false)
      return
    }
  }

  async function handlePageSelect(pageNum) {
    if (!pdfPages) return
    setLoading(true)
    const dataUrl = await renderPdfPage(pdfPages.doc, pageNum)
    setPdfPages(null)
    setLoading(false)
    onImageLoad(dataUrl)
  }

  // PDF page picker view
  if (pdfPages) {
    return (
      <div className="wc-dropzone wc-dropzone--pages">
        <div className="wc-dropzone-label">Select a page ({pdfPages.count} pages)</div>
        <div className="wc-pdf-page-grid">
          {pdfPages.thumbs.map((thumb, i) => (
            <button key={i} className="wc-pdf-page-btn" onClick={() => handlePageSelect(i + 1)}>
              <img src={thumb} alt={`Page ${i + 1}`} className="wc-pdf-page-thumb" />
              <span className="wc-pdf-page-num">{i + 1}</span>
            </button>
          ))}
        </div>
        <button className="wc-btn wc-btn--sm wc-btn--outline" style={{ marginTop: '0.75rem' }} onClick={() => setPdfPages(null)}>
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div
      className={`wc-dropzone${dragOver ? ' wc-dropzone--active' : ''}`}
      onClick={() => !loading && inputRef.current?.click()}
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
        accept="image/*,.pdf,application/pdf"
        hidden
        onChange={(e) => { handleFile(e.target.files[0]); e.target.value = '' }}
      />
      <div className="wc-dropzone-label">{label}</div>
      <div className="wc-dropzone-desc">{desc}</div>
      <div className="wc-dropzone-hint">
        {loading ? 'Loading PDF...' : 'Drop image or PDF, or click to upload'}
      </div>
    </div>
  )
}

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

function uploadCrop(imageSrc, crop) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 200
      canvas.height = 200
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, 200, 200)
      const dataUrl = canvas.toDataURL('image/png')
      const styleId = crop.name || 'crop'
      fetch('/api/upload-style-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ styleId, image: dataUrl }),
      })
        .then((res) => res.json())
        .then((data) => resolve({ styleId, url: data.url }))
        .catch(reject)
    }
    img.src = imageSrc
  })
}

// ── Generic crop page ──────────────────────────────────────────
export default function ProductCropPage({ productName, backPath, catalogDefs, styleNames }) {
  const navigate = useNavigate()
  const [catalogs, setCatalogs] = useState({})
  const [activeTab, setActiveTab] = useState(catalogDefs[0]?.id ?? 1)
  const [uploading, setUploading] = useState(false)
  const [uploadResults, setUploadResults] = useState(null)

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

  const allCrops = catalogDefs.flatMap((def) => {
    const cat = catalogs[def.id]
    if (!cat || !cat.crops?.length) return []
    return cat.crops.map((c) => ({ ...c, catalogId: def.id, src: cat.src }))
  })

  async function handleUploadAll() {
    setUploading(true)
    setUploadResults(null)
    const results = []
    for (const c of allCrops) {
      try {
        const r = await uploadCrop(c.src, c)
        results.push({ name: r.styleId, ok: true })
      } catch {
        results.push({ name: c.name || 'unknown', ok: false })
      }
    }
    setUploading(false)
    setUploadResults(results)
    setTimeout(() => setUploadResults(null), 5000)
  }

  const activeCat = catalogs[activeTab]
  const activeDef = catalogDefs.find((d) => d.id === activeTab) || catalogDefs[0]

  return (
    <div className="wc-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(backPath)}>{productName}</button>
        <h1>Crop {productName} Images</h1>
      </div>

      <p className="wc-instructions">
        Upload catalog images, draw crop rectangles around each style, name them, then save to server.
        Hold <strong>Shift + click</strong> inside an existing region to start a new one on top.
      </p>

      <div className="wc-tabs">
        {catalogDefs.map((def) => (
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

      <div className="wc-workspace">
        <div className="wc-catalog-info">
          <span className="wc-catalog-label">{activeDef.label}</span>
          <span className="wc-catalog-desc">{activeDef.desc}</span>
        </div>

        {!activeCat?.src ? (
          <DropZone
            label={activeDef.label}
            desc={activeDef.desc}
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
              styleNames={styleNames}
            />
          </>
        )}
      </div>

      {allCrops.length > 0 && (
        <div className="wc-preview-section">
          <div className="wc-preview-header">
            <h2 className="wc-preview-title">Cropped Styles ({allCrops.length})</h2>
            <button className="wc-btn" onClick={handleUploadAll} disabled={uploading}>
              {uploading ? 'Saving...' : 'Save All to Server'}
            </button>
          </div>
          {uploadResults && (
            <div className="wc-upload-results">
              {uploadResults.map((r, i) => (
                <span key={i} className={r.ok ? 'wc-upload-ok' : 'wc-upload-fail'}>
                  {r.name}: {r.ok ? 'saved' : 'failed'}
                </span>
              ))}
            </div>
          )}
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
