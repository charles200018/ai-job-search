import { getFirestoreDb, getJobsCollectionName, getStorageBucket } from './firebaseAdmin.js'
import { normalizeText, serializeJob } from './jobSearch.js'
import { extractResumeText, parseMultipartForm } from './resumeParsing.js'
import { analyzeResumeText } from './groqClient.js'

function buildResumeSkills(analysis) {
  const skills = Array.isArray(analysis?.skills) ? analysis.skills : []
  const technologies = Array.isArray(analysis?.technologies) ? analysis.technologies : []
  return [...skills, ...technologies]
    .map(skill => normalizeText(String(skill)))
    .filter(Boolean)
}

export async function processResumeUpload(req, authenticatedUser) {
  const { file } = await parseMultipartForm(req)
  const extractedText = (await extractResumeText(file)).trim()

  if (!extractedText) {
    const error = new Error('No readable text found in the uploaded resume')
    error.statusCode = 400
    throw error
  }

  let uploadedResumePath = null
  try {
    const bucket = getStorageBucket()
    const destination = `resumes/${authenticatedUser.uid}/${Date.now()}-${file.originalFilename}`
    await bucket.upload(file.filepath, {
      destination,
      metadata: {
        contentType: file.mimetype,
        metadata: {
          originalFilename: file.originalFilename,
          userId: authenticatedUser.uid,
        }
      }
    })
    uploadedResumePath = destination
  } catch (storageError) {
    console.error('Failed to upload resume to Firebase Storage', storageError)
  }

  const analysis = await analyzeResumeText(extractedText)
  const resumeSkills = buildResumeSkills(analysis)
  if (resumeSkills.length === 0) {
    const error = new Error('Resume analysis did not yield any recognizable skills')
    error.statusCode = 400
    throw error
  }

  const db = getFirestoreDb()
  await db.collection('users').doc(authenticatedUser.uid).set({
    uid: authenticatedUser.uid,
    email: authenticatedUser.email || null,
    name: authenticatedUser.name || null,
    picture: authenticatedUser.picture || null,
    lastResumeAt: new Date(),
    lastResumeTextPreview: extractedText.slice(0, 1000),
    lastResumeAnalysis: analysis,
    lastResumeStoragePath: uploadedResumePath,
    updatedAt: new Date(),
  }, { merge: true })

  const snapshot = await db.collection(getJobsCollectionName()).orderBy('scrapedAt', 'desc').limit(400).get()
  const matches = []
  snapshot.forEach(document => {
    const job = document.data()
    const jobSkills = (job.skillsNormalized || []).map(value => normalizeText(String(value)))
    if (jobSkills.length === 0) return

    const overlap = resumeSkills.filter(skill => jobSkills.includes(skill))
    if (overlap.length === 0) return

    const skillMatchScore = overlap.length / Math.max(resumeSkills.length, 1)
    matches.push({
      ...serializeJob(document.id, job),
      matchedSkills: overlap,
      resumeSimilarity: skillMatchScore,
    })
  })

  matches.sort((left, right) => (right.resumeSimilarity || 0) - (left.resumeSimilarity || 0))

  return {
    message: 'Resume processed and matched against the job catalog',
    extractedTextPreview: extractedText.slice(0, 360),
    analysis,
    skills: resumeSkills,
    matches: matches.slice(0, 10),
  }
}

export async function matchJobsBySkills(skills = []) {
  const normalizedSkills = skills.map(skill => normalizeText(String(skill))).filter(Boolean)
  const db = getFirestoreDb()
  const snapshot = await db.collection(getJobsCollectionName()).orderBy('scrapedAt', 'desc').limit(400).get()
  const matches = []

  snapshot.forEach(document => {
    const job = document.data()
    const jobSkills = (job.skillsNormalized || []).map(value => normalizeText(String(value)))
    const overlap = normalizedSkills.filter(skill => jobSkills.includes(skill))
    if (overlap.length === 0) return

    matches.push({
      ...serializeJob(document.id, job),
      matchedSkills: overlap,
      resumeSimilarity: overlap.length / Math.max(normalizedSkills.length, 1),
    })
  })

  matches.sort((left, right) => (right.resumeSimilarity || 0) - (left.resumeSimilarity || 0))
  return matches.slice(0, 10)
}
