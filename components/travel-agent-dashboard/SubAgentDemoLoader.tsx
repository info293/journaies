'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, X, Loader2, CheckCircle, ChevronRight,
  BookOpen, MessageSquare, Users, BarChart3, Package,
  Activity, Home, Play, AlertCircle
} from 'lucide-react'

interface Props {
  subAgentId: string
  subAgentName: string
  parentAgentId: string
  parentAgentSlug: string
  onDone?: () => void
}

interface Step {
  id: string
  label: string
  status: 'idle' | 'loading' | 'done' | 'error'
  detail?: string
}

// ─── Feature tour ─────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Home, color: 'bg-primary/10 text-primary',
    title: 'Home',
    desc: 'Your personal command centre — greeting, KPI cards (bookings, revenue, open quotations, planner visits), recent bookings, active quotations, and your conversion funnel at a glance.',
  },
  {
    icon: BookOpen, color: 'bg-blue-100 text-blue-700',
    title: 'Bookings',
    desc: 'Every trip inquiry that came through your personalised planner link. Search by name, destination or package. Expand any row for full customer contact details.',
  },
  {
    icon: Package, color: 'bg-purple-100 text-purple-700',
    title: 'Packages',
    desc: 'Browse all active packages from your agency. Copy a direct sharing link or open the planner — both include your sub-agent ID so every booking is attributed to you.',
  },
  {
    icon: MessageSquare, color: 'bg-green-100 text-green-700',
    title: 'Quotations',
    desc: 'Request and negotiate custom quotes for your customers directly with the DMC. Two-panel chat: list on the left, full conversation on the right with real-time messaging.',
  },
  {
    icon: Users, color: 'bg-rose-100 text-rose-700',
    title: 'Customers',
    desc: 'Unique customers derived from all your bookings — contact details, trip count, confirmed spend, and status breakdown per customer.',
  },
  {
    icon: BarChart3, color: 'bg-teal-100 text-teal-700',
    title: 'My Stats',
    desc: 'Personal performance analytics: monthly bookings bar chart, planner funnel, booking status breakdown, and top destinations booked through you.',
  },
  {
    icon: Activity, color: 'bg-amber-100 text-amber-700',
    title: 'Activity',
    desc: 'Full session log — every planner visit, itinerary generated, and booking submitted by customers who used your link.',
  },
]

// ─── Demo bookings ────────────────────────────────────────────────────────────
const DEMO_BOOKINGS = [
  {
    packageTitle: 'Andaman Island Escape — 5N 6D',
    destination: 'Andaman Islands',
    customerName: 'Kavita Menon',
    customerEmail: 'kavita.menon@example.com',
    customerPhone: '+91 97654 12340',
    preferredDates: 'Jan 5–11, 2026',
    groupSize: 4, adults: 2, kids: 2, rooms: 2,
    specialRequests: 'Family with two young kids. Need child-friendly water activities.',
    status: 'confirmed', bookingValue: 112000,
  },
  {
    packageTitle: 'Rajasthan Royal Circuit — 7N 8D',
    destination: 'Rajasthan',
    customerName: 'Deepak Joshi',
    customerEmail: 'deepak.joshi@example.com',
    customerPhone: '+91 91122 33445',
    preferredDates: 'Nov 10–18, 2025',
    groupSize: 2, adults: 2, kids: 0, rooms: 1,
    specialRequests: 'Anniversary trip. Prefer heritage hotels if possible.',
    status: 'new', bookingValue: 37000,
  },
  {
    packageTitle: 'Kerala Backwaters & Hills — 6N 7D',
    destination: 'Kerala',
    customerName: 'Ritu Sharma',
    customerEmail: 'ritu.sharma@example.com',
    customerPhone: '+91 88991 23456',
    preferredDates: 'Feb 14–21, 2026',
    groupSize: 3, adults: 2, kids: 1, rooms: 2,
    specialRequests: 'Strictly vegetarian. Need a cot for the child.',
    status: 'contacted', bookingValue: 66000,
  },
]

// ─── Demo sessions ────────────────────────────────────────────────────────────
const makeSessions = (agentSlug: string, subAgentId: string) => [
  { agentSlug, subAgentId, action: 'visit',               destination: 'Andaman Islands' },
  { agentSlug, subAgentId, action: 'visit',               destination: 'Kerala' },
  { agentSlug, subAgentId, action: 'itinerary_generated', destination: 'Andaman Islands', packageTitle: 'Andaman Island Escape — 5N 6D' },
  { agentSlug, subAgentId, action: 'booking_submitted',   destination: 'Andaman Islands', packageTitle: 'Andaman Island Escape — 5N 6D' },
  { agentSlug, subAgentId, action: 'visit',               destination: 'Rajasthan' },
  { agentSlug, subAgentId, action: 'itinerary_generated', destination: 'Rajasthan',       packageTitle: 'Rajasthan Royal Circuit — 7N 8D' },
  { agentSlug, subAgentId, action: 'booking_submitted',   destination: 'Rajasthan',       packageTitle: 'Rajasthan Royal Circuit — 7N 8D' },
  { agentSlug, subAgentId, action: 'visit',               destination: 'Kerala' },
  { agentSlug, subAgentId, action: 'visit',               destination: 'Himachal Pradesh' },
  { agentSlug, subAgentId, action: 'itinerary_generated', destination: 'Kerala',          packageTitle: 'Kerala Backwaters & Hills — 6N 7D' },
  { agentSlug, subAgentId, action: 'booking_submitted',   destination: 'Kerala',          packageTitle: 'Kerala Backwaters & Hills — 6N 7D' },
  { agentSlug, subAgentId, action: 'visit',               destination: 'Andaman Islands' },
]

// ─── Demo quotations ──────────────────────────────────────────────────────────
const DEMO_QUOTATIONS = (subAgentId: string, subAgentName: string, parentAgentId: string, parentAgentSlug: string) => [
  {
    agentId: parentAgentId,
    agentSlug: parentAgentSlug,
    subAgentId,
    subAgentName,
    packageTitle: 'Andaman Island Escape — 5N 6D',
    destination: 'Andaman Islands',
    customerName: 'Sandeep & Pooja',
    customerEmail: 'sandeep.pooja@example.com',
    customerPhone: '+91 98001 23456',
    preferredDates: 'Mar 1–7, 2026',
    groupSize: 2, adults: 2, kids: 0, rooms: 1,
    specialRequests: 'Newlyweds. Romantic setup at hotel.',
    finalStatus: 'quoted',
    finalPrice: 58000,
    messages: [
      { senderRole: 'subagent', senderName: subAgentName, text: 'Hi! I have a newly married couple looking for a 5-night Andaman package in early March. Budget ₹55,000–₹60,000 for 2. Can we add a romantic package?' },
      { senderRole: 'dmc',     senderName: 'DMC',        text: 'March is a great time for Andaman! Our standard 5N package is ₹28K/person (₹56K total). Romantic add-on (flower decor, candle-lit dinner, couple\'s boat ride) is ₹2,000 extra. Total ₹58,000.' },
      { senderRole: 'subagent', senderName: subAgentName, text: 'Perfect, they love it! Can we confirm Havelock 4-star and include the Elephant Beach snorkeling?' },
      { senderRole: 'dmc',     senderName: 'DMC',        text: 'Confirmed — Barefoot Resort at Havelock (4-star). Elephant Beach snorkeling is in the Day 3 itinerary. Sending you the final quote: ₹58,000 all-inclusive.' },
    ],
  },
  {
    agentId: parentAgentId,
    agentSlug: parentAgentSlug,
    subAgentId,
    subAgentName,
    packageTitle: 'Kerala Backwaters & Hills — 6N 7D',
    destination: 'Kerala',
    customerName: 'Pradeep Family',
    customerEmail: 'pradeep.family@example.com',
    customerPhone: '+91 77001 99888',
    preferredDates: 'Dec 25–31, 2025',
    groupSize: 5, adults: 3, kids: 2, rooms: 2,
    specialRequests: 'Christmas trip. Vegetarian only. Kids aged 8 and 5.',
    finalStatus: 'in_discussion',
    finalPrice: null,
    messages: [
      { senderRole: 'subagent', senderName: subAgentName, text: 'Hello! Family of 5 (3 adults, 2 kids) wants Kerala for Christmas week (Dec 25–31). Strict vegetarians. Any special Christmas arrangements possible?' },
      { senderRole: 'dmc',     senderName: 'DMC',        text: 'Christmas in Kerala is magical! We can arrange a special Christmas dinner at the houseboat and decor at Munnar hotel. Rate for 5 people (2 rooms): ₹22K/adult = ₹66K + kid surcharge ₹5K = ₹71K total.' },
      { senderRole: 'subagent', senderName: subAgentName, text: 'That sounds amazing. Can we confirm the hotels are kid-friendly and have swimming pools?' },
    ],
  },
]

export default function SubAgentDemoLoader({ subAgentId, subAgentName, parentAgentId, parentAgentSlug, onDone }: Props) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'tour' | 'load'>('tour')
  const [steps, setSteps] = useState<Step[]>([
    { id: 'bookings',   label: 'Creating 3 demo bookings',                status: 'idle' },
    { id: 'sessions',   label: 'Adding 12 analytics events',              status: 'idle' },
    { id: 'quotations', label: 'Creating 2 quotations with chat history', status: 'idle' },
  ])
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)

  function updateStep(id: string, patch: Partial<Step>) {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  async function runDemo() {
    setRunning(true)
    setDone(false)

    // ── 1. Bookings ──────────────────────────────────────────────────────────
    updateStep('bookings', { status: 'loading' })
    let bkOk = 0
    for (const bk of DEMO_BOOKINGS) {
      try {
        const { status, bookingValue, ...payload } = bk
        const res = await fetch('/api/agent/bookings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: parentAgentId, agentSlug: parentAgentSlug, subAgentId, ...payload }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.bookingId) {
            fetch('/api/agent/bookings', {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bookingId: data.bookingId, agentId: parentAgentId, status, bookingValue }),
            }).catch(() => {})
          }
          bkOk++
        }
      } catch { }
    }
    updateStep('bookings', { status: bkOk > 0 ? 'done' : 'error', detail: `${bkOk}/${DEMO_BOOKINGS.length} created` })

    // ── 2. Sessions ──────────────────────────────────────────────────────────
    updateStep('sessions', { status: 'loading' })
    const sessDefs = makeSessions(parentAgentSlug, subAgentId)
    let sessOk = 0
    for (const s of sessDefs) {
      try {
        const res = await fetch('/api/agent/sessions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(s),
        })
        if (res.ok) sessOk++
      } catch { }
    }
    updateStep('sessions', { status: sessOk > 0 ? 'done' : 'error', detail: `${sessOk}/${sessDefs.length} events` })

    // ── 3. Quotations ────────────────────────────────────────────────────────
    updateStep('quotations', { status: 'loading' })
    const quotDefs = DEMO_QUOTATIONS(subAgentId, subAgentName, parentAgentId, parentAgentSlug)
    let quotOk = 0
    for (const q of quotDefs) {
      try {
        const { messages, finalStatus, finalPrice, ...qPayload } = q
        const res = await fetch('/api/agent/quotations', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(qPayload),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.quotationId) {
            for (const msg of messages) {
              await fetch(`/api/agent/quotations/${data.quotationId}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'message', senderId: subAgentId, ...msg }),
              }).catch(() => {})
            }
            if (finalStatus && finalStatus !== 'in_discussion') {
              await fetch(`/api/agent/quotations/${data.quotationId}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: finalStatus, quotedPrice: finalPrice }),
              }).catch(() => {})
            }
          }
          quotOk++
        }
      } catch { }
    }
    updateStep('quotations', { status: quotOk > 0 ? 'done' : 'error', detail: `${quotOk}/${quotDefs.length} created` })

    setRunning(false)
    setDone(true)
    onDone?.()
  }

  return (
    <>
      <button onClick={() => { setOpen(true); setView('tour') }}
        className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold px-4 py-2 rounded-xl text-sm shadow-md shadow-purple-200 transition-all">
        <Sparkles className="w-4 h-4" /> Demo
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 bg-black/50 z-50"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !running && setOpen(false)} />

            <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="font-bold text-gray-900">Dashboard Tour & Demo Data</h2>
                      <p className="text-xs text-gray-400">Travel Agent dashboard guide</p>
                    </div>
                  </div>
                  <button onClick={() => !running && setOpen(false)} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 px-6 flex-shrink-0">
                  {(['tour', 'load'] as const).map(v => (
                    <button key={v} onClick={() => setView(v)}
                      className={`py-3 px-2 mr-4 text-sm font-semibold border-b-2 transition-colors ${view === v ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                      {v === 'tour' ? 'Feature Tour' : 'Load Demo Data'}
                    </button>
                  ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">

                  {view === 'tour' && (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500 mb-3">Everything available in your Travel Agent dashboard:</p>
                      {FEATURES.map(f => (
                        <div key={f.title} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${f.color}`}>
                            <f.icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{f.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
                          </div>
                        </div>
                      ))}

                      <div className="mt-3 bg-primary/5 border border-primary/20 rounded-2xl p-4">
                        <p className="font-bold text-primary text-sm mb-2">How attribution works</p>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          Your planner link includes your sub-agent ID. Any booking made through that link is automatically credited to you — you can track it in Bookings, Customers, and Stats.
                        </p>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button onClick={() => setView('load')}
                          className="flex items-center gap-2 bg-primary text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-primary/90">
                          Load Demo Data <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {view === 'load' && (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-500">Loads real-looking data so you can explore every tab of your dashboard.</p>

                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { icon: BookOpen, color: 'text-blue-600 bg-blue-50', label: '3 Bookings (your attribution)', sub: 'Kavita Menon · Deepak Joshi · Ritu Sharma' },
                          { icon: BarChart3, color: 'text-teal-600 bg-teal-50', label: '12 Analytics Events', sub: 'Visits, itineraries, bookings in My Stats' },
                          { icon: MessageSquare, color: 'text-green-600 bg-green-50', label: '2 Quotations with Chat', sub: 'Quoted (4 msgs) + In Discussion (3 msgs)' },
                        ].map(item => (
                          <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
                              <item.icon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
                              <p className="text-xs text-gray-400">{item.sub}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {(running || done) && (
                        <div className="space-y-2.5 border border-gray-100 rounded-2xl p-4 bg-gray-50">
                          {steps.map(s => (
                            <div key={s.id} className="flex items-center gap-3">
                              {s.status === 'idle'    && <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />}
                              {s.status === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />}
                              {s.status === 'done'    && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                              {s.status === 'error'   && <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                              <span className={`text-sm font-medium ${s.status === 'done' ? 'text-green-700' : s.status === 'error' ? 'text-red-600' : 'text-gray-700'}`}>
                                {s.label}{s.detail && <span className="text-xs text-gray-400 ml-2">({s.detail})</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {done && (
                        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                          <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-1.5" />
                          <p className="font-bold text-green-800 text-sm">Demo data loaded!</p>
                          <p className="text-xs text-green-700 mt-0.5">Check Bookings, Quotations, Customers, and My Stats.</p>
                        </div>
                      )}

                      <div className="flex gap-3">
                        {!done ? (
                          <button onClick={runDemo} disabled={running}
                            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm">
                            {running ? <><Loader2 className="w-4 h-4 animate-spin" />Loading…</> : <><Play className="w-4 h-4" />Load Demo Data</>}
                          </button>
                        ) : (
                          <button onClick={() => setOpen(false)}
                            className="flex-1 bg-primary text-white font-semibold py-3 rounded-xl text-sm hover:bg-primary/90">
                            Explore Dashboard →
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
