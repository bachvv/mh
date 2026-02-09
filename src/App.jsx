import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import CreditCalculator from './pages/CreditCalculator'
import GoldClubTracker from './pages/GoldClubTracker'
import RotationPage from './pages/RotationPage'
import IncentivesPage from './pages/IncentivesPage'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/credit-calculator" element={<CreditCalculator />} />
      <Route path="/gold-club-tracker" element={<GoldClubTracker />} />
      <Route path="/rotation" element={<RotationPage />} />
      <Route path="/incentives" element={<IncentivesPage />} />
    </Routes>
  )
}

export default App
