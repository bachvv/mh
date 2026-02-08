import { useNavigate } from 'react-router-dom'

function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="home-page">
      <div className="hero">
        <h1>MH Credit Calculator</h1>
        <p>Calculate monthly payments for Flexiti and MHC financing options</p>
        <button className="cta-button" onClick={() => navigate('/credit-calculator')}>
          Go to Credit Calculator
        </button>
        <button className="cta-button" style={{ marginTop: '1rem' }} onClick={() => navigate('/rotation')}>
          Sales Rotation
        </button>
      </div>
    </div>
  )
}

export default HomePage
