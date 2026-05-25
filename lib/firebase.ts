// Import the functions you need from the SDKs you need
import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
// NOTE: firebase/analytics is NOT imported statically to prevent SSR bailout
// It's dynamically imported in getAnalyticsSafe() only on the client
import { getAuth, Auth } from 'firebase/auth'
import { getFirestore, Firestore } from 'firebase/firestore'

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDFMs2l-0OlMBAJS-XjcXM9oHX3uRNRE5E",
  authDomain: "travelzada.firebaseapp.com",
  projectId: "travelzada",
  storageBucket: "travelzada.firebasestorage.app",
  messagingSenderId: "941629695254",
  appId: "1:941629695254:web:df7fd6f7ed6d14eb14dc37",
  measurementId: "G-5JQNQ4BRCJ"
}

console.log('[SSR-DEBUG-FIREBASE] firebase.ts module loaded on:', typeof window === 'undefined' ? 'SERVER' : 'CLIENT')

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

