import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import SalesQuote from '../components/SalesQuote'

const MH_PASS = 'mh123'
const STORAGE_KEY = 'mh_unlocked'

function HomePage() {
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const [isSP, setIsSP] = useState(false)
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')
  const [passInput, setPassInput] = useState('')
  const [error, setError] = useState(false)

  const handleUnlock = (e) => {
    e.preventDefault()
    if (passInput === MH_PASS) {
      localStorage.setItem(STORAGE_KEY, 'true')
      setUnlocked(true)
      setError(false)
    } else {
      setError(true)
    }
  }

  useEffect(() => {
    if (!user?.email) { setIsSP(false); return }
    fetch('/api/booking/professionals')
      .then(r => r.json())
      .then(pros => setIsSP(pros.some(p => p.email === user.email)))
      .catch(() => setIsSP(false))
  }, [user?.email])

  if (!unlocked) {
    return (
      <div className="home-page">
        <div className="hero">
          <h2>MH Tools</h2>
          <form onSubmit={handleUnlock} className="mh-password-gate">
            <input
              type="password"
              value={passInput}
              onChange={e => { setPassInput(e.target.value); setError(false) }}
              placeholder="Enter password"
              autoFocus
              className="mh-password-input"
            />
            <button type="submit" className="mh-password-btn">Enter</button>
            {error && <p className="mh-password-error">Wrong password</p>}
          </form>
        </div>
      </div>
    )
  }

  const showBooking = isSP || isAdmin

  const tools = [
    {
      label: 'Credit Calculator',
      path: '/credit-calculator',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
          <line x1="6" y1="14" x2="6" y2="14.01" />
          <line x1="10" y1="14" x2="14" y2="14" />
        </svg>
      ),
      description: 'Flexiti & MHC monthly payments',
    },
    {
      label: 'Gold Club Tracker',
      path: '/gold-club-tracker',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="6" />
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M12 14v4" />
        </svg>
      ),
      description: 'Gold, Ruby & Emerald tiers',
      accent: true,
    },
    {
      label: 'Incentives',
      path: '/incentives',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 12v10H4V12" />
          <rect x="2" y="7" width="20" height="5" />
          <path d="M12 22V7" />
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
        </svg>
      ),
      description: 'Spiffs & bonus programs',
    },
    ...(showBooking ? [{
      label: 'Booking',
      path: '/booking/admin',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
      description: 'Manage your bookings & profile',
    }] : []),
    {
      label: 'SKU Finder',
      path: '/findsku',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
      description: 'Find products by SKU or category',
    },
  ]

  return (
    <div className="home-page">
      <div className="hero">
        <h2>MH Tools</h2>
        <SalesQuote />
        <div className="tool-cards">
          {tools.map((tool) => (
            <button
              key={tool.path}
              className={`tool-card${tool.accent ? ' tool-card--accent' : ''}`}
              onClick={() => navigate(tool.path)}
            >
              <span className="tool-card__icon">{tool.icon}</span>
              <span className="tool-card__label">{tool.label}</span>
              <span className="tool-card__desc">{tool.description}</span>
            </button>
          ))}
        </div>
      </div>
      <button className="dev-dot" onClick={() => navigate('/dev')} aria-label="Dev tools" />
    </div>
  )
}

export default HomePage
