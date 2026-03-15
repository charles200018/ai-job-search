import { useAuth } from '../src/context/AuthContext.js'

export default function AccountPage() {
  const { user, authError, loginWithGoogle, logout } = useAuth()

  return (
    <div className="relative min-h-screen overflow-hidden px-5 py-8 sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute inset-x-0 top-[-160px] h-[360px] bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.24),_transparent_40%),radial-gradient(circle_at_top_right,_rgba(251,146,60,0.16),_transparent_35%)]" />
      <main className="relative mx-auto max-w-4xl rounded-[32px] border border-stone-200 bg-white/90 p-8 shadow-[0_30px_120px_rgba(28,25,23,0.08)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">Account</p>
        <h1 className="mt-3 text-5xl font-semibold text-stone-950" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
          Manage your signed-in profile
        </h1>

        {authError ? (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{authError}</p>
        ) : null}

        <div className="mt-8 rounded-[24px] border border-stone-200 bg-stone-50/80 p-6">
          {user ? (
            <div className="space-y-3 text-sm text-stone-700">
              <p><span className="font-semibold">Name:</span> {user.displayName || 'Not available'}</p>
              <p><span className="font-semibold">Email:</span> {user.email || 'Not available'}</p>
              <p><span className="font-semibold">UID:</span> {user.uid}</p>
              <div className="pt-2">
                <button
                  onClick={logout}
                  className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-orange-400 hover:text-orange-700"
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-stone-700">You are currently signed out. Sign in to use resume upload and personalized features.</p>
              <button
                onClick={loginWithGoogle}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-orange-400 hover:text-orange-700"
              >
                Sign in with Google
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
