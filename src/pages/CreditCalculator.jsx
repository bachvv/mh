import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { provinces, flexitiTerms, mhcTerms } from '../data/taxRates'
import PaymentTable from '../components/PaymentTable'
import BalanceChart from '../components/BalanceChart'

function CreditCalculator() {
  const navigate = useNavigate()
  const [province, setProvince] = useState('BC')
  const [items, setItems] = useState([
    { name: 'Item 1', amount: '' },
    { name: 'Item 2', amount: '' },
    { name: 'Item 3', amount: '' },
  ])

  const taxRate = provinces.find((p) => p.code === province)?.rate || 0.12

  const handleItemChange = (index, field, value) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    setItems(updated)
  }

  const addItem = () => {
    setItems([...items, { name: `Item ${items.length + 1}`, amount: '' }])
  }

  const removeItem = (index) => {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const cumulativeRows = useMemo(() => {
    const rows = []
    let runningTotal = 0
    for (let i = 0; i < items.length; i++) {
      const amt = parseFloat(items[i].amount) || 0
      runningTotal += amt
      if (runningTotal > 0) {
        const label =
          i === 0
            ? items[0].name || 'Item 1'
            : items
                .slice(0, i + 1)
                .map((it, idx) => it.name || `Item ${idx + 1}`)
                .join(' + ')
        rows.push({ label, subtotal: runningTotal })
      }
    }
    return rows
  }, [items])

  const totalBeforeTax = cumulativeRows.length > 0 ? cumulativeRows[cumulativeRows.length - 1].subtotal : 0
  const totalWithTax = totalBeforeTax * (1 + taxRate)

  const longestPlan = useMemo(() => {
    if (totalWithTax <= 0) return null
    const allTerms = [
      ...flexitiTerms.map((t) => ({ ...t, type: 'Flexiti' })),
      ...mhcTerms.map((t) => ({ ...t, type: 'MHC' })),
    ]
    const eligible = allTerms.filter((t) => totalWithTax >= t.minAmount)
    if (eligible.length === 0) return null
    const best = eligible.reduce((a, b) => (b.months > a.months ? b : a))
    const annualFeeTotal = (best.annualFee || 0) * Math.ceil(best.months / 12)
    const monthly = (totalWithTax + best.adminFee + annualFeeTotal) / best.months
    return { ...best, monthly }
  }, [totalWithTax])

  return (
    <div className="calculator-page">
      <div className="calc-header">
        <button className="back-button" onClick={() => navigate('/')}>
          &larr; Back to Home
        </button>
        <h1>Credit Payment Calculator</h1>
        {longestPlan && (
          <div className="longest-plan-block">
            <span className="longest-plan-label">Lowest Monthly</span>
            <span className="longest-plan-amount">${longestPlan.monthly.toFixed(2)}</span>
            <span className="longest-plan-detail">{longestPlan.months} mo &middot; {longestPlan.type}</span>
          </div>
        )}
      </div>

      <div className="input-section">
        <div className="province-selector">
          <label htmlFor="province">Province:</label>
          <select id="province" value={province} onChange={(e) => setProvince(e.target.value)}>
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} ({(p.rate * 100).toFixed(p.rate * 100 % 1 === 0 ? 0 : 3)}%)
              </option>
            ))}
          </select>
        </div>

        <div className="items-section">
          <h3>Enter Item Amounts (before tax)</h3>
          {items.map((item, index) => (
            <div key={index} className="item-row">
              <input
                type="text"
                className="item-name"
                value={item.name}
                onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                placeholder={`Item ${index + 1}`}
              />
              <div className="amount-input">
                <span className="dollar-sign">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.amount}
                  onChange={(e) => handleItemChange(index, 'amount', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              {items.length > 1 && (
                <button className="remove-btn" onClick={() => removeItem(index)} title="Remove item">
                  &times;
                </button>
              )}
            </div>
          ))}
          <button className="add-btn" onClick={addItem}>
            + Add Item
          </button>
        </div>

        {totalBeforeTax > 0 && (
          <div className="totals-summary">
            <p>Subtotal: <strong>${totalBeforeTax.toFixed(2)}</strong></p>
            <p>Tax ({(taxRate * 100).toFixed(taxRate * 100 % 1 === 0 ? 0 : 3)}%): <strong>${(totalBeforeTax * taxRate).toFixed(2)}</strong></p>
            <p>Total (incl. tax): <strong>${totalWithTax.toFixed(2)}</strong></p>
          </div>
        )}
      </div>

      {cumulativeRows.length > 0 && (
        <div className="tables-section">
          <section className="table-section">
            <h2>Flexiti Financing</h2>
            <PaymentTable
              rows={cumulativeRows}
              terms={flexitiTerms}
              taxRate={taxRate}
              type="flexiti"
            />
            <BalanceChart
              totalWithTax={totalWithTax}
              terms={flexitiTerms}
              adminFees={true}
              label="Flexiti"
              colorScheme="blue"
            />
          </section>

          <section className="table-section">
            <h2>MHC Financing</h2>
            <PaymentTable
              rows={cumulativeRows}
              terms={mhcTerms}
              taxRate={taxRate}
              type="mhc"
            />
            <BalanceChart
              totalWithTax={totalWithTax}
              terms={mhcTerms}
              adminFees={false}
              label="MHC"
              colorScheme="green"
            />
          </section>
        </div>
      )}
    </div>
  )
}

export default CreditCalculator
