import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

// --- Web Crypto helpers for E2E encryption ---
async function generateKeyPair() {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  )
}

async function exportPublicKey(key) {
  const raw = await crypto.subtle.exportKey('raw', key)
  return btoa(String.fromCharCode(...new Uint8Array(raw)))
}

async function importPublicKey(b64) {
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'raw', raw,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  )
}

async function deriveSharedKey(privateKey, publicKey) {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encryptMessage(sharedKey, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    encoded
  )
  return {
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
  }
}

async function decryptMessage(sharedKey, iv64, ciphertext64) {
  const iv = Uint8Array.from(atob(iv64), c => c.charCodeAt(0))
  const ciphertext = Uint8Array.from(atob(ciphertext64), c => c.charCodeAt(0))
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    ciphertext
  )
  return new TextDecoder().decode(decrypted)
}

// --- Persistent key storage ---
const KEY_STORAGE = 'mh-msg-keypair'

async function getOrCreateKeyPair() {
  try {
    const stored = localStorage.getItem(KEY_STORAGE)
    if (stored) {
      const { pub, priv } = JSON.parse(stored)
      const publicKey = await crypto.subtle.importKey(
        'jwk', pub, { name: 'ECDH', namedCurve: 'P-256' }, true, []
      )
      const privateKey = await crypto.subtle.importKey(
        'jwk', priv, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']
      )
      return { publicKey, privateKey }
    }
  } catch { /* regenerate */ }

  const keyPair = await generateKeyPair()
  const pub = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  const priv = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
  localStorage.setItem(KEY_STORAGE, JSON.stringify({ pub, priv }))
  return keyPair
}

function formatTime(ts) {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return isToday ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`
}

function MessagingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [channel, setChannel] = useState('general')
  const [channelInput, setChannelInput] = useState('')
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState({})
  const [keyPair, setKeyPair] = useState(null)
  const [sharedKeys, setSharedKeys] = useState({})
  const [status, setStatus] = useState('Initializing encryption...')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const lastTimestampRef = useRef(0)
  const pollRef = useRef(null)
  const inputRef = useRef(null)

  const userId = user?.email || 'anonymous'
  const userName = user?.name || 'Anonymous'

  // Initialize encryption keys
  useEffect(() => {
    (async () => {
      const kp = await getOrCreateKeyPair()
      setKeyPair(kp)
      setStatus('Encrypted')
    })()
  }, [])

  // Register in channel when keys are ready
  useEffect(() => {
    if (!keyPair) return
    ;(async () => {
      const pubKey = await exportPublicKey(keyPair.publicKey)
      await fetch('/api/msg/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, userId, userName, publicKey: pubKey }),
      })
      // Load members
      const res = await fetch(`/api/msg/channel/${encodeURIComponent(channel)}`)
      const data = await res.json()
      setMembers(data.members || {})
      lastTimestampRef.current = 0
      setMessages([])
    })()
  }, [keyPair, channel, userId, userName])

  // Derive shared keys with all members
  useEffect(() => {
    if (!keyPair) return
    ;(async () => {
      const keys = {}
      for (const [uid, info] of Object.entries(members)) {
        if (uid === userId) continue
        try {
          const theirPub = await importPublicKey(info.publicKey)
          keys[uid] = await deriveSharedKey(keyPair.privateKey, theirPub)
        } catch { /* skip */ }
      }
      // Also derive "self" key for reading own messages
      try {
        keys[userId] = await deriveSharedKey(keyPair.privateKey, keyPair.publicKey)
      } catch { /* skip */ }
      setSharedKeys(keys)
    })()
  }, [members, keyPair, userId])

  // Poll for new messages
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/msg/messages/${encodeURIComponent(channel)}?since=${lastTimestampRef.current}`
      )
      const data = await res.json()
      if (data.messages?.length) {
        const maxTs = Math.max(...data.messages.map(m => m.timestamp))
        lastTimestampRef.current = maxTs

        // Decrypt messages
        const decrypted = await Promise.all(
          data.messages.map(async (msg) => {
            const payload = msg.encryptedPayloads?.[userId]
            if (!payload) {
              // Message from self - check self-encrypted copy
              const selfPayload = msg.encryptedPayloads?.__self_
              if (selfPayload && msg.senderId === userId) {
                try {
                  const key = sharedKeys[userId]
                  if (key) {
                    const text = await decryptMessage(key, selfPayload.iv, selfPayload.ciphertext)
                    return { ...msg, text, decrypted: true }
                  }
                } catch { /* fall through */ }
              }
              return { ...msg, text: null, decrypted: false }
            }
            try {
              const key = sharedKeys[msg.senderId] || sharedKeys[userId]
              if (!key) return { ...msg, text: null, decrypted: false }
              const text = await decryptMessage(key, payload.iv, payload.ciphertext)
              return { ...msg, text, decrypted: true }
            } catch {
              return { ...msg, text: null, decrypted: false }
            }
          })
        )

        setMessages(prev => {
          const existing = new Set(prev.map(m => m.id))
          const newMsgs = decrypted.filter(m => !existing.has(m.id))
          return [...prev, ...newMsgs]
        })
      }
    } catch { /* silent */ }
  }, [channel, userId, sharedKeys])

  useEffect(() => {
    if (!Object.keys(sharedKeys).length) return
    fetchMessages()
    pollRef.current = setInterval(fetchMessages, 1500)
    return () => clearInterval(pollRef.current)
  }, [fetchMessages, sharedKeys])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send message
  const handleSend = async (e) => {
    e.preventDefault()
    if (!message.trim() || sending) return
    setSending(true)

    try {
      const encryptedPayloads = {}

      // Encrypt for each member
      for (const [uid, key] of Object.entries(sharedKeys)) {
        if (uid === userId) continue
        encryptedPayloads[uid] = await encryptMessage(key, message)
      }

      // Encrypt self-copy with own derived key
      if (sharedKeys[userId]) {
        encryptedPayloads.__self_ = await encryptMessage(sharedKeys[userId], message)
      }

      await fetch('/api/msg/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          senderId: userId,
          senderName: userName,
          encryptedPayloads,
          timestamp: Date.now(),
        }),
      })

      setMessage('')
      inputRef.current?.focus()
      // Immediately fetch
      setTimeout(fetchMessages, 100)
    } catch (err) {
      setStatus('Send failed: ' + err.message)
    } finally {
      setSending(false)
    }
  }

  const switchChannel = (ch) => {
    if (ch && ch !== channel) {
      setChannel(ch)
      setMessages([])
      setMembers({})
      setSharedKeys({})
      lastTimestampRef.current = 0
    }
  }

  const memberCount = Object.keys(members).length
  const onlineMembers = Object.entries(members).map(([, m]) => m.userName)

  return (
    <div className="msg-page">
      <div className="msg-sidebar">
        <div className="msg-sidebar__header">
          <button className="back-button" onClick={() => navigate('/')}>Back</button>
          <h2>Channels</h2>
        </div>
        <div className="msg-sidebar__channels">
          {['general', 'sales', 'managers'].map(ch => (
            <button
              key={ch}
              className={`msg-channel-btn${channel === ch ? ' msg-channel-btn--active' : ''}`}
              onClick={() => switchChannel(ch)}
            >
              <span className="msg-channel-hash">#</span>
              {ch}
            </button>
          ))}
        </div>
        <div className="msg-sidebar__custom">
          <input
            value={channelInput}
            onChange={e => setChannelInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="Join channel..."
            onKeyDown={e => { if (e.key === 'Enter' && channelInput) { switchChannel(channelInput); setChannelInput('') } }}
          />
        </div>
        <div className="msg-sidebar__members">
          <h3>Members ({memberCount})</h3>
          {onlineMembers.map((name, i) => (
            <div key={i} className="msg-member">
              <span className="msg-member__dot" />
              {name}
            </div>
          ))}
        </div>
      </div>

      <div className="msg-main">
        <div className="msg-topbar">
          <div className="msg-topbar__channel">
            <span className="msg-channel-hash">#</span>
            {channel}
          </div>
          <div className="msg-topbar__status">
            <span className={`msg-lock${status === 'Encrypted' ? ' msg-lock--on' : ''}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            {status}
          </div>
        </div>

        <div className="msg-messages">
          {messages.length === 0 && (
            <div className="msg-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <p>End-to-end encrypted channel</p>
              <span>Messages are encrypted with AES-256-GCM. Only channel members can read them.</span>
            </div>
          )}
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`msg-bubble${msg.senderId === userId ? ' msg-bubble--own' : ''}${!msg.decrypted ? ' msg-bubble--locked' : ''}`}
            >
              {msg.senderId !== userId && (
                <div className="msg-bubble__sender">{msg.senderName}</div>
              )}
              <div className="msg-bubble__text">
                {msg.decrypted ? msg.text : (
                  <span className="msg-bubble__encrypted">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    Encrypted message
                  </span>
                )}
              </div>
              <div className="msg-bubble__time">{formatTime(msg.timestamp)}</div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form className="msg-input" onSubmit={handleSend}>
          <input
            ref={inputRef}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={`Message #${channel} (encrypted)`}
            autoFocus
            disabled={sending}
          />
          <button type="submit" disabled={!message.trim() || sending} className="msg-send-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}

export default MessagingPage
