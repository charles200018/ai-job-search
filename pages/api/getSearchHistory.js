import { requireAuthenticatedUser } from '../../src/lib/apiAuth.js'
import { getFirestoreDb } from '../../src/lib/firebaseAdmin.js'
import { toIsoString } from '../../src/lib/jobSearch.js'

function toTimestamp(value) {
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
    const snapshot = await db.collection('searchHistory').where('userId', '==', authenticatedUser.uid).limit(250).get()

    const history = snapshot.docs
      .map(document => {
        const item = document.data()
        return {
          id: document.id,
          userId: item.userId,
          query: String(item.query || ''),
          filters: item.filters && typeof item.filters === 'object' ? item.filters : {},
          resultCount: Number(item.resultCount || 0),
          timestamp: toTimestamp(item.timestamp),
        }
      })
      .sort((left, right) => {
        const leftTime = left.timestamp ? Date.parse(left.timestamp) : 0
        const rightTime = right.timestamp ? Date.parse(right.timestamp) : 0
        return rightTime - leftTime
      })

    return res.status(200).json({ history })
  } catch (error) {
    console.error(error)
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to fetch search history' })
  }
}
