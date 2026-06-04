'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { User } from 'firebase/auth'

interface AuthContextType {
  currentUser: User | null
  loading: boolean
  signup: (email: string, password: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  loginWithGoogle: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  isAdmin: boolean
  isAgent: boolean
  isSubAgent: boolean
  agentSlug: string | null
  agentStatus: string | null
  parentAgentId: string | null
  parentAgentSlug: string | null
  subAgentName: string | null
  permissions: string[]
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// SSR-safe default values - used during server rendering
const defaultAuthContext: AuthContextType = {
  currentUser: null,
  loading: true,
  signup: async () => { throw new Error('Auth not available during SSR') },
  login: async () => { throw new Error('Auth not available during SSR') },
  logout: async () => { throw new Error('Auth not available during SSR') },
  loginWithGoogle: async () => { throw new Error('Auth not available during SSR') },
  resetPassword: async () => { throw new Error('Auth not available during SSR') },
  isAdmin: false,
  isAgent: false,
  isSubAgent: false,
  agentSlug: null,
  agentStatus: null,
  parentAgentId: null,
  parentAgentSlug: null,
  subAgentName: null,
  permissions: [],
}

export function useAuth() {
  const context = useContext(AuthContext)
  // Return default context during SSR to prevent bailout
  // The real context will be available after hydration
  if (context === undefined) {
    return defaultAuthContext
  }
  return context
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isAgent, setIsAgent] = useState(false)
  const [isSubAgent, setIsSubAgent] = useState(false)
  const [agentSlug, setAgentSlug] = useState<string | null>(null)
  const [agentStatus, setAgentStatus] = useState<string | null>(null)
  const [parentAgentId, setParentAgentId] = useState<string | null>(null)
  const [parentAgentSlug, setParentAgentSlug] = useState<string | null>(null)
  const [subAgentName, setSubAgentName] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])

  useEffect(() => {
    let unsubscribe: () => void

    const initAuth = async () => {
      if (typeof window === 'undefined') {
        setLoading(false)
        return
      }

      try {
        const { auth, db } = await import('@/lib/firebase')
        const { onAuthStateChanged } = await import('firebase/auth')
        const { doc, getDoc } = await import('firebase/firestore')

        if (!auth) {
          setLoading(false)
          return
        }

        unsubscribe = onAuthStateChanged(auth, async (user) => {
          console.log('[AUTH-STATE] onAuthStateChanged fired — user:', user ? `${user.email} (${user.uid})` : 'null (logged out)')
          setCurrentUser(user)
          if (user && user.email) {
            try {
              if (db) {
                console.log('[AUTH-STATE] Fetching Firestore doc for:', user.uid)
                const userDoc = await getDoc(doc(db, 'users', user.uid))
                console.log('[AUTH-STATE] Firestore doc exists:', userDoc.exists())

                if (userDoc.exists()) {
                  const userData = userDoc.data()
                  const userRole = userData.role || 'user'
                  console.log('[AUTH-STATE] ✅ role from Firestore:', userRole)
                  console.log('[AUTH-STATE] → isAdmin will be:', userRole === 'admin')
                  setIsAdmin(userRole === 'admin')
                  setIsAgent(userRole === 'agent')
                  setIsSubAgent(userRole === 'subagent')
                  setAgentSlug(userData.agentSlug || null)
                  setAgentStatus(userData.agentStatus || null)
                  // Sub-agent specific fields
                  setParentAgentId(userData.agentId || null)
                  setParentAgentSlug(userData.parentAgentSlug || null)
                  setSubAgentName(userData.displayName || userData.name || null)
                  setPermissions(userData.permissions || [])
                  console.log('Auth check from Firestore:', {
                    email: user.email,
                    role: userRole,
                    isAdmin: userRole === 'admin',
                    isAgent: userRole === 'agent',
                    agentSlug: userData.agentSlug,
                    permissions: userData.permissions
                  })
                } else {
                  const adminEmails = ['admin@travelzada.com', 'admin@example.com']
                  const emailLower = user.email.toLowerCase()
                  const isAdminEmail = adminEmails.includes(emailLower) ||
                    emailLower.split('@')[0].includes('admin')
                  setIsAdmin(isAdminEmail)
                  setIsAgent(false)
                  setIsSubAgent(false)
                  setAgentSlug(null)
                  setAgentStatus(null)
                  setParentAgentId(null)
                  setParentAgentSlug(null)
                  setSubAgentName(null)
                  setPermissions([])
                }
              }
            } catch (error) {
              console.error('Error checking auth status:', error)
              setIsAdmin(false)
              setIsAgent(false)
              setIsSubAgent(false)
              setAgentSlug(null)
              setAgentStatus(null)
              setParentAgentId(null)
              setParentAgentSlug(null)
              setSubAgentName(null)
              setPermissions([])
            }
          } else {
            setIsAdmin(false)
            setIsAgent(false)
            setIsSubAgent(false)
            setAgentSlug(null)
            setAgentStatus(null)
            setParentAgentId(null)
            setParentAgentSlug(null)
            setSubAgentName(null)
            setPermissions([])
          }
          setLoading(false)
        })
      } catch (error) {
        console.error('Error initializing auth:', error)
        setLoading(false)
      }
    }

    initAuth()

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  async function signup(email: string, password: string) {
    const { auth, db } = await import('@/lib/firebase')
    const { createUserWithEmailAndPassword } = await import('firebase/auth')
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')

    if (!auth || !db) throw new Error('Firebase not initialized')

    const userCredential = await createUserWithEmailAndPassword(auth, email, password)

    // Create user document in Firestore
    if (userCredential.user) {
      const userDoc = {
        email: userCredential.user.email,
        displayName: userCredential.user.displayName || '',
        photoURL: userCredential.user.photoURL || '',
        role: 'user' as const,
        createdAt: serverTimestamp(),
        isActive: true,
        permissions: [] as string[]
      }

      try {
        await setDoc(doc(db, 'users', userCredential.user.uid), userDoc)
      } catch (error) {
        console.error('Error creating user document:', error)
      }
    }
  }

  async function login(email: string, password: string) {
    console.log('[AUTH-DEBUG] ── login() called ──────────────────')
    console.log('[AUTH-DEBUG] Email:', email)

    const { auth, db } = await import('@/lib/firebase')
    const { signInWithEmailAndPassword } = await import('firebase/auth')
    const { doc, getDoc, setDoc, serverTimestamp } = await import('firebase/firestore')

    console.log('[AUTH-DEBUG] Firebase auth object:', auth ? '✅ exists' : '❌ null')
    console.log('[AUTH-DEBUG] Firebase db object:', db ? '✅ exists' : '❌ null')
    console.log('[AUTH-DEBUG] Auth app name:', auth?.app?.name)
    console.log('[AUTH-DEBUG] Auth project:', (auth?.app?.options as any)?.projectId)

    if (!auth || !db) throw new Error('Firebase not initialized')

    console.log('[AUTH-DEBUG] Calling signInWithEmailAndPassword...')
    let userCredential: any
    try {
      userCredential = await signInWithEmailAndPassword(auth, email, password)
      console.log('[AUTH-DEBUG] ✅ Sign-in SUCCESS')
      console.log('[AUTH-DEBUG] UID:', userCredential.user.uid)
      console.log('[AUTH-DEBUG] Email verified:', userCredential.user.emailVerified)
    } catch (signInError: any) {
      console.error('[AUTH-DEBUG] ❌ signInWithEmailAndPassword FAILED')
      console.error('[AUTH-DEBUG] Error code:', signInError.code)
      console.error('[AUTH-DEBUG] Error message:', signInError.message)
      console.error('[AUTH-DEBUG] Full error:', JSON.stringify(signInError, null, 2))
      throw signInError
    }

    // Update last login in Firestore — non-fatal: a Firestore permission error must NOT block login
    if (userCredential.user) {
      try {
        const userRef = doc(db, 'users', userCredential.user.uid)
        console.log('[AUTH-DEBUG] Fetching Firestore user doc for UID:', userCredential.user.uid)
        const userSnap = await getDoc(userRef)

        if (userSnap.exists()) {
          console.log('[AUTH-DEBUG] ✅ Firestore user doc found')
          console.log('[AUTH-DEBUG] User role:', userSnap.data()?.role)
          console.log('[AUTH-DEBUG] User agentStatus:', userSnap.data()?.agentStatus)
          await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true })
        } else {
          console.warn('[AUTH-DEBUG] ⚠️ No Firestore user doc found — creating default user doc')
          const userDoc = {
            email: userCredential.user.email,
            displayName: userCredential.user.displayName || '',
            photoURL: userCredential.user.photoURL || '',
            role: 'user' as const,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
            isActive: true,
            permissions: [] as string[]
          }
          await setDoc(userRef, userDoc)
          console.warn('[AUTH-DEBUG] ⚠️ New user doc created with role: user (NOT admin!)')
        }
      } catch (firestoreError: any) {
        // Auth succeeded — don't fail login over a Firestore error (e.g. rules, offline)
        console.warn('[AUTH-DEBUG] ⚠️ Firestore lastLogin update failed (non-fatal):', firestoreError?.message)
      }
    }
  }

  async function logout() {
    const { auth } = await import('@/lib/firebase')
    const { signOut } = await import('firebase/auth')

    if (!auth) throw new Error('Firebase not initialized')
    await signOut(auth)
  }

  async function loginWithGoogle() {
    const { auth, db } = await import('@/lib/firebase')
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth')
    const { doc, getDoc, setDoc, serverTimestamp } = await import('firebase/firestore')

    if (!auth || !db) throw new Error('Firebase not initialized')

    const provider = new GoogleAuthProvider()
    const userCredential = await signInWithPopup(auth, provider)

    // Create or update user document in Firestore
    if (userCredential.user) {
      const userRef = doc(db, 'users', userCredential.user.uid)
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) {
        // Create new user document
        const userDoc = {
          email: userCredential.user.email,
          displayName: userCredential.user.displayName || '',
          photoURL: userCredential.user.photoURL || '',
          role: 'user' as const,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          isActive: true,
          permissions: [] as string[]
        }
        await setDoc(userRef, userDoc)
      } else {
        // Update last login
        await setDoc(userRef, {
          lastLogin: serverTimestamp(),
          displayName: userCredential.user.displayName || userSnap.data().displayName,
          photoURL: userCredential.user.photoURL || userSnap.data().photoURL,
        }, { merge: true })
      }
    }
  }

  async function resetPassword(email: string) {
    const { auth } = await import('@/lib/firebase')
    const { sendPasswordResetEmail } = await import('firebase/auth')

    if (!auth) throw new Error('Firebase not initialized')
    await sendPasswordResetEmail(auth, email)
  }

  const value: AuthContextType = {
    currentUser,
    loading,
    signup,
    login,
    logout,
    loginWithGoogle,
    resetPassword,
    isAdmin,
    isAgent,
    isSubAgent,
    agentSlug,
    agentStatus,
    parentAgentId,
    parentAgentSlug,
    subAgentName,
    permissions,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
