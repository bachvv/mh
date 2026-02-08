import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import CreditCalculator from './pages/CreditCalculator'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/credit-calculator" element={<CreditCalculator />} />
    </Routes>
  )
}

export default App
