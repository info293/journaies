'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Loader2, Mail, Phone, Calendar, Users, MessageSquare,
  ChevronDown, ChevronUp, Download, Banknote, User,
  MessageCircle, MapPin, Tag, Send, Columns3, List
} from 'lucide-react'
import { AgentBooking } from '@/lib/types/agent'
import { getCurrencySymbol } from '@/lib/utils/currency'

interface Props {
  agentId: string
  currency?: string
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-gray-100 text-gray-600',
}

const STATUS_OPTIONS = ['new', 'contacted', 'confirmed', 'cancelled', 'completed']

function formatDate(ts: any) {
  if (!ts) return ''
  const d = ts.seconds ? new Date(ts.seconds * 1000) : ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function BookingInbox({ agentId, currency }: Props) {
  const sym = getCurrencySymbol(currency)
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/agent/bookings?agentId=${agentId}`)
      const data = await res.json()
      if (data.success) {
        const sorted = (data.bookings as any[]).sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        )
        setBookings(sorted)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => { fetchBookings() }, [fetchBookings])

  async function updateBooking(bookingId: string, updates: Record<string, any>) {
    setUpdatingId(bookingId)
    try {
      await fetch('/api/agent/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, agentId, ...updates }),
      })
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, ...updates } : b))
    } finally {
      setUpdatingId(null)
    }
  }

  function exportCSV() {
    const rows = [
      ['Date', 'Customer', 'Email', 'Phone', 'Package', 'Destination', 'Status', 'Booking Value', 'Adults', 'Kids', 'Dates', 'Sub-Agent'],
      ...filtered.map(b => [
        formatDate(b.createdAt),
        b.customerName,
        b.customerEmail,
        b.customerPhone || '',
        b.packageTitle,
        b.destination || '',
        b.status,
        b.bookingValue || '',
        b.adults || '',
        b.kids || '',
        b.preferredDates || '',
        b.subAgentId || '',
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Count per status
  const countByStatus = bookings.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const filtered = bookings.filter(b => {
    if (filterStatus !== 'all' && b.status !== filterStatus) return false
    if (dateFilter !== 'all') {
      const now = Date.now()
      const ts = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0
      const diff = now - ts
      if (dateFilter === 'today' && diff > 86400000) return false
      if (dateFilter === 'week' && diff > 7 * 86400000) return false
      if (dateFilter === 'month' && diff > 30 * 86400000) return false
    }
    if (search) {
      const s = search.toLowerCase()
      return (
        b.customerName?.toLowerCase().includes(s) ||
        b.customerEmail?.toLowerCase().includes(s) ||
        b.packageTitle?.toLowerCase().includes(s) ||
        b.destination?.toLowerCase().includes(s)
      )
    }
    return true
  })

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div></div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary w-40"
          />
          {/* View toggle */}
          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${viewMode === 'list' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${viewMode === 'kanban' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title="Kanban pipeline"
            >
              <Columns3 className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 text-xs font-semibold border border-gray-200 bg-white text-gray-600 px-3 py-2 rounded-xl hover:border-gray-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Date + Status filters */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-1.5">
          {(['all', 'today', 'week', 'month'] as const).map(d => (
            <button key={d} onClick={() => setDateFilter(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${dateFilter === d ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {d === 'all' ? 'All time' : d === 'today' ? 'Today' : d === 'week' ? 'This week' : 'This month'}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filterStatus === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            All ({bookings.length})
          </button>
          {STATUS_OPTIONS.map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${filterStatus === s ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s} {countByStatus[s] ? `(${countByStatus[s]})` : '(0)'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Kanban Pipeline View ── */}
      {viewMode === 'kanban' && (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {STATUS_OPTIONS.map(col => {
              const colBookings = bookings.filter(b => {
                if (b.status !== col) return false
                if (search) {
                  const s = search.toLowerCase()
                  return b.customerName?.toLowerCase().includes(s) ||
                    b.packageTitle?.toLowerCase().includes(s) ||
                    b.destination?.toLowerCase().includes(s)
                }
                return true
              })
              const colColor: Record<string, string> = {
                new: 'border-blue-300 bg-blue-50',
                contacted: 'border-amber-300 bg-amber-50',
                confirmed: 'border-green-300 bg-green-50',
                cancelled: 'border-red-300 bg-red-50',
                completed: 'border-gray-300 bg-gray-50',
              }
              const dotColor: Record<string, string> = {
                new: 'bg-blue-500',
                contacted: 'bg-amber-500',
                confirmed: 'bg-green-500',
                cancelled: 'bg-red-400',
                completed: 'bg-gray-400',
              }
              return (
                <div
                  key={col}
                  className={`w-64 flex-shrink-0 rounded-2xl border-2 ${dragOverCol === col ? colColor[col] : 'border-gray-200 bg-gray-50'} transition-colors`}
                  onDragOver={e => { e.preventDefault(); setDragOverCol(col) }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={async e => {
                    e.preventDefault()
                    setDragOverCol(null)
                    if (draggingId) {
                      await updateBooking(draggingId, { status: col })
                      setDraggingId(null)
                    }
                  }}
                >
                  {/* Column header */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor[col]}`} />
                    <span className="font-bold text-gray-800 text-sm capitalize">{col}</span>
                    <span className="ml-auto text-xs font-bold text-gray-400 bg-white border border-gray-200 px-1.5 py-0.5 rounded-full">
                      {colBookings.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="p-2 space-y-2 min-h-[120px]">
                    {colBookings.length === 0 ? (
                      <div className="text-center py-6 text-xs text-gray-400">Drop here</div>
                    ) : colBookings.map(b => (
                      <div
                        key={b.id}
                        draggable
                        onDragStart={() => setDraggingId(b.id)}
                        onDragEnd={() => setDraggingId(null)}
                        className={`bg-white rounded-xl border border-gray-200 p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all ${draggingId === b.id ? 'opacity-50 scale-95' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="font-bold text-gray-900 text-xs leading-snug">{b.customerName}</p>
                          {(b.bookingValue || b.quotedPrice) ? (
                            <span className={`text-xs font-bold flex-shrink-0 ${b.bookingValue ? 'text-emerald-700' : 'text-purple-600'}`}>
                              {sym}{(Number(b.bookingValue || b.quotedPrice)/1000).toFixed(0)}K
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-gray-500 leading-snug mb-1.5 line-clamp-1">{b.packageTitle}</p>
                        <div className="flex flex-wrap gap-1 text-[10px] text-gray-400">
                          {b.destination && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{b.destination}</span>}
                          {b.groupSize && <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{b.groupSize} pax</span>}
                        </div>
                        {b.customerPhone && (
                          <div className="flex gap-1.5 mt-2 pt-2 border-t border-gray-100">
                            <a
                              href={`https://wa.me/${b.customerPhone.replace(/\D/g, '')}`}
                              target="_blank"
                              className="flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full hover:bg-green-100"
                              onClick={e => e.stopPropagation()}
                            >
                              <MessageCircle className="w-2.5 h-2.5" />WA
                            </a>
                            <a
                              href={`mailto:${b.customerEmail}`}
                              className="flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/5 px-2 py-0.5 rounded-full hover:bg-primary/10"
                              onClick={e => e.stopPropagation()}
                            >
                              <Mail className="w-2.5 h-2.5" />Email
                            </a>
                          </div>
                        )}
                        <p className="text-[10px] text-gray-300 mt-1">{formatDate(b.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">Drag cards between columns to update booking status</p>
        </div>
      )}

      {viewMode === 'list' && filtered.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No bookings found</p>
          <p className="text-sm text-gray-400 mt-1">Share your planner URL to start receiving bookings.</p>
        </div>
      ) : viewMode === 'list' && (
        <div className="space-y-3">
          {filtered.map(booking => (
            <div key={booking.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Summary row */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                onClick={() => setExpandedId(expandedId === booking.id ? null : booking.id)}
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                  {booking.customerName?.charAt(0)?.toUpperCase() || '?'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{booking.customerName}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[booking.status] || 'bg-gray-100 text-gray-600'}`}>
                      {booking.status}
                      {booking.status === 'new' && <span className="ml-1 inline-block w-1.5 h-1.5 bg-blue-500 rounded-full align-middle animate-pulse" />}
                    </span>
                    {booking.subAgentId && (
                      <span className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                        <User className="w-3 h-3" />
                        Team
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 truncate">
                    {booking.packageTitle}
                    {booking.destination ? ` · ${booking.destination}` : ''}
                    {booking.groupSize ? ` · ${booking.groupSize} pax` : ''}
                  </p>
                </div>

                <div className="text-right flex-shrink-0 space-y-0.5">
                  {booking.bookingValue ? (
                    <p className="text-sm font-bold text-emerald-700">{sym}{Number(booking.bookingValue).toLocaleString()}</p>
                  ) : booking.selectedPackage?.pricePerPerson ? (
                    <p className="text-sm font-bold text-purple-600">{sym}{(Number(booking.selectedPackage.pricePerPerson) * (booking.groupSize || booking.adults || 1)).toLocaleString()}</p>
                  ) : booking.quotedPrice ? (
                    <p className="text-sm font-bold text-purple-600">{sym}{Number(booking.quotedPrice).toLocaleString()}</p>
                  ) : null}
                  <p className="text-xs text-gray-400">{formatDate(booking.createdAt)}</p>
                </div>

                {expandedId === booking.id
                  ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                }
              </div>

              {/* Expanded detail */}
              {expandedId === booking.id && (() => {
                const pkgPrice = booking.selectedPackage?.pricePerPerson || booking.quotedPrice || 0
                const suggestedValue = booking.bookingValue || pkgPrice
                return (
                <div className="border-t border-gray-100 bg-gray-50/50">

                  {/* Package info banner */}
                  {booking.selectedPackage && (
                    <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-white">
                      {booking.selectedPackage.primaryImageUrl && (
                        <img src={booking.selectedPackage.primaryImageUrl} alt="" className="w-12 h-9 object-cover rounded-lg flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">{booking.selectedPackage.title || booking.packageTitle}</p>
                        <p className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                          <span>{booking.selectedPackage.durationNights}N / {booking.selectedPackage.durationDays}D</span>
                          {booking.selectedPackage.starCategory && <span>· {booking.selectedPackage.starCategory}</span>}
                          {booking.selectedPackage.travelType && <span>· {booking.selectedPackage.travelType}</span>}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-gray-400">Package price</p>
                        <p className="text-sm font-bold text-purple-700">{sym}{pkgPrice.toLocaleString()}<span className="text-[10px] font-normal text-gray-400">/person</span></p>
                      </div>
                    </div>
                  )}

                  <div className="p-5 space-y-4">
                    {/* Contact row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                      {booking.customerEmail ? (
                        <a href={`mailto:${booking.customerEmail}`} className="flex items-center gap-2 text-primary hover:underline truncate">
                          <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />{booking.customerEmail}
                        </a>
                      ) : (
                        <span className="flex items-center gap-2 text-gray-400 text-xs">
                          <Mail className="w-4 h-4 flex-shrink-0" />No email provided
                        </span>
                      )}
                      {booking.customerPhone ? (
                        <>
                          <a href={`tel:${booking.customerPhone}`} className="flex items-center gap-2 text-gray-600 hover:text-primary transition-colors">
                            <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />{booking.customerPhone}
                          </a>
                          <a href={`https://wa.me/${booking.customerPhone.replace(/\D/g, '')}`} target="_blank"
                            className="flex items-center gap-2 text-green-700 hover:text-green-800 font-medium">
                            <MessageCircle className="w-4 h-4 flex-shrink-0" />WhatsApp
                          </a>
                        </>
                      ) : (
                        <span className="flex items-center gap-2 text-gray-400 text-xs">
                          <Phone className="w-4 h-4 flex-shrink-0" />No phone provided
                        </span>
                      )}
                      {booking.preferredDates && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />{booking.preferredDates}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-gray-600">
                        <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        {booking.adults || 1} adult{(booking.adults || 1) !== 1 ? 's' : ''}
                        {booking.kids ? `, ${booking.kids} kid${booking.kids !== 1 ? 's' : ''}` : ''}
                        {' · '}{booking.rooms || 1} room{(booking.rooms || 1) !== 1 ? 's' : ''}
                      </div>
                      {booking.destination && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />{booking.destination}
                        </div>
                      )}
                    </div>

                    {/* Quick email button */}
                    {booking.customerEmail && (
                      <a
                        href={`mailto:${booking.customerEmail}?subject=Your ${booking.destination || booking.packageTitle} Trip&body=Hello ${booking.customerName},%0D%0A%0D%0AThank you for booking ${booking.packageTitle || 'our travel package'}.${booking.preferredDates ? `%0D%0A%0D%0ATravel dates: ${booking.preferredDates}` : ''}%0D%0A%0D%0ABest regards`}
                        className="inline-flex items-center gap-2 text-xs font-semibold bg-primary/5 text-primary border border-primary/20 px-4 py-2 rounded-xl hover:bg-primary/10 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />Send Email to {booking.customerName.split(' ')[0]}
                      </a>
                    )}

                    {/* Special requests */}
                    {booking.specialRequests && (
                      <div className="bg-white rounded-xl p-3 border border-gray-200 text-sm text-gray-700">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Special Requests</p>
                        {booking.specialRequests}
                      </div>
                    )}

                    {/* Agent comment — submitted from Download/WhatsApp modal */}
                    {booking.agentComment && (
                      <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-sm text-amber-900">
                        <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-1">Agent Notes</p>
                        {booking.agentComment}
                      </div>
                    )}

                    {/* Booking value — pre-filled from package price */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Booking Value ({sym.trim()})</label>
                        {pkgPrice > 0 && !booking.bookingValue && (
                          <span className="text-[10px] text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded-full">
                            Suggested: {sym}{pkgPrice.toLocaleString()} × {booking.groupSize || booking.adults || 1} pax = {sym}{(pkgPrice * (booking.groupSize || booking.adults || 1)).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <BookingValueEditor
                        bookingId={booking.id}
                        initial={booking.bookingValue || (pkgPrice * (booking.groupSize || booking.adults || 1)) || ''}
                        onSave={(val) => updateBooking(booking.id, { bookingValue: Number(val) })}
                        placeholder={pkgPrice ? String(pkgPrice * (booking.groupSize || booking.adults || 1)) : 'Enter amount'}
                        currencySymbol={sym}
                      />
                    </div>

                    {/* Status selector */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Update Status</p>
                      <div className="flex gap-2 flex-wrap">
                        {STATUS_OPTIONS.map(s => (
                          <button key={s} disabled={booking.status === s || updatingId === booking.id}
                            onClick={() => updateBooking(booking.id, { status: s })}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors ${
                              booking.status === s ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary hover:text-primary'
                            } disabled:opacity-50`}
                          >{s}</button>
                        ))}
                        {updatingId === booking.id && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                      </div>
                    </div>

                    {/* Agent notes */}
                    <AgentNotesEditor bookingId={booking.id} initialNotes={booking.agentNotes || ''} onSave={(id, notes) => updateBooking(id, { agentNotes: notes })} />
                  </div>
                </div>
                )
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BookingValueEditor({
  bookingId, initial, onSave, placeholder = 'Enter amount', currencySymbol = '₹',
}: {
  bookingId: string
  initial: number | string
  onSave: (val: string) => Promise<void>
  placeholder?: string
  currencySymbol?: string
}) {
  const [value, setValue] = useState(String(initial || ''))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleBlur() {
    if (String(value) === String(initial)) return
    setSaving(true)
    await onSave(value)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 leading-none">{currencySymbol.trim()}</span>
      <input
        type="number"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
      />
      {saving && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-gray-400" />}
      {saved && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600 font-semibold">Saved</span>}
    </div>
  )
}

function AgentNotesEditor({
  bookingId, initialNotes, onSave,
}: {
  bookingId: string
  initialNotes: string
  onSave: (id: string, notes: string) => Promise<void>
}) {
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(bookingId, notes)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Private Notes</p>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={2}
        placeholder="Add internal notes about this booking (not visible to customer)…"
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-1.5 text-xs text-primary font-semibold hover:underline disabled:opacity-50"
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save notes'}
      </button>
    </div>
  )
}
