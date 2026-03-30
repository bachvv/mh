import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useCallback } from 'react'
import DevQuote from '../components/DevQuote'

function DevPage() {
  const navigate = useNavigate()
  const { user, isAdmin, renderButton, logout } = useAuth()
  const googleBtnRef = useCallback((el) => {
    if (el) renderButton(el)
  }, [renderButton])

  const links = [
    { label: 'Rotation', path: '/rotation' },
    { label: 'Conversion', path: '/conversion' },
    { label: 'Observation', path: '/observation' },
    { label: 'Clockwork', path: '/clockwork' },
    ...(isAdmin ? [{ label: 'Admin', path: '/admin' }] : []),
    { label: 'Booking', path: '/booking' },
    { label: 'Repairs', path: '/repairs' },
    { label: 'Carat Club', path: '/carat-club' },
  ]

  return (
    <div className="dev-page">
      <div className="dev-header">
        <button className="back-button" onClick={() => navigate('/')}>Home</button>
        <h1>Development</h1>
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
      <div className="dev-links">
        {links.map((link) => (
          <button
            key={link.path}
            className="dev-link-btn"
            onClick={() => navigate(link.path)}
          >
            {link.label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 'auto' }}>
        <DevQuote />
      </div>
    </div>
  )
}

export default DevPage
