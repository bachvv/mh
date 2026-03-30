import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

const AuthContext = createContext(null)
const STORAGE_KEY = 'mh-auth-user'
const CLIENT_ID = '565529210106-1561m2330dqaqks6116vekq35saorlgs.apps.googleusercontent.com'
const ADMIN_EMAILS = ['bachvv@gmail.com', 'm.helmy86@gmail.com']

function loadUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY))
  } catch { return null }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser)
  const [ready, setReady] = useState(false)

  const handleCredentialResponse = useCallback((response) => {
    const payload = JSON.parse(atob(response.credential.split('.')[1]))
    const u = { email: payload.email, name: payload.name, picture: payload.picture }
    setUser(u)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
  }, [])

  useEffect(() => {
    const init = () => {
      if (!window.google?.accounts?.id) {
        setTimeout(init, 100)
        return
      }
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: true,
      })
      setReady(true)
    }
    init()
  }, [handleCredentialResponse])

  const renderButton = useCallback((el) => {
    if (ready && el && window.google?.accounts?.id) {
      window.google.accounts.id.renderButton(el, {
        type: 'standard',
        theme: 'outline',
        size: 'medium',
        text: 'signin_with',
      })
    }
  }, [ready])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect()
    }
  }, [])

  const isAdmin = ADMIN_EMAILS.includes(user?.email)
  const [managedStoreIds, setManagedStoreIds] = useState([])

  useEffect(() => {
    if (!user?.email || isAdmin) { setManagedStoreIds([]); return }
    fetch('/api/booking/stores').then(r => r.json()).then(stores => {
      setManagedStoreIds(stores.filter(s => s.managerEmail === user.email).map(s => s.id))
    }).catch(() => setManagedStoreIds([]))
  }, [user?.email, isAdmin])

  const isManager = managedStoreIds.length > 0

  return (
    <AuthContext.Provider value={{ user, isAdmin, isManager, managedStoreIds, renderButton, logout, ready }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
