'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Building2, User, Phone, FileText, Mail, Lock, Eye, EyeOff,
  Loader2, CheckCircle, Globe, BarChart3, Users, Sparkles, ChevronRight,
} from 'lucide-react'

const AGENCY_TYPES = [
  { value: 'individual', label: 'Solo Agent', desc: 'Just me' },
  { value: 'small_agency', label: 'Small Agency', desc: '1–10 staff' },
  { value: 'large_agency', label: 'Large Agency', desc: '10+ staff' },
  { value: 'franchise', label: 'Franchise', desc: 'Multi-branch' },
]

const BENEFITS = [
  { icon: Globe, title: 'Your Branded AI Planner', desc: 'Your branded planner link — share it with clients instantly.' },
  { icon: Users, title: 'Sub-Agent Team', desc: 'Add travel agents, assign quotations, track their performance.' },
  { icon: BarChart3, title: 'CRM & Full Analytics', desc: 'Track visits, quotes, conversions and revenue in real time.' },
  { icon: Sparkles, title: 'AI-Powered Quotations', desc: 'Create custom packages and convert to bookings in one click.' },
]

export default function AgentRegisterPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const [form, setForm] = useState({
    companyName: '',
    contactName: '',
    phone: '',
    gstNumber: '',
    agencyType: 'individual',
    desiredSlug: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      const { auth, db } = await import('@/lib/firebase')
      const { createUserWithEmailAndPassword } = await import('firebase/auth')
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')

      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password)
      const uid = cred.user.uid

      await setDoc(doc(db, 'users', uid), {
        email: form.email,
        displayName: form.contactName,
        role: 'agent',
        agentStatus: 'pending',
        agentSlug: '',
        createdAt: serverTimestamp(),
        isActive: true,
        permissions: [],
      })

      const res = await fetch('/api/agent/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid,
          email: form.email,
          companyName: form.companyName,
          contactName: form.contactName,
          phone: form.phone,
          gstNumber: form.gstNumber,
          agencyType: form.agencyType,
          desiredSlug: form.desiredSlug || form.companyName,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center"
        >
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Application Submitted!</h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-4">
            Thanks for registering. Our team will review your application
            and activate your dashboard within 24–48 hours.
          </p>
          <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-sm text-violet-700 mb-8">
            We'll send updates to <strong>{form.email}</strong>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Back to Home
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex flex-col w-[440px] flex-shrink-0 bg-gradient-to-br from-violet-700 via-purple-700 to-indigo-800 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/5 rounded-full" />
          <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-white/5 rounded-full" />
        </div>

        <div className="relative flex flex-col h-full px-10 py-12">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-14">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-lg">T</div>
            <span className="text-white font-bold text-lg tracking-tight">Journaies</span>
            <span className="text-white/40 text-sm ml-1">Partners</span>
          </div>

          {/* Hero */}
          <div className="mb-10">
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-3">Partner Program</p>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Everything your<br />agency needs.
            </h1>
            <p className="text-white/70 text-sm leading-relaxed">
              Get your own branded AI travel planner, CRM, team workspace and analytics — all under your brand.
            </p>
          </div>

          {/* Benefits */}
          <div className="space-y-5 flex-1">
            {BENEFITS.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                  <b.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{b.title}</p>
                  <p className="text-white/60 text-xs mt-0.5 leading-relaxed">{b.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 pt-8 border-t border-white/10">
            <p className="text-white/50 text-xs">Trusted by 500+ travel agencies across India</p>
          </div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-xl mx-auto"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white font-bold">T</div>
            <span className="font-bold text-gray-900">Journaies Partners</span>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Apply as a Partner</h2>
              <p className="text-gray-500 text-sm mt-1">Takes 2 minutes · Active within 48 hours</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Agency details */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Agency Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Agency / Company Name *</label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        name="companyName"
                        value={form.companyName}
                        onChange={handleChange}
                        required
                        placeholder="Sunrise Travels"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Contact Person *</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        name="contactName"
                        value={form.contactName}
                        onChange={handleChange}
                        required
                        placeholder="Your full name"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number *</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        required
                        placeholder="+91 98765 43210"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">GST Number <span className="text-gray-400 font-normal">(optional)</span></label>
                    <div className="relative">
                      <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        name="gstNumber"
                        value={form.gstNumber}
                        onChange={handleChange}
                        placeholder="22AAAAA0000A1Z5"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Agency type — card style */}
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Agency Type *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {AGENCY_TYPES.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, agencyType: t.value }))}
                        className={`px-3 py-3 rounded-xl border text-left transition-all ${
                          form.agencyType === t.value
                            ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-500/20'
                            : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                        }`}
                      >
                        <p className={`text-xs font-semibold ${form.agencyType === t.value ? 'text-violet-700' : 'text-gray-700'}`}>{t.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Desired slug */}
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Your Planner URL <span className="text-gray-400 font-normal">(optional)</span></label>
                  <div className="flex items-center">
                    <span className="text-xs text-gray-400 bg-gray-100 border border-r-0 border-gray-200 rounded-l-xl px-3 py-2.5 whitespace-nowrap">/tailored-travel/</span>
                    <input
                      name="desiredSlug"
                      value={form.desiredSlug}
                      onChange={handleChange}
                      placeholder="sunrise-travels"
                      className="flex-1 px-3 py-2.5 border border-gray-200 rounded-r-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Auto-generated from your company name if left blank.</p>
                </div>
              </div>

              {/* Account credentials */}
              <div className="border-t border-gray-100 pt-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Account Credentials</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address *</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        required
                        placeholder="you@agency.com"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password *</label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          value={form.password}
                          onChange={handleChange}
                          required
                          placeholder="Min. 8 characters"
                          className="w-full pl-10 pr-11 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                        />
                        <button type="button" onClick={() => setShowPassword(v => !v)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password *</label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="password"
                          name="confirmPassword"
                          value={form.confirmPassword}
                          onChange={handleChange}
                          required
                          placeholder="Repeat password"
                          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>
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
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-violet-600/20"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting…</>
                  : <><span>Submit Application</span><ChevronRight className="w-4 h-4" /></>
                }
              </button>

              <p className="text-center text-sm text-gray-500">
                Already registered?{' '}
                <Link href="/agent-login" className="text-violet-600 font-semibold hover:text-violet-700 hover:underline">
                  Sign in to your dashboard
                </Link>
              </p>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
