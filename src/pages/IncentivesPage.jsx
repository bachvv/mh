import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fourWeekTiers,
  fiveWeekTiers,
  gpPercentTiers,
  dfoFourWeekTiers,
  dfoFiveWeekTiers,
  dfoGpPercentTiers,
  may2026LrmGpPercentTiers,
} from '../data/incentiveTiers'

function IncentivesPage() {
  const navigate = useNavigate()
  const now = new Date()
  const currentMonth = now.getMonth() // 0-indexed
  const currentYear = now.getFullYear()
  const isMay2026 = currentMonth === 4 && currentYear === 2026
  const isFiveWeek = [1, 4, 7, 10].includes(currentMonth) // Feb, May, Aug, Nov
  const [monthType, setMonthType] = useState(isFiveWeek ? '5week' : '4week')
  const [inputMode, setInputMode] = useState('sales') // 'gp' | 'sales'
  const [gpDollars, setGpDollars] = useState('')
  const [salesDollars, setSalesDollars] = useState('')
  const [gpPercent, setGpPercent] = useState('')
  const [storeStatus, setStoreStatus] = useState('red')
  const [isDfo, setIsDfo] = useState(false)
  const [useMay2026Rules, setUseMay2026Rules] = useState(isMay2026)

  const tiers = isDfo
    ? (monthType === '4week' ? dfoFourWeekTiers : dfoFiveWeekTiers)
    : (monthType === '4week' ? fourWeekTiers : fiveWeekTiers)

  const gpTiers = isDfo
    ? dfoGpPercentTiers
    : (useMay2026Rules ? may2026LrmGpPercentTiers : gpPercentTiers)

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

    const gpEntered = gpPct > 0
    const gpQualified = gpEntered && accelerator > 0

    // Calculate incentive
    const baseIncentive = gp * (currentTier.commission / 100)

    // accelerator is a % multiplier: 0 = no incentive, 100 = full, 101+ = boosted
    const effectiveBase = gpEntered
      ? baseIncentive * (accelerator / 100)
      : baseIncentive

    // Store status bonus
    const storeBonus = storeStatus === 'pearl' ? 1.10 : storeStatus === 'gold' ? 1.15 : 1.0
    const storeBonusPct = storeStatus === 'pearl' ? 10 : storeStatus === 'gold' ? 15 : 0
    const finalIncentive = effectiveBase * storeBonus

    // Build upcoming tiers with potential commission info
    const upcomingTiers = tiers.slice(currentTierIndex + 1).map((t) => {
      const needed = t.benchmark - gp
      const potentialIncentive = t.benchmark * (t.commission / 100)
      const potentialEffective = gpEntered
        ? potentialIncentive * (accelerator / 100)
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
        <h1>FY 26 Incentive Calculator</h1>
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

        {!isDfo && (
          <div className="incentives-row">
            <label>May 2026 LRM Rules</label>
            <label className="dfo-checkbox-label">
              <input
                type="checkbox"
                className="dfo-checkbox"
                checked={useMay2026Rules}
                onChange={(e) => setUseMay2026Rules(e.target.checked)}
              />
              <span className={`dfo-badge${useMay2026Rules ? ' dfo-badge--active' : ''}`}>
                {useMay2026Rules ? 'On' : 'Off'}
              </span>
            </label>
          </div>
        )}

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
                <strong>
                  {result.gpQualified
                    ? `${result.accelerator}% ✓`
                    : 'Not Met ✗'}
                </strong>
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
          FY 26 — {monthType === '4week' ? '4-Week' : '5-Week'} Tiers
          {isDfo && <span className="dfo-table-badge">DFO Outlet</span>}
          {!isDfo && useMay2026Rules && <span className="dfo-table-badge">May 2026 LRM</span>}
        </h2>
        <p className="gp-qualifier-note">
          {useMay2026Rules && !isDfo
            ? 'May 2026 LRM rules: GP% determines your accelerator multiplier. Below Tier 1 minimum, no incentive is paid.'
            : 'Meet the minimum GP% threshold for your tier to earn commission at 100%. Below the minimum, no incentive is paid.'}
        </p>
        <div className="payment-table-wrapper">
          <table className="payment-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>GP$</th>
                <th>Comm%</th>
                <th>Amount</th>
                <th>GP%</th>
                <th>Acc%</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t, i) => {
                const gp = gpTiers[i] || { gpRange: 0, accelerator: 0 }
                const isActiveTier = t.tier === result.currentTier && result.baseIncentive > 0
                const isActiveGpTier = parseFloat(gpPercent) > 0 && t.tier === result.gpPctTier
                return (
                  <tr
                    key={t.tier}
                    className={isActiveTier ? 'active-tier-row' : isActiveGpTier ? 'active-gp-row' : ''}
                  >
                    <td>Tier {t.tier}</td>
                    <td>{t.benchmark > 0 ? fmt(t.benchmark) : '—'}</td>
                    <td>{t.commission.toFixed(1)}%</td>
                    <td>{t.incentive > 0 ? fmt(t.incentive) : '—'}</td>
                    <td>{gp.gpRange > 0 ? gp.gpRange.toFixed(2) + '%' : '0.00%'}</td>
                    <td>{gp.accelerator > 0 ? `${gp.accelerator.toFixed(1)}%` : '0.0%'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default IncentivesPage
