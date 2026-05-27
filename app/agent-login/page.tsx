'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mail, Lock, Loader2, Eye, EyeOff, MapPin, TrendingUp, Users, Package } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const FEATURES = [
  { icon: Package, title: 'AI-Powered Packages', desc: 'Your own branded travel planner, live in minutes.' },
  { icon: Users, title: 'Team Management', desc: 'Add travel agents and track their bookings.' },
  { icon: TrendingUp, title: 'CRM & Analytics', desc: 'Full funnel data from visit to confirmed booking.' },
  { icon: MapPin, title: 'Quotation Workspace', desc: 'Collaborate with agents, set prices, convert to bookings.' },
]

export default function AgentLoginPage() {
  const router = useRouter()
  const { login, currentUser, isAgent, loading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && currentUser && isAgent) router.push('/dmc-dashboard')
  }, [currentUser, isAgent, loading, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      router.push('/dmc-dashboard')
    } catch (err: any) {
      const code = err.code || ''
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please try again.')
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again in a few minutes.')
      } else {
        setError(err.message || 'Login failed. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex flex-col w-[480px] flex-shrink-0 bg-gradient-to-br from-violet-700 via-purple-700 to-indigo-800 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/5 rounded-full" />
          <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-white/5 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-white/5 to-transparent rounded-full" />
        </div>

        <div className="relative flex flex-col h-full px-10 py-12">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-16">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-lg">T</div>
            <span className="text-white font-bold text-lg tracking-tight">Journaies</span>
            <span className="text-white/40 text-sm ml-1">Partners</span>
          </div>

          {/* Hero text */}
          <div className="mb-12">
            <p className="text-white/60 text-sm font-medium uppercase tracking-widest mb-4">Agent Dashboard</p>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Run your travel<br />business smarter.
            </h1>
            <p className="text-white/70 text-base leading-relaxed">
              Everything you need — AI planner, quotations, bookings, analytics and a full team workspace — in one place.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-5 flex-1">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{f.title}</p>
                  <p className="text-white/60 text-xs mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Bottom badge */}
          <div className="mt-10 pt-8 border-t border-white/10">
            <p className="text-white/50 text-xs">Trusted by 500+ travel agencies across India</p>
          </div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white font-bold">T</div>
            <span className="font-bold text-gray-900">Journaies Partners</span>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
              <p className="text-gray-500 text-sm mt-1">Sign in to your partner dashboard</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="you@agency.com"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
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
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
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
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</>
                  : 'Sign in to Dashboard'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 space-y-3 text-center text-sm">
              <p className="text-gray-500">
                Not registered yet?{' '}
                <Link href="/agent-register" className="text-violet-600 font-semibold hover:text-violet-700 hover:underline">
                  Apply as a Partner
                </Link>
              </p>
              <p>
                <Link href="/" className="text-gray-400 hover:text-gray-600 text-xs">← Back to Home</Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
