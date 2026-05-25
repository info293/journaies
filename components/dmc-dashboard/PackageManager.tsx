'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Edit2, Trash2, Eye, EyeOff, Loader2, X, Save, Package, Upload, CheckCircle, AlertCircle, Star, MapPin, Clock, Users, Calendar, Download, Maximize2, GripVertical, ChevronDown, ChevronUp, Search, Filter } from 'lucide-react'
import { AgentPackage, HotelEntry, VehicleEntry } from '@/lib/types/agent'
import { CURRENCIES, getCurrencySymbol } from '@/lib/utils/currency'
import ConfirmModal from './ConfirmModal'
import { openPackagePdfWindow } from '@/lib/generatePackagePdf'

// Module-level cache so repeated currency switches in the same session don't re-fetch
// TTL: 30 minutes
const RATE_CACHE: Record<string, { rate: number; updatedAt: string; cachedAt: number }> = {}
const CACHE_TTL_MS = 30 * 60 * 1000

async function fetchINRRate(fromCurrency: string): Promise<{ rate: number; updatedAt: string }> {
  const cached = RATE_CACHE[fromCurrency]
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { rate: cached.rate, updatedAt: cached.updatedAt }
  }
  // open.er-api.com: free, no API key, updated hourly
  const res = await fetch(`https://open.er-api.com/v6/latest/${fromCurrency}`)
  if (!res.ok) throw new Error(`Rate fetch failed: ${res.status}`)
  const data = await res.json()
  if (data.result !== 'success') throw new Error('Rate API error')
  const rate: number = data.rates['INR'] ?? 1
  const updatedAt: string = data.time_last_update_utc ?? new Date().toUTCString()
  RATE_CACHE[fromCurrency] = { rate, updatedAt, cachedAt: Date.now() }
  return { rate, updatedAt }
}

interface Props {
  agentId: string
  companyName?: string
  logoUrl?: string
  contactName?: string
  currency?: string
  openCreate?: boolean
  openEditId?: string
}

const EMPTY_FORM = {
  title: '',
  destination: '',
  destinationCountry: 'India',
  overview: '',
  durationDays: '',
  durationNights: '',
  pricePerPerson: '',
  totalPrice: '',
  gst: '',
  currency: 'INR',
  maxGroupSize: '20',
  minGroupSize: '1',
  adults: '2',
  children: '0',
  infants: '0',
  travelType: 'Leisure',
  theme: '',
  mood: '',
  starCategory: '',
  inclusions: '',
  exclusions: '',
  highlights: '',
  dayWiseItinerary: '',
  primaryImageUrl: '',
  seasonalAvailability: 'Year Round',
  paymentPolicy: '',
  cancellationPolicy: '',
}

const MEAL_PLANS = ['Breakfast', 'Half Board', 'Full Board', 'All Inclusive', 'Room Only']
const TRAVEL_TYPES = ['Leisure', 'Adventure', 'Honeymoon', 'Family', 'Corporate', 'Pilgrimage', 'Wildlife']
const STAR_CATEGORIES = ['', '3-Star', '4-Star', '5-Star']
const THEMES = ['Beach', 'Wildlife', 'Cultural', 'Hills', 'Desert', 'Adventure', 'Wellness', 'Heritage', 'Backpacking']
const MOODS = ['Relaxing', 'Adventurous', 'Romantic', 'Family Fun', 'Spiritual', 'Exploratory']
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

// Sets used for CSV validation
const VALID_CURRENCY_CODES = new Set(CURRENCIES.map(c => c.code))
const VALID_TRAVEL_TYPE_SET = new Set([...TRAVEL_TYPES, 'Cultural'])
const CSV_KNOWN_COLS = new Set([
  'title', 'destination', 'destination_country', 'duration_days', 'duration_nights',
  'price_per_person', 'total_price', 'gst', 'currency', 'travel_type', 'star_category', 'theme', 'mood',
  'overview', 'highlights', 'inclusions', 'exclusions', 'day_wise_itinerary',
  'seasonal_availability', 'primary_image_url', 'max_group_size', 'min_group_size',
  // common aliases accepted by the parser
  'package_title', 'name', 'package_name', 'tour_name',
  'dest', 'location', 'place', 'country',
  'price', 'cost', 'rate', 'amount',
  'days', 'nights', 'trip_duration_days', 'trip_duration_nights', 'total_days', 'total_nights',
  'description', 'details', 'itinerary', 'day_plan', 'schedule',
  'image_url', 'image', 'photo_url', 'cover_image',
  'hotels', 'hotel', 'accommodation',
  'vehicles', 'vehicle', 'transfers', 'transport',
  'payment_policy', 'cancellation_policy',
])

interface CsvValidationIssue {
  row: number | null   // null = file-level (header / encoding problem)
  field: string
  found: string
  message: string
  fix: string
  severity: 'error' | 'warning'
}
interface CsvResult { success: number; failed: number; total: number; issues: CsvValidationIssue[] }

interface DayItem {
  id: string
  title: string
  description: string
  tags: string[]
}

// Minimal CSV parser — handles quoted fields containing commas/newlines
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return []
  const headers = splitCsvRow(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = splitCsvRow(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim() })
    rows.push(row)
  }
  return rows
}

function splitCsvRow(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      result.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

// Parse hotels column: "Dest;Nights;Hotel Name;Meal Plan;Room Type||..."
function parseCsvHotels(raw: string): HotelEntry[] {
  if (!raw.trim()) return []
  return raw.split('||').map(s => s.trim()).filter(Boolean).map(entry => {
    const parts = entry.split(';').map(p => p.trim())
    return {
      id: crypto.randomUUID(),
      destination: parts[0] || '',
      nights: parseInt(parts[1] || '1') || 1,
      hotels: parts[2] || '',
      mealPlan: MEAL_PLANS.includes(parts[3] || '') ? parts[3] : 'Breakfast',
      roomType: parts[4] || '',
    }
  }).filter(h => h.destination && h.hotels)
}

// Parse vehicles column: "Type;Seats;Route;Days;Notes||..."
function parseCsvVehicles(raw: string): VehicleEntry[] {
  if (!raw.trim()) return []
  return raw.split('||').map(s => s.trim()).filter(Boolean).map(entry => {
    const parts = entry.split(';').map(p => p.trim())
    return {
      id: crypto.randomUUID(),
      vehicleType: parts[0] || '',
      seats: parseInt(parts[1] || '4') || 4,
      route: parts[2] || '',
      days: parseInt(parts[3] || '1') || 1,
      notes: parts[4] || '',
    }
  }).filter(v => v.vehicleType)
}

export default function PackageManager({ agentId, companyName = 'DMC Partner', logoUrl, contactName, openCreate, openEditId }: Props) {
  const router = useRouter()
  const [packages, setPackages] = useState<AgentPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [previewPkg, setPreviewPkg] = useState<AgentPackage | null>(null)
  const [showFormPreview, setShowFormPreview] = useState(false)

  // Day-wise itinerary items
  const [dayItems, setDayItems] = useState<DayItem[]>([])
  const [hotelEntries, setHotelEntries] = useState<HotelEntry[]>([])
  const [vehicleEntries, setVehicleEntries] = useState<VehicleEntry[]>([])
  const [perks, setPerks] = useState<string[]>([])
  const [perkInput, setPerkInput] = useState('')
  const [markupEnabled, setMarkupEnabled] = useState(false)
  const [markupPercent, setMarkupPercent] = useState('15')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [showPdfPreview, setShowPdfPreview] = useState(false)

  // Image upload state
  const imgInputRef = useRef<HTMLInputElement>(null)
  const [imgUploading, setImgUploading] = useState(false)

  // CSV state — main package bulk import
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvResult, setCsvResult] = useState<CsvResult | null>(null)
  const [showCsvGuide, setShowCsvGuide] = useState(false)

  // CSV state — hotel/vehicle in-form imports
  const hotelCsvInputRef = useRef<HTMLInputElement>(null)
  const vehicleCsvInputRef = useRef<HTMLInputElement>(null)
  const [hotelCsvMsg, setHotelCsvMsg] = useState('')
  const [vehicleCsvMsg, setVehicleCsvMsg] = useState('')

  // Change detection
  const [originalSnapshot, setOriginalSnapshot] = useState<string>('')
  const skipDayEffect = useRef(false)

  // Save As modal
  const [showSaveAsModal, setShowSaveAsModal] = useState(false)
  const [saveAsName, setSaveAsName] = useState('')

  // Currency / exchange rate state
  const [exchangeRate, setExchangeRate] = useState<number>(1)
  const [rateLoading, setRateLoading] = useState(false)
  const [rateUpdatedAt, setRateUpdatedAt] = useState<string>('')
  const [rateError, setRateError] = useState(false)

  // List filters
  const [pkgSearch, setPkgSearch] = useState('')
  const [pkgStatusFilter, setPkgStatusFilter] = useState<'all' | 'active' | 'paused'>('all')
  const [pkgDestFilter, setPkgDestFilter] = useState('all')
  const [pkgHotelFilter, setPkgHotelFilter] = useState<'all' | 'with' | 'without'>('all')

  function makeSnapshot(
    f: typeof EMPTY_FORM,
    di: DayItem[],
    he: HotelEntry[],
    ve: VehicleEntry[],
    p: string[],
    me: boolean,
    mp: string,
  ): string {
    return JSON.stringify({ form: f, dayItems: di, hotelEntries: he, vehicleEntries: ve, perks: p, markupEnabled: me, markupPercent: mp })
  }

  const currentSnapshot = makeSnapshot(form, dayItems, hotelEntries, vehicleEntries, perks, markupEnabled, markupPercent)
  const hasChanges = showForm && currentSnapshot !== originalSnapshot

  const fetchPackages = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/agent/packages?agentId=${agentId}`)
      const data = await res.json()
      if (data.success) setPackages(data.packages)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => { fetchPackages() }, [fetchPackages])

  // Fetch live INR exchange rate whenever currency changes
  useEffect(() => {
    if (form.currency === 'INR') {
      setExchangeRate(1)
      setRateUpdatedAt('')
      setRateError(false)
      return
    }
    setRateLoading(true)
    setRateError(false)
    fetchINRRate(form.currency)
      .then(({ rate, updatedAt }) => {
        setExchangeRate(rate)
        setRateUpdatedAt(updatedAt)
      })
      .catch(() => {
        setExchangeRate(1)
        setRateError(true)
      })
      .finally(() => setRateLoading(false))
  }, [form.currency])

  // Auto-derive days/nights from itinerary when user adds/removes day cards
  useEffect(() => {
    if (skipDayEffect.current) {
      skipDayEffect.current = false
      return
    }
    if (!showForm) return
    setForm(prev => ({
      ...prev,
      durationDays: dayItems.length > 0 ? String(dayItems.length) : prev.durationDays,
      durationNights: dayItems.length > 0 ? String(Math.max(0, dayItems.length - 1)) : prev.durationNights,
    }))
  }, [dayItems.length]) // eslint-disable-line react-hooks/exhaustive-deps

  function parseDayItems(text: string): DayItem[] {
    if (!text?.trim()) return []
    const lines = text.split('\n')
    const items: DayItem[] = []
    let current: DayItem | null = null
    for (const raw of lines) {
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

  // Normalize itinerary text from CSV: handles || day separator, \n literal escapes, and real newlines
  function normalizeCsvItinerary(raw: string): string {
    if (!raw?.trim()) return ''
    // Format 1: Days separated by || (recommended for CSV editing)
    // e.g. "Day 1: Arrive Mumbai||Check-in and rest||Day 2: Sightseeing||Visit Gateway of India"
    if (raw.includes('||')) {
      return raw.split('||').map(s => s.trim()).filter(Boolean).join('\n')
    }
    // Format 2: \\n literal escape sequences (e.g. from some Excel exports)
    if (raw.includes('\\n')) {
      return raw.replace(/\\n/g, '\n').trim()
    }
    // Format 3: Already has real newlines (properly quoted CSV cell) — pass through
    return raw.trim()
  }

  // Download a ready-to-use sample CSV with realistic packages and proper day-wise itinerary
  function downloadSampleCsv() {
    const headers = [
      'title', 'destination', 'destination_country', 'duration_days', 'duration_nights',
      'price_per_person', 'total_price', 'gst', 'currency', 'travel_type', 'star_category', 'theme', 'mood',
      'overview', 'highlights', 'inclusions', 'exclusions',
      'day_wise_itinerary', 'seasonal_availability', 'primary_image_url',
      'hotels', 'vehicles', 'payment_policy', 'cancellation_policy',
    ]

    // Wrap in double-quotes and escape internal quotes
    const q = (val: string) => `"${val.replace(/"/g, '""')}"`

    const rows = [
      [
        'Andaman 6D/5N Beach Escape',
        'Andaman & Nicobar Islands',
        'India',
        '6', '5',
        '28000',
        '',   // total_price (leave blank — per-person pricing)
        '5',  // gst %
        'INR',
        'Leisure',
        '4-Star',
        'Beach',
        'Relaxing',
        'Escape to paradise with pristine beaches, clear waters, and vibrant marine life in the Andaman Islands.',
        'Scuba diving at Elephant Beach|Sunset cruise at Radhanagar Beach|Glass-bottom boat ride|Visit Cellular Jail',
        'Return flights from Chennai|4-Star hotel accommodation (5 nights)|Daily breakfast|All transfers|Entry fees',
        'Travel insurance|Visa fees|Lunch & dinner|Personal expenses|Alcoholic beverages',
        // day_wise_itinerary — each Day separated by || for easy spreadsheet editing
        'Day 1: Arrive Port Blair — Welcome to Andaman!||Arrive at Veer Savarkar Airport. Check in to hotel and freshen up. Visit Cellular Jail and attend the evening Light & Sound Show.||Day 2: Ross Island & North Bay Island||Post breakfast, take a ferry to Ross Island to explore the colonial ruins. Afternoon visit North Bay Island for snorkelling and water sports.||Day 3: Havelock Island (Radhanagar Beach)||Morning ferry to Havelock Island. Check in to resort. Spend the afternoon at Radhanagar Beach — rated one of Asias best beaches.||Day 4: Elephant Beach — Scuba & Snorkelling||Full day at Elephant Beach. Try beginner scuba diving, snorkelling, and sea walking. Relaxing bonfire evening at Havelock.||Day 5: Neil Island Day Trip||Morning speed boat to Neil Island. Visit Natural Bridge and Laxmanpur Beach. Return to Havelock by afternoon.||Day 6: Departure||Morning check-out. Transfer to Port Blair airport for your return flight. Tour ends with wonderful memories.',
        'Oct–May',
        '',
        // hotels: Destination;Nights;Hotel Name;Meal Plan;Room Type  — use || for multiple
        'Port Blair;1;Sinclairs Bayview;Breakfast;Standard Room||Havelock;4;Symphony Palms Beach Resort;Breakfast;Sea-facing Cottage',
        // vehicles: Type;Seats;Route;Days;Notes  — use || for multiple
        'Innova Crysta;7;Airport & port transfers;6;AC with driver',
        '30% advance to confirm. Balance due 21 days before travel. Bank transfer / UPI accepted.',
        '30+ days: 25% charge. 15–29 days: 50% charge. 7–14 days: 75% charge. Less than 7 days: non-refundable.',
      ],
      [
        'Bali Honeymoon 7D/6N',
        'Bali',
        'Indonesia',
        '7', '6',
        '650',
        '',   // total_price (leave blank — per-person pricing)
        '5',  // gst %
        'USD',
        'Honeymoon',
        '5-Star',
        'Beach',
        'Romantic',
        'A dreamy Bali honeymoon combining luxury villas, rice terraces, ancient temples, and private beach dinners.',
        'Private pool villa|Sunset dinner at Jimbaran Bay|Tegallalang Rice Terrace|Uluwatu Temple sunset|Couples spa ritual',
        'Return international flights|5-Star villa accommodation (6 nights)|Daily breakfast + 1 romantic dinner|Airport transfers|Couple spa (1 session)',
        'Travel insurance|Visa on arrival fee|Lunch|Personal shopping|Alcoholic beverages',
        'Day 1: Arrival in Bali — Romantic Welcome||Arrive at Ngurah Rai Airport. Private transfer to luxury pool villa. Romantic welcome with flowers and fruit basket. Rest and relax.||Day 2: Ubud & Rice Terraces||Visit iconic Tegallalang Rice Terraces. Explore Ubud Art Market. Visit Sacred Monkey Forest. Evening Kecak dance show at sunset.||Day 3: Temple Trail & Spa||Morning visit to Tanah Lot sea temple. Afternoon at Uluwatu cliffside temple. Couples Balinese spa session in the evening.||Day 4: Water Sports & Beach Day||Morning leisure at the villa. Afternoon water sports at Nusa Dua — parasailing, jet ski, banana boat. Sunset dinner at Jimbaran seafood bay.||Day 5: Nusa Penida Day Trip||Speed boat to Nusa Penida. Visit Kelingking Beach, Angel Billabong, and Broken Beach. Return by evening.||Day 6: Leisure & Shopping||Free day for shopping and spa. Visit Seminyak boutiques or relax by the villa pool. Farewell dinner at a rooftop restaurant.||Day 7: Departure||Checkout, last-minute shopping if time permits. Transfer to airport for departure flight.',
        'Year Round',
        '',
        'Seminyak;2;W Bali — Seminyak;Breakfast;Retreat Pool Suite||Ubud;4;Alaya Resort Ubud;Half Board;Private Pool Villa',
        'Luxury Car;4;Airport & villa transfers;7;Private AC with driver||SUV;4;Nusa Penida day trip;1;Shared AC',
        '50% advance to confirm honeymoon booking. Balance due 30 days before travel. Wire transfer accepted.',
        '45+ days: full refund. 30–44 days: 25% charge. 15–29 days: 50% charge. Less than 15 days: non-refundable.',
      ],
      [
        'Rajasthan Royal Circuit 8D/7N',
        'Rajasthan',
        'India',
        '8', '7',
        '35000',
        '',   // total_price (leave blank — per-person pricing)
        '5',  // gst %
        'INR',
        'Cultural',
        '4-Star',
        'Heritage',
        'Exploratory',
        'Discover the royal splendour of Rajasthan — from the Pink City of Jaipur to the Blue City of Jodhpur and the golden dunes of Jaisalmer.',
        'Amber Fort elephant ride|Camel safari in Thar Desert|Mehrangarh Fort visit|Local cooking class in Jaipur|Desert camping under stars',
        'AC transportation throughout|Heritage hotel stays (7 nights)|Daily breakfast|English-speaking guide|Camel safari|Entry fees',
        'Flights|Lunch & dinner|Travel insurance|Tips & gratuities|Personal expenses',
        'Day 1: Arrive Jaipur — The Pink City||Arrive at Jaipur Airport. Check in to heritage hotel. Explore local bazaars and taste Rajasthani snacks. Welcome dinner.||Day 2: Jaipur Sightseeing||Visit Amber Fort (elephant ride), City Palace, Jantar Mantar observatory, and Hawa Mahal. Shopping at Johari Bazaar.||Day 3: Jaipur to Pushkar||Drive to Pushkar (3 hrs). Visit the sacred Brahma Temple and colorful Pushkar Lake ghats. Explore camel fair grounds. Overnight Pushkar.||Day 4: Pushkar to Jodhpur||Morning drive to Jodhpur (3.5 hrs). Check in to Blue City hotel. Afternoon visit Mehrangarh Fort with panoramic city views.||Day 5: Jodhpur — Blue City & Umaid Bhawan||Jaswant Thada cenotaph and Clock Tower market. Drive through blue-painted old city lanes. Visit Umaid Bhawan Palace museum.||Day 6: Jodhpur to Jaisalmer||Scenic desert drive (4.5 hrs). Check in to heritage haveli. Evening sunset at Sam Sand Dunes. Camel safari and cultural performance under stars.||Day 7: Jaisalmer — Golden Fort & Havelis||Explore Jaisalmer Fort, Patwon ki Haveli, and Bada Bagh cenotaphs. Afternoon shopping — folk art, textiles, and silver jewellery.||Day 8: Departure||Check out. Transfer to airport/station. Tour concludes with memories of royal Rajasthan.',
        'Oct–Mar',
        '',
        'Jaipur;2;Rambagh Palace;Breakfast;Deluxe Room||Jodhpur;2;Umaid Bhawan Heritage Wing;Breakfast;Maharaja Suite||Jaisalmer;3;Suryagarh Jaisalmer;Half Board;Desert View Room',
        'Innova Crysta;7;All intercity & sightseeing transfers;8;AC with English-speaking driver',
        '25% advance to confirm. 50% due 45 days before travel. Full balance due 21 days before departure.',
        '60+ days: full refund. 30–59 days: 20% charge. 15–29 days: 50% charge. Less than 15 days: non-refundable.',
      ],
    ]

    const csvLines = [headers.join(',')]
    for (const row of rows) {
      csvLines.push(row.map(q).join(','))
    }
    const csvContent = csvLines.join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'packages_sample.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function addDayItem() {
    const idx = dayItems.length + 1
    setDayItems(prev => [...prev, { id: crypto.randomUUID(), title: `Day ${idx}`, description: '', tags: [] }])
  }

  function updateDayItem(id: string, field: 'title' | 'description', value: string) {
    setDayItems(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d))
  }

  function removeDayItem(id: string) {
    setDayItems(prev => prev.filter(d => d.id !== id))
  }

  function addTagToDayItem(id: string, tag: string) {
    const t = tag.trim()
    if (!t) return
    setDayItems(prev => prev.map(d => d.id === id && !d.tags.includes(t) ? { ...d, tags: [...d.tags, t] } : d))
  }

  function removeTagFromDayItem(id: string, tag: string) {
    setDayItems(prev => prev.map(d => d.id === id ? { ...d, tags: d.tags.filter(t => t !== tag) } : d))
  }

  function addHotelEntry() {
    setHotelEntries(prev => [...prev, { id: crypto.randomUUID(), destination: '', nights: 1, hotels: '', mealPlan: 'Breakfast', roomType: '' }])
  }

  function updateHotelEntry(id: string, field: keyof HotelEntry, value: string | number) {
    setHotelEntries(prev => prev.map(h => h.id === id ? { ...h, [field]: value } : h))
  }

  function removeHotelEntry(id: string) {
    setHotelEntries(prev => prev.filter(h => h.id !== id))
  }

  function handleHotelCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setHotelCsvMsg('')
    file.text().then(text => {
      const rows = parseCsv(text)
      if (rows.length === 0) { setHotelCsvMsg('No data rows found in CSV.'); return }
      const added: HotelEntry[] = []
      for (const r of rows) {
        const dest  = (r['destination'] || r['dest'] || r['city'] || '').trim()
        const hotel = (r['hotel_name'] || r['hotel'] || r['hotels'] || r['name'] || '').trim()
        if (!dest || !hotel) continue
        const nights    = parseInt(r['nights'] || r['night'] || '1') || 1
        const mealPlan  = MEAL_PLANS.includes(r['meal_plan'] || r['meal'] || '') ? (r['meal_plan'] || r['meal']) : 'Breakfast'
        const roomType  = (r['room_type'] || r['room'] || r['roomtype'] || '').trim()
        added.push({ id: crypto.randomUUID(), destination: dest, nights, hotels: hotel, mealPlan, roomType })
      }
      if (added.length === 0) { setHotelCsvMsg('No valid hotel rows found. Check destination and hotel_name columns.'); return }
      setHotelEntries(prev => [...prev, ...added])
      setHotelCsvMsg(`✓ ${added.length} hotel${added.length > 1 ? 's' : ''} imported.`)
    }).catch(() => setHotelCsvMsg('Failed to read file.'))
  }

  function downloadSampleHotelCsv() {
    const csv = [
      'destination,nights,hotel_name,meal_plan,room_type',
      '"Kuta Beach",2,"Fairfield by Marriott\nOr: The Sakala Resort",Breakfast,"Deluxe Room"',
      '"Ubud",3,"Alaya Resort Ubud",Half Board,"Pool Villa"',
    ].join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'sample_hotels.csv'
    a.click()
  }

  function addVehicleEntry() {
    setVehicleEntries(prev => [...prev, { id: crypto.randomUUID(), vehicleType: 'Innova Crysta', seats: 7, route: '', days: 1, notes: '' }])
  }

  function updateVehicleEntry(id: string, field: keyof VehicleEntry, value: string | number) {
    setVehicleEntries(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v))
  }

  function removeVehicleEntry(id: string) {
    setVehicleEntries(prev => prev.filter(v => v.id !== id))
  }

  function handleVehicleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setVehicleCsvMsg('')
    file.text().then(text => {
      const rows = parseCsv(text)
      if (rows.length === 0) { setVehicleCsvMsg('No data rows found in CSV.'); return }
      const added: VehicleEntry[] = []
      for (const r of rows) {
        const vType = (r['vehicle_type'] || r['vehicle'] || r['type'] || '').trim()
        if (!vType) continue
        const seats = parseInt(r['seats'] || r['capacity'] || r['pax'] || '4') || 4
        const route = (r['route'] || r['transfer'] || r['transfers'] || r['destination'] || '').trim()
        const days  = parseInt(r['days'] || r['day'] || '1') || 1
        const notes = (r['notes'] || r['remarks'] || r['note'] || '').trim()
        added.push({ id: crypto.randomUUID(), vehicleType: vType, seats, route, days, notes })
      }
      if (added.length === 0) { setVehicleCsvMsg('No valid vehicle rows found. Check vehicle_type column.'); return }
      setVehicleEntries(prev => [...prev, ...added])
      setVehicleCsvMsg(`✓ ${added.length} vehicle${added.length > 1 ? 's' : ''} imported.`)
    }).catch(() => setVehicleCsvMsg('Failed to read file.'))
  }

  function downloadSampleVehicleCsv() {
    const csv = [
      'vehicle_type,seats,route,days,notes',
      '"Innova Crysta",7,"Airport pickup & drop",1,"AC vehicle with driver"',
      '"Tempo Traveller (12 Seater)",12,"All sightseeing transfers",5,"AC, comfortable seats"',
    ].join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'sample_vehicles.csv'
    a.click()
  }

  function togglePerk(label: string) {
    setPerks(prev => prev.includes(label) ? prev.filter(p => p !== label) : [...prev, label])
  }

  function addCustomPerk() {
    const t = perkInput.trim()
    if (!t || perks.includes(t)) { setPerkInput(''); return }
    setPerks(prev => [...prev, t])
    setPerkInput('')
  }

  function removePerk(label: string) {
    setPerks(prev => prev.filter(p => p !== label))
  }

  function sharePackageOnWhatsApp() {
    const base = Number(form.pricePerPerson) || 0
    const final = markupEnabled ? base * (1 + Number(markupPercent) / 100) : base
    const lines: string[] = [
      `🌍 *${form.title || 'Travel Package'}*`,
      `📍 ${form.destination}${form.destinationCountry ? ', ' + form.destinationCountry : ''}`,
      `🗓️ ${form.durationDays}D / ${form.durationNights}N  |  ⭐ ${form.starCategory}  |  🎒 ${form.travelType}`,
      `👥 ${form.adults || 0} Adult${Number(form.adults) !== 1 ? 's' : ''}${Number(form.children) > 0 ? ` · ${form.children} Child${Number(form.children) !== 1 ? 'ren' : ''}` : ''}${Number(form.infants) > 0 ? ` · ${form.infants} Infant${Number(form.infants) !== 1 ? 's' : ''}` : ''}`,
      `💰 *${getCurrencySymbol(form.currency)}${final.toLocaleString()} per person*`,
      '',
    ]
    if (form.overview) lines.push(form.overview, '')
    if (form.highlights) {
      lines.push('✨ *Highlights*')
      form.highlights.split('\n').filter(Boolean).forEach(h => lines.push(`  • ${h}`))
      lines.push('')
    }
    if (perks.length > 0) {
      lines.push('🎁 *Package Perks*')
      perks.forEach(p => {
        const preset = PRESET_PERKS.find(x => x.label === p)
        lines.push(`  ${preset ? preset.emoji : '✓'} ${p}`)
      })
      lines.push('')
    }
    if (hotelEntries.length > 0) {
      lines.push('🏨 *Hotels*')
      hotelEntries.forEach(h => {
        lines.push(`  📍 *${h.destination}${h.nights ? ` (${h.nights}N)` : ''}*`)
        lines.push(`     ${h.hotels.split('\n')[0]}`)
        lines.push(`     ${h.mealPlan} · ${h.roomType.split('\n')[0]}`)
      })
      lines.push('')
    }
    if (vehicleEntries.length > 0) {
      lines.push('🚗 *Vehicles & Transfers*')
      vehicleEntries.forEach(v => {
        lines.push(`  🚙 *${v.vehicleType}${v.seats ? ` (${v.seats} seats)` : ''}*${v.route ? ` — ${v.route}` : ''}${v.days > 1 ? ` · ${v.days} days` : ''}`)
        if (v.notes) lines.push(`     ${v.notes}`)
      })
      lines.push('')
    }
    if (dayItems.length > 0) {
      lines.push('📅 *Itinerary*')
      dayItems.forEach(d => {
        lines.push(`  *${d.title}*`)
        if (d.description) lines.push(`  ${d.description.split('\n')[0]}`)
      })
      lines.push('')
    }
    if (form.inclusions) {
      lines.push('✅ *Inclusions*')
      form.inclusions.split('\n').filter(Boolean).slice(0, 5).forEach(i => lines.push(`  ✓ ${i}`))
      lines.push('')
    }
    lines.push('_Contact us to book this package!_')
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  }

  function sharePackageAsPdfWA() {
    setShowPdfPreview(true)
  }

  function initNewForm() {
    skipDayEffect.current = true
    setForm(EMPTY_FORM)
    setEditingId(null)
    setDayItems([])
    setHotelEntries([])
    setVehicleEntries([])
    setPerks([])
    setPerkInput('')
    setHotelCsvMsg('')
    setVehicleCsvMsg('')
    setMarkupEnabled(false)
    setMarkupPercent('15')
    setDetailsOpen(true)
    setError('')
    setShowForm(true)
    setOriginalSnapshot(makeSnapshot(EMPTY_FORM, [], [], [], [], false, '15'))
  }

  function initEditForm(pkg: AgentPackage) {
    skipDayEffect.current = true
    const newDayItems = parseDayItems(pkg.dayWiseItinerary || '')
    const derivedDays = newDayItems.length > 0 ? String(newDayItems.length) : String(pkg.durationDays)
    const derivedNights = newDayItems.length > 0 ? String(Math.max(0, newDayItems.length - 1)) : String(pkg.durationNights)
    const newForm = {
      title: pkg.title,
      destination: pkg.destination,
      destinationCountry: pkg.destinationCountry || 'India',
      overview: pkg.overview,
      durationDays: derivedDays,
      durationNights: derivedNights,
      pricePerPerson: String(pkg.pricePerPerson),
      totalPrice: pkg.totalPrice != null ? String(pkg.totalPrice) : '',
      gst: pkg.gst != null ? String(pkg.gst) : '',
      currency: (pkg as any).currency || 'INR',
      maxGroupSize: String(pkg.maxGroupSize),
      minGroupSize: String(pkg.minGroupSize || 1),
      adults: String(pkg.adults ?? 2),
      children: String(pkg.children ?? 0),
      infants: String(pkg.infants ?? 0),
      travelType: pkg.travelType,
      theme: pkg.theme,
      mood: pkg.mood,
      starCategory: pkg.starCategory,
      inclusions: Array.isArray(pkg.inclusions) ? pkg.inclusions.join('\n') : pkg.inclusions,
      exclusions: Array.isArray(pkg.exclusions) ? pkg.exclusions.join('\n') : pkg.exclusions,
      highlights: Array.isArray(pkg.highlights) ? pkg.highlights.join('\n') : pkg.highlights,
      dayWiseItinerary: pkg.dayWiseItinerary,
      primaryImageUrl: pkg.primaryImageUrl || '',
      seasonalAvailability: pkg.seasonalAvailability || 'Year Round',
      paymentPolicy: (pkg as any).paymentPolicy || '',
      cancellationPolicy: (pkg as any).cancellationPolicy || '',
    }
    const newHotelEntries = Array.isArray(pkg.hotels) ? pkg.hotels : []
    const newVehicleEntries = Array.isArray(pkg.vehicles) ? pkg.vehicles : []
    const newPerks = Array.isArray(pkg.perks) ? pkg.perks : []
    setForm(newForm)
    setDayItems(newDayItems)
    setHotelEntries(newHotelEntries)
    setVehicleEntries(newVehicleEntries)
    setPerks(newPerks)
    setPerkInput('')
    setHotelCsvMsg('')
    setVehicleCsvMsg('')
    setMarkupEnabled(false)
    setMarkupPercent('15')
    setDetailsOpen(true)
    setEditingId(pkg.id)
    setError('')
    setShowForm(true)
    setOriginalSnapshot(makeSnapshot(newForm, newDayItems, newHotelEntries, newVehicleEntries, newPerks, false, '15'))
  }

  function openNewForm() {
    router.push('/dmc-dashboard/packages/new')
  }

  function openEditForm(pkg: AgentPackage) {
    router.push(`/dmc-dashboard/packages/${pkg.id}/edit`)
  }

  // Respond to URL-driven create/edit/list props
  useEffect(() => {
    if (openCreate) {
      initNewForm()
    } else if (!openEditId) {
      setShowForm(false)
      setEditingId(null)
    }
  }, [openCreate, openEditId])

  useEffect(() => {
    if (openEditId && packages.length > 0) {
      const pkg = packages.find(p => p.id === openEditId)
      if (pkg) initEditForm(pkg)
    }
  }, [openEditId, packages])

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImgUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', '/packages')
      fd.append('fileName', `pkg_${agentId}_${Date.now()}`)
      const res = await fetch('/api/imagekit/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.success) {
        setForm(p => ({ ...p, primaryImageUrl: data.url }))
      }
    } catch (e) { console.error(e) } finally {
      setImgUploading(false)
      if (imgInputRef.current) imgInputRef.current.value = ''
    }
  }

  async function handleSave() {
    setError('')
    if (!form.title || !form.destination || (!form.pricePerPerson && !form.totalPrice)) {
      setError('Title, destination, and at least one price (per person or total) are required.')
      return
    }
    if (form.starCategory && hotelEntries.length === 0) {
      setError('Hotels & Accommodation requires at least 1 hotel when a star category is selected.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        agentId,
        title: form.title,
        destination: form.destination,
        destinationCountry: form.destinationCountry,
        overview: form.overview,
        durationDays: Number(form.durationDays),
        durationNights: Number(form.durationNights),
        pricePerPerson: Number(form.pricePerPerson),
        totalPrice: form.totalPrice !== '' ? Number(form.totalPrice) : null,
        gst: form.gst !== '' ? Number(form.gst) : null,
        currency: form.currency || 'INR',
        priceInINR: Math.round(Number(form.pricePerPerson) * exchangeRate),
        maxGroupSize: Number(form.maxGroupSize) || 20,
        minGroupSize: Number(form.minGroupSize) || 1,
        adults: Number(form.adults) || 0,
        children: Number(form.children) || 0,
        infants: Number(form.infants) || 0,
        travelType: form.travelType,
        theme: form.theme,
        mood: form.mood,
        starCategory: form.starCategory,
        inclusions: form.inclusions.split('\n').filter(Boolean),
        exclusions: form.exclusions.split('\n').filter(Boolean),
        highlights: form.highlights.split('\n').filter(Boolean),
        dayWiseItinerary: dayItems.length > 0 ? serializeDayItems(dayItems) : form.dayWiseItinerary,
        hotels: hotelEntries,
        vehicles: vehicleEntries,
        perks,
        primaryImageUrl: form.primaryImageUrl,
        seasonalAvailability: form.seasonalAvailability,
        markupPercent: markupEnabled ? Number(markupPercent) : 0,
        paymentPolicy: form.paymentPolicy.trim(),
        cancellationPolicy: form.cancellationPolicy.trim(),
      }

      let res: Response
      if (editingId) {
        res = await fetch(`/api/agent/packages/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/agent/packages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      fetchPackages()
      router.push('/dmc-dashboard/packages')
    } catch (e: any) {
      setError(e.message || 'Failed to save package.')
    } finally {
      setSaving(false)
    }
  }

  function openSaveAsModal() {
    setSaveAsName(form.title ? `${form.title} (Copy)` : '')
    setShowSaveAsModal(true)
  }

  async function handleSaveAs() {
    setError('')
    if (!saveAsName.trim()) {
      setError('Package name is required for Save As.')
      return
    }
    if (!form.destination || (!form.pricePerPerson && !form.totalPrice)) {
      setError('Destination and at least one price (per person or total) are required.')
      return
    }
    if (form.starCategory && hotelEntries.length === 0) {
      setError('Hotels & Accommodation requires at least 1 hotel when a star category is selected.')
      return
    }
    setShowSaveAsModal(false)
    setSaving(true)
    try {
      const payload = {
        agentId,
        title: saveAsName.trim(),
        destination: form.destination,
        destinationCountry: form.destinationCountry,
        overview: form.overview,
        durationDays: Number(form.durationDays),
        durationNights: Number(form.durationNights),
        pricePerPerson: Number(form.pricePerPerson),
        totalPrice: form.totalPrice !== '' ? Number(form.totalPrice) : null,
        gst: form.gst !== '' ? Number(form.gst) : null,
        currency: form.currency || 'INR',
        priceInINR: Math.round(Number(form.pricePerPerson) * exchangeRate),
        maxGroupSize: Number(form.maxGroupSize) || 20,
        minGroupSize: Number(form.minGroupSize) || 1,
        adults: Number(form.adults) || 0,
        children: Number(form.children) || 0,
        infants: Number(form.infants) || 0,
        travelType: form.travelType,
        theme: form.theme,
        mood: form.mood,
        starCategory: form.starCategory,
        inclusions: form.inclusions.split('\n').filter(Boolean),
        exclusions: form.exclusions.split('\n').filter(Boolean),
        highlights: form.highlights.split('\n').filter(Boolean),
        dayWiseItinerary: dayItems.length > 0 ? serializeDayItems(dayItems) : form.dayWiseItinerary,
        hotels: hotelEntries,
        vehicles: vehicleEntries,
        perks,
        primaryImageUrl: form.primaryImageUrl,
        seasonalAvailability: form.seasonalAvailability,
        markupPercent: markupEnabled ? Number(markupPercent) : 0,
        paymentPolicy: form.paymentPolicy.trim(),
        cancellationPolicy: form.cancellationPolicy.trim(),
      }
      const res = await fetch('/api/agent/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      fetchPackages()
      router.push('/dmc-dashboard/packages')
    } catch (e: any) {
      setError(e.message || 'Failed to save as new package.')
    } finally {
      setSaving(false)
    }
  }

  async function downloadPdf() {
    const base = Number(form.pricePerPerson) || 0
    const finalPrice = markupEnabled ? base * (1 + Number(markupPercent) / 100) : base
    await openPackagePdfWindow({
      title: form.title || 'Travel Package',
      destination: form.destination,
      destinationCountry: form.destinationCountry,
      heroImage: form.primaryImageUrl || undefined,
      durationDays: Number(form.durationDays) || undefined,
      durationNights: Number(form.durationNights) || undefined,
      starCategory: form.starCategory || undefined,
      travelType: form.travelType || undefined,
      theme: form.theme || undefined,
      mood: form.mood || undefined,
      currency: form.currency || 'INR',
      pricePerPerson: finalPrice > 0 && !Number(form.totalPrice) ? finalPrice : null,
      totalPrice: Number(form.totalPrice) > 0 ? Number(form.totalPrice) : null,
      gst: form.gst !== '' ? Number(form.gst) : null,
      groupSize: (Number(form.adults) || 0) + (Number(form.children) || 0) + (Number(form.infants) || 0) || undefined,
      adults: Number(form.adults) || undefined,
      kids: Number(form.children) || undefined,
      overview: form.overview || undefined,
      highlights: form.highlights.split('\n').filter(Boolean),
      inclusions: form.inclusions.split('\n').filter(Boolean),
      exclusions: form.exclusions.split('\n').filter(Boolean),
      dayWiseItinerary: dayItems.length > 0 ? serializeDayItems(dayItems) : form.dayWiseItinerary || undefined,
      hotels: hotelEntries.length > 0 ? hotelEntries : undefined,
      vehicles: vehicleEntries.length > 0 ? vehicleEntries : undefined,
      paymentPolicy: form.paymentPolicy || undefined,
      cancellationPolicy: form.cancellationPolicy || undefined,
      brandName: companyName,
      agentContactName: contactName || undefined,
      agentLogoUrl: logoUrl || undefined,
      termsVariant: 'brochure',
    })
  }

  async function toggleActive(pkg: AgentPackage) {
    await fetch(`/api/agent/packages/${pkg.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, isActive: !pkg.isActive }),
    })
    fetchPackages()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/agent/packages/${id}?agentId=${agentId}`, { method: 'DELETE' })
    setDeleteConfirm(null)
    fetchPackages()
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setCsvUploading(true)
    setCsvResult(null)

    const issues: CsvValidationIssue[] = []

    const bail = (field: string, found: string, message: string, fix: string) => {
      setCsvResult({ success: 0, failed: 0, total: 0, issues: [{ row: null, field, found, message, fix, severity: 'error' }] })
    }

    try {
      // File size guard
      if (file.size > 5 * 1024 * 1024) {
        bail('file size', `${(file.size / 1024 / 1024).toFixed(1)} MB`, 'File exceeds 5 MB limit.', 'Split your CSV into multiple files with fewer rows.')
        return
      }

      const text = await file.text()
      const rows = parseCsv(text)

      if (rows.length === 0) {
        bail('file content', file.name, 'CSV has no data rows after the header.', 'Make sure the file has at least one data row below the header. Check it is UTF-8 encoded and not blank.')
        return
      }

      // ── Header validation ──────────────────────────────────────────────
      const foundCols = Object.keys(rows[0])

      const hasTitle = foundCols.some(c => ['title', 'package_title', 'name', 'package_name', 'tour_name'].includes(c))
      const hasDest  = foundCols.some(c => ['destination', 'dest', 'location', 'place'].includes(c))

      if (!hasTitle) {
        issues.push({
          row: null, field: 'header → title', found: foundCols.slice(0, 6).join(', '),
          message: 'Required column "title" is missing from your CSV headers.',
          fix: 'Add a column named title (the package name). Accepted alternatives: package_title, name.',
          severity: 'error',
        })
      }
      if (!hasDest) {
        issues.push({
          row: null, field: 'header → destination', found: foundCols.slice(0, 6).join(', '),
          message: 'Required column "destination" is missing from your CSV headers.',
          fix: 'Add a column named destination (travel location, e.g. "Andaman Islands"). Accepted alternatives: dest, location, place.',
          severity: 'error',
        })
      }

      const unknownCols = foundCols.filter(c => !CSV_KNOWN_COLS.has(c))
      if (unknownCols.length > 0) {
        issues.push({
          row: null, field: `unrecognized column${unknownCols.length > 1 ? 's' : ''}`,
          found: unknownCols.join(', '),
          message: `These columns are not recognized and will be ignored: ${unknownCols.join(', ')}`,
          fix: `Check for typos. Known columns: title, destination, duration_days, duration_nights, price_per_person, total_price, gst, currency, travel_type, star_category, theme, mood, overview, highlights, inclusions, exclusions, day_wise_itinerary, seasonal_availability, primary_image_url, hotels, vehicles, payment_policy, cancellation_policy.`,
          severity: 'warning',
        })
      }

      // Stop if required headers are absent — no point validating rows
      if (!hasTitle || !hasDest) {
        setCsvResult({ success: 0, failed: rows.length, total: rows.length, issues })
        return
      }

      // ── Row-by-row validation + upload ────────────────────────────────
      let success = 0
      let failed = 0

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const rowNum = i + 2 // +1 for header row, +1 for 1-based display
        const rowIssues: CsvValidationIssue[] = []

        const title       = (r['title'] || r['package_title'] || r['name'] || r['package_name'] || r['tour_name'] || '').trim()
        const destination = (r['destination'] || r['dest'] || r['location'] || r['place'] || '').trim()

        // Required fields
        if (!title) rowIssues.push({ row: rowNum, field: 'title', found: '(empty)', severity: 'error',
          message: 'Package title is empty.',
          fix: 'Fill the "title" column with a package name, e.g. "Andaman 6D/5N Beach Escape".' })

        if (!destination) rowIssues.push({ row: rowNum, field: 'destination', found: '(empty)', severity: 'error',
          message: 'Destination is empty.',
          fix: 'Fill the "destination" column with a city or region, e.g. "Andaman Islands" or "Bali".' })

        // Price
        const rawPrice = (r['price_per_person'] || r['price'] || r['cost'] || r['rate'] || r['amount'] || '').trim()
        let price = 0
        if (rawPrice) {
          const cleaned = rawPrice.replace(/[₹$€£,\s]/g, '')
          if (!/^\d+(\.\d+)?$/.test(cleaned)) {
            rowIssues.push({ row: rowNum, field: 'price_per_person', found: rawPrice, severity: 'error',
              message: `"${rawPrice}" is not a valid number.`,
              fix: 'Use digits only — no currency symbols, commas, or spaces. Write 25000, not ₹25,000.' })
          } else {
            price = Math.round(parseFloat(cleaned))
            if (price === 0) rowIssues.push({ row: rowNum, field: 'price_per_person', found: rawPrice, severity: 'warning',
              message: 'Price is 0 — is that intentional?',
              fix: 'Enter a positive price like 25000, or leave the column blank if pricing is TBD.' })
          }
        }

        // Currency
        const rawCurrency = (r['currency'] || '').trim()
        const currency = rawCurrency.toUpperCase() || 'INR'
        if (rawCurrency && !VALID_CURRENCY_CODES.has(currency)) {
          rowIssues.push({ row: rowNum, field: 'currency', found: rawCurrency, severity: 'error',
            message: `"${rawCurrency}" is not a supported currency code.`,
            fix: `Use a 3-letter code: ${[...VALID_CURRENCY_CODES].join(', ')}.` })
        }

        // Duration days
        const rawDays = (r['duration_days'] || r['days'] || r['trip_duration_days'] || r['total_days'] || '').trim()
        let durationDays = 0
        if (rawDays) {
          if (!/^\d+$/.test(rawDays)) {
            rowIssues.push({ row: rowNum, field: 'duration_days', found: rawDays, severity: 'warning',
              message: `"${rawDays}" is not a valid number of days.`,
              fix: 'Enter a plain integer like 6.' })
          } else {
            durationDays = parseInt(rawDays)
          }
        }

        // Duration nights
        const rawNights = (r['duration_nights'] || r['nights'] || r['trip_duration_nights'] || r['total_nights'] || '').trim()
        let durationNights = rawNights ? (parseInt(rawNights) || 0) : Math.max(0, durationDays - 1)
        if (rawNights && !/^\d+$/.test(rawNights)) {
          rowIssues.push({ row: rowNum, field: 'duration_nights', found: rawNights, severity: 'warning',
            message: `"${rawNights}" is not a valid number of nights.`,
            fix: 'Enter a plain integer like 5. Or leave blank — it auto-computes as days − 1.' })
          durationNights = Math.max(0, durationDays - 1)
        }

        // Travel type
        const rawTravelType = (r['travel_type'] || '').trim()
        if (rawTravelType && !VALID_TRAVEL_TYPE_SET.has(rawTravelType)) {
          rowIssues.push({ row: rowNum, field: 'travel_type', found: rawTravelType, severity: 'warning',
            message: `"${rawTravelType}" is not a recognized travel type — will default to "Leisure".`,
            fix: `Use one of: ${[...VALID_TRAVEL_TYPE_SET].join(', ')}.` })
        }

        // Image URL
        const imageUrl = (r['primary_image_url'] || r['image_url'] || r['image'] || r['photo_url'] || r['cover_image'] || '').trim()
        if (imageUrl && !imageUrl.startsWith('http')) {
          rowIssues.push({ row: rowNum, field: 'primary_image_url', found: imageUrl, severity: 'warning',
            message: 'Image URL does not start with http — it may not load.',
            fix: 'Provide a full URL starting with https://, e.g. https://cdn.example.com/img.jpg. Leave blank if you don\'t have one.' })
        }

        issues.push(...rowIssues)

        // Skip row if it has any hard errors
        if (rowIssues.some(iss => iss.severity === 'error')) { failed++; continue }

        // ── Upload ────────────────────────────────────────────────────
        try {
          let priceInINR = price
          if (currency !== 'INR' && price > 0) {
            try { const { rate } = await fetchINRRate(currency); priceInINR = Math.round(price * rate) }
            catch { /* fallback to raw price */ }
          }

          const rawTotalPrice = (r['total_price'] || '').trim()
          const totalPrice = rawTotalPrice ? (parseFloat(rawTotalPrice.replace(/[₹$€£,\s]/g, '')) || null) : null
          const rawGst = (r['gst'] || '').trim()
          const gst = rawGst ? (parseFloat(rawGst) || null) : null

          const payload = {
            agentId,
            title,
            destination,
            destinationCountry: (r['destination_country'] || r['country'] || 'India').trim(),
            overview: (r['overview'] || r['description'] || r['details'] || '').trim(),
            durationDays,
            durationNights,
            pricePerPerson: price,
            totalPrice,
            gst,
            currency,
            priceInINR,
            maxGroupSize: parseInt(r['max_group_size'] || '20') || 20,
            minGroupSize: parseInt(r['min_group_size'] || '1') || 1,
            travelType: VALID_TRAVEL_TYPE_SET.has(rawTravelType) ? rawTravelType : 'Leisure',
            theme: r['theme'] || '',
            mood: r['mood'] || '',
            starCategory: r['star_category'] || '',
            inclusions: (r['inclusions'] || '').split('|').map((s: string) => s.trim()).filter(Boolean),
            exclusions: (r['exclusions'] || '').split('|').map((s: string) => s.trim()).filter(Boolean),
            highlights: (r['highlights'] || '').split('|').map((s: string) => s.trim()).filter(Boolean),
            dayWiseItinerary: normalizeCsvItinerary(r['day_wise_itinerary'] || r['itinerary'] || r['day_plan'] || r['schedule'] || ''),
            primaryImageUrl: imageUrl.startsWith('http') ? imageUrl : '',
            seasonalAvailability: r['seasonal_availability'] || 'Year Round',
            hotels: parseCsvHotels(r['hotels'] || r['hotel'] || r['accommodation'] || ''),
            vehicles: parseCsvVehicles(r['vehicles'] || r['vehicle'] || r['transfers'] || r['transport'] || ''),
            paymentPolicy: (r['payment_policy'] || '').trim(),
            cancellationPolicy: (r['cancellation_policy'] || '').trim(),
          }

          const res = await fetch('/api/agent/packages', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          })
          if (res.ok) {
            success++
          } else {
            const d = await res.json()
            issues.push({ row: rowNum, field: 'server', found: '', severity: 'error',
              message: `Server rejected row: ${d.error || 'unknown error'}.`,
              fix: 'Check your account is active and all required fields are filled. If the error persists, contact support.' })
            failed++
          }
        } catch {
          issues.push({ row: rowNum, field: 'network', found: '', severity: 'error',
            message: 'Network error — server could not be reached.',
            fix: 'Check your internet connection and try uploading again.' })
          failed++
        }
      }

      setCsvResult({ success, failed, total: rows.length, issues })
      if (success > 0) fetchPackages()
    } catch (err: any) {
      setCsvResult({ success: 0, failed: 0, total: 0, issues: [{ row: null, field: 'file', found: file.name, severity: 'error',
        message: `Could not read file: ${err.message || 'unknown error'}.`,
        fix: 'Make sure the file is a valid UTF-8 encoded CSV. Try saving it from Excel or Google Sheets as "CSV UTF-8".' }] })
    } finally {
      setCsvUploading(false)
    }
  }

  function formAsPackage(): AgentPackage {
    return {
      id: editingId || '__preview__',
      agentId,
      title: form.title || 'Untitled Package',
      destination: form.destination,
      destinationCountry: form.destinationCountry,
      overview: form.overview,
      durationDays: Number(form.durationDays) || 0,
      durationNights: Number(form.durationNights) || 0,
      pricePerPerson: Number(form.pricePerPerson) || 0,
      totalPrice: form.totalPrice !== '' ? Number(form.totalPrice) : null,
      gst: form.gst !== '' ? Number(form.gst) : null,
      currency: form.currency || 'INR',
      maxGroupSize: Number(form.maxGroupSize) || 20,
      minGroupSize: Number(form.minGroupSize) || 1,
      adults: Number(form.adults) || 0,
      children: Number(form.children) || 0,
      infants: Number(form.infants) || 0,
      travelType: form.travelType,
      theme: form.theme,
      mood: form.mood,
      starCategory: form.starCategory,
      inclusions: form.inclusions.split('\n').filter(Boolean),
      exclusions: form.exclusions.split('\n').filter(Boolean),
      highlights: form.highlights.split('\n').filter(Boolean),
      dayWiseItinerary: form.dayWiseItinerary,
      hotels: hotelEntries,
      vehicles: vehicleEntries,
      perks,
      primaryImageUrl: form.primaryImageUrl,
      seasonalAvailability: form.seasonalAvailability,
      isActive: true,
    } as AgentPackage
  }

  // ── Open standalone print window for package brochure ───────────────────────
  function openPackagePrintWindow() {
    const base = Number(form.pricePerPerson) || 0
    const finalPrice = markupEnabled ? base * (1 + Number(markupPercent) / 100) : base
    const heroImage = form.primaryImageUrl || ''
    const inclusions = (form.inclusions || '').split('\n').filter(Boolean)
    const exclusions = (form.exclusions || '').split('\n').filter(Boolean)
    const highlights = (form.highlights || '').split('\n').filter(Boolean)
    const adultsCount = Number(form.adults) || 0
    const childrenCount = Number(form.children) || 0
    const infantsCount = Number(form.infants) || 0
    const totalPax = adultsCount + childrenCount + infantsCount

    const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

    const sym = getCurrencySymbol(form.currency)
    const fmt = (n: number) => `${sym}${n.toLocaleString()}`

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${esc(form.title || 'Package')} — Package Brochure</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;background:#fff}
@page{margin:0;size:A4}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.hero{position:relative;height:260px;overflow:hidden}
.hero img{width:100%;height:100%;object-fit:cover}
.hero-bg{width:100%;height:100%;background:linear-gradient(135deg,#7c3aed,#4f46e5)}
.overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.85) 0%,rgba(0,0,0,.35) 55%,rgba(0,0,0,.1) 100%)}
.hero-top{position:absolute;top:16px;left:20px;right:20px}
.hero-bot{position:absolute;bottom:20px;left:20px;right:20px}
.badge{background:#fff;color:#111;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;display:inline-block}
.qlabel{font-size:9px;font-weight:700;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.15em;margin-bottom:6px}
.ptitle{font-size:26px;font-weight:800;color:#fff;line-height:1.2}
.dest{font-size:13px;color:rgba(255,255,255,.75);margin-top:6px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);background:#7c3aed}
.sc{padding:10px 8px;text-align:center;border-left:1px solid rgba(255,255,255,.15)}.sc:first-child{border-left:none}
.sicon{font-size:16px}.slabel{font-size:8px;color:#ddd6fe;text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
.sval{font-size:11px;font-weight:700;color:#fff;margin-top:2px;line-height:1.3}
.body{padding:24px 28px}
.sec{margin-bottom:20px}
.stitle{font-size:10px;font-weight:800;color:#1f2937;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px;border-bottom:2px solid #ede9fe;padding-bottom:5px}
.pricebox{background:#7c3aed;border-radius:12px;padding:20px 24px;margin-bottom:20px}
.price-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.pricetag{font-size:9px;font-weight:700;color:#ddd6fe;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px}
.pricelarge{font-size:36px;font-weight:800;color:#fff;line-height:1}
.pricesub{font-size:11px;color:rgba(255,255,255,.65);margin-top:4px}
.priceright{text-align:right}
.pdlbl{font-size:9px;color:rgba(255,255,255,.5)}
.pdval{font-size:12px;font-weight:600;color:rgba(255,255,255,.85);margin-top:3px}
.price-details{display:flex;gap:0;margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.18)}
.pdetail{flex:1;padding:0 12px;border-left:1px solid rgba(255,255,255,.15)}.pdetail:first-child{padding-left:0;border-left:none}
.pdetail-lbl{font-size:9px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.05em}
.pdetail-val{font-size:14px;font-weight:800;color:#fff;margin-top:3px}
.overview{font-size:13px;color:#374151;line-height:1.6}
.typegrid{display:flex;flex-wrap:wrap;gap:8px}
.typepill{background:#ede9fe;border-radius:999px;padding:5px 14px;font-size:12px;color:#7c3aed;font-weight:600;display:inline-flex;align-items:center;gap:5px}
.typepill-lbl{font-size:9px;color:#9333ea;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
.hgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.hpill{display:flex;align-items:flex-start;gap:8px;background:#ede9fe;border-radius:10px;padding:8px 12px}
.hstar{color:#7c3aed;font-size:13px;flex-shrink:0}
.htext{font-size:12px;color:#374151;line-height:1.4}
.iegrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.icard{background:#f0fdf4;border-radius:12px;padding:14px}.ecard{background:#fff1f2;border-radius:12px;padding:14px}
.ititle{font-size:10px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px}
.etitle{font-size:10px;font-weight:700;color:#be123c;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px}
.li{display:flex;align-items:flex-start;gap:8px;margin-bottom:6px}
.idot{width:16px;height:16px;border-radius:50%;background:#22c55e;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;color:#fff;font-size:8px;font-weight:700}
.edot{width:16px;height:16px;border-radius:50%;background:#f87171;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;color:#fff;font-size:8px;font-weight:700}
.litext{font-size:12px;color:#374151;line-height:1.4}
.hoteltable{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:4px}
.hoteltable th{background:#f3f4f6;padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:#374151;border:1px solid #e5e7eb}
.hoteltable td{padding:8px 10px;border:1px solid #e5e7eb;color:#374151}
.hoteltable tr:nth-child(even) td{background:#fafafa}
.vehicletable{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:4px}
.vehicletable th{background:#eff6ff;padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:#1d4ed8;border:1px solid #dbeafe}
.vehicletable td{padding:8px 10px;border:1px solid #dbeafe;color:#374151}
.vehicletable tr:nth-child(even) td{background:#f0f9ff}
.perksgrid{display:flex;flex-wrap:wrap;gap:6px}
.perk{background:#fdf4ff;border:1px solid #e9d5ff;border-radius:999px;padding:5px 12px;font-size:11px;color:#7c3aed;font-weight:600;display:flex;align-items:center;gap:5px}
.dayitem{display:flex;gap:12px;margin-bottom:4px}
.dayleft{display:flex;flex-direction:column;align-items:center}
.daynum{width:28px;height:28px;border-radius:50%;background:#7c3aed;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.dayline{width:2px;background:#ede9fe;flex:1;margin-top:4px;min-height:16px}
.daycontent{padding-bottom:14px;flex:1}
.daytitle{font-size:13px;font-weight:700;color:#111;line-height:1.4}
.daydesc{font-size:11px;color:#6b7280;margin-top:3px;line-height:1.5}
.terms{border-top:1px solid #f3f4f6;padding-top:16px;margin-bottom:16px}
.termrow{display:flex;gap:6px;font-size:11px;color:#9ca3af;margin-bottom:4px}
.footer{background:#7c3aed;border-radius:12px;padding:14px 20px;display:flex;align-items:center;justify-content:space-between}
.ftname{font-size:14px;font-weight:700;color:#fff}.ftsub{font-size:10px;color:#ddd6fe;margin-top:2px}
.ftthanks{font-size:11px;color:#ddd6fe}
</style></head><body>
<div class="hero">
  ${heroImage ? `<img src="${heroImage}" alt="" />` : '<div class="hero-bg"></div>'}
  <div class="overlay"></div>
  <div class="hero-top"><span class="badge">Package Brochure</span></div>
  <div class="hero-bot">
    <p class="qlabel">Travel Package</p>
    <h1 class="ptitle">${esc(form.title || 'Untitled Package')}</h1>
    <p class="dest">📍 ${esc(form.destination)}${form.destinationCountry ? ', ' + esc(form.destinationCountry) : ''}</p>
  </div>
</div>
<div class="stats">
  ${[
    ['🌙', 'Duration', form.durationNights && form.durationDays ? `${form.durationNights}N / ${form.durationDays}D` : form.durationDays ? `${form.durationDays} Days` : '—'],
    ['⭐', 'Category', form.starCategory || '—'],
    ['✈️', 'Travel Type', form.travelType || '—'],
    ['📅', 'Availability', form.seasonalAvailability || 'Year Round'],
  ].map(([icon,label,val]) => `<div class="sc"><div class="sicon">${icon}</div><div class="slabel">${label}</div><div class="sval">${val}</div></div>`).join('')}
</div>
<div class="body">

  <!-- Pricing Configuration -->
  <div class="pricebox">
    <div class="price-top">
      <div>
        ${Number(form.totalPrice) > 0
          ? `<div class="pricetag">Total Price</div>
             <div class="pricelarge">${fmt(Number(form.totalPrice))}</div>
             <div class="pricesub">Full package${form.currency !== 'INR' ? ` · ${esc(form.currency)}` : ''}</div>
             ${form.gst ? `<div class="pricesub" style="margin-top:2px">+ ${esc(form.gst)}% GST applicable</div>` : ''}`
          : `<div class="pricetag">Pricing Configuration</div>
             <div class="pricelarge">${finalPrice > 0 ? fmt(finalPrice) : 'To be confirmed'}</div>
             <div class="pricesub">Per person${form.currency !== 'INR' ? ` · ${esc(form.currency)}` : ''}</div>
             ${markupEnabled && base > 0 ? `<div class="pricesub" style="margin-top:2px">Base: ${fmt(base)} + ${markupPercent}% markup</div>` : ''}
             ${form.gst ? `<div class="pricesub" style="margin-top:2px">+ ${esc(form.gst)}% GST applicable</div>` : ''}`
        }
      </div>
      <div class="priceright">
        <div class="pdlbl">Published on</div>
        <div class="pdval">${dateStr}</div>
        ${(form.minGroupSize || form.maxGroupSize) ? `<div class="pdlbl" style="margin-top:8px">Group Size</div><div class="pdval">${form.minGroupSize || 1} – ${form.maxGroupSize || '—'} pax</div>` : ''}
      </div>
    </div>
    ${totalPax > 0 ? `
    <div class="price-details">
      ${adultsCount > 0 ? `<div class="pdetail"><div class="pdetail-lbl">👤 Adults</div><div class="pdetail-val">${adultsCount}</div></div>` : ''}
      ${childrenCount > 0 ? `<div class="pdetail"><div class="pdetail-lbl">👦 Children</div><div class="pdetail-val">${childrenCount}</div></div>` : ''}
      ${infantsCount > 0 ? `<div class="pdetail"><div class="pdetail-lbl">👶 Infants</div><div class="pdetail-val">${infantsCount}</div></div>` : ''}
      <div class="pdetail"><div class="pdetail-lbl">👥 Total Pax</div><div class="pdetail-val">${totalPax}</div></div>
    </div>` : ''}
  </div>

  <!-- Overview -->
  ${form.overview ? `<div class="sec"><div class="stitle">Overview</div><p class="overview">${esc(form.overview)}</p></div>` : ''}

  <!-- Package Type & Theme -->
  ${(form.travelType || form.theme || form.mood) ? `<div class="sec"><div class="stitle">Package Type &amp; Theme</div><div class="typegrid">
    ${form.travelType ? `<span class="typepill"><span class="typepill-lbl">Type</span>${esc(form.travelType)}</span>` : ''}
    ${form.theme ? `<span class="typepill"><span class="typepill-lbl">Theme</span>${esc(form.theme)}</span>` : ''}
    ${form.mood ? `<span class="typepill"><span class="typepill-lbl">Mood</span>${esc(form.mood)}</span>` : ''}
  </div></div>` : ''}

  <!-- Highlights -->
  ${highlights.length ? `<div class="sec"><div class="stitle">Highlights</div><div class="hgrid">${highlights.map(h=>`<div class="hpill"><span class="hstar">✦</span><span class="htext">${esc(h)}</span></div>`).join('')}</div></div>` : ''}

  <!-- Package Perks -->
  ${perks.length > 0 ? `<div class="sec"><div class="stitle">Package Perks</div><div class="perksgrid">${perks.map(p=>{const pr=PRESET_PERKS.find(x=>x.label===p);return `<span class="perk">${pr?pr.emoji:'✓'} ${esc(p)}</span>`}).join('')}</div></div>` : ''}

  <!-- Hotels & Accommodation -->
  ${hotelEntries.length > 0 ? `<div class="sec"><div class="stitle">Hotels &amp; Accommodation</div><table class="hoteltable"><thead><tr><th>Destination</th><th>Hotel(s)</th><th>Meal Plan</th><th>Room Type</th></tr></thead><tbody>${hotelEntries.map((h)=>`<tr><td><strong>${esc(h.destination)}${h.nights?` (${h.nights}N)`:''}</strong></td><td>${esc(h.hotels)}</td><td>${esc(h.mealPlan)}</td><td>${esc(h.roomType)}</td></tr>`).join('')}</tbody></table></div>` : ''}

  <!-- Vehicles & Transfers -->
  ${vehicleEntries.length > 0 ? `<div class="sec"><div class="stitle">Vehicles &amp; Transfers</div><table class="vehicletable"><thead><tr><th>Vehicle Type</th><th>Seats</th><th>Route / Transfers</th><th>Days</th><th>Notes</th></tr></thead><tbody>${vehicleEntries.map((v)=>`<tr><td><strong>${esc(v.vehicleType)}</strong></td><td>${v.seats}</td><td>${esc(v.route)}</td><td>${v.days}</td><td>${esc(v.notes)}</td></tr>`).join('')}</tbody></table></div>` : ''}

  <!-- Master Itinerary -->
  ${dayItems.length ? `<div class="sec"><div class="stitle">Master Itinerary</div>${dayItems.map((d,i)=>`<div class="dayitem"><div class="dayleft"><div class="daynum">${String(i+1).padStart(2,'0')}</div>${i<dayItems.length-1?'<div class="dayline"></div>':''}</div><div class="daycontent"><div class="daytitle">${esc(d.title)}</div>${d.description?`<div class="daydesc">${esc(d.description).replace(/\n/g,'<br>')}</div>`:''}</div></div>`).join('')}</div>` : ''}

  <!-- Inclusions & Exclusions -->
  ${(inclusions.length || exclusions.length) ? `<div class="sec"><div class="iegrid">
    ${inclusions.length ? `<div class="icard"><div class="ititle">✓ Inclusions</div>${inclusions.map(i=>`<div class="li"><div class="idot">✓</div><span class="litext">${esc(i)}</span></div>`).join('')}</div>` : ''}
    ${exclusions.length ? `<div class="ecard"><div class="etitle">✗ Exclusions</div>${exclusions.map(e=>`<div class="li"><div class="edot">✗</div><span class="litext">${esc(e)}</span></div>`).join('')}</div>` : ''}
  </div></div>` : ''}

  <div class="terms">
    <div class="stitle">Terms &amp; Conditions</div>
    ${['This brochure is for reference only.','Prices are subject to availability at the time of booking.','A deposit may be required to confirm the booking.','Contact us for custom packages and group bookings.'].map(t=>`<div class="termrow"><span>•</span><span>${t}</span></div>`).join('')}
  </div>
  <div class="footer">
    <div><div class="ftname">${esc(companyName)}</div><div class="ftsub">Your trusted travel partner</div></div>
    <div class="ftthanks">Thank you for your interest ✈️</div>
  </div>
</div>
</body></html>`

    const win = window.open('', '_blank', 'width=850,height=1100')
    if (!win) { alert('Please allow pop-ups to generate the PDF.'); return }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 800)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div></div>
        <div className="flex items-center gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleCsvUpload}
          />
          <button
            onClick={() => setShowCsvGuide(v => !v)}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            <Upload className="w-4 h-4" /> Upload CSV
          </button>
          <button
            onClick={openNewForm}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Package
          </button>
        </div>
      </div>

      {/* CSV Guide & Upload */}
      {showCsvGuide && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-blue-900 text-sm">📦 Bulk Upload via CSV</h3>
              <p className="text-xs text-blue-700 mt-1">
                Upload a <code className="bg-blue-100 px-1 py-0.5 rounded text-blue-800 font-mono">.csv</code> file to add multiple packages at once.
                Only <strong>title</strong> and <strong>destination</strong> are required.{' '}
                <span className="text-blue-500 font-semibold">Download the sample CSV below to get started instantly.</span>
              </p>
            </div>
            <button onClick={() => setShowCsvGuide(false)} className="text-blue-400 hover:text-blue-700 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Day-wise itinerary callout */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
            <p className="text-xs font-bold text-amber-800 mb-2">📅 How to format Day-Wise Itinerary in CSV</p>
            <p className="text-xs text-amber-700 mb-2.5">
              Use <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold text-orange-700">||</code> (double pipe) to separate each day inside a quoted CSV cell.
              Each day starts with <code className="bg-amber-100 px-1 rounded font-mono">Day N:</code> followed by a title, then description as the next segment:
            </p>
            <div className="bg-white border border-amber-200 rounded-lg p-3 font-mono text-[11px] text-gray-700 leading-relaxed overflow-x-auto whitespace-nowrap">
              <span className="text-gray-400 select-none">&quot;</span>
              <span className="text-purple-700 font-bold">Day 1: Arrive Mumbai</span>
              <span className="text-gray-500">||Welcome and check-in. Visit Gateway of India.</span>
              <span className="text-orange-500 font-bold">||</span>
              <span className="text-purple-700 font-bold">Day 2: Elephanta Caves</span>
              <span className="text-gray-500">||Ferry to Elephanta Island. UNESCO Heritage caves.</span>
              <span className="text-orange-500 font-bold">||</span>
              <span className="text-purple-700 font-bold">Day 3: Departure</span>
              <span className="text-gray-500">||Transfer to airport. Tour ends.</span>
              <span className="text-gray-400 select-none">&quot;</span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] text-amber-700">
              <span className="bg-amber-100 border border-amber-200 rounded-full px-2.5 py-0.5">✓ Use <code className="font-bold">||</code> to separate each day</span>
              <span className="bg-amber-100 border border-amber-200 rounded-full px-2.5 py-0.5">✓ Title segment then description segment per day</span>
              <span className="bg-amber-100 border border-amber-200 rounded-full px-2.5 py-0.5">✓ Wrap entire cell in double-quotes</span>
              <span className="bg-amber-100 border border-amber-200 rounded-full px-2.5 py-0.5">✓ Also supports <code className="font-bold">\n</code> escape format</span>
            </div>
          </div>

          {/* Hotels & Vehicles callout */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
            <p className="text-xs font-bold text-emerald-800 mb-2">🏨🚗 How to format Hotels & Vehicles in CSV</p>
            <p className="text-xs text-emerald-700 mb-2.5">
              Use <code className="bg-emerald-100 px-1.5 py-0.5 rounded font-mono font-bold text-emerald-800">;</code> to separate fields within one entry, and{' '}
              <code className="bg-emerald-100 px-1.5 py-0.5 rounded font-mono font-bold text-emerald-800">||</code> to add multiple hotels or vehicles in one cell:
            </p>
            <div className="space-y-2">
              <div>
                <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">hotels column</p>
                <div className="bg-white border border-emerald-200 rounded-lg p-2.5 font-mono text-[11px] text-gray-700 overflow-x-auto whitespace-nowrap">
                  <span className="text-gray-400">&quot;</span>
                  <span className="text-emerald-700 font-bold">Kuta</span><span className="text-orange-500 font-bold">;</span>
                  <span className="text-gray-600">2</span><span className="text-orange-500 font-bold">;</span>
                  <span className="text-gray-600">Fairfield by Marriott</span><span className="text-orange-500 font-bold">;</span>
                  <span className="text-gray-600">Breakfast</span><span className="text-orange-500 font-bold">;</span>
                  <span className="text-gray-600">Deluxe Room</span>
                  <span className="text-orange-500 font-bold">||</span>
                  <span className="text-emerald-700 font-bold">Ubud</span><span className="text-orange-500 font-bold">;</span>
                  <span className="text-gray-600">3</span><span className="text-orange-500 font-bold">;</span>
                  <span className="text-gray-600">Alaya Resort</span><span className="text-orange-500 font-bold">;</span>
                  <span className="text-gray-600">Half Board</span><span className="text-orange-500 font-bold">;</span>
                  <span className="text-gray-600">Pool Villa</span>
                  <span className="text-gray-400">&quot;</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">vehicles column</p>
                <div className="bg-white border border-blue-200 rounded-lg p-2.5 font-mono text-[11px] text-gray-700 overflow-x-auto whitespace-nowrap">
                  <span className="text-gray-400">&quot;</span>
                  <span className="text-blue-700 font-bold">Innova Crysta</span><span className="text-orange-500 font-bold">;</span>
                  <span className="text-gray-600">7</span><span className="text-orange-500 font-bold">;</span>
                  <span className="text-gray-600">Airport transfers</span><span className="text-orange-500 font-bold">;</span>
                  <span className="text-gray-600">1</span><span className="text-orange-500 font-bold">;</span>
                  <span className="text-gray-600">AC with driver</span>
                  <span className="text-orange-500 font-bold">||</span>
                  <span className="text-blue-700 font-bold">Tempo Traveller (12 Seater)</span><span className="text-orange-500 font-bold">;</span>
                  <span className="text-gray-600">12</span><span className="text-orange-500 font-bold">;</span>
                  <span className="text-gray-600">All sightseeing</span><span className="text-orange-500 font-bold">;</span>
                  <span className="text-gray-600">5</span><span className="text-orange-500 font-bold">;</span>
                  <span className="text-gray-600">AC comfortable</span>
                  <span className="text-gray-400">&quot;</span>
                </div>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] text-emerald-700">
              <span className="bg-emerald-100 border border-emerald-200 rounded-full px-2.5 py-0.5">✓ Fields: Destination ; Nights ; Hotel Name ; Meal Plan ; Room Type</span>
              <span className="bg-blue-100 border border-blue-200 rounded-full px-2.5 py-0.5 text-blue-700">✓ Vehicle fields: Type ; Seats ; Route ; Days ; Notes</span>
              <span className="bg-emerald-100 border border-emerald-200 rounded-full px-2.5 py-0.5">✓ Use <code className="font-bold">||</code> between multiple entries</span>
            </div>
          </div>

          <div className="bg-white border border-blue-200 rounded-xl p-3 overflow-x-auto">
            <p className="text-[11px] font-bold text-gray-500 mb-1.5">📋 All Supported Columns</p>
            <table className="text-xs text-gray-700 w-full">
              <thead>
                <tr className="text-gray-500 text-left">
                  <th className="pr-4 pb-1 font-semibold">Column</th>
                  <th className="pr-4 pb-1 font-semibold">Required</th>
                  <th className="pb-1 font-semibold">Notes / Example</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  ['title', 'Yes', 'Andaman 5N 6D Beach Escape'],
                  ['destination', 'Yes', 'Andaman Islands'],
                  ['destination_country', 'No', 'India'],
                  ['duration_days', 'No', '6'],
                  ['duration_nights', 'No', '5  (auto-computed as days−1 if omitted)'],
                  ['price_per_person', 'No', '25000'],
                  ['total_price', 'No', '150000 — optional total for the whole group; if set, PDF shows Total Price instead of Per Person'],
                  ['gst', 'No', '5 — GST percentage (e.g. 5 for 5%); shown as "+ 5% GST" on the PDF'],
                  ['currency', 'No', 'INR (default) / USD / EUR / GBP / AED / SGD / AUD — auto-converted to INR'],
                  ['travel_type', 'No', 'Leisure / Honeymoon / Adventure / Family / Corporate'],
                  ['star_category', 'No', '3-Star / 4-Star / 5-Star / leave blank for no hotel'],
                  ['theme', 'No', 'Beach / Wildlife / Heritage / Adventure / Cultural'],
                  ['mood', 'No', 'Relaxing / Romantic / Family Fun / Adventurous'],
                  ['overview', 'No', 'Short paragraph describing the package'],
                  ['highlights', 'No', 'Scuba diving|Sunset cruise|Glass-bottom boat  (pipe-separated)'],
                  ['inclusions', 'No', 'Flights|Hotel accommodation|Daily breakfast  (pipe-separated)'],
                  ['exclusions', 'No', 'Travel insurance|Visa fees  (pipe-separated)'],
                  ['day_wise_itinerary', 'No', 'Day 1: Arrive||Check-in and rest||Day 2: Sightseeing||Museum visit  (|| separated)'],
                  ['seasonal_availability', 'No', 'Oct–May / Year Round'],
                  ['primary_image_url', 'No', 'https://cdn.example.com/package.jpg'],
                  ['hotels', 'No', 'Dest;Nights;Hotel Name;Meal Plan;Room Type  — use || to add multiple hotels'],
                  ['vehicles', 'No', 'Vehicle Type;Seats;Route;Days;Notes  — use || to add multiple vehicles'],
                  ['payment_policy', 'No', '30% advance to confirm. Balance due 21 days before travel.'],
                  ['cancellation_policy', 'No', '30+ days: 25% charge. 15–29 days: 50% charge. Less than 7 days: non-refundable.'],
                ].map(([col, req, ex]) => (
                  <tr key={col}>
                    <td className="pr-4 py-0.5 font-mono text-blue-700 whitespace-nowrap">{col}</td>
                    <td className={`pr-4 py-0.5 font-semibold whitespace-nowrap ${req === 'Yes' ? 'text-red-600' : 'text-gray-400'}`}>{req}</td>
                    <td className="py-0.5 text-gray-500 text-[11px]">{ex}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={downloadSampleCsv}
              className="flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-300 hover:border-green-400 text-gray-700 hover:text-green-700 font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
            >
              <Download className="w-4 h-4 text-green-600" /> Download Sample CSV
            </button>
            <button
              onClick={() => csvInputRef.current?.click()}
              disabled={csvUploading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors"
            >
              {csvUploading ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading…</> : <><Upload className="w-4 h-4" />Choose CSV File</>}
            </button>
            <p className="text-xs text-gray-400">Supported: .csv, UTF-8 encoded</p>
          </div>
        </div>
      )}

      {/* CSV upload result */}
      {csvResult && (() => {
        const errors   = csvResult.issues.filter(i => i.severity === 'error')
        const warnings = csvResult.issues.filter(i => i.severity === 'warning')
        const fileIssues = csvResult.issues.filter(i => i.row === null)
        const rowIssues  = csvResult.issues.filter(i => i.row !== null)
        const allOk = csvResult.failed === 0 && errors.length === 0
        return (
          <div className={`rounded-2xl border overflow-hidden ${allOk ? 'border-green-200' : errors.length > 0 ? 'border-red-200' : 'border-amber-200'}`}>
            {/* Summary bar */}
            <div className={`px-4 py-3 flex items-center gap-3 flex-wrap ${allOk ? 'bg-green-50' : errors.length > 0 ? 'bg-red-50' : 'bg-amber-50'}`}>
              {allOk
                ? <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                : <AlertCircle className={`w-4 h-4 flex-shrink-0 ${errors.length > 0 ? 'text-red-500' : 'text-amber-500'}`} />}
              <div className="flex gap-3 flex-wrap text-sm font-semibold">
                {csvResult.success > 0 && (
                  <span className="text-green-700">✓ {csvResult.success} imported</span>
                )}
                {csvResult.failed > 0 && (
                  <span className="text-red-600">✗ {csvResult.failed} failed</span>
                )}
                {warnings.length > 0 && (
                  <span className="text-amber-600">⚠ {warnings.length} warning{warnings.length !== 1 ? 's' : ''}</span>
                )}
                {csvResult.success === 0 && csvResult.failed === 0 && errors.length === 0 && (
                  <span className="text-gray-500">No rows processed</span>
                )}
              </div>
              <button onClick={() => setCsvResult(null)} className="ml-auto text-gray-400 hover:text-gray-600 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Issue cards */}
            {csvResult.issues.length > 0 && (
              <div className="divide-y divide-gray-100 bg-white max-h-[420px] overflow-y-auto">
                {/* File-level issues first */}
                {fileIssues.map((iss, idx) => (
                  <div key={`f-${idx}`} className={`px-4 py-3 ${iss.severity === 'error' ? 'bg-red-50/60' : 'bg-amber-50/60'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${iss.severity === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {iss.severity === 'error' ? '✗ ERROR' : '⚠ WARNING'}
                      </span>
                      <span className="text-xs font-mono text-gray-500">{iss.field}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mb-0.5">{iss.message}</p>
                    {iss.found && (
                      <p className="text-xs text-gray-500 mb-1">
                        Found: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-700">{iss.found}</code>
                      </p>
                    )}
                    <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 mt-1">
                      <span className="font-bold">How to fix: </span>{iss.fix}
                    </p>
                  </div>
                ))}

                {/* Row-level errors */}
                {rowIssues.filter(i => i.severity === 'error').map((iss, idx) => (
                  <div key={`e-${idx}`} className="px-4 py-3 bg-red-50/40">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">✗ ERROR</span>
                      <span className="text-xs font-bold text-gray-600">Row {iss.row}</span>
                      <span className="text-xs font-mono text-gray-400">· {iss.field}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mb-0.5">{iss.message}</p>
                    {iss.found && (
                      <p className="text-xs text-gray-500 mb-1">
                        Found: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-700">{iss.found}</code>
                      </p>
                    )}
                    <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 mt-1">
                      <span className="font-bold">How to fix: </span>{iss.fix}
                    </p>
                  </div>
                ))}

                {/* Row-level warnings */}
                {rowIssues.filter(i => i.severity === 'warning').map((iss, idx) => (
                  <div key={`w-${idx}`} className="px-4 py-3 bg-amber-50/40">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⚠ WARNING</span>
                      <span className="text-xs font-bold text-gray-600">Row {iss.row}</span>
                      <span className="text-xs font-mono text-gray-400">· {iss.field}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mb-0.5">{iss.message}</p>
                    {iss.found && (
                      <p className="text-xs text-gray-500 mb-1">
                        Found: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-700">{iss.found}</code>
                      </p>
                    )}
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 mt-1">
                      <span className="font-bold">Note: </span>{iss.fix}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Package list */}
      {packages.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No packages yet</p>
          <p className="text-sm text-gray-400 mt-1">Add your first travel package to get started.</p>
          <button onClick={openNewForm} className="mt-4 text-purple-600 text-sm font-semibold hover:underline">
            + Add your first package
          </button>
        </div>
      ) : (() => {
        const destOptions = ['all', ...Array.from(new Set(packages.map(p => p.destination).filter(Boolean)))]
        const WITH_HOTEL_CATS = new Set(['3-Star', '4-Star', '5-Star'])
        const filteredPackages = packages.filter(pkg => {
          const q = pkgSearch.toLowerCase().trim()
          let matchSearch = true
          if (q) {
            // Extract all itinerary text — handle both raw string and || delimited formats
            const itineraryRaw = typeof pkg.dayWiseItinerary === 'string' ? pkg.dayWiseItinerary : ''
            const itineraryText = itineraryRaw.replace(/\|\|/g, ' ')

            const haystack = [
              pkg.title,
              pkg.destination,
              pkg.destinationCountry,
              pkg.travelType,
              pkg.starCategory,
              pkg.theme,
              pkg.mood,
              pkg.overview,
              pkg.seasonalAvailability,
              String(pkg.durationDays ?? ''),
              String(pkg.durationNights ?? ''),
              String(pkg.pricePerPerson ?? ''),
              String((pkg as any).totalPrice ?? ''),
              String((pkg as any).paymentPolicy ?? ''),
              String((pkg as any).cancellationPolicy ?? ''),
              itineraryText,
              Array.isArray(pkg.highlights) ? pkg.highlights.join(' ') : String(pkg.highlights ?? ''),
              Array.isArray(pkg.inclusions) ? pkg.inclusions.join(' ') : String(pkg.inclusions ?? ''),
              Array.isArray(pkg.exclusions) ? pkg.exclusions.join(' ') : String(pkg.exclusions ?? ''),
              Array.isArray(pkg.perks) ? pkg.perks.join(' ') : '',
              Array.isArray(pkg.hotels) ? pkg.hotels.map((h: any) => [h.destination, h.hotels, h.mealPlan, h.roomType].filter(Boolean).join(' ')).join(' ') : '',
              Array.isArray(pkg.vehicles) ? pkg.vehicles.map((v: any) => [v.vehicleType, v.route, v.notes].filter(Boolean).join(' ')).join(' ') : '',
            ].join(' ').toLowerCase()

            // Match every word in the query individually so multi-word searches work across fields
            const words = q.split(/\s+/).filter(Boolean)
            matchSearch = words.every(word => haystack.includes(word))
          }
          const matchStatus = pkgStatusFilter === 'all' || (pkgStatusFilter === 'active' ? pkg.isActive : !pkg.isActive)
          const matchDest = pkgDestFilter === 'all' || pkg.destination === pkgDestFilter
          const matchHotel = pkgHotelFilter === 'all' || (pkgHotelFilter === 'with' ? WITH_HOTEL_CATS.has(pkg.starCategory || '') : !WITH_HOTEL_CATS.has(pkg.starCategory || ''))
          return matchSearch && matchStatus && matchDest && matchHotel
        })
        return (
        <>
          {/* Filter bar — row 1: search + status */}
          <div className="flex flex-wrap items-center gap-2.5 mb-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={pkgSearch}
                onChange={e => setPkgSearch(e.target.value)}
                placeholder="Search anything — title, destination, hotel, itinerary, inclusions…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(['all', 'active', 'paused'] as const).map(s => (
                <button key={s} onClick={() => setPkgStatusFilter(s)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full capitalize transition-colors ${pkgStatusFilter === s ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {s === 'all' ? `All (${packages.length})` : s === 'active' ? `Active (${packages.filter(p => p.isActive).length})` : `Paused (${packages.filter(p => !p.isActive).length})`}
                </button>
              ))}
            </div>
          </div>
          {/* Filter bar — row 2: destination + hotel filter + count */}
          <div className="flex flex-wrap items-center gap-2.5 mb-3">
            {destOptions.length > 2 && (
              <select value={pkgDestFilter} onChange={e => setPkgDestFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-200 bg-white">
                {destOptions.map(d => <option key={d} value={d}>{d === 'all' ? 'All Destinations' : d}</option>)}
              </select>
            )}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-xs text-gray-500 font-semibold mr-0.5">Hotel:</span>
              {(['all', 'with', 'without'] as const).map(h => (
                <button key={h} onClick={() => setPkgHotelFilter(h)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${pkgHotelFilter === h ? 'bg-amber-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {h === 'all' ? 'All' : h === 'with' ? '🏨 With Hotel' : '🏕️ Without Hotel'}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-400 ml-auto">{filteredPackages.length} of {packages.length}</span>
          </div>

          {filteredPackages.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No packages match your filters</p>
              <button onClick={() => { setPkgSearch(''); setPkgStatusFilter('all'); setPkgDestFilter('all'); setPkgHotelFilter('all') }}
                className="mt-2 text-purple-600 text-xs font-semibold hover:underline">Clear filters</button>
            </div>
          ) : (
        <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 overflow-hidden">
          {filteredPackages.map(pkg => (
            <div key={pkg.id} className="flex items-center gap-4 p-4 bg-white hover:bg-gray-50">
              {pkg.primaryImageUrl ? (
                <img
                  src={pkg.primaryImageUrl}
                  alt={pkg.title}
                  className="w-16 h-12 object-cover rounded-lg flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-12 bg-purple-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                  <Package className="w-5 h-5 text-purple-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{pkg.title}</p>
                <p className="text-sm text-gray-500">
                  {pkg.destination} · {pkg.durationNights}N · {pkg.starCategory || 'No Hotel'} · {(pkg as any).totalPrice ? `${getCurrencySymbol((pkg as any).currency)}${Number((pkg as any).totalPrice).toLocaleString()} total` : `${getCurrencySymbol(pkg.currency)}${pkg.pricePerPerson.toLocaleString()}/person`}
                  {((pkg.adults ?? 0) + (pkg.children ?? 0) + (pkg.infants ?? 0)) > 0 && (
                    <span className="ml-1">
                      · 👥 {pkg.adults ?? 0}A{(pkg.children ?? 0) > 0 ? ` ${pkg.children}C` : ''}{(pkg.infants ?? 0) > 0 ? ` ${pkg.infants}I` : ''}
                    </span>
                  )}
                </p>
                {Array.isArray(pkg.perks) && pkg.perks.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {pkg.perks.slice(0, 4).map(p => {
                      const preset = PRESET_PERKS.find(x => x.label === p)
                      return (
                        <span key={p} className="inline-flex items-center gap-1 text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full">
                          {preset ? preset.emoji : '✓'} {p}
                        </span>
                      )
                    })}
                    {pkg.perks.length > 4 && (
                      <span className="text-[10px] font-semibold text-gray-400 px-2 py-0.5">+{pkg.perks.length - 4} more</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Active / Inactive toggle */}
                <button
                  onClick={() => toggleActive(pkg)}
                  title={pkg.isActive ? 'Set Inactive' : 'Set Active'}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${pkg.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${pkg.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className={`text-xs font-semibold w-14 ${pkg.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                  {pkg.isActive ? 'Active' : 'Inactive'}
                </span>
                {/* Preview */}
                <button onClick={() => setPreviewPkg(pkg)} title="Preview"
                  className="p-1.5 rounded-lg bg-indigo-50 text-indigo-500 hover:bg-indigo-100 transition-colors">
                  <Eye className="w-4 h-4" />
                </button>
                {/* Edit */}
                <button onClick={() => openEditForm(pkg)} title="Edit"
                  className="p-1.5 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                {/* Delete */}
                <button onClick={() => setDeleteConfirm(pkg.id)} title="Delete"
                  className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
          )}
        </>
        )
      })()}

      {/* Two-panel package editor */}
      {showForm && (() => {
        const basePrice = Number(form.pricePerPerson) || 0
        const baseINR = basePrice * exchangeRate
        const markup = markupEnabled ? (Number(markupPercent) || 0) : 0
        const finalPrice = baseINR * (1 + markup / 100)
        const currencyMeta = CURRENCIES.find(c => c.code === form.currency) || CURRENCIES[0]
        return (
        <div className="fixed left-0 md:left-72 right-0 top-0 bottom-0 z-50 flex flex-col bg-[#f4f5f9]">

          {/* Top bar */}
          <div className="flex items-center gap-4 bg-white border-b border-gray-100 px-5 py-0 flex-shrink-0 h-14">
            {/* Back button */}
            <button
              onClick={() => router.push('/dmc-dashboard/packages')}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 px-3.5 py-2 rounded-lg transition-colors font-semibold text-sm flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
              Back
            </button>

            {/* Divider */}
            <div className="h-6 w-px bg-gray-200 flex-shrink-0" />

            {/* Title + badge */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate leading-tight">{form.title || 'Untitled Package'}</p>
                <p className="text-xs text-gray-400 leading-tight">{editingId ? 'Editing package details' : 'Creating a new package'}</p>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${editingId ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                {editingId ? 'Editing' : 'New'}
              </span>
            </div>
          </div>

          {/* Main: two columns */}
          <div className="flex flex-1 overflow-hidden">

            {/* Left: editor */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 min-w-0">

              {error && (
                <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-xl border ${error.startsWith('✅') ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                  {!error.startsWith('✅') && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                  {error}
                </div>
              )}

              {/* ── 1. Cover Image ────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                  <span className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center text-sm">🖼️</span>
                  <p className="text-sm font-bold text-gray-800">Cover Image</p>
                </div>
                <div className="p-5">
                  <input ref={imgInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  {form.primaryImageUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 h-44 group">
                      <img src={form.primaryImageUrl} alt="Cover" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button type="button" onClick={() => imgInputRef.current?.click()}
                          className="flex items-center gap-1.5 bg-white text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-100">
                          <Upload className="w-3.5 h-3.5" /> Change
                        </button>
                        <button type="button" onClick={() => setForm(p => ({ ...p, primaryImageUrl: '' }))}
                          className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-600">
                          <X className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>
                      {imgUploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-white" /></div>}
                    </div>
                  ) : (
                    <button type="button" onClick={() => imgInputRef.current?.click()} disabled={imgUploading}
                      className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-purple-400 hover:bg-purple-50/40 transition-colors text-gray-400 hover:text-purple-600">
                      {imgUploading
                        ? <><Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm font-medium">Uploading…</span></>
                        : <><Upload className="w-6 h-6" /><span className="text-sm font-medium">Click to upload cover image</span><span className="text-xs">JPG, PNG, WEBP · Max 10 MB</span></>
                      }
                    </button>
                  )}
                </div>
              </div>

              {/* ── 2. Basic Info ─────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                  <span className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-sm">📍</span>
                  <p className="text-sm font-bold text-gray-800">Basic Info</p>
                </div>
                <div className="p-5 space-y-4">
                  {/* Title */}
                  <div>
                    <label className="label">Package Title *</label>
                    <input
                      name="title"
                      value={form.title}
                      onChange={handleChange}
                      placeholder="e.g. Swiss Alps Luxury Getaway"
                      className="input text-base font-semibold"
                    />
                  </div>

                  {/* Destination / Country / Days / Nights */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Destination *</label>
                      <input name="destination" value={form.destination} onChange={handleChange} placeholder="Andaman Islands" className="input" />
                    </div>
                    <div>
                      <label className="label">Country</label>
                      <input name="destinationCountry" value={form.destinationCountry} onChange={handleChange} className="input" />
                    </div>
                    <div>
                      <label className="label">Days {dayItems.length > 0 && <span className="text-[10px] font-normal text-blue-400 ml-1">(from itinerary)</span>}</label>
                      <input
                        name="durationDays"
                        type="number"
                        min="1"
                        value={form.durationDays}
                        onChange={handleChange}
                        readOnly={dayItems.length > 0}
                        className={`input ${dayItems.length > 0 ? 'bg-gray-50 text-gray-500 cursor-default' : ''}`}
                      />
                    </div>
                    <div>
                      <label className="label">Nights {dayItems.length > 0 && <span className="text-[10px] font-normal text-blue-400 ml-1">(from itinerary)</span>}</label>
                      <input
                        name="durationNights"
                        type="number"
                        min="0"
                        value={form.durationNights}
                        onChange={handleChange}
                        readOnly={dayItems.length > 0}
                        className={`input ${dayItems.length > 0 ? 'bg-gray-50 text-gray-500 cursor-default' : ''}`}
                      />
                    </div>
                  </div>

                  {/* Star Category */}
                  <div>
                    <label className="label mb-2">Star Category</label>
                    <div className="flex flex-wrap gap-2">
                      {STAR_CATEGORIES.map(s => (
                        <button key={s} type="button" onClick={() => setForm(p => ({ ...p, starCategory: s }))}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${form.starCategory === s ? 'bg-amber-500 text-white border-amber-500' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-amber-300'}`}
                        >{s === '' ? 'None' : s}</button>
                      ))}
                    </div>
                  </div>

                  {/* Travel Type */}
                  <div>
                    <label className="label mb-2">Travel Type</label>
                    <div className="flex flex-wrap gap-2">
                      {TRAVEL_TYPES.map(t => (
                        <button key={t} type="button" onClick={() => setForm(p => ({ ...p, travelType: t }))}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${form.travelType === t ? 'bg-purple-600 text-white border-purple-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-purple-300'}`}
                        >{t}</button>
                      ))}
                    </div>
                  </div>

                  {/* Overview */}
                  <div>
                    <label className="label">Overview</label>
                    <textarea name="overview" value={form.overview} onChange={handleChange} rows={3} placeholder="Describe this package in a few sentences…" className="input resize-none" />
                  </div>

                  {/* Highlights */}
                  <div>
                    <label className="label">Highlights <span className="font-normal text-gray-400">(one per line)</span></label>
                    <textarea name="highlights" value={form.highlights} onChange={handleChange} rows={3} placeholder="Sunset cruise&#10;Scuba diving at Neil Island&#10;Elephant beach visit" className="input resize-none text-sm" />
                  </div>

                  {/* Min Group, Max Group, No. of Persons Travelling, Seasonal Availability — hidden */}
                  {/*
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Min Group</label><input name="minGroupSize" type="number" min="1" value={form.minGroupSize} onChange={handleChange} className="input" /></div>
                    <div><label className="label">Max Group</label><input name="maxGroupSize" type="number" min="1" value={form.maxGroupSize} onChange={handleChange} className="input" /></div>
                  </div>
                  <div className="col-span-2"><label className="label">Seasonal Availability</label><input name="seasonalAvailability" value={form.seasonalAvailability} onChange={handleChange} placeholder="Oct–Mar / Year Round" className="input" /></div>
                  */}
                </div>
              </div>

              {/* ── Package Type (Theme / Mood — hidden) ─────────── */}
              {/*
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                Package Type: Theme and Mood / Vibe removed
              </div>
              */}

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
                      {/* Currency selector + price input */}
                      <div className="flex gap-2">
                        <select
                          name="currency"
                          value={form.currency}
                          onChange={handleChange}
                          className="text-sm font-semibold border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-200 cursor-pointer flex-shrink-0"
                        >
                          {CURRENCIES.map(c => (
                            <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>
                          ))}
                        </select>
                        <div className="flex-1 flex items-center border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 gap-2 focus-within:ring-2 focus-within:ring-purple-200 focus-within:border-purple-300 transition-all">
                          <span className="text-gray-400 font-bold text-lg flex-shrink-0">{currencyMeta.symbol}</span>
                          <input
                            name="pricePerPerson"
                            type="number"
                            value={form.pricePerPerson}
                            onChange={handleChange}
                            onFocus={e => { if (e.target.value === '0') setForm(p => ({ ...p, pricePerPerson: '' })) }}
                            className="flex-1 text-xl font-bold text-gray-900 border-none outline-none bg-transparent min-w-0"
                            placeholder="0"
                          />
                        </div>
                      </div>
                      {/* Live INR conversion — only shown for non-INR currencies */}
                      {form.currency !== 'INR' && (
                        <div className="mt-2 flex flex-col gap-1">
                          {rateLoading ? (
                            <span className="flex items-center gap-1.5 text-xs text-gray-400">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Fetching live rate from open.er-api.com…
                            </span>
                          ) : rateError ? (
                            <span className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-full px-3 py-1">
                              ⚠️ Could not fetch rate — check connection. Using 1:1 fallback.
                            </span>
                          ) : basePrice > 0 ? (
                            <>
                              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 inline-flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                                ≈ ₹{baseINR.toLocaleString('en-IN', { maximumFractionDigits: 0 })} INR
                                <span className="text-emerald-500 font-medium">·</span>
                                <span className="font-normal text-emerald-500">1 {form.currency} = ₹{exchangeRate.toLocaleString('en-IN', { maximumFractionDigits: 4 })}</span>
                              </span>
                              {rateUpdatedAt && (
                                <span className="text-[10px] text-gray-400 pl-1">
                                  Rate last updated: {new Date(rateUpdatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] text-gray-400 pl-1">
                              {exchangeRate > 1 ? `1 ${form.currency} = ₹${exchangeRate.toLocaleString('en-IN', { maximumFractionDigits: 4 })}` : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {false && <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-700">Agency Markup</p>
                        <p className="text-[10px] text-gray-400">Apply {markupPercent}% standard profit</p>
                      </div>
                      <input
                        type="number"
                        value={markupPercent}
                        onChange={e => setMarkupPercent(e.target.value)}
                        className="w-14 text-center text-sm font-bold border border-gray-200 rounded-lg px-2 py-1 bg-white"
                      />
                      <span className="text-xs text-gray-400 font-semibold">%</span>
                      <button
                        type="button"
                        onClick={() => setMarkupEnabled(v => !v)}
                        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${markupEnabled ? 'bg-purple-600' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${markupEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>}
                    {/* Total Price & GST */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Total Price (optional)</p>
                        <div className="flex items-center border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 gap-1.5">
                          <span className="text-gray-400 font-semibold text-sm">{currencyMeta.symbol}</span>
                          <input
                            name="totalPrice"
                            type="number"
                            value={form.totalPrice}
                            onChange={handleChange}
                            placeholder="e.g. 150000"
                            className="flex-1 text-sm font-bold text-gray-900 border-none outline-none bg-transparent w-0 min-w-0"
                          />
                        </div>
                        <p className="text-[9px] text-gray-400 mt-1 pl-1">If set, PDF shows this as the package total price instead of per-person price.</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">GST (%)</p>
                        <div className="flex items-center border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 gap-1.5">
                          <input
                            name="gst"
                            type="number"
                            value={form.gst}
                            onChange={handleChange}
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
                  <div className="bg-purple-600 text-white rounded-2xl p-4 min-w-[160px] flex-shrink-0 text-center shadow-lg shadow-purple-200">
                    <p className="text-[9px] font-bold uppercase tracking-widest opacity-70 mb-1">Final Quotation Price</p>
                    <p className="text-[9px] opacity-50 mb-2">(in INR)</p>
                    <p className="text-2xl font-bold leading-tight">
                      ₹{finalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] opacity-60 mt-1.5">
                      {markupEnabled ? `Includes ${markup}% markup` : 'No markup applied'}
                    </p>
                    {form.currency !== 'INR' && basePrice > 0 && !rateLoading && (
                      <p className="text-[9px] opacity-50 mt-1">{currencyMeta.symbol}{basePrice.toLocaleString()} × {exchangeRate.toFixed(2)}</p>
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
                  </div>
                  <button onClick={addDayItem} className="flex items-center gap-1.5 text-xs text-blue-500 font-bold hover:text-blue-700">
                    <Plus className="w-3.5 h-3.5" /> Add New Day
                  </button>
                </div>
                {dayItems.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl">
                    <p className="text-sm text-gray-400">No days added yet</p>
                    <button onClick={addDayItem} className="mt-2 text-xs text-blue-500 font-semibold hover:text-blue-700">+ Add Day 1</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dayItems.map((day, idx) => (
                      <DayCard
                        key={day.id}
                        day={day}
                        idx={idx}
                        onTitleChange={v => updateDayItem(day.id, 'title', v)}
                        onDescChange={v => updateDayItem(day.id, 'description', v)}
                        onAddTag={tag => addTagToDayItem(day.id, tag)}
                        onRemoveTag={tag => removeTagFromDayItem(day.id, tag)}
                        onRemove={() => removeDayItem(day.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Hotels & Accommodation */}
              <div className={`bg-white rounded-2xl p-5 shadow-sm border transition-colors ${!form.starCategory ? 'border-gray-100 opacity-60' : 'border-gray-100'}`}>
                <input ref={hotelCsvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleHotelCsvImport} />
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center text-base">🏨</div>
                    <h3 className="font-bold text-gray-900 text-sm">Hotels & Accommodation</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={downloadSampleHotelCsv} disabled={!form.starCategory} className="text-[10px] text-gray-400 hover:text-gray-600 underline disabled:pointer-events-none">Sample CSV</button>
                    <button onClick={() => hotelCsvInputRef.current?.click()} disabled={!form.starCategory} className="flex items-center gap-1 text-xs text-emerald-600 font-semibold hover:text-emerald-800 border border-emerald-200 bg-emerald-50 px-2 py-1 rounded-lg disabled:pointer-events-none">
                      <Upload className="w-3 h-3" /> Import CSV
                    </button>
                    <button onClick={addHotelEntry} disabled={!form.starCategory} className="flex items-center gap-1.5 text-xs text-blue-500 font-bold hover:text-blue-700 disabled:pointer-events-none">
                      <Plus className="w-3.5 h-3.5" /> Add Hotel
                    </button>
                  </div>
                </div>

                {!form.starCategory ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl">
                    <p className="text-sm text-gray-400">Choose a star category to enable this section</p>
                  </div>
                ) : (
                  <>
                {hotelCsvMsg && (
                  <p className={`text-xs mb-3 px-3 py-2 rounded-lg ${hotelCsvMsg.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{hotelCsvMsg}</p>
                )}

                {hotelEntries.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl">
                    <p className="text-sm text-gray-400">No hotels added yet</p>
                    <div className="flex items-center justify-center gap-3 mt-2">
                      <button onClick={addHotelEntry} className="text-xs text-blue-500 font-semibold hover:text-blue-700">+ Add manually</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => hotelCsvInputRef.current?.click()} className="text-xs text-emerald-600 font-semibold hover:text-emerald-800">↑ Import from CSV</button>
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
                        {hotelEntries.map(h => (
                          <tr key={h.id} className="group">
                            <td className="py-2 pr-3">
                              <input
                                value={h.destination}
                                onChange={e => updateHotelEntry(h.id, 'destination', e.target.value)}
                                placeholder="Kuta"
                                className="w-full text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400"
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <input
                                type="number"
                                min="1"
                                value={h.nights}
                                onChange={e => updateHotelEntry(h.id, 'nights', Number(e.target.value))}
                                className="w-full text-sm text-center text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400"
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <textarea
                                value={h.hotels}
                                onChange={e => updateHotelEntry(h.id, 'hotels', e.target.value)}
                                placeholder={'Fairfield by Marriott\nOr: The Sakala Resort'}
                                rows={2}
                                className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 resize-none"
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <select
                                value={h.mealPlan}
                                onChange={e => updateHotelEntry(h.id, 'mealPlan', e.target.value)}
                                className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400"
                              >
                                {MEAL_PLANS.map(m => <option key={m}>{m}</option>)}
                              </select>
                            </td>
                            <td className="py-2 pr-3">
                              <textarea
                                value={h.roomType}
                                onChange={e => updateHotelEntry(h.id, 'roomType', e.target.value)}
                                placeholder={'Room with King Bed\nOr: Deluxe Suite'}
                                rows={2}
                                className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 resize-none"
                              />
                            </td>
                            <td className="py-2">
                              <button onClick={() => removeHotelEntry(h.id)} className="p-1 text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                  </>
                )}
              </div>

              {/* Vehicles & Transfers */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <input ref={vehicleCsvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleVehicleCsvImport} />
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center text-base">🚗</div>
                    <h3 className="font-bold text-gray-900 text-sm">Vehicles & Transfers</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={downloadSampleVehicleCsv} className="text-[10px] text-gray-400 hover:text-gray-600 underline">Sample CSV</button>
                    <button onClick={() => vehicleCsvInputRef.current?.click()} className="flex items-center gap-1 text-xs text-emerald-600 font-semibold hover:text-emerald-800 border border-emerald-200 bg-emerald-50 px-2 py-1 rounded-lg">
                      <Upload className="w-3 h-3" /> Import CSV
                    </button>
                    <button onClick={addVehicleEntry} className="flex items-center gap-1.5 text-xs text-blue-500 font-bold hover:text-blue-700">
                      <Plus className="w-3.5 h-3.5" /> Add Vehicle
                    </button>
                  </div>
                </div>
                {vehicleCsvMsg && (
                  <p className={`text-xs mb-3 px-3 py-2 rounded-lg ${vehicleCsvMsg.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{vehicleCsvMsg}</p>
                )}

                {vehicleEntries.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl">
                    <p className="text-sm text-gray-400">No vehicles added yet</p>
                    <div className="flex items-center justify-center gap-3 mt-2">
                      <button onClick={addVehicleEntry} className="text-xs text-blue-500 font-semibold hover:text-blue-700">+ Add manually</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => vehicleCsvInputRef.current?.click()} className="text-xs text-emerald-600 font-semibold hover:text-emerald-800">↑ Import from CSV</button>
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
                        {vehicleEntries.map(v => (
                          <tr key={v.id} className="group">
                            <td className="py-2 pr-3">
                              <select
                                value={v.vehicleType}
                                onChange={e => updateVehicleEntry(v.id, 'vehicleType', e.target.value)}
                                className="w-full text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400"
                              >
                                {VEHICLE_TYPES.map(t => <option key={t}>{t}</option>)}
                                {!VEHICLE_TYPES.includes(v.vehicleType) && v.vehicleType && (
                                  <option value={v.vehicleType}>{v.vehicleType}</option>
                                )}
                              </select>
                            </td>
                            <td className="py-2 pr-3">
                              <input
                                type="number"
                                min="1"
                                value={v.seats}
                                onChange={e => updateVehicleEntry(v.id, 'seats', Number(e.target.value))}
                                className="w-full text-sm text-center text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400"
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <input
                                value={v.route}
                                onChange={e => updateVehicleEntry(v.id, 'route', e.target.value)}
                                placeholder="Airport transfers, all sightseeing"
                                className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400"
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <input
                                type="number"
                                min="1"
                                value={v.days}
                                onChange={e => updateVehicleEntry(v.id, 'days', Number(e.target.value))}
                                className="w-full text-sm text-center text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400"
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <input
                                value={v.notes}
                                onChange={e => updateVehicleEntry(v.id, 'notes', e.target.value)}
                                placeholder="AC vehicle, with driver"
                                className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400"
                              />
                            </td>
                            <td className="py-2">
                              <button onClick={() => removeVehicleEntry(v.id)} className="p-1 text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
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

              {/* ── Inclusions & Exclusions ────────────────────────── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                  <span className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-sm">📝</span>
                  <p className="text-sm font-bold text-gray-800">Inclusions & Exclusions</p>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-green-700">✓ Inclusions</label>
                      <textarea name="inclusions" value={form.inclusions} onChange={handleChange} rows={4} placeholder="Flights&#10;Hotel accommodation&#10;Daily breakfast" className="input resize-none text-sm" />
                    </div>
                    <div>
                      <label className="label text-red-500">✗ Exclusions</label>
                      <textarea name="exclusions" value={form.exclusions} onChange={handleChange} rows={4} placeholder="Travel insurance&#10;Visa fees&#10;Tips & gratuities" className="input resize-none text-sm" />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Payment & Cancellation Policy ─────────────────── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
                  <span className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-sm">📋</span>
                  <p className="text-sm font-bold text-gray-800">Payment & Cancellation Policy</p>
                  <span className="ml-auto text-[10px] text-gray-400 font-medium">Shown in customer PDF</span>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="label">Payment Policy</label>
                    <textarea
                      name="paymentPolicy"
                      value={form.paymentPolicy}
                      onChange={handleChange}
                      rows={4}
                      placeholder="e.g. 30% advance to confirm booking. Balance due 21 days before travel. Bank transfer or UPI accepted."
                      className="input resize-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="label">Cancellation Policy</label>
                    <textarea
                      name="cancellationPolicy"
                      value={form.cancellationPolicy}
                      onChange={handleChange}
                      rows={4}
                      placeholder="e.g. 30+ days: 25% charge. 15–29 days: 50% charge. 7–14 days: 75% charge. Less than 7 days: non-refundable."
                      className="input resize-none text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: live preview — hidden */}
            {false && <div className="w-80 flex-shrink-0 bg-white border-l border-gray-100 flex flex-col overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-700">Live Preview</span>
                <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" onClick={() => setPreviewPkg(formAsPackage())}>
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-4">
                <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100">
                  <div className="relative h-44">
                    {form.primaryImageUrl ? (
                      <img src={form.primaryImageUrl} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-200 to-indigo-300 flex items-center justify-center">
                        <Package className="w-14 h-14 text-white/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    <div className="absolute top-3 left-3">
                      <span className="bg-white text-[10px] font-bold px-2.5 py-1 rounded-full text-gray-800 shadow">B2B Portal</span>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-white/60 mb-0.5">Personalized Itinerary</p>
                      <p className="text-white font-bold text-base leading-snug line-clamp-2">{form.title || 'Your Package Title'}</p>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-bold text-gray-900 mb-3">Trip Overview</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { emoji: '🏨', label: 'Stay', val: form.starCategory || '–' },
                        { emoji: '✈️', label: 'Type', val: form.travelType || '–' },
                        { emoji: '🌙', label: 'Nights', val: form.durationNights || '–' },
                      ].map(({ emoji, label, val }) => (
                        <div key={label} className="text-center">
                          <div className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-1 text-base">{emoji}</div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase">{label}</p>
                          <p className="text-[10px] font-bold text-gray-700">{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mx-4 mb-4 bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
                    {Number(form.totalPrice) > 0 ? (
                      <>
                        <p className="text-[10px] text-purple-400 font-semibold uppercase">Total Price</p>
                        <p className="text-xl font-bold text-purple-700">
                          {getCurrencySymbol(form.currency)}{Number(form.totalPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-[10px] text-purple-400">full package{Number(form.gst) > 0 ? ` + ${form.gst}% GST` : ''}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[10px] text-purple-400 font-semibold uppercase">Starting from</p>
                        <p className="text-xl font-bold text-purple-700">
                          {getCurrencySymbol(form.currency)}{basePrice > 0 ? (basePrice * (1 + markup / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '–'}
                        </p>
                        <p className="text-[10px] text-purple-400">per person{Number(form.gst) > 0 ? ` + ${form.gst}% GST` : ''}</p>
                      </>
                    )}
                  </div>
                  {dayItems.length > 0 && (
                    <div className="px-4 pb-3">
                      <p className="text-xs font-bold text-gray-700 mb-2">Itinerary ({dayItems.length} days)</p>
                      <div className="space-y-2">
                        {dayItems.slice(0, 3).map((d, i) => (
                          <div key={d.id} className="flex items-start gap-2">
                            <span className="w-5 h-5 bg-purple-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <div>
                              <p className="text-[10px] font-bold text-gray-800 leading-tight">{d.title}</p>
                              {d.description && <p className="text-[10px] text-gray-400 leading-snug line-clamp-2 mt-0.5">{d.description}</p>}
                            </div>
                          </div>
                        ))}
                        {dayItems.length > 3 && <p className="text-[10px] text-gray-400 pl-7">+{dayItems.length - 3} more days…</p>}
                      </div>
                    </div>
                  )}
                  {hotelEntries.length > 0 && (
                    <div className="px-4 pb-4">
                      <p className="text-xs font-bold text-gray-700 mb-2">🏨 Hotels ({hotelEntries.length})</p>
                      <div className="space-y-1.5">
                        {hotelEntries.map(h => (
                          <div key={h.id} className="bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[10px] font-bold text-amber-700">{h.destination}{h.nights ? ` (${h.nights}N)` : ''}</span>
                              <span className="text-[9px] bg-amber-200 text-amber-800 font-semibold px-1.5 py-0.5 rounded-full">{h.mealPlan}</span>
                            </div>
                            {h.hotels && <p className="text-[10px] text-gray-600 leading-snug">{h.hotels.split('\n')[0]}</p>}
                            {h.roomType && <p className="text-[10px] text-gray-400">{h.roomType.split('\n')[0]}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>}
          </div>

          {/* Bottom action bar */}
          <div className="flex items-center justify-end px-5 py-3 bg-white border-t border-gray-100 shadow-[0_-2px_12px_rgba(0,0,0,0.07)] flex-shrink-0 gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              title={!hasChanges ? 'No changes to save' : undefined}
              className="flex items-center gap-1.5 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 text-xs font-bold px-4 py-2 rounded-xl transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Saving…' : 'Save'}
            </button>

            <button
              onClick={openSaveAsModal}
              disabled={saving || !hasChanges}
              title={!hasChanges ? 'No changes to save' : undefined}
              className="flex items-center gap-1.5 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 hover:text-indigo-700 text-xs font-bold px-4 py-2 rounded-xl transition-colors"
            >
              <Save className="w-3.5 h-3.5" /> Save As
            </button>

            <button
              onClick={downloadPdf}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm shadow-purple-200"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </button>
          </div>
        </div>
        )
      })()}

      {/* ── Save As Modal ─────────────────────────────────────────────────── */}
      {showSaveAsModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-900 text-base mb-1">Save As New Package</h3>
            <p className="text-xs text-gray-400 mb-4">Enter a name for the new package copy.</p>
            <input
              autoFocus
              value={saveAsName}
              onChange={e => setSaveAsName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveAs() }}
              placeholder="Package name…"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowSaveAsModal(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAs}
                disabled={saving || !saveAsName.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? 'Saving…' : 'Save As'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Package Preview Modal ─────────────────────────────────────────── */}
      {previewPkg && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 overflow-y-auto py-8 px-4">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* Header bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-500" />
                <span className="font-bold text-gray-900 text-sm">Package Preview</span>
                {previewPkg.id === '__preview__' && (
                  <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Unsaved Draft</span>
                )}
              </div>
              <button onClick={() => setPreviewPkg(null)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Hero image */}
            {previewPkg.primaryImageUrl ? (
              <div className="relative h-56 w-full overflow-hidden">
                <img src={previewPkg.primaryImageUrl} alt={previewPkg.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-5 right-5">
                  <h2 className="text-2xl font-bold text-white drop-shadow">{previewPkg.title}</h2>
                  <p className="text-sm text-white/80 flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5" />{previewPkg.destination}{previewPkg.destinationCountry ? `, ${previewPkg.destinationCountry}` : ''}
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-40 bg-gradient-to-br from-purple-100 to-indigo-100 flex flex-col items-center justify-center">
                <Package className="w-10 h-10 text-purple-300 mb-2" />
                <h2 className="text-xl font-bold text-gray-800">{previewPkg.title}</h2>
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5" />{previewPkg.destination}
                </p>
              </div>
            )}

            {/* Key stats row */}
            <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
              {[
                { icon: <Clock className="w-4 h-4" />, label: 'Duration', value: previewPkg.durationNights ? `${previewPkg.durationNights}N / ${previewPkg.durationDays}D` : `${previewPkg.durationDays}D` },
                { icon: <Star className="w-4 h-4" />, label: 'Category', value: previewPkg.starCategory },
                { icon: <Users className="w-4 h-4" />, label: 'Group Size', value: `${previewPkg.minGroupSize || 1}–${previewPkg.maxGroupSize || 20}` },
                { icon: <Calendar className="w-4 h-4" />, label: 'Season', value: previewPkg.seasonalAvailability || 'Year Round' },
              ].map(({ icon, label, value }) => (
                <div key={label} className="px-4 py-3 text-center">
                  <div className="flex justify-center text-gray-400 mb-1">{icon}</div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
                  <p className="text-xs font-semibold text-gray-800 mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            <div className="p-6 space-y-5">
              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {previewPkg.travelType && <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-3 py-1 rounded-full">{previewPkg.travelType}</span>}
                {previewPkg.theme && <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">{previewPkg.theme}</span>}
                {previewPkg.mood && <span className="bg-pink-100 text-pink-700 text-xs font-semibold px-3 py-1 rounded-full">{previewPkg.mood}</span>}
              </div>

              {/* Price */}
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  {previewPkg.totalPrice ? (
                    <>
                      <p className="text-xs text-purple-500 font-medium">Total Price</p>
                      <p className="text-3xl font-bold text-purple-700">{getCurrencySymbol(previewPkg.currency)}{Number(previewPkg.totalPrice).toLocaleString()}</p>
                      <p className="text-xs text-purple-500">full package{previewPkg.gst ? ` + ${previewPkg.gst}% GST` : ''}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-purple-500 font-medium">Starting from</p>
                      <p className="text-3xl font-bold text-purple-700">{getCurrencySymbol(previewPkg.currency)}{(previewPkg.pricePerPerson || 0).toLocaleString()}</p>
                      <p className="text-xs text-purple-500">per person{previewPkg.gst ? ` + ${previewPkg.gst}% GST` : ''}</p>
                    </>
                  )}
                </div>
                <div className="bg-purple-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl opacity-60 cursor-default">
                  Request Quote
                </div>
              </div>

              {/* Overview */}
              {previewPkg.overview && (
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-1.5">Overview</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{previewPkg.overview}</p>
                </div>
              )}

              {/* Highlights */}
              {Array.isArray(previewPkg.highlights) && previewPkg.highlights.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-2">Highlights</h4>
                  <ul className="space-y-1.5">
                    {previewPkg.highlights.map((h: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-purple-500 mt-0.5">✦</span>{h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Inclusions / Exclusions */}
              {(Array.isArray(previewPkg.inclusions) && previewPkg.inclusions.length > 0 ||
                Array.isArray(previewPkg.exclusions) && previewPkg.exclusions.length > 0) && (
                <div className="grid grid-cols-2 gap-4">
                  {Array.isArray(previewPkg.inclusions) && previewPkg.inclusions.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-green-700 mb-2">✓ Inclusions</h4>
                      <ul className="space-y-1">
                        {previewPkg.inclusions.map((inc: string, i: number) => (
                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                            <span className="text-green-500 mt-0.5">•</span>{inc}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(previewPkg.exclusions) && previewPkg.exclusions.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-red-600 mb-2">✗ Exclusions</h4>
                      <ul className="space-y-1">
                        {previewPkg.exclusions.map((exc: string, i: number) => (
                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                            <span className="text-red-400 mt-0.5">•</span>{exc}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Day-wise itinerary */}
              {previewPkg.dayWiseItinerary && (
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-2">Day-Wise Itinerary</h4>
                  <div className="space-y-2">
                    {previewPkg.dayWiseItinerary.split('\n').filter(Boolean).map((line: string, i: number) => (
                      <div key={i} className={`text-sm ${line.toLowerCase().startsWith('day') ? 'font-semibold text-gray-900 mt-3 first:mt-0' : 'text-gray-600 pl-4'}`}>
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer note */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 text-center">
              <p className="text-xs text-gray-400">
                {previewPkg.id === '__preview__'
                  ? 'This is a draft preview — changes are not saved yet.'
                  : 'This is exactly how customers see this package on your planner page.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {showPdfPreview && (() => {
        const base = Number(form.pricePerPerson) || 0
        const final = markupEnabled ? base * (1 + Number(markupPercent) / 100) : base
        const inclList = (form.inclusions || '').split('\n').filter(Boolean)
        const exclList = (form.exclusions || '').split('\n').filter(Boolean)
        const highlightList = (form.highlights || '').split('\n').filter(Boolean)
        const sym = getCurrencySymbol(form.currency)
        const fmtPrice = (n: number) => `${sym}${n.toLocaleString()}`
        return (
          <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:block">
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh] print:shadow-none print:rounded-none print:max-w-full print:max-h-none">

              {/* ── Top bar ── */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0 print:hidden">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="text-base">📄</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 leading-tight">Package PDF Preview</p>
                    <p className="text-[11px] text-gray-400">Print or save as PDF</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      openPackagePrintWindow()
                      const msg = `📄 *${form.title || 'Travel Package'}* — Detailed itinerary PDF\n📍 ${form.destination} · ${form.durationDays}D/${form.durationNights}N · ${fmtPrice(final)}/person\n\nPlease find the attached PDF with complete itinerary, hotels, and pricing details.\n\n_Contact us to book!_`
                      setTimeout(() => window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank'), 900)
                    }}
                    className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-colors shadow-sm shadow-green-200"
                  >
                    <span>📱</span> Print &amp; Share on WhatsApp
                  </button>
                  <button
                    onClick={() => openPackagePrintWindow()}
                    className="flex items-center gap-1.5 border border-gray-200 text-gray-700 text-xs font-semibold px-3.5 py-2 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <span>🖨️</span> Print / Save PDF
                  </button>
                  <button onClick={() => setShowPdfPreview(false)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* ── Scrollable content ── */}
              <div className="overflow-y-auto flex-1 print:overflow-visible">

                {/* Hero */}
                <div className="relative h-40 flex-shrink-0 overflow-hidden">
                  {form.primaryImageUrl
                    ? <img src={form.primaryImageUrl} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-gradient-to-br from-violet-600 to-indigo-600" />
                  }
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute bottom-4 left-5 right-5">
                    <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest mb-1">Travel Package</p>
                    <h1 className="text-xl font-extrabold text-white leading-tight">{form.title || 'Untitled Package'}</h1>
                    <p className="text-xs text-white/70 mt-1">📍 {form.destination}{form.destinationCountry ? `, ${form.destinationCountry}` : ''}</p>
                  </div>
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-4 bg-purple-600 divide-x divide-purple-500">
                  {[
                    ['🌙', 'Duration', form.durationNights && form.durationDays ? `${form.durationNights}N / ${form.durationDays}D` : form.durationDays ? `${form.durationDays}D` : '—'],
                    ['⭐', 'Category', form.starCategory || '—'],
                    ['✈️', 'Travel Type', form.travelType || '—'],
                    ['📅', 'Availability', form.seasonalAvailability || 'Year Round'],
                  ].map(([icon, label, val]) => (
                    <div key={label} className="py-2.5 text-center px-2">
                      <div className="text-base">{icon}</div>
                      <div className="text-[8px] text-purple-200 uppercase tracking-wide mt-0.5">{label}</div>
                      <div className="text-[11px] font-bold text-white mt-0.5 leading-tight">{val}</div>
                    </div>
                  ))}
                </div>

                <div className="p-5 space-y-5">

                  {/* Pricing Configuration */}
                  <div className="bg-purple-600 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        {Number(form.totalPrice) > 0 ? (
                          <>
                            <p className="text-[9px] font-bold text-purple-200 uppercase tracking-widest mb-1">Total Price</p>
                            <p className="text-3xl font-extrabold text-white leading-none">{fmtPrice(Number(form.totalPrice))}</p>
                            <p className="text-xs text-purple-200 mt-1">Full package{form.currency !== 'INR' ? ` · ${form.currency}` : ''}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-[9px] font-bold text-purple-200 uppercase tracking-widest mb-1">Pricing Configuration</p>
                            <p className="text-3xl font-extrabold text-white leading-none">{final > 0 ? fmtPrice(final) : 'TBC'}</p>
                            <p className="text-xs text-purple-200 mt-1">Per person{form.currency !== 'INR' ? ` · ${form.currency}` : ''}</p>
                            {markupEnabled && base > 0 && (
                              <p className="text-[11px] text-purple-300 mt-0.5">Base {fmtPrice(base)} + {markupPercent}% markup</p>
                            )}
                          </>
                        )}
                        {Number(form.gst) > 0 && (
                          <p className="text-[11px] text-purple-300 mt-0.5">+ {form.gst}% GST applicable</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-purple-300 uppercase tracking-wide">Group Size</p>
                        <p className="text-sm font-bold text-white mt-0.5">{form.minGroupSize || 1} – {form.maxGroupSize || '—'} pax</p>
                        {(Number(form.adults) > 0 || Number(form.children) > 0 || Number(form.infants) > 0) && (
                          <p className="text-[11px] text-purple-200 mt-1">
                            {Number(form.adults) > 0 && `${form.adults}A`}
                            {Number(form.children) > 0 && ` · ${form.children}C`}
                            {Number(form.infants) > 0 && ` · ${form.infants}I`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Overview */}
                  {form.overview && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Overview</p>
                      <p className="text-sm text-gray-600 leading-relaxed">{form.overview}</p>
                    </div>
                  )}

                  {/* Package Type & Theme */}
                  {(form.travelType || form.theme || form.mood) && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Package Type &amp; Theme</p>
                      <div className="flex flex-wrap gap-2">
                        {form.travelType && <span className="bg-purple-50 border border-purple-100 text-purple-700 text-xs font-semibold px-3 py-1 rounded-full"><span className="text-purple-400 mr-1 text-[9px] uppercase font-bold">Type</span>{form.travelType}</span>}
                        {form.theme && <span className="bg-purple-50 border border-purple-100 text-purple-700 text-xs font-semibold px-3 py-1 rounded-full"><span className="text-purple-400 mr-1 text-[9px] uppercase font-bold">Theme</span>{form.theme}</span>}
                        {form.mood && <span className="bg-purple-50 border border-purple-100 text-purple-700 text-xs font-semibold px-3 py-1 rounded-full"><span className="text-purple-400 mr-1 text-[9px] uppercase font-bold">Mood</span>{form.mood}</span>}
                      </div>
                    </div>
                  )}

                  {/* Highlights */}
                  {highlightList.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Highlights</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {highlightList.map((h, i) => (
                          <div key={i} className="flex items-start gap-2 bg-violet-50 rounded-lg px-3 py-2">
                            <span className="text-purple-500 text-xs mt-0.5 flex-shrink-0">✦</span>
                            <span className="text-xs text-gray-700 leading-snug">{h}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Package Perks */}
                  {perks.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Package Perks</p>
                      <div className="flex flex-wrap gap-1.5">
                        {perks.map(p => {
                          const pr = PRESET_PERKS.find(x => x.label === p)
                          return (
                            <span key={p} className="bg-fuchsia-50 border border-fuchsia-100 text-fuchsia-700 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5">
                              {pr ? pr.emoji : '✓'} {p}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Hotels */}
                  {hotelEntries.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Hotels &amp; Accommodation</p>
                      <div className="rounded-xl overflow-hidden border border-gray-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="text-left font-bold text-gray-600 px-3 py-2">Destination</th>
                              <th className="text-left font-bold text-gray-600 px-3 py-2">Hotel(s)</th>
                              <th className="text-left font-bold text-gray-600 px-3 py-2">Meal Plan</th>
                              <th className="text-left font-bold text-gray-600 px-3 py-2">Room</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {hotelEntries.map((h, i) => (
                              <tr key={h.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                <td className="px-3 py-2 font-semibold text-gray-800">{h.destination}{h.nights ? ` (${h.nights}N)` : ''}</td>
                                <td className="px-3 py-2 text-gray-700">{h.hotels}</td>
                                <td className="px-3 py-2 text-gray-600">{h.mealPlan}</td>
                                <td className="px-3 py-2 text-gray-600">{h.roomType}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Vehicles */}
                  {vehicleEntries.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Vehicles &amp; Transfers</p>
                      <div className="rounded-xl overflow-hidden border border-blue-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-blue-50 border-b border-blue-100">
                              <th className="text-left font-bold text-blue-700 px-3 py-2">Vehicle</th>
                              <th className="text-left font-bold text-blue-700 px-3 py-2">Seats</th>
                              <th className="text-left font-bold text-blue-700 px-3 py-2">Route</th>
                              <th className="text-left font-bold text-blue-700 px-3 py-2">Days</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-blue-50">
                            {vehicleEntries.map((v, i) => (
                              <tr key={v.id} className={i % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}>
                                <td className="px-3 py-2 font-semibold text-gray-800">{v.vehicleType}</td>
                                <td className="px-3 py-2 text-gray-600">{v.seats}</td>
                                <td className="px-3 py-2 text-gray-700">{v.route}</td>
                                <td className="px-3 py-2 text-gray-600">{v.days}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Master Itinerary */}
                  {dayItems.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Master Itinerary</p>
                      <div className="space-y-0">
                        {dayItems.map((d, i) => (
                          <div key={d.id} className="flex gap-3">
                            <div className="flex flex-col items-center flex-shrink-0">
                              <span className="w-7 h-7 bg-purple-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              {i < dayItems.length - 1 && <div className="w-0.5 bg-purple-100 flex-1 my-1 min-h-[12px]" />}
                            </div>
                            <div className="pb-3 flex-1">
                              <p className="text-sm font-bold text-gray-900 leading-snug">{d.title}</p>
                              {d.description && <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{d.description}</p>}
                              {d.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {d.tags.map(t => <span key={t} className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full">{t}</span>)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inclusions / Exclusions */}
                  {(inclList.length > 0 || exclList.length > 0) && (
                    <div className="grid grid-cols-2 gap-3">
                      {inclList.length > 0 && (
                        <div className="bg-green-50 rounded-xl p-3.5">
                          <p className="text-[10px] font-bold text-green-700 uppercase tracking-wide mb-2">✓ Inclusions</p>
                          <ul className="space-y-1.5">
                            {inclList.map((inc, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                                <span className="w-4 h-4 bg-green-500 text-white rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0 mt-0.5">✓</span>
                                {inc}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {exclList.length > 0 && (
                        <div className="bg-red-50 rounded-xl p-3.5">
                          <p className="text-[10px] font-bold text-red-600 uppercase tracking-wide mb-2">✗ Exclusions</p>
                          <ul className="space-y-1.5">
                            {exclList.map((exc, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                                <span className="w-4 h-4 bg-red-400 text-white rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0 mt-0.5">✗</span>
                                {exc}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>

              {/* ── Bottom bar ── */}
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex items-center justify-between flex-shrink-0 print:hidden">
                <p className="text-[11px] text-gray-400">This is a preview of how the PDF will look when printed.</p>
                <button
                  onClick={() => setShowPdfPreview(false)}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )
      })()}

      <style jsx>{`
        .label { display: block; font-size: 0.75rem; font-weight: 600; color: #374151; margin-bottom: 0.375rem; }
        .input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb; border-radius: 0.75rem; font-size: 0.875rem; outline: none; background: #fff; transition: border-color 0.15s; }
        .input:focus { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.08); }
      `}</style>

      {deleteConfirm && (
        <ConfirmModal
          title="Delete package?"
          message="This action cannot be undone. The package will be permanently removed."
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}

interface DayCardProps {
  day: { id: string; title: string; description: string; tags: string[] }
  idx: number
  onTitleChange: (v: string) => void
  onDescChange: (v: string) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  onRemove: () => void
}

function DayCard({ day, idx, onTitleChange, onDescChange, onAddTag, onRemoveTag, onRemove }: DayCardProps) {
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
        <span className="w-6 h-6 bg-purple-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0">
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
          placeholder="Describe activities for this day…"
          className="w-full text-sm text-gray-600 bg-transparent border-none outline-none resize-none placeholder:text-gray-300"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {day.tags.map(tag => (
            <span key={tag} className="flex items-center gap-1 bg-white border border-gray-200 text-gray-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">
              {tag}
              <button onClick={() => onRemoveTag(tag)} className="text-gray-300 hover:text-red-400 ml-0.5">×</button>
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
