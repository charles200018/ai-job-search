import { getApps, initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from 'firebase/auth'

function getFirebaseClientConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }
}

function isClientConfigAvailable(config) {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId)
}

let authInstance = null

export function getFirebaseClientAuth() {
  if (typeof window === 'undefined') {
    return null
  }

  if (authInstance) {
    return authInstance
  }

  const config = getFirebaseClientConfig()
  if (!isClientConfigAvailable(config)) {
    return null
  }

  const app = getApps()[0] || initializeApp(config)
  authInstance = getAuth(app)
  return authInstance
}

export function subscribeToAuthChanges(callback) {
  const auth = getFirebaseClientAuth()
  if (!auth) {
    callback(null)
    return () => {}
  }

  return onAuthStateChanged(auth, callback)
}

export async function getCurrentIdToken() {
  const auth = getFirebaseClientAuth()
  const currentUser = auth?.currentUser || null
  if (!currentUser) {
    return null
  }

  return currentUser.getIdToken()
}

export async function signInWithGoogle() {
  const auth = getFirebaseClientAuth()
  if (!auth) {
    throw new Error('Firebase client auth is not configured. Set NEXT_PUBLIC_FIREBASE_* variables.')
  }

  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(auth, provider)
  return result.user
}

export async function signInWithGoogleRedirect() {
  const auth = getFirebaseClientAuth()
  if (!auth) {
    throw new Error('Firebase client auth is not configured. Set NEXT_PUBLIC_FIREBASE_* variables.')
  }

  const provider = new GoogleAuthProvider()
  await signInWithRedirect(auth, provider)
}

export async function completeRedirectSignIn() {
  const auth = getFirebaseClientAuth()
  if (!auth) {
    return null
  }

  try {
    const result = await getRedirectResult(auth)
    return result?.user || null
  } catch {
    return null
  }
}

export async function signOutUser() {
  const auth = getFirebaseClientAuth()
  if (!auth) {
    return
  }

  await signOut(auth)
}
