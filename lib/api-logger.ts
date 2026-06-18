import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

export async function logApiError(
  route: string,
  method: string,
  error: unknown,
  context?: Record<string, unknown>
) {
  try {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? (error.stack ?? null) : null
    await addDoc(collection(db, 'api_error_logs'), {
      route,
      method: method.toUpperCase(),
      message,
      stack,
      context: context ?? null,
      resolvedAt: null,
      timestamp: serverTimestamp(),
    })
  } catch {
    // Never let the logger crash the API response
  }
}
