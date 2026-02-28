import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const PRODUCT_TYPES = ['wedders', 'chains', 'rings', 'tennis', 'bangles', 'pendants']

function findLocalSkus() {
  const found = {}
  for (const type of PRODUCT_TYPES) {
    const key = `${type}-skus`
    try {
      const data = JSON.parse(localStorage.getItem(key))
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        found[type] = data
      }
    } catch {}
  }
  return found
}

export default function MigrateSkusPage() {
  const navigate = useNavigate()
  const [localData] = useState(() => findLocalSkus())
  const [status, setStatus] = useState({}) // { type: 'success' | 'error' | 'pending' }
  const [done, setDone] = useState(false)

  const types = Object.keys(localData)

  async function handleTransferAll() {
    const results = {}
    for (const type of types) {
      results[type] = 'pending'
      setStatus({ ...results })
      try {
        const res = await fetch(`/api/product-skus/${type}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localData[type]),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        results[type] = 'success'
        localStorage.removeItem(`${type}-skus`)
      } catch {
        results[type] = 'error'
      }
      setStatus({ ...results })
    }
    setDone(true)
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui' }}>
      <button onClick={() => navigate('/')} style={{ marginBottom: 20, cursor: 'pointer' }}>&larr; Home</button>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Migrate Blue Tag SKUs</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Transfer SKU data from browser storage to the server so it persists across devices.
      </p>

      {types.length === 0 ? (
        <p style={{ color: '#888' }}>No SKU data found in browser storage. Nothing to migrate.</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px' }}>Product</th>
                <th style={{ padding: '8px 12px' }}>SKUs</th>
                <th style={{ padding: '8px 12px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {types.map((type) => (
                <tr key={type} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px 12px', textTransform: 'capitalize' }}>{type}</td>
                  <td style={{ padding: '8px 12px' }}>{Object.keys(localData[type]).length}</td>
                  <td style={{ padding: '8px 12px' }}>
                    {status[type] === 'success' && <span style={{ color: 'green' }}>Transferred</span>}
                    {status[type] === 'error' && <span style={{ color: 'red' }}>Failed</span>}
                    {status[type] === 'pending' && <span style={{ color: '#999' }}>Transferring...</span>}
                    {!status[type] && <span style={{ color: '#999' }}>Pending</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!done && (
            <button
              onClick={handleTransferAll}
              style={{
                padding: '10px 24px', background: '#2563eb', color: '#fff',
                border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 16,
              }}
            >
              Transfer All to Server
            </button>
          )}
          {done && <p style={{ color: 'green', fontWeight: 600 }}>Migration complete.</p>}
        </>
      )}
    </div>
  )
}
