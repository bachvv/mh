import { useNavigate } from 'react-router-dom'

function ConciergePage() {
  const navigate = useNavigate()

  const links = [
    { label: 'Wedders Concierge', path: '/wedders' },
  ]

  return (
    <div className="dev-page">
      <div className="dev-header">
        <button className="back-button" onClick={() => navigate('/dev')}>Dev</button>
        <h1>Concierge</h1>
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
