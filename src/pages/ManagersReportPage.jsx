import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

/* -- KPI row definitions matching the template -- */

const KPI_ROWS = [
  { key: 'sales', label: '1. Sales result for the store vs budget vs LY (⭐ Gold Star, ⚫ Black Dot, 🔴 Red Dot), $', format: 'sales' },
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
        if (d.gold_star_count != null && d.staff_count != null && d.staff_count > 0) {
          kpis.goldstar_pct = (d.gold_star_count / d.staff_count) * 100
        }
        // Determine star level
        if (d.nett_sales != null && d.gold_star_target != null) {
          if (d.nett_sales >= (d.stretch_platinum_target || Infinity)) kpis.sales_star = 'Platinum'
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

/* -- Per-person coaching from WPS staff data -- */

const FOCUS_MAP = {
  tph: { focus: 'TPH — Convert More', suggestions: [
    'Opening — genuine greeting within 30 seconds, non-business opening line to build rapport',
    'Probing — ask at least 4 of the 6 Essential Probing Questions (Who, What, When, Where, Why, How much)',
    'Use clear, confident closing lines — don\'t wait for the customer to volunteer to buy',
    'Control the sale — lead the interaction, don\'t follow the customer',
    'Rotation system — approach new clients regularly, don\'t cluster at the counter',
  ]},
  ips: { focus: 'IPS — Add On', suggestions: [
    'Advanced/emotional probing — let the customer share their full story, not just the immediate need',
    'WORM method for add-ons — Wardrobe, Occasions, Reward & Matching',
    'Suggest complementary items naturally: "This pairs beautifully with..."',
    'Use the 3-piece outfit rule — always show a matching piece (earrings with pendant, band with ring)',
    'Before wrapping up: "Is there anything else on your wish list today?"',
  ]},
  avg_sale: { focus: 'ASV — Upsell', suggestions: [
    'Demonstrate higher priced items first — lead with value, not price; show F&Bs before revealing cost',
    'Introduce payment plans early (Flexiti, MHC), then recap when price objections arise',
    'Build emotional value — "This is a piece you\'ll have forever"',
    'Use the "step up" technique — show the item they asked for, then one level up',
    'F&Bs matched back to probing answers, not generic product facts',
  ]},
  credit_sales_count: { focus: 'Credit — Sales & Avg', suggestions: [
    'Mention payment plans at the probing stage, not just at closing',
    'Know the monthly payment amounts for key price points so you can quote confidently',
    'Position credit as unlocking a better piece: "For just $X more per month, you could have..."',
  ]},
  gs_gp_pct: { focus: 'GP% — Protect Margin', suggestions: [
    'Lead with full-price product — show the newest arrivals and hero pieces first',
    'Build emotional value before discussing price — features & benefits matched to probing',
    'Avoid defaulting to discounted stock — use markdown only to close, not to open',
    'Upsell to higher-margin categories (diamonds, gold) using step-up technique',
  ]},
}

function buildStaffCoaching(images) {
  const staffMap = {}
  const storeKpis = {}
  const done = images.filter(img => img.status === 'done')
  const thisYear = new Date().getFullYear()
  const tyWps = done.filter(img => img.reportType === 'wps' && img.year >= thisYear)

  const tyOnyx = done.filter(img => img.reportType === 'onyx' && img.year >= thisYear)

  for (const img of tyWps) {
    const d = img.kpis || {}
    // Store totals for comparison
    if (d.tph != null) storeKpis.tph = d.tph
    if (d.ips != null) storeKpis.ips = d.ips
    if (d.avg_sale != null) storeKpis.avg_sale = d.avg_sale
    if (d.credit_sales_count != null) storeKpis.credit_sales_count = d.credit_sales_count

    // Individual staff
    if (img.staff && Array.isArray(img.staff)) {
      for (const s of img.staff) {
        if (!s.name) continue
        staffMap[s.name] = { ...staffMap[s.name], ...s }
      }
    }
  }

  // Merge Onyx staff data (GP%)
  for (const img of tyOnyx) {
    const d = img.kpis || {}
    if (d.gs_gp_pct != null) storeKpis.gs_gp_pct = d.gs_gp_pct

    if (img.staff && Array.isArray(img.staff)) {
      for (const s of img.staff) {
        if (!s.name) continue
        staffMap[s.name] = { ...staffMap[s.name], ...s }
      }
    }
  }

  // Only include staff who appear in the MIN planner
  const tyMin = done.filter(img => img.reportType === 'min' && img.year >= thisYear)
  const minNames = new Set()
  for (const img of tyMin) {
    if (img.staff && Array.isArray(img.staff)) {
      for (const s of img.staff) {
        if (s.name) minNames.add(s.name.toLowerCase().trim())
      }
    }
  }

  const staffList = Object.values(staffMap).filter(s => {
    if (/^others?$/i.test(s.name)) return false
    // If MIN planner is uploaded, only include staff listed in it
    if (minNames.size > 0 && !minNames.has(s.name.toLowerCase().trim())) return false
    return true
  })
  if (staffList.length === 0) return []

  // For each person, find the metric where they're furthest below store average
  // Priority weights: IPS most important, then TPH, then ASV — weight amplifies the gap
  const metrics = ['ips', 'tph', 'avg_sale', 'gs_gp_pct', 'credit_sales_count']
  const priority = { ips: 1.3, tph: 1.15, avg_sale: 1.05, gs_gp_pct: 1.0, credit_sales_count: 1.0 }
  return staffList.map(person => {
    let worstMetric = null
    let worstScore = Infinity
    let worstRatio = Infinity
    const gaps = []

    for (const m of metrics) {
      if (person[m] != null && storeKpis[m] != null && storeKpis[m] > 0) {
        const ratio = person[m] / storeKpis[m]
        gaps.push({ metric: m, value: person[m], store: storeKpis[m], ratio })
        const score = ratio / (priority[m] || 1.0) // lower score = worse (gap amplified by priority)
        if (score < worstScore) {
          worstScore = score
          worstMetric = m
        }
      }
    }

    const focusInfo = FOCUS_MAP[worstMetric] || FOCUS_MAP.tph
    const statLine = gaps.map(g => {
      const pct = Math.round((g.ratio - 1) * 100)
      const label = { tph: 'TPH', ips: 'IPS', avg_sale: 'ASV', gs_gp_pct: 'GP%', credit_sales_count: 'Credit' }[g.metric] || g.metric
      const vs = pct >= 0 ? `+${pct}%` : `${pct}%`
      return `${label}: ${typeof g.value === 'number' && g.value % 1 !== 0 ? g.value.toFixed(2) : g.value} (${vs} vs store)`
    }).join(' | ')

    return {
      name: person.name,
      focus: focusInfo.focus,
      stats: statLine,
      suggestions: focusInfo.suggestions,
      worstRatio: worstScore,
    }
  }).sort((a, b) => a.worstRatio - b.worstRatio) // worst performers first
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
      extraSales: Math.abs(Math.round((tph * 1.1) * hours * avg_sale - sales_actual)),
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
      extraSales: Math.abs(Math.round(transactions * (ips * 1.1) * avgItemPrice - sales_actual)),
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
      extraSales: Math.abs(Math.round(transactions * avg_sale * 1.1 - sales_actual)),
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

/* -- Light green theme colors -- */
const T = {
  bg: '#f0f7e8',
  card: '#ffffff',
  accent: '#4c6335',
  accentLight: '#e8f2d8',
  accentBorder: '#c5dda8',
  header: '#4c6335',
  headerText: '#fff',
  text: '#2d3a1e',
  textMuted: '#6b7d5a',
  border: '#d4e4c0',
  borderLight: '#e8f0dc',
  inputBg: '#fafdf5',
  danger: '#b54040',
  tagBg: '#edf5e0',
}

function ManagersReportPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [images, setImages] = useState([])
  const [report, setReport] = useState(null)
  const [storeName, setStoreName] = useState('METROTOWN')
  const [weekEnding, setWeekEnding] = useState(() => {
    // MH week runs Monday–Sunday, so week ending = most recent Sunday (including today if Sunday)
    const now = new Date()
    const day = now.getDay() // 0=Sun
    const diff = day === 0 ? 0 : day // days since last Sunday (0 if today is Sunday)
    const lastSun = new Date(now)
    lastSun.setDate(now.getDate() - diff)
    return lastSun.toISOString().slice(0, 10)
  })
  const [copied, setCopied] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [savedImages, setSavedImages] = useState([])
  const [showSaved, setShowSaved] = useState(false)
  const [saveNotice, setSaveNotice] = useState(null)
  const reportRef = useRef(null)
  const fileInputRef = useRef(null)
  const templateInputRef = useRef(null)
  const [templateUploaded, setTemplateUploaded] = useState(false)
  const [spEntries, setSpEntries] = useState([]) // [{name, focus, behaviour, notes}]
  const [staffCoaching, setStaffCoaching] = useState([]) // auto-generated from WPS staff data

  useEffect(() => {
    if (!isAdmin) navigate('/', { replace: true })
  }, [isAdmin, navigate])

  useEffect(() => {
    loadSavedImages(true)
  }, [])

  async function loadSavedImages(autoGenerate = false) {
    try {
      const resp = await fetch('/api/saved-report-images')
      const data = await resp.json()
      setSavedImages(data) // [{fileName, cached, type?, year?, kpis?}, ...]
      // Auto-generate report from cached data on page load
      if (autoGenerate && data.some(i => i.cached)) {
        const cachedImages = data
          .filter(i => i.cached)
          .map(i => ({ status: 'done', year: i.year, reportType: i.type, kpis: i.kpis, staff: i.staff || null }))
        const { ty, ly } = buildReportKpis(cachedImages)
        const coaching = buildStaffCoaching(cachedImages)
        setStaffCoaching(coaching)
        setReport({ storeName: 'METROTOWN', weekEnding, ty, ly })
      }
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
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
      let base64
      if (isPdf) {
        base64 = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.readAsDataURL(file)
        })
      } else {
        base64 = await resizeImage(file)
      }
      const saveResult = await saveImageToServer(base64, file.name)

      const resp = await fetch('/api/ocr-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 }),
      })
      if (!resp.ok) {
        const text = await resp.text()
        try { const j = JSON.parse(text); throw new Error(j.error || `Server error ${resp.status}`) } catch (e) { if (e.message.includes('Server error') || e.message.includes('parse')) throw new Error(`Server error ${resp.status}`); throw e }
      }
      const data = await resp.json()
      if (data.error) throw new Error(data.error)
      setImages(prev => prev.map(img => img.id === id ? {
        ...img, status: 'done', year: data.year,
        dateRange: data.dateRange, reportType: data.type,
        kpis: data.kpis, staff: data.staff || null,
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
      if (!ocrResp.ok) {
        const text = await ocrResp.text()
        try { const j = JSON.parse(text); throw new Error(j.error || `Server error ${ocrResp.status}`) } catch (e) { if (e.message.includes('Server error') || e.message.includes('parse')) throw new Error(`Server error ${ocrResp.status}`); throw e }
      }
      const data = await ocrResp.json()
      if (data.error) throw new Error(data.error)
      setImages(prev => prev.map(img => img.id === id ? {
        ...img, status: 'done', year: data.year,
        dateRange: data.dateRange, reportType: data.type,
        kpis: data.kpis, staff: data.staff || null,
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
    const newFiles = Array.from(fileList).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf' || /\.(heic|heif|pdf)$/i.test(f.name))
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
    const coaching = buildStaffCoaching(images)
    setStaffCoaching(coaching)
    setReport({ storeName, weekEnding, ty, ly })
  }

  function generateFromCached() {
    const cachedImages = savedImages
      .filter(i => i.cached)
      .map(i => ({ status: 'done', year: i.year, reportType: i.type, kpis: i.kpis, staff: i.staff || null }))
    const { ty, ly } = buildReportKpis(cachedImages)
    const coaching = buildStaffCoaching(cachedImages)
    setStaffCoaching(coaching)
    setReport({ storeName, weekEnding, ty, ly })
  }

  function addSp() {
    setSpEntries(prev => [...prev, { name: '', focus: '', behaviour: '', notes: '' }])
  }
  function updateSp(index, field, value) {
    setSpEntries(prev => prev.map((sp, i) => i === index ? { ...sp, [field]: value } : sp))
  }
  function removeSp(index) {
    setSpEntries(prev => prev.filter((_, i) => i !== index))
  }

  function copyToClipboard() {
    if (!report) return

    // Build HTML table for Excel/Word paste
    const weekLabel = new Date(report.weekEnding + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const cs = 'border:1px solid #999;padding:6px 10px;'
    const hcs = cs + 'background:#4c6335;color:#fff;font-weight:bold;text-align:center;'

    let html = `<table style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt;">`
    // Header
    html += `<tr><th style="${hcs}text-align:left;width:55%;"></th><th style="${hcs}">This Year / Week</th><th style="${hcs}">Last Year / Week</th></tr>`

    for (const row of KPI_ROWS) {
      const tyVal = formatVal(report.ty, row.key, row.format)
      const lyVal = formatVal(report.ly, row.key, row.format)
      const tyLines = tyVal.split('\n')
      const lyLines = lyVal.split('\n')
      const tyCell = tyLines[1] ? `${tyLines[0]}<br><span style="font-size:9pt;color:#666;">${tyLines[1]}</span>` : tyLines[0]
      const lyCell = lyLines[1] ? `${lyLines[0]}<br><span style="font-size:9pt;color:#666;">${lyLines[1]}</span>` : lyLines[0]
      html += `<tr><td style="${cs}font-size:10pt;">${row.label}</td><td style="${cs}text-align:center;">${tyCell}</td><td style="${cs}text-align:center;">${lyCell}</td></tr>`
    }

    html += '</table>'

    // Also build plain text fallback
    const pad = (s, w) => s.toString().padStart(w)
    const padL = (s, w) => s.toString().padEnd(w)
    let txt = `${report.storeName} TRADE REPORT\n`
    txt += `Week Ending: ${weekLabel}\n\n`
    txt += padL('', 55) + pad('This Year/Week', 18) + pad('Last Year/Week', 18) + '\n'
    txt += '-'.repeat(91) + '\n'
    for (const row of KPI_ROWS) {
      const tyVal = formatVal(report.ty, row.key, row.format)
      const lyVal = formatVal(report.ly, row.key, row.format)
      txt += padL(row.label, 55) + pad(tyVal.split('\n')[0] || '', 18) + pad(lyVal.split('\n')[0] || '', 18) + '\n'
    }

    // Copy both HTML and plain text so Excel/Word gets the table, plain text apps get fallback
    const blob = new Blob([html], { type: 'text/html' })
    const textBlob = new Blob([txt], { type: 'text/plain' })
    navigator.clipboard.write([
      new ClipboardItem({ 'text/html': blob, 'text/plain': textBlob })
    ]).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function printReport() {
    if (!reportRef.current) return
    const w = window.open('', '_blank')
    let spHtml = ''
    if (staffCoaching.length > 0) {
      spHtml = `<h3 style="margin:24px 0 12px;color:#4c6335;font-size:14px;text-transform:uppercase;letter-spacing:0.06em;">Individual Sales Professional Coaching</h3>`
      for (const person of staffCoaching) {
        const isWeak = person.worstRatio < 0.8
        spHtml += `<div style="padding:10px 14px;margin-bottom:8px;background:${isWeak ? '#fef2f2' : '#f0f7e8'};border-left:3px solid ${isWeak ? '#dc2626' : '#4c6335'};border-radius:4px;">`
        spHtml += `<strong>${person.name}</strong> — <span style="color:#4c6335">${person.focus}</span>`
        spHtml += `<div style="margin-top:4px;font-size:12px;color:#666;">${person.stats}</div>`
        spHtml += `<div style="margin-top:6px;font-size:12px;font-weight:600;color:#888;text-transform:uppercase;">Behaviours to work on</div><ul style="margin:4px 0 0;padding-left:18px;font-size:13px;">`
        for (const tip of person.suggestions.slice(0, 3)) {
          spHtml += `<li>${tip}</li>`
        }
        spHtml += `</ul></div>`
      }
    }
    w.document.write(`<!DOCTYPE html><html><head><title>${storeName} Trade Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 1.5rem; }
        h2 { margin: 0 0 0.25rem; text-align: center; background: #4c6335; color: #fff; padding: 12px; }
        p { margin: 0 0 1rem; color: #666; }
        table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
        th, td { border: 1px solid #ccc; padding: 6px 10px; }
        th { background: #4c6335; color: #fff; text-align: center; }
        td:first-child { text-align: left; }
        td:not(:first-child) { text-align: center; }
        .star { font-size: 0.75rem; color: #666; }
        @media print { body { padding: 0; } }
      </style>
    </head><body>${reportRef.current.innerHTML}${spHtml}</body></html>`)
    w.document.close()
    w.print()
  }

  const TYPE_LABELS = { wps: 'WPS', min: 'MIN', onyx: 'Onyx' }
  const TYPE_COLORS = { wps: '#3b82f6', min: '#f59e0b', onyx: '#ec4899' }

  const sty = {
    page: { maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem 3rem', background: T.bg, minHeight: '100vh' },
    pageHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' },
    backBtn: { background: 'none', border: `1px solid ${T.border}`, color: T.accent, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
    h1: { fontSize: 24, fontWeight: 700, color: T.header, margin: 0 },
    headerActions: { marginLeft: 'auto', display: 'flex', gap: 8 },
    smallBtn: { background: T.card, border: `1px solid ${T.border}`, color: T.textMuted, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
    card: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
    sectionTitle: { fontSize: 14, fontWeight: 700, color: T.accent, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 },
    label: { fontSize: 12, fontWeight: 600, color: T.textMuted, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 },
    input: { width: '100%', padding: '8px 12px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 14, color: T.text, background: T.inputBg, outline: 'none' },
    textarea: { width: '100%', padding: '8px 12px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 13, color: T.text, background: T.inputBg, outline: 'none', resize: 'vertical', minHeight: 60, fontFamily: 'inherit' },
    tag: { display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 },
    primaryBtn: { padding: '10px 24px', background: T.accent, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em' },
    dangerBtn: { background: 'none', border: 'none', color: T.danger, cursor: 'pointer', fontSize: 18, padding: '0 4px', flexShrink: 0 },
  }

  return (
    <div style={sty.page}>
      <div style={sty.pageHeader}>
        <button style={sty.backBtn} onClick={() => navigate('/')}>← Home</button>
        <h1 style={sty.h1}>Managers Report</h1>
        <div style={sty.headerActions}>
          {savedImages.length > 0 && (
            <button onClick={() => setShowSaved(!showSaved)} style={sty.smallBtn}>
              Saved Images ({savedImages.length})
            </button>
          )}
          <button onClick={() => templateInputRef.current?.click()} style={sty.smallBtn}>
            {templateUploaded ? '✓ Template Uploaded' : 'Upload Template'}
          </button>
          <input ref={templateInputRef} type="file" accept="image/*"
            onChange={e => { if (e.target.files[0]) uploadTemplate(e.target.files[0]); e.target.value = '' }}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Save notification */}
      {saveNotice && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 1000,
          background: T.accent, color: '#fff', padding: '10px 20px',
          borderRadius: 8, fontSize: 14, fontWeight: 600,
          boxShadow: '0 4px 12px rgba(76,99,53,0.3)',
        }}>
          {saveNotice}
        </div>
      )}

      {/* Saved images panel */}
      {showSaved && savedImages.length > 0 && (
        <div style={sty.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={sty.sectionTitle}>Saved Report Images</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={processAllSaved} style={{ ...sty.smallBtn, background: T.accent, color: '#fff', border: 'none', fontWeight: 600 }}>
                Process All ({savedImages.length})
              </button>
              <button onClick={async () => {
                await fetch('/api/saved-report-images', { method: 'DELETE' })
                setSavedImages([])
              }} style={sty.smallBtn}>
                Clear All Saved
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {savedImages.map(item => (
              <div key={item.fileName} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                background: T.accentLight, borderRadius: 6, border: `1px solid ${T.accentBorder}`,
              }}>
                <div style={{ flex: 1, cursor: 'pointer', minWidth: 0 }} onClick={() => processSavedImage(item)}>
                  <div style={{ fontSize: 12, color: T.text, wordBreak: 'break-all' }}>
                    {item.fileName.replace(/^\d+_/, '')}
                  </div>
                  {item.cached && (
                    <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>
                      <span style={{ ...sty.tag, background: '#d4edda', color: '#2d6a4f' }}>cached</span>
                      {item.type && <span style={{ ...sty.tag, marginLeft: 4, background: `${TYPE_COLORS[item.type] || '#666'}22`, color: TYPE_COLORS[item.type] || T.textMuted }}>{TYPE_LABELS[item.type] || item.type}</span>}
                      {item.dateRange && <span style={{ marginLeft: 4 }}>{item.dateRange}</span>}
                      {item.year && <span> ({item.year})</span>}
                    </div>
                  )}
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteSavedImage(item.fileName) }} style={sty.dangerBtn}>&times;</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Store info */}
      <div style={sty.card}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <label style={{ flex: 1, minWidth: 180 }}>
            <div style={sty.label}>Store Name</div>
            <input type="text" value={storeName} onChange={e => setStoreName(e.target.value.toUpperCase())} style={sty.input} placeholder="e.g. METROTOWN" />
          </label>
          <label style={{ flex: 1, minWidth: 180 }}>
            <div style={sty.label}>Week Ending</div>
            <input type="date" value={weekEnding} onChange={e => setWeekEnding(e.target.value)} style={sty.input} />
          </label>
        </div>
      </div>

      {/* Drop zone */}
      <div
        style={{
          ...sty.card, padding: 30, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
          border: `2px dashed ${dragging ? T.accent : T.border}`,
          background: dragging ? T.accentLight : T.card,
        }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
        <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 4 }}>
          Drop report screenshots or PDFs here, or tap to select
        </div>
        <div style={{ fontSize: 11, color: T.textMuted }}>
          WPS, MIN Planner, or Onyx — this year &amp; last year. Images &amp; PDFs are auto-saved.
        </div>
        <input ref={fileInputRef} type="file" multiple
          accept="image/png,image/jpeg,image/jpg,image/heic,image/heif,application/pdf,.png,.jpg,.jpeg,.heic,.heif,.pdf"
          onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
          style={{ display: 'none' }}
        />
      </div>

      {/* Uploaded images list */}
      {images.length > 0 && (
        <div style={sty.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={sty.sectionTitle}>{images.length} Image{images.length !== 1 ? 's' : ''}</div>
            <button onClick={clearAll} style={sty.smallBtn}>Clear All</button>
          </div>
          {images.map(img => (
            <div key={img.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              background: img.status === 'error' ? '#fef2f2' : T.accentLight,
              borderRadius: 8, marginBottom: 6, borderLeft: `3px solid ${
                img.status === 'processing' ? '#d97706' : img.status === 'error' ? T.danger : img.status === 'done' ? T.accent : T.border
              }`,
            }}>
              <span style={{ fontSize: 14 }}>
                {img.status === 'processing' ? '⏳' : img.status === 'error' ? '❌' : img.status === 'done' ? '✅' : '⏸️'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: T.text, wordBreak: 'break-all' }}>{img.fileName}</div>
                {img.status === 'done' && (
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                    {img.reportType && (
                      <span style={{ ...sty.tag, marginRight: 6, background: `${TYPE_COLORS[img.reportType] || '#666'}22`, color: TYPE_COLORS[img.reportType] || T.textMuted }}>{TYPE_LABELS[img.reportType] || img.reportType}</span>
                    )}
                    {img.dateRange && <span>{img.dateRange} </span>}
                    {img.year && <span>({img.year})</span>}
                    {img.kpis && <span> — {Object.keys(img.kpis).length} fields</span>}
                  </div>
                )}
                {img.status === 'error' && (
                  <div style={{ fontSize: 11, color: T.danger, marginTop: 2 }}>{img.error || 'Failed to process'}</div>
                )}
              </div>
              <button onClick={() => removeImage(img.id)} style={sty.dangerBtn}>&times;</button>
            </div>
          ))}
        </div>
      )}

      {/* Generate */}
      {(() => {
        const doneCount = images.filter(i => i.status === 'done').length
        const processingCount = images.filter(i => i.status === 'processing').length
        const cachedCount = savedImages.filter(i => i.cached).length
        const canGenerateFromCache = cachedCount > 0 && images.length === 0
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <button
              style={{ ...sty.primaryBtn, opacity: (!canGenerateFromCache && (doneCount === 0 || processingCount > 0)) ? 0.4 : 1, cursor: (!canGenerateFromCache && (doneCount === 0 || processingCount > 0)) ? 'not-allowed' : 'pointer' }}
              onClick={canGenerateFromCache ? generateFromCached : generateReport}
              disabled={!canGenerateFromCache && (doneCount === 0 || processingCount > 0)}
            >
              {processingCount > 0 ? `Processing ${processingCount} image${processingCount !== 1 ? 's' : ''}...` : 'Generate Managers Report'}
            </button>
            {canGenerateFromCache && (
              <span style={{ fontSize: 13, color: T.textMuted }}>{cachedCount} cached report{cachedCount !== 1 ? 's' : ''} ready</span>
            )}
            {!canGenerateFromCache && doneCount > 0 && processingCount === 0 && (
              <span style={{ fontSize: 13, color: T.textMuted }}>{doneCount} report{doneCount !== 1 ? 's' : ''} ready</span>
            )}
            {!canGenerateFromCache && images.length === 0 && cachedCount === 0 && (
              <span style={{ fontSize: 13, color: T.textMuted }}>Upload WPS, MIN, or Onyx screenshots</span>
            )}
          </div>
        )
      })()}

      {/* Report output */}
      {report && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button className="mr-tool-btn" onClick={copyToClipboard}>{copied ? '✓ Copied' : 'Copy Table'}</button>
            <button className="mr-tool-btn" onClick={printReport}>Print</button>
          </div>

          <div style={sty.card} ref={reportRef}>
            <h2 style={{ textAlign: 'center', background: T.accent, color: '#fff', margin: '-20px -20px 16px', padding: '14px 20px', borderRadius: '10px 10px 0 0', fontSize: 20 }}>
              {report.storeName} TRADE REPORT
            </h2>
            <p style={{ fontWeight: 700, marginBottom: 4, color: T.text }}>Results for the week</p>
            <p style={{ color: T.textMuted, marginBottom: 20, fontSize: 14 }}>
              Week Ending: {new Date(report.weekEnding + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>

            <div className="mr-table-wrap">
              <table className="mr-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', width: '55%', background: T.accent, borderColor: '#3d5229' }}></th>
                    <th style={{ background: T.accent, borderColor: '#3d5229' }}>This Year / Week</th>
                    <th style={{ background: T.accent, borderColor: '#3d5229' }}>Last Year / Week</th>
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
                        <td style={{ textAlign: 'left', fontSize: 13, color: T.text }}>{row.label}</td>
                        <td style={{ textAlign: 'center', color: T.text }}>
                          <div>{tyLines[0]}</div>
                          {tyLines[1] && <div style={{ fontSize: 11, color: T.textMuted }}>{tyLines[1]}</div>}
                        </td>
                        <td style={{ textAlign: 'center', color: T.text }}>
                          <div>{lyLines[0]}</div>
                          {lyLines[1] && <div style={{ fontSize: 11, color: T.textMuted }}>{lyLines[1]}</div>}
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
              <div style={sty.card}>
                <div style={sty.sectionTitle}>Sales Lever Analysis</div>
                <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 12 }}>
                  Current weekly sales: <strong style={{ color: T.text }}>${analysis.sales_actual.toLocaleString()}</strong> from {analysis.transactions} transactions over {analysis.hours} paid hours
                </p>
                <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 16 }}>
                  If each SP improves by 10%, which lever drives the most sales?
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {analysis.improvements.map((imp, i) => {
                    const isBest = i === 0
                    return (
                      <div key={imp.key} style={{
                        padding: '12px 16px', borderRadius: 8,
                        background: isBest ? '#e8f5e9' : T.accentLight,
                        border: `1px solid ${isBest ? '#a5d6a7' : T.accentBorder}`,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: isBest ? '#2e7d32' : T.text }}>
                            {isBest && '★ '}{imp.label}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 16, color: isBest ? '#2e7d32' : '#b8860b' }}>
                            +${imp.extraSales.toLocaleString()}/wk
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: T.textMuted }}>
                          {imp.format(imp.current)} → {imp.format(imp.improved)} = ${imp.newSales.toLocaleString()}/wk
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ padding: 14, background: '#e8f5e9', borderRadius: 8, borderLeft: `3px solid ${T.accent}` }}>
                  <div style={{ fontWeight: 700, marginBottom: 2, color: '#2e7d32', fontSize: 14 }}>
                    Top Priority: {best.label} — {best.focus}
                  </div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>
                    +10% {best.label.split(' (')[0]} = +${best.extraSales.toLocaleString()} weekly sales — biggest lever for SPs right now
                  </div>
                  <p style={{ fontSize: 12, color: T.textMuted, margin: '0 0 8px', fontStyle: 'italic' }}>
                    MH Observation behaviours to focus on:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: T.text, lineHeight: 1.7 }}>
                    {best.suggestions.map((tip, j) => <li key={j}>{tip}</li>)}
                  </ul>
                </div>

                {analysis.improvements.length > 1 && analysis.improvements.slice(1).map((imp) => (
                  <div key={imp.key} style={{ padding: 14, background: '#fff8e1', borderRadius: 8, borderLeft: '3px solid #b8860b', marginTop: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 2, color: '#b8860b', fontSize: 14 }}>
                      Also Focus: {imp.label} — {imp.focus}
                    </div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>
                      +10% = +${imp.extraSales.toLocaleString()} weekly sales
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: T.text, lineHeight: 1.7 }}>
                      {imp.suggestions.map((tip, j) => <li key={j}>{tip}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* 3. Per-Person Coaching (auto-generated from WPS staff data) */}
          {staffCoaching.length > 0 && (
            <div style={sty.card}>
              <div style={sty.sectionTitle}>Individual Sales Professional Coaching</div>
              <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 16 }}>
                Auto-generated from WPS report — each person's weakest stat vs store average, with recommended behaviours to work on.
              </p>
              {staffCoaching.map((person, i) => {
                const isWeak = person.worstRatio < 0.8
                return (
                  <div key={i} style={{
                    padding: 14, borderRadius: 8, marginBottom: 12,
                    background: isWeak ? '#fef2f2' : T.accentLight,
                    border: `1px solid ${isWeak ? '#fca5a5' : T.accentBorder}`,
                    borderLeft: `4px solid ${isWeak ? '#dc2626' : T.accent}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: T.header }}>{person.name}</div>
                      <span style={{ ...sty.tag, background: isWeak ? '#dc2626' : T.accent, color: '#fff' }}>{person.focus}</span>
                    </div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8, lineHeight: 1.5 }}>
                      {person.stats}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                      Behaviours to work on
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: T.text, lineHeight: 1.6 }}>
                      {person.suggestions.slice(0, 3).map((tip, j) => <li key={j}>{tip}</li>)}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ManagersReportPage
