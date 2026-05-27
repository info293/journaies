export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'

export async function POST(request: Request) {
  const { email } = await request.json()

  console.log('\n[DEBUG-AUTH] ═══════════════════════════════════════')
  console.log('[DEBUG-AUTH] Auth debug check requested')
  console.log('[DEBUG-AUTH] Email:', email)
  console.log('[DEBUG-AUTH] Timestamp:', new Date().toISOString())

  // ── 1. Check Firebase config ──────────────────────────────
  const projectId   = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const apiKey      = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const authDomain  = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN

  console.log('\n[DEBUG-AUTH] ── Firebase Config ─────────────────────')
  console.log('[DEBUG-AUTH] projectId   :', projectId   || '❌ MISSING')
  console.log('[DEBUG-AUTH] authDomain  :', authDomain  || '❌ MISSING')
  console.log('[DEBUG-AUTH] apiKey      :', apiKey ? apiKey.slice(0, 14) + '...' : '❌ MISSING')

  if (!projectId || !apiKey) {
    console.error('[DEBUG-AUTH] ❌ CRITICAL: Firebase env vars are missing!')
    return NextResponse.json({
      ok: false,
      error: 'Firebase env vars missing',
      projectId, apiKey: apiKey ? 'present' : 'MISSING',
    })
  }

  // ── 2. Check Firestore users collection by email ──────────
  console.log('\n[DEBUG-AUTH] ── Firestore Check ─────────────────────')
  let firestoreUser: any = null
  let firestoreError: string | null = null

  try {
    // Search by email field
    const q = query(collection(db, 'users'), where('email', '==', email))
    const snap = await getDocs(q)

    if (snap.empty) {
      console.warn('[DEBUG-AUTH] ⚠️  No Firestore user doc found with email:', email)
    } else {
      snap.forEach(d => {
        firestoreUser = { id: d.id, ...d.data() }
      })
      console.log('[DEBUG-AUTH] ✅ Firestore user doc found')
      console.log('[DEBUG-AUTH]    UID (doc id)  :', firestoreUser.id)
      console.log('[DEBUG-AUTH]    email         :', firestoreUser.email)
      console.log('[DEBUG-AUTH]    role          :', firestoreUser.role)
      console.log('[DEBUG-AUTH]    isAdmin       :', firestoreUser.role === 'admin')
      console.log('[DEBUG-AUTH]    agentStatus   :', firestoreUser.agentStatus || 'n/a')
      console.log('[DEBUG-AUTH]    isActive      :', firestoreUser.isActive)
    }
  } catch (err: any) {
    firestoreError = err.message
    console.error('[DEBUG-AUTH] ❌ Firestore query failed:', err.message)
  }

  // ── 3. Check if Auth account exists via createAuthUri ──────
  console.log('\n[DEBUG-AUTH] ── Firebase Auth Account Check ─────────')
  let authUserExists = false
  let hasPassword = false
  let authUID: string | null = null
  let authError: string | null = null
  let signInMethods: string[] = []

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: email,
          continueUri: 'http://localhost:3000',
        }),
      }
    )
    const data = await res.json()

    if (data.error) {
      authError = data.error.message
      console.error('[DEBUG-AUTH] ❌ Auth check error:', data.error.message)

      if (data.error.message === 'OPERATION_NOT_ALLOWED') {
        console.error('[DEBUG-AUTH]    → Email/Password sign-in is DISABLED in Firebase Console')
        console.error('[DEBUG-AUTH]    → Fix: Firebase Console → journaies → Authentication → Sign-in method → Email/Password → Enable')
      }
    } else {
      authUserExists = data.registered === true
      signInMethods = data.signinMethods || []
      hasPassword = signInMethods.includes('password')

      if (authUserExists) {
        console.log('[DEBUG-AUTH] ✅ Firebase Auth account EXISTS in journaies')
        console.log('[DEBUG-AUTH]    registered     :', data.registered)
        console.log('[DEBUG-AUTH]    signinMethods  :', signInMethods.join(', ') || 'none')
        console.log('[DEBUG-AUTH]    hasPassword    :', hasPassword ? '✅ YES — password is set' : '❌ NO PASSWORD — imported without hash?')

        if (!hasPassword && signInMethods.length === 0) {
          console.error('[DEBUG-AUTH] ❌ User exists BUT has no sign-in method!')
          console.error('[DEBUG-AUTH]    → The CLI import likely ran WITHOUT --hash-algo flag')
          console.error('[DEBUG-AUTH]    → Users were imported but password hashes were not transferred')
          console.error('[DEBUG-AUTH]    → Fix: re-run import with hash parameters OR send password reset emails')
        }
      } else {
        console.error('[DEBUG-AUTH] ❌ NO Auth account found for:', email)
        console.error('[DEBUG-AUTH]    registered:', data.registered)
        console.error('[DEBUG-AUTH]    → The CLI import may have failed silently')
        console.error('[DEBUG-AUTH]    → Fix: Firebase Console → Authentication → Add user manually')
      }
    }
  } catch (err: any) {
    authError = err.message
    console.error('[DEBUG-AUTH] ❌ Auth check REST call failed:', err.message)
  }

  // ── 4. Try actual sign-in to get exact error ─────────────
  console.log('\n[DEBUG-AUTH] ── Sign-in Test ────────────────────────')
  let signInError: string | null = null
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: '__test_wrong_password__',
          returnSecureToken: false,
        }),
      }
    )
    const data = await res.json()
    signInError = data.error?.message || null

    // Interpret the exact error code
    if (signInError === 'EMAIL_NOT_FOUND') {
      console.error('[DEBUG-AUTH] ❌ EMAIL_NOT_FOUND — account does not exist in journaies Auth')
    } else if (signInError === 'INVALID_PASSWORD') {
      console.log('[DEBUG-AUTH] ✅ INVALID_PASSWORD — account EXISTS, password just wrong in this test')
      console.log('[DEBUG-AUTH]    This means the real login should work with the correct password!')
      authUserExists = true
      hasPassword = true
    } else if (signInError === 'INVALID_LOGIN_CREDENTIALS') {
      console.error('[DEBUG-AUTH] ❌ INVALID_LOGIN_CREDENTIALS — account not found OR no password set')
    } else if (signInError === 'USER_DISABLED') {
      console.error('[DEBUG-AUTH] ❌ USER_DISABLED — account exists but is disabled')
    } else if (signInError === 'OPERATION_NOT_ALLOWED') {
      console.error('[DEBUG-AUTH] ❌ OPERATION_NOT_ALLOWED — Email/Password sign-in is DISABLED')
      console.error('[DEBUG-AUTH]    Fix: Firebase Console → journaies → Authentication → Sign-in method → Email/Password → Enable')
    } else {
      console.log('[DEBUG-AUTH]    Sign-in test error code:', signInError)
    }
  } catch (err: any) {
    console.error('[DEBUG-AUTH] Sign-in test failed:', err.message)
  }

  console.log('\n[DEBUG-AUTH] ── Summary ──────────────────────────────')
  console.log('[DEBUG-AUTH] Firebase project   :', projectId)
  console.log('[DEBUG-AUTH] Auth account exists:', authUserExists ? '✅' : '❌')
  console.log('[DEBUG-AUTH] Has password       :', hasPassword ? '✅' : '❌')
  console.log('[DEBUG-AUTH] Sign-in methods    :', signInMethods.join(', ') || 'none')
  console.log('[DEBUG-AUTH] Sign-in test error :', signInError || 'none')
  console.log('[DEBUG-AUTH] Firestore doc found:', firestoreUser ? '✅' : '❌')
  console.log('[DEBUG-AUTH] Role in Firestore  :', firestoreUser?.role || 'N/A')
  console.log('[DEBUG-AUTH] Firestore UID      :', firestoreUser?.id || 'N/A')

  // Final verdict
  console.log('\n[DEBUG-AUTH] ── Verdict ─────────────────────────────')
  if (!authUserExists) {
    console.error('[DEBUG-AUTH] ❌ PROBLEM: Auth account missing → CLI import did not work')
  } else if (!hasPassword && signInError !== 'INVALID_PASSWORD') {
    console.error('[DEBUG-AUTH] ❌ PROBLEM: Account exists but NO password → import ran without hash params')
  } else if (signInError === 'OPERATION_NOT_ALLOWED') {
    console.error('[DEBUG-AUTH] ❌ PROBLEM: Email/Password disabled in Firebase Console')
  } else if (authUserExists && (hasPassword || signInError === 'INVALID_PASSWORD')) {
    console.log('[DEBUG-AUTH] ✅ Auth looks good — if login still fails, check password is correct')
    if (firestoreUser?.role !== 'admin') {
      console.warn('[DEBUG-AUTH] ⚠️  Firestore role is not admin:', firestoreUser?.role)
    }
  }
  console.log('[DEBUG-AUTH] ═══════════════════════════════════════\n')

  return NextResponse.json({
    ok: true,
    projectId,
    authAccountExists: authUserExists,
    hasPassword,
    signInMethods,
    signInTestError: signInError,
    authError,
    firestoreUser: firestoreUser ? {
      uid: firestoreUser.id,
      email: firestoreUser.email,
      role: firestoreUser.role,
      isActive: firestoreUser.isActive,
    } : null,
    firestoreError,
  })
}
