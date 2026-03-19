import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { getApps, initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth, getRedirectResult, onAuthStateChanged, signInWithRedirect } from 'firebase/auth'

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

    async function run() {
      // 1) If we're returning from Google, resolve the pending redirect.
      try {
        const result = await getRedirectResult(auth)
        if (result?.user) {
          try {
            sessionStorage.removeItem('authRedirectStarted')
          } catch {}

          router.replace(nextPath)
          return
        }
      } catch (error) {
        // If Firebase returns an error after redirect, stop looping and show it.
        const code = error?.code ? ` (${error.code})` : ''
        setErrorMessage(error?.message ? `${error.message}${code}` : `Google sign-in failed${code}`)
        try {
          sessionStorage.removeItem('authRedirectStarted')
        } catch {}
        return
      }

      // 2) Wait briefly for auth state to hydrate (auth.currentUser can be null momentarily).
      const hydratedUser = await new Promise(resolve => {
        let settled = false
        const unsubscribe = onAuthStateChanged(auth, user => {
          if (settled) return
          settled = true
          unsubscribe()
          resolve(user || null)
        })

        setTimeout(() => {
          if (settled) return
          settled = true
          unsubscribe()
          resolve(auth.currentUser || null)
        }, 2000)
      })

      if (hydratedUser) {
        try {
          sessionStorage.removeItem('authRedirectStarted')
        } catch {}

        router.replace(nextPath)
        return
      }

      if (cancelled) return

      // 3) Avoid infinite redirect loops if sign-in fails (unauthorized domain, cookies blocked, etc.)
      let alreadyStarted = false
      try {
        alreadyStarted = sessionStorage.getItem('authRedirectStarted') === '1'
      } catch {}

      if (alreadyStarted) {
        setErrorMessage('Sign-in did not complete. Open /account and click “Sign in with Google”, and ensure this domain is added under Firebase Auth → Authorized domains.')
        return
      }

      try {
        sessionStorage.setItem('authRedirectStarted', '1')
      } catch {}

      // Start redirect-based sign-in.
      const provider = new GoogleAuthProvider()
      await signInWithRedirect(auth, provider)
    }

    run().catch(() => {
      // If redirect initiation fails, fall back to account page.
      router.replace('/account')
    })

    return () => {
      cancelled = true
    }
  }, [router.isReady, nextPath])

  if (errorMessage) {
    return <p style={{ padding: 24 }}>{errorMessage}</p>
  }

  return <p style={{ padding: 24 }}>Redirecting to Google sign-in…</p>
}
