import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { wedderStyles } from '../data/wedders'
import { chainStyles } from '../data/chains'
import { ringStyles } from '../data/rings'
import { tennisStyles } from '../data/tennis'
import { bangleStyles } from '../data/bangles'
import { pendantStyles } from '../data/pendants'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

const PRODUCT_TYPES = {
  wedders: { label: 'Wedders', styles: wedderStyles },
  chains: { label: 'Chains', styles: chainStyles },
  rings: { label: 'Rings', styles: ringStyles },
  tennis: { label: 'Tennis', styles: tennisStyles },
  bangles: { label: 'Bangles', styles: bangleStyles },
  pendants: { label: 'Pendant Bar', styles: pendantStyles },
}

// Fallback categories if server hasn't been seeded
const DEFAULT_CATEGORIES = {
  wedders: [{ id: 'Gold', label: 'Plain Wedders' }, { id: 'MensDiamond', label: "Men's Diamond Wedders" }],
  chains: [{ id: 'Gold', label: 'Solid Chains' }, { id: 'SemiSolid', label: 'Semi Solid Chains' }],
  rings: [{ id: 'Gold', label: 'Lab Bridal' }],
  tennis: [{ id: 'Gold', label: 'Gold Tennis' }],
  bangles: [{ id: 'Gold', label: 'Gold Bangles' }],
  pendants: [{ id: 'Gold', label: 'Gold Pendants' }, { id: 'Birthstone', label: 'Birthstone & More' }],
}

function CategoryEditor({ productType, categories, onChange }) {
  const [editIdx, setEditIdx] = useState(-1)
  const [editLabel, setEditLabel] = useState('')
  const [newId, setNewId] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(updated) {
    setSaving(true)
    try {
      await fetch(`/api/categories/${productType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: updated }),
      })
      onChange(updated)
    } catch (err) {
      console.error('Save categories failed:', err)
    }
    setSaving(false)
  }

  function handleRename(idx) {
    if (!editLabel.trim()) return
    const updated = [...categories]
    updated[idx] = { ...updated[idx], label: editLabel.trim() }
    save(updated)
    setEditIdx(-1)
  }

  function handleRemove(idx) {
    save(categories.filter((_, i) => i !== idx))
  }

  function handleAdd() {
    const id = newId.trim().replace(/\s+/g, '')
    const label = newLabel.trim()
    if (!id || !label) return
    if (categories.some((c) => c.id === id)) return
    save([...categories, { id, label }])
    setNewId('')
    setNewLabel('')
  }

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
        {categories.map((cat, i) => (
          <span
            key={cat.id}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.25rem 0.5rem', fontSize: '0.8rem',
              background: '#f0ead6', border: '1px solid #c49a3c', borderRadius: '3px',
            }}
          >
            {editIdx === i ? (
              <>
                <input
                  className="wc-crop-editor-input"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRename(i); if (e.key === 'Escape') setEditIdx(-1) }}
                  autoFocus
                  style={{ width: 140, fontSize: '0.8rem', padding: '0.1rem 0.3rem' }}
                />
                <button className="wc-btn wc-btn--sm" onClick={() => handleRename(i)} style={{ padding: '0.1rem 0.4rem', fontSize: '0.75rem' }}>OK</button>
                <button className="wc-btn wc-btn--sm" onClick={() => setEditIdx(-1)} style={{ padding: '0.1rem 0.4rem', fontSize: '0.75rem' }}>✕</button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setEditIdx(i); setEditLabel(cat.label) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.75rem', color: '#999' }}
                  title="Rename"
                >&#9998;</button>
                <span style={{ fontSize: '0.75rem', color: '#999' }}>[{cat.id}]</span>
                {cat.label}
                <button
                  onClick={() => handleRemove(i)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.9rem', lineHeight: 1, color: '#999' }}
                  title="Remove"
                >&times;</button>
              </>
            )}
          </span>
        ))}
        {saving && <span style={{ fontSize: '0.75rem', color: '#999' }}>Saving...</span>}
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <input
          className="wc-crop-editor-input"
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
          placeholder="ID (e.g. SemiSolid)"
          style={{ width: 120, fontSize: '0.8rem' }}
        />
        <input
          className="wc-crop-editor-input"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Label (e.g. Semi Solid Chains)"
          style={{ width: 180, fontSize: '0.8rem' }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
        />
        <button className="wc-btn wc-btn--sm" onClick={handleAdd} disabled={!newId.trim() || !newLabel.trim()} style={{ fontSize: '0.8rem' }}>Add</button>
      </div>
    </div>
  )
}

async function renderPdfPage(pdfDoc, pageNum, scale = 2) {
  const page = await pdfDoc.getPage(pageNum)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas.toDataURL('image/png')
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

// Canvas with draw-to-crop, click-to-select, and name dropdown — same pattern as ProductCropPage
function CropCanvas({ imageSrc, crops, onCropsChange, styleNames, namesByCategory }) {
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
    const maxH = window.innerHeight * 0.85
    const s = Math.min(maxW / imgEl.width, maxH / imgEl.height, 1)
    setScale(s)
    canvas.width = imgEl.width * s
    canvas.height = imgEl.height * s
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height)

    ;(crops || []).forEach((r, i) => {
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
    // Check if clicking an existing crop (unless shift held)
    if (!e.shiftKey) {
      const clickedIdx = (crops || []).findIndex(r =>
        pos.x >= r.x * scale && pos.x <= (r.x + r.w) * scale &&
        pos.y >= r.y * scale && pos.y <= (r.y + r.h) * scale
      )
      if (clickedIdx >= 0) {
        setEditIdx(clickedIdx)
        return
      }
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
        <div className="wc-crop-editor">
          <div className="wc-crop-editor-row">
            <label className="wc-crop-editor-label">Name</label>
            <select
              className="wc-crop-editor-input"
              size={12}
              value={crops[editIdx].name}
              onChange={(e) => {
                const next = [...crops]
                next[editIdx] = { ...next[editIdx], name: e.target.value }
                onCropsChange(next)
              }}
            >
              <option value="">— Select style —</option>
              {namesByCategory ? Object.entries(namesByCategory).map(([cat, names]) => (
                <optgroup key={cat} label={cat}>
                  {names.map((n) => <option key={n} value={n}>{n}</option>)}
                </optgroup>
              )) : styleNames.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="wc-crop-editor-row">
            <span className="wc-crop-editor-coords">
              {crops[editIdx].x}, {crops[editIdx].y} — {crops[editIdx].w}x{crops[editIdx].h}px
            </span>
          </div>
          <div className="wc-crop-editor-actions">
            <button className="wc-btn wc-btn--sm" onClick={() => setEditIdx(null)}>Done</button>
            <button className="wc-btn wc-btn--sm wc-btn--danger" onClick={() => {
              onCropsChange(crops.filter((_, i) => i !== editIdx))
              setEditIdx(null)
            }}>Remove</button>
          </div>
        </div>
      )}
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
      if (!canvas) return
      canvas.width = 120
      canvas.height = 120
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, 120, 120)
    }
    img.src = imageSrc
  }, [imageSrc, crop])
  return <canvas ref={canvasRef} className="wc-preview-canvas" />
}

function CategoryNames({ category, names, baseNames, onAdd, onRemove, onEdit }) {
  const [input, setInput] = useState('')
  const [editingIdx, setEditingIdx] = useState(-1)
  const [editVal, setEditVal] = useState('')

  function handleAdd() {
    const n = input.trim()
    if (n) { onAdd(n); setInput('') }
  }

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: '0.3rem' }}>
        {category}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.4rem' }}>
        {names.map((name, i) => {
          const isBase = baseNames.includes(name)
          const isEditing = editingIdx === i && !isBase
          if (isEditing) {
            return (
              <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                <input
                  className="wc-crop-editor-input"
                  type="text"
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editVal.trim()) { onEdit(name, editVal.trim()); setEditingIdx(-1) }
                    if (e.key === 'Escape') setEditingIdx(-1)
                  }}
                  autoFocus
                  style={{ width: 120, fontSize: '0.8rem', padding: '0.15rem 0.3rem' }}
                />
                <button
                  className="wc-btn wc-btn--sm"
                  onClick={() => { if (editVal.trim()) { onEdit(name, editVal.trim()); setEditingIdx(-1) } }}
                  style={{ padding: '0.1rem 0.4rem', fontSize: '0.75rem' }}
                >OK</button>
              </span>
            )
          }
          return (
            <span
              key={name}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.2rem 0.5rem', fontSize: '0.8rem',
                background: isBase ? '#f5f5f5' : '#f0ead6',
                border: `1px solid ${isBase ? '#ddd' : '#c49a3c'}`,
                borderRadius: '3px',
              }}
            >
              {!isBase && (
                <button
                  onClick={() => { setEditingIdx(i); setEditVal(name) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.75rem', color: '#999' }}
                  title="Edit"
                >&#9998;</button>
              )}
              {name}
              {!isBase && (
                <button
                  onClick={() => onRemove(name)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.9rem', lineHeight: 1, color: '#999' }}
                  title="Remove"
                >&times;</button>
              )}
            </span>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <input
          className="wc-crop-editor-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Add to ${category}...`}
          style={{ width: 180, fontSize: '0.8rem' }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
        />
        <button className="wc-btn wc-btn--sm" onClick={handleAdd} disabled={!input.trim()} style={{ fontSize: '0.8rem' }}>Add</button>
      </div>
    </div>
  )
}

function NewCategoryRow({ onAdd, existingCategories }) {
  const [cat, setCat] = useState('')
  const [name, setName] = useState('')

  function handleAdd() {
    const c = cat.trim()
    const n = name.trim()
    if (c && n) { onAdd(c, n); setCat(''); setName('') }
  }

  return (
    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #eee' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#888', marginBottom: '0.3rem' }}>New Category</div>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="wc-crop-editor-input"
          type="text"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          placeholder="Category name..."
          style={{ width: 140, fontSize: '0.8rem' }}
        />
        <input
          className="wc-crop-editor-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="First style name..."
          style={{ width: 160, fontSize: '0.8rem' }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
        />
        <button className="wc-btn wc-btn--sm" onClick={handleAdd} disabled={!cat.trim() || !name.trim()} style={{ fontSize: '0.8rem' }}>Add</button>
      </div>
    </div>
  )
}

export default function CatalogProcessPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const inputRef = useRef(null)

  const [productType, setProductType] = useState('wedders')
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES['wedders'] || [])
  const [showCatEditor, setShowCatEditor] = useState(false)
  const [tier, setTier] = useState('Gold')

  // Load categories from server when product type changes
  useEffect(() => {
    fetch(`/api/categories/${productType}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setCategories(data)
          if (!data.some((c) => c.id === tier)) setTier(data[0].id)
        } else {
          const fallback = DEFAULT_CATEGORIES[productType] || [{ id: 'Gold', label: 'Default' }]
          setCategories(fallback)
          setTier(fallback[0].id)
        }
      })
      .catch(() => {
        const fallback = DEFAULT_CATEGORIES[productType] || [{ id: 'Gold', label: 'Default' }]
        setCategories(fallback)
        setTier(fallback[0].id)
      })
  }, [productType])
  const [pdfDoc, setPdfDoc] = useState(null)
  const [pageImages, setPageImages] = useState([]) // [{ pageNum, thumb, fullRes }]
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeProgress, setAnalyzeProgress] = useState('')
  // Each page: { pageNum, crops: [{ x, y, w, h, name }], imageSrc }
  const [pages, setPages] = useState([])
  const [activePageIdx, setActivePageIdx] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadResults, setUploadResults] = useState(null)
  const [pdfError, setPdfError] = useState('')
  // { category: [name, ...] } — extra names added by OCR or manually per category
  const [extraNames, setExtraNames] = useState({})
  const [showNames, setShowNames] = useState(false)
  // P-number extraction state
  const [pnumberData, setPnumberData] = useState(null) // { key: pnumber, ... }
  const [extractingPnumbers, setExtractingPnumbers] = useState(false)
  const [pnumberProgress, setPnumberProgress] = useState('')
  const [pnumberSaveMsg, setPnumberSaveMsg] = useState('')
  const [expandedPnStyles, setExpandedPnStyles] = useState({})

  const currentStyles = PRODUCT_TYPES[productType].styles

  // Build category -> names map (base from data + extras)
  const namesByCategory = {}
  for (const s of currentStyles) {
    const cat = s.category || 'Uncategorized'
    if (!namesByCategory[cat]) namesByCategory[cat] = []
    if (!namesByCategory[cat].includes(s.name)) namesByCategory[cat].push(s.name)
  }
  // Add extra names
  for (const [cat, names] of Object.entries(extraNames)) {
    if (!namesByCategory[cat]) namesByCategory[cat] = []
    for (const n of names) {
      if (!namesByCategory[cat].includes(n)) namesByCategory[cat].push(n)
    }
  }
  const styleCategories = Object.keys(namesByCategory)
  // Flat list for dropdown
  const styleNames = styleCategories.flatMap((cat) => namesByCategory[cat])

  if (!isAdmin) {
    return (
      <div className="wc-page">
        <p>Admin access required.</p>
        <button className="wc-btn" onClick={() => navigate('/findsku')}>Back</button>
      </div>
    )
  }

  async function handlePdfUpload(file) {
    if (!file) return
    setLoading(true)
    setPdfError('')
    setPages([])
    setPageImages([])
    // Destroy previous PDF if any
    if (pdfDoc) { pdfDoc.destroy(); setPdfDoc(null) }
    try {
      const arrayBuffer = await file.arrayBuffer()

      // Save PDF to server (replaces old one for this product+tier)
      const base64 = btoa(new Uint8Array(arrayBuffer).reduce((s, b) => s + String.fromCharCode(b), ''))
      fetch('/api/upload-catalog-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productType, tier, filename: file.name, data: base64 }),
      }).catch(() => {}) // fire and forget

      const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      setPdfDoc(doc)
      const imgs = []
      for (let i = 1; i <= doc.numPages; i++) {
        const thumb = await renderPdfPage(doc, i, 0.5)
        imgs.push({ pageNum: i, thumb, fullRes: null })
      }
      setPageImages(imgs)
    } catch (err) {
      console.error('PDF load failed:', err)
      setPdfError(`PDF load failed: ${err.message}`)
    }
    setLoading(false)
  }

  // Render all pages to full res and set up for manual cropping
  async function renderAllPages() {
    const result = []
    for (let i = 0; i < pageImages.length; i++) {
      setAnalyzeProgress(`Rendering page ${i + 1} of ${pageImages.length}...`)
      const fullRes = await renderPdfPage(pdfDoc, pageImages[i].pageNum)
      pageImages[i].fullRes = fullRes
      result.push({ pageNum: pageImages[i].pageNum, crops: [], imageSrc: fullRes })
    }
    return result
  }

  // Read names with AI OCR, then open manual crop
  async function handleReadNames() {
    if (!pdfDoc || pageImages.length === 0) return
    setAnalyzing(true)
    setPages([])
    setExtraNames({})
    setActivePageIdx(0)

    const rendered = await renderAllPages()
    // Free PDF memory
    if (pdfDoc) { pdfDoc.destroy(); setPdfDoc(null) }

    setAnalyzeProgress(`Reading style names from ${rendered.length} pages...`)
    try {
      const resp = await fetch('/api/ocr-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productType,
          pages: rendered.map((p) => ({ pageNum: p.pageNum, imageBase64: p.imageSrc })),
        }),
      })
      const data = await resp.json()
      if (data.error) throw new Error(data.error)

      // Collect all unique names into "AI Detected" category
      const detected = []
      for (const r of data.results) {
        for (const name of (r.names || [])) {
          if (name && !detected.includes(name)) detected.push(name)
        }
      }
      if (detected.length > 0) setExtraNames({ 'AI Detected': detected })
    } catch (err) {
      console.error('OCR failed:', err)
      setAnalyzeProgress(`Error: ${err.message}`)
      setAnalyzing(false)
      setPages(rendered) // still open manual crop even if OCR fails
      return
    }

    setPages(rendered)
    setAnalyzeProgress('')
    setAnalyzing(false)
  }

  // Skip AI — just render full-res pages for manual cropping
  async function handleSkipToManual() {
    if (!pdfDoc || pageImages.length === 0) return
    setAnalyzing(true)
    setPages([])
    setActivePageIdx(0)

    const result = await renderAllPages()
    // Free PDF memory
    if (pdfDoc) { pdfDoc.destroy(); setPdfDoc(null) }
    setPages(result)
    setAnalyzeProgress('')
    setAnalyzing(false)
  }

  // Extract P-numbers from catalog pages using Claude Vision
  async function handleExtractPnumbers() {
    if (!pdfDoc || pageImages.length === 0) return
    setExtractingPnumbers(true)
    setPnumberData(null)
    setPnumberSaveMsg('')

    // Render pages to full res
    const rendered = []
    for (let i = 0; i < pageImages.length; i++) {
      setPnumberProgress(`Rendering page ${i + 1} of ${pageImages.length}...`)
      const fullRes = pageImages[i].fullRes || await renderPdfPage(pdfDoc, pageImages[i].pageNum)
      pageImages[i].fullRes = fullRes
      rendered.push({ pageNum: pageImages[i].pageNum, imageBase64: fullRes })
    }

    // Load existing custom styles to help Claude match style names
    let existingStyles = []
    try {
      const resp = await fetch(`/api/custom-styles/${productType}`)
      existingStyles = await resp.json()
    } catch { /* ok */ }

    // Send pages to server for extraction (batch of 2 at a time to avoid timeouts)
    const allEntries = {}
    const batchSize = 2
    for (let i = 0; i < rendered.length; i += batchSize) {
      const batch = rendered.slice(i, i + batchSize)
      setPnumberProgress(`Extracting P-numbers from page${batch.length > 1 ? 's' : ''} ${batch.map(p => p.pageNum).join(', ')} of ${rendered.length}...`)
      try {
        const resp = await fetch('/api/extract-pnumbers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productType, tier, pages: batch, existingStyles }),
        })
        const data = await resp.json()
        if (data.error) throw new Error(data.error)
        for (const result of (data.results || [])) {
          Object.assign(allEntries, result.entries || {})
        }
      } catch (err) {
        console.error(`Extract failed for pages ${batch.map(p => p.pageNum).join(',')}:`, err)
        setPnumberProgress(`Error on page${batch.length > 1 ? 's' : ''} ${batch.map(p => p.pageNum).join(',')}: ${err.message}`)
        // Continue with other pages
      }
    }

    setPnumberData(allEntries)
    setPnumberProgress('')
    setExtractingPnumbers(false)
  }

  async function handleSavePnumbers() {
    if (!pnumberData || Object.keys(pnumberData).length === 0) return
    setPnumberSaveMsg('Saving...')
    try {
      const resp = await fetch('/api/save-pnumbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productType, pnumbers: pnumberData }),
      })
      const data = await resp.json()
      if (data.error) throw new Error(data.error)
      setPnumberSaveMsg(`Saved! ${data.count} total entries (${data.newEntries} from this extraction)`)
    } catch (err) {
      setPnumberSaveMsg(`Error: ${err.message}`)
    }
    setTimeout(() => setPnumberSaveMsg(''), 5000)
  }

  // Group pnumber entries by style name for display
  function groupPnumbersByStyle(entries) {
    const groups = {}
    for (const key of Object.keys(entries)) {
      const styleName = key.split('|')[0]
      if (!groups[styleName]) groups[styleName] = {}
      groups[styleName][key] = entries[key]
    }
    return groups
  }

  function handleCropsChange(pageIdx, crops) {
    setPages((prev) => {
      const copy = [...prev]
      copy[pageIdx] = { ...copy[pageIdx], crops }
      return copy
    })
  }

  async function handleSaveAll() {
    const allCrops = pages.flatMap((p) =>
      p.crops.filter((c) => c.name).map((c) => ({ ...c, imageSrc: p.imageSrc }))
    )
    if (allCrops.length === 0) return

    setUploading(true)
    const uploadRes = []
    const savedStyles = []
    for (const crop of allCrops) {
      try {
        const r = await uploadCrop(crop.imageSrc, crop)
        uploadRes.push({ name: r.styleId, ok: true })
        // Build style definition for server
        const slug = crop.name.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
        savedStyles.push({
          id: crop.name,
          name: crop.name,
          tier,
          image: `/images/styles/${slug}.png`,
        })
      } catch {
        uploadRes.push({ name: crop.name || 'unknown', ok: false })
      }
    }

    // Save style definitions to server
    if (savedStyles.length > 0) {
      try {
        await fetch('/api/custom-styles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productType, styles: savedStyles }),
        })
      } catch (err) {
        console.error('Failed to save style definitions:', err)
      }
    }

    setUploading(false)
    setUploadResults(uploadRes)
    setTimeout(() => setUploadResults(null), 5000)
  }

  const totalCrops = pages.reduce((sum, p) => sum + p.crops.length, 0)
  const namedCrops = pages.reduce((sum, p) => sum + p.crops.filter((c) => c.name).length, 0)

  return (
    <div className="wc-page">
      <div className="wc-catalog-info">
        <button className="wc-btn wc-btn--sm wc-btn--outline" onClick={() => navigate('/findsku')}>Back</button>
        <span className="wc-catalog-label">Catalog Processor</span>
        <button className="wc-btn wc-btn--sm wc-btn--outline" onClick={() => navigate('/admin/images')}>Image Admin</button>
      </div>

      <p className="wc-instructions">
        Upload a PDF catalog, select the product type. Use "Read Names" to OCR style names from pages, or go straight to manual crop.
        Draw rectangles around each product, pick the name from the dropdown, then save.
      </p>

      {/* Step 1: Product type + PDF upload */}
      <div className="wc-workspace">
        <div className="cp-controls">
          <div className="cp-control-row">
            <label className="wc-crop-editor-label">Product Type</label>
            <select
              className="wc-crop-editor-input"
              value={productType}
              onChange={(e) => { setProductType(e.target.value); setPages([]) }}
              style={{ width: 180 }}
            >
              {Object.entries(PRODUCT_TYPES).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>

          <div className="cp-control-row">
            <label className="wc-crop-editor-label">Category</label>
            <select
              className="wc-crop-editor-input"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              style={{ width: 220 }}
            >
              {categories.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            <button
              className="wc-btn wc-btn--sm wc-btn--outline"
              onClick={() => setShowCatEditor((p) => !p)}
              style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}
            >
              {showCatEditor ? 'Done' : 'Edit'}
            </button>
          </div>
          {showCatEditor && (
            <CategoryEditor
              productType={productType}
              categories={categories}
              onChange={(updated) => {
                setCategories(updated)
                if (!updated.some((c) => c.id === tier) && updated.length > 0) setTier(updated[0].id)
              }}
            />
          )}

          <div className="cp-control-row" style={{ marginTop: '1rem' }}>
            <label className="wc-crop-editor-label">PDF Catalog</label>
            <button className="wc-btn wc-btn--sm" onClick={() => inputRef.current?.click()}>
              {loading ? 'Loading...' : 'Upload PDF'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              hidden
              onChange={(e) => { handlePdfUpload(e.target.files[0]); e.target.value = '' }}
            />
            {pageImages.length > 0 && (
              <span className="wc-crop-count">{pageImages.length} pages loaded</span>
            )}
            {pdfError && (
              <span className="wc-crop-count" style={{ color: '#a33' }}>{pdfError}</span>
            )}
          </div>
        </div>

        {/* Page thumbnails */}
        {pageImages.length > 0 && (
          <div className="wc-pdf-page-grid" style={{ marginTop: '1rem' }}>
            {pageImages.map((pg, i) => (
              <button
                key={pg.pageNum}
                className={`wc-pdf-page-btn${pages.length > 0 && activePageIdx === i ? ' wc-pdf-page-btn--active' : ''}`}
                onClick={() => pages.length > 0 && setActivePageIdx(i)}
              >
                <img src={pg.thumb} alt={`Page ${pg.pageNum}`} className="wc-pdf-page-thumb" />
                <span className="wc-pdf-page-num">
                  {pg.pageNum}
                  {pages[i] && ` (${pages[i].crops.length})`}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Read Names / Manual buttons */}
        {pageImages.length > 0 && pages.length === 0 && (
          <div style={{ marginTop: '1rem', textAlign: 'center', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              className="wc-btn"
              onClick={handleReadNames}
              disabled={analyzing}
            >
              {analyzing ? 'Processing...' : `Read Names (AI) + Crop`}
            </button>
            <button
              className="wc-btn wc-btn--outline"
              onClick={handleSkipToManual}
              disabled={analyzing}
            >
              Manual Crop Only
            </button>
            <button
              className="wc-btn"
              onClick={handleExtractPnumbers}
              disabled={extractingPnumbers || analyzing}
              style={{ background: '#4c6335' }}
            >
              {extractingPnumbers ? 'Extracting...' : 'Extract P-Numbers (AI)'}
            </button>
          </div>
        )}
        {(analyzeProgress || pnumberProgress) && (
          <p className="wc-crop-count" style={{ marginTop: '0.5rem', textAlign: 'center' }}>{analyzeProgress || pnumberProgress}</p>
        )}
      </div>

      {/* P-Number extraction results */}
      {pnumberData && (
        <div className="wc-workspace" style={{ padding: '0.75rem 1rem' }}>
          <div className="pn-results-header">
            <span className="wc-catalog-label">
              Extracted P-Numbers
              <span className="pn-badge">{Object.keys(pnumberData).length}</span>
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                className="wc-btn"
                onClick={handleSavePnumbers}
                disabled={Object.keys(pnumberData).length === 0}
                style={{ background: '#4c6335' }}
              >
                Save P-Numbers
              </button>
              <button
                className="wc-btn wc-btn--outline wc-btn--sm"
                onClick={() => setPnumberData(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
          {pnumberSaveMsg && (
            <p className="wc-crop-count" style={{ marginTop: '0.5rem', color: pnumberSaveMsg.startsWith('Error') ? '#a33' : '#4c6335' }}>
              {pnumberSaveMsg}
            </p>
          )}
          <div className="pn-style-groups">
            {Object.entries(groupPnumbersByStyle(pnumberData)).map(([styleName, entries]) => {
              const count = Object.keys(entries).length
              const isExpanded = expandedPnStyles[styleName]
              return (
                <div key={styleName} className="pn-style-group">
                  <button
                    className="pn-style-toggle"
                    onClick={() => setExpandedPnStyles(prev => ({ ...prev, [styleName]: !prev[styleName] }))}
                  >
                    <span className="pn-style-arrow">{isExpanded ? '\u25BC' : '\u25B6'}</span>
                    <span className="pn-style-name">{styleName}</span>
                    <span className="pn-style-count">{count} entries</span>
                  </button>
                  {isExpanded && (
                    <table className="pn-table">
                      <thead>
                        <tr><th>Key</th><th>P-Number</th></tr>
                      </thead>
                      <tbody>
                        {Object.entries(entries).map(([key, val]) => (
                          <tr key={key}>
                            <td className="pn-key">{key.split('|').slice(1).join(' | ')}</td>
                            <td className="pn-val">{val}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Editable style names by category */}
      <div className="wc-workspace" style={{ padding: '0.75rem 1rem' }}>
        <button
          className="wedder-upload-toggle"
          onClick={() => setShowNames((p) => !p)}
        >
          {showNames ? 'Hide' : 'Show'} Style Names ({styleNames.length})
        </button>
        {showNames && (
          <div style={{ marginTop: '0.75rem' }}>
            {styleCategories.map((cat) => (
              <CategoryNames
                key={cat}
                category={cat}
                names={namesByCategory[cat]}
                baseNames={currentStyles.filter((s) => (s.category || 'Uncategorized') === cat).map((s) => s.name)}
                onAdd={(name) => {
                  setExtraNames((prev) => {
                    const copy = { ...prev }
                    if (!copy[cat]) copy[cat] = []
                    if (!copy[cat].includes(name) && !namesByCategory[cat]?.includes(name)) copy[cat] = [...copy[cat], name]
                    return copy
                  })
                }}
                onRemove={(name) => {
                  setExtraNames((prev) => {
                    const copy = { ...prev }
                    if (copy[cat]) copy[cat] = copy[cat].filter((n) => n !== name)
                    return copy
                  })
                }}
                onEdit={(oldName, newNameVal) => {
                  setExtraNames((prev) => {
                    const copy = { ...prev }
                    if (copy[cat]) copy[cat] = copy[cat].map((n) => n === oldName ? newNameVal : n)
                    return copy
                  })
                }}
              />
            ))}
            {/* Add new category */}
            <NewCategoryRow onAdd={(cat, name) => {
              setExtraNames((prev) => {
                const copy = { ...prev }
                if (!copy[cat]) copy[cat] = []
                if (!copy[cat].includes(name)) copy[cat] = [...copy[cat], name]
                return copy
              })
            }} existingCategories={styleCategories} />
          </div>
        )}
      </div>

      {/* Step 2: Crop all pages */}
      {pages.map((page, pi) => (
        <div key={page.pageNum} className="wc-workspace">
          <div className="wc-catalog-info">
            <span className="wc-catalog-label">Page {page.pageNum}</span>
            <span className="wc-catalog-desc">
              {page.crops.length} crops — Draw rectangle to add, click to edit, Shift+click to draw over existing
            </span>
          </div>

          <CropCanvas
            imageSrc={page.imageSrc}
            crops={page.crops}
            onCropsChange={(crops) => handleCropsChange(pi, crops)}
            styleNames={styleNames}
            namesByCategory={namesByCategory}
          />
        </div>
      ))}

      {/* Step 3: Preview + Save */}
      {totalCrops > 0 && (
        <div className="wc-preview-section">
          <div className="wc-preview-header">
            <span className="wc-preview-title">All Crops ({namedCrops}/{totalCrops} named)</span>
            <button
              className="wc-btn"
              onClick={handleSaveAll}
              disabled={uploading || namedCrops === 0}
            >
              {uploading ? 'Saving...' : `Save ${namedCrops} Crops`}
            </button>
          </div>

          {uploadResults && (
            <div className="wc-upload-results">
              {uploadResults.map((r, i) => (
                <span key={i} className={r.ok ? 'wc-upload-ok' : 'wc-upload-fail'}>
                  {r.ok ? '\u2713' : '\u2717'} {r.name}
                </span>
              ))}
            </div>
          )}

          <div className="wc-preview-grid">
            {pages.flatMap((p, pi) =>
              p.crops.map((crop, ci) => (
                <div
                  key={`${pi}-${ci}`}
                  className="wc-preview-item"
                  onClick={() => {}}
                  style={{ cursor: 'pointer' }}
                >
                  <CropPreview imageSrc={p.imageSrc} crop={crop} />
                  <span className="wc-preview-name">{crop.name || '(unnamed)'}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
