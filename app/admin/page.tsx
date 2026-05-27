'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Shield, LogOut, Building2, Users, BarChart2,
  Loader2, ChevronRight, Activity, Clock, CheckCircle2, Ban, XCircle
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import DmcApprovalManager from '@/components/admin/DmcApprovalManager'

type Tab = 'dmc' | 'overview'

const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'dmc',      label: 'DMC Management',  icon: <Building2 className="w-4 h-4" />,  desc: 'Approve or reject DMC applications' },
  { id: 'overview', label: 'Overview',         icon: <BarChart2 className="w-4 h-4" />,  desc: 'Platform-wide stats' },
]

export default function AdminDashboardPage() {
  const router = useRouter()
  const { currentUser, isAdmin, loading: authLoading, logout } = useAuth()
  const [tab, setTab] = useState<Tab>('dmc')
  const [stats, setStats] = useState<{
    pending: number; active: number; suspended: number; rejected: number; total: number
  } | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Guard: only admins
  useEffect(() => {
    if (!authLoading) {
      if (!currentUser) router.replace('/admin-login')
      else if (!isAdmin) router.replace('/')
    }
  }, [authLoading, currentUser, isAdmin, router])

  // Load summary stats
  useEffect(() => {
    if (!isAdmin) return
    async function loadStats() {
      setStatsLoading(true)
      try {
        const res = await fetch('/api/admin/agents')
        const data = await res.json()
        if (data.success) {
          const agents = data.agents as any[]
          setStats({
            total:     agents.length,
            pending:   agents.filter(a => a.status === 'pending').length,
            active:    agents.filter(a => a.status === 'active').length,
            suspended: agents.filter(a => a.status === 'suspended').length,
            rejected:  agents.filter(a => a.status === 'rejected').length,
          })
        }
      } catch { } finally {
        setStatsLoading(false)
      }
    }
    loadStats()
  }, [isAdmin])

  async function handleLogout() {
    await logout()
    router.push('/admin-login')
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
      </div>
    )
  }

  if (!currentUser || !isAdmin) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen overflow-hidden">
        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <aside className="w-64 bg-slate-900 flex-col flex-shrink-0 hidden md:flex">
          {/* Brand */}
          <div className="px-5 py-5 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-white text-sm leading-tight">Journaies</p>
                <p className="text-slate-400 text-xs">Admin Panel</p>
              </div>
            </div>
          </div>

          {/* Stats pills */}
          {!statsLoading && stats && (
            <div className="mx-4 mt-4 grid grid-cols-2 gap-2">
              <StatPill label="Pending" value={stats.pending} color="amber" icon={<Clock className="w-3 h-3" />} />
              <StatPill label="Active"  value={stats.active}  color="green" icon={<CheckCircle2 className="w-3 h-3" />} />
              <StatPill label="Suspended" value={stats.suspended} color="orange" icon={<Ban className="w-3 h-3" />} />
              <StatPill label="Rejected"  value={stats.rejected}  color="red"    icon={<XCircle className="w-3 h-3" />} />
            </div>
          )}

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto mt-2">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                  tab === item.id
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {tab === item.id && <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
              </button>
            ))}
          </nav>

          {/* Bottom: user + logout */}
          <div className="px-4 py-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">{currentUser.email}</p>
                <p className="text-xs text-slate-400 mt-0.5">Super Admin</p>
              </div>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* ── Mobile top bar ────────────────────────────────────────────── */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-violet-400" />
            <span className="font-bold text-white text-sm">Admin Panel</span>
          </div>
          <div className="flex gap-2">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  tab === item.id ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-white">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          {/* Top bar */}
          <div className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-10 hidden md:block">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-bold text-gray-900">
                  {NAV_ITEMS.find(n => n.id === tab)?.label}
                </h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  {NAV_ITEMS.find(n => n.id === tab)?.desc}
                </p>
              </div>
              {stats && (
                <div className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  {stats.pending} pending review
                </div>
              )}
            </div>
          </div>

          {/* Content area */}
          <div className="p-6 pt-20 md:pt-6">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {tab === 'dmc' && <DmcApprovalManager />}
              {tab === 'overview' && <OverviewTab stats={stats} loading={statsLoading} />}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  )
}

// ─── Sidebar stat pill ────────────────────────────────────────────────────────
function StatPill({ label, value, color, icon }: {
  label: string; value: number; color: string; icon: React.ReactNode
}) {
  const colorMap: Record<string, string> = {
    amber:  'bg-amber-500/20 text-amber-300',
    green:  'bg-green-500/20 text-green-300',
    orange: 'bg-orange-500/20 text-orange-300',
    red:    'bg-red-500/20 text-red-300',
  }
  return (
    <div className={`rounded-xl px-2.5 py-2 ${colorMap[color]}`}>
      <div className="flex items-center gap-1 mb-0.5">{icon}<span className="text-[10px] font-medium opacity-80">{label}</span></div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  )
}

// ─── Overview tab ─────────────────────────────────────────────────────────────
function OverviewTab({ stats, loading }: { stats: any; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
      </div>
    )
  }

  const cards = [
    { label: 'Total DMCs',  value: stats?.total || 0,     icon: <Building2 className="w-5 h-5" />,     bg: 'bg-violet-50',  text: 'text-violet-700', border: 'border-violet-100' },
    { label: 'Active',      value: stats?.active || 0,    icon: <CheckCircle2 className="w-5 h-5" />,  bg: 'bg-green-50',   text: 'text-green-700',  border: 'border-green-100' },
    { label: 'Pending',     value: stats?.pending || 0,   icon: <Clock className="w-5 h-5" />,          bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-100' },
    { label: 'Suspended',   value: stats?.suspended || 0, icon: <Ban className="w-5 h-5" />,            bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-100' },
    { label: 'Rejected',    value: stats?.rejected || 0,  icon: <XCircle className="w-5 h-5" />,        bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-100' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Platform Overview</h2>
        <p className="text-sm text-gray-500">Summary of all DMC partners on the platform</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map(card => (
          <div key={card.label} className={`${card.bg} border ${card.border} rounded-2xl p-4`}>
            <div className={`${card.text} mb-3`}>{card.icon}</div>
            <p className={`text-2xl font-bold ${card.text}`}>{card.value}</p>
            <p className="text-xs font-medium text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center text-gray-400">
        <Activity className="w-8 h-8 mx-auto mb-3 opacity-30" />
        <p className="font-medium text-sm">More analytics coming soon</p>
        <p className="text-xs mt-1">Booking volumes, revenue, and platform health metrics will appear here.</p>
      </div>
    </div>
  )
}
