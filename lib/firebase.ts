// Import the functions you need from the SDKs you need
import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
// NOTE: firebase/analytics is NOT imported statically to prevent SSR bailout
// It's dynamically imported in getAnalyticsSafe() only on the client
import { getAuth, Auth } from 'firebase/auth'
import { getFirestore, initializeFirestore, Firestore } from 'firebase/firestore'

// Your web app's Firebase configuration (loaded from environment variables)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('[FIREBASE] Missing env vars: NEXT_PUBLIC_FIREBASE_API_KEY or NEXT_PUBLIC_FIREBASE_PROJECT_ID')
}

const app: FirebaseApp = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0]

const auth: Auth = getAuth(app)

// Use long-polling on the server to avoid gRPC cold-start failures in Vercel
// serverless. gRPC keeps a persistent connection that breaks when a function
// instance is recycled; long-polling uses plain HTTP and survives cold starts.
const db: Firestore = typeof window === 'undefined'
  ? initializeFirestore(app, { experimentalForceLongPolling: true })
  : getFirestore(app)

// Analytics - browser only, initialized lazily with dynamic import
// Using 'any' type since Analytics type comes from the dynamically imported module
let analytics: any = null

// Helper to get analytics safely - uses dynamic import
const getAnalyticsSafe = async (): Promise<any> => {
  if (typeof window === 'undefined') return null
  if (analytics) return analytics

  try {
    const analyticsModule = await import('firebase/analytics')
    const supported = await analyticsModule.isSupported()
    if (supported) {
      analytics = analyticsModule.getAnalytics(app)
    }
  } catch (e) {
    console.warn('Analytics not supported:', e)
  }
  return analytics
}

export { app, analytics, auth, db, getAnalyticsSafe }

