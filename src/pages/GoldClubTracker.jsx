import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

const TIERS = [
  { name: 'Silver', target: 230000, color: '#9e9e9e', bg: '#f5f5f5' },
  { name: 'Gold', target: 250000, color: '#ffc107', bg: '#fff8e1' },
  { name: 'Emerald', target: 320000, color: '#4caf50', bg: '#e8f5e9' },
]

function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date - start
  const oneDay = 1000 * 60 * 60 * 24
  return Math.floor(diff / oneDay)
}

function getDaysInYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365
}

function GoldClubTracker() {
  const navigate = useNavigate()
  const [gpInput, setGpInput] = useState('')

  const gpAmount = useMemo(() => {
    const val = parseFloat(gpInput.replace(/,/g, ''))
    return isNaN(val) ? 0 : val
  }, [gpInput])

  const today = new Date()
  const dayOfYear = getDayOfYear(today)
  const daysInYear = getDaysInYear(today.getFullYear())
  const yearProgress = dayOfYear / daysInYear
  const daysRemaining = daysInYear - dayOfYear

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const currentMonth = monthNames[today.getMonth()]
  const currentDay = today.getDate()

  const tierResults = useMemo(() => {
    return TIERS.map((tier) => {
      const expectedByNow = tier.target * yearProgress
      const onTrack = gpAmount >= expectedByNow
      const remaining = Math.max(0, tier.target - gpAmount)
      const pace = yearProgress > 0 ? gpAmount / yearProgress : 0
      const projectedYear = pace
      const dailyNeeded = daysRemaining > 0 ? remaining / daysRemaining : 0
      const achieved = gpAmount >= tier.target

      return {
        ...tier,
        expectedByNow,
        onTrack,
        remaining,
        pace,
        projectedYear,
        dailyNeeded,
        achieved,
      }
    })
  }, [gpAmount, yearProgress, daysRemaining])

  const formatCurrency = (val) => {
    return '$' + Math.round(val).toLocaleString()
  }

  return (
    <div className="tracker-page">
      <div className="calc-header">
        <button className="back-button" onClick={() => navigate('/')}>
          &larr; Home
        </button>
        <h1>Gold Club Tracker</h1>
      </div>

      <div className="tracker-input-section">
        <h2>Enter Your Current Gross Profit</h2>
        <p className="tracker-subtitle">
          Track your progress toward Silver, Gold, and Emerald club tiers
        </p>
        <div className="tracker-input-row">
          <div className="amount-input tracker-amount">
            <span className="dollar-sign">$</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={gpInput}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9.,]/g, '')
                setGpInput(raw)
              }}
            />
          </div>
          <span className="tracker-gp-label">GP Year-to-Date</span>
        </div>
        <div className="tracker-date-info">
          <span>{currentMonth} {currentDay}, {today.getFullYear()}</span>
          <span className="tracker-separator">|</span>
          <span>Day {dayOfYear} of {daysInYear}</span>
          <span className="tracker-separator">|</span>
          <span>{Math.round(yearProgress * 100)}% of year elapsed</span>
          <span className="tracker-separator">|</span>
          <span>{daysRemaining} days remaining</span>
        </div>
      </div>

      {gpAmount > 0 && (
        <div className="tracker-tiers">
          {tierResults.map((tier) => (
            <div
              key={tier.name}
              className={`tracker-tier-card ${tier.achieved ? 'tier-achieved' : tier.onTrack ? 'tier-on-track' : 'tier-behind'}`}
              style={{ borderTopColor: tier.color }}
            >
              <div className="tier-header">
                <h3 style={{ color: tier.color }}>{tier.name} Club</h3>
                <span className="tier-target">Target: {formatCurrency(tier.target)}</span>
              </div>

              <div className="tier-progress-bar-wrapper">
                <div className="tier-progress-bar">
                  <div
                    className="tier-progress-fill"
                    style={{
                      width: `${Math.min(100, (gpAmount / tier.target) * 100)}%`,
                      backgroundColor: tier.color,
                    }}
                  />
                  <div
                    className="tier-expected-marker"
                    style={{ left: `${yearProgress * 100}%` }}
                    title={`Expected position: ${formatCurrency(tier.expectedByNow)}`}
                  />
                </div>
                <div className="tier-progress-labels">
                  <span>{Math.round((gpAmount / tier.target) * 100)}% complete</span>
                  <span>{formatCurrency(tier.target)}</span>
                </div>
              </div>

              {tier.achieved ? (
                <div className="tier-status tier-status-achieved">
                  <span className="tier-status-icon">&#10003;</span>
                  <div>
                    <strong>Target Achieved!</strong>
                    <p>You've reached the {tier.name} Club tier with {formatCurrency(gpAmount - tier.target)} above the goal.</p>
                  </div>
                </div>
              ) : tier.onTrack ? (
                <div className="tier-status tier-status-on-track">
                  <span className="tier-status-icon">&#9650;</span>
                  <div>
                    <strong>On Track</strong>
                    <p>You're ahead of pace. Expected by now: {formatCurrency(tier.expectedByNow)}. You have {formatCurrency(gpAmount)}.</p>
                  </div>
                </div>
              ) : (
                <div className="tier-status tier-status-behind">
                  <span className="tier-status-icon">&#9660;</span>
                  <div>
                    <strong>Behind Pace</strong>
                    <p>Expected by now: {formatCurrency(tier.expectedByNow)}. You're {formatCurrency(tier.expectedByNow - gpAmount)} behind.</p>
                  </div>
                </div>
              )}

              {!tier.achieved && (
                <div className="tier-details">
                  <div className="tier-detail-item">
                    <span className="tier-detail-label">Remaining</span>
                    <span className="tier-detail-value">{formatCurrency(tier.remaining)}</span>
                  </div>
                  <div className="tier-detail-item">
                    <span className="tier-detail-label">Daily GP Needed</span>
                    <span className="tier-detail-value">{formatCurrency(tier.dailyNeeded)}/day</span>
                  </div>
                  <div className="tier-detail-item">
                    <span className="tier-detail-label">Projected Year-End</span>
                    <span className="tier-detail-value">{formatCurrency(tier.projectedYear)}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {gpAmount > 0 && (
        <div className="tracker-summary-card">
          <h3>Projection Summary</h3>
          <p>
            At your current pace, your projected year-end GP is <strong>{formatCurrency(tierResults[0].projectedYear)}</strong>.
            {tierResults[2].projectedYear >= tierResults[2].target
              ? ' You are on pace for all three tiers including Emerald Club!'
              : tierResults[1].projectedYear >= tierResults[1].target
                ? ' You are on pace for Gold Club but need to increase for Emerald.'
                : tierResults[0].projectedYear >= tierResults[0].target
                  ? ' You are on pace for Silver Club. Push harder for Gold and Emerald!'
                  : ' You need to increase your daily GP to reach any club tier.'}
          </p>
        </div>
      )}
    </div>
  )
}

export default GoldClubTracker
