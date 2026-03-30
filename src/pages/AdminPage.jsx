import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useEffect } from 'react'

function AdminPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  useEffect(() => {
    if (!isAdmin) navigate('/', { replace: true })
  }, [isAdmin, navigate])

  const links = [
    { label: "Manager's Report", path: '/managers-report' },
    { label: 'Spread Analysis', path: '/spread-analysis' },
    { label: 'Image Admin', path: '/admin/images' },
    { label: 'Booking Admin', path: '/admin/booking' },
    { label: 'Access Log', path: '/admin/access-log' },
  ]

  return (
    <div className="dev-page">
      <div className="dev-header">
        <button className="back-button" onClick={() => navigate('/dev')}>Back</button>
        <h1>Admin</h1>
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

export default AdminPage
