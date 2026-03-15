import { useEffect, useState } from 'react'
import { useAuth } from '../src/context/AuthContext.js'

function buildSearchHref(item) {
  const params = new URLSearchParams()
  if (item.query) params.set('query', item.query)
  if (item.filters?.company) params.set('company', item.filters.company)
  if (item.filters?.location) params.set('location', item.filters.location)
  if (item.filters?.remoteType) params.set('remoteType', item.filters.remoteType)
  if (item.filters?.experienceLevel) params.set('experienceLevel', item.filters.experienceLevel)
  if (Array.isArray(item.filters?.skills) && item.filters.skills.length > 0) {
    params.set('skills', item.filters.skills.join(','))
  }
  return `/?${params.toString()}`
}

export default function HistoryPage() {
  const { user, loginWithGoogle, getCurrentIdToken } = useAuth()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadHistory() {
      if (!user) {
        if (!cancelled) {
          setHistory([])
          setLoading(false)
        }
        return
      }

      setLoading(true)
      setMessage('')

      try {
        const token = await getCurrentIdToken()
        const response = await fetch('/api/getSearchHistory', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load search history')
        }

        if (!cancelled) {
          setHistory(Array.isArray(payload.history) ? payload.history : [])
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error.message || 'Failed to load search history')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadHistory()
    return () => {
      cancelled = true
    }
  }, [user, getCurrentIdToken])

  async function clearAll() {
    if (!user) return

    try {
      const token = await getCurrentIdToken()
      const response = await fetch('/api/deleteSearchHistory', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to clear search history')
      }
      setHistory([])
      setMessage(`Deleted ${payload.deletedCount || 0} history item(s).`)
    } catch (error) {
      setMessage(error.message || 'Failed to clear search history')
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-5 py-8 sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute inset-x-0 top-[-120px] h-[340px] bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.2),_transparent_48%),radial-gradient(circle_at_right,_rgba(251,146,60,0.18),_transparent_35%)]" />
      <main className="relative mx-auto max-w-5xl space-y-6">
        <header className="rounded-[28px] border border-stone-200 bg-white/85 p-6 shadow-[0_24px_80px_rgba(28,25,23,0.08)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">Search History</p>
          <h1 className="mt-2 text-4xl font-semibold text-stone-950" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
            Re-run your recent searches
          </h1>
          <p className="mt-2 text-sm text-stone-600">Stored securely per signed-in account.</p>
          {user ? (
            <button
              onClick={clearAll}
              className="mt-4 rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-orange-400 hover:text-orange-700"
            >
              Clear history
            </button>
          ) : (
            <button
              onClick={loginWithGoogle}
              className="mt-4 rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-orange-400 hover:text-orange-700"
            >
              Sign in with Google
            </button>
          )}
        </header>

        {message ? (
          <div className="rounded-[18px] border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">{message}</div>
        ) : null}

        {!user ? (
          <div className="rounded-[24px] border border-dashed border-stone-300 bg-white/75 p-8 text-center text-sm text-stone-600">
            Sign in to view your search history.
          </div>
        ) : null}

        {user && loading ? (
          <div className="rounded-[24px] border border-stone-200 bg-white/80 px-5 py-4 text-sm text-stone-600">Loading search history...</div>
        ) : null}

        {user && !loading && history.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-stone-300 bg-white/75 p-8 text-center text-sm text-stone-600">
            No saved search history yet. Perform a few searches on the home page first.
          </div>
        ) : null}

        {user && !loading && history.length > 0 ? (
          <div className="space-y-4">
            {history.map((item, index) => (
              <article key={`${item.searchedAt}-${index}`} className="rounded-[22px] border border-stone-200 bg-white/90 p-5 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1 text-sm text-stone-700">
                    <p className="font-semibold text-stone-900">{item.query || 'All jobs'}</p>
                    <p>Company: {item.filters?.company || 'Any'} · Location: {item.filters?.location || 'Any'} · Workplace: {item.filters?.remoteType || 'Any'}</p>
                    <p>Experience: {item.filters?.experienceLevel || 'Any'} · Skills: {Array.isArray(item.filters?.skills) && item.filters.skills.length > 0 ? item.filters.skills.join(', ') : 'Any'}</p>
                    <p className="text-xs text-stone-500">{item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Unknown time'} · {item.resultCount || 0} result(s)</p>
                  </div>
                  <a
                    href={buildSearchHref(item)}
                    className="inline-flex items-center justify-center rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
                  >
                    Run this search
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </main>
    </div>
  )
}
