import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)
const STORAGE_KEY = 'mh-auth-user'
const CLIENT_ID = '565529210106-1561m2330dqaqks6116vekq35saorlgs.apps.googleusercontent.com'
const ADMIN_EMAIL = 'bachvv@gmail.com'

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

  const login = useCallback(() => {
    if (ready) {
      window.google.accounts.id.prompt()
    }
  }, [ready])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect()
    }
  }, [])

  const isAdmin = user?.email === ADMIN_EMAIL

  return (
    <AuthContext.Provider value={{ user, isAdmin, login, logout, ready }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
