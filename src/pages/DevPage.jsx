import { useNavigate } from 'react-router-dom'

function DevPage() {
  const navigate = useNavigate()

  const links = [
    { label: 'Rotation', path: '/rotation' },
    { label: 'Conversion', path: '/conversion' },
    { label: 'Observation', path: '/observation' },
    { label: 'Clockwork', path: '/clockwork' },
    { label: 'SKU Finder', path: '/findsku' },
  ]

  return (
    <div className="dev-page">
      <div className="dev-header">
        <button className="back-button" onClick={() => navigate('/')}>Home</button>
        <h1>Dev Tools</h1>
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

export default DevPage
