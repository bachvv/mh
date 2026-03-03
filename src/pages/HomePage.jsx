import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function HomePage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

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
  ]

  return (
    <div className="home-page">
      <div className="hero">
        <h1>MH Tools</h1>
        <p>Sales tools for Michael Hill professionals</p>
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
        {isAdmin && (
          <button
            className="tool-card tool-card--admin"
            onClick={() => navigate('/managers-report')}
          >
            <span className="tool-card__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </span>
            <span className="tool-card__label">Managers Report</span>
            <span className="tool-card__desc">Generate trade reports</span>
          </button>
        )}
      </div>
      <button className="dev-dot" onClick={() => navigate('/dev')} aria-label="Dev tools" />
    </div>
  )
}

export default HomePage
