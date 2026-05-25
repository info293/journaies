'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Loader2, UserCircle, Phone, Mail, Search, Tag, MessageCircle,
  ChevronDown, ChevronUp, Pencil, Check, Banknote, BookOpen,
  Calendar, MapPin, Users, Inbox, TrendingUp, Clock
} from 'lucide-react'
import { getCurrencySymbol } from '@/lib/utils/currency'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore'

interface Customer {
  id: string
  agentId: string
  name: string
  email: string
  phone?: string
  totalTrips: number
  totalSpend: number
  notes?: string
  tags?: string[]
  createdAt?: any
}

interface BookingRecord {
  id: string
  customerEmail: string
  customerName: string
  packageTitle: string
  destination: string
  status: string
  bookingValue?: number
  quotedPrice?: number
  groupSize?: number
  adults?: number
  preferredDates?: string
  createdAt?: { seconds: number }
}

interface EnrichedCustomer extends Customer {
  bookings: BookingRecord[]
  computedSpend: number
  lastBookingDate?: Date
}

interface Props {
  agentId: string
  currency?: string
}

const AVAILABLE_TAGS = ['VIP', 'Repeat', 'Corporate', 'High-value', 'First-time', 'Group', 'Honeymoon']

const TAG_COLORS: Record<string, string> = {
  VIP: 'bg-amber-100 text-amber-800 border-amber-200',
  Repeat: 'bg-blue-100 text-blue-800 border-blue-200',
  Corporate: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'High-value': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'First-time': 'bg-purple-100 text-purple-800 border-purple-200',
  Group: 'bg-orange-100 text-orange-800 border-orange-200',
  Honeymoon: 'bg-pink-100 text-pink-800 border-pink-200',
}

const BOOKING_STATUS: Record<string, { label: string; dot: string }> = {
  new:       { label: 'New',       dot: 'bg-blue-500' },
  contacted: { label: 'Contacted', dot: 'bg-yellow-500' },
  confirmed: { label: 'Confirmed', dot: 'bg-emerald-500' },
  completed: { label: 'Completed', dot: 'bg-green-500' },
  cancelled: { label: 'Cancelled', dot: 'bg-red-400' },
}

type SortKey = 'recent' | 'trips' | 'spend' | 'name'

function formatDate(ts?: { seconds: number } | null) {
  if (!ts?.seconds) return null
  return new Date(ts.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CustomerRecords({ agentId, currency }: Props) {
  const sym = getCurrencySymbol(currency)
  const [customers, setCustomers] = useState<EnrichedCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('recent')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [custSnap, bookSnap] = await Promise.all([
        getDocs(query(collection(db, 'agent_customers'), where('agentId', '==', agentId))),
        getDocs(query(collection(db, 'agent_bookings'), where('agentId', '==', agentId))),
      ])

      const bookingsByEmail = new Map<string, BookingRecord[]>()
      bookSnap.docs.forEach(d => {
        const b = { id: d.id, ...d.data() } as BookingRecord
        const email = b.customerEmail?.toLowerCase() || ''
        if (!bookingsByEmail.has(email)) bookingsByEmail.set(email, [])
        bookingsByEmail.get(email)!.push(b)
      })

      const list: EnrichedCustomer[] = custSnap.docs.map(d => {
        const cust = { id: d.id, ...d.data() } as Customer
        const email = cust.email?.toLowerCase() || ''
        const bookings = (bookingsByEmail.get(email) || []).sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        )
        const computedSpend = bookings
          .filter(b => b.status === 'confirmed' || b.status === 'completed')
          .reduce((s, b) => s + (b.bookingValue || b.quotedPrice || 0), 0)
        const lastBookingDate = bookings[0]?.createdAt
          ? new Date(bookings[0].createdAt.seconds * 1000)
          : undefined

        bookingsByEmail.delete(email)

        return { ...cust, bookings, computedSpend, lastBookingDate }
      })

      // Also include customers who have bookings but no customer record yet
      bookingsByEmail.forEach((bookings, email) => {
        if (!email) return
        const first = bookings[0]
        const computedSpend = bookings
          .filter(b => b.status === 'confirmed' || b.status === 'completed')
          .reduce((s, b) => s + (b.bookingValue || b.quotedPrice || 0), 0)
        list.push({
          id: `booking_${email}`,
          agentId,
          name: first.customerName || email,
          email,
          totalTrips: bookings.length,
          totalSpend: computedSpend,
          bookings: bookings.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)),
          computedSpend,
          lastBookingDate: bookings[0]?.createdAt ? new Date(bookings[0].createdAt.seconds * 1000) : undefined,
        })
      })

      setCustomers(list)
    } catch { } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => { fetchData() }, [fetchData])

  async function updateCustomer(id: string, updates: Partial<Customer>) {
    if (id.startsWith('booking_')) return
    await updateDoc(doc(db, 'agent_customers', id), { ...updates, updatedAt: serverTimestamp() })
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
  }

  const filtered = customers
    .filter(c => {
      if (tagFilter && !c.tags?.includes(tagFilter)) return false
      if (!search) return true
      const s = search.toLowerCase()
      return c.name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s) || c.phone?.toLowerCase().includes(s)
    })
    .sort((a, b) => {
      if (sortKey === 'recent') return (b.lastBookingDate?.getTime() || 0) - (a.lastBookingDate?.getTime() || 0)
      if (sortKey === 'trips') return (b.bookings.length || b.totalTrips || 0) - (a.bookings.length || a.totalTrips || 0)
      if (sortKey === 'spend') return (b.computedSpend || 0) - (a.computedSpend || 0)
      return (a.name || '').localeCompare(b.name || '')
    })

  const usedTags = Array.from(new Set(customers.flatMap(c => c.tags || [])))
  const totalRevenue = customers.reduce((s, c) => s + c.computedSpend, 0)

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div></div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white text-gray-600"
          >
            <option value="recent">Sort: Most Recent</option>
            <option value="trips">Sort: Most Bookings</option>
            <option value="spend">Sort: Most Spend</option>
            <option value="name">Sort: Name A–Z</option>
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-44"
            />
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      {customers.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Users, label: 'Total Customers', value: customers.length, color: 'text-purple-600 bg-purple-50' },
            { icon: BookOpen, label: 'Total Bookings', value: customers.reduce((s, c) => s + c.bookings.length, 0), color: 'text-blue-600 bg-blue-50' },
            { icon: Banknote, label: 'Confirmed Revenue', value: totalRevenue > 0 ? `${sym}${(totalRevenue / 1000).toFixed(0)}K` : '—', color: 'text-emerald-600 bg-emerald-50' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color}`}>
                <s.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg leading-tight">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tag filters */}
      {usedTags.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTagFilter(null)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${!tagFilter ? 'bg-primary text-white border-primary' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}
          >
            All
          </button>
          {usedTags.map(tag => (
            <button
              key={tag}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${tagFilter === tag ? 'bg-primary text-white border-primary' : `${TAG_COLORS[tag] || 'bg-white text-gray-600 border-gray-200'}`}`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <UserCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {search || tagFilter ? 'No customers match your filter' : 'No customers yet'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {search || tagFilter
              ? 'Try a different search or remove the filter.'
              : 'Customers appear automatically when they submit a booking.'}
          </p>
          {(search || tagFilter) && (
            <button
              onClick={() => { setSearch(''); setTagFilter(null) }}
              className="mt-3 text-xs text-primary font-semibold hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(customer => {
            const isExpanded = expandedId === customer.id
            const canEdit = !customer.id.startsWith('booking_')
            const confirmedBookings = customer.bookings.filter(b => b.status === 'confirmed' || b.status === 'completed')

            return (
              <div key={customer.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {/* Row */}
                <div
                  className="flex items-center gap-4 px-4 py-3.5 cursor-pointer hover:bg-gray-50/60 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : customer.id)}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                    {customer.name?.charAt(0).toUpperCase() || '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{customer.name}</p>
                      {customer.tags?.map(tag => (
                        <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${TAG_COLORS[tag] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Mail className="w-3 h-3" />
                        <a href={`mailto:${customer.email}`} onClick={e => e.stopPropagation()} className="hover:text-primary transition-colors">
                          {customer.email}
                        </a>
                      </span>
                      {customer.phone && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Phone className="w-3 h-3" />{customer.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-5 text-center flex-shrink-0 mr-2">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{customer.bookings.length}</p>
                      <p className="text-[10px] text-gray-400">trips</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{confirmedBookings.length}</p>
                      <p className="text-[10px] text-gray-400">confirmed</p>
                    </div>
                    {customer.computedSpend > 0 && (
                      <div>
                        <p className="text-sm font-bold text-emerald-700">{sym}{(customer.computedSpend / 1000).toFixed(0)}K</p>
                        <p className="text-[10px] text-gray-400">spend</p>
                      </div>
                    )}
                  </div>

                  {/* Mobile stats */}
                  <div className="sm:hidden text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">{customer.bookings.length} trip{customer.bookings.length !== 1 ? 's' : ''}</p>
                    {customer.computedSpend > 0 && <p className="text-xs text-emerald-600">{sym}{(customer.computedSpend / 1000).toFixed(0)}K</p>}
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
                    <div className="px-5 pt-4 pb-3 flex flex-wrap gap-2">
                      <a
                        href={`mailto:${customer.email}`}
                        className="flex items-center gap-1.5 text-xs font-semibold bg-white border border-gray-200 text-gray-700 px-3 py-2 rounded-xl hover:border-primary hover:text-primary transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" />Email
                      </a>
                      {customer.phone && (
                        <>
                          <a
                            href={`tel:${customer.phone}`}
                            className="flex items-center gap-1.5 text-xs font-semibold bg-white border border-gray-200 text-gray-700 px-3 py-2 rounded-xl hover:border-primary hover:text-primary transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" />Call
                          </a>
                          <a
                            href={`https://wa.me/${customer.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            className="flex items-center gap-1.5 text-xs font-semibold bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-xl hover:bg-green-100 transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />WhatsApp
                          </a>
                        </>
                      )}
                    </div>

                    <div className="px-5 pb-5 space-y-4">
                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                          <p className="text-lg font-bold text-gray-900">{customer.bookings.length}</p>
                          <p className="text-[10px] text-gray-500">Bookings</p>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                          <p className="text-lg font-bold text-gray-900">{confirmedBookings.length}</p>
                          <p className="text-[10px] text-gray-500">Confirmed</p>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                          <p className="text-lg font-bold text-emerald-700">
                            {customer.computedSpend > 0 ? `${sym}${(customer.computedSpend / 1000).toFixed(0)}K` : '—'}
                          </p>
                          <p className="text-[10px] text-gray-500">Revenue</p>
                        </div>
                      </div>

                      {/* Booking history */}
                      {customer.bookings.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <Inbox className="w-3.5 h-3.5" />Booking History
                          </p>
                          <div className="space-y-2">
                            {customer.bookings.map(b => {
                              const st = BOOKING_STATUS[b.status] || BOOKING_STATUS.new
                              const value = b.bookingValue || b.quotedPrice
                              return (
                                <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-start gap-3">
                                  <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${st.dot}`} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{b.packageTitle}</p>
                                    <div className="flex flex-wrap gap-2 mt-0.5">
                                      {b.destination && (
                                        <span className="flex items-center gap-0.5 text-[11px] text-gray-400">
                                          <MapPin className="w-2.5 h-2.5" />{b.destination}
                                        </span>
                                      )}
                                      {b.groupSize && (
                                        <span className="flex items-center gap-0.5 text-[11px] text-gray-400">
                                          <Users className="w-2.5 h-2.5" />{b.groupSize} pax
                                        </span>
                                      )}
                                      {b.preferredDates && (
                                        <span className="flex items-center gap-0.5 text-[11px] text-gray-400">
                                          <Calendar className="w-2.5 h-2.5" />{b.preferredDates}
                                        </span>
                                      )}
                                      {formatDate(b.createdAt) && (
                                        <span className="flex items-center gap-0.5 text-[11px] text-gray-400">
                                          <Clock className="w-2.5 h-2.5" />{formatDate(b.createdAt)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex-shrink-0 text-right">
                                    {value && (
                                      <p className={`text-xs font-bold ${b.bookingValue ? 'text-emerald-700' : 'text-purple-600'}`}>
                                        {sym}{Number(value).toLocaleString()}
                                      </p>
                                    )}
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${b.status === 'confirmed' || b.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : b.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                      {st.label}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Tags editor (only for customers in agent_customers) */}
                      {canEdit && (
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5" />Tags
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {AVAILABLE_TAGS.map(tag => {
                              const active = customer.tags?.includes(tag)
                              return (
                                <button
                                  key={tag}
                                  onClick={() => {
                                    const current = customer.tags || []
                                    const next = active ? current.filter(t => t !== tag) : [...current, tag]
                                    updateCustomer(customer.id, { tags: next })
                                  }}
                                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                                    active
                                      ? `${TAG_COLORS[tag] || 'bg-gray-200 text-gray-700 border-transparent'}`
                                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                                  }`}
                                >
                                  {tag}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {canEdit && (
                        <CustomerNotesEditor
                          customerId={customer.id}
                          initialNotes={customer.notes || ''}
                          onSave={(id, notes) => updateCustomer(id, { notes })}
                        />
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
  )
}

function CustomerNotesEditor({
  customerId, initialNotes, onSave,
}: {
  customerId: string
  initialNotes: string
  onSave: (id: string, notes: string) => Promise<void>
}) {
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(customerId, notes)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
        <Pencil className="w-3.5 h-3.5" />Notes
      </p>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={2}
        placeholder="Add notes about this customer's preferences, budget, travel style…"
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-1.5 text-xs text-primary font-semibold hover:underline disabled:opacity-50 flex items-center gap-1"
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <Check className="w-3 h-3 text-green-600" /> : null}
        {saving ? 'Saving…' : saved ? 'Saved!' : 'Save notes'}
      </button>
    </div>
  )
}
