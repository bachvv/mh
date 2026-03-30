import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function RepairsPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [orders, setOrders] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setOrders(null)
    try {
      const res = await fetch('/api/repairs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setOrders(data.orders || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dev-page">
      <div className="dev-header">
        <button className="back-button" onClick={() => navigate('/dev')}>Back</button>
        <h1>Repairs</h1>
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', margin: '20px 0' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by job number..."
          style={{
            flex: 1, padding: '10px 14px', fontSize: '16px',
            border: '1px solid #ccc', borderRadius: '8px',
          }}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          style={{
            padding: '10px 24px', fontSize: '16px', borderRadius: '8px',
            background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer',
            opacity: loading || !query.trim() ? 0.5 : 1,
          }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {loading && (
        <p style={{ color: '#666', fontStyle: 'italic' }}>
          Searching vendor site... this may take 5-15 seconds.
        </p>
      )}

      {error && <p style={{ color: '#e11d48', fontWeight: 500 }}>{error}</p>}

      {orders && orders.length === 0 && (
        <p style={{ color: '#666' }}>No results found.</p>
      )}

      {orders && orders.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse', marginTop: '12px',
            fontSize: '14px',
          }}>
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                <th style={thStyle}>Job #</th>
                <th style={thStyle}>Date In</th>
                <th style={thStyle}>Due in Store</th>
                <th style={thStyle}>Estimate Date</th>
                <th style={thStyle}>Invoice Date</th>
                <th style={thStyle}>Last User</th>
                <th style={thStyle}>Tracking #</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={tdStyle}>{o.jobNumber}</td>
                  <td style={tdStyle}>{o.dateIn}</td>
                  <td style={tdStyle}>{o.dueInStore}</td>
                  <td style={tdStyle}>{o.estimateDate}</td>
                  <td style={tdStyle}>{o.invoiceDate}</td>
                  <td style={tdStyle}>{o.lastUser}</td>
                  <td style={tdStyle}>{o.tracking}</td>
                  <td style={tdStyle}>{o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: '#888', fontSize: '12px', marginTop: '8px' }}>{orders.length} results</p>
        </div>
      )}
    </div>
  )
}

const thStyle = { padding: '10px 12px', fontWeight: 600, borderBottom: '2px solid #cbd5e1', whiteSpace: 'nowrap' }
const tdStyle = { padding: '10px 12px', whiteSpace: 'nowrap' }

export default RepairsPage
