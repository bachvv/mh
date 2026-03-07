import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const EMOJI_LIST = [
  '😊', '👋', '💎', '✨', '💍', '⌚', '🎁', '❤️', '🔥', '👌',
  '🙏', '💯', '😍', '🎉', '👏', '💪', '🌟', '😃', '👍', '🤩',
  '💐', '🥂', '🎊', '💝', '🌹', '✅', '📸', '💬', '📩', '🛍️',
]

function RichTextEditor({ value, onChange, placeholder }) {
  const editorRef = useRef(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showToolbar, setShowToolbar] = useState(false)

  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML && value) {
      editorRef.current.innerHTML = value
    }
  }, [])

  const execCmd = (cmd, val = null) => {
    editorRef.current.focus()
    document.execCommand(cmd, false, val)
    onChange(editorRef.current.innerHTML)
  }

  const insertEmoji = (emoji) => {
    editorRef.current.focus()
    document.execCommand('insertText', false, emoji)
    onChange(editorRef.current.innerHTML)
    setShowEmoji(false)
  }

  return (
    <div className="rich-editor-wrap">
      <div className="rich-editor-toolbar">
        <button type="button" className="re-btn" onClick={() => execCmd('bold')} title="Bold"><strong>B</strong></button>
        <button type="button" className="re-btn" onClick={() => execCmd('italic')} title="Italic"><em>I</em></button>
        <button type="button" className="re-btn" onClick={() => execCmd('underline')} title="Underline"><u>U</u></button>
        <span className="re-sep" />
        <button type="button" className="re-btn" onClick={() => execCmd('insertUnorderedList')} title="Bullet List">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1.5" fill="currentColor"/><circle cx="3" cy="12" r="1.5" fill="currentColor"/><circle cx="3" cy="18" r="1.5" fill="currentColor"/></svg>
        </button>
        <button type="button" className="re-btn" onClick={() => execCmd('insertOrderedList')} title="Numbered List">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="2" y="8" fontSize="8" fill="currentColor" stroke="none">1</text><text x="2" y="14" fontSize="8" fill="currentColor" stroke="none">2</text><text x="2" y="20" fontSize="8" fill="currentColor" stroke="none">3</text></svg>
        </button>
        <span className="re-sep" />
        <select className="re-size-select" onChange={e => { if (e.target.value) execCmd('fontSize', e.target.value); e.target.value = '' }} defaultValue="">
          <option value="" disabled>Size</option>
          <option value="1">Small</option>
          <option value="3">Normal</option>
          <option value="5">Large</option>
          <option value="7">Huge</option>
        </select>
        <span className="re-sep" />
        <div className="re-emoji-wrap">
          <button type="button" className="re-btn" onClick={() => setShowEmoji(!showEmoji)} title="Emoji">😊</button>
          {showEmoji && (
            <div className="re-emoji-picker">
              {EMOJI_LIST.map(e => (
                <button key={e} type="button" className="re-emoji-btn" onClick={() => insertEmoji(e)}>{e}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div
        ref={editorRef}
        className="rich-editor-content"
        contentEditable
        data-placeholder={placeholder || 'Type here...'}
        onInput={() => onChange(editorRef.current.innerHTML)}
        onFocus={() => setShowToolbar(true)}
      />
    </div>
  )
}

function SPProfilePage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [pro, setPro] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Chat state
  const [showChat, setShowChat] = useState(false)
  const [chatName, setChatName] = useState('')
  const [chatEmail, setChatEmail] = useState('')
  const [chatPhone, setChatPhone] = useState('')
  const [chatStarted, setChatStarted] = useState(false)
  const [convoId, setConvoId] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const messagesEndRef = useRef(null)

  // Product lightbox
  const [lightboxIdx, setLightboxIdx] = useState(-1)

  useEffect(() => {
    if (!slug) return
    Promise.all([
      fetch(`/api/booking/professionals/${slug}`).then(r => { if (!r.ok) throw new Error(); return r.json() }),
    ]).then(([proData]) => {
      setPro(proData)
      return fetch(`/api/booking/professionals/${proData.id}/products`).then(r => r.json())
    }).then(setProducts).catch(() => setError('Professional not found')).finally(() => setLoading(false))
  }, [slug])

  // Poll for new messages
  useEffect(() => {
    if (!convoId) return
    const load = () => fetch(`/api/booking/messages/${convoId}`).then(r => r.json()).then(setMessages).catch(() => {})
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [convoId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const startChat = async () => {
    if (!chatName.trim()) return
    if (!chatEmail.trim() && !chatPhone.trim()) return
    try {
      const res = await fetch('/api/booking/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          professionalId: pro.id,
          customerName: chatName.trim(),
          customerEmail: chatEmail.trim(),
          customerPhone: chatPhone.trim(),
        }),
      })
      const convo = await res.json()
      setConvoId(convo.id)
      setChatStarted(true)
    } catch {}
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || sendingMsg) return
    setSendingMsg(true)
    try {
      await fetch('/api/booking/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: convoId,
          sender: chatName,
          senderType: 'customer',
          content: newMessage.trim(),
        }),
      })
      setNewMessage('')
      const msgs = await fetch(`/api/booking/messages/${convoId}`).then(r => r.json())
      setMessages(msgs)
    } catch {} finally {
      setSendingMsg(false)
    }
  }

  if (loading) return <div className="sp-profile-page"><div className="sp-profile-container"><p>Loading...</p></div></div>
  if (error || !pro) return <div className="sp-profile-page"><div className="sp-profile-container"><p className="booking-error">{error || 'Not found'}</p></div></div>

  return (
    <div className="sp-profile-page">
      {/* Hero / Profile Header */}
      <div className="sp-hero">
        <div className="sp-hero-inner">
          <div className="sp-avatar-wrap">
            {pro.profilePicture ? (
              <img src={pro.profilePicture} alt={pro.name} className="sp-avatar" />
            ) : (
              <div className="sp-avatar sp-avatar-placeholder">
                {pro.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <h1 className="sp-name">{pro.name}</h1>
          {pro.tagline && <p className="sp-tagline">{pro.tagline}</p>}
          {pro.specialties && pro.specialties.length > 0 && (
            <div className="sp-specialties">
              {pro.specialties.map((s, i) => <span key={i} className="sp-specialty-tag">{s}</span>)}
            </div>
          )}
          <div className="sp-hero-actions">
            <button className="sp-btn sp-btn--primary" onClick={() => navigate(`/booking/${slug}`)}>
              Book Appointment
            </button>
            <button className="sp-btn sp-btn--outline" onClick={() => setShowChat(true)}>
              Message Me
            </button>
          </div>
        </div>
      </div>

      {/* Bio Section */}
      {pro.bio && (
        <div className="sp-section">
          <div className="sp-container">
            <h2 className="sp-section-title">About Me</h2>
            <div className="sp-bio" dangerouslySetInnerHTML={{ __html: pro.bio }} />
          </div>
        </div>
      )}

      {/* Product Gallery */}
      {products.length > 0 && (
        <div className="sp-section sp-section--alt">
          <div className="sp-container">
            <h2 className="sp-section-title">My Collection</h2>
            <div className="sp-gallery">
              {products.map((p, idx) => (
                <div key={p.id} className="sp-gallery-item" onClick={() => setLightboxIdx(idx)}>
                  <div className="sp-gallery-img-wrap">
                    <img src={p.imageUrl} alt={p.title || 'Product'} className="sp-gallery-img" />
                  </div>
                  {(p.title || p.price) && (
                    <div className="sp-gallery-info">
                      {p.title && <h3 className="sp-gallery-title">{p.title}</h3>}
                      {p.price && <span className="sp-gallery-price">{p.price}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Book Section */}
      <div className="sp-section">
        <div className="sp-container sp-cta-section">
          <h2 className="sp-section-title">Ready to Visit?</h2>
          <p className="sp-cta-text">Book a personalised appointment and I'll have everything prepared for you.</p>
          <button className="sp-btn sp-btn--primary sp-btn--lg" onClick={() => navigate(`/booking/${slug}`)}>
            Book an Appointment
          </button>
        </div>
      </div>

      {/* Product Lightbox */}
      {lightboxIdx >= 0 && lightboxIdx < products.length && (
        <div className="sp-lightbox" onClick={() => setLightboxIdx(-1)}>
          <div className="sp-lightbox-content" onClick={e => e.stopPropagation()}>
            <button className="sp-lightbox-close" onClick={() => setLightboxIdx(-1)}>&times;</button>
            {lightboxIdx > 0 && (
              <button className="sp-lightbox-nav sp-lightbox-prev" onClick={() => setLightboxIdx(lightboxIdx - 1)}>&lsaquo;</button>
            )}
            {lightboxIdx < products.length - 1 && (
              <button className="sp-lightbox-nav sp-lightbox-next" onClick={() => setLightboxIdx(lightboxIdx + 1)}>&rsaquo;</button>
            )}
            <img src={products[lightboxIdx].imageUrl} alt={products[lightboxIdx].title || 'Product'} className="sp-lightbox-img" />
            {(products[lightboxIdx].title || products[lightboxIdx].description || products[lightboxIdx].price) && (
              <div className="sp-lightbox-info">
                {products[lightboxIdx].title && <h3>{products[lightboxIdx].title}</h3>}
                {products[lightboxIdx].price && <p className="sp-lightbox-price">{products[lightboxIdx].price}</p>}
                {products[lightboxIdx].description && <p>{products[lightboxIdx].description}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat Widget */}
      {showChat && (
        <div className="sp-chat-overlay">
          <div className="sp-chat-widget">
            <div className="sp-chat-header">
              <div className="sp-chat-header-info">
                {pro.profilePicture ? (
                  <img src={pro.profilePicture} alt="" className="sp-chat-avatar" />
                ) : (
                  <div className="sp-chat-avatar sp-avatar-placeholder-sm">
                    {pro.name[0]}
                  </div>
                )}
                <div>
                  <strong>{pro.name}</strong>
                  <span className="sp-chat-status">Usually replies within a few hours</span>
                </div>
              </div>
              <button className="sp-chat-close" onClick={() => setShowChat(false)}>&times;</button>
            </div>

            {!chatStarted ? (
              <div className="sp-chat-start">
                <p>Start a conversation with {pro.name}. Enter your details below:</p>
                <input
                  type="text"
                  className="booking-input"
                  placeholder="Your Name *"
                  value={chatName}
                  onChange={e => setChatName(e.target.value)}
                />
                <input
                  type="email"
                  className="booking-input"
                  placeholder="Email"
                  value={chatEmail}
                  onChange={e => setChatEmail(e.target.value)}
                />
                <input
                  type="tel"
                  className="booking-input"
                  placeholder="Phone"
                  value={chatPhone}
                  onChange={e => setChatPhone(e.target.value)}
                />
                <p className="booking-hint">* Name and either email or phone required</p>
                <button
                  className="sp-btn sp-btn--primary"
                  onClick={startChat}
                  disabled={!chatName.trim() || (!chatEmail.trim() && !chatPhone.trim())}
                >
                  Start Chat
                </button>
              </div>
            ) : (
              <>
                <div className="sp-chat-messages">
                  {messages.length === 0 && (
                    <p className="sp-chat-empty">Send a message to start the conversation!</p>
                  )}
                  {messages.map(m => (
                    <div key={m.id} className={`sp-chat-msg ${m.senderType === 'customer' ? 'sp-chat-msg--sent' : 'sp-chat-msg--received'}`}>
                      {m.senderType === 'professional' && (
                        <div className="sp-chat-msg-avatar">
                          {pro.profilePicture ? (
                            <img src={pro.profilePicture} alt="" className="sp-chat-bubble-avatar" />
                          ) : (
                            <div className="sp-chat-bubble-avatar sp-avatar-placeholder-sm">{pro.name[0]}</div>
                          )}
                        </div>
                      )}
                      <div>
                        <div className="sp-chat-msg-content" dangerouslySetInnerHTML={{ __html: m.content }} />
                        <span className="sp-chat-msg-time">
                          {new Date(m.createdAt).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <div className="sp-chat-input-area">
                  <RichTextEditor
                    value={newMessage}
                    onChange={setNewMessage}
                    placeholder="Type a message..."
                  />
                  <button
                    className="sp-btn sp-btn--primary sp-chat-send"
                    onClick={sendMessage}
                    disabled={sendingMsg || !newMessage.trim()}
                  >
                    {sendingMsg ? '...' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export { RichTextEditor }
export default SPProfilePage
