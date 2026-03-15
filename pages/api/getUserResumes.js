import { requireAuthenticatedUser } from '../../src/lib/apiAuth.js'
import { getFirestoreDb } from '../../src/lib/firebaseAdmin.js'
import { toIsoString } from '../../src/lib/jobSearch.js'

function toUploadedAt(value) {
  if (!value) return null
  try {
    return toIsoString(value)
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authenticatedUser = await requireAuthenticatedUser(req)
    const db = getFirestoreDb()
    const snapshot = await db.collection('resumes').where('userId', '==', authenticatedUser.uid).limit(200).get()

    const resumes = snapshot.docs
      .map(document => {
        const item = document.data()
        return {
          id: document.id,
          userId: item.userId,
          fileName: item.fileName || '',
          fileUrl: item.fileUrl || null,
          uploadedAt: toUploadedAt(item.uploadedAt),
          extractedSkills: Array.isArray(item.extractedSkills) ? item.extractedSkills : [],
        }
      })
      .sort((left, right) => {
        const leftTime = left.uploadedAt ? Date.parse(left.uploadedAt) : 0
        const rightTime = right.uploadedAt ? Date.parse(right.uploadedAt) : 0
        return rightTime - leftTime
      })

    return res.status(200).json({ resumes })
  } catch (error) {
    console.error(error)
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to fetch resumes' })
  }
}
