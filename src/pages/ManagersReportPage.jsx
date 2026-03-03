import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

/* ── CSV helpers ────────────────────────────────────── */

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }
  const delim = lines[0].includes('\t') ? '\t' : ','
  const headers = splitRow(lines[0], delim)
  const rows = lines.slice(1).map(l => {
    const vals = splitRow(l, delim)
    const row = {}
    headers.forEach((h, i) => { row[h] = vals[i] || '' })
    return row
  })
  return { headers, rows }
}

function splitRow(line, delim) {
  const vals = []
  let cur = '', inQ = false
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue }
    if (ch === delim && !inQ) { vals.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  vals.push(cur.trim())
  return vals
}

function num(str) {
  if (!str) return 0
  const c = str.replace(/[$,%\s]/g, '').replace(/\(([^)]+)\)/, '-$1').replace(/,/g, '')
  const n = parseFloat(c)
  return isNaN(n) ? 0 : n
}

function fmtD(n) { return '$' + Math.round(n).toLocaleString() }
function fmtP(n) { return n.toFixed(1) + '%' }
function pctVar(tw, lw) { return lw === 0 ? 0 : ((tw - lw) / Math.abs(lw)) * 100 }

/* ── Column auto-detection ─────────────────────────── */

const COL_PATTERNS = {
  category: ['category', 'department', 'dept', 'class', 'group', 'merchandise'],
  revenue: ['revenue', 'rev', 'sales', 'net sales', 'net rev', 'total sales'],
  units: ['units', 'qty', 'quantity', 'pcs', 'pieces'],
  gp: ['gp$', 'gp $', 'gross profit', 'gp dollars', 'gp dol', 'margin$', 'margin $'],
  gpPct: ['gp%', 'gp %', 'margin%', 'margin %', 'gross margin', 'gp pct'],
  trans: ['trans', 'transactions', 'ticket', 'tickets'],
}

function detectColumn(headers, type) {
  const patterns = COL_PATTERNS[type]
  const lower = headers.map(h => h.toLowerCase().trim())
  // exact substring match
  for (let i = 0; i < lower.length; i++) {
    for (const p of patterns) {
      if (lower[i] === p || lower[i].includes(p)) return headers[i]
    }
  }
  // For category, fallback to first non-numeric column
  if (type === 'category') return headers[0]
  return null
}

function extractData(parsed) {
  if (!parsed) return []
  const { headers, rows } = parsed
  const catCol = detectColumn(headers, 'category')
  const revCol = detectColumn(headers, 'revenue')
  const unitsCol = detectColumn(headers, 'units')
  const gpCol = detectColumn(headers, 'gp')
  const gpPctCol = detectColumn(headers, 'gpPct')
  const transCol = detectColumn(headers, 'trans')

  return rows
    .filter(r => r[catCol] && r[catCol].trim())
    .map(r => ({
      category: r[catCol].trim().toUpperCase(),
      revenue: revCol ? num(r[revCol]) : 0,
      units: unitsCol ? num(r[unitsCol]) : 0,
      gp: gpCol ? num(r[gpCol]) : 0,
      gpPct: gpPctCol ? num(r[gpPctCol]) : 0,
      trans: transCol ? num(r[transCol]) : 0,
    }))
}

/* ── Trade report categories (Michael Hill standard) ── */

const MH_CATEGORIES = [
  'DIAMONDS', 'COLOURED GEMSTONE', 'WATCHES', 'GOLD',
  'SILVER', 'PEARL', 'BRANDED', 'OTHER',
]

/* ── Component ─────────────────────────────────────── */

const REPORT_LABELS = ['This Week Report', 'Last Week Report', 'Budget Report']
const REPORT_DESCS = [
  'Current week sales by department',
  'Previous week sales by department',
  'Budget targets by department',
]

function ManagersReportPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [files, setFiles] = useState([null, null, null])
  const [parsed, setParsed] = useState([null, null, null])
  const [report, setReport] = useState(null)
  const [storeName, setStoreName] = useState('METROTOWN')
  const [weekEnding, setWeekEnding] = useState(() => {
    const d = new Date()
    return d.toISOString().slice(0, 10)
  })
  const [copied, setCopied] = useState(false)
  const reportRef = useRef(null)

  useEffect(() => {
    if (!isAdmin) navigate('/', { replace: true })
  }, [isAdmin, navigate])

  if (!isAdmin) return null

  function handleFile(index, file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      const p = parseCSV(text)
      const newParsed = [...parsed]
      newParsed[index] = p
      setParsed(newParsed)
      const newFiles = [...files]
      newFiles[index] = file.name
      setFiles(newFiles)
      setReport(null)
    }
    reader.readAsText(file)
  }

  function generateReport() {
    const twData = extractData(parsed[0])
    const lwData = extractData(parsed[1])
    const budData = extractData(parsed[2])

    // Build a merged set of all categories found
    const catSet = new Set()
    ;[twData, lwData, budData].forEach(arr => arr.forEach(r => catSet.add(r.category)))

    // Order: known MH categories first, then any extras
    const orderedCats = []
    for (const c of MH_CATEGORIES) {
      if (catSet.has(c)) { orderedCats.push(c); catSet.delete(c) }
    }
    for (const c of catSet) orderedCats.push(c)

    const lookup = (data, cat) => data.find(r => r.category === cat) || { revenue: 0, units: 0, gp: 0, gpPct: 0, trans: 0 }

    const rows = orderedCats.map(cat => {
      const tw = lookup(twData, cat)
      const lw = lookup(lwData, cat)
      const bud = lookup(budData, cat)
      const atvTW = tw.trans > 0 ? tw.revenue / tw.trans : (tw.units > 0 ? tw.revenue / tw.units : 0)
      const atvLW = lw.trans > 0 ? lw.revenue / lw.trans : (lw.units > 0 ? lw.revenue / lw.units : 0)
      return {
        category: cat,
        revTW: tw.revenue,
        revLW: lw.revenue,
        revVar: pctVar(tw.revenue, lw.revenue),
        revBud: bud.revenue,
        revBudVar: bud.revenue === 0 ? 0 : ((tw.revenue - bud.revenue) / Math.abs(bud.revenue)) * 100,
        unitsTW: tw.units,
        unitsLW: lw.units,
        unitsVar: pctVar(tw.units, lw.units),
        atvTW,
        atvLW,
        gpTW: tw.gp,
        gpLW: lw.gp,
        gpPctTW: tw.revenue > 0 ? (tw.gp / tw.revenue) * 100 : tw.gpPct,
        gpPctLW: lw.revenue > 0 ? (lw.gp / lw.revenue) * 100 : lw.gpPct,
      }
    })

    // Totals
    const totals = {
      category: 'TOTAL',
      revTW: rows.reduce((s, r) => s + r.revTW, 0),
      revLW: rows.reduce((s, r) => s + r.revLW, 0),
      revBud: rows.reduce((s, r) => s + r.revBud, 0),
      unitsTW: rows.reduce((s, r) => s + r.unitsTW, 0),
      unitsLW: rows.reduce((s, r) => s + r.unitsLW, 0),
      gpTW: rows.reduce((s, r) => s + r.gpTW, 0),
      gpLW: rows.reduce((s, r) => s + r.gpLW, 0),
    }
    totals.revVar = pctVar(totals.revTW, totals.revLW)
    totals.revBudVar = totals.revBud === 0 ? 0 : ((totals.revTW - totals.revBud) / Math.abs(totals.revBud)) * 100
    totals.unitsVar = pctVar(totals.unitsTW, totals.unitsLW)
    totals.atvTW = totals.unitsTW > 0 ? totals.revTW / totals.unitsTW : 0
    totals.atvLW = totals.unitsLW > 0 ? totals.revLW / totals.unitsLW : 0
    totals.gpPctTW = totals.revTW > 0 ? (totals.gpTW / totals.revTW) * 100 : 0
    totals.gpPctLW = totals.revLW > 0 ? (totals.gpLW / totals.revLW) * 100 : 0

    setReport({ rows, totals, storeName, weekEnding })
  }

  function copyToClipboard() {
    if (!report) return
    const { rows, totals } = report
    const allRows = [...rows, totals]
    const pad = (s, w) => s.toString().padStart(w)
    const padL = (s, w) => s.toString().padEnd(w)

    let txt = `${report.storeName} TRADE REPORT\n`
    txt += `Week Ending: ${new Date(report.weekEnding + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\n\n`

    const hdr = padL('CATEGORY', 20) + pad('REV TW', 12) + pad('REV LW', 12) + pad('VAR%', 8)
      + pad('BUDGET', 12) + pad('%BUD', 8) + pad('UN TW', 8) + pad('UN LW', 8)
      + pad('ATV TW', 10) + pad('GP$ TW', 12) + pad('GP% TW', 8)
    txt += hdr + '\n'
    txt += '─'.repeat(hdr.length) + '\n'

    for (const r of allRows) {
      if (r.category === 'TOTAL') txt += '─'.repeat(hdr.length) + '\n'
      txt += padL(r.category, 20)
        + pad(fmtD(r.revTW), 12) + pad(fmtD(r.revLW), 12) + pad(fmtP(r.revVar), 8)
        + pad(fmtD(r.revBud), 12) + pad(fmtP(r.revBudVar), 8)
        + pad(Math.round(r.unitsTW), 8) + pad(Math.round(r.unitsLW), 8)
        + pad(fmtD(r.atvTW), 10) + pad(fmtD(r.gpTW), 12) + pad(fmtP(r.gpPctTW), 8)
        + '\n'
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
        h2 { margin: 0 0 0.25rem; }
        p { margin: 0 0 1rem; color: #666; }
        table { border-collapse: collapse; width: 100%; font-size: 0.8rem; }
        th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: right; }
        th { background: #222; color: #fff; }
        td:first-child, th:first-child { text-align: left; }
        tr:last-child td { font-weight: bold; border-top: 2px solid #222; }
        .pos { color: #2e7d32; } .neg { color: #c62828; }
        @media print { body { padding: 0; } }
      </style>
    </head><body>${reportRef.current.innerHTML}</body></html>`)
    w.document.close()
    w.print()
  }

  const allUploaded = parsed.every(Boolean)

  function varClass(val) { return val > 0 ? 'mr-pos' : val < 0 ? 'mr-neg' : '' }

  return (
    <div className="managers-report-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/')}>← Home</button>
        <h1>Managers Report</h1>
      </div>

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

      {/* File uploads */}
      <div className="mr-uploads">
        {REPORT_LABELS.map((label, i) => (
          <div key={i} className={`mr-upload-card card${parsed[i] ? ' mr-upload-card--done' : ''}`}>
            <div className="mr-upload-header">
              <h3>{label}</h3>
              <p>{REPORT_DESCS[i]}</p>
            </div>
            <label className="mr-file-label">
              <span className="mr-file-btn">{files[i] ? 'Change File' : 'Choose CSV File'}</span>
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={e => handleFile(i, e.target.files[0])}
                className="mr-file-input"
              />
            </label>
            {parsed[i] && (
              <div className="mr-upload-info">
                <span className="mr-check">✓</span>
                <span>{files[i]} — {parsed[i].rows.length} rows, {parsed[i].headers.length} columns</span>
              </div>
            )}
            {parsed[i] && (
              <details className="mr-preview-details">
                <summary>Preview columns</summary>
                <div className="mr-col-list">
                  {parsed[i].headers.map(h => <span key={h} className="mr-col-tag">{h}</span>)}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>

      {/* Generate */}
      <div className="mr-actions">
        <button
          className="mr-generate-btn"
          onClick={generateReport}
          disabled={!allUploaded}
        >
          Generate Trade Report
        </button>
        {!allUploaded && (
          <span className="mr-hint">Upload all 3 reports to generate</span>
        )}
      </div>

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
            <h2>{report.storeName} TRADE REPORT</h2>
            <p>Week Ending: {new Date(report.weekEnding + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>

            <div className="mr-table-wrap">
              <table className="mr-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Rev TW</th>
                    <th>Rev LW</th>
                    <th>% Var</th>
                    <th>Budget</th>
                    <th>% Bud</th>
                    <th>Units TW</th>
                    <th>Units LW</th>
                    <th>% Var</th>
                    <th>ATV TW</th>
                    <th>GP$ TW</th>
                    <th>GP% TW</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map(r => (
                    <tr key={r.category}>
                      <td className="mr-cat">{r.category}</td>
                      <td>{fmtD(r.revTW)}</td>
                      <td>{fmtD(r.revLW)}</td>
                      <td className={varClass(r.revVar)}>{fmtP(r.revVar)}</td>
                      <td>{fmtD(r.revBud)}</td>
                      <td className={varClass(r.revBudVar)}>{fmtP(r.revBudVar)}</td>
                      <td>{Math.round(r.unitsTW)}</td>
                      <td>{Math.round(r.unitsLW)}</td>
                      <td className={varClass(r.unitsVar)}>{fmtP(r.unitsVar)}</td>
                      <td>{fmtD(r.atvTW)}</td>
                      <td>{fmtD(r.gpTW)}</td>
                      <td>{fmtP(r.gpPctTW)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="mr-cat"><strong>TOTAL</strong></td>
                    <td><strong>{fmtD(report.totals.revTW)}</strong></td>
                    <td><strong>{fmtD(report.totals.revLW)}</strong></td>
                    <td className={varClass(report.totals.revVar)}><strong>{fmtP(report.totals.revVar)}</strong></td>
                    <td><strong>{fmtD(report.totals.revBud)}</strong></td>
                    <td className={varClass(report.totals.revBudVar)}><strong>{fmtP(report.totals.revBudVar)}</strong></td>
                    <td><strong>{Math.round(report.totals.unitsTW)}</strong></td>
                    <td><strong>{Math.round(report.totals.unitsLW)}</strong></td>
                    <td className={varClass(report.totals.unitsVar)}><strong>{fmtP(report.totals.unitsVar)}</strong></td>
                    <td><strong>{fmtD(report.totals.atvTW)}</strong></td>
                    <td><strong>{fmtD(report.totals.gpTW)}</strong></td>
                    <td><strong>{fmtP(report.totals.gpPctTW)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ManagersReportPage
