import { requireAuthenticatedUser } from '../../src/lib/apiAuth.js'
import { getFirestoreDb } from '../../src/lib/firebaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authenticatedUser = await requireAuthenticatedUser(req)
    const db = getFirestoreDb()
    const snapshot = await db.collection('searchHistory').where('userId', '==', authenticatedUser.uid).limit(500).get()

    if (snapshot.empty) {
      return res.status(200).json({ deletedCount: 0 })
    }

    const batch = db.batch()
    snapshot.docs.forEach(document => {
      batch.delete(document.ref)
    })
    await batch.commit()

    return res.status(200).json({ deletedCount: snapshot.docs.length })
  } catch (error) {
    console.error(error)
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to delete search history' })
  }
}
