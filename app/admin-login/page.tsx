'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Mail, Lock, Loader2, Eye, EyeOff, Shield } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function AdminLoginPage() {
  const router = useRouter()
  const { login, currentUser, isAdmin, loading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && currentUser && isAdmin) router.replace('/admin')
  }, [currentUser, isAdmin, loading, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    console.log('[ADMIN-LOGIN] ── handleSubmit ──────────────────')
    console.log('[ADMIN-LOGIN] Email entered:', email)
    console.log('[ADMIN-LOGIN] Password length:', password.length)

    // ── Server-side debug check (prints in terminal) ──
    try {
      const debugRes = await fetch('/api/debug/auth-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const debugData = await debugRes.json()
      console.log('[ADMIN-LOGIN] Debug API result:', debugData)
    } catch (debugErr) {
      console.warn('[ADMIN-LOGIN] Debug API call failed:', debugErr)
    }

    try {
      await login(email, password)
      console.log('[ADMIN-LOGIN] ✅ login() resolved — waiting for isAdmin redirect')
      console.log('[ADMIN-LOGIN] isAdmin currently:', isAdmin)
      console.log('[ADMIN-LOGIN] currentUser after login:', currentUser?.uid)
    } catch (err: any) {
      console.error('[ADMIN-LOGIN] ❌ login() threw error:')
      console.error('[ADMIN-LOGIN] code:', err.code)
      console.error('[ADMIN-LOGIN] message:', err.message)
      console.error('[ADMIN-LOGIN] full error:', err)

      const code = err.code || ''
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid email or password.')
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Try again in a few minutes.')
      } else if (code === 'auth/operation-not-allowed') {
        setError('Email/Password sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.')
      } else if (code === 'auth/invalid-email') {
        setError('Invalid email format.')
      } else {
        setError(`Error (${code || 'unknown'}): ${err.message || 'Login failed.'}`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-600/30">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-lg leading-tight">Journaies</p>
            <p className="text-slate-400 text-xs">Admin Control Panel</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-gray-900">Admin Sign In</h2>
            <p className="text-gray-500 text-sm mt-1">Restricted access — authorised personnel only</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Admin Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="admin@journaies.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="Your password"
                  className="w-full pl-10 pr-11 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl">
                <span className="flex-shrink-0 mt-0.5">⚠</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-violet-600/20 mt-2"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</>
              ) : (
                <><Shield className="w-4 h-4" />Sign in to Admin Panel</>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <a href="/" className="text-gray-400 hover:text-gray-600 text-xs">← Back to Home</a>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
