import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

/* -- KPI row definitions matching the template -- */

const KPI_ROWS = [
  { key: 'sales', label: '1. Sales result for the store vs budget vs LY (Gold, Black, Red), $', format: 'sales' },
  { key: 'goldstar_pct', label: '2. Goldstar Percentage in store', format: 'num1' },
  { key: 'gp_pct', label: '3. GP% % vs %LY', format: 'num2' },
  { key: 'avg_sale', label: '4. Avg Sale vs LY vs LW', format: 'int' },
  { key: 'ips', label: '5. IPS vs LY vs LW', format: 'num2' },
  { key: 'tph', label: '6. TPH vs LY vs LW', format: 'num2' },
  { key: 'sph', label: '7. SPH vs LY vs LW', format: 'int' },
  { key: 'pcp_pct', label: '8. PCP vs LY, %', format: 'int' },
  { key: 'credit_sales', label: '9. Credit Sales vs LY', format: 'int' },
  { key: 'credit_avg_sale', label: '10. Credit Average Sale vs LY', format: 'int' },
  { key: 'brilliance', label: '11. Brilliance - WTD Loyalty Sign Ups, WTD Loyalty Sales', format: 'brilliance' },
  { key: 'above_mins_pct', label: '12. Above Mins % - LW', format: 'int' },
  { key: 'below_mins_pct', label: '13. Below Mins % - LW', format: 'int' },
]

function formatVal(kpis, key, format) {
  if (!kpis) return ''
  if (format === 'sales') {
    const actual = kpis.sales_actual
    const budget = kpis.sales_budget
    const star = kpis.sales_star || ''
    if (actual == null && budget == null) return ''
    const parts = []
    if (actual != null) parts.push(Math.round(actual).toLocaleString())
    if (budget != null) parts.push(Math.round(budget).toLocaleString())
    let val = parts.join('/')
    if (star) val += '\n' + star
    return val
  }
  if (format === 'brilliance') {
    const s = kpis.brilliance_signups
    const l = kpis.brilliance_sales
    if (s == null && l == null) return ''
    return `${s ?? '-'}/${l ?? '-'}`
  }
  const val = kpis[key]
  if (val == null) return ''
  if (format === 'int') return Math.round(val).toLocaleString()
  if (format === 'num1') return val.toFixed(1)
  if (format === 'num2') return val.toFixed(2)
  return val
}

/* -- Build merged KPIs from source reports -- */

function buildReportKpis(images) {
  const done = images.filter(img => img.status === 'done')
  // Separate TY (2026) and LY (2025) by year
  const thisYear = new Date().getFullYear()
  const ty = done.filter(img => img.year >= thisYear)
  const ly = done.filter(img => img.year < thisYear)

  function extract(group) {
    const kpis = {}
    for (const img of group) {
      const d = img.kpis || {}
      if (img.reportType === 'wps') {
        if (d.nett_sales != null) kpis.sales_actual = d.nett_sales
        if (d.avg_sale != null) kpis.avg_sale = d.avg_sale
        if (d.ips != null) kpis.ips = d.ips
        if (d.tph != null) kpis.tph = d.tph
        if (d.sph != null) kpis.sph = d.sph
        if (d.pcp_attach_rate != null) kpis.pcp_pct = d.pcp_attach_rate
        if (d.credit_sales_count != null) kpis.credit_sales = d.credit_sales_count
        if (d.credit_sales_avg != null) kpis.credit_avg_sale = d.credit_sales_avg
        if (d.above_min_sell_pct != null) kpis.above_mins_pct = d.above_min_sell_pct
        if (d.below_min_sell_pct != null) kpis.below_mins_pct = d.below_min_sell_pct
      }
      if (img.reportType === 'min') {
        if (d.nett_sales != null) kpis.sales_actual = d.nett_sales
        if (d.gold_star_target != null) kpis.sales_budget = d.gold_star_target
        if (d.pct_of_target != null) kpis.goldstar_pct = d.pct_of_target
        // Determine star level
        if (d.nett_sales != null && d.gold_star_target != null) {
          if (d.nett_sales >= (d.stretch_platinum_target || Infinity)) kpis.sales_star = 'Platinum Star'
          else if (d.nett_sales >= d.gold_star_target) kpis.sales_star = 'Gold Star'
          else if (d.nett_sales >= (d.black_dot_target || 0)) kpis.sales_star = 'Black Dot'
          else kpis.sales_star = 'Red Dot'
        }
      }
      if (img.reportType === 'onyx') {
        if (d.net_sales != null) kpis.sales_actual = d.net_sales
        if (d.gs_gp_pct != null) kpis.gp_pct = d.gs_gp_pct
        if (d.ips != null) kpis.ips = d.ips
        if (d.pcp_pct != null) kpis.pcp_pct = d.pcp_pct
      }
    }
    return Object.keys(kpis).length ? kpis : null
  }

  return { ty: extract(ty), ly: extract(ly) }
}

/* -- Sales Impact Analysis & Coaching -- */

// Net Sales = TPH × Hours × ASV
// ASV = IPS × Avg Price Per Item
// So: Net Sales = TPH × Hours × IPS × AvgItemPrice

function buildSalesAnalysis(ty) {
  if (!ty) return null
  const { tph, ips, avg_sale, sales_actual, sph } = ty
  if (tph == null || ips == null || avg_sale == null || sales_actual == null) return null

  // Derive paid hours from SPH or TPH
  const hours = sph != null && sph > 0 ? sales_actual / sph : (tph > 0 ? sales_actual / (tph * avg_sale) : null)
  if (!hours || hours <= 0) return null

  const transactions = tph * hours
  const avgItemPrice = ips > 0 ? avg_sale / ips : 0

  // Calculate impact of +10% improvement in each lever
  const improvements = [
    {
      key: 'tph',
      label: 'TPH (Transactions Per Hour)',
      current: tph,
      improved: +(tph * 1.1).toFixed(2),
      format: (v) => v.toFixed(2),
      newSales: Math.round((tph * 1.1) * hours * avg_sale),
      extraSales: Math.round((tph * 1.1) * hours * avg_sale - sales_actual),
      focus: 'How to CONVERT MORE',
      suggestions: [
        'Opening — genuine greeting within 30 seconds, non-business opening line to build rapport',
        'Probing — ask at least 4 of the 6 Essential Probing Questions (Who, What, When, Where, Why, How much)',
        'Use clear, confident closing lines — don\'t wait for the customer to volunteer to buy',
        'Control the sale — SP should be leading the interaction, not following the customer',
        'Rotation system — approach new clients regularly, don\'t cluster at the counter',
        'Reduce operations focus — less tidying/admin during peak, more actively engaging on the floor',
      ],
    },
    {
      key: 'ips',
      label: 'IPS (Items Per Sale)',
      current: ips,
      improved: +(ips * 1.1).toFixed(2),
      format: (v) => v.toFixed(2),
      // More items per sale → higher ASV (same avg item price)
      newSales: Math.round(transactions * (ips * 1.1) * avgItemPrice),
      extraSales: Math.round(transactions * (ips * 1.1) * avgItemPrice - sales_actual),
      focus: 'How to ADD ON',
      suggestions: [
        'Advanced/emotional probing — let the customer share their full story, not just the immediate need',
        'WORM method for add-ons — Wardrobe, Occasions, Reward & Matching',
        'Suggest complementary items naturally: "This pairs beautifully with..."',
        'Use the 3-piece outfit rule — always show a matching piece (earrings with pendant, band with ring)',
        'Before wrapping up: "Is there anything else on your wish list today?"',
      ],
    },
    {
      key: 'asv',
      label: 'ASV (Average Sale Value)',
      current: avg_sale,
      improved: Math.round(avg_sale * 1.1),
      format: (v) => '$' + Math.round(v).toLocaleString(),
      newSales: Math.round(transactions * avg_sale * 1.1),
      extraSales: Math.round(transactions * avg_sale * 1.1 - sales_actual),
      focus: 'How to UPSELL',
      suggestions: [
        'Demonstrate higher priced items first — lead with value, not price; show F&Bs before revealing cost',
        'Introduce payment plans early (Flexiti, MHC), then recap when price objections arise',
        'Build emotional value — "This is a piece you\'ll have forever"',
        'Use the "step up" technique — show the item they asked for, then one level up: "Have you also considered..."',
        'F&Bs matched back to probing answers, not generic product facts',
      ],
    },
  ]

  // Sort by biggest dollar impact
  improvements.sort((a, b) => b.extraSales - a.extraSales)

  return { sales_actual, hours: Math.round(hours), transactions: Math.round(transactions), avgItemPrice: Math.round(avgItemPrice), improvements }
}

/* -- Component -- */

function ManagersReportPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [images, setImages] = useState([])
  const [report, setReport] = useState(null)
  const [storeName, setStoreName] = useState('METROTOWN')
  const [weekEnding, setWeekEnding] = useState(() => new Date().toISOString().slice(0, 10))
  const [copied, setCopied] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [savedImages, setSavedImages] = useState([])
  const [showSaved, setShowSaved] = useState(false)
  const [saveNotice, setSaveNotice] = useState(null)
  const reportRef = useRef(null)
  const fileInputRef = useRef(null)
  const templateInputRef = useRef(null)
  const [templateUploaded, setTemplateUploaded] = useState(false)

  useEffect(() => {
    if (!isAdmin) navigate('/', { replace: true })
  }, [isAdmin, navigate])

  useEffect(() => {
    loadSavedImages()
  }, [])

  async function loadSavedImages() {
    try {
      const resp = await fetch('/api/saved-report-images')
      const data = await resp.json()
      setSavedImages(data) // [{fileName, cached, type?, year?, kpis?}, ...]
    } catch {}
  }

  async function deleteSavedImage(fileName) {
    await fetch(`/api/saved-report-images/${encodeURIComponent(fileName)}`, { method: 'DELETE' })
    loadSavedImages()
  }

  if (!isAdmin) return null

  async function uploadTemplate(file) {
    const reader = new FileReader()
    reader.onload = async () => {
      await fetch('/api/upload-template', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: reader.result, fileName: file.name }),
      })
      setTemplateUploaded(true)
      setTimeout(() => setTemplateUploaded(false), 3000)
    }
    reader.readAsDataURL(file)
  }

  async function resizeImage(file, maxDim = 2000) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        let { width, height } = img
        if (width <= maxDim && height <= maxDim) {
          const c = document.createElement('canvas')
          c.width = width; c.height = height
          c.getContext('2d').drawImage(img, 0, 0)
          resolve(c.toDataURL('image/png'))
          return
        }
        const ratio = Math.min(maxDim / width, maxDim / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
        const c = document.createElement('canvas')
        c.width = width; c.height = height
        c.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve(c.toDataURL('image/png'))
      }
      img.src = url
    })
  }

  async function saveImageToServer(base64, fileName) {
    try {
      const resp = await fetch('/api/save-report-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, fileName }),
      })
      const data = await resp.json()
      if (data.ok) {
        setSaveNotice(`Saved: ${fileName}`)
        setTimeout(() => setSaveNotice(null), 3000)
        loadSavedImages()
        return data.fileName // return server filename for caching
      }
    } catch (err) {
      console.error('Save image failed:', err)
    }
    return null
  }

  async function processImage(file, id) {
    setImages(prev => prev.map(img => img.id === id ? { ...img, status: 'processing' } : img))
    try {
      const base64 = await resizeImage(file)
      const saveResult = await saveImageToServer(base64, file.name)

      const resp = await fetch('/api/ocr-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 }),
      })
      const data = await resp.json()
      if (data.error) throw new Error(data.error)
      setImages(prev => prev.map(img => img.id === id ? {
        ...img, status: 'done', year: data.year,
        dateRange: data.dateRange, reportType: data.type,
        kpis: data.kpis,
      } : img))
    } catch (err) {
      console.error('OCR failed:', err)
      setImages(prev => prev.map(img => img.id === id ? { ...img, status: 'error', error: err.message } : img))
    }
  }

  async function processSavedImage(savedItem) {
    const fileName = typeof savedItem === 'string' ? savedItem : savedItem.fileName
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const displayName = fileName.replace(/^\d+_/, '')
    setImages(prev => [...prev, { id, fileName: displayName, status: 'processing' }])
    try {
      const ocrResp = await fetch('/api/ocr-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName }),
      })
      const data = await ocrResp.json()
      if (data.error) throw new Error(data.error)
      setImages(prev => prev.map(img => img.id === id ? {
        ...img, status: 'done', year: data.year,
        dateRange: data.dateRange, reportType: data.type,
        kpis: data.kpis,
      } : img))
    } catch (err) {
      console.error('processSavedImage failed:', fileName, err)
      setImages(prev => prev.map(img => img.id === id ? { ...img, status: 'error', error: err.message } : img))
    }
  }

  async function processAllSaved() {
    setReport(null)
    for (const item of savedImages) {
      await processSavedImage(item)
    }
  }

  function handleFiles(fileList) {
    const newFiles = Array.from(fileList).filter(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))
    if (!newFiles.length) return
    setReport(null)
    const newImages = newFiles.map(f => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fileName: f.name, status: 'pending',
    }))
    setImages(prev => [...prev, ...newImages])
    newFiles.forEach((f, i) => processImage(f, newImages[i].id))
  }

  function removeImage(id) {
    setImages(prev => prev.filter(img => img.id !== id))
    setReport(null)
  }

  function clearAll() {
    setImages([])
    setReport(null)
  }

  function generateReport() {
    const { ty, ly } = buildReportKpis(images)
    setReport({ storeName, weekEnding, ty, ly })
  }

  function copyToClipboard() {
    if (!report) return
    const pad = (s, w) => s.toString().padStart(w)
    const padL = (s, w) => s.toString().padEnd(w)

    let txt = `${report.storeName} TRADE REPORT\n`
    txt += `Week Ending: ${new Date(report.weekEnding + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\n\n`
    txt += padL('', 55) + pad('This Year/Week', 18) + pad('Last Year/Week', 18) + '\n'
    txt += '-'.repeat(91) + '\n'

    for (const row of KPI_ROWS) {
      const tyVal = formatVal(report.ty, row.key, row.format)
      const lyVal = formatVal(report.ly, row.key, row.format)
      const tyLine = tyVal.split('\n')[0] || ''
      const lyLine = lyVal.split('\n')[0] || ''
      txt += padL(row.label, 55) + pad(tyLine, 18) + pad(lyLine, 18) + '\n'
      if (row.format === 'sales') {
        const tyStar = tyVal.split('\n')[1] || ''
        const lyStar = lyVal.split('\n')[1] || ''
        if (tyStar || lyStar) {
          txt += padL('', 55) + pad(tyStar, 18) + pad(lyStar, 18) + '\n'
        }
      }
    }

    navigator.clipboard.writeText(txt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function printReport() {
    if (!reportRef.current) return
    const w = window.open('', '_blank')
    w.document.write(`<!DOCTYPE html><html><head><title>${storeName} Trade Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 1.5rem; }
        h2 { margin: 0 0 0.25rem; text-align: center; background: #006666; color: #fff; padding: 12px; }
        p { margin: 0 0 1rem; color: #666; }
        table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
        th, td { border: 1px solid #ccc; padding: 6px 10px; }
        th { background: #006666; color: #fff; text-align: center; }
        td:first-child { text-align: left; }
        td:not(:first-child) { text-align: center; }
        .star { font-size: 0.75rem; color: #666; }
        @media print { body { padding: 0; } }
      </style>
    </head><body>${reportRef.current.innerHTML}</body></html>`)
    w.document.close()
    w.print()
  }

  const TYPE_LABELS = { wps: 'WPS', min: 'MIN', onyx: 'Onyx' }
  const TYPE_COLORS = { wps: '#3b82f6', min: '#f59e0b', onyx: '#ec4899' }

  return (
    <div className="managers-report-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/')}>← Home</button>
        <h1>Managers Report</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {savedImages.length > 0 && (
            <button
              onClick={() => setShowSaved(!showSaved)}
              style={{ background: 'none', border: '1px solid #444', color: '#aaa', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
            >
              Saved Images ({savedImages.length})
            </button>
          )}
          <button
            onClick={() => templateInputRef.current?.click()}
            style={{ background: 'none', border: '1px solid #444', color: '#aaa', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
          >
            {templateUploaded ? '✓ Template Uploaded' : 'Upload Template'}
          </button>
          <input
            ref={templateInputRef}
            type="file"
            accept="image/*"
            onChange={e => { if (e.target.files[0]) uploadTemplate(e.target.files[0]); e.target.value = '' }}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Save notification */}
      {saveNotice && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 1000,
          background: '#166534', color: '#fff', padding: '10px 20px',
          borderRadius: 8, fontSize: 14, fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {saveNotice}
        </div>
      )}

      {/* Saved images panel */}
      {showSaved && savedImages.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Saved Report Images</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={processAllSaved} style={{ background: '#006666', border: 'none', color: '#fff', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                Process All ({savedImages.length})
              </button>
              <button onClick={async () => {
                await fetch('/api/saved-report-images', { method: 'DELETE' })
                setSavedImages([])
              }} style={{ background: 'none', border: '1px solid #333', color: '#888', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>
                Clear All Saved
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {savedImages.map(item => (
              <div key={item.fileName} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                background: '#1a1a2e', borderRadius: 6, border: '1px solid #333',
              }}>
                <div style={{ flex: 1, cursor: 'pointer', minWidth: 0 }} onClick={() => processSavedImage(item)}>
                  <div style={{ fontSize: 12, color: '#ccc', wordBreak: 'break-all' }}>
                    {item.fileName.replace(/^\d+_/, '')}
                  </div>
                  {item.cached && (
                    <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                      <span style={{
                        padding: '1px 5px', borderRadius: 3, marginRight: 4,
                        background: '#4ade8022', color: '#4ade80', fontWeight: 600,
                      }}>cached</span>
                      {item.type && <span style={{
                        padding: '1px 5px', borderRadius: 3, marginRight: 4,
                        background: `${TYPE_COLORS[item.type] || '#666'}22`,
                        color: TYPE_COLORS[item.type] || '#888', fontWeight: 600,
                      }}>{TYPE_LABELS[item.type] || item.type}</span>}
                      {item.dateRange && <span>{item.dateRange} </span>}
                      {item.year && <span>({item.year})</span>}
                    </div>
                  )}
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteSavedImage(item.fileName) }} style={{
                  background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, padding: '0 4px', flexShrink: 0,
                }}>&times;</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Store info */}
      <div className="mr-config card">
        <div className="mr-config-row">
          <label className="mr-field">
            <span>Store Name</span>
            <input
              type="text"
              value={storeName}
              onChange={e => setStoreName(e.target.value.toUpperCase())}
              className="mr-input"
              placeholder="e.g. METROTOWN"
            />
          </label>
          <label className="mr-field">
            <span>Week Ending</span>
            <input
              type="date"
              value={weekEnding}
              onChange={e => setWeekEnding(e.target.value)}
              className="mr-input"
            />
          </label>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`card${dragging ? ' mr-drop-active' : ''}`}
        style={{
          marginBottom: 20, padding: 30, textAlign: 'center',
          border: `2px dashed ${dragging ? '#f59e0b' : '#333'}`,
          background: dragging ? 'rgba(245,158,11,0.05)' : 'transparent',
          cursor: 'pointer', transition: 'all 0.2s',
        }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
        <div style={{ fontSize: 14, color: '#888', marginBottom: 4 }}>
          Drop report screenshots here or tap to select
        </div>
        <div style={{ fontSize: 11, color: '#555' }}>
          WPS, MIN Planner, or Onyx — this year &amp; last year. Images are auto-saved.
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/jpg,image/heic,image/heif,.png,.jpg,.jpeg,.heic,.heif"
          onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
          style={{ display: 'none' }}
        />
      </div>

      {/* Uploaded images list */}
      {images.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>{images.length} Image{images.length !== 1 ? 's' : ''}</h3>
            <button onClick={clearAll} style={{ background: 'none', border: '1px solid #333', color: '#888', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>Clear All</button>
          </div>
          {images.map(img => (
            <div key={img.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
              background: img.status === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
              borderRadius: 8, marginBottom: 6, borderLeft: `3px solid ${
                img.status === 'processing' ? '#f59e0b' : img.status === 'error' ? '#ef4444' : img.status === 'done' ? '#4ade80' : '#555'
              }`,
            }}>
              <span style={{ fontSize: 14 }}>
                {img.status === 'processing' ? '⏳' : img.status === 'error' ? '❌' : img.status === 'done' ? '✅' : '⏸️'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#ccc', wordBreak: 'break-all' }}>
                  {img.fileName}
                </div>
                {img.status === 'done' && (
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                    {img.reportType && (
                      <span style={{
                        display: 'inline-block', padding: '1px 6px', borderRadius: 4, marginRight: 6,
                        background: `${TYPE_COLORS[img.reportType] || '#666'}22`,
                        color: TYPE_COLORS[img.reportType] || '#888',
                        fontWeight: 600, fontSize: 10,
                      }}>{TYPE_LABELS[img.reportType] || img.reportType}</span>
                    )}
                    {img.dateRange && <span>{img.dateRange} </span>}
                    {img.year && <span>({img.year})</span>}
                    {img.kpis && <span> — {Object.keys(img.kpis).length} fields</span>}
                  </div>
                )}
                {img.status === 'error' && (
                  <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{img.error || 'Failed to process'}</div>
                )}
              </div>
              <button onClick={() => removeImage(img.id)} style={{
                background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, padding: '0 4px',
              }}>&times;</button>
            </div>
          ))}
        </div>
      )}

      {/* Generate */}
      {(() => {
        const doneCount = images.filter(i => i.status === 'done').length
        const processingCount = images.filter(i => i.status === 'processing').length
        return (
          <div className="mr-actions">
            <button
              className="mr-generate-btn"
              onClick={generateReport}
              disabled={doneCount === 0 || processingCount > 0}
            >
              {processingCount > 0 ? `Processing ${processingCount} image${processingCount !== 1 ? 's' : ''}...` : 'Generate Managers Report'}
            </button>
            {doneCount > 0 && processingCount === 0 && (
              <span className="mr-hint">{doneCount} report{doneCount !== 1 ? 's' : ''} ready</span>
            )}
            {images.length === 0 && (
              <span className="mr-hint">Upload WPS, MIN, or Onyx screenshots</span>
            )}
          </div>
        )
      })()}

      {/* Report output */}
      {report && (
        <div className="mr-report-section">
          <div className="mr-report-toolbar">
            <button className="mr-tool-btn" onClick={copyToClipboard}>
              {copied ? '✓ Copied' : 'Copy as Text'}
            </button>
            <button className="mr-tool-btn" onClick={printReport}>Print</button>
          </div>

          <div className="mr-report card" ref={reportRef}>
            <h2 style={{ textAlign: 'center', background: '#006666', color: '#fff', margin: '-20px -20px 16px', padding: '14px 20px', borderRadius: '8px 8px 0 0' }}>
              {report.storeName} TRADE REPORT
            </h2>
            <p style={{ fontWeight: 700, marginBottom: 16 }}>Results for the week</p>
            <p style={{ color: '#888', marginBottom: 20 }}>
              Week Ending: {new Date(report.weekEnding + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>

            <div className="mr-table-wrap">
              <table className="mr-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', width: '55%' }}></th>
                    <th>This Year / Week</th>
                    <th>Last Year / Week</th>
                  </tr>
                </thead>
                <tbody>
                  {KPI_ROWS.map(row => {
                    const tyVal = formatVal(report.ty, row.key, row.format)
                    const lyVal = formatVal(report.ly, row.key, row.format)
                    const tyLines = tyVal.split('\n')
                    const lyLines = lyVal.split('\n')
                    return (
                      <tr key={row.key}>
                        <td style={{ textAlign: 'left', fontSize: 13 }}>{row.label}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div>{tyLines[0]}</div>
                          {tyLines[1] && <div style={{ fontSize: 11, color: '#888' }}>{tyLines[1]}</div>}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div>{lyLines[0]}</div>
                          {lyLines[1] && <div style={{ fontSize: 11, color: '#888' }}>{lyLines[1]}</div>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sales Impact Analysis & Coaching */}
          {(() => {
            const analysis = buildSalesAnalysis(report.ty)
            if (!analysis) return null
            const best = analysis.improvements[0]
            return (
              <div className="card" style={{ marginTop: 20 }}>
                <h3 style={{ marginBottom: 6 }}>Sales Lever Analysis</h3>
                <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
                  Current weekly sales: <strong style={{ color: '#ccc' }}>${analysis.sales_actual.toLocaleString()}</strong> from {analysis.transactions} transactions over {analysis.hours} paid hours
                </p>
                <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
                  If each SP improves by 10%, which lever drives the most sales?
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {analysis.improvements.map((imp, i) => {
                    const isBest = i === 0
                    return (
                      <div key={imp.key} style={{
                        padding: '12px 16px', borderRadius: 8,
                        background: isBest ? 'rgba(74,222,128,0.08)' : '#1a1a2e',
                        border: isBest ? '1px solid rgba(74,222,128,0.3)' : '1px solid #333',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: isBest ? '#4ade80' : '#ccc' }}>
                            {isBest && '★ '}{imp.label}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 16, color: isBest ? '#4ade80' : '#f59e0b' }}>
                            +${imp.extraSales.toLocaleString()}/wk
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: '#888' }}>
                          {imp.format(imp.current)} → {imp.format(imp.improved)} = ${imp.newSales.toLocaleString()}/wk
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ padding: 14, background: '#1a1a2e', borderRadius: 8, borderLeft: '3px solid #4ade80' }}>
                  <div style={{ fontWeight: 700, marginBottom: 2, color: '#4ade80', fontSize: 14 }}>
                    Top Priority: {best.label} — {best.focus}
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                    +10% {best.label.split(' (')[0]} = +${best.extraSales.toLocaleString()} weekly sales — biggest lever for SPs right now
                  </div>
                  <p style={{ fontSize: 12, color: '#999', margin: '0 0 8px', fontStyle: 'italic' }}>
                    MH Observation behaviours to focus on:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#ccc', lineHeight: 1.7 }}>
                    {best.suggestions.map((tip, j) => <li key={j}>{tip}</li>)}
                  </ul>
                </div>

                {analysis.improvements.length > 1 && analysis.improvements.slice(1).map((imp, i) => (
                  <div key={imp.key} style={{ padding: 14, background: '#1a1a2e', borderRadius: 8, borderLeft: '3px solid #f59e0b', marginTop: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 2, color: '#f59e0b', fontSize: 14 }}>
                      Also Focus: {imp.label} — {imp.focus}
                    </div>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                      +10% = +${imp.extraSales.toLocaleString()} weekly sales
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#ccc', lineHeight: 1.7 }}>
                      {imp.suggestions.map((tip, j) => <li key={j}>{tip}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

export default ManagersReportPage
