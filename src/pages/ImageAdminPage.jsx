import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { wedderStyles } from '../data/wedders'


function ImageAdminPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [serverImages, setServerImages] = useState([])
  const [loadingImages, setLoadingImages] = useState(true)
  const [customStyles, setCustomStyles] = useState({})
  const [msg, setMsg] = useState(null)
  const [pendingUploads, setPendingUploads] = useState({}) // { slug: { styleId, dataUrl } }
  const styleUploadRefs = useRef({})

  useEffect(() => {
    if (!isAdmin) navigate('/findsku', { replace: true })
  }, [isAdmin, navigate])

  useEffect(() => {
    fetch('/api/style-images')
      .then((r) => r.json())
      .then((data) => { setServerImages(data.images || []); setLoadingImages(false) })
      .catch(() => setLoadingImages(false))
    fetch('/api/custom-styles')
      .then((r) => r.json())
      .then((data) => setCustomStyles(data))
      .catch(() => {})
  }, [])

  if (!isAdmin) return null

  function showMsg(text) {
    setMsg(text)
    setTimeout(() => setMsg(null), 3000)
  }

  // Collect all known styles from wedders.js + custom-styles.json, grouped by source/category
  const allStyles = (() => {
    const styles = []
    const seen = new Set()
    for (const s of wedderStyles) {
      const slug = s.id.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
      const cat = s.category || s.tier || 'Wedders'
      if (!seen.has(slug)) { seen.add(slug); styles.push({ id: s.id, name: s.name, slug, source: 'wedders', category: cat }) }
    }
    for (const [type, arr] of Object.entries(customStyles)) {
      if (!Array.isArray(arr)) continue
      for (const s of arr) {
        const slug = s.id.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
        const cat = s.tier || type
        if (!seen.has(slug)) { seen.add(slug); styles.push({ id: s.id, name: s.name, slug, source: type, category: cat }) }
      }
    }
    return styles
  })()

  function handleFileSelect(styleId, file) {
    if (!file) return
    const slug = styleId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
    const reader = new FileReader()
    reader.onload = (e) => {
      setPendingUploads((prev) => ({ ...prev, [slug]: { styleId, dataUrl: e.target.result } }))
    }
    reader.readAsDataURL(file)
  }

  function cancelPending(slug) {
    setPendingUploads((prev) => { const next = { ...prev }; delete next[slug]; return next })
  }

  async function savePending(slug) {
    const pending = pendingUploads[slug]
    if (!pending) return
    try {
      const res = await fetch('/api/upload-style-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ styleId: pending.styleId, image: pending.dataUrl }),
      })
      const data = await res.json()
      if (res.ok) {
        const filename = `${slug}.png`
        setServerImages((prev) => {
          const filtered = prev.filter((img) => img.filename !== filename)
          return [...filtered, { filename, name: pending.styleId, url: data.url }]
        })
        cancelPending(slug)
        showMsg(`Saved image for ${pending.styleId}`)
      } else {
        showMsg(`Error: ${data.error}`)
      }
    } catch (err) {
      showMsg(`Error: ${err.message}`)
    }
  }

  async function assignToStyle(sourceFilename, targetStyleId) {
    try {
      const res = await fetch('/api/assign-style-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ styleId: targetStyleId, sourceFile: sourceFilename }),
      })
      const data = await res.json()
      if (res.ok) {
        const targetSlug = targetStyleId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
        const targetFilename = `${targetSlug}.png`
        setServerImages((prev) => {
          const filtered = prev.filter((img) => img.filename !== sourceFilename && img.filename !== targetFilename)
          return [...filtered, { filename: targetFilename, name: targetStyleId, url: data.url }]
        })
        showMsg(`Assigned to ${targetStyleId}`)
      } else {
        showMsg(`Error: ${data.error}`)
      }
    } catch (err) {
      showMsg(`Error: ${err.message}`)
    }
  }

  async function removeServerImage(filename) {
    const styleId = filename.replace('.png', '').replace(/-/g, ' ')
    try {
      await fetch('/api/delete-style-image', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ styleId }),
      })
      setServerImages((prev) => prev.filter((img) => img.filename !== filename))
      showMsg(`Removed ${filename}`)
    } catch (err) {
      showMsg(`Error: ${err.message}`)
    }
  }


  // Group images by category using allStyles lookup
  const imagesByCategory = (() => {
    const slugToCategory = {}
    for (const s of allStyles) {
      slugToCategory[s.slug] = s.category
    }
    const groups = {}
    for (const img of serverImages) {
      const slug = img.filename.replace('.png', '')
      const cat = slugToCategory[slug] || 'Uncategorized'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(img)
    }
    return groups
  })()
  const categoryOrder = Object.keys(imagesByCategory).sort()

  const serverFilenames = new Set(serverImages.map((img) => img.filename.replace('.png', '')))
  const missingStyles = allStyles.filter((s) => !serverFilenames.has(s.slug))

  // Group missing styles by category
  const missingByCategory = {}
  for (const s of missingStyles) {
    const cat = s.category || 'Uncategorized'
    if (!missingByCategory[cat]) missingByCategory[cat] = []
    missingByCategory[cat].push(s)
  }

  return (
    <div className="img-admin-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/findsku')}>SKU Finder</button>
        <h1>Image Admin</h1>
      </div>

      {msg && <div className="wedder-upload-msg" style={{ marginBottom: '1rem' }}>{msg}</div>}

      {/* Stats */}
      <div className="img-admin-section">
        <div className="img-admin-stats">
          <div className="img-admin-stat">
            <span className="img-admin-stat-value">{serverImages.length}</span>
            <span className="img-admin-stat-label">Server Images</span>
          </div>
          <div className="img-admin-stat">
            <span className="img-admin-stat-value">{allStyles.length}</span>
            <span className="img-admin-stat-label">Total Styles</span>
          </div>
          <div className="img-admin-stat">
            <span className="img-admin-stat-value">{missingStyles.length}</span>
            <span className="img-admin-stat-label">Missing Images</span>
          </div>
        </div>
      </div>

      {/* Server Style Images by Category */}
      {loadingImages ? (
        <div className="img-admin-section"><p className="img-admin-empty">Loading...</p></div>
      ) : serverImages.length === 0 ? (
        <div className="img-admin-section"><p className="img-admin-empty">No style images on server. Use Catalog Processor to crop and save images.</p></div>
      ) : (
        categoryOrder.map((cat) => (
          <div key={cat} className="img-admin-section">
            <div className="img-admin-section-title">
              {cat}
              <span className="img-admin-count">{imagesByCategory[cat].length} images</span>
            </div>
            <div className="img-admin-grid">
              {imagesByCategory[cat].map((img) => {
                const styleId = img.filename.replace('.png', '').replace(/-/g, ' ')
                const slug = img.filename.replace('.png', '')
                const pending = pendingUploads[slug]
                const isUncat = cat === 'Uncategorized'
                return (
                  <div key={img.filename} className="img-admin-item">
                    <img src={pending ? pending.dataUrl : `${img.url}?v=${Date.now()}`} alt={img.name} className="img-admin-thumb" />
                    <span className="img-admin-label">{img.name}</span>
                    {pending ? (
                      <div className="img-admin-pending-actions">
                        <button className="img-admin-save-btn" onClick={() => savePending(slug)}>Save</button>
                        <button className="img-admin-cancel-btn" onClick={() => cancelPending(slug)}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        {isUncat && (
                          <select
                            className="img-admin-assign-select"
                            defaultValue=""
                            onChange={(e) => { if (e.target.value) assignToStyle(img.filename, e.target.value); e.target.value = '' }}
                          >
                            <option value="" disabled>Assign to...</option>
                            {missingStyles.map((s) => (
                              <option key={s.slug} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        )}
                        <div className="img-admin-item-actions">
                          <button
                            className="img-admin-replace"
                            onClick={() => styleUploadRefs.current[img.filename]?.click()}
                            title="Replace image"
                          >
                            &#8635;
                          </button>
                          <input
                            ref={(el) => { styleUploadRefs.current[img.filename] = el }}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => { handleFileSelect(styleId, e.target.files[0]); e.target.value = '' }}
                          />
                          <button
                            className="img-admin-remove"
                            onClick={() => removeServerImage(img.filename)}
                            title="Remove"
                          >
                            &times;
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      {/* Styles Missing Images by Category */}
      {Object.keys(missingByCategory).sort().map((cat) => (
        <div key={`missing-${cat}`} className="img-admin-section">
          <div className="img-admin-section-title">
            {cat} — Missing Images
            <span className="img-admin-count">{missingByCategory[cat].length} styles</span>
          </div>
          <div className="img-admin-grid">
            {missingByCategory[cat].map((style) => {
              const pending = pendingUploads[style.slug]
              return (
                <div key={style.slug} className={`img-admin-item ${pending ? '' : 'img-admin-item--missing'}`}>
                  {pending ? (
                    <img src={pending.dataUrl} alt={style.name} className="img-admin-thumb" />
                  ) : (
                    <div className="img-admin-thumb img-admin-thumb--placeholder">?</div>
                  )}
                  <span className="img-admin-label">{style.name}</span>
                  {pending ? (
                    <div className="img-admin-pending-actions">
                      <button className="img-admin-save-btn" onClick={() => savePending(style.slug)}>Save</button>
                      <button className="img-admin-cancel-btn" onClick={() => cancelPending(style.slug)}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <button
                        className="img-admin-upload-btn"
                        onClick={() => styleUploadRefs.current[style.slug]?.click()}
                      >
                        Upload
                      </button>
                      <input
                        ref={(el) => { styleUploadRefs.current[style.slug] = el }}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => { handleFileSelect(style.id, e.target.files[0]); e.target.value = '' }}
                      />
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default ImageAdminPage
