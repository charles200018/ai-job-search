import dotenv from 'dotenv'
import { getFirestoreDb, getJobsCollectionName } from '../lib/firebaseAdmin.js'
import { createFirestoreJobId, normalizeJobDocument } from '../lib/jobSearch.js'

dotenv.config()

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY
const FIRECRAWL_SCRAPE_ENDPOINT = 'https://api.firecrawl.dev/v1/scrape'
const MAX_LISTING_JOBS_PER_SOURCE = Number(process.env.FIRECRAWL_PAGE_SIZE || 50)
const DETAIL_TIMEOUT_MS = 90000

const SKILL_KEYWORDS = [
  'react',
  'node',
  'node.js',
  'typescript',
  'javascript',
  'python',
  'django',
  'flask',
  'fastapi',
  'java',
  'spring',
  'kotlin',
  'swift',
  'ios',
  'android',
  'go',
  'golang',
  'rust',
  'c++',
  'c#',
  '.net',
  'aws',
  'gcp',
  'azure',
  'docker',
  'kubernetes',
  'terraform',
  'postgresql',
  'mysql',
  'mongodb',
  'redis',
  'graphql',
  'rest api',
  'machine learning',
  'llm',
  'ai',
  'data engineering',
  'frontend',
  'backend',
  'full stack',
  'firebase'
]

if (!FIRECRAWL_API_KEY) {
  console.error('Set FIRECRAWL_API_KEY in .env')
  process.exit(1)
}

function getJobSources() {
  const configuredSources = Object.entries(process.env)
    .filter(([key, value]) => key.startsWith('JOB_SOURCE_') && String(value || '').trim())
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey, undefined, { numeric: true }))
    .map(([, value]) => String(value).trim())

  if (configuredSources.length > 0) {
    return configuredSources
  }

  if (process.env.FIRECRAWL_SCRAPE_URL) {
    return [String(process.env.FIRECRAWL_SCRAPE_URL).trim()]
  }

  return []
}

function getSourceConfig(sourceUrl) {
  const host = new URL(sourceUrl).hostname.replace(/^www\./, '')

  if (host.includes('remoteok.com')) {
    return {
      listingPrompt: 'Extract real remote tech jobs from this page. Prefer software engineering, frontend, backend, full-stack, AI, data, and developer roles. Return each job with title, company, location, salary, short description, visible skills or tags, and the job detail or apply URL.',
      detailPrompt: 'Extract the complete job description, requirements, responsibilities, skills, technologies, location, salary, remote or onsite status, and experience level from this job page.',
      isJobLink: url => url.hostname.includes('remoteok.com') && (url.pathname.includes('/remote-jobs/') || url.pathname.includes('/remote-')),
    }
  }

  if (host.includes('weworkremotely.com')) {
    return {
      listingPrompt: 'Extract real remote jobs from this page with a focus on software engineering, frontend, backend, platform, AI, data, and developer roles. Return title, company, location, salary, short description, visible skills, and the detail or apply URL.',
      detailPrompt: 'Extract the full job description, responsibilities, requirements, skills, technologies, location, compensation, remote status, and experience level from this job page.',
      isJobLink: url => url.hostname.includes('weworkremotely.com') && url.pathname.includes('/remote-jobs/'),
    }
  }

  if (host.includes('remotive.com')) {
    return {
      listingPrompt: 'Extract real remote software jobs from this page. Return title, company, location, salary, short description, visible skills or tags, and the job detail or apply URL.',
      detailPrompt: 'Extract the full remote job description, requirements, skills, technologies, location, salary, remote status, and experience level from this job page.',
      isJobLink: url => url.hostname.includes('remotive.com') && url.pathname.includes('/remote-jobs/'),
    }
  }

  return {
    listingPrompt: 'Extract real startup and tech jobs from this page. Return title, company, location, salary, short description, visible skills, and the detail or apply URL.',
    detailPrompt: 'Extract the complete job description, requirements, skills, technologies, location, salary, remote status, and experience level from this job page.',
    isJobLink: url => url.pathname.includes('/jobs/') || url.pathname.includes('/job/') || url.pathname.includes('/careers/') || url.pathname.includes('/positions/'),
  }
}

async function scrapeFirecrawl(url, { prompt, schema, timeout = 120000 }) {
  const body = {
    url,
    timeout,
    formats: ['markdown', 'extract'],
    extract: {
      prompt,
      schema,
    }
  }

  const res = await fetch(FIRECRAWL_SCRAPE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-api-key': FIRECRAWL_API_KEY,
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Firecrawl fetch failed: ${res.status} ${txt}`)
  }
  return res.json()
}

async function fetchJobsFromFirecrawl(sourceUrl) {
  const sourceConfig = getSourceConfig(sourceUrl)

  return scrapeFirecrawl(sourceUrl, {
    prompt: `${sourceConfig.listingPrompt} Extract only real job listings that are explicitly present on the page. Do not infer, summarize, or invent jobs. If no real listing exists, return an empty jobs array.`,
    schema: {
      type: 'object',
      properties: {
        jobs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              company: { type: 'string' },
              location: { type: 'string' },
              salary: { type: 'string' },
              description: { type: 'string' },
              applyUrl: { type: 'string' },
              remoteType: { type: 'string' },
              experienceLevel: { type: 'string' },
              skills: {
                type: 'array',
                items: { type: 'string' }
              }
            },
            required: ['title', 'company', 'applyUrl']
          }
        }
      },
      required: ['jobs']
    }
  })
}

function normalizeJob(raw, sourceUrl) {
  const jobId = createFirestoreJobId(raw)
  const normalizedJob = normalizeJobDocument(raw)

  return {
    id: jobId,
    ...normalizedJob,
    source: sourceUrl,
    sourcePayload: raw
  }
}

function deriveCompanyFromUrl(url = '') {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host.includes('lever.co')) {
      const pathSegment = new URL(url).pathname.split('/').filter(Boolean)[0]
      if (pathSegment) {
        return pathSegment.charAt(0).toUpperCase() + pathSegment.slice(1)
      }
    }

    const root = host.split('.')[0] || 'Unknown company'
    return root.charAt(0).toUpperCase() + root.slice(1)
  } catch {
    return 'Unknown company'
  }
}

function jobsFromMarkdown(markdown = '', sourceUrl) {
  if (!markdown) return []

  const sourceConfig = getSourceConfig(sourceUrl)
  const linkPattern = /\[([^\]]+)\]\(([^\s)]+)\)/g
  const jobs = []
  const seen = new Set()
  let match

  while ((match = linkPattern.exec(markdown)) !== null) {
    const title = String(match[1] || '').trim()
    const rawUrl = String(match[2] || '').trim()
    if (!title || !rawUrl) continue

    let applyUrl
    try {
      applyUrl = new URL(rawUrl, sourceUrl).toString()
    } catch {
      continue
    }

    if (!title || !applyUrl || seen.has(applyUrl)) continue

    if (title.includes('![')) continue
    if (/\.(svg|png|jpg|jpeg|gif|webp)(\?|$)/i.test(applyUrl)) continue
    if (/logo|icon|favicon|cdn/i.test(applyUrl)) continue

    const parsedUrl = new URL(applyUrl)
    if (!sourceConfig.isJobLink(parsedUrl)) continue

    seen.add(applyUrl)
    jobs.push({
      title,
      company: deriveCompanyFromUrl(applyUrl),
      location: 'Unspecified',
      salary: 'Salary not listed',
      description: '',
      applyUrl,
      remoteType: 'remote',
      experienceLevel: 'Mid',
      skills: []
    })

    if (jobs.length >= MAX_LISTING_JOBS_PER_SOURCE) {
      break
    }
  }

  return jobs
}

function inferSkillsFromText(...parts) {
  const corpus = parts.filter(Boolean).join(' ').toLowerCase()
  const skills = []

  for (const keyword of SKILL_KEYWORDS) {
    if (corpus.includes(keyword.toLowerCase())) {
      skills.push(keyword)
    }
  }

  return [...new Set(skills)]
}

function enrichJobWithDetails(listingJob, detailExtract = {}, detailMarkdown = '') {
  const extractedSkills = Array.isArray(detailExtract.skills) ? detailExtract.skills : Array.isArray(listingJob.skills) ? listingJob.skills : []
  const title = String(detailExtract.title || listingJob.title || '').trim()
  const company = String(detailExtract.company || listingJob.company || deriveCompanyFromUrl(listingJob.applyUrl)).trim()
  const location = String(detailExtract.location || listingJob.location || 'Unspecified').trim()
  const salary = String(detailExtract.salary || listingJob.salary || 'Salary not listed').trim()
  const description = String(detailExtract.description || detailMarkdown || listingJob.description || '').trim()
  const remoteType = String(detailExtract.remoteType || listingJob.remoteType || '').trim()
  const experienceLevel = String(detailExtract.experienceLevel || listingJob.experienceLevel || '').trim()
  const inferredSkills = inferSkillsFromText(title, description, extractedSkills.join(' '))

  return {
    ...listingJob,
    title,
    company,
    location,
    salary,
    description,
    remoteType,
    experienceLevel,
    skills: [...new Set([...extractedSkills, ...inferredSkills])],
  }
}

async function fetchJobDetails(applyUrl, sourceUrl) {
  const sourceConfig = getSourceConfig(sourceUrl)

  const data = await scrapeFirecrawl(applyUrl, {
    prompt: `${sourceConfig.detailPrompt} Return only information explicitly visible on the page.`,
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        company: { type: 'string' },
        location: { type: 'string' },
        salary: { type: 'string' },
        description: { type: 'string' },
        applyUrl: { type: 'string' },
        remoteType: { type: 'string' },
        experienceLevel: { type: 'string' },
        skills: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    },
    timeout: DETAIL_TIMEOUT_MS,
  })

  return {
    extract: data?.data?.extract || data?.extract || {},
    markdown: String(data?.data?.markdown || data?.markdown || '').trim(),
  }
}

function isLikelyRealJob(raw) {
  if (!raw || typeof raw !== 'object') return false

  const title = String(raw.title || '').trim()
  const applyUrl = String(raw.applyUrl || '').trim()

  if (!title || !applyUrl) return false
  if (!/^https?:\/\//i.test(applyUrl)) return false

  const lowerUrl = applyUrl.toLowerCase()
  const looksLikeJobLink =
    lowerUrl.includes('/jobs/')
    || lowerUrl.includes('/job/')
    || lowerUrl.includes('/careers/')
    || lowerUrl.includes('/positions/')

  if (!looksLikeJobLink) return false

  // Filter obvious placeholder/demo values frequently seen in low-confidence extractions
  const normalized = `${title}`.toLowerCase()
  if (normalized.includes('example') || normalized.includes('sample')) return false

  return true
}

async function upsertJobAndEmbedding(job) {
  const db = getFirestoreDb()
  const collectionName = getJobsCollectionName()
  let targetDocumentId = job.id

  if (job.applyUrl) {
    const existingSnapshot = await db
      .collection(collectionName)
      .where('applyUrl', '==', job.applyUrl)
      .get()

    if (!existingSnapshot.empty) {
      targetDocumentId = existingSnapshot.docs[0].id

      if (existingSnapshot.docs.length > 1) {
        const duplicateDocs = existingSnapshot.docs.slice(1)
        await Promise.all(duplicateDocs.map(document => document.ref.delete()))
      }
    }
  }

  await db.collection(collectionName).doc(targetDocumentId).set({
    ...job,
    id: targetDocumentId,
    scrapedAt: job.scrapedAt,
    updatedAt: new Date()
  }, { merge: true })

  return {
    skippedDuplicate: false,
    existingId: targetDocumentId !== job.id ? targetDocumentId : null,
    updatedExisting: targetDocumentId !== job.id
  }
}

function extractJobs(data, sourceUrl) {
  const extracted =
    data?.data?.extract
    || data?.extract
    || data?.data?.jobs
    || data?.jobs
    || data?.results
    || data?.documents
    || data?.data
    || data

  let jobs = []
  if (Array.isArray(extracted)) {
    jobs = extracted
  } else if (Array.isArray(extracted?.jobs)) {
    jobs = extracted.jobs
  } else if (extracted && typeof extracted === 'object') {
    jobs = [extracted]
  }

  if (jobs.length === 0) {
    const markdown = data?.data?.markdown || data?.markdown || ''
    jobs = jobsFromMarkdown(markdown, sourceUrl)
  }

  return jobs.filter(isLikelyRealJob).slice(0, MAX_LISTING_JOBS_PER_SOURCE)
}

async function main() {
  console.log('Starting Firecrawl ingestion')
  const sources = getJobSources()

  if (sources.length === 0) {
    console.error('Set at least one JOB_SOURCE_* environment variable in .env')
    process.exit(1)
  }

  let jobsScraped = 0
  let jobsStored = 0
  let processingErrors = 0
  const seenApplyUrls = new Set()
  const detailCache = new Map()

  for (const sourceUrl of sources) {
    try {
      console.log(`Fetching jobs from Firecrawl for ${sourceUrl}`)
      const data = await fetchJobsFromFirecrawl(sourceUrl)
      const jobs = extractJobs(data, sourceUrl)

      console.log(`Scraped ${jobs.length} jobs from ${sourceUrl}`)
      jobsScraped += jobs.length

      for (const raw of jobs) {
        try {
          let enrichedRaw = raw

          if (raw.applyUrl) {
            try {
              const cachedDetails = detailCache.get(raw.applyUrl)
              const detail = cachedDetails || await fetchJobDetails(raw.applyUrl, sourceUrl)
              detailCache.set(raw.applyUrl, detail)
              enrichedRaw = enrichJobWithDetails(raw, detail.extract, detail.markdown)
            } catch (detailError) {
              console.error(`Failed detail enrichment for ${raw.applyUrl}`, detailError.message || detailError)
              enrichedRaw = enrichJobWithDetails(raw)
            }
          }

          const job = normalizeJob(enrichedRaw, sourceUrl)
          if (!job.id || !job.applyUrl) continue
          if (seenApplyUrls.has(job.applyUrl)) {
            console.log('Skipped duplicate applyUrl in current run', job.applyUrl)
            continue
          }

          const result = await upsertJobAndEmbedding(job)
          seenApplyUrls.add(job.applyUrl)

          if (result.updatedExisting) {
            console.log('Updated existing job for duplicate applyUrl', job.applyUrl)
            continue
          }

          jobsStored += 1
          console.log('Stored job', job.id)
        } catch (err) {
          processingErrors += 1
          console.error(`Failed processing job from ${sourceUrl}`, err.message || err)
        }
      }
    } catch (error) {
      processingErrors += 1
      console.error(`Failed scraping source ${sourceUrl}`, error.message || error)
      continue
    }
  }

  console.log('Ingestion complete')
  console.log('Total jobs scraped:', jobsScraped)
  console.log('Total jobs stored:', jobsStored)
  console.log('Processing errors:', processingErrors)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
