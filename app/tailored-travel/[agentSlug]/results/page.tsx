'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Loader2, ArrowLeft, X, Send, User, Calendar,
  Users, Star, Clock, CheckCircle, MapPin, Package,
  FileText, ChevronDown, ChevronLeft, ChevronRight,
  Hotel, Car, CreditCard, Ban, Copy, Check, FileDown,
} from 'lucide-react'
import { openPackagePdfWindow } from '@/lib/generatePackagePdf'
import { downloadPackageWord } from '@/lib/generatePackageWord'
import { getCurrencySymbol } from '@/lib/utils/currency'


interface MatchedPackage {
  id: string
  Destination_Name: string
  Destination_Country?: string
  Duration_Nights: number
  Duration_Days: number
  Price_Min_INR: number
  Travel_Type: string
  Star_Category?: string
  Primary_Image_URL: string
  Currency?: string
  totalPrice?: number | null
  gst?: number | null
  matchScore: number
  matchReason: string
  Overview?: string
  Day_Wise_Itinerary?: string
  Inclusions?: string | string[]
  Exclusions?: string | string[]
  Highlights?: string[]
  Hotels?: any[]
  Vehicles?: any[]
  PaymentPolicy?: string
  CancellationPolicy?: string
  agentPackageTitle?: string
  agentSlug?: string
  source?: string
}

interface AgentInfo {
  id: string
  agentSlug: string
  companyName: string
  contactName: string
  logoUrl?: string | null
  status: string
}

interface DayBlock {
  number: number
  title: string
  lines: string[]
}

const cinematicTexts = [
  'Analyzing your preferences…',
  'Searching curated packages…',
  'Finding perfect experiences…',
  'Crafting your itinerary…',
]

function parseDays(itinerary: string): DayBlock[] {
  const rawLines = String(itinerary).split('\n').filter(l => l.trim())
  const days: DayBlock[] = []
  let current: DayBlock | null = null
  for (const line of rawLines) {
    if (/^day\s*\d+/i.test(line)) {
      if (current) days.push(current)
      const num = parseInt(line.match(/\d+/)?.[0] || '0')
      current = { number: num, title: line.trim(), lines: [] }
    } else if (current && line.trim()) {
      current.lines.push(line.trim())
    }
  }
  if (current) days.push(current)
  return days
}

function TravelGuide() {
  return (
    <svg width="60" height="74" viewBox="0 0 60 76" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="30" cy="11" rx="22" ry="5" fill="#6d28d9" opacity="0.35"/>
      <rect x="15" y="4" width="30" height="11" rx="6" fill="#7c3aed"/>
      <rect x="12" y="11" width="36" height="4" rx="2" fill="#5b21b6"/>
      <rect x="24" y="40" width="12" height="8" rx="3" fill="#fbbf24"/>
      <circle cx="30" cy="28" r="17" fill="#fde68a"/>
      <ellipse cx="23" cy="25" rx="2.8" ry="3.2" fill="#1f2937"/>
      <circle cx="24" cy="23.5" r="1.1" fill="white"/>
      <ellipse cx="37" cy="25" rx="2.8" ry="3.2" fill="#1f2937"/>
      <circle cx="38" cy="23.5" r="1.1" fill="white"/>
      <path d="M21 32 Q30 40 39 32" stroke="#92400e" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
      <ellipse cx="17" cy="31" rx="5" ry="4" fill="#fca5a5" opacity="0.5"/>
      <ellipse cx="43" cy="31" rx="5" ry="4" fill="#fca5a5" opacity="0.5"/>
      <rect x="13" y="48" width="34" height="22" rx="9" fill="#7c3aed"/>
      <path d="M26 48 L30 55 L34 48" fill="#a78bfa"/>
      <rect x="1" y="50" width="12" height="8" rx="4" fill="#7c3aed"/>
      <rect x="47" y="50" width="12" height="8" rx="4" fill="#7c3aed"/>
      <circle cx="3" cy="54" r="4" fill="#fde68a"/>
      <circle cx="57" cy="54" r="4" fill="#fde68a"/>
    </svg>
  )
}

export default function AgentResultsPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const agentSlug = params.agentSlug as string
  const isEmbed = searchParams.get('embed') === '1'

  const [wizardData, setWizardData] = useState<any>(null)
  const [packages, setPackages] = useState<MatchedPackage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [noPackages, setNoPackages] = useState(false)
  const [loadingIdx, setLoadingIdx] = useState(0)
  const [nameCaptureAction, setNameCaptureAction] = useState<'pdf' | 'whatsapp' | null>(null)
  const [copied, setCopied] = useState(false)
  const [wordDownloading, setWordDownloading] = useState(false)
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null)
  const [subAgentId, setSubAgentId] = useState<string | undefined>(undefined)
  const [subAgentName, setSubAgentName] = useState<string | undefined>(undefined)
  const [subAgentLogoUrl, setSubAgentLogoUrl] = useState<string | undefined>(undefined)
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const [selectedPkgIdx, setSelectedPkgIdx] = useState(0)

  // Day narrator
  const [currentDayIdx, setCurrentDayIdx] = useState(0)
  const [typedText, setTypedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isPaused, setIsPaused] = useState(true)
  const dayRefs = useRef<(HTMLDivElement | null)[]>([])

  // Language selector for Travel Guide
  const LANGUAGES = [
    { code: 'en', label: 'English',    flag: '🇬🇧' },
    { code: 'hi', label: 'Hindi',      flag: '🇮🇳' },
    { code: 'ar', label: 'Arabic',     flag: '🇸🇦' },
    { code: 'es', label: 'Spanish',    flag: '🇪🇸' },
    { code: 'fr', label: 'French',     flag: '🇫🇷' },
    { code: 'de', label: 'German',     flag: '🇩🇪' },
    { code: 'zh', label: 'Chinese',    flag: '🇨🇳' },
    { code: 'ja', label: 'Japanese',   flag: '🇯🇵' },
    { code: 'ru', label: 'Russian',    flag: '🇷🇺' },
    { code: 'th', label: 'Thai',       flag: '🇹🇭' },
    { code: 'ko', label: 'Korean',     flag: '🇰🇷' },
    { code: 'pt', label: 'Portuguese', flag: '🇧🇷' },
  ]
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[0])
  const [isTranslating, setIsTranslating] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const isSpeakingRef = useRef(false)   // synchronous check inside intervals
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [autoListen, setAutoListen] = useState(false)
  const autoListenRef = useRef(false)

  useEffect(() => {
    if (!isLoading) return
    const interval = setInterval(() => setLoadingIdx(i => (i + 1) % cinematicTexts.length), 2500)
    return () => clearInterval(interval)
  }, [isLoading])

  useEffect(() => {
    async function fetchAgent() {
      try {
        const res = await fetch(`/api/agent/profile?slug=${agentSlug}`)
        const data = await res.json()
        if (data.success) setAgentInfo(data.agent)
      } catch { }
    }
    fetchAgent()
  }, [agentSlug])

  useEffect(() => {
    if (!subAgentId) return
    async function fetchSubAgent() {
      try {
        const res = await fetch(`/api/agent/subagents/${subAgentId}`)
        const data = await res.json()
        if (data.success && data.subAgent) {
          if (data.subAgent.logoUrl) setSubAgentLogoUrl(data.subAgent.logoUrl)
          if (data.subAgent.name) setSubAgentName(data.subAgent.name)
        }
      } catch { }
    }
    fetchSubAgent()
  }, [subAgentId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = sessionStorage.getItem('tailored_wizard_data')
    if (!stored) {
      router.push(`/tailored-travel/${agentSlug}${isEmbed ? '?embed=1' : ''}`)
      return
    }
    try {
      const parsed = JSON.parse(stored)
      setWizardData(parsed)
      if (parsed.subAgentId) setSubAgentId(parsed.subAgentId)
      if (parsed.sessionId) setSessionId(parsed.sessionId)
      fetchPackages(parsed)
    } catch {
      setError('Failed to load your preferences. Please try again.')
      setIsLoading(false)
    }
  }, [agentSlug, router])

  // Translate + typewriter for the Travel Guide speech bubble
  // (No auto-speak — browsers block audio not triggered by a direct user click)
  useEffect(() => {
    if (packages.length === 0) return
    const days = parseDays(packages[0]?.Day_Wise_Itinerary || '')
    if (days.length === 0) return
    const raw = days[currentDayIdx]?.lines[0] || days[currentDayIdx]?.title || ''
    const baseText = raw.slice(0, 120)

    let cancelled = false
    let timer: ReturnType<typeof setInterval>

    // Stop any playing audio when day/language changes
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    isSpeakingRef.current = false
    setIsSpeaking(false)

    const runTypewriter = (text: string) => {
      if (cancelled) return
      setTypedText('')
      setIsTyping(true)
      let i = 0
      timer = setInterval(() => {
        if (cancelled) { clearInterval(timer); return }
        i++
        setTypedText(text.slice(0, i))
        if (i >= text.length) {
          setIsTyping(false)
          clearInterval(timer)
          if (autoListenRef.current && !isSpeakingRef.current) doSpeak(text)
        }
      }, 55)
    }

    if (selectedLang.code === 'en') {
      runTypewriter(baseText)
    } else {
      setIsTranslating(true)
      setTypedText('')
      fetch('/api/ai-planner/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: baseText, targetLanguage: selectedLang.code, targetLanguageName: selectedLang.label }),
      })
        .then(r => r.json())
        .then(data => {
          if (cancelled) return
          setIsTranslating(false)
          runTypewriter(data.translated || baseText)
        })
        .catch(() => {
          if (!cancelled) { setIsTranslating(false); runTypewriter(baseText) }
        })
    }

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [currentDayIdx, packages, selectedLang])

  // Core speak — can be called from user click OR auto-listen (after page audio is unlocked)
  const doSpeak = async (text: string) => {
    if (!text || isSpeakingRef.current) return
    isSpeakingRef.current = true
    setIsSpeaking(true)
    try {
      const res = await fetch('/api/ai-planner/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) { isSpeakingRef.current = false; setIsSpeaking(false); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      await audio.play()
      audio.onended = () => { URL.revokeObjectURL(url); isSpeakingRef.current = false; setIsSpeaking(false) }
      audio.onerror  = () => { isSpeakingRef.current = false; setIsSpeaking(false) }
    } catch { isSpeakingRef.current = false; setIsSpeaking(false) }
  }

  // Stop current audio
  const stopSpeak = () => {
    isSpeakingRef.current = false
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setIsSpeaking(false)
  }

  // Manual listen/stop button
  const handleSpeak = () => {
    if (isSpeaking) { stopSpeak(); return }
    doSpeak(typedText)
  }

  // Toggle auto-listen — first click is the browser user-gesture that unlocks audio
  const toggleAutoListen = () => {
    const next = !autoListenRef.current
    autoListenRef.current = next
    setAutoListen(next)
    if (!next) {
      stopSpeak()
    } else if (typedText && !isSpeakingRef.current) {
      doSpeak(typedText)  // immediately speak current text on enable
    }
  }

  // Scroll active day into view
  useEffect(() => {
    dayRefs.current[currentDayIdx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [currentDayIdx])

  async function fetchPackages(data: any) {
    setIsLoading(true); setError(null); setNoPackages(false)
    try {
      const res = await fetch('/api/tailored-travel/find-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, agentSlug }),
      })
      const result = await res.json()
      if (result.noAgentPackages) { setNoPackages(true); setPackages([]) }
      else if (result.success && result.packages) setPackages(result.packages)
      else throw new Error(result.error || 'No packages found')
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center gap-7">
          {agentInfo && (
            <div className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-full px-4 py-2 shadow-md shadow-gray-100">
              {agentInfo.logoUrl
                ? <img src={agentInfo.logoUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                : <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs">{agentInfo.companyName.charAt(0)}</div>}
              <span className="text-sm font-semibold text-gray-700">{agentInfo.companyName}</span>
            </div>
          )}
          <div className="relative flex items-center justify-center">
            <div className="absolute w-16 h-16 rounded-full bg-primary/10 animate-ping" />
            <div className="w-12 h-12 rounded-full border-4 border-gray-100 border-t-primary animate-spin" />
          </div>
          <AnimatePresence mode="wait">
            <motion.p key={loadingIdx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="text-gray-500 text-sm font-medium tracking-wide">{cinematicTexts[loadingIdx]}</motion.p>
          </AnimatePresence>
        </div>
      </div>
    )
  }

  const AgentStrip = ({ pkg }: { pkg?: MatchedPackage }) => agentInfo ? (
    <div className="bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm relative z-50 flex-shrink-0">
      <div className="px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {agentInfo.logoUrl
            ? <img src={agentInfo.logoUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-gray-100 shadow-sm" />
            : <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm">{agentInfo.companyName.charAt(0)}</div>}
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">{agentInfo.companyName}</p>
          </div>
        </div>
        <Link href={`/tailored-travel/${agentSlug}`}
          className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary font-semibold transition-colors flex-shrink-0 bg-gray-50 hover:bg-primary/5 px-3 py-1.5 rounded-full border border-gray-100 hover:border-primary/20">
          <ArrowLeft className="w-3 h-3" /> Change preferences
        </Link>
      </div>
    </div>
  ) : null

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <AgentStrip />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <X className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-red-600 mb-4 text-sm font-medium">{error}</p>
          <button onClick={() => router.push(`/tailored-travel/${agentSlug}${isEmbed ? '?embed=1' : ''}`)}
            className="flex items-center gap-2 text-primary font-semibold hover:underline text-sm">
            <ArrowLeft className="w-4 h-4" /> Try again
          </button>
        </div>
      </div>
    )
  }

  if (noPackages || packages.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <AgentStrip />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-primary/8 rounded-full flex items-center justify-center mb-4">
            <Package className="w-7 h-7 text-primary/50" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">No matching packages found</h2>
          <p className="text-sm text-gray-500 mb-6">
            {agentInfo?.companyName} hasn&apos;t added packages for your selected destinations yet.
          </p>
          <button onClick={() => router.push(`/tailored-travel/${agentSlug}${isEmbed ? '?embed=1' : ''}`)}
            className="flex items-center gap-2 bg-primary text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-lg shadow-primary/25 transition-all hover:scale-105">
            <ArrowLeft className="w-4 h-4" /> Change destination
          </button>
        </div>
      </div>
    )
  }

  // ── Results ──────────────────────────────────────────────────────────────
  const bestPkg = packages[selectedPkgIdx] ?? packages[0]
  const title = bestPkg.agentPackageTitle || bestPkg.Destination_Name
  const inclusions = typeof bestPkg.Inclusions === 'string'
    ? bestPkg.Inclusions.split(',').map((s: string) => s.trim()).filter(Boolean)
    : Array.isArray(bestPkg.Inclusions) ? bestPkg.Inclusions : []
  const exclusions = typeof bestPkg.Exclusions === 'string'
    ? bestPkg.Exclusions.split(',').map((s: string) => s.trim()).filter(Boolean)
    : Array.isArray(bestPkg.Exclusions) ? bestPkg.Exclusions : []
  const highlights = Array.isArray(bestPkg.Highlights) ? bestPkg.Highlights : []
  const pdfAdults = wizardData?.passengers?.adults || 1
  const pdfKids = wizardData?.passengers?.kids || 0
  const pdfInfants = wizardData?.groupSize?.infants || 0
  const pdfGroupSize = pdfAdults + pdfKids + pdfInfants
  const days = parseDays(bestPkg.Day_Wise_Itinerary || '')

  // Resolve travel date for PDF: format real dates, keep label strings as-is
  const pdfPreferredDates = (() => {
    const raw = wizardData?.dateRange
    if (!raw) return undefined
    const LABELS = ['Flexible', 'Next Month', 'Within 3 Months', 'Decided Dates']
    if (LABELS.includes(raw)) return raw
    const d = new Date(raw)
    return isNaN(d.getTime()) ? raw : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  })()

  return (
    <div className="min-h-screen bg-[#f8f5f0] text-gray-900">
      <AgentStrip pkg={bestPkg} />

      {/* ── Hero ── */}
      <section className="relative h-[260px] sm:h-[340px] md:h-[440px] w-full">
        {bestPkg.Primary_Image_URL
          ? <img src={bestPkg.Primary_Image_URL} alt={title} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-primary/10 flex items-center justify-center"><MapPin className="w-16 h-16 text-primary/20" /></div>}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-[#f8f5f0] opacity-95" />
      </section>

      {/* ── Floating content ── */}
      <section className="relative -mt-20 sm:-mt-24 md:-mt-32 px-4 sm:px-6 md:px-8 pb-20">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 md:gap-8 items-start">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-5">

            {/* Header card */}
            <article className="bg-white rounded-xl shadow-lg p-5 sm:p-7 space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-primary font-semibold uppercase tracking-wide">
                <span className="px-3 py-1 bg-primary/10 rounded-full">{bestPkg.Destination_Name}</span>
                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full">{bestPkg.Duration_Nights}N {bestPkg.Duration_Days}D</span>
                {bestPkg.Star_Category && bestPkg.Star_Category.toLowerCase() !== 'none' && (
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full">{bestPkg.Star_Category}</span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif text-[#1e1d2f] leading-tight">{title}</h1>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex flex-col gap-1 p-3 bg-[#f8f5f0] rounded-lg">
                  <Clock className="w-4 h-4 text-primary" />
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mt-0.5">Duration</p>
                  <p className="text-sm font-bold text-[#1e1d2f]">{bestPkg.Duration_Nights}N {bestPkg.Duration_Days}D</p>
                </div>
                <div className="flex flex-col gap-1 p-3 bg-[#f8f5f0] rounded-lg">
                  <MapPin className="w-4 h-4 text-primary" />
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mt-0.5">Destination</p>
                  <p className="text-sm font-bold text-[#1e1d2f]">{bestPkg.Destination_Name}</p>
                </div>
                {bestPkg.Star_Category && bestPkg.Star_Category.toLowerCase() !== 'none' && (
                  <div className="flex flex-col gap-1 p-3 bg-[#f8f5f0] rounded-lg">
                    <Star className="w-4 h-4 text-primary" />
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mt-0.5">Hotel</p>
                    <p className="text-sm font-bold text-[#1e1d2f]">{bestPkg.Star_Category}</p>
                  </div>
                )}
                <div className="flex flex-col gap-1 p-3 bg-[#f8f5f0] rounded-lg">
                  <Users className="w-4 h-4 text-primary" />
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mt-0.5">Passengers</p>
                  <p className="text-sm font-bold text-[#1e1d2f]">{pdfGroupSize} Pax</p>
                </div>
              </div>
            </article>

            {/* Why it matches */}
            {bestPkg.matchReason && (
              <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6 border-l-4 border-primary">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">Why it matches</p>
                <p className="text-sm text-gray-700 leading-relaxed">{bestPkg.matchReason}</p>
              </div>
            )}

            {/* Overview */}
            {bestPkg.Overview && (
              <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
                <h2 className="text-xl font-serif text-[#1e1d2f] mb-3">Overview</h2>
                <p className="text-sm text-gray-600 leading-relaxed">{bestPkg.Overview}</p>
              </div>
            )}

            {/* Highlights */}
            {highlights.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
                <h2 className="text-xl font-serif text-[#1e1d2f] mb-4">Highlights</h2>
                <ul className="space-y-3">
                  {highlights.map((h: string, i: number) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 text-primary text-base flex-shrink-0">✔</span>
                      <span className="text-sm text-gray-700 leading-relaxed">{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Day-wise Itinerary */}
            {days.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-serif text-[#1e1d2f]">Day-wise Itinerary</h2>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentDayIdx(p => Math.max(0, p - 1))} disabled={currentDayIdx === 0}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition-colors">
                      <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
                    </button>
<button onClick={() => setCurrentDayIdx(p => Math.min(days.length - 1, p + 1))} disabled={currentDayIdx === days.length - 1}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition-colors">
                      <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {days.map((day, i) => (
                    <details
                      key={i}
                      ref={el => { dayRefs.current[i] = el as any }}
                      open={i === currentDayIdx}
                      className={`rounded-lg border p-4 transition-all [&[open]_svg.chevron]:rotate-180 ${
                        i === currentDayIdx ? 'border-primary/30 shadow-sm' : 'border-gray-200 bg-white hover:border-primary/20'
                      }`}
                    >
                      <summary
                        className="flex items-center justify-between cursor-pointer list-none gap-3"
                        onClick={e => { e.preventDefault(); setCurrentDayIdx(i); setIsPaused(true) }}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 transition-all ${
                            i === currentDayIdx ? 'bg-primary text-white shadow-sm' : 'bg-primary/10 text-primary'
                          }`}>
                            {day.number}
                          </span>
                          <span className="text-sm font-medium text-gray-800 leading-tight">{day.title}</span>
                        </div>
                        <ChevronDown className="chevron w-4 h-4 text-primary transition-transform duration-200 flex-shrink-0" />
                      </summary>
                      {day.lines.length > 0 && (
                        <div className="mt-3 pl-10 space-y-1.5">
                          {day.lines.map((line, j) => (
                            <p key={j} className="text-xs text-gray-500 leading-relaxed pl-2 border-l-2 border-primary/20">{line}</p>
                          ))}
                        </div>
                      )}
                    </details>
                  ))}
                </div>
              </div>
            )}

            {/* Inclusions + Exclusions */}
            {(inclusions.length > 0 || exclusions.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {inclusions.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-5">
                    <h2 className="text-lg font-serif text-[#1e1d2f] mb-3">Inclusions</h2>
                    <ul className="space-y-2.5">
                      {inclusions.map((inc: string, i: number) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-gray-700 leading-relaxed">{inc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {exclusions.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-5">
                    <h2 className="text-lg font-serif text-[#1e1d2f] mb-3">Exclusions</h2>
                    <ul className="space-y-2.5">
                      {exclusions.map((exc: string, i: number) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <X className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-gray-500 leading-relaxed">{exc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Hotels */}
            {Array.isArray(bestPkg.Hotels) && bestPkg.Hotels.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
                <div className="flex items-center gap-2.5 mb-4">
                  <Hotel className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-serif text-[#1e1d2f]">Hotel Information</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide pb-2 pr-4">Destination</th>
                        <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide pb-2 pr-4">Nights</th>
                        <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide pb-2 pr-4">Hotel(s)</th>
                        <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide pb-2 pr-4">Meal Plan</th>
                        <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide pb-2">Room Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {bestPkg.Hotels.map((h: any, i: number) => (
                        <tr key={i}>
                          <td className="py-2.5 pr-4 font-semibold text-gray-900">{h.destination || '—'}</td>
                          <td className="py-2.5 pr-4 text-gray-600">{h.nights ? `${h.nights}N` : '—'}</td>
                          <td className="py-2.5 pr-4 text-gray-700">{h.hotels || '—'}</td>
                          <td className="py-2.5 pr-4">
                            {h.mealPlan
                              ? <span className="text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full font-medium">{h.mealPlan}</span>
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="py-2.5 text-gray-600">{h.roomType || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Transport & Transfers */}
            {Array.isArray(bestPkg.Vehicles) && bestPkg.Vehicles.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
                <div className="flex items-center gap-2.5 mb-4">
                  <Car className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-serif text-[#1e1d2f]">Transport & Transfers</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide pb-2 pr-4">Vehicle</th>
                        <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide pb-2 pr-4">Seats</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {bestPkg.Vehicles.map((v: any, i: number) => (
                        <tr key={i}>
                          <td className="py-2.5 pr-4">
                            <p className="font-semibold text-gray-900">{v.vehicleType || '—'}</p>
                          </td>
                          <td className="py-2.5 pr-4 text-gray-600">{v.seats || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payment Policy */}
            {bestPkg.PaymentPolicy && (
              <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
                <div className="flex items-center gap-2.5 mb-3">
                  <CreditCard className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-serif text-[#1e1d2f]">Payment Policy</h2>
                </div>
                <div className="space-y-2">
                  {bestPkg.PaymentPolicy.split('\n').filter(Boolean).map((line: string, i: number) => (
                    <p key={i} className="text-sm text-gray-600 leading-relaxed border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Cancellation Policy */}
            {bestPkg.CancellationPolicy && (
              <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
                <div className="flex items-center gap-2.5 mb-3">
                  <Ban className="w-5 h-5 text-red-400" />
                  <h2 className="text-xl font-serif text-[#1e1d2f]">Cancellation Policy</h2>
                </div>
                <div className="space-y-2">
                  {bestPkg.CancellationPolicy.split('\n').filter(Boolean).map((line: string, i: number) => (
                    <p key={i} className="text-sm text-gray-600 leading-relaxed border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* ── RIGHT COLUMN — Sticky sidebar ── */}
          <div className="lg:sticky lg:top-6 space-y-4">

            {/* Price + action card */}
            <div className="bg-white rounded-xl shadow-xl p-5 sm:p-6 space-y-5">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">{bestPkg.totalPrice ? 'Total Price' : 'Starting from'}</p>
                <p className="text-3xl font-serif text-[#c99846] leading-tight">
                  {getCurrencySymbol(bestPkg.Currency)}{(bestPkg.totalPrice || bestPkg.Price_Min_INR).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">
                  {bestPkg.totalPrice ? 'full package' : 'per person'}
                  {bestPkg.gst ? <span className="ml-1 text-amber-600 font-medium">+ {bestPkg.gst}% GST</span> : null}
                </p>
              </div>

              {/* Trip summary */}
              <div className="text-xs text-gray-600 bg-[#f8f5f0] rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span>
                    {pdfAdults} adult{pdfAdults !== 1 ? 's' : ''}
                    {pdfKids ? `, ${pdfKids} kid${pdfKids !== 1 ? 's' : ''}` : ''}
                    {pdfInfants ? `, ${pdfInfants} infant${pdfInfants !== 1 ? 's' : ''}` : ''}
                  </span>
                </div>
                {wizardData?.dateRange && !['Flexible', 'Next Month', 'Within 3 Months', 'Decided Dates'].includes(wizardData.dateRange) && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span>{new Date(wizardData.dateRange).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                )}
                {wizardData?.pickupCity && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span>From {wizardData.pickupCity}</span>
                  </div>
                )}
              </div>

              {/* CTAs */}
              <div className="space-y-2.5">
                <button
                  onClick={() => setNameCaptureAction('pdf')}
                  className="w-full border-2 border-gray-900 text-gray-900 py-3 rounded-lg font-semibold text-sm hover:bg-gray-900 hover:text-white transition flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" /> Download Itinerary
                </button>
                <button
                  onClick={() => setNameCaptureAction('whatsapp')}
                  className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold text-sm transition"
                >
                  <Send className="w-3.5 h-3.5" /> Share on WhatsApp
                </button>
                <button
                  onClick={() => {
                    const msg = buildWhatsAppMsg(bestPkg, undefined, { adults: pdfAdults, kids: pdfKids, infants: pdfInfants })
                    navigator.clipboard.writeText(msg).then(() => {
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    })
                  }}
                  className="w-full flex items-center justify-center gap-2 border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold text-sm hover:bg-gray-50 transition"
                >
                  {copied ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Text</>}
                </button>
                <button
                  disabled={wordDownloading}
                  onClick={async () => {
                    setWordDownloading(true)
                    try {
                      await downloadPackageWord({
                        title,
                        destination: bestPkg.Destination_Name,
                        destinationCountry: bestPkg.Destination_Country,
                        durationDays: bestPkg.Duration_Days,
                        durationNights: bestPkg.Duration_Nights,
                        starCategory: bestPkg.Star_Category,
                        currency: bestPkg.Currency,
                        pricePerPerson: !bestPkg.totalPrice ? bestPkg.Price_Min_INR : null,
                        totalPrice: bestPkg.totalPrice || null,
                        gst: bestPkg.gst ?? null,
                        adults: pdfAdults,
                        kids: pdfKids || undefined,
                        infants: pdfInfants || undefined,
                        overview: bestPkg.Overview,
                        inclusions,
                        exclusions,
                        dayWiseItinerary: bestPkg.Day_Wise_Itinerary ? String(bestPkg.Day_Wise_Itinerary) : undefined,
                        hotels: Array.isArray(bestPkg.Hotels) && bestPkg.Hotels.length > 0 ? bestPkg.Hotels : undefined,
                        vehicles: Array.isArray(bestPkg.Vehicles) && bestPkg.Vehicles.length > 0 ? bestPkg.Vehicles : undefined,
                        paymentPolicy: bestPkg.PaymentPolicy || undefined,
                        cancellationPolicy: bestPkg.CancellationPolicy || undefined,
                        brandName: subAgentName || agentInfo?.companyName || 'Travel Agent',
                        agentLogoUrl: subAgentLogoUrl || (subAgentName ? undefined : agentInfo?.logoUrl) || undefined,
                      })
                    } finally {
                      setWordDownloading(false)
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 border-2 border-blue-200 text-blue-700 py-3 rounded-lg font-semibold text-sm hover:bg-blue-50 transition disabled:opacity-60"
                >
                  {wordDownloading
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                    : <><FileDown className="w-3.5 h-3.5" /> Download as Word</>}
                </button>
              </div>
            </div>



          </div>
        </div>
      </section>

      {/* ── Name Capture Modal ── */}
      <AnimatePresence>
        {nameCaptureAction && agentInfo && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
              <NameCaptureModal
                action={nameCaptureAction}
                agentInfo={agentInfo}
                pkg={bestPkg}
                wizardData={wizardData}
                subAgentId={subAgentId}
                subAgentName={subAgentName}
                sessionId={sessionId}
                agentSlug={agentSlug}
                onClose={() => setNameCaptureAction(null)}
                onSuccess={(capturedName, priceOpts) => {
                  if (nameCaptureAction === 'pdf') {
                    openPackagePdfWindow({
                      title,
                      destination: bestPkg.Destination_Name,
                      destinationCountry: bestPkg.Destination_Country,
                      heroImage: bestPkg.Primary_Image_URL,
                      durationDays: bestPkg.Duration_Days,
                      durationNights: bestPkg.Duration_Nights,
                      starCategory: bestPkg.Star_Category,
                      travelType: bestPkg.Travel_Type,
                      pricePerPerson: priceOpts.showPrice && !bestPkg.totalPrice ? priceOpts.finalPricePerPerson : null,
                      totalPrice: priceOpts.showPrice && bestPkg.totalPrice ? bestPkg.totalPrice : null,
                      gst: bestPkg.gst ?? null,
                      quotedPriceTotal: priceOpts.showPrice && !bestPkg.totalPrice && pdfGroupSize > 1 ? priceOpts.quotedPriceTotal : null,
                      currency: bestPkg.Currency,
                      groupSize: pdfGroupSize,
                      adults: pdfAdults,
                      kids: pdfKids || undefined,
                      infants: pdfInfants || undefined,
                      overview: bestPkg.Overview,
                      inclusions,
                      exclusions,
                      highlights,
                      dayWiseItinerary: bestPkg.Day_Wise_Itinerary ? String(bestPkg.Day_Wise_Itinerary) : undefined,
                      hotels: Array.isArray(bestPkg.Hotels) && bestPkg.Hotels.length > 0 ? bestPkg.Hotels : undefined,
                      vehicles: Array.isArray(bestPkg.Vehicles) && bestPkg.Vehicles.length > 0 ? bestPkg.Vehicles : undefined,
                      paymentPolicy: bestPkg.PaymentPolicy || undefined,
                      cancellationPolicy: bestPkg.CancellationPolicy || undefined,
                      preferredDates: pdfPreferredDates,
                      customerName: capturedName || undefined,
                      brandName: subAgentName || agentInfo?.companyName || 'Travel Agent',
                      agentContactName: subAgentName ? undefined : (agentInfo?.contactName || undefined),
                      agentLogoUrl: subAgentLogoUrl || (subAgentName ? undefined : agentInfo?.logoUrl) || undefined,
                      termsVariant: 'brochure',
                    }, 'download')
                  } else {
                    const msg = buildWhatsAppMsg(bestPkg, priceOpts, { adults: pdfAdults, kids: pdfKids, infants: pdfInfants })
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
                  }
                  setNameCaptureAction(null)
                }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}

function buildWhatsAppMsg(
  pkg: MatchedPackage,
  priceOpts?: PriceOpts,
  pax?: { adults: number; kids: number; infants: number },
): string {
  const title = pkg.agentPackageTitle || pkg.Destination_Name
  const div = '━━━━━━━━━━━━━━━━━━━━━━'
  const thin = '──────────────────────'

  const toList = (val: string | string[] | undefined): string[] =>
    typeof val === 'string'
      ? val.split(',').map((s: string) => s.trim()).filter(Boolean)
      : Array.isArray(val) ? val.filter(Boolean) : []

  const inclusions = toList(pkg.Inclusions)
  const exclusions = toList(pkg.Exclusions)
  const lines: string[] = []

  // ── Header ──────────────────────────────────────────
  lines.push(`Dear Customer,`)
  lines.push(``)
  lines.push(`*${title}*`)
  lines.push(div)

  // ── 1. Basic Information ─────────────────────────────
  lines.push(``)
  lines.push(`*BASIC INFORMATION*`)
  lines.push(`*Destination:* ${pkg.Destination_Name}${pkg.Destination_Country ? ', ' + pkg.Destination_Country : ''}`)
  lines.push(`*Duration:* ${pkg.Duration_Days} Days / ${pkg.Duration_Nights} Nights`)
  if (pkg.Star_Category) lines.push(`*Hotel Category:* ${pkg.Star_Category}`)
  if (pax) {
    const totalPax = pax.adults + pax.kids + pax.infants
    const paxParts = [`${pax.adults} Adult${pax.adults !== 1 ? 's' : ''}`]
    if (pax.kids > 0) paxParts.push(`${pax.kids} Child${pax.kids !== 1 ? 'ren' : ''}`)
    if (pax.infants > 0) paxParts.push(`${pax.infants} Infant${pax.infants !== 1 ? 's' : ''}`)
    lines.push(`*Passengers:* ${totalPax} Pax (${paxParts.join(', ')})`)
  }
  if (!priceOpts || priceOpts.showPrice) {
    const sym = getCurrencySymbol((pkg as any).Currency)
    const displayPrice = priceOpts ? priceOpts.finalPricePerPerson : (pkg.totalPrice || pkg.Price_Min_INR)
    const priceLabel = pkg.totalPrice ? 'Total Price' : 'Price Per Person'
    const gstNote = pkg.gst ? ` + ${pkg.gst}% GST` : ''
    lines.push(`*Price:* ${sym}${displayPrice.toLocaleString()} (${priceLabel})${gstNote}`)
  }

  // ── 2. Overview ──────────────────────────────────────
  if (pkg.Overview) {
    lines.push(``)
    lines.push(thin)
    lines.push(``)
    lines.push(`*OVERVIEW*`)
    lines.push(pkg.Overview)
  }

  // ── 3. Day-wise Itinerary ────────────────────────────
  if (pkg.Day_Wise_Itinerary) {
    lines.push(``)
    lines.push(thin)
    lines.push(``)
    lines.push(`*DAY-WISE ITINERARY*`)
    String(pkg.Day_Wise_Itinerary).split('\n').filter(Boolean).forEach(line => {
      if (/^day\s*\d+/i.test(line)) {
        lines.push(``)
        lines.push(`*${line.trim()}*`)
      } else {
        lines.push(`  • ${line.trim()}`)
      }
    })
  }

  // ── 4. Hotel Information ─────────────────────────────
  if (Array.isArray(pkg.Hotels) && pkg.Hotels.length > 0) {
    lines.push(``)
    lines.push(thin)
    lines.push(``)
    lines.push(`*HOTEL INFORMATION*`)
    pkg.Hotels.forEach((h: any) => {
      lines.push(``)
      lines.push(`*${h.destination || 'Hotel'}*${h.nights ? ` — ${h.nights} Night${h.nights > 1 ? 's' : ''}` : ''}`)
      if (h.hotels) lines.push(`   ${h.hotels}`)
      if (h.mealPlan) lines.push(`   Meal Plan: ${h.mealPlan}`)
      if (h.roomType) lines.push(`   Room: ${h.roomType}`)
    })
  }

  // ── 5. Transport & Transfers ─────────────────────────
  if (Array.isArray(pkg.Vehicles) && pkg.Vehicles.length > 0) {
    lines.push(``)
    lines.push(thin)
    lines.push(``)
    lines.push(`*TRANSPORT & TRANSFERS*`)
    pkg.Vehicles.forEach((v: any) => {
      if (v.vehicleType) lines.push(`  ${v.vehicleType}`)
    })
  }

  // ── 6. Inclusions ────────────────────────────────────
  if (inclusions.length > 0) {
    lines.push(``)
    lines.push(thin)
    lines.push(``)
    lines.push(`*INCLUSIONS*`)
    inclusions.forEach((inc: string) => lines.push(`  ✓ ${inc}`))
  }

  // ── 7. Exclusions ────────────────────────────────────
  if (exclusions.length > 0) {
    lines.push(``)
    lines.push(thin)
    lines.push(``)
    lines.push(`*EXCLUSIONS*`)
    exclusions.forEach((exc: string) => lines.push(`  ✗ ${exc}`))
  }

  // ── 8. Payment Policy ────────────────────────────────
  if (pkg.PaymentPolicy) {
    lines.push(``)
    lines.push(thin)
    lines.push(``)
    lines.push(`*PAYMENT POLICY*`)
    pkg.PaymentPolicy.split('\n').filter(Boolean).forEach(line => lines.push(`  ${line.trim()}`))
  }

  // ── 9. Cancellation Policy ───────────────────────────
  if (pkg.CancellationPolicy) {
    lines.push(``)
    lines.push(thin)
    lines.push(``)
    lines.push(`*CANCELLATION POLICY*`)
    pkg.CancellationPolicy.split('\n').filter(Boolean).forEach(line => lines.push(`  ${line.trim()}`))
  }

  return lines.join('\n')
}


interface PriceOpts { showPrice: boolean; finalPricePerPerson: number; quotedPriceTotal: number }

function NameCaptureModal({ action, agentInfo, pkg, wizardData, subAgentId, subAgentName, sessionId, agentSlug, onClose, onSuccess }: {
  action: 'pdf' | 'whatsapp'
  agentInfo: AgentInfo; pkg: MatchedPackage; wizardData: any
  subAgentId?: string; subAgentName?: string; sessionId?: string; agentSlug?: string
  onClose: () => void; onSuccess: (name: string, priceOpts: PriceOpts) => void
}) {
  const [customerName, setCustomerName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Price controls (PDF only)
  const [showPrice, setShowPrice] = useState(true)
  const [addServiceFee, setAddServiceFee] = useState(false)
  const [feeType, setFeeType] = useState<'absolute' | 'percentage'>('absolute')
  const [feeInput, setFeeInput] = useState('0')

  const isTotalPrice = Boolean(pkg.totalPrice)
  const basePrice = pkg.totalPrice || pkg.Price_Min_INR
  const groupSize = (wizardData?.groupSize?.adults || wizardData?.passengers?.adults || 1)
    + (wizardData?.groupSize?.children || wizardData?.passengers?.kids || 0)
    + (wizardData?.groupSize?.infants || 0)
  const currSym = getCurrencySymbol(pkg.Currency)

  const feeValue = parseFloat(feeInput) || 0
  const serviceFee = addServiceFee
    ? feeType === 'absolute' ? feeValue : Math.round(basePrice * feeValue / 100)
    : 0
  const finalPricePerPerson = basePrice + serviceFee
  // if totalPrice is set it's already the full package total — don't multiply by pax
  const quotedPriceTotal = isTotalPrice ? finalPricePerPerson : finalPricePerPerson * groupSize

  const preferredDates = wizardData?.dateRange && !['Flexible', 'Next Month', 'Within 3 Months', 'Decided Dates'].includes(wizardData.dateRange)
    ? wizardData.dateRange : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customerName.trim()) { setError('Customer name is required.'); return }
    setError(''); setSubmitting(true)
    try {
      const endpoint = subAgentId ? '/api/agent/quotations' : '/api/agent/bookings'
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agentInfo.id, agentSlug: agentInfo.agentSlug, subAgentId, subAgentName: subAgentName || '',
          packageId: pkg.id, packageTitle: pkg.agentPackageTitle || pkg.Destination_Name,
          destination: pkg.Destination_Name, customerName: customerName.trim(),
          customerEmail: '', customerPhone: '', preferredDates,
          groupSize, adults: wizardData?.groupSize?.adults || wizardData?.passengers?.adults || 1,
          kids: wizardData?.groupSize?.children || wizardData?.passengers?.kids || 0,
          infants: wizardData?.groupSize?.infants || 0,
          rooms: wizardData?.passengers?.rooms || 1, specialRequests: '',
          wizardData, selectedPackage: pkg,
        }),
      })
      if (agentSlug && sessionId) {
        fetch('/api/agent/track', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentSlug, sessionId, action: 'quotation_submitted', subAgentId, destination: pkg.Destination_Name, packageTitle: pkg.agentPackageTitle || pkg.Destination_Name }),
        }).catch(() => {})
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      onSuccess(customerName.trim(), { showPrice, finalPricePerPerson, quotedPriceTotal })
    } catch (err: any) { setError(err.message || 'Something went wrong.') }
    finally { setSubmitting(false) }
  }

  const actionLabel = action === 'pdf' ? 'Download Itinerary' : 'Share on WhatsApp'

  return (
    <form onSubmit={handleSubmit}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 rounded-t-3xl">
        <div>
          <h3 className="font-bold text-gray-900">{actionLabel}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{pkg.agentPackageTitle || pkg.Destination_Name} · {currSym}{basePrice.toLocaleString()}{isTotalPrice ? ' total' : '/person'}</p>
        </div>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
      </div>

      <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
        {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2.5 rounded-xl border border-red-100">{error}</div>}

        {/* Customer name */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Customer Name *</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              autoFocus
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              required
              placeholder="Your customer's full name"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30"
            />
          </div>
        </div>

        {/* Passengers summary */}
        <div className="bg-primary/5 rounded-xl px-4 py-3 flex items-center gap-3 border border-primary/10">
          <Users className="w-4 h-4 text-primary flex-shrink-0" />
          <p className="text-xs text-gray-700">
            {wizardData?.passengers?.adults || 1} adult{(wizardData?.passengers?.adults || 1) !== 1 ? 's' : ''}
            {wizardData?.passengers?.kids ? `, ${wizardData.passengers.kids} kid${wizardData.passengers.kids !== 1 ? 's' : ''}` : ''}
            {wizardData?.groupSize?.infants ? `, ${wizardData.groupSize.infants} infant${wizardData.groupSize.infants !== 1 ? 's' : ''}` : ''}
            {' · '}{wizardData?.passengers?.rooms || 1} room{(wizardData?.passengers?.rooms || 1) !== 1 ? 's' : ''}
            {' · '}{pkg.Duration_Nights}N {pkg.Duration_Days}D
          </p>
        </div>

        {/* Price controls */}
        <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">

            {/* Show price toggle */}
            <label className="flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={showPrice}
                onChange={e => setShowPrice(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-primary flex-shrink-0"
              />
              <div>
                <p className="text-sm font-semibold text-gray-800">Show price</p>
                <p className="text-xs text-gray-500 mt-0.5">Display pricing details in the {action === 'pdf' ? 'PDF' : 'WhatsApp message'}</p>
              </div>
            </label>

            {/* Service fee toggle */}
            {showPrice && (
              <label className="flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={addServiceFee}
                  onChange={e => setAddServiceFee(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-primary flex-shrink-0"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-800">Add Service Fees</p>
                  <p className="text-xs text-gray-500 mt-0.5">Add a markup amount charged to the customer</p>
                </div>
              </label>
            )}

            {/* Fee input */}
            {showPrice && addServiceFee && (
              <div className="px-4 py-4 bg-gray-50/60 space-y-3">
                {/* Absolute / Percentage radio */}
                <div className="flex items-center gap-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="feeType" value="absolute" checked={feeType === 'absolute'}
                      onChange={() => setFeeType('absolute')} className="w-4 h-4 accent-primary" />
                    <span className="text-sm font-medium text-gray-700">Absolute</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="feeType" value="percentage" checked={feeType === 'percentage'}
                      onChange={() => setFeeType('percentage')} className="w-4 h-4 accent-primary" />
                    <span className="text-sm font-medium text-gray-700">Percentage</span>
                  </label>
                </div>
                {/* Amount input */}
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white">
                  <span className="px-3 py-2.5 text-sm font-semibold text-gray-500 bg-gray-100 border-r border-gray-200 flex-shrink-0">
                    {feeType === 'absolute' ? currSym.trim() || pkg.Currency || 'INR' : '%'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step={feeType === 'percentage' ? '0.1' : '1'}
                    value={feeInput}
                    onChange={e => setFeeInput(e.target.value)}
                    className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
                  />
                </div>
                <p className="text-xs text-gray-400">This amount will be added to the {isTotalPrice ? 'total package price' : 'price per person'}</p>
              </div>
            )}

            {/* Price summary */}
            {showPrice && (
              <div className="px-4 py-4 space-y-2">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Price Summary</p>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Base Price</span>
                  <span>{currSym}{basePrice.toLocaleString()}</span>
                </div>
                {addServiceFee && serviceFee > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Service Fee</span>
                    <span className="text-green-600">+ {currSym}{serviceFee.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-100">
                  <span>{isTotalPrice ? 'Total Price' : 'Total per person'}</span>
                  <span>{currSym}{finalPricePerPerson.toLocaleString()}</span>
                </div>
                {!isTotalPrice && groupSize > 1 && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Total ({groupSize} pax)</span>
                    <span>{currSym}{quotedPriceTotal.toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}
          </div>
      </div>

      <div className="px-6 pb-6">
        <button type="submit" disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><Send className="w-4 h-4" />{actionLabel}</>}
        </button>
      </div>
    </form>
  )
}
