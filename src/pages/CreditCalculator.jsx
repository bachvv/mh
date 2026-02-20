import { useState, useMemo, useEffect } from 'react'
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
  const [downPaymentInput, setDownPaymentInput] = useState('')
  const [is20Percent, setIs20Percent] = useState(false)

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

  useEffect(() => {
    setDownPaymentInput('')
    setIs20Percent(false)
  }, [totalWithTax])

  const defaultDownPayment = totalWithTax * 0.20
  const downPayment = parseFloat(downPaymentInput) || 0
  const creditAmount = Math.max(0, totalWithTax - downPayment)

  const longestFlexiti = useMemo(() => {
    if (creditAmount <= 0) return null
    const eligible = flexitiTerms.filter((t) => creditAmount >= t.minAmount)
    if (eligible.length === 0) return null
    const best = eligible.reduce((a, b) => (b.months > a.months ? b : a))
    const monthly = (creditAmount + best.adminFee) / best.months
    return { ...best, monthly }
  }, [creditAmount])

  const longestMhc = useMemo(() => {
    if (creditAmount <= 0) return null
    const eligible = mhcTerms.filter((t) => creditAmount >= t.minAmount)
    if (eligible.length === 0) return null
    const best = eligible.reduce((a, b) => (b.months > a.months ? b : a))
    const annualFeeTotal = (best.annualFee || 0) * Math.ceil(best.months / 12)
    const monthly = (creditAmount + annualFeeTotal) / best.months
    return { ...best, monthly }
  }, [creditAmount])

  return (
    <div className="calculator-page">
      <div className="calc-header">
        <button className="back-button" onClick={() => navigate('/')}>
          &larr; Back to Home
        </button>
        <h1>Credit Payment Calculator</h1>
      </div>

      <div className="input-section-wrapper">
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
            <div className="down-payment-row">
              <span className="down-payment-label-text">Down Payment:</span>
              <div className="amount-input down-payment-input">
                <span className="dollar-sign">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={downPaymentInput}
                  onChange={(e) => {
                    setDownPaymentInput(e.target.value)
                    setIs20Percent(false)
                  }}
                  placeholder="0.00"
                />
              </div>
              <label className="down-payment-label">
                <input
                  type="checkbox"
                  checked={is20Percent}
                  onChange={(e) => {
                    setIs20Percent(e.target.checked)
                    setDownPaymentInput(e.target.checked ? defaultDownPayment.toFixed(2) : '')
                  }}
                />
                20%
              </label>
            </div>
            {downPayment > 0 && (
              <p className="credit-amount-line">Credit Amount: <strong>${creditAmount.toFixed(2)}</strong></p>
            )}
          </div>
        )}
        </div>

        {(longestFlexiti || longestMhc) && (
          <div className="longest-plan-blocks">
            {longestFlexiti && (
              <div className="longest-plan-block">
                <span className="longest-plan-label">Flexiti</span>
                <span className="longest-plan-amount">${longestFlexiti.monthly.toFixed(2)}</span>
                <span className="longest-plan-detail">{longestFlexiti.months} mo</span>
              </div>
            )}
            {longestMhc && (
              <div className="longest-plan-block longest-plan-block--mhc">
                <span className="longest-plan-label">MHC</span>
                <span className="longest-plan-amount">${longestMhc.monthly.toFixed(2)}</span>
                <span className="longest-plan-detail">{longestMhc.months} mo</span>
              </div>
            )}
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
              downPayment={downPayment}
            />
            <BalanceChart
              totalWithTax={totalWithTax}
              terms={flexitiTerms}
              adminFees={true}
              label="Flexiti"
              colorScheme="blue"
              downPayment={downPayment}
            />
          </section>

          <section className="table-section">
            <h2>MHC Financing</h2>
            <PaymentTable
              rows={cumulativeRows}
              terms={mhcTerms}
              taxRate={taxRate}
              type="mhc"
              downPayment={downPayment}
            />
            <BalanceChart
              totalWithTax={totalWithTax}
              terms={mhcTerms}
              adminFees={false}
              label="MHC"
              colorScheme="green"
              downPayment={downPayment}
            />
          </section>
        </div>
      )}
    </div>
  )
}

export default CreditCalculator
