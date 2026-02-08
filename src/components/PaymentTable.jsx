function PaymentTable({ rows, terms, taxRate, type }) {
  const calculateMonthly = (subtotal, term) => {
    const totalWithTax = subtotal * (1 + taxRate)
    if (totalWithTax < term.minAmount && term.minAmount > 0) {
      return null
    }
    const totalWithFees = totalWithTax + term.adminFee
    return totalWithFees / term.months
  }

  return (
    <div className="payment-table-wrapper">
      <table className="payment-table">
        <thead>
          <tr>
            <th>Items</th>
            <th>Subtotal (incl. tax)</th>
            {terms.map((t) => (
              <th key={t.months}>
                {t.months} mo
                {t.adminFee > 0 && (
                  <div className="admin-fee-note">+${t.adminFee} fee</div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const totalWithTax = row.subtotal * (1 + taxRate)
            return (
              <tr key={idx}>
                <td className="items-label">{row.label}</td>
                <td className="subtotal-cell">${totalWithTax.toFixed(2)}</td>
                {terms.map((t) => {
                  const monthly = calculateMonthly(row.subtotal, t)
                  return (
                    <td key={t.months} className={monthly === null ? 'below-min' : 'monthly-cell'}>
                      {monthly === null ? (
                        <span className="min-warning" title={`Minimum $${t.minAmount} required`}>
                          Min ${t.minAmount}
                        </span>
                      ) : (
                        `$${monthly.toFixed(2)}/mo`
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default PaymentTable
