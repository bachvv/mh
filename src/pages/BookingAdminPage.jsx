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

function BookingAdminPage() {
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()

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

  // Booking action
  const [actionBooking, setActionBooking] = useState(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [actionNote, setActionNote] = useState('')

  // Profile editing
  const [profileBio, setProfileBio] = useState('')
  const [profileTagline, setProfileTagline] = useState('')
  const [profileSpecialties, setProfileSpecialties] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const profilePicRef = useRef(null)

  // Product images
  const [products, setProducts] = useState([])
  const [productTitle, setProductTitle] = useState('')
  const [productDesc, setProductDesc] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [productUploading, setProductUploading] = useState(false)
  const productFileRef = useRef(null)

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
    const q = currentPro && !isAdmin ? `?professionalId=${currentPro.id}` : ''
    fetch(`/api/booking/bookings${q}`).then(r => r.json()).then(setBookings).catch(() => {})
  }, [currentPro, isAdmin])

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
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scopes)}`
    window.location.href = url
  }

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('access_token') && currentPro) {
      const params = new URLSearchParams(hash.substring(1))
      const accessToken = params.get('access_token')
      if (accessToken) {
        fetch('/api/booking/google-calendar/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ professionalId: currentPro.id, accessToken }),
        }).then(() => {
          window.location.hash = ''
          loadProfessionals()
        })
      }
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
      }),
    })
    setProfileSaving(false)
    loadProfessionals()
  }

  // Product image upload
  const handleProductUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !currentPro) return
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
      setProductUploading(false)
      if (productFileRef.current) productFileRef.current.value = ''
      loadProducts()
    }
    reader.readAsDataURL(file)
  }

  const deleteProduct = async (id) => {
    await fetch(`/api/booking/products/${id}`, { method: 'DELETE' })
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

  return (
    <div className="booking-admin-page">
      <div className="booking-container">
        <div className="booking-header">
          <button className="back-button" onClick={() => navigate('/')}>Home</button>
          <h1>Booking Management</h1>
        </div>

        {/* Tab Navigation */}
        <div className="booking-tabs">
          <button className={`booking-tab${tab === 'bookings' ? ' booking-tab--active' : ''}`} onClick={() => setTab('bookings')}>Bookings</button>
          <button className={`booking-tab${tab === 'availability' ? ' booking-tab--active' : ''}`} onClick={() => setTab('availability')}>Availability</button>
          <button className={`booking-tab${tab === 'profile' ? ' booking-tab--active' : ''}`} onClick={() => setTab('profile')}>Profile</button>
          <button className={`booking-tab${tab === 'products' ? ' booking-tab--active' : ''}`} onClick={() => setTab('products')}>Products</button>
          <button className={`booking-tab${tab === 'messages' ? ' booking-tab--active' : ''}`} onClick={() => setTab('messages')}>Messages{conversations.length > 0 ? ` (${conversations.length})` : ''}</button>
          {isAdmin && <button className={`booking-tab${tab === 'stores' ? ' booking-tab--active' : ''}`} onClick={() => setTab('stores')}>Stores</button>}
          {isAdmin && <button className={`booking-tab${tab === 'professionals' ? ' booking-tab--active' : ''}`} onClick={() => setTab('professionals')}>Professionals</button>}
          <button className={`booking-tab${tab === 'settings' ? ' booking-tab--active' : ''}`} onClick={() => setTab('settings')}>Settings</button>
        </div>

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
                        {b.bookingType && <p>Type: {b.bookingType.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>}
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
                    {availSlots.map((slot, idx) => (
                      <div key={idx} className="avail-slot-row">
                        <select className="booking-select booking-select--small" value={slot.start} onChange={e => updateSlot(idx, 'start', e.target.value)}>
                          {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <span>to</span>
                        <select className="booking-select booking-select--small" value={slot.end} onChange={e => updateSlot(idx, 'end', e.target.value)}>
                          {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        {availSlots.length > 1 && (
                          <button className="booking-btn booking-btn--small booking-btn--decline" onClick={() => removeSlotRow(idx)}>x</button>
                        )}
                      </div>
                    ))}
                    <button className="booking-btn booking-btn--small" onClick={addSlotRow}>+ Add Slot</button>
                  </div>

                  <button className="booking-btn booking-btn--submit" onClick={saveAvailability}>Save Availability</button>
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

                {profileLink && (
                  <div className="settings-section" style={{ marginTop: '1rem' }}>
                    <h4>Your Profile Page</h4>
                    <div className="booking-link-box">
                      <code>{profileLink}</code>
                      <button className="booking-btn booking-btn--small" onClick={() => navigator.clipboard.writeText(profileLink)}>Copy</button>
                    </div>
                    <p className="booking-hint">Share this link to show customers your profile, products, and booking page.</p>
                  </div>
                )}
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
                        <div className="sp-admin-product-info">
                          {p.title && <strong>{p.title}</strong>}
                          {p.price && <span className="sp-admin-product-price">{p.price}</span>}
                          {p.description && <p className="sp-admin-product-desc">{p.description}</p>}
                        </div>
                        <button className="booking-btn booking-btn--small booking-btn--decline" onClick={() => deleteProduct(p.id)}>Remove</button>
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
                    <label className="booking-label">Product Image</label>
                    <input ref={productFileRef} type="file" accept="image/*" onChange={handleProductUpload} />
                  </div>
                  {productUploading && <p className="booking-hint">Uploading...</p>}
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

        {/* PROFESSIONALS TAB (Admin only) */}
        {tab === 'professionals' && isAdmin && (
          <div className="booking-section">
            <h3>Sales Professionals</h3>
            <div className="booking-list">
              {professionals.map(p => {
                const store = stores.find(s => s.id === p.storeId)
                return (
                  <div key={p.id} className="booking-card">
                    <div className="booking-card-body">
                      <p><strong>{p.name}</strong></p>
                      <p>Email: {p.email}</p>
                      <p>Store: {store?.name || p.storeId}</p>
                      <p className="booking-link-display">Booking link: /booking/{p.slug}</p>
                      <p className="booking-link-display">Profile page: /sp/{p.slug}</p>
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
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button className="booking-btn booking-btn--submit" onClick={addProfessional}>Add Professional</button>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {tab === 'settings' && (
          <div className="booking-section">
            <h3>Settings</h3>

            {currentPro && (
              <>
                <div className="settings-section">
                  <h4>Your Booking Link</h4>
                  <div className="booking-link-box">
                    <code>{bookingLink}</code>
                    <button className="booking-btn booking-btn--small" onClick={() => navigator.clipboard.writeText(bookingLink)}>Copy</button>
                  </div>
                  <p className="booking-hint">Share this link with customers to let them book directly with you.</p>
                </div>

                <div className="settings-section">
                  <h4>Your Profile Page</h4>
                  <div className="booking-link-box">
                    <code>{profileLink}</code>
                    <button className="booking-btn booking-btn--small" onClick={() => navigator.clipboard.writeText(profileLink)}>Copy</button>
                  </div>
                  <p className="booking-hint">Your mini website with profile, products, messaging, and booking.</p>
                </div>

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
              </>
            )}

            {!currentPro && proSelector}
          </div>
        )}
      </div>
    </div>
  )
}

export default BookingAdminPage
