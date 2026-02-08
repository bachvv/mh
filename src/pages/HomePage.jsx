import { useNavigate } from 'react-router-dom'

function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="home-page">
      <div className="hero">
        <h1>MH Tools</h1>
        <p>Sales tools for Mattress Hub professionals</p>
        <div className="home-buttons">
          <button className="cta-button" onClick={() => navigate('/credit-calculator')}>
            Credit Calculator
          </button>
          <button className="cta-button cta-gold" onClick={() => navigate('/gold-club-tracker')}>
            Gold Club Tracker
          </button>
          <button className="cta-button" onClick={() => navigate('/rotation')}>
            Sales Rotation
          </button>
        </div>
      </div>
    </div>
  )
}

export default HomePage
