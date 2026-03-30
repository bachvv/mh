import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { RichTextEditor } from './SPProfilePage'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const TIME_OPTIONS = []
for (let h = 8; h < 20; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}

function SPSlugEditor({ pro, onSaved }) {
  const [slug, setSlug] = useState(pro.slug || '')
  const [status, setStatus] = useState(null)
  const timerRef = useRef(null)

  const handleChange = (val) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setSlug(clean)
    if (!clean || clean === pro.slug) { setStatus(null); return }
    setStatus('checking')
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/booking/slug-check/${clean}`)
        const data = await r.json()
        setStatus(data.available ? 'available' : 'taken')
      } catch { setStatus(null) }
    }, 400)
  }

  const save = async () => {
    if (!slug || slug === pro.slug || status === 'taken' || status === 'checking') return
    const res = await fetch(`/api/booking/professionals/${pro.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    })
    if (res.ok) { setStatus(null); onSaved() }
  }

  return (
    <div className="booking-card" style={{ marginBottom: '0.75rem' }}>
      <div className="booking-card-body">
        <p style={{ marginBottom: '0.5rem' }}><strong>{pro.name}</strong></p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <code style={{ whiteSpace: 'nowrap' }}>/booking/</code>
          <input
            type="text"
            className="booking-input"
            value={slug}
            onChange={e => handleChange(e.target.value)}
            placeholder="slug"
            style={{ flex: 1, margin: 0 }}
          />
          <button
            className="booking-btn booking-btn--submit booking-btn--small"
            onClick={save}
            disabled={!slug || slug === pro.slug || status === 'taken' || status === 'checking'}
          >
            Save
          </button>
        </div>
        {status === 'checking' && <p className="booking-hint">Checking...</p>}
        {status === 'available' && <p className="booking-hint" style={{ color: '#4c6335' }}>Available!</p>}
        {status === 'taken' && <p className="booking-hint" style={{ color: '#c0392b' }}>Already taken</p>}
      </div>
    </div>
  )
}

const DEFAULT_BOOKING_TYPES = ['Product Viewing', 'Consultation', 'Repairs', 'Custom Design', 'Inspection', 'Other']

function BookingTypesEditor({ pro, onSaved }) {
  const [types, setTypes] = useState(pro.bookingTypes?.length ? pro.bookingTypes : DEFAULT_BOOKING_TYPES)
  const [newType, setNewType] = useState('')
  const [saved, setSaved] = useState(false)

  const save = async (updated) => {
    setTypes(updated)
    await fetch(`/api/booking/professionals/${pro.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingTypes: updated }),
    })
    onSaved()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const addType = () => {
    const t = newType.trim()
    if (!t || types.includes(t)) return
    save([...types, t])
    setNewType('')
  }

  const removeType = (idx) => save(types.filter((_, i) => i !== idx))

  return (
    <div className="settings-section">
      <h4>Booking Types</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {types.map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ flex: 1 }}>{t}</span>
            <button className="booking-btn booking-btn--small booking-btn--decline" onClick={() => removeType(i)} style={{ padding: '2px 8px', fontSize: '11px' }}>Remove</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          className="booking-input"
          placeholder="Add new type..."
          value={newType}
          onChange={e => setNewType(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addType())}
          style={{ flex: 1, margin: 0 }}
        />
        <button className="booking-btn booking-btn--submit booking-btn--small" onClick={addType} disabled={!newType.trim()}>Add</button>
      </div>
      {saved && <p className="booking-hint" style={{ color: '#4c6335' }}>Saved!</p>}
      <p className="booking-hint">Types shown to customers when booking. Remove all to use defaults.</p>
    </div>
  )
}

function ReminderConfig() {
  const [config, setConfig] = useState({ enabled: true, hoursBefore: 24 })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/booking/reminder-config').then(r => r.json()).then(setConfig).catch(() => {})
  }, [])

  const save = async (updates) => {
    const next = { ...config, ...updates }
    setConfig(next)
    await fetch('/api/booking/reminder-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="settings-section">
      <h4>Appointment Reminders</h4>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={e => save({ enabled: e.target.checked })}
          />
          Send email reminders
        </label>
      </div>
      {config.enabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>Remind</span>
          <select
            className="booking-select"
            value={config.hoursBefore}
            onChange={e => save({ hoursBefore: parseInt(e.target.value) })}
            style={{ width: 'auto' }}
          >
            <option value={1}>1 hour</option>
            <option value={2}>2 hours</option>
            <option value={4}>4 hours</option>
            <option value={12}>12 hours</option>
            <option value={24}>1 day</option>
            <option value={48}>2 days</option>
          </select>
          <span>before appointment</span>
        </div>
      )}
      {saved && <p className="booking-hint" style={{ color: '#4c6335' }}>Saved!</p>}
      <p className="booking-hint">Sends reminder emails to customers with confirmed appointments.</p>
    </div>
  )
}

function BookingAdminPage() {
  const navigate = useNavigate()
  const { user, isAdmin, isManager, managedStoreIds, logout, renderButton } = useAuth()
  const googleBtnRef = useCallback((el) => {
    if (el) renderButton(el)
  }, [renderButton])

  const [tab, setTab] = useState('bookings')
  const [stores, setStores] = useState([])
  const [professionals, setProfessionals] = useState([])
  const [bookings, setBookings] = useState([])
  const [currentPro, setCurrentPro] = useState(null)
  const [availability, setAvailability] = useState([])

  // Store form
  const [newStoreName, setNewStoreName] = useState('')
  const [newStoreAddress, setNewStoreAddress] = useState('')

  // Professional form
  const [proName, setProName] = useState('')
  const [proEmail, setProEmail] = useState('')
  const [proPhone, setProPhone] = useState('')
  const [proStore, setProStore] = useState('')

  // Availability form
  const [availDay, setAvailDay] = useState(1)
  const [availSlots, setAvailSlots] = useState([{ start: '09:00', end: '10:00' }])

  // Personal time
  const [personalTime, setPersonalTime] = useState([])
  const [ptDate, setPtDate] = useState('')
  const [ptStart, setPtStart] = useState('09:00')
  const [ptEnd, setPtEnd] = useState('10:00')
  const [ptLabel, setPtLabel] = useState('')

  // Booking action
  const [actionBooking, setActionBooking] = useState(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [actionNote, setActionNote] = useState('')

  // Profile editing
  const [profileBio, setProfileBio] = useState('')
  const [profileTagline, setProfileTagline] = useState('')
  const [profileSpecialties, setProfileSpecialties] = useState('')
  const [profileNotifyEmail, setProfileNotifyEmail] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const profilePicRef = useRef(null)

  // Product images
  const [products, setProducts] = useState([])
  const [productTitle, setProductTitle] = useState('')
  const [productDesc, setProductDesc] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [productUploading, setProductUploading] = useState(false)
  const [productFile, setProductFile] = useState(null)
  const [productPreview, setProductPreview] = useState(null)
  const productFileRef = useRef(null)
  const [editingProduct, setEditingProduct] = useState(null)
  const [editProductTitle, setEditProductTitle] = useState('')
  const [editProductDesc, setEditProductDesc] = useState('')
  const [editProductPrice, setEditProductPrice] = useState('')

  // Messages
  const [conversations, setConversations] = useState([])
  const [selectedConvo, setSelectedConvo] = useState(null)
  const [convoMessages, setConvoMessages] = useState([])
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const messagesEndRef = useRef(null)

  const loadStores = useCallback(() => {
    fetch('/api/booking/stores').then(r => r.json()).then(setStores).catch(() => {})
  }, [])

  const loadProfessionals = useCallback(() => {
    fetch('/api/booking/professionals').then(r => r.json()).then(data => {
      setProfessionals(data)
      if (user && !currentPro) {
        const me = data.find(p => p.email === user.email)
        if (me) setCurrentPro(me)
      }
    }).catch(() => {})
  }, [user, currentPro])

  const loadBookings = useCallback(() => {
    const q = currentPro && !isAdmin && !isManager ? `?professionalId=${currentPro.id}` : ''
    fetch(`/api/booking/bookings${q}`).then(r => r.json()).then(data => {
      if (isManager && !isAdmin) {
        setBookings(data.filter(b => {
          const pro = professionals.find(p => p.id === b.professionalId)
          return pro && managedStoreIds.includes(pro.storeId)
        }))
      } else {
        setBookings(data)
      }
    }).catch(() => {})
  }, [currentPro, isAdmin, isManager, managedStoreIds, professionals])

  const loadAvailability = useCallback(() => {
    if (!currentPro) return
    fetch(`/api/booking/availability/${currentPro.id}`)
      .then(r => r.json())
      .then(setAvailability)
      .catch(() => {})
  }, [currentPro])

  const loadProducts = useCallback(() => {
    if (!currentPro) return
    fetch(`/api/booking/professionals/${currentPro.id}/products`)
      .then(r => r.json())
      .then(setProducts)
      .catch(() => {})
  }, [currentPro])

  const loadConversations = useCallback(() => {
    if (!currentPro) return
    fetch(`/api/booking/conversations/${currentPro.id}`)
      .then(r => r.json())
      .then(setConversations)
      .catch(() => {})
  }, [currentPro])

  useEffect(() => { loadStores(); loadProfessionals() }, [loadStores, loadProfessionals])
  useEffect(() => { loadBookings() }, [loadBookings])
  useEffect(() => { loadAvailability() }, [loadAvailability])
  useEffect(() => { loadProducts() }, [loadProducts])
  useEffect(() => { loadConversations() }, [loadConversations])

  // Load profile fields when currentPro changes
  useEffect(() => {
    if (currentPro) {
      setProfileBio(currentPro.bio || '')
      setProfileTagline(currentPro.tagline || '')
      setProfileSpecialties((currentPro.specialties || []).join(', '))
      setProfileNotifyEmail(currentPro.notifyEmail || '')
    }
  }, [currentPro])

  // Poll messages when a conversation is selected
  useEffect(() => {
    if (!selectedConvo) return
    const load = () => fetch(`/api/booking/messages/${selectedConvo.id}`).then(r => r.json()).then(setConvoMessages).catch(() => {})
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [selectedConvo])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [convoMessages])

  const addStore = async () => {
    if (!newStoreName.trim()) return
    await fetch('/api/booking/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newStoreName.trim(), address: newStoreAddress.trim() }),
    })
    setNewStoreName('')
    setNewStoreAddress('')
    loadStores()
  }

  const deleteStore = async (id) => {
    await fetch(`/api/booking/stores/${id}`, { method: 'DELETE' })
    loadStores()
  }

  const addProfessional = async () => {
    if (!proName.trim() || !proEmail.trim() || !proStore) return
    await fetch('/api/booking/professionals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: proName.trim(), email: proEmail.trim(), phone: proPhone.trim(), storeId: proStore }),
    })
    setProName('')
    setProEmail('')
    setProPhone('')
    setProStore('')
    loadProfessionals()
  }

  const deleteProfessional = async (id) => {
    await fetch(`/api/booking/professionals/${id}`, { method: 'DELETE' })
    loadProfessionals()
  }

  const addSlotRow = () => {
    const lastEnd = availSlots.length > 0 ? availSlots[availSlots.length - 1].end : '09:00'
    const [h, m] = lastEnd.split(':').map(Number)
    const newEnd = m + 60 >= 60 ? `${String(h + Math.floor((m + 60) / 60)).padStart(2, '0')}:${String((m + 60) % 60).padStart(2, '0')}` : `${String(h).padStart(2, '0')}:${String(m + 60).padStart(2, '0')}`
    setAvailSlots([...availSlots, { start: lastEnd, end: newEnd }])
  }

  const removeSlotRow = (idx) => {
    setAvailSlots(availSlots.filter((_, i) => i !== idx))
  }

  const updateSlot = (idx, field, val) => {
    const updated = [...availSlots]
    updated[idx] = { ...updated[idx], [field]: val }
    if (field === 'start') {
      const [h, m] = val.split(':').map(Number)
      const endM = m + 60
      updated[idx].end = `${String(h + Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
    }
    setAvailSlots(updated)
  }

  const saveAvailability = async () => {
    if (!currentPro) return
    await fetch('/api/booking/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ professionalId: currentPro.id, dayOfWeek: parseInt(availDay), slots: availSlots }),
    })
    loadAvailability()
  }

  const deleteAvailability = async (dayOfWeek) => {
    if (!currentPro) return
    await fetch('/api/booking/availability', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ professionalId: currentPro.id, dayOfWeek }),
    })
    loadAvailability()
  }

  // Personal time functions
  const loadPersonalTime = useCallback(() => {
    if (!currentPro) return
    fetch(`/api/booking/personal-time/${currentPro.id}`).then(r => r.json()).then(setPersonalTime).catch(() => {})
  }, [currentPro])

  useEffect(() => { loadPersonalTime() }, [loadPersonalTime])

  const savePersonalTime = async () => {
    if (!currentPro || !ptDate || !ptStart || !ptEnd) return
    await fetch('/api/booking/personal-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ professionalId: currentPro.id, date: ptDate, start: ptStart, end: ptEnd, label: ptLabel.trim() || 'Personal Time' }),
    })
    setPtLabel('')
    loadPersonalTime()
  }

  const deletePersonalTime = async (id) => {
    await fetch(`/api/booking/personal-time/${id}`, { method: 'DELETE' })
    loadPersonalTime()
  }

  const updateBookingStatus = async (id, status) => {
    await fetch(`/api/booking/bookings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note: actionNote }),
    })
    setActionBooking(null)
    setActionNote('')
    loadBookings()
  }

  const rescheduleBooking = async (id) => {
    if (!rescheduleDate || !rescheduleTime) return
    await fetch(`/api/booking/bookings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newDate: rescheduleDate, newTime: rescheduleTime, note: actionNote }),
    })
    setActionBooking(null)
    setRescheduleDate('')
    setRescheduleTime('')
    setActionNote('')
    loadBookings()
  }

  const connectGoogleCalendar = () => {
    const clientId = '565529210106-1561m2330dqaqks6116vekq35saorlgs.apps.googleusercontent.com'
    const scopes = 'https://www.googleapis.com/auth/calendar.events'
    const redirectUri = `${window.location.origin}/booking/admin`
    // Authorization code flow — gets refresh token for long-lived access
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`
    window.location.href = url
  }

  // Handle Google OAuth callback (authorization code)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code && currentPro) {
      const redirectUri = `${window.location.origin}/booking/admin`
      fetch('/api/booking/google-calendar/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ professionalId: currentPro.id, code, redirectUri }),
      }).then(() => {
        // Clean URL
        const url = new URL(window.location)
        url.searchParams.delete('code')
        url.searchParams.delete('scope')
        window.history.replaceState({}, '', url)
        loadProfessionals()
      })
    }
  }, [currentPro, loadProfessionals])

  const syncBookingToCalendar = async (bookingId) => {
    if (!currentPro) return
    await fetch('/api/booking/google-calendar/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ professionalId: currentPro.id, bookingId }),
    })
  }

  // Profile picture upload
  const handleProfilePicUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !currentPro) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      await fetch(`/api/booking/professionals/${currentPro.id}/profile-picture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: ev.target.result }),
      })
      loadProfessionals()
    }
    reader.readAsDataURL(file)
  }

  // Save profile
  const saveProfile = async () => {
    if (!currentPro) return
    setProfileSaving(true)
    await fetch(`/api/booking/professionals/${currentPro.id}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bio: profileBio,
        tagline: profileTagline,
        specialties: profileSpecialties.split(',').map(s => s.trim()).filter(Boolean),
        notifyEmail: profileNotifyEmail.trim(),
      }),
    })
    setProfileSaving(false)
    loadProfessionals()
  }

  // Product image upload
  const handleProductFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setProductFile(file)
    setProductPreview(URL.createObjectURL(file))
  }

  const saveProduct = async () => {
    if (!productFile || !currentPro) return
    setProductUploading(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      await fetch(`/api/booking/professionals/${currentPro.id}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: ev.target.result,
          title: productTitle,
          description: productDesc,
          price: productPrice,
        }),
      })
      setProductTitle('')
      setProductDesc('')
      setProductPrice('')
      setProductFile(null)
      setProductPreview(null)
      setProductUploading(false)
      if (productFileRef.current) productFileRef.current.value = ''
      loadProducts()
    }
    reader.readAsDataURL(productFile)
  }

  const deleteProduct = async (id) => {
    await fetch(`/api/booking/products/${id}`, { method: 'DELETE' })
    loadProducts()
  }

  const startEditProduct = (p) => {
    setEditingProduct(p.id)
    setEditProductTitle(p.title || '')
    setEditProductDesc(p.description || '')
    setEditProductPrice(p.price || '')
  }

  const saveEditProduct = async (id) => {
    await fetch(`/api/booking/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editProductTitle, description: editProductDesc, price: editProductPrice }),
    })
    setEditingProduct(null)
    loadProducts()
  }

  // Send reply
  const sendReply = async () => {
    if (!replyText.trim() || !selectedConvo || !currentPro || sendingReply) return
    setSendingReply(true)
    await fetch('/api/booking/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: selectedConvo.id,
        sender: currentPro.name,
        senderType: 'professional',
        content: replyText.trim(),
      }),
    })
    setReplyText('')
    setSendingReply(false)
    const msgs = await fetch(`/api/booking/messages/${selectedConvo.id}`).then(r => r.json())
    setConvoMessages(msgs)
    loadConversations()
  }

  // Slug editing
  const [editSlug, setEditSlug] = useState('')
  const [slugStatus, setSlugStatus] = useState(null) // null | 'checking' | 'available' | 'taken' | 'invalid'
  const slugTimerRef = useRef(null)

  useEffect(() => {
    if (currentPro) setEditSlug(currentPro.slug || '')
  }, [currentPro])

  const handleSlugChange = (val) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setEditSlug(clean)
    if (!clean || clean === currentPro?.slug) { setSlugStatus(null); return }
    setSlugStatus('checking')
    clearTimeout(slugTimerRef.current)
    slugTimerRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/booking/slug-check/${clean}`)
        const data = await r.json()
        setSlugStatus(data.available ? 'available' : 'taken')
      } catch { setSlugStatus(null) }
    }, 400)
  }

  const saveSlug = async () => {
    if (!currentPro || !editSlug || editSlug === currentPro.slug) return
    const res = await fetch(`/api/booking/professionals/${currentPro.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: editSlug }),
    })
    if (res.ok) {
      setSlugStatus(null)
      loadProfessionals()
    }
  }

  const bookingLink = currentPro ? `${window.location.origin}/booking/${currentPro.slug}` : ''
  const profileLink = currentPro ? `${window.location.origin}/sp/${currentPro.slug}` : ''

  const proSelector = (
    <div>
      <p className="booking-empty">Select your professional profile.</p>
      <select className="booking-select" onChange={e => {
        const p = professionals.find(x => x.id === e.target.value)
        setCurrentPro(p || null)
      }}>
        <option value="">Select profile...</option>
        {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
  )

  const hasAccess = isAdmin || isManager || !!currentPro

  if (!user) {
    return (
      <div className="booking-admin-page">
        <div className="booking-container">
          <div className="booking-header">
            <button className="back-button" onClick={() => navigate('/')}>Home</button>
            <h1>Booking Management</h1>
          </div>
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <p style={{ marginBottom: '1.5rem', color: '#666' }}>Sign in to manage your bookings</p>
            <div ref={googleBtnRef} style={{ display: 'inline-block' }} />
          </div>
        </div>
      </div>
    )
  }

  if (!hasAccess && professionals.length > 0) {
    return (
      <div className="booking-admin-page">
        <div className="booking-container">
          <div className="booking-header">
            <button className="back-button" onClick={() => navigate('/')}>Home</button>
            <h1>Booking Management</h1>
          </div>
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <p style={{ color: '#666' }}>You don't have access to this page.</p>
            <p style={{ color: '#999', fontSize: '0.85rem', marginTop: '0.5rem' }}>Signed in as {user.email}</p>
            <button className="booking-btn" onClick={logout} style={{ marginTop: '1rem' }}>Sign Out</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="booking-admin-page">
      <div className="booking-container">
        <div className="booking-header">
          <button className="back-button" onClick={() => navigate('/')}>Home</button>
          <h1>Booking Management</h1>
          {user && (
            <div className="auth-controls" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <img src={user.picture} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} referrerPolicy="no-referrer" />
              <span style={{ fontSize: '0.85rem', color: '#666' }}>{user.name || user.email}</span>
              <button className="booking-btn booking-btn--small" onClick={logout} style={{ fontSize: '0.8rem' }}>Sign Out</button>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="booking-tabs-grouped">
          <div className="booking-tab-group">
            <span className="booking-tab-group-label">Scheduling</span>
            <div className="booking-tab-group-items">
              <button className={`booking-tab${tab === 'calendar' ? ' booking-tab--active' : ''}`} onClick={() => setTab('calendar')}>Calendar</button>
              <button className={`booking-tab${tab === 'bookings' ? ' booking-tab--active' : ''}`} onClick={() => setTab('bookings')}>Bookings</button>
              <button className={`booking-tab${tab === 'availability' ? ' booking-tab--active' : ''}`} onClick={() => setTab('availability')}>Availability</button>
            </div>
          </div>
          <div className="booking-tab-group">
            <span className="booking-tab-group-label">My Page</span>
            <div className="booking-tab-group-items">
              <button className={`booking-tab${tab === 'profile' ? ' booking-tab--active' : ''}`} onClick={() => setTab('profile')}>Profile</button>
              <button className={`booking-tab${tab === 'products' ? ' booking-tab--active' : ''}`} onClick={() => setTab('products')}>Products</button>
              <button className={`booking-tab${tab === 'messages' ? ' booking-tab--active' : ''}`} onClick={() => setTab('messages')}>Messages{conversations.length > 0 ? ` (${conversations.length})` : ''}</button>
            </div>
          </div>
          <div className="booking-tab-group">
            <span className="booking-tab-group-label">{isAdmin ? 'Admin' : 'Settings'}</span>
            <div className="booking-tab-group-items">
              {isAdmin && <button className={`booking-tab${tab === 'stores' ? ' booking-tab--active' : ''}`} onClick={() => setTab('stores')}>Stores</button>}
              {(isAdmin || isManager) && <button className={`booking-tab${tab === 'professionals' ? ' booking-tab--active' : ''}`} onClick={() => setTab('professionals')}>Professionals</button>}
              <button className={`booking-tab${tab === 'settings' ? ' booking-tab--active' : ''}`} onClick={() => setTab('settings')}>Settings</button>
            </div>
          </div>
        </div>

        {/* CALENDAR TAB */}
        {tab === 'calendar' && (
          <div className="booking-section">
            {!currentPro ? proSelector : (
              <CalendarView bookings={bookings} professionals={professionals} stores={stores} currentPro={currentPro} isAdmin={isAdmin} />
            )}
          </div>
        )}

        {/* BOOKINGS TAB */}
        {tab === 'bookings' && (
          <div className="booking-section">
            {!currentPro && isAdmin && (
              <div className="booking-filter">
                <label className="booking-label">Filter by Professional:</label>
                <select className="booking-select" value={currentPro?.id || ''} onChange={e => {
                  const p = professionals.find(x => x.id === e.target.value)
                  setCurrentPro(p || null)
                }}>
                  <option value="">All Bookings</option>
                  {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}

            {bookings.length === 0 ? (
              <p className="booking-empty">No bookings yet.</p>
            ) : (
              <div className="booking-list">
                {bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(b => {
                  const pro = professionals.find(p => p.id === b.professionalId)
                  const store = stores.find(s => s.id === b.storeId)
                  return (
                    <div key={b.id} className={`booking-card booking-card--${b.status}`}>
                      <div className="booking-card-header">
                        <span className={`booking-status booking-status--${b.status}`}>{b.status}</span>
                        <span className="booking-date-display">{b.date} at {b.time}</span>
                      </div>
                      <div className="booking-card-body">
                        <p><strong>{b.firstName} {b.lastName}</strong></p>
                        {b.email && <p>Email: {b.email}</p>}
                        {b.phone && <p>Phone: {b.phone}</p>}
                        <p>Store: {store?.name || b.storeId}</p>
                        <p>Professional: {pro?.name || b.professionalId}</p>
                        <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          Type:{' '}
                          <select
                            className="booking-select"
                            value={b.bookingType || ''}
                            onChange={async e => {
                              await fetch(`/api/booking/bookings/${b.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ bookingType: e.target.value }),
                              })
                              loadBookings()
                            }}
                            style={{ margin: 0, padding: '2px 6px', fontSize: '13px', width: 'auto', flex: 1 }}
                          >
                            <option value="">Not set</option>
                            {(currentPro?.bookingTypes?.length ? currentPro.bookingTypes : DEFAULT_BOOKING_TYPES).map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </p>
                      </div>

                      {b.status === 'pending' && (
                        <div className="booking-card-actions">
                          <button className="booking-btn booking-btn--accept" onClick={() => updateBookingStatus(b.id, 'accepted')}>Accept</button>
                          <button className="booking-btn booking-btn--decline" onClick={() => { setActionBooking(b); }}>Decline</button>
                          <button className="booking-btn booking-btn--reschedule" onClick={() => setActionBooking({ ...b, action: 'reschedule' })}>Reschedule</button>
                        </div>
                      )}

                      {b.status === 'accepted' && (
                        <div className="booking-card-actions">
                          <button className="booking-btn booking-btn--decline" onClick={() => { setActionBooking({ ...b, action: 'cancel' }) }}>Cancel</button>
                          {currentPro?.googleCalendarConnected && (
                            <button className="booking-btn booking-btn--sync" onClick={() => syncBookingToCalendar(b.id)}>
                              Sync to Google Calendar
                            </button>
                          )}
                        </div>
                      )}

                      {actionBooking?.id === b.id && (
                        <div className="booking-action-panel">
                          {actionBooking.action === 'reschedule' ? (
                            <>
                              <h4>Reschedule Booking</h4>
                              <input type="date" className="booking-input" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} />
                              <select className="booking-select" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)}>
                                <option value="">Select time...</option>
                                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <textarea className="booking-input" placeholder="Note to customer (optional)" value={actionNote} onChange={e => setActionNote(e.target.value)} rows={2} />
                              <div className="booking-action-btns">
                                <button className="booking-btn booking-btn--submit" onClick={() => rescheduleBooking(b.id)}>Confirm Reschedule</button>
                                <button className="booking-btn" onClick={() => setActionBooking(null)}>Cancel</button>
                              </div>
                            </>
                          ) : actionBooking.action === 'cancel' ? (
                            <>
                              <h4>Cancel Booking</h4>
                              <textarea className="booking-input" placeholder="Reason (optional, will be sent to customer)" value={actionNote} onChange={e => setActionNote(e.target.value)} rows={2} />
                              <div className="booking-action-btns">
                                <button className="booking-btn booking-btn--decline" onClick={() => updateBookingStatus(b.id, 'cancelled')}>Confirm Cancel</button>
                                <button className="booking-btn" onClick={() => setActionBooking(null)}>Back</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <h4>Decline Booking</h4>
                              <textarea className="booking-input" placeholder="Reason (optional, will be sent to customer)" value={actionNote} onChange={e => setActionNote(e.target.value)} rows={2} />
                              <div className="booking-action-btns">
                                <button className="booking-btn booking-btn--decline" onClick={() => updateBookingStatus(b.id, 'declined')}>Confirm Decline</button>
                                <button className="booking-btn" onClick={() => setActionBooking(null)}>Cancel</button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* AVAILABILITY TAB */}
        {tab === 'availability' && (
          <div className="booking-section">
            {!currentPro ? proSelector : (
              <>
                <h3>Current Availability for {currentPro.name}</h3>
                {availability.length === 0 ? (
                  <p className="booking-empty">No availability set yet.</p>
                ) : (
                  <div className="avail-list">
                    {availability.filter(a => a.dayOfWeek !== null).sort((a, b) => a.dayOfWeek - b.dayOfWeek).map(a => (
                      <div key={a.dayOfWeek} className="avail-card">
                        <div className="avail-card-header">
                          <strong>{DAY_NAMES[a.dayOfWeek]}</strong>
                          <button className="booking-btn booking-btn--small booking-btn--decline" onClick={() => deleteAvailability(a.dayOfWeek)}>Remove</button>
                        </div>
                        <div className="avail-slots">
                          {a.slots.map((s, i) => (
                            <span key={i} className="avail-slot-tag">{s.start} - {s.end}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="avail-form">
                  <h4>Add Availability</h4>
                  <div className="avail-form-row">
                    <select className="booking-select" value={availDay} onChange={e => setAvailDay(e.target.value)}>
                      {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>

                  <div className="avail-slots-form">
                    <div className="avail-slot-row">
                      <select className="booking-select booking-select--small" value={availSlots[0]?.start || '09:00'} onChange={e => updateSlot(0, 'start', e.target.value)}>
                        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <span>to</span>
                      <select className="booking-select booking-select--small" value={availSlots[0]?.end || '17:00'} onChange={e => updateSlot(0, 'end', e.target.value)}>
                        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  <button className="booking-btn booking-btn--submit" onClick={saveAvailability}>Save Availability</button>
                </div>

                <div className="avail-form" style={{ marginTop: '2rem' }}>
                  <h4>Personal Time Off</h4>
                  <p className="booking-hint" style={{ marginBottom: '0.75rem' }}>Block off time when you're not available for bookings.</p>

                  {personalTime.filter(pt => pt.date >= new Date().toISOString().split('T')[0]).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)).length > 0 && (
                    <div className="avail-list" style={{ marginBottom: '1rem' }}>
                      {personalTime.filter(pt => pt.date >= new Date().toISOString().split('T')[0]).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)).map(pt => (
                        <div key={pt.id} className="avail-card">
                          <div className="avail-card-header">
                            <strong>{pt.date} — {pt.label || 'Personal Time'}</strong>
                            <button className="booking-btn booking-btn--small booking-btn--decline" onClick={() => deletePersonalTime(pt.id)}>Remove</button>
                          </div>
                          <div className="avail-slots">
                            <span className="avail-slot-tag">{pt.start} - {pt.end}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="avail-form-row">
                    <input type="date" className="booking-input" value={ptDate} onChange={e => setPtDate(e.target.value)} min={new Date().toISOString().split('T')[0]} style={{ margin: 0 }} />
                  </div>
                  <div className="avail-slot-row">
                    <select className="booking-select booking-select--small" value={ptStart} onChange={e => setPtStart(e.target.value)}>
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span>to</span>
                    <select className="booking-select booking-select--small" value={ptEnd} onChange={e => setPtEnd(e.target.value)}>
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="avail-form-row">
                    <input type="text" className="booking-input" placeholder="Label (optional, e.g. Lunch, Doctor)" value={ptLabel} onChange={e => setPtLabel(e.target.value)} style={{ margin: 0 }} />
                  </div>
                  <button className="booking-btn booking-btn--submit" onClick={savePersonalTime} disabled={!ptDate || !ptStart || !ptEnd}>Block Time</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* PROFILE TAB */}
        {tab === 'profile' && (
          <div className="booking-section">
            {!currentPro ? proSelector : (
              <>
                <h3>My Profile</h3>
                <div className="settings-section">
                  <h4>Profile Picture</h4>
                  <div className="sp-admin-avatar-row">
                    {currentPro.profilePicture ? (
                      <img src={currentPro.profilePicture} alt="" className="sp-admin-avatar" />
                    ) : (
                      <div className="sp-admin-avatar sp-avatar-placeholder">
                        {currentPro.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <button className="booking-btn booking-btn--small" onClick={() => profilePicRef.current?.click()}>
                        {currentPro.profilePicture ? 'Change Photo' : 'Upload Photo'}
                      </button>
                      <input ref={profilePicRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProfilePicUpload} />
                    </div>
                  </div>
                </div>

                <div className="settings-section">
                  <h4>Tagline</h4>
                  <input
                    type="text"
                    className="booking-input"
                    placeholder="e.g. Your personal jewellery consultant"
                    value={profileTagline}
                    onChange={e => setProfileTagline(e.target.value)}
                  />
                </div>

                <div className="settings-section">
                  <h4>Specialties</h4>
                  <input
                    type="text"
                    className="booking-input"
                    placeholder="e.g. Engagement Rings, Watches, Custom Design (comma separated)"
                    value={profileSpecialties}
                    onChange={e => setProfileSpecialties(e.target.value)}
                  />
                  <p className="booking-hint">Separate specialties with commas</p>
                </div>

                <div className="settings-section">
                  <h4>Notification Email</h4>
                  <input
                    type="email"
                    className="booking-input"
                    placeholder={currentPro.email}
                    value={profileNotifyEmail}
                    onChange={e => setProfileNotifyEmail(e.target.value)}
                  />
                  <p className="booking-hint">Booking notifications will be sent here. Leave blank to use your login email ({currentPro.email}).</p>
                </div>

                <div className="settings-section">
                  <h4>About Me</h4>
                  <RichTextEditor
                    value={profileBio}
                    onChange={setProfileBio}
                    placeholder="Tell customers about yourself, your experience, and what makes your service special..."
                  />
                </div>

                <button className="booking-btn booking-btn--submit" onClick={saveProfile} disabled={profileSaving}>
                  {profileSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </>
            )}
          </div>
        )}

        {/* PRODUCTS TAB */}
        {tab === 'products' && (
          <div className="booking-section">
            {!currentPro ? proSelector : (
              <>
                <h3>Product Gallery</h3>
                <p className="booking-hint" style={{ marginBottom: '1rem' }}>Upload photos of products you'd like to showcase on your profile page.</p>

                {products.length > 0 && (
                  <div className="sp-admin-products-grid">
                    {products.map(p => (
                      <div key={p.id} className="sp-admin-product-card">
                        <img src={p.imageUrl} alt={p.title} className="sp-admin-product-img" />
                        {editingProduct === p.id ? (
                          <div className="sp-admin-product-info">
                            <input type="text" className="booking-input" placeholder="Title" value={editProductTitle} onChange={e => setEditProductTitle(e.target.value)} style={{ margin: '0.25rem 0' }} />
                            <input type="text" className="booking-input" placeholder="Price (e.g. $1,299)" value={editProductPrice} onChange={e => setEditProductPrice(e.target.value)} style={{ margin: '0.25rem 0' }} />
                            <textarea className="booking-input" placeholder="Description" value={editProductDesc} onChange={e => setEditProductDesc(e.target.value)} rows={2} style={{ margin: '0.25rem 0' }} />
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                              <button className="booking-btn booking-btn--submit booking-btn--small" onClick={() => saveEditProduct(p.id)}>Save</button>
                              <button className="booking-btn booking-btn--small" onClick={() => setEditingProduct(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="sp-admin-product-info">
                            {p.title && <strong>{p.title}</strong>}
                            {p.price && <span className="sp-admin-product-price">{p.price}</span>}
                            {p.description && <p className="sp-admin-product-desc">{p.description}</p>}
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                              <button className="booking-btn booking-btn--small" onClick={() => startEditProduct(p)}>Edit</button>
                              <button className="booking-btn booking-btn--small booking-btn--decline" onClick={() => deleteProduct(p.id)}>Remove</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="avail-form" style={{ marginTop: '1.5rem' }}>
                  <h4>Add Product</h4>
                  <input type="text" className="booking-input" placeholder="Product title (optional)" value={productTitle} onChange={e => setProductTitle(e.target.value)} />
                  <input type="text" className="booking-input" placeholder="Price (optional, e.g. $1,299)" value={productPrice} onChange={e => setProductPrice(e.target.value)} />
                  <textarea className="booking-input" placeholder="Description (optional)" value={productDesc} onChange={e => setProductDesc(e.target.value)} rows={2} />
                  <div>
                    <label className="booking-label">Product Image *</label>
                    <input ref={productFileRef} type="file" accept="image/*" onChange={handleProductFileSelect} />
                  </div>
                  {productPreview && (
                    <img src={productPreview} alt="Preview" style={{ maxWidth: 150, maxHeight: 150, borderRadius: 8, marginTop: '0.5rem' }} />
                  )}
                  {productUploading && <p className="booking-hint">Uploading...</p>}
                  <button
                    className="booking-btn booking-btn--submit"
                    onClick={saveProduct}
                    disabled={!productFile || productUploading}
                    style={{ marginTop: '0.75rem' }}
                  >
                    {productUploading ? 'Saving...' : 'Save Product'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* MESSAGES TAB */}
        {tab === 'messages' && (
          <div className="booking-section">
            {!currentPro ? proSelector : (
              <div className="sp-messages-layout">
                {/* Conversation List */}
                <div className="sp-convo-list">
                  <h3>Conversations</h3>
                  {conversations.length === 0 ? (
                    <p className="booking-empty">No messages yet.</p>
                  ) : (
                    conversations.map(c => (
                      <div
                        key={c.id}
                        className={`sp-convo-item${selectedConvo?.id === c.id ? ' sp-convo-item--active' : ''}`}
                        onClick={() => setSelectedConvo(c)}
                      >
                        <strong>{c.customerName}</strong>
                        {c.lastMessage && <p className="sp-convo-preview">{c.lastMessage}</p>}
                        <span className="sp-convo-time">
                          {new Date(c.lastMessageAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Message Thread */}
                <div className="sp-message-thread">
                  {!selectedConvo ? (
                    <p className="booking-empty">Select a conversation to view messages.</p>
                  ) : (
                    <>
                      <div className="sp-thread-header">
                        <strong>{selectedConvo.customerName}</strong>
                        {selectedConvo.customerEmail && <span> &middot; {selectedConvo.customerEmail}</span>}
                        {selectedConvo.customerPhone && <span> &middot; {selectedConvo.customerPhone}</span>}
                      </div>
                      <div className="sp-thread-messages">
                        {convoMessages.map(m => (
                          <div key={m.id} className={`sp-chat-msg ${m.senderType === 'professional' ? 'sp-chat-msg--sent' : 'sp-chat-msg--received'}`}>
                            <div className="sp-chat-msg-content" dangerouslySetInnerHTML={{ __html: m.content }} />
                            <span className="sp-chat-msg-time">
                              {new Date(m.createdAt).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                      <div className="sp-thread-reply">
                        <RichTextEditor
                          value={replyText}
                          onChange={setReplyText}
                          placeholder="Type your reply..."
                        />
                        <button
                          className="booking-btn booking-btn--submit"
                          onClick={sendReply}
                          disabled={sendingReply || !replyText.trim()}
                        >
                          {sendingReply ? 'Sending...' : 'Send'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STORES TAB (Admin only) */}
        {tab === 'stores' && isAdmin && (
          <div className="booking-section">
            <h3>Stores</h3>
            <div className="booking-list">
              {stores.map(s => (
                <div key={s.id} className="booking-card">
                  <div className="booking-card-body">
                    <p><strong>{s.name}</strong></p>
                    {s.address && <p>{s.address}</p>}
                    <p style={{ fontSize: '0.85rem', color: '#888' }}>Timezone: {s.timezone || 'America/Vancouver'}</p>
                    <select
                      className="booking-select booking-select--small"
                      value={s.timezone || 'America/Vancouver'}
                      onChange={async e => {
                        await fetch(`/api/booking/stores/${s.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ timezone: e.target.value }),
                        })
                        loadStores()
                      }}
                      style={{ marginTop: '0.5rem' }}
                    >
                      {Intl.supportedValuesOf('timeZone').map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                    <div style={{ marginTop: '0.5rem' }}>
                      <label style={{ fontSize: '0.85rem', color: '#888' }}>Store Manager Email:</label>
                      <input
                        type="email"
                        className="booking-input"
                        placeholder="manager@email.com"
                        defaultValue={s.managerEmail || ''}
                        onBlur={async e => {
                          const val = e.target.value.trim()
                          if (val === (s.managerEmail || '')) return
                          await fetch(`/api/booking/stores/${s.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ managerEmail: val }),
                          })
                          loadStores()
                        }}
                        style={{ margin: '0.25rem 0 0' }}
                      />
                    </div>
                  </div>
                  <button className="booking-btn booking-btn--small booking-btn--decline" onClick={() => deleteStore(s.id)}>Delete</button>
                </div>
              ))}
            </div>
            <div className="avail-form">
              <h4>Add Store</h4>
              <input type="text" className="booking-input" placeholder="Store name" value={newStoreName} onChange={e => setNewStoreName(e.target.value)} />
              <input type="text" className="booking-input" placeholder="Address (optional)" value={newStoreAddress} onChange={e => setNewStoreAddress(e.target.value)} />
              <button className="booking-btn booking-btn--submit" onClick={addStore}>Add Store</button>
            </div>
          </div>
        )}

        {/* PROFESSIONALS TAB (Admin + Managers) */}
        {tab === 'professionals' && (isAdmin || isManager) && (() => {
          const visiblePros = isAdmin ? professionals : professionals.filter(p => managedStoreIds.includes(p.storeId))
          const availableStores = isAdmin ? stores : stores.filter(s => managedStoreIds.includes(s.id))
          return (
            <div className="booking-section">
              <h3>Sales Professionals</h3>
              <div className="booking-list">
                {visiblePros.map(p => {
                  const store = stores.find(s => s.id === p.storeId)
                  return (
                    <div key={p.id} className="booking-card">
                      <div className="booking-card-body">
                        <p><strong>{p.name}</strong></p>
                        <p>Email: {p.email}</p>
                        <p>Store: {store?.name || p.storeId}</p>
                        <p className="booking-link-display">Booking: <a href={`/booking/${p.slug}`}>/booking/{p.slug}</a></p>
                        <p className="booking-link-display">Profile: <a href={`/sp/${p.slug}`}>/sp/{p.slug}</a></p>
                      </div>
                      <button className="booking-btn booking-btn--small booking-btn--decline" onClick={() => deleteProfessional(p.id)}>Delete</button>
                    </div>
                  )
                })}
              </div>
              <div className="avail-form">
                <h4>Add Professional</h4>
                <input type="text" className="booking-input" placeholder="Name" value={proName} onChange={e => setProName(e.target.value)} />
                <input type="email" className="booking-input" placeholder="Email" value={proEmail} onChange={e => setProEmail(e.target.value)} />
                <input type="tel" className="booking-input" placeholder="Phone (optional)" value={proPhone} onChange={e => setProPhone(e.target.value)} />
                <select className="booking-select" value={proStore} onChange={e => setProStore(e.target.value)}>
                  <option value="">Select store...</option>
                  {availableStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button className="booking-btn booking-btn--submit" onClick={addProfessional}>Add Professional</button>
              </div>
            </div>
          )
        })()}

        {/* SETTINGS TAB */}
        {tab === 'settings' && (
          <div className="booking-section">
            <h3>Settings</h3>

            {currentPro && (
              <>
                <div className="settings-section">
                  <h4>Custom URL Slug</h4>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <code style={{ whiteSpace: 'nowrap' }}>/booking/</code>
                    <input
                      type="text"
                      className="booking-input"
                      value={editSlug}
                      onChange={e => handleSlugChange(e.target.value)}
                      placeholder="your-slug"
                      style={{ flex: 1, margin: 0 }}
                    />
                    <button
                      className="booking-btn booking-btn--submit booking-btn--small"
                      onClick={saveSlug}
                      disabled={!editSlug || editSlug === currentPro.slug || slugStatus === 'taken' || slugStatus === 'checking'}
                    >
                      Save
                    </button>
                  </div>
                  {slugStatus === 'checking' && <p className="booking-hint">Checking...</p>}
                  {slugStatus === 'available' && <p className="booking-hint" style={{ color: '#4c6335' }}>Available!</p>}
                  {slugStatus === 'taken' && <p className="booking-hint" style={{ color: '#c0392b' }}>Already taken</p>}
                </div>

                <ShareLink label="Your Booking Link" url={bookingLink} hint="Share this link with customers to let them book directly with you." />
                <ShareLink label="Your Profile Page" url={profileLink} hint="Your mini website with profile, products, messaging, and booking." />

                <div className="settings-section">
                  <h4>Appointment Duration</h4>
                  <select
                    className="booking-select"
                    value={currentPro.defaultDuration || 60}
                    onChange={async e => {
                      await fetch(`/api/booking/professionals/${currentPro.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ defaultDuration: parseInt(e.target.value) }),
                      })
                      loadProfessionals()
                    }}
                  >
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                    <option value={90}>90 minutes</option>
                    <option value={120}>2 hours</option>
                  </select>
                  <p className="booking-hint">Default length of each booking.</p>
                </div>

                <div className="settings-section">
                  <h4>Buffer Between Appointments</h4>
                  <select
                    className="booking-select"
                    value={currentPro.bufferMinutes || 0}
                    onChange={async e => {
                      await fetch(`/api/booking/professionals/${currentPro.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ bufferMinutes: parseInt(e.target.value) }),
                      })
                      loadProfessionals()
                    }}
                  >
                    <option value={0}>No buffer</option>
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                  </select>
                  <p className="booking-hint">Time gap between consecutive bookings.</p>
                </div>

                {isAdmin && <BookingTypesEditor pro={currentPro} onSaved={loadProfessionals} />}

                <div className="settings-section">
                  <h4>Google Calendar</h4>
                  {currentPro.googleCalendarConnected ? (
                    <div>
                      <p className="booking-connected">Connected</p>
                      <button className="booking-btn booking-btn--small booking-btn--decline" onClick={async () => {
                        await fetch('/api/booking/google-calendar/disconnect', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ professionalId: currentPro.id }),
                        })
                        loadProfessionals()
                      }}>Disconnect</button>
                    </div>
                  ) : (
                    <button className="booking-btn booking-btn--submit" onClick={connectGoogleCalendar}>
                      Connect Google Calendar
                    </button>
                  )}
                </div>

                {isAdmin && <ReminderConfig />}
              </>
            )}

            {!currentPro && proSelector}

            {isAdmin && professionals.length > 0 && (
              <div className="settings-section" style={{ marginTop: '2rem' }}>
                <h4>Manage SP Slugs</h4>
                <div className="booking-list">
                  {professionals.map(p => (
                    <SPSlugEditor key={p.id} pro={p} onSaved={loadProfessionals} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Share Link with Shorten ──
function ShareLink({ label, url, hint }) {
  const [short, setShort] = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const shorten = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await r.json()
      if (data.short) setShort(data.short)
    } catch {}
    setLoading(false)
  }

  const copy = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="settings-section">
      <h4>{label}</h4>
      <div className="booking-link-box">
        <code>{short || url}</code>
        <button className="booking-btn booking-btn--small" onClick={() => copy(short || url)}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
        {!short && (
          <button className="booking-btn booking-btn--small" onClick={shorten} disabled={loading}>
            {loading ? '...' : 'Shorten'}
          </button>
        )}
      </div>
      {hint && <p className="booking-hint">{hint}</p>}
    </div>
  )
}

// ── Calendar View Component ──
const CAL_HOURS = Array.from({ length: 12 }, (_, i) => i + 8)
const CAL_START = 8
const CAL_H = 70

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getWeekDays(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const start = new Date(d)
  start.setDate(d.getDate() - ((day + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(start)
    dd.setDate(start.getDate() + i)
    return dd
  })
}

function fmtHour(h) { return `${h > 12 ? h - 12 : h} ${h >= 12 ? 'PM' : 'AM'}` }

function CalendarView({ bookings, professionals, currentPro, isAdmin }) {
  const [date, setDate] = useState(toDateStr(new Date()))
  const [view, setView] = useState('week')

  const filtered = bookings.filter(b => {
    if (b.status === 'declined' || b.status === 'expired') return false
    if (!isAdmin) return b.professionalId === currentPro?.id
    return true
  })

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const nav = (dir) => {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + (view === 'week' ? dir * 7 : dir))
    setDate(toDateStr(d))
  }

  const days = view === 'week' ? getWeekDays(date) : [new Date(date + 'T12:00:00')]
  const today = toDateStr(new Date())
  const colors = { pending: '#f0c040', accepted: '#4c6335', cancelled: '#c0392b' }
  const totalH = CAL_HOURS.length * CAL_H

  return (
    <div className="cal-view">
      <div className="cal-toolbar">
        <button className="booking-btn booking-btn--small" onClick={() => nav(-1)}>&laquo;</button>
        <button className="booking-btn booking-btn--small" onClick={() => setDate(toDateStr(new Date()))}>Today</button>
        <button className="booking-btn booking-btn--small" onClick={() => nav(1)}>&raquo;</button>
        <span className="cal-date-label">
          {view === 'week'
            ? `${days[0].toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })} — ${days[6].toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}`
            : new Date(date + 'T12:00:00').toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          }
        </span>
        <div className="cal-view-toggle">
          <button className={`booking-btn booking-btn--small${view === 'day' ? ' booking-tab--active' : ''}`} onClick={() => setView('day')}>Day</button>
          <button className={`booking-btn booking-btn--small${view === 'week' ? ' booking-tab--active' : ''}`} onClick={() => setView('week')}>Week</button>
        </div>
      </div>

      <div className="cal-outer">
        {/* Header row */}
        <div className="cal-header-row" style={{ gridTemplateColumns: `50px repeat(${days.length}, 1fr)` }}>
          <div className="cal-corner" />
          {days.map(d => {
            const ds = toDateStr(d)
            return (
              <div key={ds} className={`cal-day-header${ds === today ? ' cal-day-header--today' : ''}`} onClick={() => { setDate(ds); setView('day') }}>
                <span className="cal-day-name">{dayLabels[(d.getDay() + 6) % 7]}</span>
                <span className="cal-day-num">{d.getDate()}</span>
              </div>
            )
          })}
        </div>

        {/* Body */}
        <div className="cal-body" style={{ gridTemplateColumns: `50px repeat(${days.length}, 1fr)` }}>
          {/* Time labels */}
          <div className="cal-times">
            {CAL_HOURS.map(h => (
              <div key={h} className="cal-time-label" style={{ height: CAL_H }}>{fmtHour(h)}</div>
            ))}
          </div>

          {/* Day columns */}
          {days.map(d => {
            const ds = toDateStr(d)
            const dayBookings = filtered.filter(b => b.date === ds)
            return (
              <div key={ds} className="cal-column" style={{ height: totalH }}>
                {CAL_HOURS.map(h => (
                  <div key={h} className="cal-cell" style={{ height: CAL_H }} />
                ))}
                {dayBookings.map(b => {
                  const [bh, bm] = b.time.split(':').map(Number)
                  const dur = b.duration || 60
                  const top = ((bh - CAL_START) + bm / 60) * CAL_H
                  const height = Math.max((dur / 60) * CAL_H - 2, 20)
                  const pro = professionals.find(p => p.id === b.professionalId)
                  return (
                    <div
                      key={b.id}
                      className="cal-event"
                      style={{
                        top, height,
                        background: colors[b.status] || '#888',
                        opacity: b.status === 'cancelled' ? 0.5 : 1,
                      }}
                      title={`${b.time} — ${b.firstName} ${b.lastName}\n${pro?.name || ''}\nStatus: ${b.status}`}
                    >
                      <strong>{b.time}</strong> {b.firstName} {b.lastName}
                      {isAdmin && pro && <span style={{ opacity: 0.8 }}> · {pro.name}</span>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default BookingAdminPage
