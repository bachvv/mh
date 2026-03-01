import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

function FindByPhotoPage() {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [results, setResults] = useState(null)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')

  const processFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      const src = e.target.result
      setPreview(src)
      setLoading(true)
      setResults(null)
      setDescription('')
      setError('')

      try {
        const resp = await fetch('/api/find-by-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: src,
            category: 'all',
          }),
        })

        if (!resp.ok) {
          const err = await resp.json()
          throw new Error(err.error || 'Server error')
        }

        const data = await resp.json()
        setDescription(data.description || '')
        setResults(data.matches || [])
      } catch (err) {
        setError(err.message)
        setResults([])
      } finally {
        setLoading(false)
      }
    }
    reader.readAsDataURL(file)
  }, [])

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  return (
    <div className="fbp-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/findsku')}>SKU Finder</button>
        <h1>Find by Photo</h1>
      </div>

      <div className="fbp-upload-card">
        <div
          className={`fbp-dropzone${dragOver ? ' fbp-dropzone--active' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => { if (e.target.files[0]) processFile(e.target.files[0]); e.target.value = '' }}
          />
          {preview ? (
            <img src={preview} alt="Uploaded" className="fbp-preview-img" />
          ) : (
            <>
              <div className="fbp-dropzone-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
              <span className="fbp-dropzone-text">Drop a photo here or tap to upload</span>
              <span className="fbp-dropzone-hint">AI-powered visual matching</span>
            </>
          )}
        </div>
        {preview && (
          <button
            className="fbp-clear-btn"
            onClick={() => { setPreview(null); setResults(null); setDescription(''); setError('') }}
          >
            Clear
          </button>
        )}
      </div>

      {loading && (
        <div className="fbp-loading">Analyzing with AI... this may take a moment</div>
      )}

      {error && !loading && (
        <div className="fbp-empty">{error}</div>
      )}

      {description && !loading && (
        <div className="fbp-description">{description}</div>
      )}

      {results && results.length === 0 && !loading && !error && (
        <div className="fbp-empty">No matches found in this category.</div>
      )}

      {results && results.length > 0 && !loading && (
        <div className="fbp-results">
          <div className="wedder-step-label">Best Matches</div>
          <div className="fbp-results-grid">
            {results.map((m, i) => (
              <div key={m.sku + '-' + i} className="fbp-result-card">
                <div className="fbp-result-img-wrap">
                  {m.image && <img src={m.image} alt={m.name} className="fbp-result-img" />}
                </div>
                <div className="fbp-result-info">
                  <span className="fbp-result-name">{m.name}</span>
                  <span className="fbp-result-score">{m.confidence}% match</span>
                  <span className="fbp-result-skus">SKU: {m.sku}</span>
                  {m.reason && <span className="fbp-result-reason">{m.reason}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default FindByPhotoPage
