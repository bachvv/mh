import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fourWeekTiers, fiveWeekTiers, gpPercentTiers } from '../data/incentiveTiers'

function IncentivesPage() {
  const navigate = useNavigate()
  const currentMonth = new Date().getMonth() // 0-indexed
  const isFiveWeek = [1, 4, 7, 10].includes(currentMonth) // Feb, May, Aug, Nov
  const [monthType, setMonthType] = useState(isFiveWeek ? '5week' : '4week')
  const [gpDollars, setGpDollars] = useState('')
  const [gpPercent, setGpPercent] = useState('')

  const tiers = monthType === '4week' ? fourWeekTiers : fiveWeekTiers

  const result = useMemo(() => {
    const gp = parseFloat(gpDollars) || 0
    const gpPct = parseFloat(gpPercent) || 0

    // Find current tier (highest tier where benchmark <= gp)
    let currentTierIndex = 0
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (gp >= tiers[i].benchmark) {
        currentTierIndex = i
        break
      }
    }

    const currentTier = tiers[currentTierIndex]
    const nextTier = currentTierIndex < tiers.length - 1 ? tiers[currentTierIndex + 1] : null
    const gpNeeded = nextTier ? nextTier.benchmark - gp : 0

    // Find GP% tier
    let gpPctTierIndex = 0
    for (let i = gpPercentTiers.length - 1; i >= 0; i--) {
      if (gpPct >= gpPercentTiers[i].gpRange) {
        gpPctTierIndex = i
        break
      }
    }
    const accelerator = gpPercentTiers[gpPctTierIndex].accelerator

    // Calculate adjusted incentive
    const baseIncentive = gp * (currentTier.commission / 100)
    const adjustedIncentive = baseIncentive * (accelerator / 100)

    // Build upcoming tiers with potential commission info
    const upcomingTiers = tiers.slice(currentTierIndex + 1).map((t) => {
      const needed = t.benchmark - gp
      const potentialIncentive = t.benchmark * (t.commission / 100)
      const potentialAdjusted = potentialIncentive * (accelerator / 100)
      return {
        tier: t.tier,
        commission: t.commission,
        benchmark: t.benchmark,
        gpNeeded: needed,
        potentialIncentive,
        potentialAdjusted,
      }
    })

    return {
      currentTier: currentTier.tier,
      currentTierIndex,
      commission: currentTier.commission,
      baseIncentive,
      accelerator,
      adjustedIncentive,
      nextTier: nextTier ? nextTier.tier : null,
      gpNeeded,
      nextCommission: nextTier ? nextTier.commission : null,
      upcomingTiers,
    }
  }, [gpDollars, gpPercent, tiers])

  const fmt = (n) => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })

  return (
    <div className="incentives-page">
      <div className="incentives-header">
        <button className="back-button" onClick={() => navigate('/')}>Home</button>
        <h1>Incentive Calculator</h1>
      </div>

      <div className="incentives-input-card">
        <div className="incentives-row">
          <label>Month Type</label>
          <div className="month-toggle">
            <button
              className={monthType === '4week' ? 'active' : ''}
              onClick={() => setMonthType('4week')}
            >
              4-Week (Other)
            </button>
            <button
              className={monthType === '5week' ? 'active' : ''}
              onClick={() => setMonthType('5week')}
            >
              5-Week (Feb/May/Aug/Nov)
            </button>
          </div>
        </div>

        <div className="incentives-row">
          <label htmlFor="gp-input">Your GP$</label>
          <div className="amount-input">
            <span className="dollar-sign">$</span>
            <input
              id="gp-input"
              type="number"
              placeholder="0"
              value={gpDollars}
              onChange={(e) => setGpDollars(e.target.value)}
            />
          </div>
        </div>

        <div className="incentives-row">
          <label htmlFor="gp-pct-input">Your GP%</label>
          <div className="amount-input">
            <input
              id="gp-pct-input"
              type="number"
              placeholder="0"
              step="0.1"
              value={gpPercent}
              onChange={(e) => setGpPercent(e.target.value)}
            />
            <span className="dollar-sign">%</span>
          </div>
        </div>
      </div>

      {parseFloat(gpDollars) > 0 && (
        <div className="incentives-result-card">
          <div className="result-tier-badge">Tier {result.currentTier}</div>
          <div className="result-details">
            <div className="result-line">
              <span>Commission Rate</span>
              <strong>{result.commission}%</strong>
            </div>
            <div className="result-line">
              <span>Base Incentive</span>
              <strong>{fmt(result.baseIncentive)}</strong>
            </div>
            {parseFloat(gpPercent) > 0 && (
              <>
                <div className="result-line">
                  <span>Accelerator/Decelerator</span>
                  <strong>{result.accelerator}%</strong>
                </div>
                <div className="result-line highlight">
                  <span>Adjusted Incentive</span>
                  <strong>{fmt(result.adjustedIncentive)}</strong>
                </div>
              </>
            )}
          </div>

          {result.upcomingTiers.length > 0 ? (
            <div className="upcoming-tiers">
              <h3>Potential Commission at Next Tiers</h3>
              {result.upcomingTiers.map((ut) => (
                <div className="upcoming-tier-row" key={ut.tier}>
                  <div className="upcoming-tier-header">
                    <span className="upcoming-tier-name">Tier {ut.tier}</span>
                    <span className="upcoming-tier-rate">{ut.commission}%</span>
                  </div>
                  <div className="upcoming-tier-details">
                    <span className="upcoming-gp-needed">{fmt(ut.gpNeeded)} more needed</span>
                    <span className="upcoming-potential">
                      {parseFloat(gpPercent) > 0
                        ? fmt(ut.potentialAdjusted)
                        : fmt(ut.potentialIncentive)
                      } potential
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="next-tier-box max-tier">
              <p className="next-tier-label">You are at the highest tier!</p>
            </div>
          )}
        </div>
      )}

      <div className="incentives-table-card">
        <h2>{monthType === '4week' ? '4-Week Month' : '5-Week Month'} Tiers</h2>
        <div className="payment-table-wrapper">
          <table className="payment-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>GP$ Benchmark</th>
                <th>Commission %</th>
                <th>Approx Incentive</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr
                  key={t.tier}
                  className={t.tier === result.currentTier && parseFloat(gpDollars) > 0 ? 'active-tier-row' : ''}
                >
                  <td>Tier {t.tier}</td>
                  <td>{fmt(t.benchmark)}</td>
                  <td>{t.commission.toFixed(2)}%</td>
                  <td>{fmt(t.incentive)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="incentives-table-card">
        <h2>GP% Accelerator / Decelerator</h2>
        <div className="payment-table-wrapper">
          <table className="payment-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>GP% Range</th>
                <th>Accelerator/Decelerator</th>
              </tr>
            </thead>
            <tbody>
              {gpPercentTiers.map((t) => (
                <tr
                  key={t.tier}
                  className={
                    parseFloat(gpPercent) > 0 &&
                    t.accelerator === result.accelerator
                      ? 'active-tier-row'
                      : ''
                  }
                >
                  <td>Tier {t.tier}</td>
                  <td>{t.gpRange > 0 ? t.gpRange.toFixed(2) + '%' : '0%'}</td>
                  <td>{t.accelerator}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default IncentivesPage
