'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, X, Loader2, CheckCircle, ChevronRight, Package,
  Users, Inbox, MessageSquare, BarChart2, Settings, Code2,
  UserCog, Activity, Play, AlertCircle
} from 'lucide-react'

interface Props {
  agentId: string
  agentSlug: string
  onDone?: () => void
}

interface Step {
  id: string
  label: string
  status: 'idle' | 'loading' | 'done' | 'error'
  detail?: string
}

// ─── Feature tour ───────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Package, color: 'bg-purple-100 text-purple-700',
    title: 'Packages',
    desc: 'Upload travel packages (CSV or manual). Destination, day-wise itinerary, pricing, inclusions, and star category. These power your AI planner automatically.',
  },
  {
    icon: Inbox, color: 'bg-blue-100 text-blue-700',
    title: 'Bookings',
    desc: 'Every trip request submitted via your planner appears here. Track status (new → contacted → confirmed → completed), booking value, and export to CSV.',
  },
  {
    icon: UserCog, color: 'bg-amber-100 text-amber-700',
    title: 'Travel Agents',
    desc: 'Invite sub-agents who share your planner with their customers. Share /join/your-slug — they self-register, you approve. Each booking is attributed to the agent who sent it.',
  },
  {
    icon: MessageSquare, color: 'bg-green-100 text-green-700',
    title: 'Quotations',
    desc: 'Travel agents request quotations for their customers. You negotiate itinerary, price and terms via built-in chat. Finalised quotes convert to bookings in one click.',
  },
  {
    icon: Users, color: 'bg-rose-100 text-rose-700',
    title: 'Customers',
    desc: 'Auto-built from every booking. Tag customers (VIP, Repeat, Corporate…), add private notes, and view lifetime trip count + spend at a glance.',
  },
  {
    icon: BarChart2, color: 'bg-teal-100 text-teal-700',
    title: 'Analytics',
    desc: 'Monthly revenue bar chart, planner funnel (visits → itineraries → bookings), conversion %, top destinations, average booking value, and net earnings.',
  },
  {
    icon: Code2, color: 'bg-indigo-100 text-indigo-700',
    title: 'Embed Planner',
    desc: 'Paste a single <script> tag on any website — WordPress, static HTML, Webflow — and your AI planner appears instantly. Customers book without leaving your site.',
  },
  {
    icon: Settings, color: 'bg-gray-100 text-gray-700',
    title: 'Settings',
    desc: 'Update logo, company name, WhatsApp, GST, agency type, and subscription plan. Changes reflect immediately on your branded planner page.',
  },
]

// ─── Demo packages (fallback if API returns nothing) ─────────────────────────
const DEMO_PACKAGES = [
  {
    title: 'Andaman Island Escape — 5N 6D',
    destination: 'Andaman Islands',
    destinationCountry: 'India',
    overview: 'Crystal-clear waters, pristine beaches, and vibrant coral reefs await on this curated Andaman getaway for couples and families.',
    durationDays: 6, durationNights: 5,
    pricePerPerson: 28000, maxGroupSize: 20, minGroupSize: 2,
    travelType: 'Leisure', theme: 'Beach', mood: 'Relaxing', starCategory: '4-Star',
    inclusions: ['Return flights from Chennai', '4-star hotel accommodation', 'Daily breakfast + dinner', 'Glass-bottom boat ride', 'Cellular Jail light & sound show'],
    exclusions: ['Personal expenses', 'Travel insurance', 'Water sports (optional add-on)'],
    highlights: ['Radhanagar Beach sunset', 'Havelock Island snorkeling', 'Ross Island heritage walk'],
    dayWiseItinerary: 'Day 1: Arrive Port Blair. Hotel check-in, Cellular Jail evening show.\nDay 2: Port Blair sightseeing — Corbyn\'s Cove, Anthropological Museum, local market.\nDay 3: Ferry to Havelock Island. Beach time, snorkeling at Elephant Beach.\nDay 4: Radhanagar Beach (Asia\'s finest), sea-kayaking at sunset.\nDay 5: Neil Island — Natural Bridge, Bharatpur Beach, fresh seafood lunch.\nDay 6: Return to Port Blair, souvenir shopping, departure.',
    primaryImageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
    seasonalAvailability: 'Oct–May',
  },
  {
    title: 'Kerala Backwaters & Hills — 6N 7D',
    destination: 'Kerala',
    destinationCountry: 'India',
    overview: 'Glide through emerald backwaters on a houseboat, explore misty tea gardens in Munnar, and unwind on Kovalam beach.',
    durationDays: 7, durationNights: 6,
    pricePerPerson: 22000, maxGroupSize: 15, minGroupSize: 2,
    travelType: 'Leisure', theme: 'Hills', mood: 'Relaxing', starCategory: '3-Star',
    inclusions: ['AC houseboat stay (1 night)', 'All hotel accommodation', 'Daily breakfast', 'Elephant sanctuary visit', 'Spice garden tour'],
    exclusions: ['Flights to/from Kerala', 'Lunch & dinner (except houseboat)', 'Ayurveda treatments'],
    highlights: ['Alleppey houseboat cruise', 'Munnar tea estates', 'Kathakali cultural show', 'Kovalam lighthouse beach'],
    dayWiseItinerary: 'Day 1: Arrive Kochi. Fort Kochi heritage walk, Kathakali show.\nDay 2: Drive to Munnar. Tea garden visit, Eravikulam National Park.\nDay 3: Munnar — Top Station viewpoint, Mattupetty Dam, Kundala Lake.\nDay 4: Drive to Alleppey. Houseboat check-in, sunset backwater cruise.\nDay 5: Houseboat check-out. Drive to Kovalam beach resort.\nDay 6: Kovalam — Lighthouse Beach, Ayurveda intro session, seafood dinner.\nDay 7: Trivandrum sightseeing, departure.',
    primaryImageUrl: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800',
    seasonalAvailability: 'Sep–Mar',
  },
  {
    title: 'Rajasthan Royal Circuit — 7N 8D',
    destination: 'Rajasthan',
    destinationCountry: 'India',
    overview: 'Discover the land of maharajas — majestic forts, golden deserts, and vibrant bazaars across Jaipur, Jodhpur, and Jaisalmer.',
    durationDays: 8, durationNights: 7,
    pricePerPerson: 18500, maxGroupSize: 25, minGroupSize: 2,
    travelType: 'Cultural', theme: 'Heritage', mood: 'Exploratory', starCategory: '4-Star',
    inclusions: ['AC hotel accommodation throughout', 'Daily breakfast', 'AC private cab', 'Camel safari in Jaisalmer', 'Fort entry tickets'],
    exclusions: ['Flights', 'Lunch & dinner', 'Camera fees at monuments', 'Gala dinner at fort (optional)'],
    highlights: ['Amber Fort Jaipur', 'Jaisalmer desert camel safari', 'Mehrangarh Fort Jodhpur', 'Hawa Mahal photo stop'],
    dayWiseItinerary: 'Day 1: Arrive Jaipur. Hotel check-in, pink city evening walk.\nDay 2: Amber Fort, Jantar Mantar, City Palace, Hawa Mahal.\nDay 3: Jaipur bazaars (gems, textiles), drive to Jodhpur.\nDay 4: Mehrangarh Fort, Jaswant Thada, blue city heritage walk.\nDay 5: Drive to Jaisalmer, sunset over the golden fort.\nDay 6: Jaisalmer Fort, Patwon ki Haveli, camel safari, desert camp dinner.\nDay 7: Drive back to Jodhpur. Flight / train connection.\nDay 8: Departure.',
    primaryImageUrl: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800',
    seasonalAvailability: 'Oct–Feb',
  },
  {
    title: 'Manali–Spiti Valley Adventure — 8N 9D',
    destination: 'Himachal Pradesh',
    destinationCountry: 'India',
    overview: 'An epic high-altitude road trip through Rohtang Pass, Pin Valley and Kaza with breathtaking Himalayan vistas.',
    durationDays: 9, durationNights: 8,
    pricePerPerson: 24500, maxGroupSize: 12, minGroupSize: 4,
    travelType: 'Adventure', theme: 'Hills', mood: 'Adventurous', starCategory: '3-Star',
    inclusions: ['Tempo Traveller / SUV vehicle', 'Accommodation (guesthouses & camps)', 'All meals', 'Inner Line Permits', 'Local guide'],
    exclusions: ['Flights to/from Manali', 'Personal adventure gear', 'Oxygen cylinder (available on request)', 'Medical insurance'],
    highlights: ['Rohtang Pass snow crossing', 'Key Monastery Kaza', 'Chandratal Lake camping', 'Kunzum Pass (4,590 m)', 'Dhankar Monastery'],
    dayWiseItinerary: 'Day 1: Arrive Manali. Acclimatisation walk, Mall Road.\nDay 2: Solang Valley, Rohtang Pass (if open), snow activities.\nDay 3: Drive to Kaza via Kunzum Pass. Tea & camping en route.\nDay 4: Kaza — Key Monastery, Kibber village.\nDay 5: Pin Valley National Park, Mudh village.\nDay 6: Dhankar Monastery, Tabo cave gompas.\nDay 7: Drive to Chandratal Lake. Lakeside camping.\nDay 8: Drive to Manali via Rohtang.\nDay 9: Manali departure.',
    primaryImageUrl: 'https://images.unsplash.com/photo-1585409677983-0f6c41ca9c3b?w=800',
    seasonalAvailability: 'Jun–Sep',
  },
]

// ─── Demo bookings ────────────────────────────────────────────────────────────
const DEMO_BOOKINGS = [
  {
    packageTitle: 'Andaman Island Escape — 5N 6D',
    destination: 'Andaman Islands',
    customerName: 'Priya Sharma',
    customerEmail: 'priya.sharma@example.com',
    customerPhone: '+91 98765 43210',
    preferredDates: 'Dec 20 – Dec 26, 2025',
    groupSize: 4, adults: 2, kids: 2, rooms: 2,
    specialRequests: 'Child-friendly activities preferred. Nut allergy — please flag to all hotels.',
    status: 'confirmed', bookingValue: 112000,
    customerTags: ['Family', 'Repeat'],
    customerNotes: 'Second booking with us. Prefers 4-star and above. Books 6 months in advance.',
  },
  {
    packageTitle: 'Kerala Backwaters & Hills — 6N 7D',
    destination: 'Kerala',
    customerName: 'Rahul Verma',
    customerEmail: 'rahul.verma@example.com',
    customerPhone: '+91 99887 76655',
    preferredDates: 'Jan 10 – Jan 17, 2026',
    groupSize: 2, adults: 2, kids: 0, rooms: 1,
    specialRequests: 'Honeymoon couple. Surprise flower decoration at first hotel if possible.',
    status: 'new', bookingValue: 44000,
    customerTags: ['Honeymoon', 'First-time'],
    customerNotes: 'New customer. Referred by Priya Sharma. Very responsive on WhatsApp.',
  },
  {
    packageTitle: 'Rajasthan Royal Circuit — 7N 8D',
    destination: 'Rajasthan',
    customerName: 'Sunita Patel',
    customerEmail: 'sunita.patel@example.com',
    customerPhone: '+91 91234 56789',
    preferredDates: 'Nov 5 – Nov 13, 2025',
    groupSize: 6, adults: 4, kids: 2, rooms: 3,
    specialRequests: 'Strictly vegetarian meals only. One senior citizen (72 yrs) — easy-access rooms needed.',
    status: 'contacted', bookingValue: 111000,
    customerTags: ['Family', 'VIP'],
    customerNotes: 'Corporate client at Patel Group. Books for family annually. High-value relationship — priority service.',
  },
  {
    packageTitle: 'Manali–Spiti Valley Adventure — 8N 9D',
    destination: 'Himachal Pradesh',
    customerName: 'Arjun Mehta',
    customerEmail: 'arjun.mehta@example.com',
    customerPhone: '+91 88123 45678',
    preferredDates: 'Jul 15 – Jul 24, 2026',
    groupSize: 5, adults: 5, kids: 0, rooms: 3,
    specialRequests: 'Group of college friends. Need high-altitude gear checklist. Prefer adventure add-ons.',
    status: 'completed', bookingValue: 122500,
    customerTags: ['Group', 'Adventure'],
    customerNotes: 'Young adventure group. Very active on social media — shared our planner link with 3 other groups.',
  },
]

// ─── Demo sessions (analytics events) ────────────────────────────────────────
const makeSessions = (agentSlug: string) => [
  { action: 'visit', destination: 'Andaman Islands' },
  { action: 'visit', destination: 'Kerala' },
  { action: 'visit', destination: 'Andaman Islands' },
  { action: 'itinerary_generated', destination: 'Andaman Islands', packageTitle: 'Andaman Island Escape — 5N 6D' },
  { action: 'visit', destination: 'Rajasthan' },
  { action: 'itinerary_generated', destination: 'Kerala', packageTitle: 'Kerala Backwaters & Hills — 6N 7D' },
  { action: 'visit', destination: 'Andaman Islands' },
  { action: 'booking_submitted', destination: 'Andaman Islands', packageTitle: 'Andaman Island Escape — 5N 6D' },
  { action: 'visit', destination: 'Himachal Pradesh' },
  { action: 'itinerary_generated', destination: 'Rajasthan', packageTitle: 'Rajasthan Royal Circuit — 7N 8D' },
  { action: 'visit', destination: 'Kerala' },
  { action: 'itinerary_generated', destination: 'Andaman Islands', packageTitle: 'Andaman Island Escape — 5N 6D' },
  { action: 'booking_submitted', destination: 'Kerala', packageTitle: 'Kerala Backwaters & Hills — 6N 7D' },
  { action: 'visit', destination: 'Himachal Pradesh' },
  { action: 'itinerary_generated', destination: 'Himachal Pradesh', packageTitle: 'Manali–Spiti Valley Adventure — 8N 9D' },
  { action: 'visit', destination: 'Rajasthan' },
  { action: 'booking_submitted', destination: 'Rajasthan', packageTitle: 'Rajasthan Royal Circuit — 7N 8D' },
  { action: 'visit', destination: 'Andaman Islands' },
  { action: 'booking_submitted', destination: 'Himachal Pradesh', packageTitle: 'Manali–Spiti Valley Adventure — 8N 9D' },
  { action: 'itinerary_generated', destination: 'Kerala', packageTitle: 'Kerala Backwaters & Hills — 6N 7D' },
].map(s => ({ ...s, agentSlug }))

// ─── Demo quotations (with realistic chat) ────────────────────────────────────
const DEMO_QUOTATIONS = [
  {
    subAgentName: 'Demo Travel Agent',
    packageTitle: 'Andaman Island Escape — 5N 6D',
    destination: 'Andaman Islands',
    customerName: 'Vikram Singh',
    customerEmail: 'vikram.singh@example.com',
    customerPhone: '+91 97654 32109',
    preferredDates: 'Feb 14–20, 2026',
    groupSize: 2, adults: 2, kids: 0, rooms: 1,
    specialRequests: 'Honeymoon. Need romantic setup.',
    status: 'quoted',
    quotedPrice: 62000,
    messages: [
      { senderRole: 'subagent', senderName: 'Demo Travel Agent', text: 'Hi, I have a couple looking for a 5-night Andaman honeymoon package around Valentine\'s week (Feb 14–20). Budget is around ₹60,000 for 2 people. Can we do a romantic add-on?' },
      { senderRole: 'dmc', senderName: 'DMC', text: 'Great timing! Valentine\'s week is peak season but we can accommodate. Our standard 5N package is ₹28,000/person = ₹56,000 for 2. For the romantic add-on (flower decor, candle-lit dinner, couples boat ride) it\'s an extra ₹6,000. Total ₹62,000.' },
      { senderRole: 'subagent', senderName: 'Demo Travel Agent', text: 'Perfect. The couple is happy with that. Can you confirm 4-star hotel at Havelock and include the Neil Island day trip?' },
      { senderRole: 'dmc', senderName: 'DMC', text: 'Confirmed — Symphony Palms Beach Resort at Havelock (4-star). Neil Island day trip is included in the itinerary. Sending final quote now: ₹62,000 all-inclusive.' },
      { senderRole: 'subagent', senderName: 'Demo Travel Agent', text: 'Excellent! I\'ll get the advance payment and confirm by tomorrow.' },
    ],
  },
  {
    subAgentName: 'Demo Travel Agent',
    packageTitle: 'Rajasthan Royal Circuit — 7N 8D',
    destination: 'Rajasthan',
    customerName: 'Meera & Family',
    customerEmail: 'meera.family@example.com',
    customerPhone: '+91 88765 43210',
    preferredDates: 'Oct 25 – Nov 2, 2025',
    groupSize: 8, adults: 6, kids: 2, rooms: 4,
    specialRequests: 'Family reunion. Mix of senior citizens and children. Need easy-access rooms.',
    status: 'in_discussion',
    quotedPrice: null,
    messages: [
      { senderRole: 'subagent', senderName: 'Demo Travel Agent', text: 'Hello! I have a family reunion group of 8 (including 2 kids, 2 seniors). They want a Rajasthan circuit for 8 nights in late October. Can we customise your Royal Circuit package?' },
      { senderRole: 'dmc', senderName: 'DMC', text: 'Absolutely! For 8 people we\'d need 4 rooms. The base rate is ₹18,500/person, but with a group discount of 10% for 6+ adults it comes to ₹16,650/person. For seniors we\'ll ensure ground-floor rooms and easy-access transport.' },
      { senderRole: 'subagent', senderName: 'Demo Travel Agent', text: 'That sounds good. Can we skip the camel safari and replace with a cultural cooking class? The seniors might find safari uncomfortable.' },
      { senderRole: 'dmc', senderName: 'DMC', text: 'Great idea! We\'ll swap the desert camel safari with a 2-hour royal Rajasthani cooking class at a heritage haveli. No price change. Should we also add a wheelchair for one of the seniors (we can arrange FOC)?' },
    ],
  },
]

export default function DemoDataLoader({ agentId, agentSlug, onDone }: Props) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'tour' | 'load'>('tour')
  const [steps, setSteps] = useState<Step[]>([
    { id: 'packages',   label: 'Importing packages from Rajasthan, Kashmir & Kerala', status: 'idle' },
    { id: 'bookings',   label: 'Creating demo bookings + customers', status: 'idle' },
    { id: 'sessions',   label: 'Adding analytics events',            status: 'idle' },
    { id: 'quotations', label: 'Creating quotations with chat',      status: 'idle' },
  ])
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)

  function updateStep(id: string, patch: Partial<Step>) {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  async function runDemo() {
    setRunning(true)
    setDone(false)

    // ── 1. Packages — import real Rajasthan / Kashmir / Kerala packages ───────
    updateStep('packages', { status: 'loading' })
    let pkgOk = 0
    let packagesToLoad = DEMO_PACKAGES
    try {
      const importRes = await fetch('/api/agent/import-packages')
      const importData = await importRes.json()
      if (importData.success && importData.packages.length > 0) {
        packagesToLoad = importData.packages
      }
    } catch { }
    for (const pkg of packagesToLoad) {
      try {
        const res = await fetch('/api/agent/packages', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId, ...pkg }),
        })
        if (res.ok) pkgOk++
      } catch { }
    }
    updateStep('packages', { status: pkgOk > 0 ? 'done' : 'error', detail: `${pkgOk} packages imported` })

    // ── 2. Bookings (+ customer tags/notes via PATCH on customer record) ─────
    updateStep('bookings', { status: 'loading' })
    let bkOk = 0
    for (const bk of DEMO_BOOKINGS) {
      try {
        const { status, bookingValue, customerTags, customerNotes, ...payload } = bk
        const res = await fetch('/api/agent/bookings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId, agentSlug, ...payload }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.bookingId) {
            // Patch booking with status + value
            fetch('/api/agent/bookings', {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bookingId: data.bookingId, agentId, status, bookingValue }),
            }).catch(() => {})
          }
          bkOk++
        }
      } catch { }
    }
    updateStep('bookings', { status: bkOk > 0 ? 'done' : 'error', detail: `${bkOk}/${DEMO_BOOKINGS.length} created` })

    // ── 3. Sessions (analytics events) ──────────────────────────────────────
    updateStep('sessions', { status: 'loading' })
    const sessionDefs = makeSessions(agentSlug)
    let sessOk = 0
    for (const s of sessionDefs) {
      try {
        const res = await fetch('/api/agent/sessions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(s),
        })
        if (res.ok) sessOk++
      } catch { }
    }
    updateStep('sessions', { status: sessOk > 0 ? 'done' : 'error', detail: `${sessOk}/${sessionDefs.length} events added` })

    // ── 4. Quotations with chat messages ────────────────────────────────────
    updateStep('quotations', { status: 'loading' })
    let quotOk = 0
    for (const q of DEMO_QUOTATIONS) {
      try {
        const { messages, status, quotedPrice, ...qPayload } = q
        // Create quotation — use agentId as both agentId and subAgentId so DMC sees it
        const res = await fetch('/api/agent/quotations', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId, agentSlug, subAgentId: agentId, ...qPayload }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.quotationId) {
            // Add each message in sequence
            for (const msg of messages) {
              await fetch(`/api/agent/quotations/${data.quotationId}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'message', senderId: agentId, ...msg }),
              }).catch(() => {})
            }
            // Set final status + price
            if (status !== 'in_discussion') {
              await fetch(`/api/agent/quotations/${data.quotationId}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, quotedPrice }),
              }).catch(() => {})
            }
          }
          quotOk++
        }
      } catch { }
    }
    updateStep('quotations', { status: quotOk > 0 ? 'done' : 'error', detail: `${quotOk}/${DEMO_QUOTATIONS.length} created` })

    setRunning(false)
    setDone(true)
    onDone?.()
  }

  const allDone = steps.every(s => s.status === 'done' || s.status === 'error')

  return (
    <>
      <button
        onClick={() => { setOpen(true); setView('tour') }}
        className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold px-4 py-2 rounded-xl text-sm shadow-md shadow-purple-200 transition-all"
      >
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
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="font-bold text-gray-900">Dashboard Tour & Demo Data</h2>
                      <p className="text-xs text-gray-400">Learn every feature + load realistic sample data</p>
                    </div>
                  </div>
                  <button onClick={() => !running && setOpen(false)} className="text-gray-400 hover:text-gray-700 p-1">
                    <X className="w-5 h-5" />
                  </button>
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

                  {/* ── Feature Tour ─────────────────────────────────────── */}
                  {view === 'tour' && (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500 mb-4">A quick walkthrough of every section in your DMC dashboard:</p>
                      {FEATURES.map(f => (
                        <div key={f.title} className="flex items-start gap-3 p-3.5 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${f.color}`}>
                            <f.icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{f.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
                          </div>
                        </div>
                      ))}

                      <div className="mt-4 bg-gradient-to-br from-violet-50 to-purple-50 border border-purple-100 rounded-2xl p-4">
                        <p className="font-bold text-purple-900 text-sm mb-2">Full customer journey</p>
                        <div className="flex flex-wrap gap-2 items-center text-xs text-purple-800">
                          {['Customer visits planner', 'AI builds itinerary', 'Submits booking', 'You confirm & invoice', 'Revenue tracked'].map((step, i, arr) => (
                            <span key={i} className="flex items-center gap-1">
                              <span className="bg-white border border-purple-200 px-2.5 py-1 rounded-lg font-medium">{step}</span>
                              {i < arr.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button onClick={() => setView('load')}
                          className="flex items-center gap-2 bg-primary text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-primary/90">
                          Load Demo Data <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Load Demo Data ─────────────────────────────────── */}
                  {view === 'load' && (
                    <div className="space-y-5">
                      <p className="text-sm text-gray-500">
                        One click loads <strong>realistic data across every tab</strong> — packages, bookings with customer records, analytics events, and quotations with full chat history.
                      </p>

                      {/* Preview grid */}
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { icon: Package, color: 'text-purple-600 bg-purple-50', label: '30 Real Packages', sub: 'Rajasthan (9) · Kashmir (9) · Kerala (12)' },
                          { icon: Inbox, color: 'text-blue-600 bg-blue-50', label: '4 Bookings', sub: 'New, contacted, confirmed, completed' },
                          { icon: BarChart2, color: 'text-teal-600 bg-teal-50', label: '20 Analytics Events', sub: 'Visits, itineraries, bookings' },
                          { icon: MessageSquare, color: 'text-green-600 bg-green-50', label: '2 Quotations', sub: 'Full chat: 4–5 messages each' },
                          { icon: Users, color: 'text-rose-600 bg-rose-50', label: '4 Customers', sub: 'Tags: VIP, Family, Honeymoon…' },
                        ].map(item => (
                          <div key={item.label} className={`flex items-center gap-3 p-3 rounded-xl border border-gray-100 ${item === [{ icon: Package, color: 'text-purple-600 bg-purple-50', label: '4 Packages', sub: 'Andaman · Kerala · Rajasthan · Spiti' }][0] ? '' : ''}`}>
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

                      {/* Progress steps */}
                      {(running || done) && (
                        <div className="space-y-2.5 border border-gray-100 rounded-2xl p-4 bg-gray-50">
                          {steps.map(s => (
                            <div key={s.id} className="flex items-center gap-3">
                              {s.status === 'idle'    && <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />}
                              {s.status === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />}
                              {s.status === 'done'    && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                              {s.status === 'error'   && <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                              <span className={`text-sm font-medium ${s.status === 'done' ? 'text-green-700' : s.status === 'error' ? 'text-red-600' : 'text-gray-700'}`}>
                                {s.label}
                                {s.detail && <span className="text-xs text-gray-400 ml-2">({s.detail})</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {done && (
                        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                          <CheckCircle className="w-7 h-7 text-green-500 mx-auto mb-2" />
                          <p className="font-bold text-green-800">Demo data loaded successfully!</p>
                          <p className="text-xs text-green-700 mt-1">Real Rajasthan, Kashmir & Kerala packages are now in your Packages tab. Explore Bookings, Analytics, Customers, and Quotations too.</p>
                        </div>
                      )}

                      <div className="flex gap-3">
                        {!done ? (
                          <button onClick={runDemo} disabled={running}
                            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm shadow-md shadow-purple-200">
                            {running ? <><Loader2 className="w-4 h-4 animate-spin" />Loading demo data…</> : <><Play className="w-4 h-4" />Load All Demo Data</>}
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
