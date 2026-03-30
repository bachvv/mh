import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useEffect, useState } from 'react'

function AccessLogPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('geo')
  const [days, setDays] = useState(1)

  useEffect(() => {
    if (!isAdmin) { navigate('/', { replace: true }); return }
    fetch('/api/access-log')
      .then(r => r.json())
      .then(data => { setLog(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [isAdmin, navigate])

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString()
  const filtered = log.filter(e => e.ts && e.ts >= cutoffStr)

  // Group by city
  const geoGroups = {}
  for (const entry of filtered) {
    const loc = entry.geo
      ? `${entry.geo.city}, ${entry.geo.region}`
      : entry.ip === '127.0.0.1' || entry.ip === '::1' ? 'Localhost' : `Unknown (${entry.ip || '?'})`
    if (!geoGroups[loc]) geoGroups[loc] = { count: 0, ips: new Set(), country: entry.geo?.country || '' }
    geoGroups[loc].count++
    if (entry.ip) geoGroups[loc].ips.add(entry.ip)
  }

  const geoSorted = Object.entries(geoGroups)
    .map(([loc, d]) => ({ loc, count: d.count, visitors: d.ips.size, country: d.country }))
    .sort((a, b) => b.count - a.count)

  const rawEntries = [...filtered].reverse()
  const uniqueIPs = new Set(filtered.map(e => e.ip)).size

  const btnStyle = (active) => ({
    padding: '0.4rem 1rem',
    fontSize: '0.85rem',
    opacity: active ? 1 : 0.5,
  })

  return (
    <div className="dev-page">
      <div className="dev-header">
        <button className="back-button" onClick={() => navigate('/admin')}>Back</button>
        <h1>Access Log</h1>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {[1, 7, 30].map(d => (
          <button
            key={d}
            className="dev-link-btn"
            style={btnStyle(days === d)}
            onClick={() => setDays(d)}
          >
            {d === 1 ? 'Today' : `${d}D`}
          </button>
        ))}
        <span style={{ width: '1px', background: '#333', margin: '0 0.25rem' }} />
        <button className="dev-link-btn" style={btnStyle(view === 'geo')} onClick={() => setView('geo')}>
          By Location
        </button>
        <button className="dev-link-btn" style={btnStyle(view === 'raw')} onClick={() => setView('raw')}>
          Raw Log
        </button>
      </div>

      <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 1rem' }}>
        {filtered.length} visits from {uniqueIPs} unique IPs
      </p>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#999' }}>Loading...</p>
      ) : view === 'geo' ? (
        geoSorted.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>No visits</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #333', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Location</th>
                  <th style={{ padding: '0.5rem' }}>Country</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Visits</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Unique IPs</th>
                </tr>
              </thead>
              <tbody>
                {geoSorted.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #222' }}>
                    <td style={{ padding: '0.4rem 0.5rem' }}>{row.loc}</td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>{row.country}</td>
                    <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>{row.count}</td>
                    <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>{row.visitors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        rawEntries.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>No visits</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #333', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Time</th>
                  <th style={{ padding: '0.5rem' }}>Page</th>
                  <th style={{ padding: '0.5rem' }}>Location</th>
                  <th style={{ padding: '0.5rem' }}>IP</th>
                </tr>
              </thead>
              <tbody>
                {rawEntries.map((entry, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #222' }}>
                    <td style={{ padding: '0.4rem 0.5rem', whiteSpace: 'nowrap' }}>
                      {entry.ts ? new Date(entry.ts).toLocaleString() : '-'}
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>{entry.path || '-'}</td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>
                      {entry.geo ? `${entry.geo.city}, ${entry.geo.region}` : '-'}
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {entry.ip || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}

export default AccessLogPage
