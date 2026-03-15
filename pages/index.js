import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../src/context/AuthContext.js'

const DEFAULT_FILTERS = {
  query: '',
  company: '',
  location: '',
  remoteType: '',
  experienceLevel: '',
  skills: ''
}

const REMOTE_OPTIONS = [
  { label: 'Any workplace', value: '' },
  { label: 'Remote', value: 'remote' },
  { label: 'Hybrid', value: 'hybrid' },
  { label: 'Onsite', value: 'onsite' }
]

const FALLBACK_EXPERIENCE = ['Intern', 'Junior', 'Mid', 'Senior', 'Lead', 'Staff', 'Principal']

const QUICK_PRESETS = [
  { label: 'Remote React', values: { query: 'react', remoteType: 'remote', skills: 'react,typescript' } },
  { label: 'Backend Node', values: { query: 'backend', skills: 'node,typescript,api' } },
  { label: 'Senior Roles', values: { experienceLevel: 'Senior' } },
  { label: 'AI / ML', values: { query: 'machine learning', skills: 'python,ml,ai' } },
]

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
      <span>{label}</span>
      <select
        value={value}
        onChange={onChange}
        className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm outline-none transition focus:border-orange-400"
      >
        {options.map(option => (
          <option key={option.value || 'all'} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function SkillPill({ children }) {
  return (
    <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
      {children}
    </span>
  )
}

function JobCard({ job }) {
  return (
    <article className="rounded-[28px] border border-stone-200 bg-white/90 p-6 shadow-[0_24px_80px_rgba(28,25,23,0.08)] backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-600">{job.remoteType || 'Flexible'}</p>
            <a href={`/jobs/${encodeURIComponent(job.id)}`} className="mt-2 block text-2xl font-semibold text-stone-950 transition hover:text-orange-700">
              {job.title}
            </a>
            <p className="mt-1 text-sm text-stone-600">{job.company} · {job.location}</p>
          </div>

          <p className="max-w-3xl text-sm leading-7 text-stone-600">
            {job.description?.slice(0, 220) || 'No description available for this role.'}
            {job.description?.length > 220 ? '…' : ''}
          </p>

          <div className="flex flex-wrap gap-2">
            {(job.skills || []).slice(0, 8).map(skill => (
              <SkillPill key={skill}>{skill}</SkillPill>
            ))}
          </div>
        </div>

        <div className="flex min-w-[220px] flex-col gap-3 lg:items-end">
          <p className="text-right text-sm font-medium text-stone-500">{job.salary || 'Compensation not listed'}</p>
          <p className="text-right text-xs uppercase tracking-[0.24em] text-stone-400">{job.experienceLevel || 'Open level'}</p>
          <div className="flex flex-col gap-3 lg:items-end">
            <a
              href={job.applyUrl || '#'}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
            >
              Apply on Company Website
            </a>
            <span className="text-xs text-stone-400">
              Match {Math.max(0, Math.round((job.score || 0) * 100))}%
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function Home() {
  const router = useRouter()
  const { user, authError, getCurrentIdToken } = useAuth()
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [meta, setMeta] = useState({ locations: [], experienceLevels: [] })
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const sentinelRef = useRef(null)

  useEffect(() => {
    if (!router.isReady) return

    const queryFilters = {
      query: String(router.query.query || ''),
      company: String(router.query.company || ''),
      location: String(router.query.location || ''),
      remoteType: String(router.query.remoteType || ''),
      experienceLevel: String(router.query.experienceLevel || ''),
      skills: String(router.query.skills || ''),
    }

    const hasQueryFilter = Object.values(queryFilters).some(Boolean)
    if (hasQueryFilter) {
      setFilters(current => ({ ...current, ...queryFilters }))
    }
  }, [router.isReady, router.query])

  const experienceOptions = useMemo(() => {
    const values = meta.experienceLevels.length > 0 ? meta.experienceLevels : FALLBACK_EXPERIENCE
    return [{ label: 'Any level', value: '' }, ...values.map(value => ({ label: value, value }))]
  }, [meta.experienceLevels])

  const locationOptions = useMemo(
    () => [{ label: 'All locations', value: '' }, ...meta.locations.map(value => ({ label: value, value }))],
    [meta.locations]
  )

  useEffect(() => {
    let cancelled = false

    async function loadMeta() {
      try {
        const response = await fetch('/api/searchMeta')
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load filter options')
        }
        if (!cancelled) {
          setMeta({
            locations: payload.locations || [],
            experienceLevels: payload.experienceLevels || []
          })
        }
      } catch (metaError) {
        if (!cancelled) {
          setError(metaError.message)
        }
      }
    }

    loadMeta()
    return () => {
      cancelled = true
    }
  }, [])

  async function fetchJobs({ append = false, cursor = '' } = {}) {
    const params = new URLSearchParams()
    if (filters.query) params.set('query', filters.query)
    if (filters.company) params.set('company', filters.company)
    if (filters.location) params.set('location', filters.location)
    if (filters.remoteType) params.set('remoteType', filters.remoteType)
    if (filters.experienceLevel) params.set('experienceLevel', filters.experienceLevel)
    if (filters.skills) params.set('skills', filters.skills)
    if (cursor) params.set('cursor', cursor)

    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setError('')
    }

    try {
      const token = await getCurrentIdToken().catch(() => null)
      const response = await fetch(`/api/searchJobs?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Search failed')
      }

      setJobs(previous => (append ? [...previous, ...(payload.jobs || [])] : payload.jobs || []))
      setHasMore(Boolean(payload.hasMore))
      setNextCursor(payload.nextCursor || null)
    } catch (searchError) {
      setError(searchError.message)
      if (!append) {
        setJobs([])
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setNextCursor(null)
      setHasMore(false)
      fetchJobs({ append: false })
    }, 250)

    return () => clearTimeout(timeoutId)
  }, [filters.query, filters.company, filters.location, filters.remoteType, filters.experienceLevel, filters.skills])
  

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore || loading || loadingMore || !nextCursor) {
      return undefined
    }

    const observer = new IntersectionObserver(entries => {
      const [entry] = entries
      if (entry?.isIntersecting) {
        fetchJobs({ append: true, cursor: nextCursor })
      }
    }, { rootMargin: '320px' })

    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, nextCursor])

  function updateFilter(key) {
    return event => {
      setFilters(current => ({ ...current, [key]: event.target.value }))
    }
  }

  function applyPreset(values) {
    setFilters(current => ({ ...current, ...values }))
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-stone-950">
      <div className="pointer-events-none absolute inset-x-0 top-[-120px] h-[420px] bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.28),_transparent_58%),radial-gradient(circle_at_right,_rgba(20,184,166,0.18),_transparent_35%)]" />
      <main className="relative mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12">
        <header className="mb-10 rounded-[32px] border border-stone-200 bg-white/80 p-8 shadow-[0_30px_120px_rgba(28,25,23,0.08)] backdrop-blur">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-orange-600">AI Job Search Platform</p>
            <h1 className="mt-4 text-5xl font-semibold leading-tight text-stone-950 sm:text-6xl" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
              Search faster, filter harder, and match your resume against real openings.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-stone-600">
              Keyword search, live filters, and OpenAI-powered ranking on top of a Firestore job dataset scraped with Firecrawl.
            </p>
          </div>

          <div className="mt-7 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {QUICK_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset.values)}
                  className="rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-700 transition hover:border-orange-400 hover:text-orange-700"
                >
                  {preset.label}
                </button>
              ))}
              <a
                href="#results"
                className="rounded-full bg-stone-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-orange-600"
              >
                Jump to Results
              </a>
            </div>

            <p className="text-sm text-stone-600">
              {user ? `Signed in as ${user.displayName || user.email || 'user'}.` : 'Sign in from the top menu to save history and resume data.'}
            </p>
          </div>
        </header>

        {authError ? (
          <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{authError}</p>
        ) : null}

        <section className="grid gap-8 lg:grid-cols-[320px,minmax(0,1fr)]">
          <aside className="h-fit rounded-[28px] border border-stone-200 bg-white/85 p-6 shadow-[0_24px_80px_rgba(28,25,23,0.06)] backdrop-blur">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">Live Search</p>
              <h2 className="mt-3 text-2xl font-semibold text-stone-950" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                Advanced Filters
              </h2>
            </div>

            <div className="space-y-5">
              <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
                <span>Keywords</span>
                <input
                  value={filters.query}
                  onChange={updateFilter('query')}
                  placeholder="react, backend, product designer"
                  className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm outline-none transition focus:border-orange-400"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
                <span>Company</span>
                <input
                  value={filters.company}
                  onChange={updateFilter('company')}
                  placeholder="stripe, airbnb, notion"
                  className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm outline-none transition focus:border-orange-400"
                />
              </label>

              <FilterSelect label="Location" value={filters.location} onChange={updateFilter('location')} options={locationOptions} />
              <FilterSelect label="Workplace" value={filters.remoteType} onChange={updateFilter('remoteType')} options={REMOTE_OPTIONS} />
              <FilterSelect label="Experience" value={filters.experienceLevel} onChange={updateFilter('experienceLevel')} options={experienceOptions} />

              <label className="flex flex-col gap-2 text-sm font-medium text-stone-700">
                <span>Skills</span>
                <input
                  value={filters.skills}
                  onChange={updateFilter('skills')}
                  placeholder="react, typescript, node"
                  className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm outline-none transition focus:border-orange-400"
                />
              </label>

              <button
                type="button"
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="w-full rounded-full border border-stone-300 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              >
                Reset filters
              </button>
            </div>
          </aside>

          <section id="results" className="space-y-5">
            <div className="flex items-center justify-between rounded-[28px] border border-stone-200 bg-white/75 px-6 py-4 shadow-[0_20px_60px_rgba(28,25,23,0.05)] backdrop-blur">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">Results</p>
                <h2 className="mt-1 text-2xl font-semibold text-stone-950" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                  {loading ? 'Searching jobs…' : `${jobs.length} jobs loaded`}
                </h2>
              </div>
              <p className="text-sm text-stone-500">20 jobs per page with infinite scroll</p>
            </div>

            {error ? (
              <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{error}</div>
            ) : null}

            {!loading && jobs.length === 0 && !error ? (
              <div className="rounded-[28px] border border-dashed border-stone-300 bg-white/75 p-10 text-center shadow-[0_20px_60px_rgba(28,25,23,0.05)]">
                <h3 className="text-2xl font-semibold text-stone-950" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>No jobs matched this search</h3>
                <p className="mt-3 text-sm leading-7 text-stone-600">Try broadening location, lowering the skill filter, or using fewer keywords.</p>
              </div>
            ) : null}

            <div className="space-y-5">
              {jobs.map(job => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>

            {loading ? (
              <div className="rounded-[24px] border border-stone-200 bg-white/80 px-5 py-4 text-sm text-stone-500">Ranking jobs using keyword match and embeddings…</div>
            ) : null}

            {loadingMore ? (
              <div className="rounded-[24px] border border-stone-200 bg-white/80 px-5 py-4 text-sm text-stone-500">Loading more jobs…</div>
            ) : null}

            <div ref={sentinelRef} className="h-8" />
          </section>
        </section>
      </main>
    </div>
  )
}
