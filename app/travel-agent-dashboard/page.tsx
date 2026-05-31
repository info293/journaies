'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { motion } from 'framer-motion'
import {
  BookOpen, Activity, LogOut, Loader2, Mail, Phone, MapPin, Calendar,
  CheckCircle, Clock, XCircle, Package, TrendingUp, Eye, BarChart3,
  MessageSquare, Send, Users, Copy, Check, ExternalLink, Home,
  IndianRupee, Star, ArrowUpRight, Search, ChevronDown, ChevronUp,
  Sparkles, Bot, Mic, MicOff, Volume2, Globe, Share2, FileText, Filter,
  Columns3, List, X, UserCircle, Upload, ImageIcon, FileDown
} from 'lucide-react'
import SubAgentDemoLoader from '@/components/travel-agent-dashboard/SubAgentDemoLoader'
import QuotationHistory from '@/components/dmc-dashboard/QuotationHistory'
import QuotationsManager from '@/components/dmc-dashboard/QuotationsManager'
import LogoUploader from '@/components/dmc-dashboard/LogoUploader'
import PackagePdfModal from '@/components/pdf/PackagePdfModal'
import { openPackagePdfWindow } from '@/lib/generatePackagePdf'
import { downloadPackageWord } from '@/lib/generatePackageWord'
import { getCurrencySymbol } from '@/lib/utils/currency'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Booking {
  id: string
  packageTitle: string
  destination: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  preferredDates?: string
  groupSize: number
  adults: number
  kids: number
  rooms?: number
  status: string
  bookingValue?: number
  quotedPrice?: number
  specialRequests?: string
  selectedPackage?: {
    title?: string
    primaryImageUrl?: string
    pricePerPerson?: number
    durationDays?: number
    durationNights?: number
    starCategory?: string
    travelType?: string
  }
  createdAt?: { seconds: number }
}

interface SessionEvent {
  id: string
  action: string
  destination?: string
  packageTitle?: string
  timestamp?: { seconds: number }
}

interface QuotMsg {
  id: string
  senderId: string
  senderRole: string
  senderName: string
  text: string
  timestamp: string
}

interface PackageData {
  id?: string
  title: string
  destination: string
  destinationCountry?: string
  overview?: string
  durationDays?: number
  durationNights?: number
  pricePerPerson?: number
  totalPrice?: number | null
  gst?: number | null
  currency?: string
  travelType?: string
  starCategory?: string
  inclusions?: string[]
  exclusions?: string[]
  highlights?: string[]
  dayWiseItinerary?: string
  primaryImageUrl?: string
  theme?: string
  mood?: string
  paymentPolicy?: string
  cancellationPolicy?: string
}

interface Quotation {
  id: string
  publicId?: string
  packageTitle: string
  destination: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  status: string
  quotedPrice?: number
  groupSize?: number
  adults?: number
  kids?: number
  rooms?: number
  preferredDates?: string
  specialRequests?: string
  packageId?: string
  selectedPackage?: PackageData | null
  customPackageData?: PackageData | null
  messages: QuotMsg[]
  createdAt?: { seconds: number }
}

interface AgentPackage {
  id: string
  title: string
  destination: string
  destinationCountry?: string
  durationNights: number
  durationDays: number
  pricePerPerson: number
  totalPrice?: number | null
  gst?: number | null
  currency?: string
  travelType: string
  starCategory: string
  primaryImageUrl?: string
  isActive: boolean
  overview?: string
  inclusions?: string[]
  exclusions?: string[]
  highlights?: string[]
  dayWiseItinerary?: string
  theme?: string
  mood?: string
  paymentPolicy?: string
  cancellationPolicy?: string
  hotels?: Array<{ destination: string; nights: number; hotels: string; mealPlan: string; roomType?: string }>
  vehicles?: Array<{ vehicleType: string; seats?: number }>
  minGroupSize?: number
  maxGroupSize?: number
  seasonalAvailability?: string
}

type Tab = 'planner' | 'home' | 'bookings' | 'packages' | 'quotations' | 'quote_history' | 'customers' | 'stats' | 'activity' | 'ai' | 'profile'

const INDIAN_LANGUAGES = [
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'हिंदी' },
  { code: 'bn-IN', label: 'বাংলা' },
  { code: 'ta-IN', label: 'தமிழ்' },
  { code: 'te-IN', label: 'తెలుగు' },
  { code: 'mr-IN', label: 'मराठी' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ' },
  { code: 'ml-IN', label: 'മലയാളം' },
  { code: 'gu-IN', label: 'ગુજરાતી' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ' },
  { code: 'ur-IN', label: 'اردو' },
  { code: 'or-IN', label: 'ଓଡ଼ିଆ' },
]

// ─── Status configs ───────────────────────────────────────────────────────────
const BOOKING_STATUS: Record<string, { label: string; color: string; dot: string }> = {
  new:       { label: 'New',       color: 'bg-blue-50 text-blue-700',   dot: 'bg-blue-500' },
  contacted: { label: 'Contacted', color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  confirmed: { label: 'Confirmed', color: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
  cancelled: { label: 'Cancelled', color: 'bg-red-50 text-red-700',     dot: 'bg-red-400' },
  completed: { label: 'Completed', color: 'bg-purple-50 text-purple-700', dot: 'bg-purple-500' },
}

const QUOT_STATUS: Record<string, { label: string; color: string }> = {
  pending:       { label: 'Pending',       color: 'bg-amber-50 text-amber-700' },
  in_discussion: { label: 'In Discussion', color: 'bg-blue-50 text-blue-700' },
  quoted:        { label: 'Quoted',        color: 'bg-purple-50 text-purple-700' },
  accepted:      { label: 'Accepted',      color: 'bg-green-50 text-green-700' },
  rejected:      { label: 'Rejected',      color: 'bg-red-50 text-red-700' },
  converted:     { label: 'Booked ✓',      color: 'bg-purple-100 text-purple-700' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(ts?: { seconds: number }) {
  if (!ts) return '—'
  return new Date(ts.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtDT(ts?: { seconds: number }) {
  if (!ts) return '—'
  const d = new Date(ts.seconds * 1000)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' · ' +
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function buildPackageWhatsAppMessage(pkg: AgentPackage, finalPrice?: number): string {
  const lines: string[] = []
  const currSym = getCurrencySymbol(pkg.currency)
  const isTotalPkg = Boolean(pkg.totalPrice)
  const displayPrice = finalPrice ?? (pkg.totalPrice || pkg.pricePerPerson)
  const priceLabel = isTotalPkg ? 'Total Price' : 'Price Per Person'
  const div = '━━━━━━━━━━━━━━━━━━━━━━'
  const thin = '──────────────────────'

  lines.push(`Dear Customer,`)
  lines.push(``)
  lines.push(`*${pkg.title}*`)
  lines.push(div)

  lines.push(``)
  lines.push(`*BASIC INFORMATION*`)
  lines.push(`*Destination:* ${pkg.destination}${pkg.destinationCountry ? ', ' + pkg.destinationCountry : ''}`)
  lines.push(`*Duration:* ${pkg.durationDays} Days / ${pkg.durationNights} Nights`)
  if (pkg.starCategory) lines.push(`*Hotel Category:* ${pkg.starCategory}`)
  lines.push(`*${priceLabel}:* ${currSym}${displayPrice.toLocaleString('en-IN')}${pkg.gst ? ` + ${pkg.gst}% GST` : ''}`)

  if (pkg.overview) {
    lines.push(``)
    lines.push(thin)
    lines.push(``)
    lines.push(`*OVERVIEW*`)
    lines.push(pkg.overview)
  }

  if (pkg.highlights && pkg.highlights.length > 0) {
    lines.push(``)
    lines.push(thin)
    lines.push(``)
    lines.push(`*HIGHLIGHTS*`)
    pkg.highlights.forEach(h => lines.push(`  • ${h}`))
  }

  if (pkg.dayWiseItinerary) {
    lines.push(``)
    lines.push(thin)
    lines.push(``)
    lines.push(`*DAY-WISE ITINERARY*`)
    pkg.dayWiseItinerary.split('\n').filter(Boolean).forEach(line => {
      if (/^day\s*\d+/i.test(line)) {
        lines.push(``)
        lines.push(`*${line.trim()}*`)
      } else {
        lines.push(`  • ${line.trim()}`)
      }
    })
  }

  if (Array.isArray(pkg.hotels) && pkg.hotels.length > 0) {
    lines.push(``)
    lines.push(thin)
    lines.push(``)
    lines.push(`*HOTEL INFORMATION*`)
    pkg.hotels.forEach((h: any) => {
      lines.push(``)
      lines.push(`*${h.destination || 'Hotel'}*${h.nights ? ` — ${h.nights} Night${h.nights > 1 ? 's' : ''}` : ''}`)
      if (h.hotels) lines.push(`   ${h.hotels}`)
      if (h.mealPlan) lines.push(`   Meal Plan: ${h.mealPlan}`)
      if (h.roomType) lines.push(`   Room: ${h.roomType}`)
    })
  }

  if (Array.isArray(pkg.vehicles) && pkg.vehicles.length > 0) {
    lines.push(``)
    lines.push(thin)
    lines.push(``)
    lines.push(`*TRANSPORT & TRANSFERS*`)
    pkg.vehicles.forEach((v: any) => { if (v.vehicleType) lines.push(`  ${v.vehicleType}`) })
  }

  if (pkg.inclusions && pkg.inclusions.length > 0) {
    lines.push(``)
    lines.push(thin)
    lines.push(``)
    lines.push(`*INCLUSIONS*`)
    pkg.inclusions.forEach(inc => lines.push(`  ✓ ${inc}`))
  }

  if (pkg.exclusions && pkg.exclusions.length > 0) {
    lines.push(``)
    lines.push(thin)
    lines.push(``)
    lines.push(`*EXCLUSIONS*`)
    pkg.exclusions.forEach(exc => lines.push(`  ✗ ${exc}`))
  }

  if (pkg.paymentPolicy) {
    lines.push(``)
    lines.push(thin)
    lines.push(``)
    lines.push(`*PAYMENT POLICY*`)
    pkg.paymentPolicy.split('\n').filter(Boolean).forEach(line => lines.push(`  ${line.trim()}`))
  }

  if (pkg.cancellationPolicy) {
    lines.push(``)
    lines.push(thin)
    lines.push(``)
    lines.push(`*CANCELLATION POLICY*`)
    pkg.cancellationPolicy.split('\n').filter(Boolean).forEach(line => lines.push(`  ${line.trim()}`))
  }

  return lines.join('\n')
}

export default function SubAgentDashboardPage() {
  const router = useRouter()
  const { currentUser, isSubAgent, subAgentName, parentAgentId, parentAgentSlug, loading: authLoading, logout } = useAuth()

  const pathname = usePathname()
  const pathSegments = pathname.split('/').filter(Boolean)
  const urlSegment = pathSegments.at(-1) ?? ''
  const openQuotationId = pathSegments.length === 3 && pathSegments[1] === 'quotations' ? pathSegments[2] : undefined
  const TA_VALID_TABS: Tab[] = ['planner','home','bookings','packages','quotations','quote_history','customers','stats','activity','profile']
  const urlTab: Tab = (TA_VALID_TABS as string[]).includes(urlSegment) ? (urlSegment as Tab) : 'quotations'
  const [aiActive, setAiActive] = useState(false)
  const tab: Tab = aiActive ? 'ai' : urlTab
  const setTab = (t: Tab) => {
    if (t === 'ai') { setAiActive(true); return }
    setAiActive(false)
    router.push(`/travel-agent-dashboard/${t}`)
  }
  const [bookings, setBookings] = useState<Booking[]>([])
  const [sessions, setSessions] = useState<SessionEvent[]>([])
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [packages, setPackages] = useState<AgentPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [parentAgentName, setParentAgentName] = useState('')

  // Quotation chat state
  const [selQuot, setSelQuot] = useState<Quotation | null>(null)
  const [msgText, setMsgText] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [quotFilter, setQuotFilter] = useState('all')
  const [pdfQuot, setPdfQuot] = useState<Quotation | null>(null)

  // Package detail view modal (browse packages)
  const [viewPkgDetail, setViewPkgDetail] = useState<AgentPackage | null>(null)
  const [copiedPkgId, setCopiedPkgId] = useState<string | null>(null)

  // Markup popup: shown before WhatsApp share or PDF download
  const [markupPkg, setMarkupPkg] = useState<AgentPackage | null>(null)
  const [markupPct, setMarkupPct] = useState<number>(0)
  const [markupAction, setMarkupAction] = useState<'whatsapp' | 'pdf'>('whatsapp')
  const [wordDownloading, setWordDownloading] = useState(false)
  // Package quote PDF (after markup applied)
  const [pkgPdfPkg, setPkgPdfPkg] = useState<AgentPackage | null>(null)
  const [pkgPdfFinalPrice, setPkgPdfFinalPrice] = useState<number>(0)

  // Package view/edit modal (quotation flow)
  const [viewPkgQuot, setViewPkgQuot] = useState<Quotation | null>(null)
  const [viewPkgData, setViewPkgData] = useState<PackageData | null>(null)
  const [loadingPkg, setLoadingPkg] = useState(false)
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [customForm, setCustomForm] = useState<PackageData>({ title: '', destination: '' })
  const [savingCustom, setSavingCustom] = useState(false)
  const [sharingCustom, setSharingCustom] = useState(false)
  const [customSaved, setCustomSaved] = useState(false)

  // Bookings search/filter
  const [bookSearch, setBookSearch] = useState('')
  const [bookFilter, setBookFilter] = useState('all')
  const [expandedBook, setExpandedBook] = useState<string | null>(null)

  // Package search/filter
  const [pkgSearch, setPkgSearch] = useState('')
  const [pkgDestFilter, setPkgDestFilter] = useState('all')
  const [pkgStarFilter, setPkgStarFilter] = useState('all')
  const [pkgTypeFilter, setPkgTypeFilter] = useState('all')
  const [pkgHotelFilter, setPkgHotelFilter] = useState<'all' | 'with' | 'without'>('all')

  // Quotation search
  const [quotSearch, setQuotSearch] = useState('')

  // Customer search / expand
  const [custSearch, setCustSearch] = useState('')
  const [expandedCust, setExpandedCust] = useState<string | null>(null)

  // Activity filter
  const [actFilter, setActFilter] = useState('all')

  // Profile tab state
  const [profileLogoUrl, setProfileLogoUrl] = useState('')
  const [profileLogoInput, setProfileLogoInput] = useState('')
  const [profileName, setProfileName] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [confirmSignOut, setConfirmSignOut] = useState(false)

  // AI Assistant state
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'assistant'; content: string; ts: number }[]>([])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [selectedAiPkg, setSelectedAiPkg] = useState<AgentPackage | null>(null)
  const [aiLang, setAiLang] = useState('hi-IN')
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [pkgPickerOpen, setPkgPickerOpen] = useState(false)
  const [pkgPickerSearch, setPkgPickerSearch] = useState('')
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [continuousMode, setContinuousMode] = useState(false)
  const [continuousStatus, setContinuousStatus] = useState<'listening' | 'thinking' | 'speaking' | 'idle'>('idle')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const recognitionRef = useRef<any>(null)
  const aiChatEndRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const continuousModeRef = useRef(false)
  const aiLangRef = useRef('hi-IN')
  const selectedAiPkgRef = useRef<AgentPackage | null>(null)
  const aiMessagesRef = useRef<{ role: 'user' | 'assistant'; content: string; ts: number }[]>([])

  // Redirect non-sub-agents + redirect base URL to quotations
  useEffect(() => {
    if (!authLoading) {
      if (!currentUser) router.push('/agent-login')
      else if (!isSubAgent) router.push('/')
      else if (pathname === '/travel-agent-dashboard') router.replace('/travel-agent-dashboard/quotations')
    }
  }, [authLoading, currentUser, isSubAgent, pathname, router])

  useEffect(() => { setAiActive(false) }, [pathname])

  // Fetch parent DMC name
  useEffect(() => {
    if (!parentAgentSlug) return
    fetch(`/api/agent/profile?slug=${parentAgentSlug}`)
      .then(r => r.json())
      .then(d => { if (d.success && d.agent) setParentAgentName(d.agent.companyName || d.agent.contactName || '') })
      .catch(() => {})
  }, [parentAgentSlug])

  // Fetch everything in parallel
  const fetchAll = useCallback(async () => {
    if (!currentUser || !parentAgentId || !parentAgentSlug) return
    setLoading(true)
    try {
      const [bookRes, sessRes, quotRes, pkgRes] = await Promise.all([
        fetch(`/api/agent/bookings?agentId=${parentAgentId}`),
        fetch(`/api/agent/sessions?agentSlug=${parentAgentSlug}&subAgentId=${currentUser.uid}`),
        fetch(`/api/agent/quotations?subAgentId=${currentUser.uid}`),
        fetch(`/api/agent/packages?agentId=${parentAgentId}`),
      ])
      const [bookData, sessData, quotData, pkgData] = await Promise.all([
        bookRes.json(), sessRes.json(), quotRes.json(), pkgRes.json()
      ])
      if (bookData.success) {
        const mine = bookData.bookings
          .filter((b: any) => b.subAgentId === currentUser.uid)
          .sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        setBookings(mine)
      }
      if (sessData.success) setSessions(sessData.sessions)
      if (quotData.success) {
        setQuotations(quotData.quotations.map((q: any) => ({ ...q, messages: q.messages || [] })))
      }
      if (pkgData.success) {
        setPackages(pkgData.packages.filter((p: any) => p.isActive)
          .sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
      }
    } catch { } finally { setLoading(false) }
  }, [currentUser, parentAgentId, parentAgentSlug])

  useEffect(() => {
    if (!authLoading && currentUser && isSubAgent) fetchAll()
  }, [authLoading, currentUser, isSubAgent, fetchAll])

  useEffect(() => {
    if (!currentUser || !isSubAgent) return
    fetch(`/api/agent/subagents/${currentUser.uid}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.subAgent) {
          setProfileLogoUrl(data.subAgent.logoUrl || '')
          setProfileLogoInput(data.subAgent.logoUrl || '')
          setProfileName(data.subAgent.name || '')
          setProfilePhone(data.subAgent.phone || '')
        }
      })
      .catch(() => {})
  }, [currentUser, isSubAgent])

  useEffect(() => {
    aiChatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages, aiLoading])

  // Keep refs in sync so callbacks always have latest values
  useEffect(() => { aiLangRef.current = aiLang }, [aiLang])
  useEffect(() => { selectedAiPkgRef.current = selectedAiPkg }, [selectedAiPkg])
  useEffect(() => { aiMessagesRef.current = aiMessages }, [aiMessages])

  async function sendMessage() {
    if (!msgText.trim() || !selQuot || !currentUser) return
    setSendingMsg(true)
    try {
      const res = await fetch(`/api/agent/quotations/${selQuot.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'message', senderId: currentUser.uid,
          senderRole: 'subagent',
          senderName: subAgentName || currentUser.email || 'Travel Agent',
          text: msgText.trim(),
        }),
      })
      if (res.ok) {
        const newMsg: QuotMsg = {
          id: Date.now().toString(), senderId: currentUser.uid, senderRole: 'subagent',
          senderName: subAgentName || 'Travel Agent', text: msgText.trim(), timestamp: new Date().toISOString(),
        }
        const updated = { ...selQuot, messages: [...selQuot.messages, newMsg], status: selQuot.status === 'pending' ? 'in_discussion' : selQuot.status }
        setSelQuot(updated)
        setQuotations(prev => prev.map(q => q.id === updated.id ? updated : q))
        setMsgText('')
      }
    } catch { } finally { setSendingMsg(false) }
  }

  async function saveProfile() {
    if (!currentUser) return
    setSavingProfile(true)
    setProfileError('')
    setProfileSaved(false)
    try {
      const res = await fetch(`/api/agent/subagents/${currentUser.uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logoUrl: profileLogoInput.trim(),
          name: profileName.trim() || undefined,
          phone: profilePhone.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setProfileLogoUrl(profileLogoInput.trim())
        setProfileSaved(true)
        setTimeout(() => setProfileSaved(false), 3000)
      } else {
        setProfileError(data.error || 'Failed to save')
      }
    } catch {
      setProfileError('Network error — please try again')
    } finally {
      setSavingProfile(false)
    }
  }

  // ── Standalone print window for quotation ────────────────────────────────────
  function openQuotPrintWindow(q: Quotation) {
    const pkg = q.customPackageData || q.selectedPackage
    const groupSize = q.groupSize || 1
    const isTotalQuot = Boolean(pkg?.totalPrice)
    const basePrice = pkg?.totalPrice || pkg?.pricePerPerson
    const pricePerPerson = isTotalQuot ? undefined
      : (basePrice || (q.quotedPrice ? Math.round(Number(q.quotedPrice) / groupSize) : null))
    const quotedPriceTotal = q.quotedPrice
      ? Number(q.quotedPrice)
      : isTotalQuot ? (basePrice ?? null)
      : pricePerPerson && groupSize > 1 ? pricePerPerson * groupSize : null
    openPackagePdfWindow({
      title: q.packageTitle,
      destination: q.destination,
      destinationCountry: pkg?.destinationCountry,
      heroImage: pkg?.primaryImageUrl,
      refId: q.publicId || q.id.slice(-8).toUpperCase(),
      durationDays: pkg?.durationDays,
      durationNights: pkg?.durationNights,
      starCategory: pkg?.starCategory,
      travelType: pkg?.travelType,
      theme: pkg?.theme,
      mood: pkg?.mood,
      currency: pkg?.currency,
      pricePerPerson: pricePerPerson ?? undefined,
      totalPrice: isTotalQuot ? (pkg?.totalPrice ?? undefined) : undefined,
      gst: pkg?.gst ?? undefined,
      quotedPriceTotal: quotedPriceTotal ?? undefined,
      groupSize,
      adults: q.adults,
      kids: q.kids,
      overview: pkg?.overview,
      highlights: Array.isArray(pkg?.highlights) ? pkg!.highlights.filter(Boolean) : [],
      inclusions: Array.isArray(pkg?.inclusions) ? pkg!.inclusions.filter(Boolean) : [],
      exclusions: Array.isArray(pkg?.exclusions) ? pkg!.exclusions.filter(Boolean) : [],
      dayWiseItinerary: pkg?.dayWiseItinerary,
      specialRequests: q.specialRequests,
      customerName: q.customerName,
      customerEmail: q.customerEmail,
      customerPhone: q.customerPhone,
      preferredDates: q.preferredDates,
      paymentPolicy: (pkg as any)?.paymentPolicy || (pkg as any)?.PaymentPolicy || undefined,
      cancellationPolicy: (pkg as any)?.cancellationPolicy || (pkg as any)?.CancellationPolicy || undefined,
      brandName: subAgentName || 'Travel Agent',
      termsVariant: 'quotation',
    })
  }


  // ── Standalone print window for package quote ─────────────────────────────────
  function openPkgPrintWindow(pkg: AgentPackage, finalPrice: number) {
    const isTotalPdf = Boolean(pkg.totalPrice)
    openPackagePdfWindow({
      title: pkg.title,
      destination: pkg.destination,
      destinationCountry: pkg.destinationCountry,
      heroImage: pkg.primaryImageUrl,
      durationDays: pkg.durationDays,
      durationNights: pkg.durationNights,
      starCategory: pkg.starCategory,
      travelType: pkg.travelType,
      theme: pkg.theme,
      mood: pkg.mood,
      pricePerPerson: isTotalPdf ? undefined : finalPrice,
      totalPrice: isTotalPdf ? finalPrice : undefined,
      gst: pkg.gst ?? undefined,
      currency: pkg.currency,
      overview: pkg.overview,
      highlights: Array.isArray(pkg.highlights) ? pkg.highlights.filter(Boolean) : [],
      inclusions: Array.isArray(pkg.inclusions) ? pkg.inclusions.filter(Boolean) : [],
      exclusions: Array.isArray(pkg.exclusions) ? pkg.exclusions.filter(Boolean) : [],
      dayWiseItinerary: pkg.dayWiseItinerary,
      hotels: Array.isArray(pkg.hotels) && pkg.hotels.length > 0 ? pkg.hotels : undefined,
      vehicles: Array.isArray(pkg.vehicles) && pkg.vehicles.length > 0
        ? pkg.vehicles.map(v => ({ ...v, route: '' }))
        : undefined,
      paymentPolicy: pkg.paymentPolicy || undefined,
      cancellationPolicy: pkg.cancellationPolicy || undefined,
      brandName: subAgentName || 'Travel Agent',
      agentLogoUrl: profileLogoUrl || undefined,
      termsVariant: 'brochure',
    }, 'download')
  }

  function shareQuotationWhatsApp(q: Quotation) {
    const price = q.quotedPrice ? `₹${Number(q.quotedPrice).toLocaleString('en-IN')}` : 'To be confirmed'
    const lines = [
      `🌍 *Travel Quotation*`,
      ``,
      `Hello ${q.customerName},`,
      ``,
      `Here is your travel quotation:`,
      ``,
      `📦 *Package:* ${q.packageTitle}`,
      `📍 *Destination:* ${q.destination}`,
      ``,
      `💰 *Quoted Price:* ${price}`,
      ``,
      `For more details or to confirm your booking, please reply to this message.`,
      ``,
      `Thank you for choosing us ✈️`,
    ].join('\n')

    const phone = q.customerPhone?.replace(/\D/g, '')
    const encoded = encodeURIComponent(lines)
    const url = phone
      ? `https://wa.me/${phone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`
    window.open(url, '_blank')
  }

  function openPdfForQuotation(q: Quotation, overridePkg?: PackageData | null) {
    const resolvedPkg = overridePkg || q.customPackageData || q.selectedPackage
    if (resolvedPkg?.durationDays) {
      setPdfQuot(resolvedPkg !== (q.customPackageData || q.selectedPackage)
        ? { ...q, customPackageData: resolvedPkg }
        : q)
      return
    }
    if (q.packageId) {
      const found = packages.find(p => p.id === q.packageId)
      if (found) {
        const pkgData: PackageData = {
          id: found.id, title: found.title, destination: found.destination,
          destinationCountry: found.destinationCountry, overview: found.overview,
          durationDays: found.durationDays, durationNights: found.durationNights,
          pricePerPerson: found.pricePerPerson, totalPrice: found.totalPrice, gst: found.gst, currency: found.currency,
          travelType: found.travelType,
          starCategory: found.starCategory, inclusions: found.inclusions || [],
          exclusions: found.exclusions || [], highlights: found.highlights || [],
          dayWiseItinerary: found.dayWiseItinerary || '',
          primaryImageUrl: found.primaryImageUrl, theme: found.theme, mood: found.mood,
        }
        setPdfQuot({ ...q, customPackageData: pkgData })
        return
      }
    }
    setPdfQuot(q)
  }

  function openPackageView(q: Quotation) {
    setViewPkgQuot(q)
    setEditingSection(null)
    setCustomSaved(false)

    // 1. Sub-agent's saved custom version
    if (q.customPackageData) {
      setViewPkgData(q.customPackageData)
      setCustomForm(q.customPackageData)
      return
    }

    // 2. Full package data saved at quotation-creation time
    if (q.selectedPackage && q.selectedPackage.title) {
      setViewPkgData(q.selectedPackage)
      setCustomForm(q.selectedPackage)
      return
    }

    // 3. Look up from the already-loaded packages array in state (fastest, no extra fetch)
    if (q.packageId) {
      const found = packages.find(p => p.id === q.packageId)
      if (found) {
        const pkgData: PackageData = {
          id: found.id,
          title: found.title,
          destination: found.destination,
          destinationCountry: found.destinationCountry,
          overview: found.overview,
          durationDays: found.durationDays,
          durationNights: found.durationNights,
          pricePerPerson: found.pricePerPerson,
          totalPrice: found.totalPrice,
          gst: found.gst,
          currency: found.currency,
          travelType: found.travelType,
          starCategory: found.starCategory,
          inclusions: found.inclusions || [],
          exclusions: found.exclusions || [],
          highlights: found.highlights || [],
          dayWiseItinerary: found.dayWiseItinerary || '',
          primaryImageUrl: found.primaryImageUrl,
          theme: found.theme,
          mood: found.mood,
        }
        setViewPkgData(pkgData)
        setCustomForm(pkgData)
        return
      }

      // 4. Package not in state yet (inactive/etc) — fetch directly
      setLoadingPkg(true)
      fetch(`/api/agent/packages/${q.packageId}`)
        .then(r => r.json())
        .then(data => {
          if (data.success && data.package) {
            setViewPkgData(data.package)
            setCustomForm(data.package)
          } else {
            const fb: PackageData = { title: q.packageTitle, destination: q.destination }
            setViewPkgData(fb); setCustomForm(fb)
          }
        })
        .catch(() => {
          const fb: PackageData = { title: q.packageTitle, destination: q.destination }
          setViewPkgData(fb); setCustomForm(fb)
        })
        .finally(() => setLoadingPkg(false))
      return
    }

    // 5. No package ID at all — use quotation title/destination as starting point
    const fb: PackageData = { title: q.packageTitle, destination: q.destination }
    setViewPkgData(fb)
    setCustomForm(fb)
  }

  async function saveCustomPackage(andShare = false) {
    if (!viewPkgQuot || !currentUser) return
    andShare ? setSharingCustom(true) : setSavingCustom(true)
    try {
      const groupSize = viewPkgQuot.groupSize || viewPkgQuot.adults || 1
      const newQuotedPrice = customForm.pricePerPerson
        ? Number(customForm.pricePerPerson) * groupSize
        : undefined

      // Save customPackageData + quotedPrice (if price was entered)
      const patchBody: Record<string, any> = {
        customPackageData: customForm,
        requesterId: currentUser.uid,
        requesterRole: 'subagent',
        requesterName: subAgentName || 'Travel Agent',
      }
      if (newQuotedPrice) patchBody.quotedPrice = newQuotedPrice

      await fetch(`/api/agent/quotations/${viewPkgQuot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      })

      // Update local state
      const updatedFields: Partial<Quotation> = { customPackageData: customForm }
      if (newQuotedPrice) updatedFields.quotedPrice = newQuotedPrice

      setQuotations(prev => prev.map(q =>
        q.id === viewPkgQuot.id ? { ...q, ...updatedFields } : q
      ))
      setViewPkgQuot(prev => prev ? { ...prev, ...updatedFields } : prev)
      if (selQuot?.id === viewPkgQuot.id) {
        setSelQuot(prev => prev ? { ...prev, ...updatedFields } : prev)
      }
      setViewPkgData(customForm)
      setCustomSaved(true)

      if (andShare) {
        const hasPrice = !!newQuotedPrice
        const msgText = hasPrice
          ? `✏️ Package Proposal with Price: "${customForm.title || viewPkgQuot.packageTitle}" · ₹${Number(customForm.pricePerPerson).toLocaleString('en-IN')}/person · Total ₹${newQuotedPrice.toLocaleString('en-IN')} for ${groupSize} pax. Ready for your review.`
          : `✏️ Custom Package Proposal: I've created a customized package version for ${viewPkgQuot.customerName}'s quotation — "${customForm.title}". Please review and set a price.`

        const msgRes = await fetch(`/api/agent/quotations/${viewPkgQuot.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'message',
            senderId: currentUser.uid,
            senderRole: 'subagent',
            senderName: subAgentName || 'Travel Agent',
            text: msgText,
          }),
        })
        const msgData = await msgRes.json()
        if (msgData.success) {
          const updatedMsg = msgData.message
          setQuotations(prev => prev.map(q =>
            q.id === viewPkgQuot.id ? { ...q, messages: [...q.messages, updatedMsg] } : q
          ))
          if (selQuot?.id === viewPkgQuot.id) {
            setSelQuot(prev => prev ? { ...prev, messages: [...prev.messages, updatedMsg] } : prev)
          }
        }
        setViewPkgQuot(null)
      }
    } catch { } finally {
      setSavingCustom(false)
      setSharingCustom(false)
    }
  }

  function copyPlannerUrl() {
    const url = `${window.location.origin}/tailored-travel/${parentAgentSlug}?subAgent=${currentUser?.uid}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function stopSpeaking() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }

  async function speakText(text: string, onEnd?: () => void) {
    stopSpeaking()
    setIsSpeaking(true)
    const done = () => { setIsSpeaking(false); onEnd?.() }
    try {
      const res = await fetch('/api/ai-planner/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('TTS API failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { URL.revokeObjectURL(url); done() }
      audio.onerror = () => { URL.revokeObjectURL(url); done() }
      await audio.play()
    } catch {
      if ('speechSynthesis' in window) {
        const utt = new SpeechSynthesisUtterance(text)
        utt.lang = aiLangRef.current
        utt.onend = done
        utt.onerror = done
        window.speechSynthesis.speak(utt)
      } else {
        done()
      }
    }
  }

  // Core: send a message and optionally restart listening when done
  async function sendAiMessage(text?: string, restartAfter = false) {
    const msg = (text ?? aiInput).trim()
    if (!msg) return
    const userMsg = { role: 'user' as const, content: msg, ts: Date.now() }
    const updated = [...aiMessagesRef.current, userMsg]
    setAiMessages(updated)
    setAiInput('')
    setAiLoading(true)
    if (continuousModeRef.current) setContinuousStatus('thinking')
    try {
      const res = await fetch('/api/agent/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          language: aiLangRef.current,
          packageDetails: selectedAiPkgRef.current,
          conversation: updated.slice(-20),
        }),
      })
      const data = await res.json()
      const reply = data.reply || 'Sorry, something went wrong.'
      setAiMessages(prev => [...prev, { role: 'assistant' as const, content: reply, ts: Date.now() }])
      if (autoSpeak || restartAfter) {
        if (continuousModeRef.current) setContinuousStatus('speaking')
        speakText(reply, () => {
          if (continuousModeRef.current) startContinuousListening()
        })
      } else if (continuousModeRef.current) {
        startContinuousListening()
      }
    } catch {
      setAiMessages(prev => [...prev, { role: 'assistant' as const, content: 'Error getting response. Please try again.', ts: Date.now() }])
      if (continuousModeRef.current) startContinuousListening()
    } finally {
      setAiLoading(false)
    }
  }

  // Single-shot mic toggle (manual mode)
  function toggleVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Voice input is not supported in this browser. Please use Chrome.'); return }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return }
    const recog = new SR()
    recog.lang = aiLangRef.current
    recog.continuous = false
    recog.interimResults = false
    recog.onresult = (e: any) => {
      const t = e.results[0]?.[0]?.transcript || ''
      if (t) sendAiMessage(t)
    }
    recog.onerror = () => setIsListening(false)
    recog.onend = () => setIsListening(false)
    recognitionRef.current = recog
    recog.start()
    setIsListening(true)
  }

  // Continuous mode: start one recognition round
  function startContinuousListening() {
    if (!continuousModeRef.current) return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    setContinuousStatus('listening')
    let gotResult = false
    const recog = new SR()
    recog.lang = aiLangRef.current
    recog.continuous = false
    recog.interimResults = false
    recog.onresult = (e: any) => {
      gotResult = true
      const t = e.results[0]?.[0]?.transcript?.trim() || ''
      // Stop keywords in multiple languages
      const stopWords = ['stop', 'रुको', 'बंद करो', 'நிறுத்து', 'ఆపు', 'ನಿಲ್ಲಿಸು', 'നിർത്തൂ', 'বন্ধ করো', 'ਰੁਕੋ', 'બંધ કરો']
      if (stopWords.some(w => t.toLowerCase().includes(w.toLowerCase()))) {
        stopContinuousConversation()
        return
      }
      if (t) sendAiMessage(t, true)
    }
    recog.onerror = () => {
      setIsListening(false)
      // Restart on error if still in continuous mode
      if (continuousModeRef.current) setTimeout(() => startContinuousListening(), 800)
    }
    recog.onend = () => {
      setIsListening(false)
      // If timed out without speech, restart immediately
      if (!gotResult && continuousModeRef.current) setTimeout(() => startContinuousListening(), 400)
    }
    recognitionRef.current = recog
    recog.start()
    setIsListening(true)
  }

  function startContinuousConversation() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Voice conversation requires Chrome or Edge browser.'); return }
    continuousModeRef.current = true
    setContinuousMode(true)
    stopSpeaking()
    startContinuousListening()
  }

  function stopContinuousConversation() {
    continuousModeRef.current = false
    setContinuousMode(false)
    setContinuousStatus('idle')
    recognitionRef.current?.stop()
    stopSpeaking()
    setIsListening(false)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  // ── Computed stats ────────────────────────────────────────────────────────
  const visits = sessions.filter(s => s.action === 'visit').length
  const itineraries = sessions.filter(s => s.action === 'itinerary_generated').length
  const bookingEvents = sessions.filter(s => s.action === 'booking_submitted').length
  const convRate = visits > 0 ? Math.round((bookingEvents / visits) * 100) : 0
  const confirmedBks = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed')
  const totalRevenue = confirmedBks.reduce((s, b) => s + (b.bookingValue || 0), 0)
  const pendingQuots = quotations.filter(q => q.status === 'pending' || q.status === 'in_discussion').length

  // Customers derived from bookings + quotations
  const customerMap = new Map<string, { name: string; email: string; phone?: string; bookings: Booking[]; quotations: Quotation[] }>()
  bookings.forEach(b => {
    const k = (b.customerEmail || '').toLowerCase()
    if (!k) return
    if (!customerMap.has(k)) customerMap.set(k, { name: b.customerName, email: b.customerEmail, phone: b.customerPhone, bookings: [], quotations: [] })
    customerMap.get(k)!.bookings.push(b)
  })
  quotations.forEach(q => {
    const k = (q.customerEmail || '').toLowerCase()
    if (!k) return
    if (!customerMap.has(k)) customerMap.set(k, { name: q.customerName, email: q.customerEmail, phone: q.customerPhone, bookings: [], quotations: [] })
    customerMap.get(k)!.quotations.push(q)
  })
  const customers = Array.from(customerMap.values())

  // Monthly bookings for mini chart (last 6 months)
  const monthlyMap: Record<string, number> = {}
  bookings.forEach(b => {
    if (!b.createdAt) return
    const d = new Date(b.createdAt.seconds * 1000)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyMap[k] = (monthlyMap[k] || 0) + 1
  })
  const last6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { label: d.toLocaleDateString('en-IN', { month: 'short' }), count: monthlyMap[k] || 0 }
  })
  const maxMonthly = Math.max(...last6.map(m => m.count), 1)

  const plannerUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/tailored-travel/${parentAgentSlug}?subAgent=${currentUser?.uid}`
    : `/tailored-travel/${parentAgentSlug}`

  const TABS: { id: Tab; label: string; icon: any; badge?: number }[] = [
    { id: 'planner',      label: 'AI Planner',  icon: Sparkles },
    { id: 'quotations',   label: 'Quotations',  icon: MessageSquare, badge: pendingQuots || undefined },
    { id: 'packages',     label: 'Packages',    icon: Package },
    { id: 'profile',      label: 'My Profile',  icon: UserCircle },
    // { id: 'home',      label: 'Home',        icon: Home },
    // { id: 'bookings',  label: 'Bookings',    icon: BookOpen, badge: bookings.filter(b => b.status === 'new').length || undefined },
    // { id: 'stats',     label: 'My Stats',    icon: BarChart3 },
    // { id: 'ai',        label: 'AI',          icon: Bot },
    // { id: 'quote_history', label: 'Quote History', icon: BarChart3 },
    // { id: 'customers', label: 'Customers',   icon: Users },
    // { id: 'activity',  label: 'Activity',    icon: Activity },
  ]

  // Filtered bookings
  const filteredBooks = bookings.filter(b => {
    const matchSearch = !bookSearch || b.customerName.toLowerCase().includes(bookSearch.toLowerCase()) ||
      b.packageTitle.toLowerCase().includes(bookSearch.toLowerCase()) ||
      b.destination.toLowerCase().includes(bookSearch.toLowerCase())
    const matchStatus = bookFilter === 'all' || b.status === bookFilter
    return matchSearch && matchStatus
  })

  const WITH_HOTEL_CATS = new Set(['3-Star', '4-Star', '5-Star', '3 Star', '4 Star', '5 Star'])

  // Filtered packages — full-text word-by-word search across all fields
  const filteredPkgs = packages.filter(p => {
    const q = pkgSearch.toLowerCase().trim()
    let matchSearch = true
    if (q) {
      const itineraryText = (typeof p.dayWiseItinerary === 'string' ? p.dayWiseItinerary : '').replace(/\|\|/g, ' ')
      const haystack = [
        p.title, p.destination, p.destinationCountry, p.travelType, p.starCategory,
        p.theme, p.mood, p.overview, String(p.durationDays ?? ''), String(p.durationNights ?? ''),
        String(p.pricePerPerson ?? ''), String((p as any).totalPrice ?? ''),
        itineraryText,
        Array.isArray(p.highlights) ? p.highlights.join(' ') : '',
        Array.isArray(p.inclusions) ? p.inclusions.join(' ') : '',
        Array.isArray(p.exclusions) ? p.exclusions.join(' ') : '',
        Array.isArray((p as any).perks) ? (p as any).perks.join(' ') : '',
      ].join(' ').toLowerCase()
      matchSearch = q.split(/\s+/).filter(Boolean).every(word => haystack.includes(word))
    }
    const matchDest = pkgDestFilter === 'all' || p.destination === pkgDestFilter
    const matchHotel = pkgHotelFilter === 'all' || (pkgHotelFilter === 'with' ? WITH_HOTEL_CATS.has(p.starCategory || '') : !WITH_HOTEL_CATS.has(p.starCategory || ''))
    return matchSearch && matchDest && matchHotel
  })

  // Filtered quotations
  const filteredQuots = quotations.filter(q => {
    const matchStatus = quotFilter === 'all' || q.status === quotFilter
    const qs = quotSearch.toLowerCase()
    const matchSearch = !qs || q.customerName.toLowerCase().includes(qs) || q.packageTitle.toLowerCase().includes(qs) || q.destination.toLowerCase().includes(qs) || (q.publicId?.toLowerCase().includes(qs) ?? false)
    return matchStatus && matchSearch
  })

  // Filtered customers
  const filteredCustomers = (() => {
    const cs = custSearch.toLowerCase()
    return customers.filter(c => !cs || c.name.toLowerCase().includes(cs) || c.email.toLowerCase().includes(cs) || (c.phone || '').includes(cs))
  })()

  return (
    <div className="min-h-screen bg-gray-50 flex h-screen overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-60 bg-white border-r border-gray-100 flex-col hidden md:flex flex-shrink-0">
        {/* Profile */}
        <div className="px-5 py-5 border-b border-gray-100">
          <button onClick={() => setTab('profile')} className="block mb-2">
            {profileLogoUrl ? (
              <img src={profileLogoUrl} alt="Logo" className="w-11 h-11 rounded-xl object-contain border border-gray-200 bg-gray-50" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                {subAgentName?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
          </button>
          <p className="font-bold text-gray-900 text-sm leading-tight">{subAgentName || 'Travel Agent'}</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{currentUser?.email}</p>
          <span className="mt-1.5 inline-block bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">Travel Agent</span>
        </div>

        {/* Planner link */}
        <div className="mx-3 mt-3 mb-1 bg-primary/5 border border-primary/20 rounded-xl p-3">
          <p className="text-[10px] font-bold text-primary uppercase tracking-wide mb-1">My Planner Link</p>
          <p className="text-[11px] text-gray-500 font-mono break-all leading-relaxed">/tailored-travel/{parentAgentSlug}</p>
          <div className="flex gap-3 mt-2">
            <button onClick={copyPlannerUrl} className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80">
              {copied ? <><Check className="w-3 h-3" />Copied!</> : <><Copy className="w-3 h-3" />Copy</>}
            </button>
            <a href={plannerUrl} target="_blank" className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80">
              <ExternalLink className="w-3 h-3" />Open
            </a>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors relative ${
                tab === t.id ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}>
              <t.icon className="w-4 h-4 flex-shrink-0" />
              {t.label}
              {t.badge ? (
                <span className={`ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-white text-primary' : 'bg-primary text-white'}`}>
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Topbar */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10 flex-shrink-0">
          <div>
            <h1 className="font-bold text-gray-900">
              {TABS.find(t => t.id === tab)?.label || 'Dashboard'}
            </h1>
            <p className="text-xs text-gray-400">Travel Agent Dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            {/* {currentUser && parentAgentId && parentAgentSlug && (
              <SubAgentDemoLoader
                subAgentId={currentUser.uid}
                subAgentName={subAgentName || 'Travel Agent'}
                parentAgentId={parentAgentId}
                parentAgentSlug={parentAgentSlug}
                onDone={fetchAll}
              />
            )} */}
            <a href={plannerUrl} target="_blank"
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/5 px-3 py-1.5 rounded-lg hover:bg-primary/10">
              <ExternalLink className="w-3.5 h-3.5" />My Planner
            </a>
            <button onClick={() => logout().then(() => router.push('/agent-login'))} className="md:hidden text-gray-400 hover:text-gray-700">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 pb-24 md:pb-6">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>

            {/* ══════════════════════ AI PLANNER ═══════════════════════════ */}
            {tab === 'planner' && (
              <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
                {/* Toolbar */}
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <div>
                    <h2 className="font-bold text-gray-900">AI Travel Planner</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Use the planner directly — your bookings will be tracked to your account</p>
                  </div>
                  <a
                    href={plannerUrl}
                    target="_blank"
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/5 px-3 py-1.5 rounded-lg hover:bg-primary/10"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />Open in new tab
                  </a>
                </div>
                {/* Iframe */}
                <div className="flex-1 rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white">
                  <iframe
                    key={parentAgentSlug}
                    src={`/tailored-travel/${parentAgentSlug}?embed=1&subAgent=${currentUser?.uid}`}
                    className="w-full h-full"
                    allow="microphone; camera"
                    title="AI Travel Planner"
                  />
                </div>
              </div>
            )}

            {/* ══════════════════════ HOME ══════════════════════════════════ */}
            {tab === 'home' && (
              <div className="space-y-6">
                {/* Greeting */}
                <div className="bg-gradient-to-br from-primary/90 to-primary rounded-2xl p-5 text-white">
                  <p className="text-sm opacity-80 mb-0.5">Welcome back,</p>
                  <h2 className="text-xl font-bold">{subAgentName || 'Travel Agent'} 👋</h2>
                  <p className="text-sm opacity-70 mt-1">Here's your performance snapshot</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    {[
                      { label: 'My Bookings', value: bookings.length, icon: BookOpen },
                      { label: 'Revenue (confirmed)', value: `₹${(totalRevenue / 1000).toFixed(0)}K`, icon: IndianRupee },
                      { label: 'Open Quotations', value: pendingQuots, icon: MessageSquare },
                      { label: 'Planner Visits', value: visits, icon: Eye },
                    ].map(s => (
                      <div key={s.label} className="bg-white/15 rounded-xl p-3 text-center">
                        <p className="text-xl font-bold">{s.value}</p>
                        <p className="text-[11px] opacity-75 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Recent bookings */}
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-900">Recent Bookings</h3>
                      <button onClick={() => setTab('bookings')} className="text-xs text-primary font-semibold hover:underline">View all →</button>
                    </div>
                    {bookings.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">No bookings yet. Share your planner link to get started.</p>
                    ) : (
                      <div className="space-y-2">
                        {bookings.slice(0, 4).map(b => {
                          const s = BOOKING_STATUS[b.status] || BOOKING_STATUS.new
                          return (
                            <div key={b.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 text-sm truncate">{b.customerName}</p>
                                <p className="text-xs text-gray-500 truncate">{b.packageTitle} · {fmt(b.createdAt)}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                {b.bookingValue ? <p className="text-sm font-bold text-gray-900">₹{(b.bookingValue / 1000).toFixed(0)}K</p> : null}
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${s.color}`}>{s.label}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Quick panel */}
                  <div className="space-y-3">
                    {/* Planner link card */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-4">
                      <p className="font-bold text-gray-900 text-sm mb-1">My Planner Link</p>
                      <p className="text-xs text-gray-500 mb-2">Share this link to track bookings from your clients</p>
                      <div className="bg-gray-50 rounded-xl px-3 py-2 text-xs font-mono text-gray-600 break-all mb-2">/tailored-travel/{parentAgentSlug}</div>
                      <div className="flex gap-2">
                        <button onClick={copyPlannerUrl} className="flex-1 flex items-center justify-center gap-1.5 bg-primary/10 text-primary font-semibold text-xs py-2 rounded-xl hover:bg-primary/20">
                          {copied ? <><Check className="w-3.5 h-3.5" />Copied!</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
                        </button>
                        <a href={plannerUrl} target="_blank" className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-white font-semibold text-xs py-2 rounded-xl hover:bg-primary/90">
                          <ExternalLink className="w-3.5 h-3.5" />Open
                        </a>
                      </div>
                    </div>

                    {/* Active quotations */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-bold text-gray-900 text-sm">Active Quotations</p>
                        <button onClick={() => setTab('quotations')} className="text-xs text-primary font-semibold hover:underline">View →</button>
                      </div>
                      {quotations.length === 0 ? (
                        <p className="text-xs text-gray-400 py-2 text-center">No quotations yet</p>
                      ) : (
                        <div className="space-y-2">
                          {quotations.filter(q => ['pending', 'in_discussion', 'quoted'].includes(q.status)).slice(0, 3).map(q => {
                            const sc = QUOT_STATUS[q.status]
                            return (
                              <button key={q.id} onClick={() => { setSelQuot(q); setTab('quotations') }}
                                className="w-full text-left flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl hover:bg-primary/5">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-gray-900 truncate">{q.customerName}</p>
                                  <p className="text-[11px] text-gray-500 truncate">{q.packageTitle}</p>
                                </div>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${sc?.color}`}>{sc?.label}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Quick stats */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-4">
                      <p className="font-bold text-gray-900 text-sm mb-3">Funnel</p>
                      {[
                        { label: 'Planner visits', value: visits, color: 'bg-blue-500' },
                        { label: 'Itineraries generated', value: itineraries, color: 'bg-purple-500' },
                        { label: 'Bookings submitted', value: bookingEvents, color: 'bg-green-500' },
                      ].map(s => (
                        <div key={s.label} className="flex items-center gap-2 mb-2">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.color}`} />
                          <span className="text-xs text-gray-600 flex-1">{s.label}</span>
                          <span className="text-sm font-bold text-gray-900">{s.value}</span>
                        </div>
                      ))}
                      <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-xs">
                        <span className="text-gray-500">Conversion rate</span>
                        <span className="font-bold text-primary">{convRate}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════ BOOKINGS ══════════════════════════════ */}
            {tab === 'bookings' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input value={bookSearch} onChange={e => setBookSearch(e.target.value)}
                      placeholder="Search customer, package, destination…"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {['all', 'new', 'contacted', 'confirmed', 'completed'].map(s => (
                      <button key={s} onClick={() => setBookFilter(s)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full capitalize transition-colors ${bookFilter === s ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {s === 'all' ? `All (${bookings.length})` : `${s} (${bookings.filter(b => b.status === s).length})`}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredBooks.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                    <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No bookings found. Share your planner link to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredBooks.map(b => {
                      const s = BOOKING_STATUS[b.status] || BOOKING_STATUS.new
                      const expanded = expandedBook === b.id
                      return (
                        <div key={b.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                          <button className="w-full text-left p-5" onClick={() => setExpandedBook(expanded ? null : b.id)}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <p className="font-bold text-gray-900">{b.customerName}</p>
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
                                </div>
                                <p className="text-sm text-gray-600">{b.packageTitle}</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
                                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{b.destination}</span>
                                  {b.preferredDates && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{b.preferredDates}</span>}
                                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{b.groupSize} guests</span>
                                </div>
                              </div>
                                      <div className="flex items-center gap-3 flex-shrink-0">
                                {(() => {
                                  const selPkg = b.selectedPackage as any
                                  const pax = b.groupSize || b.adults || 1
                                  const estValue = selPkg?.totalPrice ?? (selPkg?.pricePerPerson ? selPkg.pricePerPerson * pax : 0)
                                  const price = b.bookingValue || estValue || b.quotedPrice
                                  const currSym = getCurrencySymbol(selPkg?.currency)
                                  return price ? (
                                    <div className="text-right">
                                      <p className={`text-base font-bold ${b.bookingValue ? 'text-emerald-700' : 'text-purple-600'}`}>{currSym}{Number(price).toLocaleString('en-IN')}</p>
                                      <p className="text-[10px] text-gray-400">{b.bookingValue ? 'confirmed' : 'est. value'}</p>
                                    </div>
                                  ) : null
                                })()}
                                {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                              </div>
                            </div>
                          </button>
                          {expanded && (
                            <div className="border-t border-gray-100 bg-gray-50/40">
                              {/* Package strip */}
                              {b.selectedPackage && (
                                <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-white">
                                  {b.selectedPackage.primaryImageUrl && (
                                    <img src={b.selectedPackage.primaryImageUrl} alt="" className="w-12 h-9 object-cover rounded-lg flex-shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-gray-800 truncate">{b.selectedPackage.title || b.packageTitle}</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                      {b.selectedPackage.durationNights}N / {b.selectedPackage.durationDays}D
                                      {b.selectedPackage.starCategory && ` · ${b.selectedPackage.starCategory}`}
                                      {b.selectedPackage.travelType && ` · ${b.selectedPackage.travelType}`}
                                    </p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-[10px] text-gray-400">{(b.selectedPackage as any).totalPrice ? 'Total price' : 'Per person'}</p>
                                    <p className="text-sm font-bold text-purple-700">{getCurrencySymbol((b.selectedPackage as any).currency)}{Number((b.selectedPackage as any).totalPrice || b.selectedPackage.pricePerPerson).toLocaleString('en-IN')}</p>
                                  </div>
                                </div>
                              )}
                              <div className="px-5 pb-5 pt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                                <div>
                                  <p className="text-xs text-gray-400 mb-0.5">Email</p>
                                  {b.customerEmail
                                    ? <a href={`mailto:${b.customerEmail}`} className="text-primary font-medium hover:underline text-xs">{b.customerEmail}</a>
                                    : <p className="text-xs text-gray-400 italic">Not provided</p>}
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400 mb-0.5">Phone</p>
                                  {b.customerPhone
                                    ? <a href={`https://wa.me/${b.customerPhone.replace(/\D/g,'')}`} target="_blank" className="text-green-600 font-medium hover:underline text-xs">{b.customerPhone}</a>
                                    : <p className="text-xs text-gray-400 italic">Not provided</p>}
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400 mb-0.5">Group</p>
                                  <p className="font-medium text-xs">{b.adults || 1} adult{(b.adults || 1) !== 1 ? 's' : ''}{b.kids ? `, ${b.kids} kids` : ''} · {b.rooms || 1} room</p>
                                </div>
                                {b.preferredDates && (
                                  <div>
                                    <p className="text-xs text-gray-400 mb-0.5">Travel Dates</p>
                                    <p className="font-medium text-xs">{b.preferredDates}</p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-xs text-gray-400 mb-0.5">Submitted</p>
                                  <p className="font-medium text-xs">{fmt(b.createdAt)}</p>
                                </div>
                                {b.bookingValue && (
                                  <div>
                                    <p className="text-xs text-gray-400 mb-0.5">Confirmed Value</p>
                                    <p className="font-bold text-xs text-emerald-700">₹{Number(b.bookingValue).toLocaleString('en-IN')}</p>
                                  </div>
                                )}
                                {b.specialRequests && (
                                  <div className="col-span-2 sm:col-span-3 bg-white rounded-xl p-3 border border-gray-200">
                                    <p className="text-xs text-gray-400 mb-0.5">Special Requests</p>
                                    <p className="text-xs text-gray-700">{b.specialRequests}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════ PACKAGES ══════════════════════════════ */}
            {tab === 'packages' && (
              <div className="space-y-3">
                {/* Filter bar — row 1: search */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input value={pkgSearch} onChange={e => setPkgSearch(e.target.value)}
                      placeholder="Search anything — title, destination, hotel, itinerary, inclusions…"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="text-xs text-gray-500 font-semibold mr-0.5">Hotel:</span>
                    {(['all', 'with', 'without'] as const).map(h => (
                      <button key={h} onClick={() => setPkgHotelFilter(h)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${pkgHotelFilter === h ? 'bg-amber-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {h === 'all' ? 'All' : h === 'with' ? '🏨 With Hotel' : '🏕️ Without Hotel'}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Filter bar — row 2: destination + count */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {Array.from(new Set(packages.map(p => p.destination))).length > 1 && (
                    <select value={pkgDestFilter} onChange={e => setPkgDestFilter(e.target.value)}
                      className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                      <option value="all">All Destinations</option>
                      {Array.from(new Set(packages.map(p => p.destination))).sort().map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  )}
                  {(pkgSearch || pkgDestFilter !== 'all' || pkgHotelFilter !== 'all') && (
                    <button onClick={() => { setPkgSearch(''); setPkgDestFilter('all'); setPkgHotelFilter('all') }}
                      className="text-xs text-gray-400 hover:text-red-500 font-semibold">Clear</button>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">{filteredPkgs.length} of {packages.length}</span>
                </div>

                {filteredPkgs.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No packages match your filters</p>
                    <button onClick={() => { setPkgSearch(''); setPkgDestFilter('all'); setPkgHotelFilter('all') }}
                      className="mt-2 text-primary text-xs font-semibold hover:underline">Clear filters</button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 overflow-hidden">
                    {filteredPkgs.map(pkg => {
                      const PERKS_MAP: Record<string, string> = {
                        'Free Airport Transfer': '🚗', 'Complimentary Breakfast': '🍳', 'All Meals Included': '🍽️',
                        'Free WiFi': '📶', 'Travel Insurance': '🛡️', 'Entry Tickets Included': '🎟️',
                        'English-Speaking Guide': '🎯', 'Sightseeing Included': '🚌', 'Free Cancellation': '🔄',
                        'Welcome Drink': '🍾', 'Water Sports Included': '🏄', 'Wildlife Safari Included': '🦁',
                        'Complimentary Spa': '💆', 'Pool Access': '🏊', 'Early Check-in / Late Checkout': '🏨',
                        'Porter Service': '🎒', 'Ferry / Cruise Included': '🚢', 'Professional Photography': '📸',
                      }
                      const perks: string[] = Array.isArray((pkg as any).perks) ? (pkg as any).perks : []
                      const pax = { a: (pkg as any).adults ?? 0, c: (pkg as any).children ?? 0, i: (pkg as any).infants ?? 0 }
                      const hasPax = pax.a + pax.c + pax.i > 0
                      return (
                        <div key={pkg.id} className="flex items-center gap-4 p-4 bg-white hover:bg-gray-50 transition-colors">
                          {/* Thumbnail */}
                          {pkg.primaryImageUrl ? (
                            <img src={pkg.primaryImageUrl} alt={pkg.title} className="w-16 h-12 object-cover rounded-lg flex-shrink-0" />
                          ) : (
                            <div className="w-16 h-12 bg-primary/10 rounded-lg flex-shrink-0 flex items-center justify-center">
                              <Package className="w-5 h-5 text-primary/40" />
                            </div>
                          )}
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{pkg.title}</p>
                            <p className="text-sm text-gray-500">
                              {pkg.destination} · {pkg.durationNights}N · {pkg.starCategory || 'No Hotel'} · {(pkg as any).totalPrice ? `${getCurrencySymbol((pkg as any).currency)}${Number((pkg as any).totalPrice).toLocaleString()} total` : `${getCurrencySymbol(pkg.currency)}${pkg.pricePerPerson.toLocaleString()}/person`}
                              {hasPax && (
                                <span className="ml-1">
                                  · 👥 {pax.a}A{pax.c > 0 ? ` ${pax.c}C` : ''}{pax.i > 0 ? ` ${pax.i}I` : ''}
                                </span>
                              )}
                            </p>
                            {perks.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {perks.slice(0, 4).map(p => (
                                  <span key={p} className="inline-flex items-center gap-1 text-[10px] font-semibold bg-primary/5 text-primary border border-primary/10 px-2 py-0.5 rounded-full">
                                    {PERKS_MAP[p] ?? '✓'} {p}
                                  </span>
                                ))}
                                {perks.length > 4 && (
                                  <span className="text-[10px] font-semibold text-gray-400 px-2 py-0.5">+{perks.length - 4} more</span>
                                )}
                              </div>
                            )}
                          </div>
                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => setViewPkgDetail(pkg)} title="Preview"
                              className="p-1.5 rounded-lg bg-indigo-50 text-indigo-500 hover:bg-indigo-100 transition-colors">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => { setMarkupPkg(pkg); setMarkupPct(0); setMarkupAction('whatsapp') }} title="Share on WhatsApp"
                              className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
                              <Share2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => { setMarkupPkg(pkg); setMarkupPct(0); setMarkupAction('pdf') }} title="Download Quote PDF"
                              className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                              <FileText className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════ QUOTATIONS ════════════════════════════ */}
            {tab === 'quotations' && currentUser && parentAgentId && parentAgentSlug && (
              <QuotationsManager
                agentId={parentAgentId}
                agentSlug={parentAgentSlug}
                agentName={subAgentName || ''}
                currentUserId={currentUser.uid}
                subAgentId={currentUser.uid}
                toName={parentAgentName}
                openCustomizeId={openQuotationId}
              />
            )}

            {/* ══════════════════════ QUOTE HISTORY ══════════════════════════ */}
            {tab === 'quote_history' && currentUser && parentAgentId && (
              <QuotationHistory agentId={parentAgentId} subAgentId={currentUser.uid} />
            )}

            {/* ══════════════════════ CUSTOMERS ══════════════════════════════ */}
            {tab === 'customers' && (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Customers</h2>
                    <p className="text-sm text-gray-500">{customers.length} customer{customers.length !== 1 ? 's' : ''}</p>
                  </div>
                  {customers.length > 0 && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input value={custSearch} onChange={e => setCustSearch(e.target.value)}
                        placeholder="Search by name, email, phone…"
                        className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 w-56" />
                    </div>
                  )}
                </div>

                {/* KPI row */}
                {customers.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Total Customers', value: customers.length, color: 'bg-purple-50 text-purple-600' },
                      { label: 'Total Bookings', value: customers.reduce((s, c) => s + c.bookings.length, 0), color: 'bg-blue-50 text-blue-600' },
                      { label: 'Quotations Sent', value: customers.reduce((s, c) => s + c.quotations.length, 0), color: 'bg-amber-50 text-amber-600' },
                    ].map(s => (
                      <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
                        <p className={`text-2xl font-bold ${s.color.split(' ')[1]}`}>{s.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {customers.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                    <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="font-medium text-gray-500">No customers yet</p>
                    <p className="text-sm text-gray-400 mt-1">Customers appear automatically from your bookings and quotations.</p>
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
                    <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No customers match your search.</p>
                    <button onClick={() => setCustSearch('')} className="mt-2 text-xs text-primary font-semibold hover:underline">Clear search</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredCustomers.map(c => {
                      const spend = c.bookings.reduce((s, b) => s + (b.bookingValue || b.quotedPrice || 0), 0)
                      const confirmedCount = c.bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length
                      const isExpanded = expandedCust === c.email
                      const totalActivity = c.bookings.length + c.quotations.length

                      return (
                        <div key={c.email} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                          {/* Row */}
                          <div
                            className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50/60 transition-colors"
                            onClick={() => setExpandedCust(isExpanded ? null : c.email)}
                          >
                            {/* Avatar */}
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                              {c.name?.charAt(0).toUpperCase() || '?'}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                <span className="flex items-center gap-1 text-xs text-gray-400">
                                  <Mail className="w-3 h-3" />
                                  <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} className="hover:text-primary transition-colors">{c.email}</a>
                                </span>
                                {c.phone && (
                                  <span className="flex items-center gap-1 text-xs text-gray-400">
                                    <Phone className="w-3 h-3" />{c.phone}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Stats */}
                            <div className="hidden sm:flex items-center gap-4 text-center flex-shrink-0 mr-1">
                              <div>
                                <p className="text-sm font-bold text-gray-900">{c.bookings.length}</p>
                                <p className="text-[10px] text-gray-400">bookings</p>
                              </div>
                              {c.quotations.length > 0 && (
                                <div>
                                  <p className="text-sm font-bold text-gray-900">{c.quotations.length}</p>
                                  <p className="text-[10px] text-gray-400">quotes</p>
                                </div>
                              )}
                              {spend > 0 && (
                                <div>
                                  <p className="text-sm font-bold text-emerald-700">₹{(spend / 1000).toFixed(0)}K</p>
                                  <p className="text-[10px] text-gray-400">spend</p>
                                </div>
                              )}
                            </div>

                            {/* Mobile */}
                            <div className="sm:hidden text-right flex-shrink-0">
                              <p className="text-sm font-bold text-gray-900">{totalActivity}</p>
                              <p className="text-[10px] text-gray-400">activities</p>
                            </div>

                            {isExpanded
                              ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            }
                          </div>

                          {/* Expanded */}
                          {isExpanded && (
                            <div className="border-t border-gray-100 bg-gray-50/40">
                              {/* Quick contact */}
                              <div className="px-4 pt-3 pb-2 flex flex-wrap gap-2">
                                <a
                                  href={`mailto:${c.email}`}
                                  className="flex items-center gap-1.5 text-xs font-semibold bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-xl hover:border-primary hover:text-primary transition-colors"
                                >
                                  <Mail className="w-3.5 h-3.5" />Email
                                </a>
                                {c.phone && (
                                  <>
                                    <a
                                      href={`tel:${c.phone}`}
                                      className="flex items-center gap-1.5 text-xs font-semibold bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-xl hover:border-primary hover:text-primary transition-colors"
                                    >
                                      <Phone className="w-3.5 h-3.5" />Call
                                    </a>
                                    <a
                                      href={`https://wa.me/${c.phone.replace(/\D/g, '')}`}
                                      target="_blank"
                                      className="flex items-center gap-1.5 text-xs font-semibold bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-xl hover:bg-green-100 transition-colors"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />WhatsApp
                                    </a>
                                  </>
                                )}
                              </div>

                              <div className="px-4 pb-4 space-y-3">
                                {/* Stats row */}
                                <div className="grid grid-cols-3 gap-2">
                                  <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                                    <p className="text-lg font-bold text-gray-900">{c.bookings.length}</p>
                                    <p className="text-[10px] text-gray-500">Bookings</p>
                                  </div>
                                  <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                                    <p className="text-lg font-bold text-gray-900">{confirmedCount}</p>
                                    <p className="text-[10px] text-gray-500">Confirmed</p>
                                  </div>
                                  <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                                    <p className="text-lg font-bold text-emerald-700">{spend > 0 ? `₹${(spend/1000).toFixed(0)}K` : '—'}</p>
                                    <p className="text-[10px] text-gray-500">Revenue</p>
                                  </div>
                                </div>

                                {/* Bookings list */}
                                {c.bookings.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Booking History</p>
                                    <div className="space-y-1.5">
                                      {c.bookings.map(b => {
                                        const s = BOOKING_STATUS[b.status] || BOOKING_STATUS.new
                                        const val = b.bookingValue || b.quotedPrice
                                        return (
                                          <div key={b.id} className="bg-white rounded-xl border border-gray-200 px-3 py-2.5 flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-xs font-semibold text-gray-900 truncate">{b.packageTitle}</p>
                                              {b.destination && <p className="text-[11px] text-gray-400">{b.destination}{b.groupSize ? ` · ${b.groupSize} pax` : ''}</p>}
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                              {val ? <p className="text-xs font-bold text-emerald-700">₹{Number(val).toLocaleString('en-IN')}</p> : null}
                                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${s.color}`}>{s.label}</span>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Quotations list */}
                                {c.quotations.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Quotation History</p>
                                    <div className="space-y-1.5">
                                      {c.quotations.map(q => (
                                        <div key={q.id} className="bg-white rounded-xl border border-gray-200 px-3 py-2.5 flex items-center gap-3">
                                          <div className="w-2 h-2 rounded-full flex-shrink-0 bg-purple-400" />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-gray-900 truncate">{q.packageTitle}</p>
                                            {q.destination && <p className="text-[11px] text-gray-400">{q.destination}</p>}
                                          </div>
                                          <div className="text-right flex-shrink-0">
                                            {q.quotedPrice ? <p className="text-xs font-bold text-purple-700">₹{Number(q.quotedPrice).toLocaleString('en-IN')}</p> : null}
                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 capitalize">{q.status}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════ STATS ════════════════════════════════ */}
            {tab === 'stats' && (
              <div className="space-y-5">
                {/* KPI row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Bookings',    value: bookings.length,       icon: BookOpen,     color: 'bg-blue-100 text-blue-600' },
                    { label: 'Confirmed Revenue', value: `₹${(totalRevenue/1000).toFixed(0)}K`, icon: IndianRupee, color: 'bg-green-100 text-green-600' },
                    { label: 'Planner Visits',    value: visits,                icon: Eye,          color: 'bg-purple-100 text-purple-600' },
                    { label: 'Conversion Rate',   value: `${convRate}%`,        icon: TrendingUp,   color: 'bg-amber-100 text-amber-600' },
                  ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color}`}>
                        <s.icon className="w-5 h-5" />
                      </div>
                      <div><p className="text-xl font-bold text-gray-900">{s.value}</p><p className="text-xs text-gray-500">{s.label}</p></div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Monthly bookings chart */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <h3 className="font-bold text-gray-900 mb-4">Monthly Bookings</h3>
                    <div className="flex items-end gap-3 h-32">
                      {last6.map(m => (
                        <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs font-bold text-gray-700">{m.count || ''}</span>
                          <div className="w-full bg-primary/20 rounded-t-lg relative" style={{ height: `${Math.max((m.count / maxMonthly) * 100, m.count > 0 ? 8 : 0)}%`, minHeight: m.count > 0 ? '8px' : '0' }}>
                            <div className="absolute inset-0 bg-primary rounded-t-lg" />
                          </div>
                          <span className="text-[10px] text-gray-400">{m.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Funnel */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <h3 className="font-bold text-gray-900 mb-4">Planner Funnel</h3>
                    <div className="space-y-3">
                      {[
                        { label: 'Planner Visits', value: visits, max: visits, color: 'bg-blue-500' },
                        { label: 'Itineraries Generated', value: itineraries, max: visits, color: 'bg-purple-500' },
                        { label: 'Bookings Submitted', value: bookingEvents, max: visits, color: 'bg-green-500' },
                      ].map(s => (
                        <div key={s.label}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600">{s.label}</span>
                            <span className="font-bold text-gray-900">{s.value}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className={`h-2 rounded-full ${s.color}`} style={{ width: s.max > 0 ? `${(s.value / s.max) * 100}%` : '0%' }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 text-center">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-lg font-bold text-gray-900">{bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length}</p>
                        <p className="text-xs text-gray-500">Confirmed Bookings</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-lg font-bold text-gray-900">{customers.length}</p>
                        <p className="text-xs text-gray-500">Unique Customers</p>
                      </div>
                    </div>
                  </div>

                  {/* Status breakdown */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <h3 className="font-bold text-gray-900 mb-4">Booking Status Breakdown</h3>
                    <div className="space-y-2">
                      {Object.entries(BOOKING_STATUS).map(([key, s]) => {
                        const count = bookings.filter(b => b.status === key).length
                        return (
                          <div key={key} className="flex items-center gap-3">
                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
                            <span className="text-sm text-gray-600 flex-1">{s.label}</span>
                            <span className="text-sm font-bold text-gray-900">{count}</span>
                            <div className="w-24 bg-gray-100 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${s.dot}`} style={{ width: bookings.length > 0 ? `${(count / bookings.length) * 100}%` : '0%' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Destinations */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <h3 className="font-bold text-gray-900 mb-4">Top Destinations</h3>
                    {(() => {
                      const destMap: Record<string, number> = {}
                      bookings.forEach(b => { destMap[b.destination] = (destMap[b.destination] || 0) + 1 })
                      const top = Object.entries(destMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
                      const max = top[0]?.[1] || 1
                      return top.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">No data yet</p>
                      ) : (
                        <div className="space-y-3">
                          {top.map(([dest, count]) => (
                            <div key={dest}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-700 font-medium flex items-center gap-1"><MapPin className="w-3 h-3 text-gray-400" />{dest}</span>
                                <span className="font-bold text-gray-900">{count} booking{count !== 1 ? 's' : ''}</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2">
                                <div className="h-2 rounded-full bg-primary" style={{ width: `${(count / max) * 100}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════ MY PROFILE ═══════════════════════════ */}
            {tab === 'profile' && (
              <div className="max-w-xl mx-auto space-y-6">
                <div>
                  <h2 className="font-bold text-gray-900 text-lg">My Profile</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Update your details and logo — visible on PDFs and quotations</p>
                </div>

                {/* Logo preview + URL input */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      {profileLogoUrl ? (
                        <img
                          src={profileLogoUrl}
                          alt="Logo preview"
                          className="w-16 h-16 rounded-xl object-contain border border-gray-200 bg-gray-50"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                          <ImageIcon className="w-7 h-7 text-primary/40" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{profileName || subAgentName || 'Travel Agent'}</p>
                      <p className="text-xs text-gray-400">{currentUser?.email}</p>
                      <span className="mt-1 inline-block bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">Travel Agent</span>
                    </div>
                  </div>

                  <LogoUploader
                    value={profileLogoUrl}
                    onChange={url => { setProfileLogoUrl(url); setProfileLogoInput(url) }}
                  />
                </div>

                {/* Name & Phone */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
                  <p className="font-semibold text-gray-800 text-sm">Contact Details</p>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Display Name</label>
                      <input
                        type="text"
                        value={profileName}
                        onChange={e => setProfileName(e.target.value)}
                        placeholder={subAgentName || 'Your name'}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Phone Number</label>
                      <input
                        type="tel"
                        value={profilePhone}
                        onChange={e => setProfilePhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                      />
                    </div>
                  </div>
                </div>

                {/* Save */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm shadow-primary/20"
                  >
                    {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Save Profile
                  </button>
                  {profileSaved && (
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
                      <CheckCircle className="w-4 h-4" />Saved!
                    </span>
                  )}
                  {profileError && (
                    <span className="text-sm text-red-500">{profileError}</span>
                  )}
                </div>

                {/* Sign out */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Sign Out</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {confirmSignOut ? 'Are you sure you want to sign out?' : "You'll be redirected to the login page"}
                    </p>
                  </div>
                  {confirmSignOut ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => logout().then(() => router.push('/agent-login'))}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 font-semibold text-sm transition-colors"
                      >
                        <LogOut className="w-4 h-4" />Yes, Sign Out
                      </button>
                      <button
                        onClick={() => setConfirmSignOut(false)}
                        className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmSignOut(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-700 font-semibold text-sm transition-colors flex-shrink-0"
                    >
                      <LogOut className="w-4 h-4" />Sign Out
                    </button>
                  )}
                </div>

              </div>
            )}

            {/* ══════════════════════ AI ASSISTANT ══════════════════════════ */}
            {tab === 'ai' && (
              <div className="flex flex-col items-center justify-center px-4 py-16" style={{ minHeight: 'calc(100vh - 260px)' }}>
                <div className="w-full max-w-xl">

                  {/* Hero card */}
                  <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-8 text-center shadow-2xl mb-6">
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
                      <div className="absolute -bottom-14 -left-10 w-64 h-64 rounded-full bg-white/5" />
                    </div>

                    <div className="inline-flex items-center gap-1.5 bg-amber-400 text-amber-900 text-[11px] font-bold px-3 py-1 rounded-full mb-5 shadow-sm tracking-wide uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-900/60 animate-pulse" />
                      Coming Soon
                    </div>

                    <div className="relative inline-flex mb-5">
                      <div className="w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-lg border border-white/20">
                        <Bot className="w-10 h-10 text-white" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-400 border-2 border-white flex items-center justify-center">
                        <span className="text-[10px]">✦</span>
                      </div>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-2 relative">AI Package Assistant</h2>
                    <p className="text-purple-200 text-sm leading-relaxed relative max-w-sm mx-auto">
                      Ask anything about your packages — pricing, itinerary, inclusions, and more. Get instant AI answers to help you close deals faster.
                    </p>
                  </div>

                  {/* Feature grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                    {[
                      { icon: '🧠', label: 'Package Q&A', desc: 'Ask anything about any package' },
                      { icon: '📋', label: 'Itinerary Explainer', desc: 'Day-by-day breakdown on demand' },
                      { icon: '💰', label: 'Pricing Insights', desc: 'Understand costs & margins' },
                      { icon: '✅', label: 'Inclusions Checker', desc: "What's in, what's not" },
                      { icon: '🌐', label: 'Multi-language', desc: "Reply in client's language" },
                      { icon: '💬', label: 'Voice Chat', desc: 'Talk instead of type' },
                    ].map(f => (
                      <div key={f.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col gap-1.5 opacity-60">
                        <span className="text-xl">{f.icon}</span>
                        <p className="text-xs font-semibold text-gray-700">{f.label}</p>
                        <p className="text-[11px] text-gray-400 leading-snug">{f.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* Bottom notice */}
                  <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-base">🚧</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-900">Under Development</p>
                      <p className="text-xs text-amber-600 mt-0.5">This feature is being built. We&apos;ll notify you when it&apos;s ready.</p>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* ══════════════════════ ACTIVITY ══════════════════════════════ */}
            {tab === 'activity' && (
              <div className="space-y-4">
                {sessions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {['all', 'visit', 'itinerary_generated', 'booking_submitted'].map(a => {
                      const labels: Record<string, string> = { all: 'All', visit: 'Visits', itinerary_generated: 'Itineraries', booking_submitted: 'Bookings' }
                      const count = a === 'all' ? sessions.length : sessions.filter(s => s.action === a).length
                      return (
                        <button key={a} onClick={() => setActFilter(a)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${actFilter === a ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                          {labels[a]} ({count})
                        </button>
                      )
                    })}
                  </div>
                )}
                {(() => {
                  const filteredSessions = sessions.filter(s => actFilter === 'all' || s.action === actFilter)
                  return sessions.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                    <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No activity recorded yet.</p>
                  </div>
                ) : (
                  <>
                  <p className="text-sm text-gray-500">{filteredSessions.length} event{filteredSessions.length !== 1 ? 's' : ''}{actFilter !== 'all' ? ' (filtered)' : ''}</p>
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-50">
                    {filteredSessions.map(ev => {
                      const colors: Record<string, string> = {
                        visit: 'bg-blue-50 text-blue-700',
                        itinerary_generated: 'bg-purple-50 text-purple-700',
                        booking_submitted: 'bg-green-50 text-green-700',
                      }
                      const labels: Record<string, string> = {
                        visit: 'Visit',
                        itinerary_generated: 'Itinerary',
                        booking_submitted: 'Booking',
                      }
                      return (
                        <div key={ev.id} className="flex items-center gap-3 px-5 py-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${colors[ev.action] || 'bg-gray-100 text-gray-600'}`}>
                            {labels[ev.action] || ev.action}
                          </span>
                          <div className="flex-1 min-w-0">
                            {ev.destination && <p className="text-xs text-gray-600 flex items-center gap-1"><MapPin className="w-3 h-3" />{ev.destination}</p>}
                            {ev.packageTitle && <p className="text-xs text-gray-400 flex items-center gap-1"><Package className="w-3 h-3" />{ev.packageTitle}</p>}
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0">{fmtDT(ev.timestamp)}</span>
                        </div>
                      )
                    })}
                  </div>
                  </>
                )
                })()}
              </div>
            )}

          </motion.div>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 flex md:hidden">
        {TABS.slice(0, 5).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors relative ${tab === t.id ? 'text-primary' : 'text-gray-500'}`}>
            <t.icon className="w-5 h-5" />
            {t.label}
            {t.badge ? (
              <span className="absolute top-1 right-1/4 bg-red-500 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">{t.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Package Detail View Modal ─────────────────────────────────────────── */}
      {viewPkgDetail && (() => {
        const pkg = viewPkgDetail
        const sym = getCurrencySymbol(pkg.currency)
        const days: { title: string; desc: string }[] = []
        if (pkg.dayWiseItinerary) {
          let cur: { title: string; desc: string } | null = null
          for (const line of pkg.dayWiseItinerary.split('\n').filter(Boolean)) {
            if (/^day\s*\d+/i.test(line)) {
              if (cur) days.push(cur)
              cur = { title: line.trim(), desc: '' }
            } else if (cur) {
              cur.desc += (cur.desc ? '\n' : '') + line.trim()
            }
          }
          if (cur) days.push(cur)
        }
        return (
          <div className="fixed inset-0 z-[70] bg-black/60 flex items-start justify-center overflow-y-auto py-6 px-4" onClick={() => setViewPkgDetail(null)}>
            <div className="relative w-full max-w-2xl bg-gray-50 rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-500" />
                  <span className="font-bold text-gray-900 text-sm">Package Preview</span>
                </div>
                <button onClick={() => setViewPkgDetail(null)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">

                {/* ── Cover Image ── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                    <span className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center text-sm">🖼️</span>
                    <p className="text-sm font-bold text-gray-800">Cover Image</p>
                  </div>
                  {pkg.primaryImageUrl ? (
                    <div className="h-52 w-full overflow-hidden">
                      <img src={pkg.primaryImageUrl} alt={pkg.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-32 bg-gradient-to-br from-purple-100 to-indigo-100 flex flex-col items-center justify-center gap-2">
                      <Package className="w-8 h-8 text-purple-300" />
                      <p className="text-sm text-gray-400">No cover image uploaded</p>
                    </div>
                  )}
                </div>

                {/* ── Basic Info ── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                    <span className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-sm">📍</span>
                    <p className="text-sm font-bold text-gray-800">Basic Info</p>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Package Title</p>
                      <p className="text-base font-bold text-gray-900">{pkg.title || '—'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Destination</p>
                        <p className="text-sm text-gray-700">{pkg.destination || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Country</p>
                        <p className="text-sm text-gray-700">{pkg.destinationCountry || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Duration</p>
                        <p className="text-sm text-gray-700">{pkg.durationNights ? `${pkg.durationNights}N / ${pkg.durationDays}D` : `${pkg.durationDays}D`}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Group Size</p>
                        <p className="text-sm text-gray-700">{pkg.minGroupSize || 1}–{pkg.maxGroupSize || 20} pax</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Season</p>
                        <p className="text-sm text-gray-700">{pkg.seasonalAvailability || 'Year Round'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Star Category</p>
                        <p className="text-sm text-gray-700">{pkg.starCategory || '—'}</p>
                      </div>
                    </div>
                    {(pkg.travelType || pkg.theme || pkg.mood) && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {pkg.travelType && <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-3 py-1 rounded-full">{pkg.travelType}</span>}
                        {pkg.theme && <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">{pkg.theme}</span>}
                        {pkg.mood && <span className="bg-pink-100 text-pink-700 text-xs font-semibold px-3 py-1 rounded-full">{pkg.mood}</span>}
                      </div>
                    )}
                    {pkg.overview && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Overview</p>
                        <p className="text-sm text-gray-600 leading-relaxed">{pkg.overview}</p>
                      </div>
                    )}
                    {Array.isArray(pkg.highlights) && pkg.highlights.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Highlights</p>
                        <ul className="space-y-1">
                          {pkg.highlights.map((h, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                              <span className="text-primary mt-0.5 flex-shrink-0 font-bold">✦</span>{h}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Pricing ── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                    <span className="w-7 h-7 rounded-lg bg-yellow-50 flex items-center justify-center text-sm">💰</span>
                    <p className="text-sm font-bold text-gray-800">Pricing Configuration</p>
                  </div>
                  <div className="p-5 flex flex-wrap gap-6 items-start">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{pkg.totalPrice ? 'Total Price' : 'Price Per Person'}</p>
                      <p className="text-2xl font-bold text-purple-700">{sym}{(pkg.totalPrice || pkg.pricePerPerson || 0).toLocaleString('en-IN')}</p>
                      <p className="text-xs text-purple-500 mt-0.5">{pkg.gst ? `+ ${pkg.gst}% GST` : ''}</p>
                    </div>
                    <div className="flex gap-6">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Currency</p>
                        <p className="text-sm font-bold text-gray-700">{pkg.currency || 'INR'}</p>
                      </div>
                      {pkg.gst ? (
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">GST</p>
                          <p className="text-sm font-bold text-gray-700">{pkg.gst}%</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* ── Master Itinerary ── */}
                {days.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                      <span className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-sm">🗺️</span>
                      <p className="text-sm font-bold text-gray-800">Master Itinerary</p>
                    </div>
                    <div className="p-5 space-y-4">
                      {days.map((d, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary mt-0.5">{i + 1}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900">{d.title.replace(/^day\s*\d+[\s:·–\-]*/i, '').trim() || d.title}</p>
                            {d.desc && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{d.desc}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Hotels ── */}
                {Array.isArray(pkg.hotels) && pkg.hotels.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                      <span className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center text-sm">🏨</span>
                      <p className="text-sm font-bold text-gray-800">Hotels & Accommodation</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            {['Destination', 'Nights', 'Hotel(s)', 'Meal Plan', 'Room Type'].map(h => (
                              <th key={h} className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 py-2.5">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {pkg.hotels.map((h, i) => (
                            <tr key={i} className="hover:bg-gray-50/50">
                              <td className="px-4 py-3 font-semibold text-gray-800 text-xs">{h.destination}</td>
                              <td className="px-4 py-3 text-gray-600 text-xs">{h.nights}</td>
                              <td className="px-4 py-3 text-gray-600 text-xs">{h.hotels}</td>
                              <td className="px-4 py-3 text-gray-600 text-xs">{h.mealPlan}</td>
                              <td className="px-4 py-3 text-gray-600 text-xs">{h.roomType || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── Vehicles ── */}
                {Array.isArray(pkg.vehicles) && pkg.vehicles.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                      <span className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center text-sm">🚗</span>
                      <p className="text-sm font-bold text-gray-800">Vehicles & Transfers</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 py-2.5">Vehicle Type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {pkg.vehicles.map((v, i) => (
                            <tr key={i} className="hover:bg-gray-50/50">
                              <td className="px-4 py-3 font-semibold text-gray-800 text-xs">{v.vehicleType}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── Inclusions & Exclusions ── */}
                {((pkg.inclusions && pkg.inclusions.length > 0) || (pkg.exclusions && pkg.exclusions.length > 0)) && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                      <span className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center text-sm">📝</span>
                      <p className="text-sm font-bold text-gray-800">Inclusions & Exclusions</p>
                    </div>
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {pkg.inclusions && pkg.inclusions.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-green-600 mb-2 flex items-center gap-1">✓ Inclusions</p>
                          <ul className="space-y-1.5">
                            {pkg.inclusions.map((inc, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                                <span className="text-green-500 flex-shrink-0 mt-0.5">•</span>{inc}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {pkg.exclusions && pkg.exclusions.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-red-500 mb-2 flex items-center gap-1">✗ Exclusions</p>
                          <ul className="space-y-1.5">
                            {pkg.exclusions.map((exc, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                                <span className="text-red-400 flex-shrink-0 mt-0.5">•</span>{exc}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Payment & Cancellation ── */}
                {(pkg.paymentPolicy || pkg.cancellationPolicy) && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                      <span className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-sm">📋</span>
                      <p className="text-sm font-bold text-gray-800">Payment & Cancellation Policy</p>
                    </div>
                    <div className="p-5 space-y-4">
                      {pkg.paymentPolicy && (
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Payment Policy</p>
                          <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{pkg.paymentPolicy}</p>
                        </div>
                      )}
                      {pkg.cancellationPolicy && (
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Cancellation Policy</p>
                          <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{pkg.cancellationPolicy}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* Footer actions */}
              <div className="px-5 py-4 border-t border-gray-100 bg-white flex gap-3">
                <button
                  onClick={() => { setMarkupPkg(pkg); setMarkupPct(0); setMarkupAction('whatsapp'); setViewPkgDetail(null) }}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white font-semibold text-sm py-2.5 rounded-xl hover:bg-green-600 transition-colors"
                >
                  <Share2 className="w-4 h-4" />Send on WhatsApp
                </button>
                <button
                  onClick={() => { setMarkupPkg(pkg); setMarkupPct(0); setMarkupAction('pdf'); setViewPkgDetail(null) }}
                  className="flex items-center justify-center gap-2 bg-primary text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-colors"
                >
                  <FileText className="w-4 h-4" />Download Quote
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Package View — DMC-style full-screen, sidebar-aware ─────────────── */}
      {viewPkgQuot && (
        <div className="fixed left-0 md:left-60 right-0 top-0 bottom-0 z-[70] flex flex-col bg-[#f4f5f9]">

          {/* Top bar */}
          <div className="flex items-center justify-between bg-white border-b border-gray-100 px-4 py-2.5 flex-shrink-0 shadow-sm">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setViewPkgQuot(null)}
                className="flex items-center gap-1.5 text-gray-500 hover:text-purple-700 hover:bg-purple-50 px-2.5 py-1.5 rounded-lg transition-colors text-sm font-semibold"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Back
              </button>
              <div className="h-4 w-px bg-gray-200" />
              <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Package View</span>
              <p className="text-sm font-semibold text-gray-700 truncate max-w-xs hidden sm:block">
                {customForm.title || viewPkgQuot.packageTitle}
              </p>
            </div>
            <button
              onClick={() => setViewPkgQuot(null)}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {loadingPkg ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex flex-1 overflow-hidden">

              {/* Left: scrollable package details */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 min-w-0">

                {/* Package title card with gradient header */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-600 to-indigo-500 px-5 pt-4 pb-3">
                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Package Title</p>
                    <p className="text-xl font-bold text-white leading-tight">{customForm.title || viewPkgQuot.packageTitle}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 px-5 py-3">
                    <span className="flex items-center gap-1 bg-gray-100 text-gray-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                      <Clock className="w-3 h-3" />{customForm.durationDays || '?'}D / {customForm.durationNights || '?'}N
                    </span>
                    {customForm.starCategory && (
                      <span className="flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                        <Star className="w-3 h-3" />{customForm.starCategory}
                      </span>
                    )}
                    {customForm.travelType && (
                      <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">{customForm.travelType}</span>
                    )}
                  </div>
                </div>

                {/* Customer context */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                    <span className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-sm">👤</span>
                    <p className="text-sm font-bold text-gray-800">Customer Details</p>
                  </div>
                  <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Customer', value: viewPkgQuot.customerName },
                      { label: 'Travellers', value: viewPkgQuot.groupSize ? `${viewPkgQuot.groupSize} pax` : `${viewPkgQuot.adults ?? 1}A${viewPkgQuot.kids ? ` ${viewPkgQuot.kids}K` : ''}` },
                      { label: 'Travel Dates', value: viewPkgQuot.preferredDates || 'Not set' },
                      { label: 'Status', value: QUOT_STATUS[viewPkgQuot.status]?.label || viewPkgQuot.status },
                    ].map(item => (
                      <div key={item.label} className="bg-gray-50 rounded-xl px-3 py-2.5 text-center">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">{item.label}</p>
                        <p className="text-xs font-semibold text-gray-800 mt-0.5 truncate">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Price — only editable field */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                    <span className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-sm">💰</span>
                    <p className="text-sm font-bold text-gray-800">Your Quoted Price</p>
                    <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full ml-auto">Editable</span>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="text-xs font-semibold text-gray-500 block mb-1.5">Price per Person (₹)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">₹</span>
                          <input
                            type="number"
                            value={customForm.pricePerPerson ?? ''}
                            onChange={e => setCustomForm(p => ({ ...p, pricePerPerson: Number(e.target.value) }))}
                            placeholder="Enter your price"
                            className="w-full pl-7 pr-4 py-2.5 border-2 border-purple-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                          />
                        </div>
                      </div>
                      {customForm.pricePerPerson && (() => {
                        const gSize = viewPkgQuot.groupSize || viewPkgQuot.adults || 1
                        return (
                          <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 text-center flex-shrink-0">
                            <p className="text-[10px] text-purple-400 font-semibold uppercase">Total ({gSize} pax)</p>
                            <p className="text-lg font-bold text-purple-700">₹{(Number(customForm.pricePerPerson) * gSize).toLocaleString('en-IN')}</p>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </div>

                {/* Overview — read only */}
                {customForm.overview && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                      <span className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center text-sm">📝</span>
                      <p className="text-sm font-bold text-gray-800">Overview</p>
                    </div>
                    <div className="p-5">
                      <p className="text-sm text-gray-700 leading-relaxed">{customForm.overview}</p>
                    </div>
                  </div>
                )}

                {/* Highlights — read only */}
                {Array.isArray(customForm.highlights) && customForm.highlights.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                      <span className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-sm">✨</span>
                      <p className="text-sm font-bold text-gray-800">Highlights</p>
                    </div>
                    <div className="p-5">
                      <ul className="space-y-1.5">{customForm.highlights.map((h, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="text-primary mt-0.5">✦</span>{h}</li>
                      ))}</ul>
                    </div>
                  </div>
                )}

                {/* Inclusions & Exclusions — read only */}
                {((Array.isArray(customForm.inclusions) && customForm.inclusions.length > 0) || (Array.isArray(customForm.exclusions) && customForm.exclusions.length > 0)) && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                      <span className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center text-sm">✅</span>
                      <p className="text-sm font-bold text-gray-800">Inclusions & Exclusions</p>
                    </div>
                    <div className="p-5 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-bold text-green-700 mb-2">✓ Inclusions</p>
                        {Array.isArray(customForm.inclusions) && customForm.inclusions.length > 0
                          ? <ul className="space-y-1">{customForm.inclusions.map((inc, i) => (
                              <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5"><CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />{inc}</li>
                            ))}</ul>
                          : <p className="text-xs text-gray-400 italic">None</p>}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-red-600 mb-2">✗ Exclusions</p>
                        {Array.isArray(customForm.exclusions) && customForm.exclusions.length > 0
                          ? <ul className="space-y-1">{customForm.exclusions.map((exc, i) => (
                              <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5"><XCircle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />{exc}</li>
                            ))}</ul>
                          : <p className="text-xs text-gray-400 italic">None</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Day-wise itinerary — read only */}
                {customForm.dayWiseItinerary && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                      <span className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-sm">🗺️</span>
                      <p className="text-sm font-bold text-gray-800">Day-Wise Itinerary</p>
                    </div>
                    <div className="p-5 space-y-2">
                      {customForm.dayWiseItinerary.split('\n').filter(Boolean).map((line, i) =>
                        /^day\s*\d+/i.test(line) ? (
                          <div key={i} className="flex items-center gap-2 mt-4 first:mt-0">
                            <span className="w-6 h-6 bg-purple-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                              {(line.match(/\d+/) || ['?'])[0]}
                            </span>
                            <p className="text-sm font-bold text-gray-900">{line}</p>
                          </div>
                        ) : (
                          <p key={i} className="text-sm text-gray-600 pl-8 border-l-2 border-purple-100 ml-3 leading-relaxed">{line}</p>
                        )
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* Right: Live Preview */}
              <div className="w-72 flex-shrink-0 bg-white border-l border-gray-100 flex flex-col overflow-y-auto hidden md:flex">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-700">Live Preview</span>
                  <span className="text-[10px] text-gray-400">As DMC sees it</span>
                </div>
                <div className="p-4">
                  <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100">
                    <div className="relative h-40">
                      {customForm.primaryImageUrl ? (
                        <img src={customForm.primaryImageUrl} alt={customForm.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-200 to-indigo-300 flex items-center justify-center">
                          <Package className="w-12 h-12 text-white/50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                      <div className="absolute top-2 left-2">
                        <span className="bg-white text-[10px] font-bold px-2 py-0.5 rounded-full text-gray-800 shadow">Journaies</span>
                      </div>
                      <div className="absolute bottom-2 left-3 right-3">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-white/60 mb-0.5">Personalized Itinerary</p>
                        <p className="text-white font-bold text-sm leading-snug line-clamp-2">{customForm.title || 'Your Package Title'}</p>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-[10px] font-bold text-gray-900 mb-2">Trip Overview</p>
                      <div className="grid grid-cols-3 gap-1.5 mb-3">
                        {[
                          { emoji: '🏨', label: 'Stay', val: customForm.starCategory || '–' },
                          { emoji: '✈️', label: 'Type', val: customForm.travelType || '–' },
                          { emoji: '🌙', label: 'Nights', val: String(customForm.durationNights || '–') },
                        ].map(({ emoji, label, val }) => (
                          <div key={label} className="text-center">
                            <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center mx-auto mb-0.5 text-sm">{emoji}</div>
                            <p className="text-[8px] font-bold text-gray-400 uppercase">{label}</p>
                            <p className="text-[9px] font-bold text-gray-700">{val}</p>
                          </div>
                        ))}
                      </div>
                      <div className="bg-purple-50 border border-purple-100 rounded-xl p-2.5 text-center mb-3">
                        <p className="text-[9px] text-purple-400 font-semibold uppercase">Your Price</p>
                        <p className="text-lg font-bold text-purple-700">
                          {customForm.pricePerPerson ? `₹${Number(customForm.pricePerPerson).toLocaleString('en-IN')}` : '—'}
                        </p>
                        <p className="text-[9px] text-purple-400">per person</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-2">
                        <p className="text-[9px] font-bold text-blue-600 mb-1">For Customer</p>
                        <p className="text-[10px] font-semibold text-blue-800">{viewPkgQuot.customerName}</p>
                        <p className="text-[9px] text-blue-500">{viewPkgQuot.destination} · {viewPkgQuot.preferredDates || 'Dates TBD'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom action bar */}
          {!loadingPkg && (
            <div className="flex items-center justify-between gap-2 px-4 md:px-6 py-3.5 bg-white border-t border-gray-100 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] flex-shrink-0 flex-wrap">
              <div className="flex items-center gap-2">
                {customSaved && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                    <CheckCircle className="w-3.5 h-3.5" />Saved
                  </span>
                )}
                <button
                  onClick={() => saveCustomPackage(false)}
                  disabled={savingCustom || sharingCustom}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {savingCustom ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                  Save Itinerary
                </button>
                <button
                  onClick={() => { if (viewPkgQuot) openPdfForQuotation(viewPkgQuot, viewPkgData); setViewPkgQuot(null) }}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <FileText className="w-4 h-4" />Send PDF
                </button>
                <button
                  onClick={() => {
                    shareQuotationWhatsApp(viewPkgQuot)
                  }}
                  className="flex items-center gap-2 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 px-4 py-2.5 rounded-xl transition-colors shadow-sm shadow-green-200"
                >
                  <Share2 className="w-4 h-4" />Share on WhatsApp
                </button>
              </div>
              <button
                onClick={() => saveCustomPackage(true)}
                disabled={savingCustom || sharingCustom}
                className="flex items-center gap-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 shadow-sm shadow-primary/30"
              >
                {sharingCustom ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Share to DMC
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Quotation PDF Modal ──────────────────────────────────────────────── */}
      {pdfQuot && (() => {
        const pkg = pdfQuot.customPackageData || pdfQuot.selectedPackage
        const groupSize = pdfQuot.groupSize || 1
        const isTotalPdfQuot = Boolean(pkg?.totalPrice)
        const basePdfPrice = pkg?.totalPrice || pkg?.pricePerPerson
        const pricePerPerson = isTotalPdfQuot ? undefined
          : (basePdfPrice || (pdfQuot.quotedPrice ? Math.round(Number(pdfQuot.quotedPrice) / groupSize) : null))
        const quotedPriceTotal = pdfQuot.quotedPrice
          ? Number(pdfQuot.quotedPrice)
          : isTotalPdfQuot ? (basePdfPrice ?? null)
          : pricePerPerson && groupSize > 1 ? pricePerPerson * groupSize : null
        return (
          <PackagePdfModal
            title={pdfQuot.packageTitle}
            destination={pdfQuot.destination}
            destinationCountry={pkg?.destinationCountry}
            durationDays={pkg?.durationDays}
            durationNights={pkg?.durationNights}
            starCategory={pkg?.starCategory}
            travelType={pkg?.travelType}
            theme={pkg?.theme}
            mood={pkg?.mood}
            currency={pkg?.currency}
            pricePerPerson={pricePerPerson}
            totalPrice={isTotalPdfQuot ? (pkg?.totalPrice ?? undefined) : undefined}
            gst={pkg?.gst ?? undefined}
            quotedPriceTotal={quotedPriceTotal}
            groupSize={groupSize}
            adults={pdfQuot.adults}
            kids={pdfQuot.kids}
            overview={pkg?.overview}
            inclusions={Array.isArray(pkg?.inclusions) ? pkg!.inclusions.filter(Boolean) : []}
            exclusions={Array.isArray(pkg?.exclusions) ? pkg!.exclusions.filter(Boolean) : []}
            highlights={Array.isArray(pkg?.highlights) ? pkg!.highlights.filter(Boolean) : []}
            dayWiseItinerary={pkg?.dayWiseItinerary}
            customerName={pdfQuot.customerName}
            customerEmail={pdfQuot.customerEmail}
            customerPhone={pdfQuot.customerPhone}
            preferredDates={pdfQuot.preferredDates}
            refId={pdfQuot.publicId || pdfQuot.id.slice(-8).toUpperCase()}
            specialRequests={pdfQuot.specialRequests}
            brandName={subAgentName || 'Travel Agent'}
            onClose={() => setPdfQuot(null)}
            onWhatsApp={() => shareQuotationWhatsApp(pdfQuot)}
            onPrint={() => openQuotPrintWindow(pdfQuot)}
          />
        )
      })()}

      {/* ── Markup Popup ─────────────────────────────────────────────────────── */}
      {markupPkg && (() => {
        const base = markupPkg.totalPrice || markupPkg.pricePerPerson
        const isTotalMarkup = Boolean(markupPkg.totalPrice)
        const currMarkup = getCurrencySymbol(markupPkg.currency)
        const markupAmt = Math.round(base * markupPct / 100)
        const finalPrice = base + markupAmt
        function proceed() {
          if (markupAction === 'whatsapp') {
            const msg = buildPackageWhatsAppMessage(markupPkg!, finalPrice)
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
          } else {
            openPkgPrintWindow(markupPkg!, finalPrice)
          }
          setMarkupPkg(null)
        }
        return (
          <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4" onClick={() => setMarkupPkg(null)}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <p className="font-bold text-gray-900 text-sm">Set Your Price</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">{markupPkg.title}</p>
                </div>
                <button onClick={() => setMarkupPkg(null)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Base price display */}
                <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Base (DMC) price</span>
                  <span className="font-bold text-gray-700">{currMarkup}{base.toLocaleString('en-IN')}{isTotalMarkup ? ' total' : '/person'}{markupPkg.gst ? ` + ${markupPkg.gst}% GST` : ''}</span>
                </div>

                {/* Quick markup pills */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">Add your markup (%)</p>
                  <div className="flex gap-2 flex-wrap mb-3">
                    {[0, 5, 10, 15, 20].map(p => (
                      <button key={p} onClick={() => setMarkupPct(p)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${markupPct === p ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {p === 0 ? 'No markup' : `+${p}%`}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={0} max={200} value={markupPct}
                      onChange={e => setMarkupPct(Math.max(0, Number(e.target.value)))}
                      className="w-24 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-center font-bold"
                    />
                    <span className="text-sm text-gray-500">% markup</span>
                  </div>
                </div>

                {/* Price breakdown */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Base price</span><span>{currMarkup}{base.toLocaleString('en-IN')}</span>
                  </div>
                  {markupAmt > 0 && (
                    <div className="flex justify-between text-xs text-green-600">
                      <span>Your markup (+{markupPct}%)</span><span>+{currMarkup}{markupAmt.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-primary border-t border-primary/20 pt-1 mt-1">
                    <span>Customer pays</span><span>{currMarkup}{finalPrice.toLocaleString('en-IN')}{isTotalMarkup ? ' total' : '/person'}</span>
                  </div>
                  {markupAmt > 0 && (
                    <p className="text-[11px] text-gray-400">Your profit: {currMarkup}{markupAmt.toLocaleString('en-IN')}{isTotalMarkup ? ' total' : ' per person'}</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-1 gap-2 pt-1">
                  <button
                    onClick={proceed}
                    className={`w-full flex items-center justify-center gap-2 font-semibold text-sm py-3 rounded-xl transition-colors ${
                      markupAction === 'whatsapp'
                        ? 'bg-green-500 hover:bg-green-600 text-white'
                        : 'bg-primary hover:bg-primary/90 text-white'
                    }`}
                  >
                    {markupAction === 'whatsapp'
                      ? <><Share2 className="w-4 h-4" />Send on WhatsApp</>
                      : <><FileText className="w-4 h-4" />Generate Quote PDF</>
                    }
                  </button>
                  <button
                    onClick={() => {
                      const altAction: 'whatsapp' | 'pdf' = markupAction === 'whatsapp' ? 'pdf' : 'whatsapp'
                      setMarkupAction(altAction)
                    }}
                    className="w-full flex items-center justify-center gap-2 font-semibold text-sm py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {markupAction === 'whatsapp'
                      ? <><FileText className="w-4 h-4" />Switch to: Download Quote PDF</>
                      : <><Share2 className="w-4 h-4" />Switch to: Send on WhatsApp</>
                    }
                  </button>
                  <button
                    disabled={wordDownloading}
                    onClick={async () => {
                      const pkg = markupPkg!
                      const isTotalWord = Boolean(pkg.totalPrice)
                      setWordDownloading(true)
                      try {
                        await downloadPackageWord({
                          title: pkg.title,
                          destination: pkg.destination,
                          destinationCountry: pkg.destinationCountry,
                          durationDays: pkg.durationDays,
                          durationNights: pkg.durationNights,
                          starCategory: pkg.starCategory,
                          currency: pkg.currency,
                          pricePerPerson: isTotalWord ? null : finalPrice,
                          totalPrice: isTotalWord ? finalPrice : null,
                          gst: pkg.gst ?? null,
                          overview: pkg.overview,
                          inclusions: Array.isArray(pkg.inclusions) ? pkg.inclusions : [],
                          exclusions: Array.isArray(pkg.exclusions) ? pkg.exclusions : [],
                          dayWiseItinerary: pkg.dayWiseItinerary,
                          hotels: Array.isArray(pkg.hotels) && pkg.hotels.length > 0 ? pkg.hotels : undefined,
                          vehicles: Array.isArray(pkg.vehicles) && pkg.vehicles.length > 0 ? pkg.vehicles : undefined,
                          paymentPolicy: pkg.paymentPolicy || undefined,
                          cancellationPolicy: pkg.cancellationPolicy || undefined,
                          brandName: subAgentName || 'Travel Agent',
                          agentLogoUrl: profileLogoUrl || undefined,
                        })
                        setMarkupPkg(null)
                      } finally {
                        setWordDownloading(false)
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 font-semibold text-sm py-2.5 rounded-xl border-2 border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-60"
                  >
                    {wordDownloading
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
                      : <><FileDown className="w-4 h-4" />Download as Word</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}

// ── PkgSection: reusable collapsible section with pencil edit ─────────────────
function PkgSection({
  title, isEditing, onEdit, view, edit,
}: {
  title: string
  isEditing: boolean
  onEdit: () => void
  view: React.ReactNode
  edit: React.ReactNode
}) {
  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <p className="text-sm font-bold text-gray-800">{title}</p>
        <button
          onClick={onEdit}
          className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
            isEditing
              ? 'bg-primary text-white'
              : 'text-gray-500 hover:text-primary hover:bg-primary/10 border border-gray-200'
          }`}
        >
          {isEditing ? (
            <><span className="text-xs">✓</span> Done</>
          ) : (
            <><span className="text-xs">✏️</span> Edit</>
          )}
        </button>
      </div>
      <div className="px-4 py-4">
        {isEditing ? edit : view}
      </div>
    </div>
  )
}
