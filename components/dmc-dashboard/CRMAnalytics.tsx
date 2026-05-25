'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, Users, BookOpen, Target, MapPin, Activity,
  Loader2, Calendar, User, Package, ChevronDown, ChevronUp,
  Eye, BarChart3, ArrowUpRight
} from 'lucide-react'

interface SubAgentStat {
  id: string
  name: string
  email: string
  isActive: boolean
  totalBookings: number
  totalRevenue: number
  visits: number
  itinerariesGenerated: number
  bookingsSubmitted: number
  conversionRate: number
}

interface SessionEvent {
  id: string
  action: 'visit' | 'itinerary_generated' | 'booking_submitted'
  subAgentId?: string
  subAgentName?: string
  destination?: string
  packageTitle?: string
  timestamp: { seconds: number }
}

interface Props {
  agentId: string
  agentSlug: string
}

const actionLabel: Record<string, string> = {
  visit: 'Visit',
  itinerary_generated: 'Itinerary Generated',
  booking_submitted: 'Booking Submitted',
}

const actionColor: Record<string, string> = {
  visit: 'bg-blue-50 text-blue-700',
  itinerary_generated: 'bg-purple-50 text-purple-700',
  booking_submitted: 'bg-green-50 text-green-700',
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function CRMAnalytics({ agentId, agentSlug }: Props) {
  const [subAgentStats, setSubAgentStats] = useState<SubAgentStat[]>([])
  const [sessions, setSessions] = useState<SessionEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionsPage, setSessionsPage] = useState(20)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [subRes, sessRes] = await Promise.all([
        fetch(`/api/agent/subagents?agentId=${agentId}`),
        fetch(`/api/agent/sessions?agentSlug=${agentSlug}`),
      ])

      const subData = await subRes.json()
      const sessData = await sessRes.json()

      const rawSessions: SessionEvent[] = sessData.success ? sessData.sessions : []
      setSessions(rawSessions)

      if (subData.success) {
        // Enrich sub-agent data with session counts
        const enriched: SubAgentStat[] = subData.subAgents.map((sa: any) => {
          const agentSessions = rawSessions.filter(s => s.subAgentId === sa.id)
          const visits = agentSessions.filter(s => s.action === 'visit').length
          const itinerariesGenerated = agentSessions.filter(s => s.action === 'itinerary_generated').length
          const bookingsSubmitted = agentSessions.filter(s => s.action === 'booking_submitted').length
          const conversionRate = visits > 0 ? Math.round((bookingsSubmitted / visits) * 100) : 0
          return { ...sa, visits, itinerariesGenerated, bookingsSubmitted, conversionRate }
        })
        setSubAgentStats(enriched)
      }
    } catch { } finally {
      setLoading(false)
    }
  }, [agentId, agentSlug])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Aggregate totals
  const totalVisits = sessions.filter(s => s.action === 'visit').length
  const guestVisits = sessions.filter(s => s.action === 'visit' && !s.subAgentId).length
  const teamVisits = sessions.filter(s => s.action === 'visit' && s.subAgentId).length
  const totalItineraries = sessions.filter(s => s.action === 'itinerary_generated').length
  const totalBookings = sessions.filter(s => s.action === 'booking_submitted').length
  const conversionRate = totalVisits > 0 ? Math.round((totalBookings / totalVisits) * 100) : 0

  // Top destinations
  const destCounts: Record<string, number> = {}
  sessions.forEach(s => {
    if (s.destination) destCounts[s.destination] = (destCounts[s.destination] || 0) + 1
  })
  const topDestinations = Object.entries(destCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  function formatTime(ts?: { seconds: number }) {
    if (!ts) return '—'
    const d = new Date(ts.seconds * 1000)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
      ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Overview header */}

      {/* Overview stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Eye} label="Total Visits" value={totalVisits}
          sub={`${guestVisits} guest · ${teamVisits} team`} color="bg-blue-100 text-blue-600" />
        <StatCard icon={BarChart3} label="Itineraries" value={totalItineraries}
          color="bg-purple-100 text-purple-600" />
        <StatCard icon={BookOpen} label="Bookings" value={totalBookings}
          color="bg-green-100 text-green-600" />
        <StatCard icon={Target} label="Conversion" value={`${conversionRate}%`}
          sub="visits → bookings" color="bg-amber-100 text-amber-600" />
      </div>

      {/* Sub-agent performance table */}
      {subAgentStats.length > 0 && (
        <div>
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            Team Performance
          </h3>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Member</th>
                    <th className="text-center px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Visits</th>
                    <th className="text-center px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Itineraries</th>
                    <th className="text-center px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Bookings</th>
                    <th className="text-center px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Conversion</th>
                    <th className="text-center px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {subAgentStats.map(sa => (
                    <tr key={sa.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                            {sa.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{sa.name}</p>
                            <p className="text-xs text-gray-400">{sa.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center font-medium text-gray-900">{sa.visits}</td>
                      <td className="px-4 py-4 text-center font-medium text-gray-900">{sa.itinerariesGenerated}</td>
                      <td className="px-4 py-4 text-center">
                        <span className="font-bold text-green-700">{sa.bookingsSubmitted}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className={`font-bold ${sa.conversionRate >= 20 ? 'text-green-700' : sa.conversionRate >= 10 ? 'text-amber-700' : 'text-gray-500'}`}>
                            {sa.conversionRate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          sa.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {sa.isActive ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Two-column: Destinations + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top destinations */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-500" />
            Top Destinations
          </h3>
          {topDestinations.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No data yet</p>
          ) : (
            <div className="space-y-3">
              {topDestinations.map(([dest, count], i) => {
                const maxCount = topDestinations[0][1]
                const pct = Math.round((count / maxCount) * 100)
                return (
                  <div key={dest}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{dest}</span>
                      <span className="text-sm font-bold text-gray-900">{count}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: i * 0.1, duration: 0.6 }}
                        className="h-full bg-primary rounded-full"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Funnel breakdown */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            Funnel Breakdown
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Page Visits', value: totalVisits, color: 'bg-blue-500', max: totalVisits || 1 },
              { label: 'Itineraries Generated', value: totalItineraries, color: 'bg-purple-500', max: totalVisits || 1 },
              { label: 'Bookings Submitted', value: totalBookings, color: 'bg-green-500', max: totalVisits || 1 },
            ].map(({ label, value, color, max }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-gray-600">{label}</span>
                  <span className="text-sm font-bold text-gray-900">{value}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round((value / max) * 100)}%` }}
                    transition={{ duration: 0.7 }}
                    className={`h-full ${color} rounded-full`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity feed */}
      <div>
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-gray-500" />
          Recent Activity
        </h3>
        {sessions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No activity recorded yet. Share your planner URL to start tracking.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-50">
              {sessions.slice(0, sessionsPage).map(ev => (
                <div key={ev.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                  {/* Action badge */}
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 mt-0.5 ${actionColor[ev.action]}`}>
                    {actionLabel[ev.action]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {ev.subAgentName ? (
                        <span className="flex items-center gap-1 text-sm font-medium text-gray-900">
                          <User className="w-3.5 h-3.5 text-primary" />
                          {ev.subAgentName}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-500 italic">Guest visitor</span>
                      )}
                      {ev.destination && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="w-3 h-3" />{ev.destination}
                        </span>
                      )}
                      {ev.packageTitle && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Package className="w-3 h-3" />{ev.packageTitle}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{formatTime(ev.timestamp)}</span>
                </div>
              ))}
            </div>
            {sessions.length > sessionsPage && (
              <div className="px-5 py-3 border-t border-gray-100 flex justify-center">
                <button
                  onClick={() => setSessionsPage(p => p + 20)}
                  className="text-sm text-primary font-semibold hover:underline flex items-center gap-1"
                >
                  Load more <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
