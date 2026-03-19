import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../src/context/AuthContext.js'

function getSafeNextPath(nextValue) {
  if (typeof nextValue !== 'string') return '/account'
  if (!nextValue.startsWith('/')) return '/account'
  if (nextValue.startsWith('//')) return '/account'
  return nextValue
}

export default function SignInPage() {
  const router = useRouter()
  const { user, authError, loginWithGoogleRedirect } = useAuth()

  useEffect(() => {
    if (!router.isReady) return

    const nextPath = getSafeNextPath(router.query.next)

    if (user) {
      router.replace(nextPath)
      return
    }

    loginWithGoogleRedirect().catch(() => {
      // error is shown via authError
    })
  }, [router.isReady, router.query.next, user])

  return (
    <div className="relative min-h-screen overflow-hidden px-5 py-8 sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute inset-x-0 top-[-160px] h-[360px] bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.24),_transparent_40%),radial-gradient(circle_at_top_right,_rgba(251,146,60,0.16),_transparent_35%)]" />
      <main className="relative mx-auto max-w-2xl rounded-[32px] border border-stone-200 bg-white/90 p-8 shadow-[0_30px_120px_rgba(28,25,23,0.08)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">Authentication</p>
        <h1 className="mt-3 text-4xl font-semibold text-stone-950" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
          Redirecting to Google sign-in…
        </h1>

        {authError ? (
          <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{authError}</p>
        ) : (
          <p className="mt-5 text-sm text-stone-700">If nothing happens, allow popups/redirects and try again.</p>
        )}

        <div className="mt-6">
          <a href="/account" className="text-sm font-semibold text-teal-700 hover:text-orange-700">Go to Account</a>
        </div>
      </main>
    </div>
  )
}
