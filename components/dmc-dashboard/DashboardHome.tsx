'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Banknote, Inbox, Users, Package, TrendingUp, ExternalLink,
  Copy, Check, ArrowRight, Loader2, Clock, CheckCircle, XCircle,
  Eye, BarChart3, Phone, TrendingDown, AlertCircle, Settings,
  Code2, UserCog
} from 'lucide-react'
import { getCurrencySymbol } from '@/lib/utils/currency'

interface Props {
  agentId: string
  agentSlug: string
  companyName: string
  currency?: string
  onTabChange: (tab: string) => void
}

interface KPI {
  label: string
  value: string | number
  sub: string
  icon: any
  color: string
  tab?: string
  trend?: number | null   // % change vs last month, null = no data
}

interface RecentBooking {
  id: string
  customerName: string
  packageTitle: string
  destination: string
  status: string
  bookingValue?: number
  createdAt?: { seconds: number }
  customerPhone?: string
  customerEmail?: string
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-gray-100 text-gray-600',
}

export default function DashboardHome({ agentId, agentSlug, companyName, currency, onTabChange }: Props) {
  const sym = getCurrencySymbol(currency)
  const [analytics, setAnalytics] = useState<any>(null)
  const [allBookings, setAllBookings] = useState<RecentBooking[]>([])
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const plannerUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/tailored-travel/${agentSlug}`
    : `https://www.travelzada.com/tailored-travel/${agentSlug}`

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [analyticsRes, bookingsRes, sessionsRes] = await Promise.all([
        fetch(`/api/agent/analytics?agentId=${agentId}`),
        fetch(`/api/agent/bookings?agentId=${agentId}`),
        fetch(`/api/agent/sessions?agentSlug=${agentSlug}`),
      ])
      const [analyticsData, bookingsData, sessionsData] = await Promise.all([
        analyticsRes.json(),
        bookingsRes.json(),
        sessionsRes.json(),
      ])

      if (analyticsData.success) setAnalytics(analyticsData.analytics)

      if (bookingsData.success) {
        const sorted = bookingsData.bookings.sort(
          (a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        )
        setAllBookings(sorted)
        setRecentBookings(sorted.slice(0, 6))
      }

      if (sessionsData.success) setSessions(sessionsData.sessions)
    } catch { } finally {
      setLoading(false)
    }
  }, [agentId, agentSlug])

  useEffect(() => { fetchAll() }, [fetchAll])

  function copyUrl() {
    navigator.clipboard.writeText(plannerUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function formatDate(ts?: { seconds: number }) {
    if (!ts) return ''
    return new Date(ts.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  // Compute this-month + last-month stats for trend arrows
  const now = new Date()
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`

  const thisMonthRevenue = analytics?.revenueByMonth?.find((m: any) => m.month === thisMonthKey)?.revenue || 0
  const lastMonthRevenue = analytics?.revenueByMonth?.find((m: any) => m.month === lastMonthKey)?.revenue || 0

  const bookingMonth = (b: any) => {
    if (!b.createdAt?.seconds) return ''
    const d = new Date(b.createdAt.seconds * 1000)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  const thisMonthBookings = allBookings.filter(b => bookingMonth(b) === thisMonthKey).length
  const lastMonthBookings = allBookings.filter(b => bookingMonth(b) === lastMonthKey).length

  function calcTrend(current: number, previous: number): number | null {
    if (previous === 0) return null
    return Math.round(((current - previous) / previous) * 100)
  }

  const revenueTrend = calcTrend(thisMonthRevenue, lastMonthRevenue)
  const bookingsTrend = calcTrend(thisMonthBookings, lastMonthBookings)

  const newBookings = allBookings.filter(b => b.status === 'new').length
  const totalVisits = sessions.filter(s => s.action === 'visit').length
  const totalItineraries = sessions.filter(s => s.action === 'itinerary_generated').length

  const avgBookingValue = analytics?.confirmedBookings > 0
    ? Math.round(analytics.totalRevenue / analytics.confirmedBookings)
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  const kpis: KPI[] = [
    {
      label: 'Total Revenue',
      value: `${sym}${(analytics?.totalRevenue || 0).toLocaleString()}`,
      sub: `${sym}${thisMonthRevenue.toLocaleString()} this month`,
      icon: Banknote, color: 'bg-emerald-100 text-emerald-700', tab: 'analytics',
      trend: revenueTrend,
    },
    {
      label: 'Total Bookings',
      value: analytics?.totalBookings || 0,
      sub: `${newBookings} new · ${analytics?.confirmedBookings || 0} confirmed`,
      icon: Inbox, color: 'bg-blue-100 text-blue-700', tab: 'bookings',
      trend: bookingsTrend,
    },
    {
      label: 'Customers',
      value: analytics?.totalCustomers || 0,
      sub: `Avg ${sym}${avgBookingValue.toLocaleString()} per booking`,
      icon: Users, color: 'bg-purple-100 text-purple-700', tab: 'customers',
      trend: null,
    },
    {
      label: 'Packages',
      value: analytics?.totalPackages || 0,
      sub: `${analytics?.activePackages || 0} active`,
      icon: Package, color: 'bg-amber-100 text-amber-700', tab: 'packages',
      trend: null,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Action Required Banner */}
      {newBookings > 0 && (
        <div
          onClick={() => onTabChange('bookings')}
          className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-blue-100 transition-colors"
        >
          <span className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-white" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-blue-900 text-sm">
              {newBookings} new booking{newBookings !== 1 ? 's' : ''} need{newBookings === 1 ? 's' : ''} attention
            </p>
            <p className="text-xs text-blue-600 mt-0.5">Tap to open Booking Inbox and respond</p>
          </div>
          <ArrowRight className="w-4 h-4 text-blue-400 flex-shrink-0" />
        </div>
      )}

      {/* Welcome header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div></div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyUrl}
            className="flex items-center gap-1.5 text-xs font-semibold border border-gray-200 bg-white text-gray-600 px-3 py-2 rounded-xl hover:border-primary hover:text-primary transition-colors"
          >
            {copied ? <><Check className="w-3.5 h-3.5 text-green-600" />Copied!</> : <><Copy className="w-3.5 h-3.5" />Copy Planner URL</>}
          </button>
          <a
            href={`/tailored-travel/${agentSlug}`}
            target="_blank"
            className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-white px-3 py-2 rounded-xl hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Planner
          </a>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            onClick={() => kpi.tab && onTabChange(kpi.tab)}
            className={`bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-3 ${kpi.tab ? 'cursor-pointer hover:shadow-md hover:border-gray-300 transition-all' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${kpi.color}`}>
                <kpi.icon className="w-5 h-5" />
              </div>
              {kpi.trend !== null && kpi.trend !== undefined && (
                <span className={`flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-full ${
                  kpi.trend > 0
                    ? 'bg-emerald-50 text-emerald-700'
                    : kpi.trend < 0
                    ? 'bg-red-50 text-red-600'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {kpi.trend > 0
                    ? <TrendingUp className="w-3 h-3" />
                    : kpi.trend < 0
                    ? <TrendingDown className="w-3 h-3" />
                    : null}
                  {kpi.trend > 0 ? '+' : ''}{kpi.trend}%
                </span>
              )}
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
              <p className="text-xs font-semibold text-gray-500 mt-0.5">{kpi.label}</p>
              <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main grid: Recent bookings + Planner funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent bookings — 2/3 width */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">Recent Bookings</h3>
            <button
              onClick={() => onTabChange('bookings')}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {recentBookings.length === 0 ? (
            <div className="py-12 text-center">
              <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No bookings yet. Share your planner to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentBookings.map(b => (
                <div key={b.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/60 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-xs flex-shrink-0">
                    {b.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{b.customerName}</p>
                    <p className="text-xs text-gray-400 truncate">{b.packageTitle}</p>
                  </div>
                  <div className="text-right flex-shrink-0 space-y-0.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[b.status] || 'bg-gray-100 text-gray-600'}`}>
                      {b.status}
                    </span>
                    {b.bookingValue ? (
                      <p className="text-xs text-gray-500">{sym}{b.bookingValue.toLocaleString()}</p>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-400 flex-shrink-0 w-14 text-right">
                    {formatDate(b.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Planner funnel — 1/3 width */}
        <div className="space-y-4">
          {/* Planner stats */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-500" />
              Planner Funnel
            </h3>
            {(() => {
              const bookingSubmitted = sessions.filter(s => s.action === 'booking_submitted').length
              const steps = [
                { label: 'Visits', value: totalVisits, color: 'bg-blue-500', pct: 100 },
                { label: 'Itineraries', value: totalItineraries, color: 'bg-purple-500', pct: totalVisits > 0 ? Math.round((totalItineraries / totalVisits) * 100) : 0 },
                { label: 'Bookings', value: bookingSubmitted, color: 'bg-emerald-500', pct: totalVisits > 0 ? Math.round((bookingSubmitted / totalVisits) * 100) : 0 },
              ]
              return (
                <div className="space-y-3">
                  {steps.map(step => (
                    <div key={step.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-600">{step.label}</span>
                        <span className="text-sm font-bold text-gray-900">{step.value}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${step.color} rounded-full transition-all duration-700`} style={{ width: `${step.pct}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Visit → Booking rate</span>
                    <span className="text-sm font-bold text-emerald-600">
                      {totalVisits > 0 ? `${Math.round((sessions.filter(s => s.action === 'booking_submitted').length / totalVisits) * 100)}%` : '0%'}
                    </span>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: 'Add New Package', icon: Package, action: () => onTabChange('packages') },
                { label: 'Manage Travel Agents', icon: UserCog, action: () => onTabChange('team') },
                { label: 'Get Embed Code', icon: Code2, action: () => onTabChange('embed') },
                { label: 'Settings & Profile', icon: Settings, action: () => onTabChange('settings') },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-sm text-gray-700 font-medium transition-colors text-left group"
                >
                  <item.icon className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
                  {item.label}
                  <ArrowRight className="w-3.5 h-3.5 ml-auto text-gray-300 group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly revenue chart */}
      {analytics?.revenueByMonth?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-bold text-gray-900 mb-5">Monthly Revenue</h3>
          <div className="flex items-end gap-3 h-32">
            {analytics.revenueByMonth.map((m: any, i: number) => {
              const max = Math.max(...analytics.revenueByMonth.map((x: any) => x.revenue), 1)
              const pct = (m.revenue / max) * 100
              const [year, month] = m.month.split('-')
              const label = new Date(Number(year), Number(month) - 1).toLocaleDateString('en-IN', { month: 'short' })
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5">
                  <p className="text-xs font-semibold text-gray-600">
                    {sym}{m.revenue >= 100000 ? `${(m.revenue / 100000).toFixed(1)}L` : m.revenue >= 1000 ? `${(m.revenue / 1000).toFixed(0)}K` : m.revenue}
                  </p>
                  <div className="w-full bg-gray-100 rounded-t-lg overflow-hidden" style={{ height: '80px' }}>
                    <div
                      className="w-full bg-primary rounded-t-lg transition-all duration-700"
                      style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Status pipeline */}
      {analytics?.bookingsByStatus?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-bold text-gray-900 mb-4">Booking Pipeline</h3>
          <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
            {['new', 'contacted', 'confirmed', 'completed', 'cancelled'].map(status => {
              const count = analytics.bookingsByStatus.find((b: any) => b.status === status)?.count || 0
              const configs: Record<string, { label: string; color: string; bg: string }> = {
                new: { label: 'New', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
                contacted: { label: 'Contacted', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
                confirmed: { label: 'Confirmed', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
                completed: { label: 'Completed', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' },
                cancelled: { label: 'Cancelled', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
              }
              const cfg = configs[status]
              return (
                <button
                  key={status}
                  onClick={() => onTabChange('bookings')}
                  className={`flex-1 min-w-[90px] rounded-xl border p-3 text-center cursor-pointer hover:shadow-sm transition-all ${cfg.bg}`}
                >
                  <p className={`text-2xl font-bold ${cfg.color}`}>{count}</p>
                  <p className={`text-xs font-medium mt-0.5 ${cfg.color}`}>{cfg.label}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
