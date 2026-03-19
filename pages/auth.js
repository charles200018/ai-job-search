import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { getApps, initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth, getRedirectResult, onAuthStateChanged, signInWithRedirect } from 'firebase/auth'

const REDIRECT_STARTED_KEY = 'authRedirectStartedAt'
const REDIRECT_TIMEOUT_MS = 30_000

function getFirebaseClientConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }
}

function isClientConfigAvailable(config) {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId)
}

function getSafeNextPath(nextValue) {
  if (typeof nextValue !== 'string') return '/account'
  if (!nextValue.startsWith('/')) return '/account'
  if (nextValue.startsWith('//')) return '/account'
  return nextValue
}

export default function AuthEntryPage() {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState('')

  const nextPath = useMemo(() => getSafeNextPath(router.query.next), [router.query.next])

  useEffect(() => {
    if (!router.isReady) return

    const config = getFirebaseClientConfig()
    if (!isClientConfigAvailable(config)) {
      router.replace('/account')
      return
    }

    const app = getApps()[0] || initializeApp(config)
    const auth = getAuth(app)

    let cancelled = false
    let unsubscribeAuth = null

    function clearRedirectFlag() {
      try {
        localStorage.removeItem(REDIRECT_STARTED_KEY)
      } catch {}
    }

    function getRedirectStartedAt() {
      try {
        const raw = localStorage.getItem(REDIRECT_STARTED_KEY)
        const value = raw ? Number(raw) : NaN
        return Number.isFinite(value) ? value : null
      } catch {
        return null
      }
    }

    function setRedirectStartedNow() {
      try {
        localStorage.setItem(REDIRECT_STARTED_KEY, String(Date.now()))
      } catch {}
    }

    async function run() {
      const startedAt = getRedirectStartedAt()

      // Always keep listening for auth hydration; if user appears, continue.
      unsubscribeAuth = onAuthStateChanged(auth, user => {
        if (cancelled) return
        if (user) {
          clearRedirectFlag()
          router.replace(nextPath)
        }
      })

      // 1) If we're returning from Google, resolve the pending redirect.
      try {
        const result = await getRedirectResult(auth)
        if (result?.user) {
          clearRedirectFlag()
          router.replace(nextPath)
          return
        }
      } catch (error) {
        // If Firebase returns an error after redirect, stop looping and show it.
        clearRedirectFlag()
        const code = error?.code ? ` (${error.code})` : ''
        setErrorMessage(error?.message ? `${error.message}${code}` : `Google sign-in failed${code}`)
        return
      }

      if (cancelled) return

      // 2) If already signed in, continue.
      if (auth.currentUser) {
        clearRedirectFlag()
        router.replace(nextPath)
        return
      }

      // 3) If this is our first attempt (no flag), start redirect now.
      if (!startedAt) {
        setRedirectStartedNow()
        const provider = new GoogleAuthProvider()
        await signInWithRedirect(auth, provider)
        return
      }

      // 4) Redirect was already started. Give Firebase time to hydrate.
      if (Date.now() - startedAt > REDIRECT_TIMEOUT_MS) {
        clearRedirectFlag()
        setErrorMessage('Sign-in did not complete. Please try again. If it keeps failing, ensure this domain is added under Firebase Auth → Authorized domains and that browser privacy extensions are not blocking the flow.')
      }
    }

    run().catch(() => {
      // If redirect initiation fails, fall back to account page.
      router.replace('/account')
    })

    return () => {
      cancelled = true
      try {
        unsubscribeAuth?.()
      } catch {}
    }
  }, [router.isReady, nextPath])

  if (errorMessage) {
    return <p style={{ padding: 24 }}>{errorMessage}</p>
  }

  return <p style={{ padding: 24 }}>Redirecting to Google sign-in…</p>
}
