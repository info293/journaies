'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  MessageSquare, Search, Loader2, IndianRupee, Send,
  CheckCircle, XCircle, Clock, Package, Phone, Mail,
  MapPin, Calendar, Users, User, BookCheck, Edit3, X,
  Eye, Star, Save, ChevronDown, ChevronUp, FileEdit, Share2, FileText, Printer, SlidersHorizontal,
  Plus, GripVertical, Upload, Download, AlertCircle
} from 'lucide-react'
import PackagePdfModal from '@/components/pdf/PackagePdfModal'
import { openPackagePdfWindow } from '@/lib/generatePackagePdf'
import { HotelEntry, VehicleEntry } from '@/lib/types/agent'
import { CURRENCIES, getCurrencySymbol } from '@/lib/utils/currency'

// Module-level exchange rate cache for the customize form
const QUOT_RATE_CACHE: Record<string, { rate: number; updatedAt: string; cachedAt: number }> = {}
const QUOT_CACHE_TTL_MS = 30 * 60 * 1000

async function fetchQuotINRRate(fromCurrency: string): Promise<{ rate: number; updatedAt: string }> {
  const cached = QUOT_RATE_CACHE[fromCurrency]
  if (cached && Date.now() - cached.cachedAt < QUOT_CACHE_TTL_MS) {
    return { rate: cached.rate, updatedAt: cached.updatedAt }
  }
  const res = await fetch(`https://open.er-api.com/v6/latest/${fromCurrency}`)
  if (!res.ok) throw new Error(`Rate fetch failed: ${res.status}`)
  const data = await res.json()
  if (data.result !== 'success') throw new Error('Rate API error')
  const rate: number = data.rates['INR'] ?? 1
  const updatedAt: string = data.time_last_update_utc ?? new Date().toUTCString()
  QUOT_RATE_CACHE[fromCurrency] = { rate, updatedAt, cachedAt: Date.now() }
  return { rate, updatedAt }
}

interface Message {
  id: string
  senderId: string
  senderRole: 'dmc' | 'travel_agent' | 'system'
  senderName: string
  text: string
  timestamp: string
}

interface DayItem {
  id: string
  title: string
  description: string
  tags: string[]
}

interface PackageData {
  id: string
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
  maxGroupSize?: number
  minGroupSize?: number
  travelType?: string
  theme?: string
  mood?: string
  starCategory?: string
  inclusions?: string[]
  exclusions?: string[]
  highlights?: string[]
  dayWiseItinerary?: string
  primaryImageUrl?: string
  seasonalAvailability?: string
  hotels?: HotelEntry[]
  vehicles?: VehicleEntry[]
  perks?: string[]
  paymentPolicy?: string
  cancellationPolicy?: string
}

interface Quotation {
  id: string
  publicId?: string
  subAgentId: string
  subAgentName: string
  packageId?: string
  packageTitle: string
  destination: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  preferredDates?: string
  groupSize: number
  adults: number
  kids: number
  infants?: number
  rooms?: number
  specialRequests?: string
  status: string
  quotedPrice?: number | null
  agentNotes?: string
  customPackageData?: PackageData | null
  messages: Message[]
  createdAt?: { seconds: number }
  updatedAt?: { seconds: number }
}

interface Props {
  agentId: string
  agentSlug: string
  agentName: string
  currentUserId: string
  subAgentId?: string
  openCustomizeId?: string
  toName?: string
}

const TRAVEL_TYPES = ['Leisure', 'Adventure', 'Honeymoon', 'Family', 'Corporate', 'Pilgrimage', 'Wildlife']
const STAR_CATEGORIES = ['3-Star', '4-Star', '5-Star', 'Luxury', 'Budget', 'Homestay']
const THEMES = ['Beach', 'Wildlife', 'Cultural', 'Hills', 'Desert', 'Adventure', 'Wellness', 'Heritage', 'Backpacking']
const MOODS = ['Relaxing', 'Adventurous', 'Romantic', 'Family Fun', 'Spiritual', 'Exploratory']
const MEAL_PLANS = ['Breakfast', 'Breakfast + Lunch/Dinner', 'All Meals', 'Room Only']
const VEHICLE_TYPES = ['Sedan', 'SUV', 'Innova Crysta', 'Tempo Traveller (12 Seater)', 'Tempo Traveller (16 Seater)', 'Mini Bus (20 Seater)', 'Bus (40+ Seater)', 'Luxury Car', 'Hatchback', 'Van', 'Auto Rickshaw']
const PRESET_PERKS = [
  { label: 'Free Airport Transfer', emoji: '🚗' },
  { label: 'Complimentary Breakfast', emoji: '🍳' },
  { label: 'All Meals Included', emoji: '🍽️' },
  { label: 'Free WiFi', emoji: '📶' },
  { label: 'Travel Insurance', emoji: '🛡️' },
  { label: 'Entry Tickets Included', emoji: '🎟️' },
  { label: 'English-Speaking Guide', emoji: '🎯' },
  { label: 'Sightseeing Included', emoji: '🚌' },
  { label: 'Free Cancellation', emoji: '🔄' },
  { label: 'Welcome Drink', emoji: '🍾' },
  { label: 'Water Sports Included', emoji: '🏄' },
  { label: 'Wildlife Safari Included', emoji: '🦁' },
  { label: 'Complimentary Spa', emoji: '💆' },
  { label: 'Pool Access', emoji: '🏊' },
  { label: 'Early Check-in / Late Checkout', emoji: '🏨' },
  { label: 'Porter Service', emoji: '🎒' },
  { label: 'Ferry / Cruise Included', emoji: '🚢' },
  { label: 'Professional Photography', emoji: '📸' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending:       { label: 'Pending',       color: 'bg-gray-100 text-gray-600',    icon: Clock },
  in_discussion: { label: 'In Discussion', color: 'bg-blue-100 text-blue-700',    icon: MessageSquare },
  quoted:        { label: 'Quoted',        color: 'bg-amber-100 text-amber-700',  icon: IndianRupee },
  accepted:      { label: 'Accepted',      color: 'bg-green-100 text-green-700',  icon: CheckCircle },
  rejected:      { label: 'Rejected',      color: 'bg-red-100 text-red-700',      icon: XCircle },
  converted:     { label: 'Booked',         color: 'bg-purple-100 text-purple-700', icon: BookCheck },
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  return isToday
    ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' +
      d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDate(ts?: { seconds: number }) {
  if (!ts) return null
  const d = new Date(ts.seconds * 1000)
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  return { date, time }
}

function formatTravelDate(raw?: string) {
  if (!raw) return null
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function parseDayItems(text: string): DayItem[] {
  if (!text?.trim()) return []
  const items: DayItem[] = []
  let current: DayItem | null = null
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (/^day\s*\d+/i.test(line)) {
      if (current) items.push(current)
      current = { id: crypto.randomUUID(), title: line, description: '', tags: [] }
    } else if (current) {
      current.description += (current.description ? '\n' : '') + line
    }
  }
  if (current) items.push(current)
  return items
}

function serializeDayItems(items: DayItem[]): string {
  return items.map(d => [d.title, d.description].filter(Boolean).join('\n')).join('\n\n')
}

export default function QuotationsManager({ agentId, agentSlug, agentName, currentUserId, subAgentId, openCustomizeId, toName }: Props) {
  const router = useRouter()
  const autoOpenDoneRef = useRef(false)
  const skipNextResetRef = useRef(false)
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDate, setFilterDate] = useState<'today' | '7d' | '30d' | 'all'>('all')
  const [filterSubAgent, setFilterSubAgent] = useState('all')
  const [filterDest, setFilterDest] = useState('all')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [pdfQuot, setPdfQuot] = useState<Quotation | null>(null)
  // Price editing
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceInput, setPriceInput] = useState('')
  const [savingPrice, setSavingPrice] = useState(false)
  // Booking conversion
  const [converting, setConverting] = useState(false)
  const [convertedIds, setConvertedIds] = useState<Set<string>>(new Set())
  // Package view / customize
  const [viewPkg, setViewPkg] = useState<PackageData | null>(null)
  const [loadingPkg, setLoadingPkg] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)
  const [customForm, setCustomForm] = useState<Partial<PackageData>>({})
  const [customDayItems, setCustomDayItems] = useState<DayItem[]>([])
  const [savingCustom, setSavingCustom] = useState(false)
  const [creatingPkg, setCreatingPkg] = useState(false)
  const [chatPanelOpen, setChatPanelOpen] = useState(false)
  const [detailPanelOpen, setDetailPanelOpen] = useState(false)
  const originalCustomFormRef = useRef<Partial<PackageData>>({})
  const originalCustomDayItemsRef = useRef<DayItem[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Customize form — hotels / vehicles / perks
  const [customHotelEntries, setCustomHotelEntries] = useState<HotelEntry[]>([])
  const [customVehicleEntries, setCustomVehicleEntries] = useState<VehicleEntry[]>([])
  const [customPerks, setCustomPerks] = useState<string[]>([])
  const [customPerkInput, setCustomPerkInput] = useState('')
  const [customHotelCsvMsg, setCustomHotelCsvMsg] = useState('')
  const [customVehicleCsvMsg, setCustomVehicleCsvMsg] = useState('')
  const [customImgUploading, setCustomImgUploading] = useState(false)
  const customImgInputRef = useRef<HTMLInputElement>(null)
  const customHotelCsvRef = useRef<HTMLInputElement>(null)
  const customVehicleCsvRef = useRef<HTMLInputElement>(null)

  // Exchange rate for customize form
  const [customExchangeRate, setCustomExchangeRate] = useState<number>(1)
  const [customRateLoading, setCustomRateLoading] = useState(false)
  const [customRateUpdatedAt, setCustomRateUpdatedAt] = useState<string>('')
  const [customRateError, setCustomRateError] = useState(false)

  // ── Open PDF modal with resolved package data ────────────────────────────────
  async function openPdfForQuotation(q: Quotation) {
    if (q.customPackageData) { setPdfQuot(q); return }
    if (!q.packageId) { setPdfQuot(q); return }
    try {
      const res = await fetch(`/api/agent/packages/${q.packageId}`)
      const data = await res.json()
      if (data.success && data.package) {
        setPdfQuot({ ...q, customPackageData: data.package })
      } else {
        setPdfQuot(q)
      }
    } catch { setPdfQuot(q) }
  }

  // â”€â”€ View full package details â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function fetchAndViewPackage(q: Quotation) {
    // If quotation has customPackageData already, show that; otherwise fetch real package
    if (q.customPackageData) { setViewPkg(q.customPackageData); return }
    if (!q.packageId) {
      // No packageId â€” build a minimal view from quotation fields
      setViewPkg({ id: '', title: q.packageTitle, destination: q.destination })
      return
    }
    setLoadingPkg(true)
    try {
      const res = await fetch(`/api/agent/packages/${q.packageId}`)
      const data = await res.json()
      if (data.success && data.package) setViewPkg(data.package)
      else setViewPkg({ id: q.packageId, title: q.packageTitle, destination: q.destination })
    } catch { setViewPkg({ id: q.packageId || '', title: q.packageTitle, destination: q.destination }) }
    finally { setLoadingPkg(false) }
  }

  // â”€â”€ Open customize form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function openCustomize(q: Quotation) {
    setShowCustomize(true)
    setCustomHotelCsvMsg(''); setCustomVehicleCsvMsg('')
    if (q.customPackageData) {
      const items = parseDayItems(q.customPackageData.dayWiseItinerary || '')
      setCustomForm(q.customPackageData)
      setCustomDayItems(items)
      setCustomHotelEntries(Array.isArray(q.customPackageData.hotels) ? q.customPackageData.hotels : [])
      setCustomVehicleEntries(Array.isArray(q.customPackageData.vehicles) ? q.customPackageData.vehicles : [])
      setCustomPerks(Array.isArray(q.customPackageData.perks) ? q.customPackageData.perks : [])
      originalCustomFormRef.current = { ...q.customPackageData }
      originalCustomDayItemsRef.current = items.map(i => ({ ...i }))
      return
    }
    if (!q.packageId) {
      const form = { title: q.packageTitle, destination: q.destination }
      setCustomForm(form); setCustomDayItems([]); setCustomHotelEntries([]); setCustomVehicleEntries([]); setCustomPerks([])
      originalCustomFormRef.current = { ...form }; originalCustomDayItemsRef.current = []
      return
    }
    setLoadingPkg(true)
    try {
      const res = await fetch(`/api/agent/packages/${q.packageId}`)
      const data = await res.json()
      if (data.success && data.package) {
        const items = parseDayItems(data.package.dayWiseItinerary || '')
        setCustomForm(data.package)
        setCustomDayItems(items)
        setCustomHotelEntries(Array.isArray(data.package.hotels) ? data.package.hotels : [])
        setCustomVehicleEntries(Array.isArray(data.package.vehicles) ? data.package.vehicles : [])
        setCustomPerks(Array.isArray(data.package.perks) ? data.package.perks : [])
        originalCustomFormRef.current = { ...data.package }
        originalCustomDayItemsRef.current = items.map(i => ({ ...i }))
      } else {
        const form = { title: q.packageTitle, destination: q.destination }
        setCustomForm(form); setCustomDayItems([]); setCustomHotelEntries([]); setCustomVehicleEntries([]); setCustomPerks([])
        originalCustomFormRef.current = { ...form }; originalCustomDayItemsRef.current = []
      }
    } catch {
      const form = { title: q.packageTitle, destination: q.destination }
      setCustomForm(form); setCustomDayItems([]); setCustomHotelEntries([]); setCustomVehicleEntries([]); setCustomPerks([])
      originalCustomFormRef.current = { ...form }; originalCustomDayItemsRef.current = []
    }
    finally { setLoadingPkg(false) }
  }

  // â”€â”€ Save custom package data to quotation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function saveCustomPackage() {
    if (!activeId || !active) return
    setSavingCustom(true)
    try {
      const dayWise = customDayItems.length > 0 ? serializeDayItems(customDayItems) : customForm.dayWiseItinerary || ''
      const merged = { ...customForm, dayWiseItinerary: dayWise, hotels: customHotelEntries, vehicles: customVehicleEntries, perks: customPerks }
      const groupSize = active.groupSize || active.adults || 1
      const newQuotedPrice = merged.pricePerPerson
        ? Number(merged.pricePerPerson) * groupSize
        : undefined
      const patchBody: Record<string, any> = { customPackageData: merged }
      if (newQuotedPrice) patchBody.quotedPrice = newQuotedPrice

      await fetch(`/api/agent/quotations/${activeId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      })
      setQuotations(prev => prev.map(q => q.id === activeId ? {
        ...q,
        customPackageData: merged as PackageData,
        ...(newQuotedPrice ? { quotedPrice: newQuotedPrice, status: q.status === 'pending' ? 'quoted' : q.status } : {}),
      } : q))
      router.push('/dmc-dashboard/quotations')
    } catch { }
    finally { setSavingCustom(false) }
  }

  // â”€â”€ Create a real package in Package Manager from the custom form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function createNewPackage() {
    if (!customForm.title || !customForm.destination) {
      alert('Package title and destination are required.')
      return
    }
    if (!activeId || !active) return
    setCreatingPkg(true)
    try {
      const dayWise = customDayItems.length > 0 ? serializeDayItems(customDayItems) : customForm.dayWiseItinerary || ''
      const merged = { ...customForm, dayWiseItinerary: dayWise, hotels: customHotelEntries, vehicles: customVehicleEntries, perks: customPerks }

      // 1. Create the package in Package Manager
      const pkgRes = await fetch('/api/agent/packages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          title: merged.title,
          destination: merged.destination || '',
          destinationCountry: merged.destinationCountry || 'India',
          overview: merged.overview || '',
          durationDays: Number(merged.durationDays) || 0,
          durationNights: Number(merged.durationNights) || 0,
          pricePerPerson: Number(merged.pricePerPerson) || 0,
          totalPrice: merged.totalPrice || null,
          gst: merged.gst || null,
          currency: merged.currency || 'INR',
          maxGroupSize: Number(merged.maxGroupSize) || 20,
          minGroupSize: Number(merged.minGroupSize) || 1,
          travelType: merged.travelType || '',
          theme: merged.theme || '',
          mood: merged.mood || '',
          starCategory: merged.starCategory || '',
          inclusions: Array.isArray(merged.inclusions) ? merged.inclusions.filter(Boolean) : [],
          exclusions: Array.isArray(merged.exclusions) ? merged.exclusions.filter(Boolean) : [],
          highlights: Array.isArray(merged.highlights) ? merged.highlights.filter(Boolean) : [],
          dayWiseItinerary: dayWise,
          hotels: customHotelEntries,
          vehicles: customVehicleEntries,
          perks: customPerks,
          primaryImageUrl: merged.primaryImageUrl || '',
          seasonalAvailability: merged.seasonalAvailability || 'Year Round',
          paymentPolicy: merged.paymentPolicy || '',
          cancellationPolicy: merged.cancellationPolicy || '',
        }),
      })
      const pkgData = await pkgRes.json()
      if (!pkgRes.ok) throw new Error(pkgData.error || 'Failed to create package')

      // 2. Also save the same data to the quotation so travel agent sees the update
      const groupSize = active.groupSize || active.adults || 1
      const newQuotedPrice = merged.pricePerPerson
        ? Number(merged.pricePerPerson) * groupSize
        : undefined
      const patchBody: Record<string, any> = { customPackageData: merged }
      if (newQuotedPrice) patchBody.quotedPrice = newQuotedPrice

      await fetch(`/api/agent/quotations/${activeId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      })
      setQuotations(prev => prev.map(q => q.id === activeId ? {
        ...q,
        customPackageData: merged as PackageData,
        ...(newQuotedPrice ? { quotedPrice: newQuotedPrice, status: q.status === 'pending' ? 'quoted' : q.status } : {}),
      } : q))

      // Update the original snapshot so the dirty flag resets
      originalCustomFormRef.current = { ...merged }
      originalCustomDayItemsRef.current = customDayItems.map(i => ({ ...i }))

      router.push('/dmc-dashboard/quotations')
    } catch (err: any) {
      alert('Failed to create package: ' + err.message)
    } finally {
      setCreatingPkg(false)
    }
  }

  function downloadCurrentPdf() {
    if (!active) return
    const dayWise = customDayItems.length > 0 ? serializeDayItems(customDayItems) : customForm.dayWiseItinerary || ''
    const groupSize = active.groupSize || active.adults || 1
    const pricePerPerson = Number(customForm.pricePerPerson) || null
    openPackagePdfWindow({
      title: customForm.title || active.packageTitle,
      destination: customForm.destination || active.destination,
      destinationCountry: customForm.destinationCountry,
      heroImage: customForm.primaryImageUrl || undefined,
      refId: active.publicId || active.id.slice(-8).toUpperCase(),
      durationDays: Number(customForm.durationDays) || undefined,
      durationNights: Number(customForm.durationNights) || undefined,
      starCategory: customForm.starCategory || undefined,
      travelType: customForm.travelType || undefined,
      theme: customForm.theme || undefined,
      mood: customForm.mood || undefined,
      currency: (customForm as any).currency || 'INR',
      pricePerPerson: pricePerPerson && !customForm.totalPrice ? pricePerPerson : null,
      totalPrice: Number(customForm.totalPrice) > 0 ? Number(customForm.totalPrice) : null,
      gst: Number(customForm.gst) > 0 ? Number(customForm.gst) : null,
      quotedPriceTotal: active.quotedPrice ? Number(active.quotedPrice) : undefined,
      groupSize,
      adults: active.adults,
      kids: active.kids,
      overview: customForm.overview || undefined,
      highlights: Array.isArray(customForm.highlights) ? customForm.highlights.filter(Boolean) : [],
      inclusions: Array.isArray(customForm.inclusions) ? customForm.inclusions.filter(Boolean) : [],
      exclusions: Array.isArray(customForm.exclusions) ? customForm.exclusions.filter(Boolean) : [],
      dayWiseItinerary: dayWise || undefined,
      hotels: customHotelEntries.length > 0 ? customHotelEntries : undefined,
      vehicles: customVehicleEntries.length > 0 ? customVehicleEntries : undefined,
      paymentPolicy: customForm.paymentPolicy || undefined,
      cancellationPolicy: customForm.cancellationPolicy || undefined,
      specialRequests: active.specialRequests,
      customerName: active.customerName,
      customerEmail: active.customerEmail,
      customerPhone: active.customerPhone,
      preferredDates: active.preferredDates,
      brandName: agentName,
      termsVariant: 'quotation',
    })
  }

  function addCustomDayItem() {
    const idx = customDayItems.length + 1
    setCustomDayItems(prev => [...prev, { id: crypto.randomUUID(), title: `Day ${idx}:`, description: '', tags: [] }])
  }

  // ── Exchange rate for customize form ────────────────────────────────────
  useEffect(() => {
    if (!showCustomize) return
    const currency = (customForm as any).currency || 'INR'
    if (currency === 'INR') { setCustomExchangeRate(1); setCustomRateUpdatedAt(''); setCustomRateError(false); return }
    setCustomRateLoading(true); setCustomRateError(false)
    fetchQuotINRRate(currency)
      .then(({ rate, updatedAt }) => { setCustomExchangeRate(rate); setCustomRateUpdatedAt(updatedAt) })
      .catch(() => { setCustomExchangeRate(1); setCustomRateError(true) })
      .finally(() => setCustomRateLoading(false))
  }, [(customForm as any)?.currency, showCustomize])

  // ── Hotel helpers ────────────────────────────────────────────────────────
  function addCustomHotel() {
    setCustomHotelEntries(prev => [...prev, { id: crypto.randomUUID(), destination: '', nights: 1, hotels: '', mealPlan: 'Breakfast', roomType: '' }])
  }
  function updateCustomHotel(id: string, field: keyof HotelEntry, value: string | number) {
    setCustomHotelEntries(prev => prev.map(h => h.id === id ? { ...h, [field]: value } : h))
  }
  function removeCustomHotel(id: string) {
    setCustomHotelEntries(prev => prev.filter(h => h.id !== id))
  }
  function handleCustomHotelCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value = ''; setCustomHotelCsvMsg('')
    file.text().then(text => {
      const lines = text.replace(/\r\n/g, '\n').split('\n').filter(Boolean)
      if (lines.length < 2) { setCustomHotelCsvMsg('No data rows found.'); return }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
      const added: HotelEntry[] = []
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const row: Record<string, string> = {}
        headers.forEach((h, idx) => { row[h] = vals[idx] || '' })
        const dest = (row['destination'] || row['dest'] || row['city'] || '').trim()
        const hotel = (row['hotel_name'] || row['hotel'] || row['hotels'] || row['name'] || '').trim()
        if (!dest || !hotel) continue
        const nights = parseInt(row['nights'] || '1') || 1
        const mealPlan = MEAL_PLANS.includes(row['meal_plan'] || row['meal'] || '') ? (row['meal_plan'] || row['meal']) : 'Breakfast'
        const roomType = (row['room_type'] || row['room'] || '').trim()
        added.push({ id: crypto.randomUUID(), destination: dest, nights, hotels: hotel, mealPlan, roomType })
      }
      if (added.length === 0) { setCustomHotelCsvMsg('No valid rows found.'); return }
      setCustomHotelEntries(prev => [...prev, ...added])
      setCustomHotelCsvMsg(`✓ ${added.length} hotel${added.length > 1 ? 's' : ''} imported.`)
    }).catch(() => setCustomHotelCsvMsg('Failed to read file.'))
  }

  // ── Vehicle helpers ──────────────────────────────────────────────────────
  function addCustomVehicle() {
    setCustomVehicleEntries(prev => [...prev, { id: crypto.randomUUID(), vehicleType: 'Innova Crysta', seats: 7, route: '', days: 1, notes: '' }])
  }
  function updateCustomVehicle(id: string, field: keyof VehicleEntry, value: string | number) {
    setCustomVehicleEntries(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v))
  }
  function removeCustomVehicle(id: string) {
    setCustomVehicleEntries(prev => prev.filter(v => v.id !== id))
  }
  function handleCustomVehicleCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value = ''; setCustomVehicleCsvMsg('')
    file.text().then(text => {
      const lines = text.replace(/\r\n/g, '\n').split('\n').filter(Boolean)
      if (lines.length < 2) { setCustomVehicleCsvMsg('No data rows found.'); return }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
      const added: VehicleEntry[] = []
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const row: Record<string, string> = {}
        headers.forEach((h, idx) => { row[h] = vals[idx] || '' })
        const vType = (row['vehicle_type'] || row['vehicle'] || row['type'] || '').trim()
        if (!vType) continue
        const seats = parseInt(row['seats'] || '4') || 4
        const route = (row['route'] || row['transfer'] || '').trim()
        const days = parseInt(row['days'] || '1') || 1
        const notes = (row['notes'] || row['remarks'] || '').trim()
        added.push({ id: crypto.randomUUID(), vehicleType: vType, seats, route, days, notes })
      }
      if (added.length === 0) { setCustomVehicleCsvMsg('No valid rows found.'); return }
      setCustomVehicleEntries(prev => [...prev, ...added])
      setCustomVehicleCsvMsg(`✓ ${added.length} vehicle${added.length > 1 ? 's' : ''} imported.`)
    }).catch(() => setCustomVehicleCsvMsg('Failed to read file.'))
  }

  // ── Image upload ─────────────────────────────────────────────────────────
  async function handleCustomImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setCustomImgUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', '/packages')
      fd.append('fileName', `custom_${agentId}_${Date.now()}`)
      const res = await fetch('/api/imagekit/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.success) setCustomForm(p => ({ ...p, primaryImageUrl: data.url }))
    } catch (e) { console.error(e) } finally {
      setCustomImgUploading(false)
      if (customImgInputRef.current) customImgInputRef.current.value = ''
    }
  }

  // ── Perks helpers ────────────────────────────────────────────────────────
  function toggleCustomPerk(label: string) {
    setCustomPerks(prev => prev.includes(label) ? prev.filter(p => p !== label) : [...prev, label])
  }
  function addCustomPerk() {
    const t = customPerkInput.trim()
    if (!t || customPerks.includes(t)) { setCustomPerkInput(''); return }
    setCustomPerks(prev => [...prev, t]); setCustomPerkInput('')
  }

  const fetchQuotations = useCallback(async () => {
    try {
      const url = subAgentId
        ? `/api/agent/quotations?subAgentId=${subAgentId}`
        : `/api/agent/quotations?agentId=${agentId}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        const raw: Quotation[] = data.quotations.map((q: any) => ({ ...q, messages: q.messages || [] }))

        // Resolve subAgentName for quotations where it is missing but subAgentId exists
        const missingIds = [...new Set(
          raw.filter(q => !q.subAgentName && q.subAgentId).map(q => q.subAgentId)
        )]
        const nameMap: Record<string, string> = {}
        await Promise.all(
          missingIds.map(async id => {
            // DMC generated this quote via ?subAgent= param — use the agent's own name
            if (id === agentId) { nameMap[id] = agentName; return }
            try {
              const r = await fetch(`/api/agent/subagents/${id}`)
              const d = await r.json()
              if (d.success && d.subAgent?.name) nameMap[id] = d.subAgent.name
            } catch { }
          })
        )
        setQuotations(raw.map(q =>
          (!q.subAgentName && q.subAgentId && nameMap[q.subAgentId])
            ? { ...q, subAgentName: nameMap[q.subAgentId] }
            : q
        ))
      }
    } catch { } finally { setLoading(false) }
  }, [agentId, subAgentId])

  useEffect(() => { fetchQuotations() }, [fetchQuotations])

  // Auto-open customize form when navigated to /dmc-dashboard/quotations/[id]
  useEffect(() => {
    if (!openCustomizeId || loading || quotations.length === 0 || autoOpenDoneRef.current) return
    const q = quotations.find(x => x.id === openCustomizeId)
    if (q) {
      autoOpenDoneRef.current = true
      skipNextResetRef.current = true
      setActiveId(q.id)
      openCustomize(q)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCustomizeId, loading, quotations])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeId, quotations])

  // Reset package states when switching quotations (skip when auto-opening via URL)
  useEffect(() => {
    if (skipNextResetRef.current) { skipNextResetRef.current = false; return }
    setShowCustomize(false)
    setViewPkg(null)
    setCustomDayItems([])
  }, [activeId])

  const active = quotations.find(q => q.id === activeId) || null

  // â”€â”€ Send message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function sendMessage() {
    if (!messageText.trim() || !activeId) return
    setSending(true)
    const res = await fetch(`/api/agent/quotations/${activeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'message', senderId: currentUserId, senderRole: 'dmc',
        senderName: agentName, text: messageText.trim(),
      }),
    })
    const data = await res.json()
    if (data.success) {
      setQuotations(prev => prev.map(q => q.id === activeId
        ? { ...q, messages: [...q.messages, data.message], status: q.status === 'pending' ? 'in_discussion' : q.status }
        : q
      ))
      setMessageText('')
    }
    setSending(false)
  }

  // â”€â”€ Set / update quoted price â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function savePrice() {
    if (!activeId || !priceInput) return
    const newPrice = Number(priceInput)
    if (isNaN(newPrice) || newPrice <= 0) return
    setSavingPrice(true)

    const currentPrice = active?.quotedPrice
    const isUpdate = currentPrice && currentPrice !== newPrice

    // Save price + status â†’ quoted
    await fetch(`/api/agent/quotations/${activeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quotedPrice: newPrice, status: 'quoted' }),
    })

    // Auto-send a chat notification so travel agent sees the change
    const msgText = isUpdate
      ? `ðŸ’° Quote updated: â‚¹${newPrice.toLocaleString('en-IN')} (was â‚¹${currentPrice!.toLocaleString('en-IN')})`
      : `ðŸ’° Quote set: â‚¹${newPrice.toLocaleString('en-IN')} for ${active?.packageTitle}`

    const msgRes = await fetch(`/api/agent/quotations/${activeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'message', senderId: currentUserId, senderRole: 'dmc',
        senderName: agentName, text: msgText,
      }),
    })
    const msgData = await msgRes.json()

    setQuotations(prev => prev.map(q => {
      if (q.id !== activeId) return q
      return {
        ...q,
        quotedPrice: newPrice,
        status: 'quoted',
        messages: msgData.success ? [...q.messages, msgData.message] : q.messages,
      }
    }))
    setEditingPrice(false)
    setSavingPrice(false)
  }

  // â”€â”€ Update status only â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function updateStatus(status: string) {
    if (!activeId) return
    await fetch(`/api/agent/quotations/${activeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setQuotations(prev => prev.map(q => q.id === activeId ? { ...q, status } : q))
  }

  // â”€â”€ Convert quotation â†’ booking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function convertToBooking() {
    if (!active || converting) return
    setConverting(true)
    try {
      const res = await fetch('/api/agent/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          agentSlug,
          packageTitle: active.packageTitle,
          destination: active.destination,
          customerName: active.customerName,
          customerEmail: active.customerEmail || '',
          customerPhone: active.customerPhone || '',
          preferredDates: active.preferredDates || '',
          groupSize: active.groupSize || 1,
          adults: active.adults || 1,
          kids: active.kids || 0,
          rooms: active.rooms || 1,
          specialRequests: active.specialRequests || '',
          subAgentId: active.subAgentId,
          quotedPrice: active.quotedPrice || null,
          bookingValue: active.quotedPrice || null,
        }),
      })
      const bookingData = await res.json()
      if (!res.ok) throw new Error(bookingData.error || 'Failed to create booking')

      // Mark quotation as converted + send system message
      await fetch(`/api/agent/quotations/${active.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'converted' }),
      })
      const msgRes = await fetch(`/api/agent/quotations/${active.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'message', senderId: currentUserId, senderRole: 'dmc',
          senderName: agentName,
          text: `âœ… Booking confirmed! This quotation has been converted to a booking${active.quotedPrice ? ` for â‚¹${active.quotedPrice.toLocaleString('en-IN')}` : ''}.`,
        }),
      })
      const msgData = await msgRes.json()

      setConvertedIds(prev => new Set([...prev, active.id]))
      setQuotations(prev => prev.map(q => {
        if (q.id !== active.id) return q
        return {
          ...q,
          status: 'converted',
          messages: msgData.success ? [...q.messages, msgData.message] : q.messages,
        }
      }))
    } catch (err: any) {
      alert('Failed to create booking: ' + err.message)
    } finally {
      setConverting(false)
    }
  }

  // ── Open a standalone print window with the full quotation ──────────────────────
  function openPrintWindow(q: Quotation) {
    const pkg = q.customPackageData
    const groupSize = q.groupSize || 1
    const pricePerPerson = pkg?.pricePerPerson
      || (q.quotedPrice && groupSize > 1 ? Math.round(Number(q.quotedPrice) / groupSize) : null)
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
      pricePerPerson: pricePerPerson ?? undefined,
      quotedPriceTotal: q.quotedPrice ? Number(q.quotedPrice) : undefined,
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
      brandName: agentName,
      termsVariant: 'quotation',
    })
  }

  // â”€â”€ WhatsApp quotation share â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function shareOnWhatsApp(q: Quotation) {
    const price = q.quotedPrice ? `â‚¹${Number(q.quotedPrice).toLocaleString('en-IN')}` : 'To be confirmed'
    const lines = [
      `ðŸŒ *Travel Quotation*`,
      ``,
      `Hello ${q.customerName},`,
      ``,
      `Here is your travel quotation from *${agentName}*:`,
      ``,
      `ðŸ“¦ *Package:* ${q.packageTitle}`,
      `ðŸ“ *Destination:* ${q.destination}`,
      `ðŸ‘¥ *Travellers:* ${q.groupSize} pax (${q.adults} adults${q.kids ? `, ${q.kids} kids` : ''})`,
      q.preferredDates ? `ðŸ“… *Dates:* ${q.preferredDates}` : null,
      ``,
      `ðŸ’° *Quoted Price:* ${price}`,
      ``,
      q.specialRequests ? `ðŸ“ *Special Notes:* ${q.specialRequests}\n` : null,
      `For more details or to confirm your booking, please reply to this message.`,
      ``,
      `Thank you for choosing *${agentName}* âœˆï¸`,
    ].filter(Boolean).join('\n')

    const phone = q.customerPhone?.replace(/\D/g, '')
    const encoded = encodeURIComponent(lines)
    const url = phone
      ? `https://wa.me/${phone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`
    window.open(url, '_blank')
  }

  // â”€â”€ Derived â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const countByStatus = quotations.reduce((acc, q) => {
    acc[q.status] = (acc[q.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const subAgentOptions = Array.from(new Set(quotations.map(q => q.subAgentName).filter(Boolean))).sort()
  const destOptions = Array.from(new Set(quotations.map(q => q.destination).filter(Boolean))).sort()
  const hasActiveFilters = filterStatus !== 'all' || filterDate !== 'all' || filterSubAgent !== 'all' || filterDest !== 'all' || search

  const filtered = quotations.filter(q => {
    if (filterStatus !== 'all' && q.status !== filterStatus) return false

    if (filterDate !== 'all') {
      const now = Date.now()
      const created = q.createdAt ? q.createdAt.seconds * 1000 : 0
      if (filterDate === 'today') {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
        if (created < todayStart.getTime()) return false
      } else if (filterDate === '7d') {
        if (created < now - 7 * 24 * 60 * 60 * 1000) return false
      } else if (filterDate === '30d') {
        if (created < now - 30 * 24 * 60 * 60 * 1000) return false
      }
    }

    if (filterSubAgent !== 'all' && q.subAgentName !== filterSubAgent) return false
    if (filterDest !== 'all' && q.destination !== filterDest) return false

    if (search) {
      const s = search.toLowerCase()
      return (q.customerName?.toLowerCase().includes(s) ||
        q.subAgentName?.toLowerCase().includes(s) ||
        q.destination?.toLowerCase().includes(s) ||
        q.packageTitle?.toLowerCase().includes(s) ||
        q.publicId?.toLowerCase().includes(s)) ?? false
    }
    return true
  })

  const isClosed = active && ['converted', 'rejected'].includes(active.status)

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  return (
    <>
    <div className="flex gap-4 h-[calc(100vh-160px)] min-h-[600px]">

      {/* PROPOSALS TABLE */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden min-w-0">

        {/* Filter bar */}
        <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search customer, package, destination..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>

            <div className="flex gap-1">
              {(['all', 'today', '7d', '30d'] as const).map(d => (
                <button key={d} onClick={() => setFilterDate(d)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterDate === d ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {d === 'all' ? 'All' : d === 'today' ? 'Today' : d === '7d' ? '7d' : '30d'}
                </button>
              ))}
            </div>

            <div className="relative">
              <select value={filterSubAgent} onChange={e => setFilterSubAgent(e.target.value)}
                className="appearance-none text-xs border border-gray-200 rounded-xl px-3 py-2 pr-7 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white text-gray-700">
                <option value="all">All agents</option>
                {subAgentOptions.map(sa => <option key={sa} value={sa}>{sa}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select value={filterDest} onChange={e => setFilterDest(e.target.value)}
                className="appearance-none text-xs border border-gray-200 rounded-xl px-3 py-2 pr-7 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white text-gray-700">
                <option value="all">All destinations</option>
                {destOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>

            {hasActiveFilters && (
              <button
                onClick={() => { setSearch(''); setFilterStatus('all'); setFilterDate('all'); setFilterSubAgent('all'); setFilterDest('all') }}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <X className="w-3 h-3" />Clear
              </button>
            )}
          </div>

          {false && <div className="flex gap-1.5 flex-wrap mt-2.5">
            <button onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${filterStatus === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
              All ({quotations.length})
            </button>
            {Object.keys(STATUS_CONFIG).map(s => (countByStatus[s] || 0) > 0 ? (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${filterStatus === s ? 'bg-primary text-white' : STATUS_CONFIG[s].color}`}>
                {STATUS_CONFIG[s].label} ({countByStatus[s]})
              </button>
            ) : null)}
          </div>}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-400">No proposals found</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left whitespace-nowrap">Proposal #</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Customer</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Created At</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Proposal Name</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">{subAgentId ? 'To' : 'From'}</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Travel Date</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Pax</th>
                  {false && <th className="px-4 py-3 text-right whitespace-nowrap">Price Quoted</th>}
                  {false && <th className="px-4 py-3 text-center whitespace-nowrap">Status</th>}
                  <th className="px-4 py-3 text-center whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(q => {
                  const cfg = STATUS_CONFIG[q.status] || STATUS_CONFIG.pending
                  const isSelected = activeId === q.id
                  return (
                    <tr
                      key={q.id}
                      onClick={() => { setActiveId(q.id); setEditingPrice(false); setPriceInput(String(q.quotedPrice || '')) }}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-gray-50 border-l-2 border-l-transparent'}`}
                    >
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {q.publicId || q.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-gray-900">{q.customerName}</p>
                        {q.customerEmail && <p className="text-xs text-gray-400 truncate max-w-[160px]">{q.customerEmail}</p>}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {(() => { const ts = formatDate(q.createdAt); return ts ? (<><p className="text-xs text-gray-700">{ts.date}</p><p className="text-[11px] text-gray-400">{ts.time}</p></>) : <span className="text-gray-300">—</span> })()}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-gray-800 leading-snug">{q.packageTitle}</p>
                        <p className="text-xs text-gray-400">{q.destination}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        {subAgentId
                          ? (toName
                              ? <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-100 text-xs font-semibold px-2.5 py-1 rounded-full">
                                  <User className="w-3 h-3" />
                                  {toName}
                                </span>
                              : <span className="text-gray-300 text-xs">—</span>
                            )
                          : (q.subAgentName
                              ? <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-100 text-xs font-semibold px-2.5 py-1 rounded-full">
                                  <User className="w-3 h-3" />
                                  {q.subAgentName}
                                </span>
                              : <span className="text-gray-300 text-xs">—</span>
                            )
                        }
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="text-xs text-gray-700">{formatTravelDate(q.preferredDates) || <span className="text-gray-300">—</span>}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(q.adults > 0) && <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{q.adults}A</span>}
                          {(q.kids > 0) && <span className="text-[10px] font-semibold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">{q.kids}C</span>}
                          {(q.infants ?? 0) > 0 && <span className="text-[10px] font-semibold bg-pink-50 text-pink-500 px-1.5 py-0.5 rounded">{q.infants}I</span>}
                          {(!q.adults && !q.kids && !(q.infants ?? 0)) && <span className="text-gray-300 text-xs">—</span>}
                        </div>
                      </td>
                      {false && <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {q.quotedPrice
                          ? <span className="text-sm font-bold text-emerald-700">&#8377;{Number(q.quotedPrice).toLocaleString('en-IN')}</span>
                          : <span className="text-gray-400">-</span>}
                      </td>}
                      {false && <td className="px-4 py-3.5 text-center">
                        <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </td>}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center gap-2 justify-center whitespace-nowrap">
                          {false && <button
                            onClick={() => {
                              setActiveId(q.id)
                              setEditingPrice(false)
                              setPriceInput(String(q.quotedPrice || ''))
                              setChatPanelOpen(true)
                              setDetailPanelOpen(false)
                            }}
                            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                              isSelected && chatPanelOpen
                                ? 'bg-primary text-white shadow-sm'
                                : 'bg-primary/10 text-primary hover:bg-primary/20'
                            }`}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Chat
                            {q.messages.length > 0 && (
                              <span className={`text-[10px] font-bold px-1 rounded-full ${isSelected && chatPanelOpen ? 'bg-white/30 text-white' : 'bg-primary/20 text-primary'}`}>
                                {q.messages.length}
                              </span>
                            )}
                          </button>}
                          <button
                            onClick={() => router.push(subAgentId ? `/travel-agent-dashboard/quotations/${q.id}` : `/dmc-dashboard/quotations/${q.id}`)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* CHAT PANEL - 20% width */}
      {chatPanelOpen && active && (
        <div className="w-[20%] min-w-[240px] max-w-[340px] flex-shrink-0 flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden">

          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{active.customerName}</p>
              <p className="text-xs text-gray-400 truncate">{active.packageTitle}</p>
              <span className={`mt-1 inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_CONFIG[active.status]?.color || ''}`}>
                {STATUS_CONFIG[active.status]?.label}
              </span>
            </div>
            <button
              onClick={() => { setChatPanelOpen(false); setActiveId(null) }}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {active.messages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <MessageSquare className="w-8 h-8 text-gray-200" />
                <p className="text-xs text-gray-400">No messages yet</p>
                <p className="text-[10px] text-gray-300">Send the first message below</p>
              </div>
            ) : (
              active.messages.map(msg => {
                if (msg.senderRole === 'system' || msg.text.startsWith('💰') || msg.text.startsWith('✅')) {
                  return (
                    <div key={msg.id} className="flex justify-center">
                      <span className="bg-gray-100 text-gray-500 text-[10px] px-2.5 py-1 rounded-full text-center leading-relaxed max-w-full">
                        {msg.text}
                      </span>
                    </div>
                  )
                }
                const isDmc = msg.senderRole === 'dmc'
                return (
                  <div key={msg.id} className={`flex gap-2 ${isDmc ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${isDmc ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {msg.senderName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className={`max-w-[80%] flex flex-col ${isDmc ? 'items-end' : 'items-start'}`}>
                      <div className={`px-2.5 py-2 rounded-xl text-xs leading-relaxed ${isDmc ? 'bg-primary text-white rounded-tr-sm' : 'bg-gray-100 text-gray-900 rounded-tl-sm'}`}>
                        {msg.text}
                      </div>
                      <p className="text-[9px] text-gray-400 mt-0.5 px-0.5">
                        {msg.senderName} · {formatTime(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {!isClosed ? (
            <div className="px-3 py-3 border-t border-gray-100 flex-shrink-0">
              <div className="flex gap-1.5">
                <textarea
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  rows={2}
                  placeholder="Message... (Enter to send)"
                  className="flex-1 px-2.5 py-2 border border-gray-200 rounded-xl text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !messageText.trim()}
                  className="px-2.5 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 self-end flex-shrink-0"
                >
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="px-3 py-2.5 border-t border-gray-100 text-center text-[10px] text-gray-400 flex-shrink-0">
              {active.status === 'converted' ? 'Converted to booking' : 'Rejected'}
            </div>
          )}
        </div>
      )}
    </div>

    {/* VIEW PROPOSAL - Full-Screen Overlay */}
    {detailPanelOpen && active && (
      <div className="fixed left-0 md:left-72 right-0 top-0 bottom-0 z-[60] flex flex-col bg-[#f4f5f9]">

        <div className="flex items-center justify-between bg-white border-b border-gray-100 px-5 py-3 flex-shrink-0">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <button
              onClick={() => setDetailPanelOpen(false)}
              className="flex items-center gap-1.5 text-gray-500 hover:text-primary hover:bg-primary/5 px-2.5 py-1.5 rounded-lg transition-colors text-sm font-semibold"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
              Back
            </button>
            <div className="h-4 w-px bg-gray-200" />
            <h3 className="font-bold text-gray-900 truncate">{active.customerName}</h3>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${STATUS_CONFIG[active.status]?.color || ''}`}>
              {STATUS_CONFIG[active.status]?.label}
            </span>
            {active.publicId && (
              <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md flex-shrink-0">
                {active.publicId}
              </span>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0 flex-wrap">
            {active.customerEmail && (
              <a href={`mailto:${active.customerEmail}`}
                className="flex items-center gap-1.5 text-sm border border-gray-200 bg-white text-gray-600 px-3 py-1.5 rounded-xl hover:border-primary hover:text-primary transition-colors font-medium">
                <Mail className="w-4 h-4" />Email
              </a>
            )}
            {active.customerPhone && (
              <a href={`https://wa.me/${active.customerPhone.replace(/\D/g, '')}`} target="_blank"
                className="flex items-center gap-1.5 text-sm border border-green-200 bg-green-50 text-green-700 px-3 py-1.5 rounded-xl hover:bg-green-100 transition-colors font-medium">
                WhatsApp
              </a>
            )}
            <button onClick={() => shareOnWhatsApp(active)}
              className="flex items-center gap-1.5 text-sm border border-green-300 bg-green-500 text-white px-3 py-1.5 rounded-xl hover:bg-green-600 transition-colors font-semibold shadow-sm">
              <Share2 className="w-4 h-4" />Share Quote
            </button>
            <button onClick={() => openPdfForQuotation(active)}
              className="flex items-center gap-1.5 text-sm border border-primary bg-primary text-white px-3 py-1.5 rounded-xl hover:bg-primary/90 transition-colors font-semibold shadow-sm">
              <FileText className="w-4 h-4" />PDF
            </button>
            <button onClick={() => fetchAndViewPackage(active)} disabled={loadingPkg}
              className="flex items-center gap-1.5 text-sm border border-indigo-200 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition-colors font-medium">
              {loadingPkg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              {active.customPackageData ? 'View Custom' : 'View Package'}
            </button>
            {!isClosed && (
              <button onClick={() => openCustomize(active)}
                className="flex items-center gap-1.5 text-sm border border-amber-200 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-xl hover:bg-amber-100 transition-colors font-medium">
                <FileEdit className="w-4 h-4" />
                {active.customPackageData ? 'Edit Custom' : 'Customize'}
              </button>
            )}
            {active.customPackageData && (
              <span className="text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full self-center">Customized</span>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 bg-white flex-shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              {active.quotedPrice && !editingPrice ? (
                <div className="flex items-center gap-2">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-emerald-600" />
                    <span className="text-lg font-bold text-emerald-700">{Number(active.quotedPrice).toLocaleString('en-IN')}</span>
                    <span className="text-xs text-emerald-600 font-medium">quoted</span>
                  </div>
                  {!isClosed && (
                    <button onClick={() => { setEditingPrice(true); setPriceInput(String(active.quotedPrice || '')) }}
                      className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : !isClosed ? (
                <div className="flex items-center gap-2">
                  {editingPrice && (
                    <button onClick={() => setEditingPrice(false)} className="p-1 text-gray-400 hover:text-gray-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">
                    {editingPrice ? 'Update price' : 'Set quote price'}
                  </label>
                  <div className="relative">
                    <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                    <input type="number" value={priceInput} onChange={e => setPriceInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') savePrice() }}
                      placeholder="e.g. 58000"
                      className="pl-7 pr-3 py-1.5 w-32 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <button onClick={savePrice} disabled={savingPrice || !priceInput}
                    className="text-xs font-semibold bg-primary text-white px-3 py-1.5 rounded-xl hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap">
                    {savingPrice ? 'Saving...' : editingPrice ? 'Update' : 'Set & Notify'}
                  </button>
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {!isClosed && ['in_discussion', 'accepted', 'rejected'].map(s => (
                <button key={s} disabled={active.status === s} onClick={() => updateStatus(s)}
                  className={`text-sm font-semibold px-4 py-2 rounded-xl border transition-colors disabled:opacity-60 ${
                    active.status === s ? `${STATUS_CONFIG[s]?.color || ''} border-transparent shadow-sm` : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                  }`}>
                  {STATUS_CONFIG[s]?.label}
                </button>
              ))}
              {active.status !== 'converted' && active.status !== 'rejected' && (
                <button onClick={convertToBooking} disabled={converting}
                  className="flex items-center gap-2 text-sm font-bold bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-5 py-2 rounded-xl transition-colors shadow-sm ml-1">
                  {converting ? <><Loader2 className="w-4 h-4 animate-spin" />Converting...</> : <><BookCheck className="w-4 h-4" />Mark as Booked</>}
                </button>
              )}
              {active.status === 'converted' && (
                <span className="flex items-center gap-2 text-sm font-bold bg-purple-100 text-purple-700 px-5 py-2 rounded-xl">
                  <BookCheck className="w-4 h-4" />Booked
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">

          <div className="w-72 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto p-5 space-y-4">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Customer</p>
              <div className="space-y-1 text-sm text-gray-700">
                <p className="font-semibold">{active.customerName}</p>
                {active.customerEmail && <p className="text-xs text-gray-500">{active.customerEmail}</p>}
                {active.customerPhone && <p className="text-xs text-gray-500">{active.customerPhone}</p>}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Trip Details</p>
              <div className="space-y-1.5 text-sm text-gray-700">
                <div className="flex items-center gap-2"><Package className="w-3.5 h-3.5 text-gray-400" /><span>{active.packageTitle}</span></div>
                <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-gray-400" /><span>{active.destination}</span></div>
                <div className="flex items-center gap-2"><Users className="w-3.5 h-3.5 text-gray-400" /><span>{active.groupSize} pax{active.adults ? ` (${active.adults}A${active.kids ? ` ${active.kids}K` : ''})` : ''}</span></div>
                {active.preferredDates && <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-gray-400" /><span>{active.preferredDates}</span></div>}
                <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-gray-400" /><span>via {active.subAgentName}</span></div>
              </div>
            </div>
            {active.specialRequests && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Special Requests</p>
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3 leading-relaxed">{active.specialRequests}</p>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden bg-[#f4f5f9]">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              {active.messages.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="w-full max-w-md bg-gradient-to-br from-primary/5 to-blue-50 border border-primary/15 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-base">&#9992;</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Journaies</p>
                        <p className="text-[10px] text-gray-400">New Enquiry · Automated</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mb-3">New booking enquiry received!</p>
                    <div className="space-y-1.5 bg-white/70 rounded-xl p-3 text-xs text-gray-600 mb-3">
                      <div className="flex gap-2"><span className="font-semibold text-gray-800 w-24 shrink-0">Customer:</span><span>{active.customerName}</span></div>
                      <div className="flex gap-2"><span className="font-semibold text-gray-800 w-24 shrink-0">Package:</span><span>{active.packageTitle}</span></div>
                      <div className="flex gap-2"><span className="font-semibold text-gray-800 w-24 shrink-0">Destination:</span><span>{active.destination}</span></div>
                      <div className="flex gap-2"><span className="font-semibold text-gray-800 w-24 shrink-0">Group Size:</span><span>{active.groupSize} traveller{active.groupSize !== 1 ? 's' : ''}</span></div>
                      {active.preferredDates && <div className="flex gap-2"><span className="font-semibold text-gray-800 w-24 shrink-0">Dates:</span><span>{active.preferredDates}</span></div>}
                    </div>
                    <p className="text-xs text-gray-500">Reply below to start the conversation.</p>
                  </div>
                </div>
              ) : (
                active.messages.map(msg => {
                  if (msg.senderRole === 'system' || msg.text.startsWith('💰') || msg.text.startsWith('✅')) {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <span className="bg-white text-gray-500 text-xs px-3 py-1.5 rounded-full border border-gray-200">
                          {msg.text} · {formatTime(msg.timestamp)}
                        </span>
                      </div>
                    )
                  }
                  const isDmc = msg.senderRole === 'dmc'
                  return (
                    <div key={msg.id} className={`flex gap-2.5 ${isDmc ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isDmc ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'}`}>
                        {msg.senderName?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className={`max-w-[72%] flex flex-col ${isDmc ? 'items-end' : 'items-start'}`}>
                        <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${isDmc ? 'bg-primary text-white rounded-tr-sm' : 'bg-white text-gray-900 rounded-tl-sm shadow-sm border border-gray-100'}`}>
                          {msg.text}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 px-1">{msg.senderName} · {formatTime(msg.timestamp)}</p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {!isClosed ? (
              <div className="px-6 py-4 border-t border-gray-200 bg-white flex-shrink-0">
                <div className="flex gap-2">
                  <textarea value={messageText} onChange={e => setMessageText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    rows={2} placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                    className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  <button onClick={sendMessage} disabled={sending || !messageText.trim()}
                    className="px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5 self-end">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-6 py-3 border-t border-gray-200 bg-white text-center text-xs text-gray-400 flex-shrink-0">
                {active.status === 'converted' ? 'This quotation has been converted to a booking.' : 'This quotation has been rejected.'}
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* â”€â”€ Package View Full-Screen Overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
    {viewPkg && active && (() => {
      const groupSize = active.groupSize || active.adults || 1
      const viewTotalPrice = viewPkg.pricePerPerson ? Number(viewPkg.pricePerPerson) * groupSize : 0
      const isCustom = !!active.customPackageData
      return (
        <div className="fixed left-0 md:left-72 right-0 top-0 bottom-0 z-[60] flex flex-col bg-[#f4f5f9]">

          {/* Top bar */}
          <div className="flex items-center justify-between bg-white border-b border-gray-100 px-4 py-2.5 flex-shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewPkg(null)}
                className="flex items-center gap-1.5 text-gray-500 hover:text-indigo-700 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors text-sm font-semibold"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                Back
              </button>
              <div className="h-4 w-px bg-gray-200" />
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isCustom ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                {isCustom ? 'Custom Package' : 'Original Package'}
              </span>
              <p className="text-sm font-semibold text-gray-700 truncate max-w-xs hidden sm:block">{viewPkg.title || 'â€”'}</p>
            </div>
            <div className="flex items-center gap-2">
              {!isClosed && (
                <button
                  onClick={() => { setViewPkg(null); openCustomize(active) }}
                  className="flex items-center gap-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-1.5 rounded-lg transition-colors"
                >
                  <FileEdit className="w-3.5 h-3.5" />
                  {isCustom ? 'Edit Custom' : 'Customize for this Quote'}
                </button>
              )}
              <button
                onClick={() => setViewPkg(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Two-column body */}
          <div className="flex flex-1 overflow-hidden">

            {/* Left: read-only details */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 min-w-0">

              {/* â”€â”€ Title card â”€â”€ */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className={`px-5 pt-5 pb-4 ${viewPkg.primaryImageUrl ? 'relative h-48 flex flex-col justify-end' : 'bg-gradient-to-r from-indigo-600 to-purple-600'}`}>
                  {viewPkg.primaryImageUrl && (
                    <>
                      <img src={viewPkg.primaryImageUrl} alt={viewPkg.title} className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    </>
                  )}
                  <div className="relative">
                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Package Title</p>
                    <h2 className="text-2xl font-bold text-white leading-snug">{viewPkg.title || 'â€”'}</h2>
                    {(viewPkg.destination) && (
                      <p className="text-sm text-white/80 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5" />{viewPkg.destination}{viewPkg.destinationCountry ? `, ${viewPkg.destinationCountry}` : ''}
                      </p>
                    )}
                  </div>
                </div>
                {(viewPkg.durationDays || viewPkg.starCategory || viewPkg.travelType || viewPkg.theme || viewPkg.mood) && (
                  <div className="flex flex-wrap gap-2 px-5 py-3">
                    {(viewPkg.durationDays || viewPkg.durationNights) && (
                      <span className="flex items-center gap-1 bg-gray-100 text-gray-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                        <Clock className="w-3 h-3" />{viewPkg.durationDays || '?'}D / {viewPkg.durationNights || '?'}N
                      </span>
                    )}
                    {viewPkg.starCategory && (
                      <span className="flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                        <Star className="w-3 h-3" />{viewPkg.starCategory}
                      </span>
                    )}
                    {viewPkg.travelType && <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">{viewPkg.travelType}</span>}
                    {viewPkg.theme && <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-full">{viewPkg.theme}</span>}
                    {viewPkg.mood && <span className="bg-pink-50 text-pink-700 text-xs font-semibold px-2.5 py-1 rounded-full">{viewPkg.mood}</span>}
                  </div>
                )}
              </div>

              {/* â”€â”€ Basic Info â”€â”€ */}
              {(viewPkg.destination || viewPkg.durationDays || viewPkg.minGroupSize || viewPkg.seasonalAvailability) && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                    <span className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-sm">ðŸ“</span>
                    <p className="text-sm font-bold text-gray-800">Basic Info</p>
                  </div>
                  <div className="p-5 grid grid-cols-2 gap-4">
                    {[
                      { label: 'Destination', value: viewPkg.destination },
                      { label: 'Country', value: viewPkg.destinationCountry },
                      { label: 'Days', value: viewPkg.durationDays },
                      { label: 'Nights', value: viewPkg.durationNights },
                      { label: 'Min Group', value: viewPkg.minGroupSize },
                      { label: 'Max Group', value: viewPkg.maxGroupSize },
                      { label: 'Season', value: viewPkg.seasonalAvailability, full: true },
                    ].filter(f => f.value).map(({ label, value, full }) => (
                      <div key={label} className={full ? 'col-span-2' : ''}>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                        <p className="text-sm font-semibold text-gray-800">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* â”€â”€ Package Type â”€â”€ */}
              {(viewPkg.travelType || viewPkg.starCategory || viewPkg.theme || viewPkg.mood) && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                    <span className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-sm">ðŸŽ¯</span>
                    <p className="text-sm font-bold text-gray-800">Package Type</p>
                  </div>
                  <div className="p-5 space-y-4">
                    {viewPkg.travelType && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2">Travel Type</p>
                        <div className="flex flex-wrap gap-2">
                          {TRAVEL_TYPES.map(t => (
                            <span key={t} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${viewPkg.travelType === t ? 'bg-purple-600 text-white border-purple-600' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {viewPkg.starCategory && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2">Star Category</p>
                        <div className="flex flex-wrap gap-2">
                          {STAR_CATEGORIES.map(s => (
                            <span key={s} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${viewPkg.starCategory === s ? 'bg-amber-500 text-white border-amber-500' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {viewPkg.theme && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2">Theme</p>
                        <div className="flex flex-wrap gap-2">
                          {THEMES.map(t => (
                            <span key={t} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${viewPkg.theme === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {viewPkg.mood && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2">Mood / Vibe</p>
                        <div className="flex flex-wrap gap-2">
                          {MOODS.map(m => (
                            <span key={m} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${viewPkg.mood === m ? 'bg-pink-500 text-white border-pink-500' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>{m}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* â”€â”€ Description & Content â”€â”€ */}
              {(viewPkg.overview || (Array.isArray(viewPkg.highlights) && viewPkg.highlights.filter(Boolean).length > 0) ||
                (Array.isArray(viewPkg.inclusions) && viewPkg.inclusions.filter(Boolean).length > 0) ||
                (Array.isArray(viewPkg.exclusions) && viewPkg.exclusions.filter(Boolean).length > 0)) && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                    <span className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-sm">ðŸ“</span>
                    <p className="text-sm font-bold text-gray-800">Description & Content</p>
                  </div>
                  <div className="p-5 space-y-5">
                    {viewPkg.overview && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1.5">Overview</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{viewPkg.overview}</p>
                      </div>
                    )}
                    {Array.isArray(viewPkg.highlights) && viewPkg.highlights.filter(Boolean).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2">Highlights</p>
                        <ul className="space-y-1.5">
                          {viewPkg.highlights.filter(Boolean).map((h, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                              <span className="text-indigo-400 mt-0.5 flex-shrink-0">âœ¦</span>{h}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(Array.isArray(viewPkg.inclusions) && viewPkg.inclusions.filter(Boolean).length > 0 ||
                      Array.isArray(viewPkg.exclusions) && viewPkg.exclusions.filter(Boolean).length > 0) && (
                      <div className="grid grid-cols-2 gap-4">
                        {Array.isArray(viewPkg.inclusions) && viewPkg.inclusions.filter(Boolean).length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-green-700 mb-2">âœ“ Inclusions</p>
                            <ul className="space-y-1">
                              {viewPkg.inclusions.filter(Boolean).map((inc, i) => (
                                <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                                  <span className="text-green-500 mt-0.5 flex-shrink-0">â€¢</span>{inc}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {Array.isArray(viewPkg.exclusions) && viewPkg.exclusions.filter(Boolean).length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-red-500 mb-2">âœ— Exclusions</p>
                            <ul className="space-y-1">
                              {viewPkg.exclusions.filter(Boolean).map((exc, i) => (
                                <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                                  <span className="text-red-400 mt-0.5 flex-shrink-0">â€¢</span>{exc}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* â”€â”€ Pricing â”€â”€ */}
              {viewPkg.pricePerPerson && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                    <span className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-sm">ðŸ’°</span>
                    <p className="text-sm font-bold text-gray-800">Pricing</p>
                  </div>
                  <div className="p-5 flex items-center gap-5">
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{(viewPkg as any).totalPrice ? 'Total Price' : 'Price per Person'}</p>
                      <p className="text-3xl font-bold text-gray-900">₹{Number((viewPkg as any).totalPrice || viewPkg.pricePerPerson).toLocaleString('en-IN')}</p>
                    </div>
                    {viewTotalPrice > 0 && (
                      <div className="bg-indigo-600 text-white rounded-2xl p-4 min-w-[160px] text-center shadow-lg shadow-indigo-100">
                        <p className="text-[9px] font-bold uppercase tracking-widest opacity-70 mb-1">Total for this Quote</p>
                        <p className="text-2xl font-bold leading-tight">â‚¹{viewTotalPrice.toLocaleString('en-IN')}</p>
                        <p className="text-[10px] opacity-60 mt-1">for {groupSize} pax</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* â”€â”€ Day-Wise Itinerary â”€â”€ */}
              {viewPkg.dayWiseItinerary && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                    <span className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-sm">ðŸ—ºï¸</span>
                    <p className="text-sm font-bold text-gray-800">Day-Wise Itinerary</p>
                  </div>
                  <div className="p-5 space-y-1.5">
                    {viewPkg.dayWiseItinerary.split('\n').filter(Boolean).map((line, i) => (
                      <div key={i} className={`text-sm ${line.toLowerCase().startsWith('day') ? 'font-semibold text-gray-900 mt-3 first:mt-0' : 'text-gray-600 pl-4'}`}>
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Right: Live Preview */}
            <div className="w-80 flex-shrink-0 bg-white border-l border-gray-100 flex flex-col overflow-y-auto">
              <div className="px-4 py-3 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-700">Preview</span>
                <p className="text-[10px] text-gray-400 mt-0.5">for {active.customerName} Â· {groupSize} pax</p>
              </div>
              <div className="p-4">
                <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100">
                  <div className="relative h-40">
                    {viewPkg.primaryImageUrl ? (
                      <img src={viewPkg.primaryImageUrl} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-200 to-purple-300 flex items-center justify-center">
                        <Package className="w-12 h-12 text-white/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    <div className="absolute top-3 left-3">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shadow ${isCustom ? 'bg-amber-400 text-white' : 'bg-white text-gray-800'}`}>
                        {isCustom ? 'Custom' : 'Journaies'}
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3">
                      <p className="text-white font-bold text-sm leading-snug line-clamp-2">{viewPkg.title || 'Package'}</p>
                      {viewPkg.destination && (
                        <p className="text-white/70 text-[10px] flex items-center gap-0.5 mt-0.5">
                          <MapPin className="w-2.5 h-2.5" />{viewPkg.destination}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { emoji: 'ðŸ¨', label: 'Stay', val: viewPkg.starCategory || 'â€“' },
                        { emoji: 'âœˆï¸', label: 'Type', val: viewPkg.travelType || 'â€“' },
                        { emoji: 'ðŸŒ™', label: 'Nights', val: viewPkg.durationNights || 'â€“' },
                      ].map(({ emoji, label, val }) => (
                        <div key={label} className="text-center">
                          <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-1 text-sm">{emoji}</div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase">{label}</p>
                          <p className="text-[10px] font-bold text-gray-700">{String(val)}</p>
                        </div>
                      ))}
                    </div>

                    {((viewPkg as any).totalPrice || viewPkg.pricePerPerson) && (
                      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center mb-3">
                        <p className="text-[10px] text-indigo-400 font-semibold uppercase">{(viewPkg as any).totalPrice ? 'Total Price' : 'Starting from'}</p>
                        <p className="text-xl font-bold text-indigo-700">₹{Number((viewPkg as any).totalPrice || viewPkg.pricePerPerson).toLocaleString('en-IN')}</p>
                        <p className="text-[10px] text-indigo-400">{(viewPkg as any).totalPrice ? 'full package' : 'per person'}</p>
                        {viewTotalPrice > 0 && (
                          <p className="text-[10px] font-semibold text-indigo-600 mt-1 border-t border-indigo-100 pt-1">
                            Total â‚¹{viewTotalPrice.toLocaleString('en-IN')} for {groupSize} pax
                          </p>
                        )}
                      </div>
                    )}

                    {Array.isArray(viewPkg.highlights) && viewPkg.highlights.filter(Boolean).length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-bold text-gray-700 mb-1.5">Highlights</p>
                        <ul className="space-y-1">
                          {viewPkg.highlights.filter(Boolean).slice(0, 4).map((h, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[10px] text-gray-600">
                              <span className="text-indigo-400 mt-0.5 flex-shrink-0">âœ¦</span>{h}
                            </li>
                          ))}
                          {viewPkg.highlights.filter(Boolean).length > 4 && (
                            <li className="text-[10px] text-gray-400 pl-4">+{viewPkg.highlights.filter(Boolean).length - 4} moreâ€¦</li>
                          )}
                        </ul>
                      </div>
                    )}

                    {Array.isArray(viewPkg.inclusions) && viewPkg.inclusions.filter(Boolean).length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-green-700 mb-1">âœ“ Inclusions</p>
                        <ul className="space-y-0.5">
                          {viewPkg.inclusions.filter(Boolean).slice(0, 3).map((inc, i) => (
                            <li key={i} className="text-[10px] text-gray-500 flex items-start gap-1">
                              <span className="text-green-400 flex-shrink-0">â€¢</span>{inc}
                            </li>
                          ))}
                          {viewPkg.inclusions.filter(Boolean).length > 3 && (
                            <li className="text-[10px] text-gray-400 pl-3">+{viewPkg.inclusions.filter(Boolean).length - 3} moreâ€¦</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 bg-gray-50 rounded-xl p-3 text-[10px] text-gray-500 space-y-1">
                  <p className="font-semibold text-gray-700">Quotation Context</p>
                  <p>Customer: <span className="font-medium text-gray-800">{active.customerName}</span></p>
                  <p>Group: <span className="font-medium text-gray-800">{active.adults}A{active.kids ? ` + ${active.kids}K` : ''}</span></p>
                  {active.preferredDates && <p>Dates: <span className="font-medium text-gray-800">{active.preferredDates}</span></p>}
                  <p>Agent: <span className="font-medium text-gray-800">{active.subAgentName}</span></p>
                  <p className="text-gray-400 pt-1 border-t border-gray-200">
                    {isCustom ? 'Customized version â€” not from Package Manager.' : 'Original package from Package Manager.'}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )
    })()}

    {/* ── Full-Screen Customize Overlay ─────────────────────────────────── */}
    {showCustomize && active && (() => {
      const groupSize = active.groupSize || active.adults || 1
      const isFormDirty =
        JSON.stringify(customForm) !== JSON.stringify(originalCustomFormRef.current) ||
        JSON.stringify(customDayItems) !== JSON.stringify(originalCustomDayItemsRef.current)
      const customCurrency = (customForm as any).currency || 'INR'
      const currencyMeta = CURRENCIES.find(c => c.code === customCurrency) || CURRENCIES[0]
      const basePrice = Number(customForm.pricePerPerson) || 0
      const baseINR = basePrice * customExchangeRate
      const totalINR = baseINR * groupSize
      return (
        <div className="fixed left-0 md:left-72 right-0 top-0 bottom-0 z-[60] flex flex-col bg-[#f4f5f9]">

          {/* Top bar — matches PackageManager style */}
          <div className="flex items-center gap-4 bg-white border-b border-gray-100 px-5 py-0 flex-shrink-0 h-14">
            <button
              onClick={() => { setShowCustomize(false); if (openCustomizeId) router.push('/dmc-dashboard/quotations') }}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors flex-shrink-0"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                Back
              </button>
            <div className="h-6 w-px bg-gray-200 flex-shrink-0" />
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{customForm.title || active.packageTitle || 'Untitled'}</p>
                <p className="text-xs text-gray-400">{active.customPackageData ? 'Editing custom package for this quotation' : 'Customizing package for this quotation'}</p>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${active.customPackageData ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                {active.customPackageData ? 'Editing' : 'Customizing'}
              </span>
            </div>
          </div>

          {/* Two-column body */}
          <div className="flex flex-1 overflow-hidden">

            {/* Left: editor */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 min-w-0">

              {/* Cover Image */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                  <span className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center text-sm">🖼️</span>
                  <p className="text-sm font-bold text-gray-800">Cover Image</p>
                </div>
                <div className="p-5">
                  <input ref={customImgInputRef} type="file" accept="image/*" onChange={handleCustomImageUpload} className="hidden" />
                  {customForm.primaryImageUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 h-44 group">
                      <img src={customForm.primaryImageUrl} alt="Cover" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button type="button" onClick={() => customImgInputRef.current?.click()}
                          className="flex items-center gap-1.5 bg-white text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-100">
                          <Upload className="w-3.5 h-3.5" /> Change
                        </button>
                        <button type="button" onClick={() => setCustomForm(p => ({ ...p, primaryImageUrl: '' }))}
                          className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-600">
                          <X className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>
                      {customImgUploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-white" /></div>}
                    </div>
                  ) : (
                    <button type="button" onClick={() => customImgInputRef.current?.click()} disabled={customImgUploading}
                      className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-amber-400 hover:bg-amber-50/40 transition-colors text-gray-400 hover:text-amber-600">
                      {customImgUploading
                        ? <><Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm font-medium">Uploading...</span></>
                        : <><Upload className="w-6 h-6" /><span className="text-sm font-medium">Click to upload cover image</span><span className="text-xs">JPG, PNG, WEBP · Max 10 MB</span></>
                      }
                    </button>
                  )}
                </div>
              </div>

              {/* Basic Info */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                  <span className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-sm">📍</span>
                  <p className="text-sm font-bold text-gray-800">Basic Info</p>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Package Title</label>
                    <input
                      value={customForm.title || ''}
                      onChange={e => setCustomForm(p => ({ ...p, title: e.target.value }))}
                      placeholder={active.packageTitle || 'e.g. Customized Goa Beach Package'}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-300"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Destination</label>
                      <input value={customForm.destination || ''} onChange={e => setCustomForm(p => ({ ...p, destination: e.target.value }))}
                        placeholder={active.destination}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Country</label>
                      <input value={customForm.destinationCountry || ''} onChange={e => setCustomForm(p => ({ ...p, destinationCountry: e.target.value }))}
                        placeholder="India"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Days</label>
                      <input type="number" min="1" value={customForm.durationDays || ''} onChange={e => setCustomForm(p => ({ ...p, durationDays: Number(e.target.value) }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Nights</label>
                      <input type="number" min="0" value={customForm.durationNights || ''} onChange={e => setCustomForm(p => ({ ...p, durationNights: Number(e.target.value) }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-2">Star Category</label>
                    <div className="flex flex-wrap gap-2">
                      {STAR_CATEGORIES.map(s => (
                        <button key={s} type="button" onClick={() => setCustomForm(p => ({ ...p, starCategory: s }))}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${customForm.starCategory === s ? 'bg-amber-500 text-white border-amber-500' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-amber-300'}`}>
                          {s === '' ? 'None' : s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-2">Travel Type</label>
                    <div className="flex flex-wrap gap-2">
                      {TRAVEL_TYPES.map(t => (
                        <button key={t} type="button" onClick={() => setCustomForm(p => ({ ...p, travelType: t }))}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${customForm.travelType === t ? 'bg-purple-600 text-white border-purple-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-purple-300'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Overview</label>
                    <textarea rows={3} value={customForm.overview || ''} onChange={e => setCustomForm(p => ({ ...p, overview: e.target.value }))}
                      placeholder="Describe this package in a few sentences..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Highlights <span className="font-normal text-gray-400">(one per line)</span></label>
                    <textarea rows={3}
                      value={Array.isArray(customForm.highlights) ? customForm.highlights.join('\n') : (customForm.highlights || '')}
                      onChange={e => setCustomForm(p => ({ ...p, highlights: e.target.value.split('\n') }))}
                      placeholder={"Sunset cruise\nScuba diving\nIsland hopping"}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  </div>
                </div>
              </div>

              {/* Pricing Configuration */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center text-base">💰</div>
                  <h3 className="font-bold text-gray-900 text-sm">Pricing Configuration</h3>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Net Cost (per person)</p>
                      <div className="flex gap-2">
                        <select
                          value={(customForm as any).currency || 'INR'}
                          onChange={e => setCustomForm(p => ({ ...p, currency: e.target.value } as any))}
                          className="text-sm font-semibold border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-200 cursor-pointer flex-shrink-0"
                        >
                          {CURRENCIES.map(c => (
                            <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>
                          ))}
                        </select>
                        <div className="flex-1 flex items-center border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 gap-2 focus-within:ring-2 focus-within:ring-amber-200 focus-within:border-amber-300 transition-all">
                          <span className="text-gray-400 font-bold text-lg flex-shrink-0">{currencyMeta.symbol}</span>
                          <input
                            type="number"
                            value={customForm.pricePerPerson || ''}
                            onChange={e => setCustomForm(p => ({ ...p, pricePerPerson: Number(e.target.value) || undefined }))}
                            className="flex-1 text-xl font-bold text-gray-900 border-none outline-none bg-transparent min-w-0"
                            placeholder="0"
                          />
                        </div>
                      </div>
                      {customCurrency !== 'INR' && (
                        <div className="mt-2 flex flex-col gap-1">
                          {customRateLoading ? (
                            <span className="flex items-center gap-1.5 text-xs text-gray-400">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Fetching live rate...
                            </span>
                          ) : customRateError ? (
                            <span className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-full px-3 py-1">
                              Could not fetch rate — using 1:1 fallback.
                            </span>
                          ) : basePrice > 0 ? (
                            <>
                              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 inline-flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                                approx. ₹{baseINR.toLocaleString('en-IN', { maximumFractionDigits: 0 })} INR
                                <span className="text-emerald-500 font-medium">·</span>
                                <span className="font-normal text-emerald-500">1 {customCurrency} = ₹{customExchangeRate.toLocaleString('en-IN', { maximumFractionDigits: 4 })}</span>
                              </span>
                              {customRateUpdatedAt && (
                                <span className="text-[10px] text-gray-400 pl-1">
                                  Rate last updated: {new Date(customRateUpdatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] text-gray-400 pl-1">
                              {customExchangeRate > 1 ? `1 ${customCurrency} = ₹${customExchangeRate.toLocaleString('en-IN', { maximumFractionDigits: 4 })}` : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Total Price (optional)</p>
                        <div className="flex items-center border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 gap-1.5">
                          <span className="text-gray-400 font-semibold text-sm">{currencyMeta.symbol}</span>
                          <input
                            type="number"
                            value={(customForm as any).totalPrice || ''}
                            onChange={e => setCustomForm(p => ({ ...p, totalPrice: Number(e.target.value) || null } as any))}
                            placeholder="e.g. 150000"
                            className="flex-1 text-sm font-bold text-gray-900 border-none outline-none bg-transparent w-0 min-w-0"
                          />
                        </div>
                        <p className="text-[9px] text-gray-400 mt-1 pl-1">If set, PDF shows this as total package price.</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">GST (%)</p>
                        <div className="flex items-center border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 gap-1.5">
                          <input
                            type="number"
                            value={(customForm as any).gst || ''}
                            onChange={e => setCustomForm(p => ({ ...p, gst: Number(e.target.value) || null } as any))}
                            placeholder="e.g. 5"
                            min="0"
                            max="100"
                            className="flex-1 text-sm font-bold text-gray-900 border-none outline-none bg-transparent w-0 min-w-0"
                          />
                          <span className="text-gray-400 font-semibold text-sm">%</span>
                        </div>
                        <p className="text-[9px] text-gray-400 mt-1 pl-1">GST percentage shown on PDF quotation.</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-amber-600 text-white rounded-2xl p-4 min-w-[160px] flex-shrink-0 text-center shadow-lg shadow-amber-100">
                    <p className="text-[9px] font-bold uppercase tracking-widest opacity-70 mb-1">Total Quoted Price</p>
                    <p className="text-[9px] opacity-50 mb-2">(in INR)</p>
                    <p className="text-2xl font-bold leading-tight">
                      ₹{totalINR > 0 ? totalINR.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—'}
                    </p>
                    <p className="text-[10px] opacity-60 mt-1.5">for {groupSize} pax</p>
                    {customCurrency !== 'INR' && basePrice > 0 && !customRateLoading && (
                      <p className="text-[9px] opacity-50 mt-1">{currencyMeta.symbol}{basePrice.toLocaleString()} × {customExchangeRate.toFixed(2)}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Master Itinerary */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-purple-600" />
                    </div>
                    <h3 className="font-bold text-gray-900 text-sm">Master Itinerary</h3>
                    {customDayItems.length > 0 && (
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                        {customDayItems.length} day{customDayItems.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <button onClick={addCustomDayItem} className="flex items-center gap-1.5 text-xs text-blue-500 font-bold hover:text-blue-700">
                    <Plus className="w-3.5 h-3.5" /> Add New Day
                  </button>
                </div>
                {customDayItems.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl">
                    <p className="text-sm text-gray-400">No days added yet</p>
                    <button onClick={addCustomDayItem} className="mt-2 text-xs text-blue-500 font-semibold hover:text-blue-700">+ Add Day 1</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customDayItems.map((day, idx) => (
                      <QuotDayCard
                        key={day.id}
                        day={day}
                        idx={idx}
                        onTitleChange={v => setCustomDayItems(prev => prev.map(d => d.id === day.id ? { ...d, title: v } : d))}
                        onDescChange={v => setCustomDayItems(prev => prev.map(d => d.id === day.id ? { ...d, description: v } : d))}
                        onAddTag={tag => { const t = tag.trim(); if (!t) return; setCustomDayItems(prev => prev.map(d => d.id === day.id && !d.tags.includes(t) ? { ...d, tags: [...d.tags, t] } : d)) }}
                        onRemoveTag={tag => setCustomDayItems(prev => prev.map(d => d.id === day.id ? { ...d, tags: d.tags.filter(t => t !== tag) } : d))}
                        onRemove={() => setCustomDayItems(prev => prev.filter(d => d.id !== day.id))}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Hotels & Accommodation */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <input ref={customHotelCsvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCustomHotelCsv} />
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center text-base">🏨</div>
                    <h3 className="font-bold text-gray-900 text-sm">Hotels & Accommodation</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => customHotelCsvRef.current?.click()} className="flex items-center gap-1 text-xs text-emerald-600 font-semibold hover:text-emerald-800 border border-emerald-200 bg-emerald-50 px-2 py-1 rounded-lg">
                      <Upload className="w-3 h-3" /> Import CSV
                    </button>
                    <button onClick={addCustomHotel} className="flex items-center gap-1.5 text-xs text-blue-500 font-bold hover:text-blue-700">
                      <Plus className="w-3.5 h-3.5" /> Add Hotel
                    </button>
                  </div>
                </div>
                {customHotelCsvMsg && (
                  <p className={`text-xs mb-3 px-3 py-2 rounded-lg ${customHotelCsvMsg.startsWith('ok') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{customHotelCsvMsg}</p>
                )}
                {customHotelEntries.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl">
                    <p className="text-sm text-gray-400">No hotels added yet</p>
                    <div className="flex items-center justify-center gap-3 mt-2">
                      <button onClick={addCustomHotel} className="text-xs text-blue-500 font-semibold hover:text-blue-700">+ Add manually</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => customHotelCsvRef.current?.click()} className="text-xs text-emerald-600 font-semibold hover:text-emerald-800">Import from CSV</button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Destination</th>
                          <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3 w-12">Nights</th>
                          <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Hotel(s)</th>
                          <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3 w-32">Meal Plan</th>
                          <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Room Type</th>
                          <th className="pb-2 w-6" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {customHotelEntries.map(h => (
                          <tr key={h.id} className="group">
                            <td className="py-2 pr-3">
                              <input value={h.destination} onChange={e => updateCustomHotel(h.id, 'destination', e.target.value)} placeholder="Kuta"
                                className="w-full text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400" />
                            </td>
                            <td className="py-2 pr-3">
                              <input type="number" min="1" value={h.nights} onChange={e => updateCustomHotel(h.id, 'nights', Number(e.target.value))}
                                className="w-full text-sm text-center text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400" />
                            </td>
                            <td className="py-2 pr-3">
                              <textarea value={h.hotels} onChange={e => updateCustomHotel(h.id, 'hotels', e.target.value)} placeholder="Hotel name" rows={2}
                                className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 resize-none" />
                            </td>
                            <td className="py-2 pr-3">
                              <select value={h.mealPlan} onChange={e => updateCustomHotel(h.id, 'mealPlan', e.target.value)}
                                className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400">
                                {MEAL_PLANS.map(m => <option key={m}>{m}</option>)}
                              </select>
                            </td>
                            <td className="py-2 pr-3">
                              <textarea value={h.roomType} onChange={e => updateCustomHotel(h.id, 'roomType', e.target.value)} placeholder="Room type" rows={2}
                                className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 resize-none" />
                            </td>
                            <td className="py-2">
                              <button onClick={() => removeCustomHotel(h.id)} className="p-1 text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Vehicles & Transfers */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <input ref={customVehicleCsvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCustomVehicleCsv} />
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center text-base">🚗</div>
                    <h3 className="font-bold text-gray-900 text-sm">Vehicles & Transfers</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => customVehicleCsvRef.current?.click()} className="flex items-center gap-1 text-xs text-emerald-600 font-semibold hover:text-emerald-800 border border-emerald-200 bg-emerald-50 px-2 py-1 rounded-lg">
                      <Upload className="w-3 h-3" /> Import CSV
                    </button>
                    <button onClick={addCustomVehicle} className="flex items-center gap-1.5 text-xs text-blue-500 font-bold hover:text-blue-700">
                      <Plus className="w-3.5 h-3.5" /> Add Vehicle
                    </button>
                  </div>
                </div>
                {customVehicleCsvMsg && (
                  <p className={`text-xs mb-3 px-3 py-2 rounded-lg ${customVehicleCsvMsg.startsWith('ok') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{customVehicleCsvMsg}</p>
                )}
                {customVehicleEntries.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl">
                    <p className="text-sm text-gray-400">No vehicles added yet</p>
                    <div className="flex items-center justify-center gap-3 mt-2">
                      <button onClick={addCustomVehicle} className="text-xs text-blue-500 font-semibold hover:text-blue-700">+ Add manually</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => customVehicleCsvRef.current?.click()} className="text-xs text-emerald-600 font-semibold hover:text-emerald-800">Import from CSV</button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Vehicle Type</th>
                          <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3 w-14">Seats</th>
                          <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Route / Transfers</th>
                          <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3 w-12">Days</th>
                          <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Notes</th>
                          <th className="pb-2 w-6" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {customVehicleEntries.map(v => (
                          <tr key={v.id} className="group">
                            <td className="py-2 pr-3">
                              <select value={v.vehicleType} onChange={e => updateCustomVehicle(v.id, 'vehicleType', e.target.value)}
                                className="w-full text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400">
                                {VEHICLE_TYPES.map(t => <option key={t}>{t}</option>)}
                                {!VEHICLE_TYPES.includes(v.vehicleType) && v.vehicleType && (
                                  <option value={v.vehicleType}>{v.vehicleType}</option>
                                )}
                              </select>
                            </td>
                            <td className="py-2 pr-3">
                              <input type="number" min="1" value={v.seats} onChange={e => updateCustomVehicle(v.id, 'seats', Number(e.target.value))}
                                className="w-full text-sm text-center text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400" />
                            </td>
                            <td className="py-2 pr-3">
                              <input value={v.route} onChange={e => updateCustomVehicle(v.id, 'route', e.target.value)} placeholder="Airport transfers, all sightseeing"
                                className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400" />
                            </td>
                            <td className="py-2 pr-3">
                              <input type="number" min="1" value={v.days} onChange={e => updateCustomVehicle(v.id, 'days', Number(e.target.value))}
                                className="w-full text-sm text-center text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400" />
                            </td>
                            <td className="py-2 pr-3">
                              <input value={v.notes} onChange={e => updateCustomVehicle(v.id, 'notes', e.target.value)} placeholder="AC vehicle, with driver"
                                className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400" />
                            </td>
                            <td className="py-2">
                              <button onClick={() => removeCustomVehicle(v.id)} className="p-1 text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Inclusions & Exclusions */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                  <span className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-sm">📝</span>
                  <p className="text-sm font-bold text-gray-800">Inclusions & Exclusions</p>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-green-700 block mb-1">✓ Inclusions</label>
                      <textarea rows={4}
                        value={Array.isArray(customForm.inclusions) ? customForm.inclusions.join('\n') : (customForm.inclusions || '')}
                        onChange={e => setCustomForm(p => ({ ...p, inclusions: e.target.value.split('\n') }))}
                        placeholder={"Flights\nHotel accommodation\nDaily breakfast"}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-red-500 block mb-1">✗ Exclusions</label>
                      <textarea rows={4}
                        value={Array.isArray(customForm.exclusions) ? customForm.exclusions.join('\n') : (customForm.exclusions || '')}
                        onChange={e => setCustomForm(p => ({ ...p, exclusions: e.target.value.split('\n') }))}
                        placeholder={"Travel insurance\nVisa fees\nTips & gratuities"}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Package Perks — hidden
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                ...
              </div>
              */}

              {/* Payment & Cancellation Policy */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                  <span className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-sm">📋</span>
                  <p className="text-sm font-bold text-gray-800">Payment & Cancellation Policy</p>
                  <span className="ml-auto text-[10px] text-gray-400 font-medium">Shown in customer PDF</span>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Payment Policy</label>
                    <textarea rows={4}
                      value={(customForm as any).paymentPolicy || ''}
                      onChange={e => setCustomForm(p => ({ ...p, paymentPolicy: e.target.value } as any))}
                      placeholder="e.g. 30% advance to confirm booking. Balance due 21 days before travel. Bank transfer or UPI accepted."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Cancellation Policy</label>
                    <textarea rows={4}
                      value={(customForm as any).cancellationPolicy || ''}
                      onChange={e => setCustomForm(p => ({ ...p, cancellationPolicy: e.target.value } as any))}
                      placeholder="e.g. 30+ days: 25% charge. 15-29 days: 50% charge. 7-14 days: 75% charge. Less than 7 days: non-refundable."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  </div>
                </div>
              </div>

            </div>


          </div>

          {/* Bottom action bar */}
          <div className="flex items-center justify-end px-5 py-3 bg-white border-t border-gray-100 shadow-[0_-2px_12px_rgba(0,0,0,0.07)] flex-shrink-0 gap-2">
            <button
              onClick={saveCustomPackage}
              disabled={savingCustom || creatingPkg}
              className="flex items-center gap-1.5 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-xs font-bold px-4 py-2 rounded-xl transition-colors"
            >
              {savingCustom ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {savingCustom ? 'Saving…' : 'Save'}
            </button>

            <button
              onClick={createNewPackage}
              disabled={savingCustom || creatingPkg}
              className="flex items-center gap-1.5 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50 text-gray-700 hover:text-indigo-700 text-xs font-bold px-4 py-2 rounded-xl transition-colors"
            >
              {creatingPkg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {creatingPkg ? 'Saving…' : 'Save As'}
            </button>

            <button
              onClick={downloadCurrentPdf}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm shadow-purple-200"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </button>
          </div>
        </div>
      )
    })()}


    {/* â”€â”€ Quotation PDF Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
    {pdfQuot && (() => {
      const pkg = pdfQuot.customPackageData
      const inclusions = Array.isArray(pkg?.inclusions) ? pkg!.inclusions.filter(Boolean) : []
      const exclusions = Array.isArray(pkg?.exclusions) ? pkg!.exclusions.filter(Boolean) : []
      const highlights = Array.isArray(pkg?.highlights) ? pkg!.highlights.filter(Boolean) : []
      const groupSize = pdfQuot.groupSize || 1
      const pricePerPerson = pkg?.pricePerPerson || (pdfQuot.quotedPrice ? Math.round(Number(pdfQuot.quotedPrice) / groupSize) : null)

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
          seasonalAvailability={pkg?.seasonalAvailability}
          pricePerPerson={pricePerPerson}
          quotedPriceTotal={pdfQuot.quotedPrice ? Number(pdfQuot.quotedPrice) : null}
          groupSize={groupSize}
          adults={pdfQuot.adults}
          kids={pdfQuot.kids}
          overview={pkg?.overview}
          inclusions={inclusions}
          exclusions={exclusions}
          highlights={highlights}
          dayWiseItinerary={pkg?.dayWiseItinerary}
          customerName={pdfQuot.customerName}
          customerEmail={pdfQuot.customerEmail}
          customerPhone={pdfQuot.customerPhone}
          preferredDates={pdfQuot.preferredDates}
          refId={pdfQuot.publicId || pdfQuot.id.slice(-8).toUpperCase()}
          specialRequests={pdfQuot.specialRequests}
          brandName={agentName}
          onClose={() => setPdfQuot(null)}
          onWhatsApp={() => shareOnWhatsApp(pdfQuot)}
          onPrint={() => openPrintWindow(pdfQuot)}
        />
      )
    })()}
    </>
  )
}

// â”€â”€ QuotDayCard â€” inline day card for the customize overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface QuotDayCardProps {
  day: DayItem
  idx: number
  onTitleChange: (v: string) => void
  onDescChange: (v: string) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  onRemove: () => void
}

function QuotDayCard({ day, idx, onTitleChange, onDescChange, onAddTag, onRemoveTag, onRemove }: QuotDayCardProps) {
  const [tagInput, setTagInput] = useState('')

  function handleTagKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      onAddTag(tagInput)
      setTagInput('')
    }
  }

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden bg-gray-50">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-100">
        <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
        <span className="w-6 h-6 bg-indigo-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0">
          {String(idx + 1).padStart(2, '0')}
        </span>
        <input
          value={day.title}
          onChange={e => onTitleChange(e.target.value)}
          placeholder={`Day ${idx + 1}: Title`}
          className="flex-1 text-sm font-bold text-gray-900 bg-transparent border-none outline-none placeholder:text-gray-300"
        />
        <button onClick={onRemove} className="p-1 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="px-4 py-3 space-y-2">
        <textarea
          value={day.description}
          onChange={e => onDescChange(e.target.value)}
          rows={2}
          placeholder="Describe activities for this dayâ€¦"
          className="w-full text-sm text-gray-600 bg-transparent border-none outline-none resize-none placeholder:text-gray-300"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {day.tags.map(tag => (
            <span key={tag} className="flex items-center gap-1 bg-white border border-gray-200 text-gray-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">
              {tag}
              <button onClick={() => onRemoveTag(tag)} className="text-gray-300 hover:text-red-400 ml-0.5">Ã—</button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={handleTagKey}
            placeholder="+ tag, Enter"
            className="text-[10px] text-gray-400 bg-transparent border-none outline-none w-20 placeholder:text-gray-300"
          />
        </div>
      </div>
    </div>
  )
}
