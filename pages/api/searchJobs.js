import { getFirestoreDb, getJobsCollectionName } from '../../src/lib/firebaseAdmin.js'
import {
  normalizeText,
  scoreSearchResult,
  serializeJob,
  splitCsv,
  toMillis
} from '../../src/lib/jobSearch.js'

const DEFAULT_LIMIT = 20
const BATCH_SIZE = 50
const CANDIDATE_TARGET = 120

function matchesQuery(job, query) {
  if (!query) return true

  const q = query.toLowerCase()

  return (
    job.title?.toLowerCase().includes(q)
    || job.company?.toLowerCase().includes(q)
    || job.description?.toLowerCase().includes(q)
    || (Array.isArray(job.skills) && job.skills.some(skill => String(skill).toLowerCase().includes(q)))
  )
}

function matchesFilters(job, { location, remoteType, experienceLevel, skills }) {
  if (location) {
    const normalizedLocation = normalizeText(location)
    if (!(job.locationKeywords || []).includes(normalizedLocation)) {
      return false
    }
  }

  if (remoteType) {
    if (normalizeText(job.remoteType || '') !== normalizeText(remoteType)) {
      return false
    }
  }

  if (experienceLevel) {
    if (normalizeText(job.experienceLevel || '') !== normalizeText(experienceLevel)) {
      return false
    }
  }

  if (skills.length > 0) {
    const jobSkills = (job.skillsNormalized || []).map(value => normalizeText(value))
    const hasSkillOverlap = skills.some(skill => jobSkills.includes(skill))
    if (!hasSkillOverlap) {
      return false
    }
  }

  return true
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const query = String(req.query?.keyword || req.query?.query || '').trim()
    const location = String(req.query?.location || '').trim()
    const company = String(req.query?.company || '').trim()
    const remoteParam = String(req.query?.remote || '').trim().toLowerCase()
    const onsiteParam = String(req.query?.onsite || '').trim().toLowerCase()
    const remoteType = remoteParam === 'true'
      ? 'remote'
      : onsiteParam === 'true'
        ? 'onsite'
        : String(req.query?.remoteType || '').trim()
    const experienceLevel = String(req.query?.experienceLevel || '').trim()
    const skills = splitCsv(req.query?.skills || '')
    const cursorValue = Number(req.query?.cursor || 0)
    const limit = DEFAULT_LIMIT

    const db = getFirestoreDb()
    const collectionName = getJobsCollectionName()
    let baseQuery = db.collection(collectionName).orderBy('scrapedAt', 'desc')

    // Embeddings are optional; ranking will fall back to keyword + skill + recency
    const queryEmbedding = null
    const candidates = []
    let scanned = 0
    let hasMore = false
    let lastVisible = null
    let paginationCursor = Number.isFinite(cursorValue) && cursorValue > 0 ? new Date(cursorValue) : null

    while (scanned < CANDIDATE_TARGET) {
      let nextQuery = baseQuery.limit(BATCH_SIZE)
      if (paginationCursor) {
        nextQuery = nextQuery.startAfter(paginationCursor)
      }

      const snapshot = await nextQuery.get()
      if (snapshot.empty) {
        hasMore = false
        break
      }

      lastVisible = snapshot.docs[snapshot.docs.length - 1]
      scanned += snapshot.docs.length

      for (const document of snapshot.docs) {
        const job = document.data()

        if (!matchesQuery(job, query)) {
          continue
        }

        if (company && !String(job.company || '').toLowerCase().includes(company.toLowerCase())) {
          continue
        }

        if (!matchesFilters(job, { location, remoteType, experienceLevel, skills })) {
          continue
        }

        const ranking = scoreSearchResult(job, { query, queryEmbedding, skills })
        if (!ranking) {
          continue
        }

        candidates.push({
          ...serializeJob(document.id, job),
          ...ranking
        })
      }

      if (snapshot.docs.length < BATCH_SIZE) {
        hasMore = false
        break
      }

      if (scanned >= CANDIDATE_TARGET) {
        hasMore = true
        break
      }

      hasMore = true
      paginationCursor = lastVisible.get('scrapedAt')
    }

    candidates.sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return toMillis(right.scrapedAt) - toMillis(left.scrapedAt)
    })

    return res.status(200).json({
      jobs: candidates.slice(0, limit),
      hasMore,
      nextCursor: hasMore && lastVisible ? String(toMillis(lastVisible.get('scrapedAt'))) : null
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: error.message || 'Search failed' })
  }
}