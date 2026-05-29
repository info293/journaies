'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import {
  MapPin, Clock, Users, Star, ChevronRight, X, Loader2,
  CheckCircle, Phone, Mail, Calendar, MessageSquare, Globe,
  AlertCircle, ArrowLeft,
} from 'lucide-react'

interface AgentInfo {
  id: string
  agentSlug: string
  companyName: string
  contactName: string
  logoUrl?: string | null
  status: string
}

interface Package {
  id: string
  title: string
  destination: string
  destinationCountry?: string
  overview: string
  durationDays: number
  durationNights: number
  pricePerPerson: number
  currency?: string
  maxGroupSize: number
  travelType: string
  theme: string
  starCategory: string
  inclusions: string[]
  highlights: string[]
  primaryImageUrl?: string
  isActive: boolean
}

interface BookingForm {
  customerName: string
  customerEmail: string
  customerPhone: string
  preferredDates: string
  adults: number
  kids: number
  rooms: number
  specialRequests: string
}

const EMPTY_FORM: BookingForm = {
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  preferredDates: '',
  adults: 2,
  kids: 0,
  rooms: 1,
  specialRequests: '',
}

function currencySymbol(code?: string) {
  const map: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SGD: 'S$' }
  return map[code ?? 'INR'] ?? '₹'
}

export default function TailoredTravelPage() {
  const { agentSlug } = useParams<{ agentSlug: string }>()
  const searchParams = useSearchParams()
  const subAgentId = searchParams.get('subAgent') ?? undefined
  const isEmbed = searchParams.get('embed') === '1'

  const sessionId = useRef(`session-${Date.now()}-${Math.random().toString(36).slice(2)}`)

  const [agent, setAgent] = useState<AgentInfo | null>(null)
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null)
  const [form, setForm] = useState<BookingForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState('')

  // Load agent + packages
  useEffect(() => {
    if (!agentSlug) return
    ;(async () => {
      try {
        const agentRes = await fetch(`/api/agent/register?slug=${encodeURIComponent(agentSlug)}`)
        if (!agentRes.ok) { setError('Travel planner not found.'); setLoading(false); return }
        const agentData = await agentRes.json()
        const agentInfo: AgentInfo = agentData.agent
        if (agentInfo.status !== 'active') { setError('This travel planner is not currently active.'); setLoading(false); return }
        setAgent(agentInfo)

        const pkgRes = await fetch(`/api/agent/packages?agentId=${agentInfo.id}`)
        if (pkgRes.ok) {
          const pkgData = await pkgRes.json()
          setPackages((pkgData.packages ?? []).filter((p: Package) => p.isActive))
        }
      } catch {
        setError('Failed to load planner. Please try again.')
      } finally {
        setLoading(false)
      }
    })()
  }, [agentSlug])

  // Track visit
  useEffect(() => {
    if (!agentSlug) return
    fetch('/api/agent/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentSlug, sessionId: sessionId.current, action: 'visit', subAgentId }),
    }).catch(() => {})
  }, [agentSlug, subAgentId])

  function openPackage(pkg: Package) {
    setSelectedPkg(pkg)
    setForm(EMPTY_FORM)
    setSubmitted(false)
    setFormError('')
    fetch('/api/agent/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentSlug, sessionId: sessionId.current, action: 'itinerary_generated',
        destination: pkg.destination, packageTitle: pkg.title, subAgentId,
      }),
    }).catch(() => {})
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agent || !selectedPkg) return
    if (!form.customerName.trim() || !form.customerEmail.trim() || !form.customerPhone.trim()) {
      setFormError('Please fill in name, email, and phone.')
      return
    }
    setFormError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/agent/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          agentSlug: agent.agentSlug,
          packageId: selectedPkg.id,
          packageTitle: selectedPkg.title,
          destination: selectedPkg.destination,
          customerName: form.customerName,
          customerEmail: form.customerEmail,
          customerPhone: form.customerPhone,
          preferredDates: form.preferredDates,
          groupSize: form.adults + form.kids,
          adults: form.adults,
          kids: form.kids,
          rooms: form.rooms,
          specialRequests: form.specialRequests,
          subAgentId: subAgentId ?? null,
          selectedPackage: selectedPkg,
        }),
      })
      if (!res.ok) throw new Error('Submission failed')
      setSubmitted(true)
      fetch('/api/agent/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentSlug, sessionId: sessionId.current, action: 'booking_submitted',
          destination: selectedPkg.destination, packageTitle: selectedPkg.title, subAgentId,
        }),
      }).catch(() => {})
    } catch {
      setFormError('Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">Loading planner…</p>
        </div>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error || !agent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center space-y-3 max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h1 className="text-lg font-bold text-gray-800">{error || 'Planner not found'}</h1>
          <p className="text-sm text-gray-500">Please check the link or contact the travel agent who shared it.</p>
        </div>
      </div>
    )
  }

  // ── Package detail + booking form ──────────────────────────────────────────
  if (selectedPkg) {
    return (
      <div className="min-h-screen bg-gray-50">
        {!isEmbed && (
          <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
            {agent.logoUrl && (
              <Image src={agent.logoUrl} alt={agent.companyName} width={36} height={36} className="rounded-lg object-contain" />
            )}
            <span className="font-bold text-gray-900 text-sm">{agent.companyName}</span>
          </header>
        )}

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
          <button onClick={() => { setSelectedPkg(null); setSubmitted(false) }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to packages
          </button>

          {/* Package summary card */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {selectedPkg.primaryImageUrl && (
              <div className="relative h-48">
                <Image src={selectedPkg.primaryImageUrl} alt={selectedPkg.title} fill className="object-cover" />
              </div>
            )}
            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-gray-900 text-lg leading-tight">{selectedPkg.title}</h2>
                  <p className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" />{selectedPkg.destination}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xl font-bold text-primary">
                    {currencySymbol(selectedPkg.currency)}{selectedPkg.pricePerPerson.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">per person</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                  <Clock className="w-3 h-3" />{selectedPkg.durationNights}N {selectedPkg.durationDays}D
                </span>
                <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                  <Star className="w-3 h-3" />{selectedPkg.starCategory}
                </span>
                <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                  <Users className="w-3 h-3" />Up to {selectedPkg.maxGroupSize} pax
                </span>
              </div>
              {selectedPkg.highlights.length > 0 && (
                <ul className="space-y-1">
                  {selectedPkg.highlights.slice(0, 4).map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />{h}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Booking form / success */}
          {submitted ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center space-y-3">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <h3 className="font-bold text-green-800 text-lg">Booking Request Sent!</h3>
              <p className="text-sm text-green-700">
                {agent.companyName} will contact you shortly to confirm your trip.
              </p>
              <button onClick={() => { setSelectedPkg(null); setSubmitted(false) }}
                className="mt-2 text-sm font-semibold text-primary hover:underline">
                Browse more packages
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 shadow-sm">
              <h3 className="font-bold text-gray-900">Your Details</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full Name *</label>
                  <div className="relative">
                    <input
                      value={form.customerName} onChange={e => setForm(p => ({ ...p, customerName: e.target.value }))}
                      placeholder="Your full name"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email *</label>
                  <div className="relative">
                    <input
                      type="email" value={form.customerEmail} onChange={e => setForm(p => ({ ...p, customerEmail: e.target.value }))}
                      placeholder="you@example.com"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone *</label>
                  <div className="relative">
                    <input
                      type="tel" value={form.customerPhone} onChange={e => setForm(p => ({ ...p, customerPhone: e.target.value }))}
                      placeholder="+91 98765 43210"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Preferred Dates</label>
                  <div className="relative">
                    <input
                      value={form.preferredDates} onChange={e => setForm(p => ({ ...p, preferredDates: e.target.value }))}
                      placeholder="e.g. Nov 15–22, 2025"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {(['adults', 'kids', 'rooms'] as const).map(field => (
                  <div key={field}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 capitalize">{field}</label>
                    <input
                      type="number" min={field === 'adults' ? 1 : 0} max={20}
                      value={form[field]} onChange={e => setForm(p => ({ ...p, [field]: Number(e.target.value) }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-center"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Special Requests</label>
                <div className="relative">
                  <textarea
                    value={form.specialRequests} onChange={e => setForm(p => ({ ...p, specialRequests: e.target.value }))}
                    rows={3} placeholder="Dietary needs, accessibility, celebrations…"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                  />
                  <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                </div>
              </div>

              {formError && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{formError}
                </p>
              )}

              <button type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</> : 'Send Booking Request'}
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  // ── Package listing ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {!isEmbed && (
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
            {agent.logoUrl && (
              <Image src={agent.logoUrl} alt={agent.companyName} width={44} height={44} className="rounded-xl object-contain border border-gray-100" />
            )}
            <div>
              <h1 className="font-bold text-gray-900 text-base leading-tight">{agent.companyName}</h1>
              <p className="text-xs text-gray-400">AI-Powered Travel Planner</p>
            </div>
          </div>
        </header>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-8">
          {isEmbed && agent.logoUrl && (
            <Image src={agent.logoUrl} alt={agent.companyName} width={56} height={56} className="rounded-2xl object-contain border border-gray-100 mx-auto mb-3" />
          )}
          <h2 className="text-2xl font-bold text-gray-900">Curated Travel Packages</h2>
          <p className="text-gray-500 text-sm mt-1">by {agent.companyName}</p>
        </div>

        {packages.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Globe className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="text-gray-500">No packages available yet.</p>
            <p className="text-sm text-gray-400">Check back soon or contact {agent.companyName} directly.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {packages.map(pkg => (
              <button
                key={pkg.id}
                onClick={() => openPackage(pkg)}
                className="text-left bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md hover:border-primary/30 transition-all group"
              >
                {pkg.primaryImageUrl ? (
                  <div className="relative h-40 overflow-hidden">
                    <Image src={pkg.primaryImageUrl} alt={pkg.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <span className="absolute bottom-2 left-3 text-white text-xs font-semibold">
                      {pkg.durationNights}N {pkg.durationDays}D
                    </span>
                  </div>
                ) : (
                  <div className="h-40 bg-gradient-to-br from-primary/10 to-purple-100 flex items-center justify-center">
                    <Globe className="w-10 h-10 text-primary/40" />
                  </div>
                )}

                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">{pkg.title}</h3>
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                  </div>
                  <p className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin className="w-3 h-3" />{pkg.destination}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex gap-1.5">
                      <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{pkg.starCategory}</span>
                      <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{pkg.travelType}</span>
                    </div>
                    <p className="text-sm font-bold text-primary">
                      {currencySymbol(pkg.currency)}{pkg.pricePerPerson.toLocaleString()}<span className="text-xs font-normal text-gray-400">/pp</span>
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {!isEmbed && (
        <footer className="mt-12 py-6 border-t border-gray-200 text-center text-xs text-gray-400">
          Powered by <span className="font-semibold text-gray-600">Travelzada</span>
        </footer>
      )}
    </div>
  )
}
