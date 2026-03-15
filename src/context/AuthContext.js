import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getCurrentIdToken, signInWithGoogle, signOutUser, subscribeToAuthChanges } from '../lib/firebaseClient.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async nextUser => {
      setUser(nextUser)

      if (nextUser) {
        try {
          const token = await nextUser.getIdToken()
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
        } catch (error) {
          setAuthError(error?.message || 'Failed to sync signed-in user')
        }
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  async function loginWithGoogle() {
    try {
      setAuthError('')
      await signInWithGoogle()
    } catch (error) {
      setAuthError(error?.message || 'Google sign-in failed')
      throw error
    }
  }

  async function logout() {
    try {
      setAuthError('')
      await signOutUser()
    } catch (error) {
      setAuthError(error?.message || 'Sign out failed')
      throw error
    }
  }

  const value = useMemo(() => ({ user, loading, authError, loginWithGoogle, logout, getCurrentIdToken }), [user, loading, authError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
