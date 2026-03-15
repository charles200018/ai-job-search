import '../styles/globals.css'
import { AuthProvider } from '../src/context/AuthContext.js'
import { useAuth } from '../src/context/AuthContext.js'

function AppMenu() {
  const { user, loginWithGoogle, logout } = useAuth()

  return (
    <nav className="sticky top-0 z-50 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8 lg:px-12">
        <div className="flex items-center gap-2 text-sm font-semibold text-stone-700">
          <a className="rounded-full px-3 py-2 transition hover:bg-stone-100" href="/">Home</a>
          <a className="rounded-full px-3 py-2 transition hover:bg-stone-100" href="/account">Account</a>
          <a className="rounded-full px-3 py-2 transition hover:bg-stone-100" href="/profile">Resume Upload</a>
          <a className="rounded-full px-3 py-2 transition hover:bg-stone-100" href="/history">Search History</a>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="rounded-full border border-stone-300 px-3 py-2 text-xs font-medium text-stone-600">
                {user.displayName || user.email || 'Signed in'}
              </span>
              <button
                onClick={logout}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-orange-400 hover:text-orange-700"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={loginWithGoogle}
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-orange-400 hover:text-orange-700"
            >
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}

function AppLayout({ Component, pageProps }) {
  return (
    <>
      <AppMenu />
      <Component {...pageProps} />
    </>
  )
}

function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <AppLayout Component={Component} pageProps={pageProps} />
    </AuthProvider>
  )
}

export default MyApp
