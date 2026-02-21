import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import CreditCalculator from './pages/CreditCalculator'
import GoldClubTracker from './pages/GoldClubTracker'
import RotationPage from './pages/RotationPage'
import IncentivesPage from './pages/IncentivesPage'
import ConversionPage from './pages/ConversionPage'
import DevPage from './pages/DevPage'
import ObservationPage from './pages/ObservationPage'
import ClockworkPage from './pages/ClockworkPage'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/credit-calculator" element={<CreditCalculator />} />
      <Route path="/gold-club-tracker" element={<GoldClubTracker />} />
      <Route path="/rotation" element={<RotationPage />} />
      <Route path="/incentives" element={<IncentivesPage />} />
      <Route path="/conversion" element={<ConversionPage />} />
      <Route path="/dev" element={<DevPage />} />
      <Route path="/observation" element={<ObservationPage />} />
      <Route path="/clockwork" element={<ClockworkPage />} />
    </Routes>
  )
}

export default App
