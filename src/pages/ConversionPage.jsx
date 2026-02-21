import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const STORAGE_KEY = 'mh_conversion_data'

function today() {
  return new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"
}

function loadData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// Returns today's counts for a name, resetting to 0 if it's a new day
function getEntryForToday(data, name) {
  const entry = data[name]
  if (!entry || entry.date !== today()) return { wins: 0, losses: 0, date: today() }
  return entry
}

function ConversionPage({ embedded = false }) {
  const navigate = useNavigate()
  const [nameInput, setNameInput] = useState('')
  const [activeName, setActiveName] = useState(() => {
    const d = loadData()
    return d.__lastActive || ''
  })
  const [wins, setWins] = useState(() => {
    const d = loadData()
    const name = d.__lastActive || ''
    return name ? getEntryForToday(d, name).wins : 0
  })
  const [losses, setLosses] = useState(() => {
    const d = loadData()
    const name = d.__lastActive || ''
    return name ? getEntryForToday(d, name).losses : 0
  })
  const [flash, setFlash] = useState(null) // 'win' | 'loss'

  // Load today's counts whenever activeName changes
  useEffect(() => {
    if (!activeName) return
    const d = loadData()
    const entry = getEntryForToday(d, activeName)
    setWins(entry.wins)
    setLosses(entry.losses)
  }, [activeName])

  const persist = (w, l) => {
    const d = loadData()
    d[activeName] = { wins: w, losses: l, date: today() }
    d.__lastActive = activeName
    saveData(d)
  }

  const handleSetName = (e) => {
    e.preventDefault()
    const trimmed = nameInput.trim()
    if (!trimmed) return
    const d = loadData()
    const entry = getEntryForToday(d, trimmed)
    d.__lastActive = trimmed
    saveData(d)
    setActiveName(trimmed)
    setWins(entry.wins)
    setLosses(entry.losses)
    setNameInput('')
  }

  const triggerFlash = (type) => {
    setFlash(type)
    setTimeout(() => setFlash(null), 400)
  }

  const handleWin = () => {
    const w = wins + 1
    setWins(w)
    persist(w, losses)
    triggerFlash('win')
  }

  const handleLoss = () => {
    const l = losses + 1
    setLosses(l)
    persist(wins, l)
    triggerFlash('loss')
  }

  const handleReset = () => {
    setWins(0)
    setLosses(0)
    persist(0, 0)
  }

  const handleChangeName = () => {
    setActiveName('')
    setWins(0)
    setLosses(0)
  }

  const total = wins + losses
  const rate = total > 0 ? (wins / total) * 100 : null
  const rateColor = rate === null ? '#999' : rate >= 60 ? '#4c6335' : rate >= 40 ? '#c49a3c' : '#8b2525'

  return (
    <div className={`conversion-page${flash ? ` conversion-flash--${flash}` : ''}`}>
      {!embedded && (
        <div className="conversion-header">
          <button className="back-button" onClick={() => navigate('/dev')}>Dev</button>
          <h1 className="conversion-title">Conversion</h1>
        </div>
      )}
      {embedded && (
        <div className="conversion-header">
          <h2 style={{ margin: 0 }}>Conversion</h2>
        </div>
      )}

      {!activeName ? (
        <div className="conversion-name-card">
          <p className="conversion-name-prompt">Who's tracking today?</p>
          <form onSubmit={handleSetName} className="conversion-name-form">
            <input
              className="conversion-name-input"
              type="text"
              placeholder="Your name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              autoFocus
            />
            <button type="submit" className="conversion-name-btn" disabled={!nameInput.trim()}>
              Let's go
            </button>
          </form>
        </div>
      ) : (
        <div className="conversion-tracker">
          <div className="conversion-who">
            <span className="conversion-who-name">{activeName}</span>
            <button className="conversion-change-btn" onClick={handleChangeName}>Change</button>
          </div>

          <div className="conversion-rate-display">
            <div className="conversion-rate-number" style={{ color: rateColor }}>
              {rate === null ? '—' : `${rate.toFixed(1)}%`}
            </div>
            <div className="conversion-rate-label">Conversion Rate</div>
            {total > 0 && (
              <div className="conversion-total-label">{total} interaction{total !== 1 ? 's' : ''}</div>
            )}
          </div>

          <div className="conversion-buttons">
            <div className="conversion-btn-group">
              <button
                className="conversion-face-btn conversion-face-btn--win"
                onClick={handleWin}
                aria-label="Closed sale"
              >
                😊
              </button>
              <div className="conversion-count conversion-count--win">{wins}</div>
              <div className="conversion-btn-label">Closed</div>
            </div>

            <div className="conversion-btn-group">
              <button
                className="conversion-face-btn conversion-face-btn--loss"
                onClick={handleLoss}
                aria-label="Missed sale"
              >
                😞
              </button>
              <div className="conversion-count conversion-count--loss">{losses}</div>
              <div className="conversion-btn-label">Missed</div>
            </div>
          </div>

          {total > 0 && (
            <button className="conversion-reset-btn" onClick={handleReset}>
              Reset counts
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default ConversionPage
