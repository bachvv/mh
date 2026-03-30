import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DEFAULT_BOOKING_TYPES = ['Product Viewing', 'Consultation', 'Repairs', 'Custom Design', 'Inspection', 'Other']


function BookingPage() {
  const navigate = useNavigate()
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const queryType = searchParams.get('type')
  const queryStore = searchParams.get('store')
  const [stores, setStores] = useState([])
  const [professionals, setProfessionals] = useState([])
  const [selectedStore, setSelectedStore] = useState('')
  const [storeLocked, setStoreLocked] = useState(false)
  const [selectedPro, setSelectedPro] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [firstName, setFirstName] = useState(() => localStorage.getItem('mh_booking_firstName') || '')
  const [lastName, setLastName] = useState(() => localStorage.getItem('mh_booking_lastName') || '')
  const [email, setEmail] = useState(() => localStorage.getItem('mh_booking_email') || '')
  const [phone, setPhone] = useState(() => localStorage.getItem('mh_booking_phone') || '')
  const [bookingType, setBookingType] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [proLocked, setProLocked] = useState(false)
  const [proProfile, setProProfile] = useState(null)

  // Load stores
  useEffect(() => {
    fetch('/api/booking/stores').then(r => r.json()).then(setStores).catch(() => {})
  }, [])

  // If store query param provided, pre-select store
  useEffect(() => {
    if (!queryStore || !stores.length) return
    const match = stores.find(s => s.id === queryStore)
    if (match) {
      setSelectedStore(match.id)
      setStoreLocked(true)
    }
  }, [queryStore, stores])

  // If type query param provided, pre-select booking type
  useEffect(() => {
    if (queryType) setBookingType(queryType)
  }, [queryType])

  // If slug provided, resolve professional and pre-select
  useEffect(() => {
    if (!slug) return
    fetch(`/api/booking/professionals/${slug}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(pro => {
        setSelectedStore(pro.storeId)
        setSelectedPro(pro.id)
        if (pro.isAnyone) {
          // Store-level booking: lock store, show type, let user pick SP
          setStoreLocked(true)
          if (pro.bookingTypes?.length === 1) setBookingType(pro.bookingTypes[0])
        } else {
          setProLocked(true)
          setProProfile(pro)
        }
      })
      .catch(() => setError('Professional not found'))
  }, [slug])

  // Load professionals when store changes
  useEffect(() => {
    if (!selectedStore) { setProfessionals([]); return }
    fetch(`/api/booking/professionals?store=${selectedStore}`)
      .then(r => r.json())
      .then(pros => {
        // Sort "Anyone" first
        const sorted = pros.sort((a, b) => (a.isAnyone ? -1 : b.isAnyone ? 1 : 0))
        setProfessionals(sorted)
        // Auto-select "Anyone" as default
        if (!selectedPro) {
          const anyone = sorted.find(p => p.isAnyone)
          if (anyone) setSelectedPro(anyone.id)
        }
      })
      .catch(() => {})
  }, [selectedStore])

  // Load available days when professional is selected
  const [availableDays, setAvailableDays] = useState([])
  useEffect(() => {
    if (!selectedPro) { setAvailableDays([]); return }
    fetch(`/api/booking/available-days/${selectedPro}`)
      .then(r => r.json())
      .then(data => setAvailableDays(data.days || []))
      .catch(() => setAvailableDays([]))
  }, [selectedPro])

  // Load slots when professional and date are selected
  useEffect(() => {
    if (!selectedPro || !selectedDate) { setSlots([]); return }
    fetch(`/api/booking/slots/${selectedPro}/${selectedDate}`)
      .then(r => r.json())
      .then(data => setSlots(data.slots || []))
      .catch(() => setSlots([]))
  }, [selectedPro, selectedDate])

  // Calendar state
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const availableSet = useMemo(() => new Set(availableDays), [availableDays])

  const calendarDays = useMemo(() => {
    const { year, month } = calMonth
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const days = []
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const date = new Date(year, month, d)
      const isPast = date < today
      const isAvailable = availableSet.has(iso)
      days.push({ day: d, iso, isPast, isAvailable })
    }
    return days
  }, [calMonth, availableSet])

  const canGoPrev = useMemo(() => {
    const now = new Date()
    return calMonth.year > now.getFullYear() || (calMonth.year === now.getFullYear() && calMonth.month > now.getMonth())
  }, [calMonth])

  const canGoNext = useMemo(() => {
    if (!availableDays.length) return false
    const last = availableDays[availableDays.length - 1]
    const [ly, lm] = last.split('-').map(Number)
    return calMonth.year < ly || (calMonth.year === ly && calMonth.month < lm - 1)
  }, [calMonth, availableDays])

  const navMonth = (dir) => {
    setCalMonth(prev => {
      let m = prev.month + dir
      let y = prev.year
      if (m < 0) { m = 11; y-- }
      if (m > 11) { m = 0; y++ }
      return { year: y, month: m }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!firstName.trim()) { setError('First name is required'); return }
    if (!email.trim()) { setError('Email is required'); return }
    if (!selectedStore || !selectedPro || !selectedDate || !selectedSlot) {
      setError('Please select store, professional, date and time slot')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/booking/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: selectedStore,
          professionalId: selectedPro,
          bookingType: bookingType || undefined,
          date: selectedDate,
          time: selectedSlot,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create booking')
      localStorage.setItem('mh_booking_firstName', firstName.trim())
      localStorage.setItem('mh_booking_lastName', lastName.trim())
      localStorage.setItem('mh_booking_email', email.trim())
      localStorage.setItem('mh_booking_phone', phone.trim())
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function getGoogleCalendarUrl() {
    if (!selectedDate || !selectedSlot) return null
    const [h, m] = selectedSlot.split(':').map(Number)
    const duration = proProfile?.defaultDuration || 60
    const startMin = h * 60 + m
    const endTotalMin = startMin + duration
    const endH = Math.floor(endTotalMin / 60)
    const endM = endTotalMin % 60
    const datePart = selectedDate.replace(/-/g, '')
    const startTime = `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}00`
    const endTime = `${String(endH).padStart(2, '0')}${String(endM).padStart(2, '0')}00`
    const dates = `${datePart}T${startTime}/${datePart}T${endTime}`
    const store = proProfile?.store || stores.find(s => s.id === selectedStore)
    const pro = proProfile || professionals.find(p => p.id === selectedPro)
    const tz = store?.timezone || 'America/Vancouver'
    const title = encodeURIComponent(`Appointment${pro ? ` with ${pro.name}` : ''}`)
    const details = encodeURIComponent(`Booking at ${store?.name || 'Store'}${pro ? ` with ${pro.name}` : ''}`)
    const location = encodeURIComponent(store?.address || store?.name || '')
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&ctz=${encodeURIComponent(tz)}&details=${details}&location=${location}`
  }

  function downloadICS() {
    if (!selectedDate || !selectedSlot) return
    const [h, m] = selectedSlot.split(':').map(Number)
    const duration = proProfile?.defaultDuration || 60
    const startMin = h * 60 + m
    const endTotalMin = startMin + duration
    const endH = Math.floor(endTotalMin / 60)
    const endM = endTotalMin % 60
    const datePart = selectedDate.replace(/-/g, '')
    const startTime = `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}00`
    const endTime = `${String(endH).padStart(2, '0')}${String(endM).padStart(2, '0')}00`
    const store = proProfile?.store || stores.find(s => s.id === selectedStore)
    const pro = proProfile || professionals.find(p => p.id === selectedPro)
    const tz = store?.timezone || 'America/Vancouver'
    const title = `Appointment${pro ? ` with ${pro.name}` : ''}`
    const desc = `Booking at ${store?.name || 'Store'}${pro ? ` with ${pro.name}` : ''}`
    const location = store?.address || store?.name || ''
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `DTSTART;TZID=${tz}:${datePart}T${startTime}`,
      `DTEND;TZID=${tz}:${datePart}T${endTime}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${desc}`,
      `LOCATION:${location}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const blob = new Blob([ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'appointment.ics'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (submitted) {
    const calUrl = getGoogleCalendarUrl()
    return (
      <div className="booking-page">
        <div className="booking-container">
          <div className="booking-success">
            <div className="success-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4c6335" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2>Booking Submitted!</h2>
            <p>Your appointment request has been sent. You will be notified once it is confirmed.</p>
            {calUrl && (
              <a
                href={calUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="booking-btn"
                style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center', marginBottom: 12 }}
              >
                Add to Google Calendar
              </a>
            )}
            <button
              className="booking-btn"
              style={{ marginBottom: 12 }}
              onClick={downloadICS}
            >
              Add to Apple Calendar
            </button>
            <button className="booking-btn" onClick={() => { setSubmitted(false); setSelectedSlot(''); setSelectedDate('') }}>
              Book Another Appointment
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="booking-page">
      <div className="booking-container">
        <div className="booking-header">
          {!slug && <button className="back-button" onClick={() => navigate('/')}>Home</button>}
          <h1>Book an Appointment</h1>
        </div>

        {proProfile && (
          <div className="booking-sp-branding" onClick={() => navigate(`/sp/${slug}`)} style={{ cursor: 'pointer' }}>
            {proProfile.profilePicture ? (
              <img src={proProfile.profilePicture} alt={proProfile.name} className="booking-sp-avatar" />
            ) : (
              <div className="booking-sp-avatar booking-sp-avatar--placeholder">
                {proProfile.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="booking-sp-info">
              <h2>{proProfile.name}</h2>
              {proProfile.tagline && <p className="booking-sp-tagline">{proProfile.tagline}</p>}
              {proProfile.store && <p className="booking-sp-store">{proProfile.store.name}{proProfile.store.address ? ` — ${proProfile.store.address}` : ''}</p>}
              <span className="booking-sp-profile-link">View Profile</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="booking-form">
          {/* Store Selection */}
          <div className="booking-section">
            <label className="booking-label">Store</label>
            {storeLocked ? (
              <div className="booking-locked">{stores.find(s => s.id === selectedStore)?.name || 'Loading...'}</div>
            ) : (
              <select
                className="booking-select"
                value={selectedStore}
                onChange={e => { setSelectedStore(e.target.value); if (!proLocked) setSelectedPro(''); setSelectedDate(''); setSelectedSlot('') }}
                disabled={proLocked}
              >
                <option value="">Select a store...</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>

          {/* Appointment Type (pre-selected) */}
          {(queryType || (storeLocked && bookingType)) && (
            <div className="booking-section">
              <label className="booking-label">Appointment Type</label>
              <div className="booking-locked">{queryType || bookingType}</div>
            </div>
          )}

          {/* Professional Selection */}
          {selectedStore && (
            <div className="booking-section">
              <label className="booking-label">Sales Professional</label>
              {proLocked ? (
                <div className="booking-locked">
                  {professionals.find(p => p.id === selectedPro)?.name || 'Loading...'}
                </div>
              ) : (
                <select
                  className="booking-select"
                  value={selectedPro}
                  onChange={e => { setSelectedPro(e.target.value); setSelectedDate(''); setSelectedSlot('') }}
                >
                  <option value="">Select a professional...</option>
                  {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </div>
          )}

          {/* Date Selection - Calendar */}
          {selectedPro && (
            <div className="booking-section">
              <label className="booking-label">Date</label>
              {availableDays.length === 0 ? (
                <p className="booking-no-slots">Loading available dates...</p>
              ) : (
                <div className="booking-calendar">
                  <div className="booking-cal-header">
                    <button type="button" className="booking-cal-nav" onClick={() => navMonth(-1)} disabled={!canGoPrev}>&lsaquo;</button>
                    <span className="booking-cal-title">{MONTH_NAMES[calMonth.month]} {calMonth.year}</span>
                    <button type="button" className="booking-cal-nav" onClick={() => navMonth(1)} disabled={!canGoNext}>&rsaquo;</button>
                  </div>
                  <div className="booking-cal-grid">
                    {DAY_HEADERS.map(d => <div key={d} className="booking-cal-dayname">{d}</div>)}
                    {calendarDays.map((cell, i) => {
                      if (!cell) return <div key={`empty-${i}`} className="booking-cal-cell booking-cal-cell--empty" />
                      const isSelected = selectedDate === cell.iso
                      const disabled = !cell.isAvailable || cell.isPast
                      return (
                        <button
                          key={cell.iso}
                          type="button"
                          disabled={disabled}
                          className={`booking-cal-cell${isSelected ? ' booking-cal-cell--selected' : ''}${cell.isAvailable && !cell.isPast ? ' booking-cal-cell--available' : ''}${disabled ? ' booking-cal-cell--disabled' : ''}`}
                          onClick={() => { setSelectedDate(cell.iso); setSelectedSlot('') }}
                        >
                          {cell.day}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Time Slots */}
          {selectedDate && (
            <div className="booking-section">
              <label className="booking-label">Available Times</label>
              {slots.length === 0 ? (
                <p className="booking-no-slots">No available slots for this date. Please try another date.</p>
              ) : (
                <div className="booking-slots">
                  {slots.map(s => (
                    <button
                      key={s.start}
                      type="button"
                      className={`slot-btn${selectedSlot === s.start ? ' slot-btn--selected' : ''}`}
                      onClick={() => setSelectedSlot(s.start)}
                    >
                      {s.start} - {s.end}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Booking Type */}
          {selectedSlot && !queryType && (() => {
            const pro = professionals.find(p => p.id === selectedPro) || proProfile
            const types = pro?.bookingTypes?.length ? pro.bookingTypes : DEFAULT_BOOKING_TYPES
            if (types.length === 1) return null
            return (
              <div className="booking-section">
                <label className="booking-label">Appointment Type</label>
                <select
                  className="booking-select"
                  value={bookingType}
                  onChange={e => setBookingType(e.target.value)}
                >
                  <option value="">Select type...</option>
                  {types.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )
          })()}

          {/* Customer Details */}
          {selectedSlot && (
            <div className="booking-section">
              <label className="booking-label">Your Details</label>
              <div className="booking-fields">
                <div className="booking-field">
                  <input
                    type="text"
                    className="booking-input"
                    placeholder="First Name *"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="booking-field">
                  <input
                    type="text"
                    className="booking-input"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                  />
                </div>
                <div className="booking-field">
                  <input
                    type="email"
                    className="booking-input"
                    placeholder="Email *"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div className="booking-field">
                  <input
                    type="tel"
                    className="booking-input"
                    placeholder="Phone Number"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </div>
                <p className="booking-hint">* First name and email are required</p>
              </div>
            </div>
          )}

          {error && <div className="booking-error">{error}</div>}

          {selectedSlot && (
            <button type="submit" className="booking-btn booking-btn--submit" disabled={loading}>
              {loading ? 'Submitting...' : 'Confirm Booking'}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

export default BookingPage
