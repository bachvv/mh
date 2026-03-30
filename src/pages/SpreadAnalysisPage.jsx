import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const T = {
  bg: '#f0f7e8',
  card: '#ffffff',
  accent: '#4c6335',
  accentLight: '#e8f2d8',
  header: '#4c6335',
  text: '#2d3a1e',
  textMuted: '#6b7d5a',
  border: '#d4e4c0',
  inputBg: '#fafdf5',
  danger: '#b54040',
}

const sty = {
  page: { maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem 3rem', background: T.bg, minHeight: '100vh' },
  pageHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' },
  backBtn: { background: 'none', border: `1px solid ${T.border}`, color: T.accent, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  h1: { fontSize: 24, fontWeight: 700, color: T.header, margin: 0 },
  card: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: T.accent, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 },
  uploadArea: { border: `2px dashed ${T.border}`, borderRadius: 10, padding: 30, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', background: T.inputBg },
  uploadAreaActive: { borderColor: T.accent, background: T.accentLight },
  previewImg: { maxWidth: '100%', maxHeight: 250, borderRadius: 8, border: `1px solid ${T.border}`, marginTop: 12 },
  btnSecondary: { padding: '6px 14px', background: T.card, border: `1px solid ${T.border}`, color: T.textMuted, borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  dangerBtn: { background: 'none', border: 'none', color: T.danger, cursor: 'pointer', fontSize: 16, padding: '2px 6px', flexShrink: 0 },
  fileItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: T.inputBg, borderRadius: 6, marginBottom: 6, border: `1px solid ${T.border}` },
}

function isImage(name) { return /\.(png|jpg|jpeg|gif|webp|heic|heif|bmp)$/i.test(name) }

function fileLabel(name) {
  // Strip timestamp prefix
  return name.replace(/^\d+_/, '')
}

function UploadSection({ label, description, type, files, onUpload, onDelete, hint, month, servePrefix }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const res = await fetch('/api/spread/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileBase64: reader.result, fileName: file.name, type, month: type === 'pnl' ? month : undefined }),
        })
        const data = await res.json()
        if (data.ok) onUpload()
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={sty.card}>
      <div style={sty.sectionTitle}>{label}</div>
      <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 12 }}>{description}</p>
      {hint && <p style={{ fontSize: 12, color: T.accent, marginBottom: 12, fontStyle: 'italic' }}>{hint}</p>}

      <div
        style={{ ...sty.uploadArea, ...(dragging ? sty.uploadAreaActive : {}) }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
      >
        <input
          ref={inputRef} type="file" accept="image/*,.pdf,.xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = '' }}
        />
        {uploading ? (
          <div style={{ color: T.accent, fontWeight: 600 }}>Uploading...</div>
        ) : (
          <div>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 6 }}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div style={{ fontWeight: 600, color: T.text, fontSize: 14 }}>Click or drag to upload</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Images, PDF, Excel, CSV</div>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Saved Files ({files.length})
          </div>
          {files.map(f => {
            const serveUrl = servePrefix ? `${servePrefix}/${f}` : `/api/spread/serve/${type}/${f}`
            return (
              <div key={f} style={sty.fileItem}>
                {isImage(f) && (
                  <img src={serveUrl} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: `1px solid ${T.border}` }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileLabel(f)}</div>
                </div>
                {isImage(f) && (
                  <a href={serveUrl} target="_blank" rel="noreferrer" style={{ ...sty.btnSecondary, textDecoration: 'none', fontSize: 11, padding: '4px 8px' }}>View</a>
                )}
                <button style={sty.dangerBtn} title="Delete" onClick={() => onDelete(f)}>&times;</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const SECTION_COLORS = {
  'P&L Review': '#5a6e45',
  'Staff Structure': '#4c6335',
  'Minimums Planner': '#3d5229',
  'Quarterly Minimums Summary': '#5a6e45',
  'Store Manager Quarterly': '#4c6335',
  'Individual Quarterly Summary': '#3d5229',
  'Store Weekly Performance': '#5a6e45',
  'Coaching Logs': '#4c6335',
  'Action Plans': '#3d5229',
  'Summary': '#2d3a1e',
}

function inlineMd(str) {
  return str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code style="background:#edf5e0;padding:1px 4px;border-radius:3px;font-size:12px;">$1</code>')
}

function renderMarkdown(text) {
  const lines = text.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Table detection: line with | chars, next line is separator
    if (line.includes('|') && i + 1 < lines.length && /^[\s|:-]+$/.test(lines[i + 1])) {
      const headers = line.split('|').map(c => c.trim()).filter(Boolean)
      i += 2 // skip header + separator
      const rows = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(lines[i].split('|').map(c => c.trim()).filter(Boolean))
        i++
      }
      elements.push(
        <div key={`tbl-${i}`} style={{ overflowX: 'auto', margin: '12px 0' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <thead>
              <tr>
                {headers.map((h, hi) => (
                  <th key={hi} style={{ background: T.accent, color: '#fff', padding: '8px 12px', border: `1px solid ${T.border}`, textAlign: 'left', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}
                    dangerouslySetInnerHTML={{ __html: inlineMd(h) }} />
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? '#fafdf5' : '#fff' }}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{ padding: '6px 12px', border: `1px solid ${T.border}`, fontSize: 12, color: T.text }}
                      dangerouslySetInnerHTML={{ __html: inlineMd(cell) }} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    // Section heading (## ) — render as flowchart-style box
    if (/^#{1,2}\s/.test(line)) {
      const title = line.replace(/^#{1,2}\s/, '')
      const matchKey = Object.keys(SECTION_COLORS).find(k => title.toLowerCase().includes(k.toLowerCase()))
      const bg = matchKey ? SECTION_COLORS[matchKey] : T.accent
      elements.push(
        <div key={i} style={{
          display: 'flex', gap: 0, margin: '24px 0 12px', borderRadius: 8, overflow: 'hidden',
          border: `1px solid ${T.border}`, boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
        }}>
          <div style={{
            background: bg, color: '#fff', padding: '12px 18px', fontWeight: 700, fontSize: 14,
            minWidth: 200, display: 'flex', alignItems: 'center', letterSpacing: '0.02em',
          }}>
            {title}
          </div>
        </div>
      )
      i++
      continue
    }

    // ### sub-heading
    if (/^#{3}\s/.test(line)) {
      elements.push(
        <div key={i} style={{ fontSize: 14, fontWeight: 700, color: T.accent, margin: '16px 0 6px', borderBottom: `1px dashed ${T.border}`, paddingBottom: 4 }}>
          {line.replace(/^#{3}\s/, '')}
        </div>
      )
      i++
      continue
    }

    // Bullet
    if (/^\s*[-*]\s/.test(line)) {
      const indent = line.match(/^(\s*)/)[1].length
      const content = line.replace(/^\s*[-*]\s/, '')
      elements.push(
        <li key={i} style={{ fontSize: 13, color: T.text, lineHeight: 1.6, marginLeft: 16 + indent * 8, listStyleType: indent > 0 ? 'circle' : 'disc' }}
          dangerouslySetInnerHTML={{ __html: inlineMd(content) }} />
      )
      i++
      continue
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      elements.push(
        <li key={i} style={{ fontSize: 13, color: T.text, lineHeight: 1.6, marginLeft: 16, listStyleType: 'decimal' }}
          dangerouslySetInnerHTML={{ __html: inlineMd(line.replace(/^\d+\.\s/, '')) }} />
      )
      i++
      continue
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: 6 }} />)
      i++
      continue
    }

    // Regular paragraph
    elements.push(
      <p key={i} style={{ fontSize: 13, color: T.text, lineHeight: 1.6, margin: '4px 0' }}
        dangerouslySetInnerHTML={{ __html: inlineMd(line) }} />
    )
    i++
  }

  return elements
}

const ANALYSIS_STEPS = [
  { key: 'pnl', label: 'P&L Review', pattern: /P&L Review|P&L/i },
  { key: 'staff', label: 'Staff Structure', pattern: /Staff Structure/i },
  { key: 'mins', label: 'Minimums Planner', pattern: /Minimums Planner/i },
  { key: 'qmin', label: 'Quarterly Minimums Summary', pattern: /Quarterly Minimums Summary/i },
  { key: 'smqmin', label: 'Store Manager Quarterly', pattern: /Store Manager/i },
  { key: 'indiv', label: 'Individual Quarterly Summary', pattern: /Individual Quarterly/i },
  { key: 'weekly', label: 'Store Weekly Performance', pattern: /Store Weekly|Weekly Performance/i },
  { key: 'coaching', label: 'Coaching Logs', pattern: /Coaching Log/i },
  { key: 'action', label: 'Action Plans', pattern: /Action Plan/i },
  { key: 'summary', label: 'Summary', pattern: /SUMMARY|Top 3/i },
]

function detectCurrentStep(text) {
  let lastMatch = -1
  for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
    if (ANALYSIS_STEPS[i].pattern.test(text)) lastMatch = i
  }
  return lastMatch
}

const ROLE_OPTIONS = [
  { value: 'SM', label: 'SM — Store Manager' },
  { value: 'ASM', label: 'ASM — Assistant Store Manager' },
  { value: 'FT SP', label: 'FT SP — Full-Time Sales Professional' },
  { value: 'PT SP', label: 'PT SP — Part-Time Sales Professional' },
  { value: 'OA', label: 'OA — Office Administrator' },
]

function currentMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function SpreadAnalysisPage() {
  const navigate = useNavigate()
  const [pnlFiles, setPnlFiles] = useState([])
  const [flowFiles, setFlowFiles] = useState([])
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState(null)
  const [currentStep, setCurrentStep] = useState(-1)
  const resultRef = useRef(null)
  const [staffNames, setStaffNames] = useState(null) // null = not extracted, [] = extracted
  const [staffRoles, setStaffRoles] = useState({}) // { "Bach Vu": "FT SP", ... }
  const [extracting, setExtracting] = useState(false)
  const [showRoles, setShowRoles] = useState(false)
  const [months, setMonths] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr())
  const [notes, setNotes] = useState('')

  const loadMonths = async () => {
    const data = await fetch('/api/spread/months').then(r => r.json()).catch(() => [])
    setMonths(data)
    // If current month has no entry and there are months with data, keep current month selected (for new uploads)
  }

  const loadFiles = async () => {
    const [pnl, flow] = await Promise.all([
      fetch(`/api/spread/files/pnl?month=${selectedMonth}`).then(r => r.json()).catch(() => []),
      fetch('/api/spread/files/flow').then(r => r.json()).catch(() => []),
    ])
    setPnlFiles(pnl)
    setFlowFiles(flow)
  }

  const loadSavedRoles = async () => {
    const saved = await fetch(`/api/spread/staff-roles?month=${selectedMonth}`).then(r => r.json()).catch(() => ({}))
    if (Object.keys(saved).length > 0) setStaffRoles(saved)
  }

  useEffect(() => { loadMonths() }, [])
  useEffect(() => { loadFiles(); loadSavedRoles(); setAnalysis(null); setStaffNames(null); setShowRoles(false); setCurrentStep(-1) }, [selectedMonth])

  const deleteFile = async (type, fileName) => {
    const qs = type === 'pnl' ? `?month=${selectedMonth}` : ''
    await fetch(`/api/spread/files/${type}/${fileName}${qs}`, { method: 'DELETE' })
    loadFiles()
    loadMonths()
  }

  const extractStaff = async () => {
    setExtracting(true)
    setError(null)
    try {
      const resp = await fetch('/api/spread/extract-staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month: selectedMonth }) })
      const data = await resp.json()
      if (data.error) throw new Error(data.error)
      setStaffNames(data.staff || [])
      // Pre-fill from saved roles, fallback to current state, then FT SP
      const saved = await fetch(`/api/spread/staff-roles?month=${selectedMonth}`).then(r => r.json()).catch(() => ({}))
      const roles = {}
      for (const name of data.staff) {
        roles[name] = saved[name] || staffRoles[name] || 'FT SP'
      }
      setStaffRoles(roles)
      setShowRoles(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setExtracting(false)
    }
  }

  const generateAnalysis = async () => {
    // Save staff roles for this month
    fetch('/api/spread/staff-roles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month: selectedMonth, roles: staffRoles }) }).catch(() => {})
    setAnalyzing(true)
    setError(null)
    setAnalysis(null)
    setCurrentStep(0)
    setShowRoles(false)
    let fullText = ''

    try {
      const resp = await fetch('/api/spread/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffRoles, month: selectedMonth, notes }),
      })

      if (!resp.ok) {
        const data = await resp.json()
        throw new Error(data.error || 'Analysis failed')
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6)
          try {
            const msg = JSON.parse(jsonStr)
            if (msg.error) throw new Error(msg.error)
            if (msg.done) break
            if (msg.text) {
              fullText += msg.text
              setAnalysis(fullText)
              const step = detectCurrentStep(fullText)
              if (step >= 0) setCurrentStep(step)
            }
          } catch (e) {
            if (e.message && !e.message.includes('JSON')) throw e
          }
        }
      }

      setAnalysis(fullText)
      setCurrentStep(ANALYSIS_STEPS.length)
    } catch (err) {
      setError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  const canAnalyze = pnlFiles.length > 0 && flowFiles.length > 0
  const progressPct = analyzing
    ? Math.max(5, Math.round((currentStep / ANALYSIS_STEPS.length) * 100))
    : (currentStep >= ANALYSIS_STEPS.length ? 100 : 0)

  return (
    <div style={sty.page}>
      <div style={sty.pageHeader}>
        <button style={sty.backBtn} onClick={() => navigate('/')}>← Home</button>
        <h1 style={sty.h1}>Spread Analysis</h1>
      </div>

      {/* Month Selector */}
      <div style={{ ...sty.card, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: T.accent }}>Month:</div>
        <input
          type="month"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          style={{
            padding: '8px 14px', borderRadius: 6, border: `1px solid ${T.border}`,
            fontSize: 14, color: T.text, background: T.inputBg, fontWeight: 600,
          }}
        />
        {months.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {months.map(m => (
              <button
                key={m.month}
                onClick={() => setSelectedMonth(m.month === 'unassigned' ? '' : m.month)}
                style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: (m.month === 'unassigned' ? !selectedMonth : selectedMonth === m.month)
                    ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
                  background: (m.month === 'unassigned' ? !selectedMonth : selectedMonth === m.month)
                    ? T.accentLight : '#fff',
                  color: (m.month === 'unassigned' ? !selectedMonth : selectedMonth === m.month)
                    ? T.accent : T.textMuted,
                  transition: 'all 0.15s',
                }}
              >
                {m.label} ({m.count})
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
        <UploadSection
          label="P&L Report"
          description="Upload the P&L report screenshot or file for this period."
          type="pnl"
          files={pnlFiles}
          onUpload={() => { loadFiles(); loadMonths() }}
          onDelete={f => deleteFile('pnl', f)}
          month={selectedMonth}
          servePrefix={selectedMonth ? `/api/spread/serve/pnl/${selectedMonth}` : '/api/spread/serve/pnl'}
        />
        <UploadSection
          label="Analysis Flow"
          description="Upload the analysis flow template. Saved flows are reused for future reports."
          hint="Saved flows persist across reports"
          type="flow"
          files={flowFiles}
          onUpload={loadFiles}
          onDelete={f => deleteFile('flow', f)}
        />
      </div>

      {/* Step 1: Extract & Categorize Staff */}
      {!showRoles && !analyzing && !analysis && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button
            style={{
              padding: '12px 28px', background: canAnalyze && !extracting ? T.accent : '#aaa',
              color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700,
              cursor: canAnalyze && !extracting ? 'pointer' : 'not-allowed', letterSpacing: '0.04em',
              transition: 'all 0.2s',
            }}
            onClick={extractStaff}
            disabled={!canAnalyze || extracting}
          >
            {extracting ? 'Extracting Staff...' : 'Step 1: Categorize Staff'}
          </button>
          {!canAnalyze && (
            <span style={{ fontSize: 13, color: T.textMuted }}>
              Upload P&L report{pnlFiles.length === 0 ? '' : ' ✓'} and flow template{flowFiles.length === 0 ? '' : ' ✓'}
            </span>
          )}
          {canAnalyze && !extracting && (
            <span style={{ fontSize: 13, color: T.textMuted }}>
              Identify staff from reports, then assign roles before analysis
            </span>
          )}
        </div>
      )}

      {/* Staff Role Assignment */}
      {showRoles && staffNames && staffNames.length > 0 && (
        <div style={{ ...sty.card, marginBottom: 20 }}>
          <div style={sty.sectionTitle}>Assign Staff Roles</div>
          <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 16 }}>
            Categorize each team member before running the full analysis.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {staffNames.map(name => (
              <div key={name} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px',
                background: T.inputBg, borderRadius: 8, border: `1px solid ${T.border}`,
              }}>
                <div style={{ flex: 1, fontWeight: 600, fontSize: 14, color: T.text, minWidth: 140 }}>{name}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ROLE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setStaffRoles(prev => ({ ...prev, [name]: opt.value }))}
                      style={{
                        padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: staffRoles[name] === opt.value ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
                        background: staffRoles[name] === opt.value ? T.accentLight : '#fff',
                        color: staffRoles[name] === opt.value ? T.accent : T.textMuted,
                        transition: 'all 0.15s',
                      }}
                    >
                      {opt.value}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Additional Notes</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add any extra context or requests for the analysis (e.g. focus on specific areas, recent events, staffing changes...)"
              style={{
                width: '100%', minHeight: 70, padding: '10px 14px', borderRadius: 8, border: `1px solid ${T.border}`,
                background: T.inputBg, color: T.text, fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 16, alignItems: 'center' }}>
            <button
              style={{
                padding: '12px 28px', background: T.accent,
                color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700,
                cursor: 'pointer', letterSpacing: '0.04em',
              }}
              onClick={generateAnalysis}
            >
              Step 2: Generate Analysis
            </button>
            <button
              style={{ ...sty.btnSecondary, padding: '8px 16px' }}
              onClick={() => { setShowRoles(false); setStaffNames(null) }}
            >
              Back
            </button>
            <span style={{ fontSize: 12, color: T.textMuted }}>
              {Object.values(staffRoles).filter(Boolean).length}/{staffNames.length} assigned
            </span>
          </div>
        </div>
      )}

      {/* Generate button when returning to re-run */}
      {!showRoles && !analyzing && analysis && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button
            style={{
              padding: '12px 28px', background: T.accent,
              color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700,
              cursor: 'pointer', letterSpacing: '0.04em',
            }}
            onClick={() => { setAnalysis(null); setCurrentStep(-1); extractStaff() }}
          >
            Re-run Analysis
          </button>
        </div>
      )}

      {/* Progress Bar */}
      {(analyzing || (currentStep >= ANALYSIS_STEPS.length && analysis)) && (
        <div style={{ ...sty.card, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={sty.sectionTitle}>
              {analyzing ? 'Analyzing...' : 'Analysis Complete'}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.accent }}>{progressPct}%</span>
          </div>

          {/* Progress bar */}
          <div style={{ width: '100%', height: 8, background: '#e8f0dc', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{
              width: `${progressPct}%`, height: '100%', background: T.accent,
              borderRadius: 4, transition: 'width 0.5s ease',
            }} />
          </div>

          {/* Steps */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
            {ANALYSIS_STEPS.map((step, i) => {
              const isDone = i < currentStep || currentStep >= ANALYSIS_STEPS.length
              const isActive = analyzing && i === currentStep
              return (
                <div key={step.key} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                  borderRadius: 6, fontSize: 12, fontWeight: isActive ? 700 : 500,
                  background: isActive ? T.accentLight : isDone ? '#f0f7e8' : '#f5f5f5',
                  color: isActive ? T.accent : isDone ? '#2d6a4f' : '#999',
                  border: isActive ? `1.5px solid ${T.accent}` : '1px solid transparent',
                  transition: 'all 0.3s',
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>
                    {isDone ? '⚫' : isActive ? '►' : '○'}
                  </span>
                  {step.label}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ ...sty.card, background: '#fef2f2', borderColor: '#fca5a5' }}>
          <div style={{ color: T.danger, fontWeight: 600, fontSize: 14 }}>Analysis Error</div>
          <div style={{ color: T.danger, fontSize: 13, marginTop: 4 }}>{error}</div>
        </div>
      )}

      {/* Analysis Results (streams in live) */}
      {analysis && (
        <div>
          {!analyzing && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <button style={{
                padding: '8px 18px', background: T.accent, color: '#fff', border: 'none',
                borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }} onClick={() => navigator.clipboard.writeText(analysis).catch(() => {})}>
                Copy Text
              </button>
              <button style={{
                padding: '8px 18px', background: T.accent, color: '#fff', border: 'none',
                borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }} onClick={() => {
                if (!resultRef.current) return
                const blob = new Blob([resultRef.current.innerHTML], { type: 'text/html' })
                const textBlob = new Blob([analysis], { type: 'text/plain' })
                navigator.clipboard.write([new ClipboardItem({ 'text/html': blob, 'text/plain': textBlob })]).catch(() => {
                  navigator.clipboard.writeText(analysis)
                })
              }}>
                Copy for Word/Excel
              </button>
              <button style={{
                padding: '8px 18px', background: T.accent, color: '#fff', border: 'none',
                borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }} onClick={() => {
                if (!resultRef.current) return
                const w = window.open('', '_blank')
                w.document.write(`<!DOCTYPE html><html><head><title>Spread Analysis — Metrotown</title>
                  <style>
                    body { font-family: Arial, sans-serif; padding: 2rem; max-width: 1000px; margin: 0 auto; color: #2d3a1e; }
                    h2 { background: #4c6335; color: #fff; padding: 10px 16px; border-radius: 6px; font-size: 15px; margin: 24px 0 12px; }
                    h3 { color: #4c6335; font-size: 14px; border-bottom: 1px dashed #d4e4c0; padding-bottom: 4px; margin: 16px 0 8px; }
                    table { border-collapse: collapse; width: 100%; font-size: 12px; margin: 12px 0; }
                    th { background: #4c6335; color: #fff; padding: 8px 12px; border: 1px solid #d4e4c0; text-align: left; font-size: 12px; }
                    td { padding: 6px 12px; border: 1px solid #d4e4c0; font-size: 12px; }
                    tr:nth-child(even) { background: #fafdf5; }
                    li { font-size: 13px; line-height: 1.6; }
                    p { font-size: 13px; line-height: 1.6; }
                    strong { color: #2d3a1e; }
                    @media print { body { padding: 0.5rem; } h2 { break-after: avoid; } }
                  </style>
                </head><body>
                  <h1 style="text-align:center;background:#4c6335;color:#fff;padding:14px;border-radius:8px;font-size:20px;">
                    METROTOWN — Spread Analysis Report
                  </h1>
                  ${resultRef.current.innerHTML}
                </body></html>`)
                w.document.close()
                w.print()
              }}>
                Print
              </button>
            </div>
          )}

          <div style={sty.card} ref={resultRef}>
            <div>{renderMarkdown(analysis)}</div>
          </div>
        </div>
      )}
    </div>
  )
}
