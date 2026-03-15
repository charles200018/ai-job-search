import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

let firestoreInstance

function getFirebaseCredential() {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (projectId && clientEmail && privateKey) {
    return cert({ projectId, clientEmail, privateKey })
  }

  return applicationDefault()
}

function getFirebaseApp() {
  const existing = getApps()[0]
  if (existing) return existing

  return initializeApp({
    credential: getFirebaseCredential(),
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined
  })
}

export function getFirestoreDb() {
  if (firestoreInstance) {
    return firestoreInstance
  }

  const app = getFirebaseApp()
  firestoreInstance = getFirestore(app)
  return firestoreInstance
}

export function getStorageBucket() {
  const app = getFirebaseApp()
  const storage = getStorage(app)
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET

  if (!bucketName) {
    throw new Error('Missing FIREBASE_STORAGE_BUCKET for resume uploads')
  }

  return storage.bucket(bucketName)
}

export function getJobsCollectionName() {
  return process.env.FIRESTORE_COLLECTION_JOBS || 'jobs'
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseApp())
}