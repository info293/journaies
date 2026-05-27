// Import the functions you need from the SDKs you need
import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
// NOTE: firebase/analytics is NOT imported statically to prevent SSR bailout
// It's dynamically imported in getAnalyticsSafe() only on the client
import { getAuth, Auth } from 'firebase/auth'
import { getFirestore, Firestore } from 'firebase/firestore'

// Your web app's Firebase configuration (loaded from environment variables)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

console.log('[SSR-DEBUG-FIREBASE] firebase.ts module loaded on:', typeof window === 'undefined' ? 'SERVER' : 'CLIENT')
console.log('[SSR-DEBUG-FIREBASE] Config check → projectId:', firebaseConfig.projectId)
console.log('[SSR-DEBUG-FIREBASE] Config check → apiKey prefix:', firebaseConfig.apiKey?.slice(0, 12))
console.log('[SSR-DEBUG-FIREBASE] Config check → authDomain:', firebaseConfig.authDomain)

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('[SSR-DEBUG-FIREBASE] ❌ MISSING ENV VARS — apiKey or projectId is undefined!')
  console.error('[SSR-DEBUG-FIREBASE]    Check your .env file has NEXT_PUBLIC_FIREBASE_API_KEY and NEXT_PUBLIC_FIREBASE_PROJECT_ID')
}

// Initialize Firebase app (this is safe for SSR)
const app: FirebaseApp = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0]
console.log('[SSR-DEBUG-FIREBASE] Firebase app initialized, existing apps:', getApps().length)

// Initialize Auth (this is also SSR-safe)
const auth: Auth = getAuth(app)
console.log('[SSR-DEBUG-FIREBASE] Auth initialized')

// Initialize Firestore (this is also SSR-safe)
const db: Firestore = getFirestore(app)
console.log('[SSR-DEBUG-FIREBASE] Firestore initialized')

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

