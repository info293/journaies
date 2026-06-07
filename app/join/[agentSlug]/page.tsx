'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  User, Mail, Lock, Eye, EyeOff, Phone, Building2,
  Loader2, CheckCircle, AlertCircle, ChevronRight, UserCog,
} from 'lucide-react'

interface AgentInfo {
  id: string
  companyName: string
  contactName: string
  logoUrl: string | null
  agentSlug: string
}

export default function JoinPage({ params }: { params: { agentSlug: string } }) {
  const { agentSlug } = params

  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null)
  const [agentLoading, setAgentLoading] = useState(true)
  const [agentNotFound, setAgentNotFound] = useState(false)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    organization: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    async function fetchAgent() {
      try {
        const res = await fetch(`/api/agent/profile?slug=${agentSlug}`)
        const data = await res.json()
        if (!res.ok || !data.success) {
          setAgentNotFound(true)
        } else {
          setAgentInfo(data.agent)
        }
      } catch {
        setAgentNotFound(true)
      } finally {
        setAgentLoading(false)
      }
    }
    fetchAgent()
  }, [agentSlug])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.name || !form.email || !form.password) {
      setError('Name, email and password are required.')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (!agentInfo) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/agent/subagents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agentInfo.id,
          agentSlug: agentInfo.agentSlug,
          name: form.name,
          email: form.email,
          phone: form.phone,
          organization: form.organization,
          password: form.password,
          selfRegister: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (agentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    )
  }

  if (agentNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-3xl shadow-lg p-10 max-w-md w-full text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Not Found</h1>
          <p className="text-gray-500 text-sm">
            This registration link is invalid or has expired. Please ask your agency for a fresh link.
          </p>
          <Link href="/agent-login" className="mt-6 inline-block text-sm text-purple-600 font-semibold hover:underline">
            Already registered? Sign in
          </Link>
        </div>
      </div>
    )
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
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Request Submitted!</h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-4">
            Your registration request has been sent to <strong>{agentInfo?.companyName}</strong>.
            They will review and approve your access shortly.
          </p>
          <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-sm text-violet-700 mb-8">
            You'll receive an email at <strong>{form.email}</strong> once approved.
          </div>
          <Link
            href="/agent-login"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Sign In After Approval
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col w-[400px] flex-shrink-0 bg-gradient-to-br from-violet-700 via-purple-700 to-indigo-800 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/5 rounded-full" />
          <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-white/5 rounded-full" />
        </div>
        <div className="relative flex flex-col h-full px-10 py-12">
          {/* DMC branding */}
          <div className="flex items-center gap-3 mb-14">
            {agentInfo?.logoUrl ? (
              <img src={agentInfo.logoUrl} alt="" className="w-10 h-10 rounded-xl object-cover border-2 border-white/20" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-lg">
                {agentInfo?.companyName?.charAt(0) || 'T'}
              </div>
            )}
            <div>
              <p className="text-white font-bold leading-tight">{agentInfo?.companyName}</p>
              <p className="text-white/50 text-xs">Travel Partner Network</p>
            </div>
          </div>

          <div className="mb-10">
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-3">Invitation</p>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Join the<br />team.
            </h1>
            <p className="text-white/70 text-sm leading-relaxed">
              Register as a travel agent under <strong className="text-white">{agentInfo?.companyName}</strong>.
              Once approved, you'll get access to their packages, quotation tools and AI planner.
            </p>
          </div>

          <div className="space-y-4 flex-1">
            {[
              { icon: UserCog, title: 'Instant Access', desc: 'Log in right after approval to start quoting.' },
              { icon: Building2, title: 'Branded Planner', desc: 'Use your agency\'s AI-powered travel planner.' },
              { icon: CheckCircle, title: 'Managed Bookings', desc: 'Track your quotations and bookings in one place.' },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="flex items-start gap-4"
              >
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{item.title}</p>
                  <p className="text-white/60 text-xs mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-lg mx-auto"
        >
          {/* Mobile header */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            {agentInfo?.logoUrl ? (
              <img src={agentInfo.logoUrl} alt="" className="w-9 h-9 rounded-xl object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center text-white font-bold">
                {agentInfo?.companyName?.charAt(0) || 'T'}
              </div>
            )}
            <div>
              <p className="font-bold text-gray-900 text-sm">{agentInfo?.companyName}</p>
              <p className="text-xs text-gray-400">Travel Agent Registration</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 p-8">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
              <p className="text-gray-500 text-sm mt-1">
                Joining <span className="font-semibold text-gray-700">{agentInfo?.companyName}</span> · Pending approval after submit
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name + Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      required
                      placeholder="Priya Sharma"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={form.phone}
                      onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+91 98765 43210"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Organization */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Agency / Organization <span className="text-gray-400 font-normal">(optional)</span></label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={form.organization}
                    onChange={e => setForm(p => ({ ...p, organization: e.target.value }))}
                    placeholder="Sunrise Travels"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    required
                    placeholder="you@agency.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
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
                      value={form.confirmPassword}
                      onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
                      required
                      placeholder="Repeat password"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-violet-600/20"
              >
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting…</>
                  : <><span>Request to Join</span><ChevronRight className="w-4 h-4" /></>
                }
              </button>

              <p className="text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link href="/agent-login" className="text-violet-600 font-semibold hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
