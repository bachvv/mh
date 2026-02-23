import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function ConciergePage() {
  const navigate = useNavigate()
  const { user, isAdmin, login, logout } = useAuth()

  const links = [
    { label: 'Wedders', path: '/wedders' },
    { label: 'Watches', path: '/watches' },
    { label: 'Find by Photo', path: '/find-by-photo' },
    ...(isAdmin ? [{ label: 'Image Admin', path: '/image-admin' }] : []),
  ]

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
            <button className="auth-btn" onClick={login}>Sign In</button>
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
    </div>
  )
}

export default ConciergePage
