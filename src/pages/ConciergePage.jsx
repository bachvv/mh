import { useNavigate } from 'react-router-dom'
import { useCallback } from 'react'
import { useAuth } from '../auth/AuthContext'

const GROUPS = [
  {
    label: 'Concierge',
    grid: true,
    links: [
      { label: 'Wedders', path: '/wedders' },
      { label: 'Chains', path: '/chains' },
      { label: 'Rings', path: '/rings' },
      { label: 'Tennis', path: '/tennis' },
      { label: 'Bangles', path: '/bangles' },
      { label: 'Pendant Bar', path: '/pendant-bar' },
    ],
  },
  {
    label: null,
    links: [
      { label: 'Watches', path: '/watches' },
      { label: 'Find by Photo', path: '/find-by-photo' },
    ],
  },
]

function ConciergePage() {
  const navigate = useNavigate()
  const { user, isAdmin, renderButton, logout } = useAuth()
  const googleBtnRef = useCallback((el) => {
    if (el) renderButton(el)
  }, [renderButton])

  return (
    <div className="dev-page">
      <div className="dev-header">
        <button className="back-button" onClick={() => navigate('/dev')}>Dev</button>
        <h1>SKU Finder</h1>
        <div className="auth-controls">
          {user ? (
            <>
              <img src={user.picture} alt="" className="auth-avatar" referrerPolicy="no-referrer" />
              <button className="auth-btn" onClick={logout}>Sign Out</button>
            </>
          ) : (
            <div ref={googleBtnRef} />
          )}
        </div>
      </div>

      {GROUPS.map((group, gi) => (
        <div key={gi} className="concierge-group">
          {group.label && <div className="concierge-group-label">{group.label}</div>}
          <div className={`dev-links${group.grid ? ' dev-links--grid' : ''}`}>
            {group.links.map((link) => (
              <button
                key={link.path}
                className="dev-link-btn"
                onClick={() => navigate(link.path)}
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {isAdmin && (
        <div className="concierge-group">
          <div className="dev-links">
            <button className="dev-link-btn" onClick={() => navigate('/catalog-process')}>
              Catalog Processor
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConciergePage
