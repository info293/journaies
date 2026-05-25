'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, Users, Send, DollarSign, Download, Eye, Edit2,
  MessageSquare, MoreHorizontal, ChevronLeft, ChevronRight,
  Loader2, X, Sparkles, MapPin, Clock, CheckCircle, Phone, Mail,
  Banknote, AlertCircle, ChevronDown,
} from 'lucide-react'
import { getCurrencySymbol } from '@/lib/utils/currency'
import ConfirmModal from './ConfirmModal'

interface Message {
  id: string
  senderId: string
  senderRole: string
  senderName: string
  text: string
  timestamp: string
}

interface PackageData {
  title?: string
  destination?: string
  destinationCountry?: string
  overview?: string
  durationDays?: number
  durationNights?: number
  pricePerPerson?: number
  starCategory?: string
  travelType?: string
  theme?: string
  mood?: string
  inclusions?: string[]
  exclusions?: string[]
  highlights?: string[]
  dayWiseItinerary?: string
  primaryImageUrl?: string
  hotels?: { destination: string; nights: number; hotels: string; mealPlan: string; roomType: string }[]
}

interface Quotation {
  id: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  destination: string
  packageTitle?: string
  packageId?: string
  travelType?: string
  quotedPrice?: number | null
  status: string
  createdAt?: any
  updatedAt?: any
  subAgentName?: string
  subAgentId?: string
  agentId?: string
  agentSlug?: string
  groupSize?: number
  adults?: number
  kids?: number
  rooms?: number
  preferredDates?: string
  specialRequests?: string
  agentNotes?: string
  subAgentNotes?: string
  messages?: Message[]
  selectedPackage?: PackageData
  customPackageData?: PackageData
  wizardData?: any
}

interface Props {
  agentId: string
  subAgentId?: string
  currency?: string
}

const STATUS_COLORS: Record<string, string> = {
  pending:       'bg-gray-100 text-gray-600',
  in_discussion: 'bg-blue-100 text-blue-700',
  quoted:        'bg-amber-100 text-amber-700',
  accepted:      'bg-green-100 text-green-700',
  rejected:      'bg-red-100 text-red-600',
  converted:     'bg-purple-100 text-purple-700',
}
const STATUS_LABELS: Record<string, string> = {
  pending:       'Pending',
  in_discussion: 'In Discussion',
  quoted:        'Quoted',
  accepted:      'Accepted',
  rejected:      'Rejected',
  converted:     'Converted',
}
const DATE_FILTERS = ['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'All Time']
const PAGE_SIZE = 10
const AVATAR_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500']

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}
function formatDate(ts: any) {
  if (!ts) return '–'
  const ms = ts.seconds ? ts.seconds * 1000 : new Date(ts).getTime()
  return new Date(ms).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function QuotationHistory({ agentId, subAgentId, currency }: Props) {
  const sym = getCurrencySymbol(currency)
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading]       = useState(true)
  const [filterStatus, setFilterStatus]           = useState('All')
  const [filterDestination, setFilterDestination] = useState('All')
  const [filterDate, setFilterDate]               = useState('Last 30 Days')
  const [page, setPage] = useState(1)

  // modal
  const [modalQ, setModalQ]         = useState<Quotation | null>(null)
  const [modalTab, setModalTab]     = useState<'view' | 'edit' | 'message'>('view')
  const [editStatus, setEditStatus] = useState('')
  const [editPrice, setEditPrice]   = useState('')
  const [editNotes, setEditNotes]   = useState('')
  const [msgText, setMsgText]       = useState('')
  const [saving, setSaving]         = useState(false)
  const [msgSending, setMsgSending] = useState(false)
  const [showMore, setShowMore]     = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // custom proposal editor state
  const [editCustomPkg, setEditCustomPkg]     = useState<PackageData | null>(null)
  const [editHighlights, setEditHighlights]   = useState('')
  const [editInclusions, setEditInclusions]   = useState('')
  const [editExclusions, setEditExclusions]   = useState('')
  const [editHotels, setEditHotels]           = useState<NonNullable<PackageData['hotels']>>([])

  const fetchQuotations = useCallback(async () => {
    try {
      setLoading(true)
      const param = subAgentId ? `subAgentId=${subAgentId}` : `agentId=${agentId}`
      const res  = await fetch(`/api/agent/quotations?${param}`)
      const data = await res.json()
      if (data.success) setQuotations(data.quotations)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [agentId, subAgentId])

  useEffect(() => { fetchQuotations() }, [fetchQuotations])

  // ─── filter ───────────────────────────────────────────────────────────────
  const DAY = 86_400_000
  const threshold = filterDate === 'Last 7 Days'  ? Date.now() - 7  * DAY
                  : filterDate === 'Last 30 Days' ? Date.now() - 30 * DAY
                  : filterDate === 'Last 90 Days' ? Date.now() - 90 * DAY
                  : 0

  const destinations = ['All', ...Array.from(new Set(quotations.map(q => q.destination).filter(Boolean)))]

  const filtered = quotations.filter(q => {
    const ms = q.createdAt?.seconds ? q.createdAt.seconds * 1000 : (q.createdAt ? new Date(q.createdAt).getTime() : 0)
    if (filterStatus !== 'All' && q.status !== filterStatus) return false
    if (filterDestination !== 'All' && q.destination !== filterDestination) return false
    if (threshold > 0 && ms < threshold) return false
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ─── stats ────────────────────────────────────────────────────────────────
  const sentCount       = quotations.filter(q => q.status !== 'pending').length
  const convertedCount  = quotations.filter(q => q.status === 'converted' || q.status === 'accepted').length
  const conversionRate  = quotations.length ? Math.round((convertedCount / quotations.length) * 100) : 0
  const totalCommission = quotations
    .filter(q => q.quotedPrice && (q.status === 'accepted' || q.status === 'converted'))
    .reduce((s, q) => s + Number(q.quotedPrice) * 0.1, 0)

  // ─── insight cards ────────────────────────────────────────────────────────
  const highIntent = quotations.find(q => q.status === 'in_discussion' || q.status === 'quoted')
  const destCount  = quotations.reduce<Record<string, number>>((acc, q) => {
    if (q.destination) acc[q.destination] = (acc[q.destination] || 0) + 1
    return acc
  }, {})
  const topDest = Object.entries(destCount).sort((a, b) => b[1] - a[1])[0]?.[0]

  // ─── modal helpers ────────────────────────────────────────────────────────
  function openModal(q: Quotation, tab: 'view' | 'edit' | 'message') {
    setModalQ(q)
    setModalTab(tab)
    setEditStatus(q.status)
    setEditPrice(q.quotedPrice ? String(q.quotedPrice) : '')
    setEditNotes(q.agentNotes || q.subAgentNotes || '')
    setMsgText('')
    setShowMore(null)
    if (q.customPackageData) {
      const c = q.customPackageData
      setEditCustomPkg({ ...c })
      setEditHighlights((c.highlights || []).join('\n'))
      setEditInclusions((c.inclusions || []).join('\n'))
      setEditExclusions((c.exclusions || []).join('\n'))
      setEditHotels(c.hotels ? c.hotels.map(h => ({ ...h })) : [])
    } else {
      setEditCustomPkg(null)
      setEditHighlights('')
      setEditInclusions('')
      setEditExclusions('')
      setEditHotels([])
    }
  }

  function closeModal() { setModalQ(null); setShowMore(null) }

  async function handleSaveEdit() {
    if (!modalQ) return
    setSaving(true)
    try {
      const updatedCustomPkg: PackageData | undefined = editCustomPkg ? {
        ...editCustomPkg,
        highlights: editHighlights.split('\n').map(s => s.trim()).filter(Boolean),
        inclusions: editInclusions.split('\n').map(s => s.trim()).filter(Boolean),
        exclusions: editExclusions.split('\n').map(s => s.trim()).filter(Boolean),
        hotels: editHotels,
      } : undefined

      await fetch(`/api/agent/quotations/${modalQ.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editStatus,
          quotedPrice: editPrice ? Number(editPrice) : null,
          agentNotes: editNotes,
          ...(updatedCustomPkg ? { customPackageData: updatedCustomPkg } : {}),
        }),
      })
      setQuotations(prev => prev.map(q => q.id === modalQ.id
        ? { ...q, status: editStatus, quotedPrice: editPrice ? Number(editPrice) : q.quotedPrice, agentNotes: editNotes, ...(updatedCustomPkg ? { customPackageData: updatedCustomPkg } : {}) }
        : q
      ))
      setModalQ(prev => prev ? { ...prev, status: editStatus, quotedPrice: editPrice ? Number(editPrice) : prev.quotedPrice, agentNotes: editNotes, ...(updatedCustomPkg ? { customPackageData: updatedCustomPkg } : {}) } : prev)
      setModalTab('view')
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  async function handleSendMessage() {
    if (!modalQ || !msgText.trim()) return
    setMsgSending(true)
    try {
      const res  = await fetch(`/api/agent/quotations/${modalQ.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'message',
          senderId: agentId,
          senderRole: subAgentId ? 'travel_agent' : 'dmc',
          senderName: 'Agent',
          text: msgText.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setModalQ(prev => prev ? { ...prev, messages: [...(prev.messages || []), data.message] } : prev)
        setMsgText('')
      }
    } catch (e) { console.error(e) } finally { setMsgSending(false) }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/agent/quotations/${id}`, { method: 'DELETE' }).catch(() => {})
    setQuotations(prev => prev.filter(q => q.id !== id))
    setShowMore(null)
    setDeleteConfirm(null)
  }

  // ─── export ───────────────────────────────────────────────────────────────
  function exportCsv() {
    const headers = ['Customer', 'Email', 'Destination', 'Package', 'Price', 'Status', 'Date']
    const rows = filtered.map(q => [
      q.customerName, q.customerEmail || '', q.destination,
      q.packageTitle || '', q.quotedPrice || '', q.status, formatDate(q.createdAt),
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: 'quotations.csv',
    })
    a.click()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div></div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 text-sm font-semibold text-purple-600 border border-purple-200 bg-purple-50 hover:bg-purple-100 px-4 py-2 rounded-xl transition-colors"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Quotations Generated', value: quotations.length.toLocaleString(), sub: 'Lifetime total',  icon: <TrendingUp className="w-3 h-3" />, badge: '+12%' },
          { label: 'Sent to Clients',      value: sentCount,                            sub: 'Responded to',   icon: <Send className="w-3 h-3" />,        badge: '+6%'  },
          { label: 'Conversion Rate',      value: `${conversionRate}%`,                sub: `${convertedCount} confirmed`, icon: <Users className="w-3 h-3" />,  badge: '+2.4%' },
        ].map(({ label, value, sub, icon, badge }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <span className="text-xs text-green-600 font-semibold mb-0.5">{badge}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">{icon}{sub}</div>
          </div>
        ))}
        <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl p-4 shadow-sm text-white">
          <p className="text-[10px] font-bold opacity-70 uppercase tracking-wider mb-2">Total Commission</p>
          <p className="text-2xl font-bold">{sym}{totalCommission.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs opacity-70">
            <DollarSign className="w-3 h-3" /> YTD earnings
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          className="text-sm font-medium border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-purple-400 cursor-pointer"
        >
          <option value="All">Status: All</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select
          value={filterDestination}
          onChange={e => { setFilterDestination(e.target.value); setPage(1) }}
          className="text-sm font-medium border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-purple-400 cursor-pointer"
        >
          {destinations.map(d => <option key={d} value={d}>{d === 'All' ? 'Destination: All' : d}</option>)}
        </select>

        <select
          value={filterDate}
          onChange={e => { setFilterDate(e.target.value); setPage(1) }}
          className="text-sm font-medium border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-purple-400 cursor-pointer"
        >
          {DATE_FILTERS.map(d => <option key={d}>{d}</option>)}
        </select>

        {(filterStatus !== 'All' || filterDestination !== 'All' || filterDate !== 'Last 30 Days') && (
          <button
            onClick={() => { setFilterStatus('All'); setFilterDestination('All'); setFilterDate('Last 30 Days'); setPage(1) }}
            className="flex items-center gap-1 text-sm font-semibold text-purple-600 hover:text-purple-800"
          >
            <X className="w-3.5 h-3.5" /> Clear All Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Customer Name', 'Destination', 'Package Type', 'Price Quoted', 'Date', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-gray-400 text-sm">
                    No quotations match your filters.
                  </td>
                </tr>
              ) : paginated.map(q => (
                <tr key={q.id} className="hover:bg-gray-50/70 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${avatarColor(q.customerName)}`}>
                        {initials(q.customerName)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">{q.customerName}</p>
                        {q.customerEmail && <p className="text-xs text-gray-400 truncate max-w-[140px]">{q.customerEmail}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-700 whitespace-nowrap">{q.destination || '–'}</p>
                    {q.groupSize ? <p className="text-xs text-gray-400">{q.groupSize} pax</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full whitespace-nowrap">
                      {q.packageTitle?.slice(0, 20) || q.travelType || 'Custom'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-bold text-gray-900 whitespace-nowrap">
                      {q.quotedPrice ? `${sym}${Number(q.quotedPrice).toLocaleString()}` : <span className="text-gray-400 font-normal">–</span>}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      {formatDate(q.createdAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_COLORS[q.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[q.status] || q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity relative">
                      <button onClick={() => openModal(q, 'view')} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                      <button onClick={() => openModal(q, 'edit')} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => openModal(q, 'message')} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Message"><MessageSquare className="w-3.5 h-3.5" /></button>
                      <div className="relative">
                        <button onClick={() => setShowMore(showMore === q.id ? null : q.id)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="More"><MoreHorizontal className="w-3.5 h-3.5" /></button>
                        {showMore === q.id && (
                          <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-36">
                            <button onClick={() => openModal(q, 'view')} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"><Eye className="w-3.5 h-3.5" />View Details</button>
                            <button onClick={() => openModal(q, 'edit')} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"><Edit2 className="w-3.5 h-3.5" />Edit</button>
                            <button onClick={() => openModal(q, 'message')} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5" />Message</button>
                            <hr className="my-1 border-gray-100" />
                            <button onClick={() => { setDeleteConfirm(q.id); setShowMore(null) }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><X className="w-3.5 h-3.5" />Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} quotations
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 hover:bg-gray-100 rounded-lg">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setPage(n)}
                  className={`w-7 h-7 text-xs font-semibold rounded-lg transition-colors ${page === n ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                  {n}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 hover:bg-gray-100 rounded-lg">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Insight cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-start gap-3">
          <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">AI Prediction: High Intent</p>
            {highIntent ? (
              <>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">{highIntent.customerName}</span>'s quotation is 85% likely to convert if followed up within 24 hours.
                </p>
                <button className="mt-2 text-xs font-bold text-purple-600 hover:text-purple-800">Open Smart Follow-up →</button>
              </>
            ) : (
              <p className="text-sm text-gray-400">No active quotations to analyse yet.</p>
            )}
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-start gap-3">
          <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <MapPin className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Destination Spotlight</p>
            {topDest ? (
              <>
                <p className="text-sm text-gray-700">
                  Quotations for <span className="font-semibold">"{topDest}"</span> are seeing a {destCount[topDest]}x demand this period.
                </p>
                <button className="mt-2 text-xs font-bold text-green-600 hover:text-green-800">View Trending Packages →</button>
              </>
            ) : (
              <p className="text-sm text-gray-400">Not enough data yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Detail Modal ───────────────────────────────────────────────────── */}
      {modalQ && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={closeModal}>
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${avatarColor(modalQ.customerName)}`}>
                  {initials(modalQ.customerName)}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{modalQ.customerName}</h3>
                  <div className="flex items-center gap-3 mt-0.5">
                    {modalQ.customerEmail && <span className="flex items-center gap-1 text-xs text-gray-400"><Mail className="w-3 h-3" />{modalQ.customerEmail}</span>}
                    {modalQ.customerPhone && <span className="flex items-center gap-1 text-xs text-gray-400"><Phone className="w-3 h-3" />{modalQ.customerPhone}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[modalQ.status] || 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABELS[modalQ.status] || modalQ.status}
                </span>
                <button onClick={closeModal} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-6 pt-3 border-b border-gray-100">
              {(['view', 'edit', 'message'] as const).map(t => (
                <button key={t} onClick={() => setModalTab(t)}
                  className={`px-4 py-2 text-sm font-semibold capitalize transition-colors ${modalTab === t ? 'text-purple-700 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>
                  {t === 'view' ? '👁 View' : t === 'edit' ? '✏️ Edit' : `💬 Messages${modalQ.messages?.length ? ` (${modalQ.messages.length})` : ''}`}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6">

              {/* VIEW */}
              {modalTab === 'view' && (() => {
                const pkg: PackageData | null = modalQ.customPackageData || modalQ.selectedPackage || null
                const hasCustom = !!modalQ.customPackageData
                return (
                  <div className="space-y-5">

                    {/* Customer & Trip Summary */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Destination',     value: modalQ.destination || '–' },
                        { label: 'Preferred Dates', value: modalQ.preferredDates || '–' },
                        { label: 'Quoted Price',    value: modalQ.quotedPrice ? `${sym}${Number(modalQ.quotedPrice).toLocaleString()}` : '–', highlight: true },
                        { label: 'Adults',          value: String(modalQ.adults || modalQ.groupSize || 1) },
                        { label: 'Kids',            value: String(modalQ.kids || 0) },
                        { label: 'Rooms',           value: modalQ.rooms ? `${modalQ.rooms}` : '–' },
                      ].map(({ label, value, highlight }) => (
                        <div key={label} className={`rounded-xl p-3 ${highlight ? 'bg-purple-50 border border-purple-100' : 'bg-gray-50'}`}>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                          <p className={`text-sm font-bold ${highlight ? 'text-purple-700' : 'text-gray-800'}`}>{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Special Requests */}
                    {modalQ.specialRequests && (
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Special Requests</p>
                        <p className="text-sm text-gray-700">{modalQ.specialRequests}</p>
                      </div>
                    )}

                    {/* Sub-agent info */}
                    {modalQ.subAgentName && (
                      <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Travel Agent:</span>
                        <span className="text-sm font-semibold text-indigo-800">{modalQ.subAgentName}</span>
                        {hasCustom && <span className="ml-auto text-[10px] font-bold bg-amber-400 text-white px-2 py-0.5 rounded-full">Custom Proposal</span>}
                      </div>
                    )}

                    {/* Custom Package Proposal */}
                    {hasCustom && pkg && (
                      <div className="border-2 border-amber-300 rounded-2xl overflow-hidden">
                        <div className="bg-amber-400 px-4 py-2.5 flex items-center gap-2">
                          <span className="text-sm font-bold text-white">✏️ Sub-Agent Custom Proposal</span>
                          <span className="text-[10px] text-amber-100 ml-auto">Modified by {modalQ.subAgentName || 'Travel Agent'}</span>
                        </div>
                        <div className="p-4 space-y-4 bg-amber-50/40">
                          {pkg.primaryImageUrl && (
                            <div className="relative h-36 rounded-xl overflow-hidden">
                              <img src={pkg.primaryImageUrl} alt="" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                              <div className="absolute bottom-2 left-3">
                                <p className="text-white font-bold text-sm">{pkg.title}</p>
                                <p className="text-white/70 text-xs">{pkg.destination}{pkg.destinationCountry ? `, ${pkg.destinationCountry}` : ''}</p>
                              </div>
                            </div>
                          )}
                          {!pkg.primaryImageUrl && pkg.title && (
                            <div>
                              <p className="text-base font-bold text-gray-900">{pkg.title}</p>
                              <p className="text-sm text-gray-500">{pkg.destination}{pkg.destinationCountry ? `, ${pkg.destinationCountry}` : ''}</p>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {pkg.durationNights != null && <span className="bg-white border border-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full">🌙 {pkg.durationNights}N / {pkg.durationDays}D</span>}
                            {pkg.starCategory && <span className="bg-white border border-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full">⭐ {pkg.starCategory}</span>}
                            {pkg.travelType && <span className="bg-white border border-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full">🎒 {pkg.travelType}</span>}
                            {pkg.theme && <span className="bg-white border border-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full">🌿 {pkg.theme}</span>}
                            {(pkg as any).totalPrice
                              ? <span className="bg-purple-100 border border-purple-200 text-purple-700 text-xs font-bold px-2.5 py-1 rounded-full">{sym}{Number((pkg as any).totalPrice).toLocaleString()} total</span>
                              : pkg.pricePerPerson
                                ? <span className="bg-purple-100 border border-purple-200 text-purple-700 text-xs font-bold px-2.5 py-1 rounded-full">{sym}{Number(pkg.pricePerPerson).toLocaleString()}/person</span>
                                : null
                            }
                          </div>
                          {pkg.overview && (
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Overview</p>
                              <p className="text-sm text-gray-700 leading-relaxed">{pkg.overview}</p>
                            </div>
                          )}
                          {Array.isArray(pkg.highlights) && pkg.highlights.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Highlights</p>
                              <ul className="space-y-1">
                                {pkg.highlights.map((h, i) => <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700"><span className="text-purple-400 mt-0.5">✦</span>{h}</li>)}
                              </ul>
                            </div>
                          )}
                          {(Array.isArray(pkg.inclusions) && pkg.inclusions.length > 0 || Array.isArray(pkg.exclusions) && pkg.exclusions.length > 0) && (
                            <div className="grid grid-cols-2 gap-3">
                              {Array.isArray(pkg.inclusions) && pkg.inclusions.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider mb-1.5">✓ Inclusions</p>
                                  <ul className="space-y-1">{pkg.inclusions.map((inc, i) => <li key={i} className="text-xs text-gray-700 flex gap-1.5"><span className="text-green-500">•</span>{inc}</li>)}</ul>
                                </div>
                              )}
                              {Array.isArray(pkg.exclusions) && pkg.exclusions.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1.5">✗ Exclusions</p>
                                  <ul className="space-y-1">{pkg.exclusions.map((exc, i) => <li key={i} className="text-xs text-gray-700 flex gap-1.5"><span className="text-red-400">•</span>{exc}</li>)}</ul>
                                </div>
                              )}
                            </div>
                          )}
                          {Array.isArray(pkg.hotels) && pkg.hotels.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">🏨 Hotels</p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs border-collapse">
                                  <thead><tr className="bg-white border border-gray-200">
                                    {['Destination', 'Hotel', 'Meal Plan', 'Room Type'].map(h => <th key={h} className="text-left px-2 py-1.5 font-bold text-gray-500 border border-gray-200">{h}</th>)}
                                  </tr></thead>
                                  <tbody>{pkg.hotels.map((h, i) => (
                                    <tr key={i} className="border border-gray-200 bg-white">
                                      <td className="px-2 py-1.5 font-semibold text-gray-700 border border-gray-200">{h.destination}{h.nights ? ` (${h.nights}N)` : ''}</td>
                                      <td className="px-2 py-1.5 text-gray-600 border border-gray-200">{h.hotels}</td>
                                      <td className="px-2 py-1.5 text-gray-600 border border-gray-200">{h.mealPlan}</td>
                                      <td className="px-2 py-1.5 text-gray-600 border border-gray-200">{h.roomType}</td>
                                    </tr>
                                  ))}</tbody>
                                </table>
                              </div>
                            </div>
                          )}
                          {pkg.dayWiseItinerary && (
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">📅 Itinerary</p>
                              <div className="space-y-1.5">
                                {pkg.dayWiseItinerary.split('\n').filter(Boolean).map((line, i) => (
                                  <div key={i} className={`text-sm ${/^day\s*\d+/i.test(line) ? 'font-bold text-gray-900 mt-2 first:mt-0' : 'text-gray-600 pl-3'}`}>{line}</div>
                                ))}
                              </div>
                            </div>
                          )}
                          {modalQ.subAgentNotes && (
                            <div className="bg-white border border-amber-200 rounded-xl p-3">
                              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Agent's Note</p>
                              <p className="text-sm text-gray-700">{modalQ.subAgentNotes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Original Package (no custom proposal) */}
                    {!hasCustom && pkg && (
                      <div className="border border-gray-200 rounded-2xl overflow-hidden">
                        <div className="bg-gray-100 px-4 py-2.5">
                          <p className="text-xs font-bold text-gray-600">📦 Package Details</p>
                        </div>
                        <div className="p-4 space-y-3">
                          {pkg.overview && <p className="text-sm text-gray-700 leading-relaxed">{pkg.overview}</p>}
                          {Array.isArray(pkg.highlights) && pkg.highlights.length > 0 && (
                            <ul className="space-y-1">{pkg.highlights.map((h, i) => <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700"><span className="text-purple-400">✦</span>{h}</li>)}</ul>
                          )}
                          {Array.isArray(pkg.hotels) && pkg.hotels.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">🏨 Hotels</p>
                              <table className="w-full text-xs border-collapse">
                                <thead><tr className="bg-gray-50">{['Destination','Hotel','Meal Plan','Room Type'].map(h=><th key={h} className="text-left px-2 py-1.5 font-bold text-gray-500 border border-gray-200">{h}</th>)}</tr></thead>
                                <tbody>{pkg.hotels.map((h,i)=><tr key={i} className="border border-gray-100"><td className="px-2 py-1.5 font-semibold border border-gray-100">{h.destination}{h.nights?` (${h.nights}N)`:''}</td><td className="px-2 py-1.5 border border-gray-100">{h.hotels}</td><td className="px-2 py-1.5 border border-gray-100">{h.mealPlan}</td><td className="px-2 py-1.5 border border-gray-100">{h.roomType}</td></tr>)}</tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {(modalQ.agentNotes || modalQ.subAgentNotes) && (
                      <div className="grid grid-cols-1 gap-3">
                        {modalQ.agentNotes && (
                          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Agent Notes</p>
                            <p className="text-sm text-gray-700">{modalQ.agentNotes}</p>
                          </div>
                        )}
                        {modalQ.subAgentNotes && !hasCustom && (
                          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">Travel Agent Notes</p>
                            <p className="text-sm text-gray-700">{modalQ.subAgentNotes}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setModalTab('edit')} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-xl">
                        <Edit2 className="w-3.5 h-3.5" /> Edit Quotation
                      </button>
                      <button onClick={() => setModalTab('message')} className="flex items-center gap-2 border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-50">
                        <MessageSquare className="w-3.5 h-3.5" /> Send Message
                      </button>
                    </div>
                  </div>
                )
              })()}

              {/* EDIT */}
              {modalTab === 'edit' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Status</label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <button key={k} onClick={() => setEditStatus(k)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${editStatus === k ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Quoted Price ({sym.trim()})</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 leading-none">{sym.trim()}</span>
                      <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                        placeholder="Enter quoted price"
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-purple-400" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Notes</label>
                    <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
                      rows={3} placeholder="Add internal notes…"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-purple-400 resize-none" />
                  </div>
                  {/* Custom Proposal Editor */}
                  {editCustomPkg && (
                    <div className="border-2 border-amber-300 rounded-2xl overflow-hidden">
                      <div className="bg-amber-400 px-4 py-2.5 flex items-center gap-2">
                        <span className="text-sm font-bold text-white">✏️ Edit Custom Proposal</span>
                      </div>
                      <div className="p-4 space-y-4 bg-amber-50/30">
                        {/* Title + Destination */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Package Title</label>
                            <input value={editCustomPkg.title || ''} onChange={e => setEditCustomPkg(p => p ? { ...p, title: e.target.value } : p)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-amber-400" placeholder="Package title" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Destination</label>
                            <input value={editCustomPkg.destination || ''} onChange={e => setEditCustomPkg(p => p ? { ...p, destination: e.target.value } : p)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-amber-400" placeholder="Destination" />
                          </div>
                        </div>
                        {/* Duration + Price */}
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nights</label>
                            <input type="number" value={editCustomPkg.durationNights || ''} onChange={e => setEditCustomPkg(p => p ? { ...p, durationNights: Number(e.target.value) } : p)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-amber-400" placeholder="0" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Days</label>
                            <input type="number" value={editCustomPkg.durationDays || ''} onChange={e => setEditCustomPkg(p => p ? { ...p, durationDays: Number(e.target.value) } : p)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-amber-400" placeholder="0" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Price/Person {sym.trim()}</label>
                            <input type="number" value={editCustomPkg.pricePerPerson || ''} onChange={e => setEditCustomPkg(p => p ? { ...p, pricePerPerson: Number(e.target.value) } : p)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-amber-400" placeholder="0" />
                          </div>
                        </div>
                        {/* Star + Travel Type */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Star Category</label>
                            <div className="flex flex-wrap gap-1.5">
                              {['3-Star', '4-Star', '5-Star', 'Luxury', 'Budget'].map(s => (
                                <button key={s} type="button" onClick={() => setEditCustomPkg(p => p ? { ...p, starCategory: s } : p)}
                                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${editCustomPkg.starCategory === s ? 'bg-amber-400 text-white border-amber-400' : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'}`}>
                                  {s}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Travel Type</label>
                            <input value={editCustomPkg.travelType || ''} onChange={e => setEditCustomPkg(p => p ? { ...p, travelType: e.target.value } : p)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-amber-400" placeholder="e.g. Leisure, Adventure" />
                          </div>
                        </div>
                        {/* Overview */}
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Overview</label>
                          <textarea value={editCustomPkg.overview || ''} onChange={e => setEditCustomPkg(p => p ? { ...p, overview: e.target.value } : p)}
                            rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-amber-400 resize-none" placeholder="Package overview…" />
                        </div>
                        {/* Highlights */}
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Highlights <span className="normal-case font-normal text-gray-400">(one per line)</span></label>
                          <textarea value={editHighlights} onChange={e => setEditHighlights(e.target.value)}
                            rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-amber-400 resize-none" placeholder="Highlight 1&#10;Highlight 2&#10;Highlight 3" />
                        </div>
                        {/* Inclusions / Exclusions */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1">✓ Inclusions <span className="normal-case font-normal text-gray-400">(one per line)</span></label>
                            <textarea value={editInclusions} onChange={e => setEditInclusions(e.target.value)}
                              rows={4} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-400 resize-none" placeholder="Breakfast&#10;Airport transfers&#10;…" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">✗ Exclusions <span className="normal-case font-normal text-gray-400">(one per line)</span></label>
                            <textarea value={editExclusions} onChange={e => setEditExclusions(e.target.value)}
                              rows={4} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-red-400 resize-none" placeholder="Flights&#10;Visa fees&#10;…" />
                          </div>
                        </div>
                        {/* Hotels */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">🏨 Hotels & Accommodation</label>
                            <button type="button" onClick={() => setEditHotels(h => [...h, { destination: '', nights: 1, hotels: '', mealPlan: 'Breakfast', roomType: '' }])}
                              className="text-xs font-bold text-amber-600 hover:text-amber-800">+ Add Row</button>
                          </div>
                          {editHotels.length > 0 && (
                            <div className="overflow-x-auto rounded-xl border border-gray-200">
                              <table className="w-full text-xs">
                                <thead><tr className="bg-gray-50 border-b border-gray-200">
                                  {['Destination', 'Nights', 'Hotel(s)', 'Meal Plan', 'Room Type', ''].map(h => (
                                    <th key={h} className="text-left px-2 py-2 font-bold text-gray-500 whitespace-nowrap">{h}</th>
                                  ))}
                                </tr></thead>
                                <tbody>{editHotels.map((h, i) => (
                                  <tr key={i} className="border-b border-gray-100 last:border-0">
                                    <td className="px-1 py-1"><input value={h.destination} onChange={e => setEditHotels(prev => prev.map((r, idx) => idx === i ? { ...r, destination: e.target.value } : r))}
                                      className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-xs outline-none focus:border-amber-400" placeholder="City" /></td>
                                    <td className="px-1 py-1"><input type="number" value={h.nights} onChange={e => setEditHotels(prev => prev.map((r, idx) => idx === i ? { ...r, nights: Number(e.target.value) } : r))}
                                      className="w-14 px-2 py-1 border border-gray-200 rounded-lg text-xs outline-none focus:border-amber-400" /></td>
                                    <td className="px-1 py-1"><input value={h.hotels} onChange={e => setEditHotels(prev => prev.map((r, idx) => idx === i ? { ...r, hotels: e.target.value } : r))}
                                      className="w-32 px-2 py-1 border border-gray-200 rounded-lg text-xs outline-none focus:border-amber-400" placeholder="Hotel name" /></td>
                                    <td className="px-1 py-1">
                                      <select value={h.mealPlan} onChange={e => setEditHotels(prev => prev.map((r, idx) => idx === i ? { ...r, mealPlan: e.target.value } : r))}
                                        className="px-2 py-1 border border-gray-200 rounded-lg text-xs outline-none focus:border-amber-400 bg-white">
                                        {['Breakfast', 'Half Board', 'Full Board', 'All Inclusive', 'Room Only'].map(m => <option key={m}>{m}</option>)}
                                      </select>
                                    </td>
                                    <td className="px-1 py-1"><input value={h.roomType} onChange={e => setEditHotels(prev => prev.map((r, idx) => idx === i ? { ...r, roomType: e.target.value } : r))}
                                      className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-xs outline-none focus:border-amber-400" placeholder="e.g. Deluxe" /></td>
                                    <td className="px-1 py-1"><button type="button" onClick={() => setEditHotels(prev => prev.filter((_, idx) => idx !== i))}
                                      className="p-1 text-gray-300 hover:text-red-500 rounded-lg transition-colors"><X className="w-3 h-3" /></button></td>
                                  </tr>
                                ))}</tbody>
                              </table>
                            </div>
                          )}
                        </div>
                        {/* Itinerary */}
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">📅 Day-wise Itinerary</label>
                          <textarea value={editCustomPkg.dayWiseItinerary || ''} onChange={e => setEditCustomPkg(p => p ? { ...p, dayWiseItinerary: e.target.value } : p)}
                            rows={5} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-amber-400 resize-none font-mono" placeholder="Day 1: Arrival&#10;Day 2: Sightseeing&#10;…" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={handleSaveEdit} disabled={saving}
                      className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button onClick={() => setModalTab('view')} className="border border-gray-200 text-gray-600 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* MESSAGE */}
              {modalTab === 'message' && (
                <div className="flex flex-col gap-3">
                  <div className="space-y-3 max-h-72 overflow-y-auto">
                    {(!modalQ.messages || modalQ.messages.length === 0) ? (
                      <div className="text-center py-10 text-gray-400 text-sm">No messages yet. Start the conversation below.</div>
                    ) : modalQ.messages.map(m => {
                      const isMe = m.senderRole === 'dmc' || m.senderId === agentId
                      return (
                        <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${isMe ? 'bg-purple-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                            {!isMe && <p className="text-[10px] font-bold mb-1 opacity-60">{m.senderName || 'Agent'}</p>}
                            <p>{m.text}</p>
                            <p className={`text-[10px] mt-1 ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                              {new Date(m.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <input value={msgText} onChange={e => setMsgText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }}
                      placeholder="Type a message… (Enter to send)"
                      className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-purple-400" />
                    <button onClick={handleSendMessage} disabled={msgSending || !msgText.trim()}
                      className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl">
                      {msgSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <ConfirmModal
          title="Delete quotation?"
          message="This action cannot be undone. The quotation will be permanently removed."
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}
