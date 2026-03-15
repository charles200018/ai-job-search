export function normalizeText(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s,/+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean))]
}

export function splitCsv(value = '') {
  return uniqueStrings(
    String(value)
      .split(',')
      .map(item => normalizeText(item))
      .filter(Boolean)
  )
}

export function tokenize(value = '') {
  return uniqueStrings(normalizeText(value).split(' ').filter(token => token.length > 1))
}

export function normalizeRemoteType(value) {
  const normalized = normalizeText(value)
  if (normalized.includes('hybrid')) return 'hybrid'
  if (normalized.includes('remote') || normalized === 'true') return 'remote'
  if (normalized.includes('site') || normalized.includes('office')) return 'onsite'
  return 'remote'
}

export function normalizeExperienceLevel(value) {
  const normalized = normalizeText(value)
  if (!normalized) return 'Mid'
  if (normalized.includes('intern')) return 'Intern'
  if (normalized.includes('junior') || normalized.includes('entry')) return 'Junior'
  if (normalized.includes('lead')) return 'Lead'
  if (normalized.includes('staff')) return 'Staff'
  if (normalized.includes('principal')) return 'Principal'
  if (normalized.includes('senior')) return 'Senior'
  return 'Mid'
}

export function normalizeSalary(value) {
  if (!value) return 'Salary not listed'
  if (typeof value === 'number') return `$${value.toLocaleString()}`
  if (typeof value === 'object') {
    const min = value.min ? `$${Number(value.min).toLocaleString()}` : null
    const max = value.max ? `$${Number(value.max).toLocaleString()}` : null
    if (min && max) return `${min} - ${max}`
  }
  return String(value).trim()
}

export function formatSkills(rawSkills) {
  if (Array.isArray(rawSkills)) {
    return uniqueStrings(rawSkills.map(skill => String(skill).trim()).filter(Boolean))
  }

  if (typeof rawSkills === 'string') {
    return uniqueStrings(rawSkills.split(',').map(skill => skill.trim()).filter(Boolean))
  }

  return []
}

export function buildLocationKeywords(location) {
  const normalized = normalizeText(location)
  if (!normalized) return []

  const segments = normalized
    .split(/[\/,|-]/)
    .map(part => part.trim())
    .filter(Boolean)

  return uniqueStrings([
    normalized,
    ...segments,
    ...segments.flatMap(segment => segment.split(' ').filter(Boolean))
  ])
}

function toSlug(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function createFirestoreJobId(raw) {
  const explicitId = raw.id || raw.job_id || raw.external_id
  if (explicitId) return String(explicitId)

  const parts = [raw.title || raw.position, raw.company || raw.company_name, raw.location || raw.city]
  return toSlug(parts.filter(Boolean).join('-')) || `job-${Date.now()}`
}

export function toDate(value) {
  if (!value) return new Date()
  if (value instanceof Date) return value
  if (typeof value?.toDate === 'function') return value.toDate()
  const converted = new Date(value)
  return Number.isNaN(converted.getTime()) ? new Date() : converted
}

export function toMillis(value) {
  return toDate(value).getTime()
}

export function toIsoString(value) {
  return toDate(value).toISOString()
}

export function serializeJob(jobId, job) {
  return {
    id: jobId,
    ...job,
    scrapedAt: toIsoString(job.scrapedAt)
  }
}

export function normalizeJobDocument(raw) {
  const title = String(raw.title || raw.position || raw.role || 'Untitled role').trim()
  const company = String(raw.company || raw.company_name || raw.organization || 'Unknown company').trim()
  const location = String(raw.location || raw.city || raw.region || 'Unspecified').trim()
  const remoteType = normalizeRemoteType(raw.remoteType || raw.remote || raw.workplaceType || raw.workplace_type)
  const experienceLevel = normalizeExperienceLevel(raw.experienceLevel || raw.level || raw.seniority)
  const skills = formatSkills(raw.skills || raw.tags || raw.technologies || raw.tech_stack)
  const description = String(raw.description || raw.body || raw.summary || '').trim()
  const applyUrl = String(raw.applyUrl || raw.apply_url || raw.application_url || raw.url || raw.job_url || '').trim()
  const scrapedAt = toDate(raw.scrapedAt || raw.scraped_at || raw.posted_at || Date.now())

  return {
    title,
    company,
    location,
    locationKeywords: buildLocationKeywords(location),
    locationNormalized: normalizeText(location),
    remoteType,
    remoteTypeNormalized: normalizeText(remoteType),
    experienceLevel,
    experienceLevelNormalized: normalizeText(experienceLevel),
    salary: normalizeSalary(raw.salary || raw.salary_range || raw.compensation || raw.salaryRange),
    skills,
    skillsNormalized: skills.map(skill => normalizeText(skill)).filter(Boolean),
    description,
    searchText: normalizeText([title, company, location, description, skills.join(' ')].join(' ')),
    applyUrl,
    embedding: Array.isArray(raw.embedding) ? raw.embedding : [],
    scrapedAt
  }
}

export function computeKeywordStats(job, query) {
  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) {
    return { matched: true, score: 0 }
  }

  const normalizedTitle = normalizeText(job.title)
  const normalizedDescription = normalizeText(job.description)
  const normalizedSkills = normalizeText((job.skills || []).join(' '))
  const normalizedCompany = normalizeText(job.company)
  let titleHits = 0
  let descriptionHits = 0
  let skillsHits = 0
  let companyHits = 0

  for (const token of queryTokens) {
    if (normalizedTitle.includes(token)) titleHits += 1
    if (normalizedDescription.includes(token)) descriptionHits += 1
    if (normalizedSkills.includes(token)) skillsHits += 1
    if (normalizedCompany.includes(token)) companyHits += 1
  }

  const totalHits = titleHits + descriptionHits + skillsHits + companyHits
  return {
    matched: totalHits > 0,
    score: totalHits === 0 ? 0 : ((titleHits * 2.8) + (descriptionHits * 1.2) + (skillsHits * 2.0) + (companyHits * 1.0)) / queryTokens.length
  }
}

export function cosineSimilarity(first = [], second = []) {
  if (!Array.isArray(first) || !Array.isArray(second) || first.length === 0 || second.length === 0 || first.length !== second.length) {
    return 0
  }

  let dotProduct = 0
  let firstMagnitude = 0
  let secondMagnitude = 0

  for (let index = 0; index < first.length; index += 1) {
    dotProduct += first[index] * second[index]
    firstMagnitude += first[index] * first[index]
    secondMagnitude += second[index] * second[index]
  }

  if (firstMagnitude === 0 || secondMagnitude === 0) {
    return 0
  }

  return dotProduct / (Math.sqrt(firstMagnitude) * Math.sqrt(secondMagnitude))
}

export function scoreSearchResult(job, { query, queryEmbedding, skills = [] }) {
  const keywordStats = computeKeywordStats(job, query)
  if (query && !keywordStats.matched) {
    return null
  }

  const skillOverlap = skills.length === 0
    ? 0
    : skills.filter(skill => (job.skillsNormalized || []).includes(skill)).length / skills.length

  if (skills.length > 0 && skillOverlap === 0) {
    return null
  }

  const embeddingScore = queryEmbedding?.length ? Math.max(0, cosineSimilarity(job.embedding || [], queryEmbedding)) : 0
  const recencyScore = Math.max(0, 1 - ((Date.now() - toMillis(job.scrapedAt)) / (1000 * 60 * 60 * 24 * 30)))
  const score = query
    ? (keywordStats.score * 0.6) + (embeddingScore * 0.3) + (skillOverlap * 0.07) + (recencyScore * 0.03)
    : (skillOverlap * 0.65) + (embeddingScore * 0.25) + (recencyScore * 0.1)

  return {
    keywordScore: keywordStats.score,
    embeddingScore,
    skillOverlap,
    score
  }
}