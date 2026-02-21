import { useNavigate } from 'react-router-dom'
import RotationPage from './RotationPage'
import ConversionPage from './ConversionPage'

function DevPage() {
  const navigate = useNavigate()

  return (
    <div className="dev-page">
      <div className="dev-header">
        <button className="back-button" onClick={() => navigate('/')}>
          &larr; Home
        </button>
        <h1>Dev Tools</h1>
      </div>
      <div className="dev-tools-grid">
        <div className="dev-tool-panel">
          <RotationPage embedded />
        </div>
        <div className="dev-tool-panel">
          <ConversionPage embedded />
        </div>
      </div>
    </div>
  )
}

export default DevPage
