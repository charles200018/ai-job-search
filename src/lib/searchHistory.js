const STORAGE_KEY = 'job_search_history_v1'
const MAX_ENTRIES = 25

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function readSearchHistory() {
  if (!isBrowser()) return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function clearSearchHistory() {
  if (!isBrowser()) return
  window.localStorage.removeItem(STORAGE_KEY)
}

export function addSearchHistoryEntry(entry) {
  if (!isBrowser()) return

  const normalized = {
    query: String(entry?.query || '').trim(),
    company: String(entry?.company || '').trim(),
    location: String(entry?.location || '').trim(),
    remoteType: String(entry?.remoteType || '').trim(),
    experienceLevel: String(entry?.experienceLevel || '').trim(),
    skills: String(entry?.skills || '').trim(),
    totalResults: Number(entry?.totalResults || 0),
    searchedAt: new Date().toISOString(),
  }

  const previous = readSearchHistory()
  const deduped = previous.filter(item => {
    return !(
      item.query === normalized.query
      && item.company === normalized.company
      && item.location === normalized.location
      && item.remoteType === normalized.remoteType
      && item.experienceLevel === normalized.experienceLevel
      && item.skills === normalized.skills
    )
  })

  const next = [normalized, ...deduped].slice(0, MAX_ENTRIES)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}
