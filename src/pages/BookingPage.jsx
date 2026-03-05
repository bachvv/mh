import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function BookingPage() {
  const navigate = useNavigate()
  const { slug } = useParams()
  const [stores, setStores] = useState([])
  const [professionals, setProfessionals] = useState([])
  const [selectedStore, setSelectedStore] = useState('')
  const [selectedPro, setSelectedPro] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [proLocked, setProLocked] = useState(false)

  // Load stores
  useEffect(() => {
    fetch('/api/booking/stores').then(r => r.json()).then(setStores).catch(() => {})
  }, [])

  // If slug provided, resolve professional and pre-select
  useEffect(() => {
    if (!slug) return
    fetch(`/api/booking/professionals/${slug}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(pro => {
        setSelectedStore(pro.storeId)
        setSelectedPro(pro.id)
        setProLocked(true)
      })
      .catch(() => setError('Professional not found'))
  }, [slug])

  // Load professionals when store changes
  useEffect(() => {
    if (!selectedStore) { setProfessionals([]); return }
    fetch(`/api/booking/professionals?store=${selectedStore}`)
      .then(r => r.json())
      .then(setProfessionals)
      .catch(() => {})
  }, [selectedStore])

  // Load slots when professional and date are selected
  useEffect(() => {
    if (!selectedPro || !selectedDate) { setSlots([]); return }
    fetch(`/api/booking/slots/${selectedPro}/${selectedDate}`)
      .then(r => r.json())
      .then(data => setSlots(data.slots || []))
      .catch(() => setSlots([]))
  }, [selectedPro, selectedDate])

  // Generate next 30 days for date selection
  const dateOptions = []
  const today = new Date()
  for (let i = 1; i <= 30; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const iso = d.toISOString().split('T')[0]
    const label = `${DAY_NAMES[d.getDay()]}, ${d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}`
    dateOptions.push({ value: iso, label })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!firstName.trim()) { setError('First name is required'); return }
    if (!email.trim() && !phone.trim()) { setError('Email or phone number is required'); return }
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
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
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
          <button className="back-button" onClick={() => navigate('/')}>Home</button>
          <h1>Book an Appointment</h1>
        </div>

        <form onSubmit={handleSubmit} className="booking-form">
          {/* Store Selection */}
          <div className="booking-section">
            <label className="booking-label">Store</label>
            <select
              className="booking-select"
              value={selectedStore}
              onChange={e => { setSelectedStore(e.target.value); if (!proLocked) setSelectedPro(''); setSelectedDate(''); setSelectedSlot('') }}
              disabled={proLocked}
            >
              <option value="">Select a store...</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

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

          {/* Date Selection */}
          {selectedPro && (
            <div className="booking-section">
              <label className="booking-label">Date</label>
              <select
                className="booking-select"
                value={selectedDate}
                onChange={e => { setSelectedDate(e.target.value); setSelectedSlot('') }}
              >
                <option value="">Select a date...</option>
                {dateOptions.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
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
                    placeholder="Email"
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
                <p className="booking-hint">* First name and either email or phone are required</p>
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
