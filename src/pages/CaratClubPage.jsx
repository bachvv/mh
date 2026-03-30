import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const API = '/api/carat-club'

function CaratClubPage() {
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const [store, setStore] = useState(() => localStorage.getItem('carat_club_store') || '104')
  const [spList, setSpList] = useState([])
  const [spName, setSpName] = useState(() => localStorage.getItem('carat_club_sp') || '')
  const [entries, setEntries] = useState([])
  const [day, setDay] = useState('')
  const [sku, setSku] = useState('')
  const [loading, setLoading] = useState(false)
  const [newSpName, setNewSpName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editSku, setEditSku] = useState('')
  const [editDay, setEditDay] = useState('')
  const [showAdmin, setShowAdmin] = useState(false)
  const [managers, setManagers] = useState({})
  const [managerEmail, setManagerEmail] = useState('')
  const [copiedField, setCopiedField] = useState(null)

  const copyText = (text, fieldId) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldId)
    setTimeout(() => setCopiedField(null), 1200)
  }

  const identified = spName.trim().length > 0
  const isStoreManager = user?.email && managers[store]?.toLowerCase() === user.email.toLowerCase()
  const canManageSPs = isAdmin || isStoreManager

  const fetchManagers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/managers`)
      const data = await res.json()
      setManagers(data.managers || {})
    } catch {}
  }, [])

  const fetchSpList = useCallback(async () => {
    try {
      const res = await fetch(`${API}/sps?store=${encodeURIComponent(store)}`)
      const data = await res.json()
      setSpList(data.sps || [])
    } catch {}
  }, [store])

  const fetchEntries = useCallback(async () => {
    if (!spName.trim()) return
    try {
      const res = await fetch(`${API}?sp=${encodeURIComponent(spName.trim())}&store=${encodeURIComponent(store)}`)
      const data = await res.json()
      setEntries(data.entries || [])
    } catch {}
  }, [spName, store])

  useEffect(() => { fetchManagers() }, [fetchManagers])

  useEffect(() => {
    localStorage.setItem('carat_club_store', store)
    fetchSpList()
  }, [store, fetchSpList])

  useEffect(() => {
    if (identified) {
      localStorage.setItem('carat_club_sp', spName.trim())
      fetchEntries()
    }
  }, [spName, identified, fetchEntries])

  const assignManager = async (e) => {
    e.preventDefault()
    if (!managerEmail.trim()) return
    await fetch(`${API}/managers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store, email: managerEmail.trim() })
    })
    setManagerEmail('')
    await fetchManagers()
  }

  const removeManager = async () => {
    await fetch(`${API}/managers`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store })
    })
    await fetchManagers()
  }

  const addSp = async (e) => {
    e.preventDefault()
    if (!newSpName.trim()) return
    await fetch(`${API}/sps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store, name: newSpName.trim() })
    })
    setNewSpName('')
    await fetchSpList()
  }

  const removeSp = async (name) => {
    if (!confirm(`Remove ${name} from store ${store}?`)) return
    await fetch(`${API}/sps`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store, name })
    })
    await fetchSpList()
  }

  const addEntry = async (e) => {
    e.preventDefault()
    if (!day || !sku.trim()) return
    setLoading(true)
    try {
      await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sp: spName.trim(), day, sku: sku.trim(), store })
      })
      setSku('')
      await fetchEntries()
    } catch {}
    setLoading(false)
  }

  const deleteEntry = async (id) => {
    await fetch(`${API}/${id}`, { method: 'DELETE' })
    await fetchEntries()
  }

  const deleteAll = async () => {
    if (!confirm(`Delete all entries for ${spName} at store ${store}?`)) return
    await fetch(`${API}/all?sp=${encodeURIComponent(spName.trim())}&store=${encodeURIComponent(store)}`, { method: 'DELETE' })
    setEntries([])
  }

  const startEdit = (entry) => {
    setEditingId(entry.id)
    setEditSku(entry.sku)
    setEditDay(entry.day)
  }

  const saveEdit = async (id) => {
    await fetch(`${API}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: editSku.trim(), day: editDay })
    })
    setEditingId(null)
    await fetchEntries()
  }

  const changeSP = () => {
    setSpName('')
    setEntries([])
    localStorage.removeItem('carat_club_sp')
  }

  return (
    <div className="carat-club-page">
      <div className="rotation-header">
        <button className="back-button" onClick={() => navigate('/dev')}>Dev</button>
        <h1>Carat Club</h1>
        <div style={{ width: 44 }} />
      </div>

      <div className="rotation-card" style={{ marginBottom: '1rem' }}>
        <div className="carat-form-row" style={{ alignItems: 'flex-end' }}>
          <div className="carat-field" style={{ flex: '0 0 90px' }}>
            <label>Store</label>
            <input type="text" className="rotation-input" value={store} onChange={(e) => { setStore(e.target.value); setSpName(''); setEntries([]) }} />
          </div>
          {managers[store] && (
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', marginBottom: '4px' }}>
              Mgr: {managers[store]}
            </span>
          )}
          {canManageSPs && (
            <button type="button" className="back-button" style={{ fontSize: '0.8rem', marginBottom: '2px', marginLeft: 'auto' }} onClick={() => setShowAdmin(!showAdmin)}>
              {showAdmin ? 'Hide' : 'Manage SPs'}
            </button>
          )}
        </div>

        {canManageSPs && showAdmin && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)' }}>
            {isAdmin && (
              <div style={{ marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border-light)' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-light)', display: 'block', marginBottom: '0.3rem' }}>Store Manager</label>
                {managers[store] ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{managers[store]}</span>
                    <button className="carat-delete-all" onClick={removeManager}>Remove</button>
                  </div>
                ) : (
                  <form onSubmit={assignManager} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="email" className="rotation-input" placeholder="manager@email.com" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} />
                    <button type="submit" className="rotate-btn">Assign</button>
                  </form>
                )}
              </div>
            )}
            <label style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-light)', display: 'block', marginBottom: '0.3rem' }}>Sales Professionals</label>
            <form onSubmit={addSp} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <input type="text" className="rotation-input" placeholder="SP name" value={newSpName} onChange={(e) => setNewSpName(e.target.value)} />
              <button type="submit" className="rotate-btn">Add</button>
            </form>
            {spList.length === 0 && <p style={{ color: 'var(--color-text-light)', fontSize: '0.85rem' }}>No SPs for store {store}</p>}
            {spList.map((sp) => (
              <div key={sp} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid var(--color-border-light)' }}>
                <span>{sp}</span>
                <button className="remove-btn" onClick={() => removeSp(sp)}>&times;</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {!identified ? (
        <div className="rotation-card" style={{ textAlign: 'center', padding: '2rem' }}>
          {spList.length === 0 ? (
            <p style={{ color: 'var(--color-text-light)' }}>
              No SPs configured for store {store}.
              {canManageSPs ? ' Use "Manage SPs" above.' : ' Ask your store manager to add SPs.'}
            </p>
          ) : (
            <>
              <p style={{ marginBottom: '1rem', color: 'var(--color-text-light)' }}>Select your name</p>
              <div className="carat-sp-grid">
                {spList.map((sp) => (
                  <button key={sp} className="carat-sp-btn" onClick={() => setSpName(sp)}>{sp}</button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="rotation-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{spName}</span>
            <button className="back-button" onClick={changeSP} style={{ fontSize: '0.8rem' }}>Switch</button>
          </div>

          <form onSubmit={addEntry} className="carat-form">
            <div className="carat-form-row">
              <div className="carat-field">
                <label>Date</label>
                <input type="date" className="rotation-input" value={day} onChange={(e) => setDay(e.target.value)} required />
              </div>
              <div className="carat-field">
                <label>SKU</label>
                <input type="text" className="rotation-input" placeholder="SKU number" value={sku} onChange={(e) => setSku(e.target.value)} required />
              </div>
              <button type="submit" className="rotate-btn" disabled={loading} style={{ alignSelf: 'flex-end', marginBottom: '1px' }}>
                {loading ? '...' : 'Add'}
              </button>
            </div>
          </form>

          {entries.length > 0 && (
            <>
              <div className="carat-list-header">
                <span style={{ color: 'var(--color-text-light)', fontSize: '0.85rem' }}>{entries.length} SKU{entries.length !== 1 ? 's' : ''}</span>
                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                  <button className="carat-copy-table-btn" onClick={() => { const text = entries.map((e, i) => `${i + 1}\t${e.day}\t${e.sku}`).join('\n'); copyText(text, 'table') }}>
                    {copiedField === 'table' ? '✓ Copied' : 'Copy Table'}
                  </button>
                  {isAdmin && <button className="carat-delete-all" onClick={deleteAll}>Delete All</button>}
                </div>
              </div>
              <div className="carat-list">
                {entries.map((entry, idx) => (
                  <div className="carat-entry" key={entry.id}>
                    {editingId === entry.id ? (
                      <>
                        <input type="date" className="rotation-input" value={editDay} onChange={(e) => setEditDay(e.target.value)} style={{ flex: '0 0 130px' }} />
                        <input type="text" className="rotation-input" value={editSku} onChange={(e) => setEditSku(e.target.value)} style={{ flex: 1 }} />
                        <button className="rotate-btn" style={{ padding: '0.3rem 0.6rem', height: 'auto', fontSize: '0.75rem' }} onClick={() => saveEdit(entry.id)}>Save</button>
                        <button className="remove-btn" onClick={() => setEditingId(null)}>&times;</button>
                      </>
                    ) : (
                      <>
                        <span className="carat-entry-num">{idx + 1}</span>
                        <span className="carat-entry-day">{entry.day}</span>
                        <button className="carat-copy-btn" onClick={() => copyText(entry.day, `day-${entry.id}`)}>{copiedField === `day-${entry.id}` ? '✓' : '⧉'}</button>
                        <span className="carat-entry-sku">{entry.sku}</span>
                        <button className="carat-copy-btn" onClick={() => copyText(entry.sku, `sku-${entry.id}`)}>{copiedField === `sku-${entry.id}` ? '✓' : '⧉'}</button>
                        {isAdmin && <button className="carat-edit-btn" onClick={() => startEdit(entry)}>Edit</button>}
                        {isAdmin && <button className="remove-btn" onClick={() => deleteEntry(entry.id)}>&times;</button>}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default CaratClubPage
