import { getFirestoreDb, getJobsCollectionName } from '../../src/lib/firebaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const db = getFirestoreDb()
    const snapshot = await db
      .collection(getJobsCollectionName())
      .orderBy('scrapedAt', 'desc')
      .limit(250)
      .get()

    const locations = new Set()
    const experienceLevels = new Set()

    snapshot.forEach(document => {
      const job = document.data()
      if (job.location) locations.add(job.location)
      if (job.experienceLevel) experienceLevels.add(job.experienceLevel)
    })

    return res.status(200).json({
      locations: [...locations].sort((left, right) => left.localeCompare(right)),
      experienceLevels: [...experienceLevels].sort((left, right) => left.localeCompare(right))
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: error.message || 'Failed to load search metadata' })
  }
}