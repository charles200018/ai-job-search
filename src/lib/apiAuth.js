import { getFirebaseAdminAuth, getFirestoreDb } from './firebaseAdmin.js'

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || ''
  if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) {
    return null
  }

  return header.slice('Bearer '.length).trim()
}

export async function requireAuthenticatedUser(req) {
  const token = getBearerToken(req)
  if (!token) {
    const error = new Error('Missing authentication token')
    error.statusCode = 401
    throw error
  }

  const auth = getFirebaseAdminAuth()
  const decodedToken = await auth.verifyIdToken(token)
  const db = getFirestoreDb()
  const userRecord = {
    uid: decodedToken.uid,
    email: decodedToken.email || null,
    name: decodedToken.name || null,
    picture: decodedToken.picture || null,
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  }

  await db.collection('users').doc(decodedToken.uid).set(userRecord, { merge: true })
  return userRecord
}
