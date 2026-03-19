import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import { getApps, initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth, getRedirectResult, signInWithRedirect } from 'firebase/auth'

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
      // If we're returning from Google, this resolves the pending redirect.
      try {
        const result = await getRedirectResult(auth)
        if (result?.user) {
          router.replace(nextPath)
          return
        }
      } catch {
        // Ignore; if redirect failed user can retry.
      }

      if (cancelled) return

      // If user is already signed in, continue.
      if (auth.currentUser) {
        router.replace(nextPath)
        return
      }

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

  return <p style={{ padding: 24 }}>Redirecting to Google sign-in…</p>
}
