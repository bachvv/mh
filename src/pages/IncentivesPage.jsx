import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fourWeekTiers,
  fiveWeekTiers,
  gpPercentTiers,
  dfoFourWeekTiers,
  dfoFiveWeekTiers,
  dfoGpPercentTiers,
} from '../data/incentiveTiers'

function IncentivesPage() {
  const navigate = useNavigate()
  const currentMonth = new Date().getMonth() // 0-indexed
  const isFiveWeek = [1, 4, 7, 10].includes(currentMonth) // Feb, May, Aug, Nov
  const [monthType, setMonthType] = useState(isFiveWeek ? '5week' : '4week')
  const [inputMode, setInputMode] = useState('sales') // 'gp' | 'sales'
  const [gpDollars, setGpDollars] = useState('')
  const [salesDollars, setSalesDollars] = useState('')
  const [gpPercent, setGpPercent] = useState('')
  const [storeStatus, setStoreStatus] = useState('red')
  const [isDfo, setIsDfo] = useState(false)

  const tiers = isDfo
    ? (monthType === '4week' ? dfoFourWeekTiers : dfoFiveWeekTiers)
    : (monthType === '4week' ? fourWeekTiers : fiveWeekTiers)

  const gpTiers = isDfo ? dfoGpPercentTiers : gpPercentTiers

  const result = useMemo(() => {
    const gpPct = parseFloat(gpPercent) || 0
    const gp = inputMode === 'sales'
      ? (parseFloat(salesDollars) || 0) * (gpPct / 100)
      : parseFloat(gpDollars) || 0

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

    // Find GP% qualifier tier
    let gpPctTierIndex = 0
    for (let i = gpTiers.length - 1; i >= 0; i--) {
      if (gpPct >= gpTiers[i].gpRange) {
        gpPctTierIndex = i
        break
      }
    }
    const accelerator = gpTiers[gpPctTierIndex].accelerator

    // GP% is now a binary qualifier: meet threshold = 100%, below = 0%
    const gpEntered = gpPct > 0
    const gpQualified = gpEntered && accelerator > 0

    // Calculate incentive
    const baseIncentive = gp * (currentTier.commission / 100)

    // When GP% entered: qualified = full incentive, not qualified = 0
    // When GP% not entered: show base as estimate
    const effectiveBase = gpEntered
      ? (gpQualified ? baseIncentive : 0)
      : baseIncentive

    // Store status bonus
    const storeBonus = storeStatus === 'pearl' ? 1.10 : storeStatus === 'gold' ? 1.15 : 1.0
    const storeBonusPct = storeStatus === 'pearl' ? 10 : storeStatus === 'gold' ? 15 : 0
    const finalIncentive = effectiveBase * storeBonus

    // Build upcoming tiers with potential commission info
    const upcomingTiers = tiers.slice(currentTierIndex + 1).map((t) => {
      const needed = t.benchmark - gp
      const potentialIncentive = t.benchmark * (t.commission / 100)
      // With all accelerators = 100%, potential is same as base when qualified
      const potentialEffective = gpEntered
        ? (gpQualified ? potentialIncentive : 0)
        : potentialIncentive
      const potentialFinal = potentialEffective * storeBonus
      const salesNeeded = gpPct > 0 ? needed / (gpPct / 100) : null
      return {
        tier: t.tier,
        commission: t.commission,
        benchmark: t.benchmark,
        gpNeeded: needed,
        salesNeeded,
        potentialIncentive,
        potentialEffective,
        potentialFinal,
      }
    })

    return {
      currentTier: currentTier.tier,
      currentTierIndex,
      commission: currentTier.commission,
      baseIncentive,
      gpEntered,
      gpQualified,
      accelerator,
      gpPctTier: gpPctTierIndex,
      effectiveBase,
      storeBonus,
      storeBonusPct,
      finalIncentive,
      nextTier: nextTier ? nextTier.tier : null,
      gpNeeded,
      nextCommission: nextTier ? nextTier.commission : null,
      upcomingTiers,
    }
  }, [gpDollars, salesDollars, gpPercent, inputMode, tiers, gpTiers, storeStatus])

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
          <label>Input Mode</label>
          <div className="month-toggle">
            <button
              className={inputMode === 'sales' ? 'active' : ''}
              onClick={() => setInputMode('sales')}
            >
              Enter Sales$
            </button>
            <button
              className={inputMode === 'gp' ? 'active' : ''}
              onClick={() => setInputMode('gp')}
            >
              Enter GP$
            </button>
          </div>
        </div>

        {inputMode === 'gp' ? (
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
        ) : (
          <div className="incentives-row">
            <label htmlFor="sales-input">Your Sales$</label>
            <div className="amount-input">
              <span className="dollar-sign">$</span>
              <input
                id="sales-input"
                type="number"
                placeholder="0"
                value={salesDollars}
                onChange={(e) => setSalesDollars(e.target.value)}
              />
            </div>
          </div>
        )}

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

        <div className="incentives-row">
          <label>Store Status</label>
          <div className="store-status-toggle">
            <button
              className={`store-btn store-btn--red${storeStatus === 'red' ? ' active' : ''}`}
              onClick={() => setStoreStatus('red')}
            >
              Red
            </button>
            <button
              className={`store-btn store-btn--pearl${storeStatus === 'pearl' ? ' active' : ''}`}
              onClick={() => setStoreStatus('pearl')}
            >
              Pearl +10%
            </button>
            <button
              className={`store-btn store-btn--gold${storeStatus === 'gold' ? ' active' : ''}`}
              onClick={() => setStoreStatus('gold')}
            >
              Gold +15%
            </button>
          </div>
        </div>

        <div className="incentives-row">
          <label>Store Type</label>
          <label className="dfo-checkbox-label">
            <input
              type="checkbox"
              className="dfo-checkbox"
              checked={isDfo}
              onChange={(e) => setIsDfo(e.target.checked)}
            />
            <span className={`dfo-badge${isDfo ? ' dfo-badge--active' : ''}`}>DFO Outlet</span>
          </label>
        </div>

        {inputMode === 'sales' && parseFloat(salesDollars) > 0 && parseFloat(gpPercent) > 0 && (
          <div className="incentives-row">
            <label>Computed GP$</label>
            <div className="amount-input amount-input--readonly">
              <span className="dollar-sign">$</span>
              <span className="computed-value">
                {((parseFloat(salesDollars) || 0) * (parseFloat(gpPercent) || 0) / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}
      </div>

      {result.baseIncentive > 0 && (
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
            {result.gpEntered && (
              <div className={`result-line gp-qualifier-line${result.gpQualified ? ' gp-qualified' : ' gp-not-qualified'}`}>
                <span>GP% Qualifier</span>
                <strong>{result.gpQualified ? 'Met ✓' : 'Not Met ✗'}</strong>
              </div>
            )}
            {result.gpEntered && !result.gpQualified && (
              <div className="result-line highlight">
                <span>Effective Incentive</span>
                <strong>$0.00</strong>
              </div>
            )}
            {storeStatus !== 'red' && result.effectiveBase > 0 && (
              <>
                <div className="result-line">
                  <span>Store Bonus (+{result.storeBonusPct}%)</span>
                  <strong className={`store-bonus-amount store-bonus-${storeStatus}`}>
                    +{fmt(result.effectiveBase * (result.storeBonus - 1))}
                  </strong>
                </div>
                <div className={`result-line highlight highlight--${storeStatus}`}>
                  <span>Final Incentive</span>
                  <strong>{fmt(result.finalIncentive)}</strong>
                </div>
              </>
            )}
            {(storeStatus === 'red' || result.effectiveBase === 0) && result.gpEntered && result.gpQualified && (
              <div className="result-line highlight">
                <span>Final Incentive</span>
                <strong>{fmt(result.finalIncentive)}</strong>
              </div>
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
                    <span className="upcoming-gp-needed">
                      {inputMode === 'sales' && ut.salesNeeded != null
                        ? `${fmt(ut.salesNeeded)} sales more needed`
                        : `${fmt(ut.gpNeeded)} GP$ needed`}
                    </span>
                    <span className="upcoming-potential">
                      {fmt(storeStatus !== 'red' ? ut.potentialFinal : ut.potentialEffective)} potential
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
        <h2>
          {monthType === '4week' ? '4-Week' : '5-Week'} Tiers
          {isDfo && <span className="dfo-table-badge">DFO Outlet</span>}
        </h2>
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
                  className={t.tier === result.currentTier && result.baseIncentive > 0 ? 'active-tier-row' : ''}
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
        <h2>
          GP% Qualifier
          {isDfo && <span className="dfo-table-badge">DFO Outlet</span>}
        </h2>
        <p className="gp-qualifier-note">
          Meet the minimum GP% threshold to earn your commission at 100%. Below the minimum, no incentive is paid.
        </p>
        <div className="payment-table-wrapper">
          <table className="payment-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Min. GP% Required</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {gpTiers.map((t) => (
                <tr
                  key={t.tier}
                  className={
                    parseFloat(gpPercent) > 0 && t.tier === result.gpPctTier
                      ? 'active-tier-row'
                      : ''
                  }
                >
                  <td>Tier {t.tier}</td>
                  <td>{t.gpRange > 0 ? t.gpRange.toFixed(1) + '%' : '—'}</td>
                  <td>{t.accelerator > 0 ? 'Qualifies ✓' : 'No incentive'}</td>
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
