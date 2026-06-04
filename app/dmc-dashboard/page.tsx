'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore'
import { motion } from 'framer-motion'
import {
  Package, Inbox, BarChart2, Users, LogOut, Copy, Check, ExternalLink,
  Building2, Clock, AlertCircle, Loader2, UserCog, Activity, Code2,
  Home, Settings, MessageSquare, Bell, TrendingUp
} from 'lucide-react'
import DashboardHome from '@/components/dmc-dashboard/DashboardHome'
import PackageManager from '@/components/dmc-dashboard/PackageManager'
import BookingInbox from '@/components/dmc-dashboard/BookingInbox'
import Analytics from '@/components/dmc-dashboard/Analytics'
import CustomerRecords from '@/components/dmc-dashboard/CustomerRecords'
import TeamManager from '@/components/dmc-dashboard/TeamManager'
import CRMAnalytics from '@/components/dmc-dashboard/CRMAnalytics'
import EmbedCode from '@/components/dmc-dashboard/EmbedCode'
import AgentSettings from '@/components/dmc-dashboard/AgentSettings'
import QuotationsManager from '@/components/dmc-dashboard/QuotationsManager'
import QuotationHistory from '@/components/dmc-dashboard/QuotationHistory'
import NotificationsPanel from '@/components/dmc-dashboard/NotificationsPanel'
import PricingManager from '@/components/dmc-dashboard/PricingManager'
import type { Agent } from '@/lib/types/agent'

type Tab = 'home' | 'packages' | 'bookings' | 'analytics' | 'customers' | 'team' | 'quotations' | 'quotation_history' | 'crm' | 'embed' | 'settings' | 'pricing'

interface TabDef {
  id: Tab
  label: string
  icon: React.ReactNode
  badge?: number
}

export default function AgentDashboardPage() {
  const router = useRouter()
  const { currentUser, isAgent, isSubAgent, agentSlug, agentStatus, loading: authLoading, logout } = useAuth()

  const [agentData, setAgentData] = useState<Agent | null>(null)
  const pathname = usePathname()
  const pathSegments = pathname.split('/').filter(Boolean)
  const urlSegment = pathSegments.at(-1) ?? ''
  const DMC_VALID_TABS: Tab[] = ['home','packages','bookings','analytics','customers','team','quotations','quotation_history','crm','embed','settings','pricing']
  // Detect /dmc-dashboard/packages/new or /dmc-dashboard/packages/[id]/edit
  const isPackageFormRoute = pathSegments.length >= 3 && pathSegments[1] === 'packages'
  const openPackageCreate = isPackageFormRoute && pathSegments[2] === 'new'
  const openPackageEditId = isPackageFormRoute && pathSegments.length === 4 && pathSegments[3] === 'edit' ? pathSegments[2] : undefined
  const tab: Tab = isPackageFormRoute ? 'packages' : ((DMC_VALID_TABS as string[]).includes(urlSegment) ? (urlSegment as Tab) : 'quotations')
  // Detect /dmc-dashboard/quotations/[id] → auto-open customize form
  const openQuotationId = pathSegments.length === 3 && pathSegments[1] === 'quotations' ? pathSegments[2] : undefined
  const setTab = (t: Tab) => router.push(`/dmc-dashboard/${t}`)
  const [copied, setCopied] = useState(false)
  const [agentLoading, setAgentLoading] = useState(true)
  const [newBookingCount, setNewBookingCount] = useState(0)
  const [notifications, setNotifications] = useState<any[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  // Redirect non-agents; sub-agents get their own dashboard; base URL → quotations
  useEffect(() => {
    if (!authLoading) {
      if (!currentUser) router.push('/agent-login')
      else if (isSubAgent) router.push('/travel-agent-dashboard')
      else if (!isAgent) router.push('/')
      else if (pathname === '/dmc-dashboard') router.replace('/dmc-dashboard/quotations')
    }
  }, [authLoading, currentUser, isAgent, isSubAgent, pathname, router])

  // Fetch agent data + new booking count
  const fetchAgent = useCallback(async () => {
    if (!currentUser || !isAgent) return
    try {
      const snap = await getDoc(doc(db, 'agents', currentUser.uid))
      if (snap.exists()) setAgentData({ id: snap.id, ...snap.data() } as Agent)
    } catch { } finally {
      setAgentLoading(false)
    }
  }, [currentUser, isAgent])

  const fetchNewBookings = useCallback(async () => {
    if (!currentUser) return
    try {
      const res = await fetch(`/api/agent/bookings?agentId=${currentUser.uid}`)
      const data = await res.json()
      if (data.success) {
        setNewBookingCount(data.bookings.filter((b: any) => b.status === 'new').length)
      }
    } catch { }
  }, [currentUser])


  // Manually re-fetch notifications (used by the refresh button in the panel)
  const fetchNotifications = useCallback(async () => {
    if (!currentUser) return
    setNotifLoading(true)
    try {
      const res = await fetch(`/api/agent/notifications?agentId=${currentUser.uid}`)
      const data = await res.json()
      if (data.success) setNotifications(data.notifications)
    } catch { } finally {
      setNotifLoading(false)
    }
  }, [currentUser])

  async function markAllNotificationsRead() {
    if (!currentUser) return
    await fetch('/api/agent/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: currentUser.uid }),
    })
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  useEffect(() => { fetchAgent() }, [fetchAgent])
  useEffect(() => { fetchNewBookings() }, [fetchNewBookings])

  // Real-time listener — updates badge the instant a notification is written
  useEffect(() => {
    if (!currentUser) return
    setNotifLoading(true)
    const q = query(
      collection(db, 'agent_notifications'),
      where('agentId', '==', currentUser.uid)
    )
    const unsub = onSnapshot(q, snap => {
      const notifs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .slice(0, 50)
      setNotifications(notifs)
      setNotifLoading(false)
    })
    return () => unsub()
  }, [currentUser])

  // When DMC opens a tab, mark its notifications as read locally
  useEffect(() => {
    if (tab === 'bookings') setNewBookingCount(0)
    if (tab === 'quotations' || tab === 'bookings') {
      setNotifications(prev => prev.map(n => {
        const isTabNotif = tab === 'quotations'
          ? ['new_quotation', 'quotation_message', 'price_update', 'quotation_status'].includes(n.type)
          : n.type === 'new_booking'
        return isTabNotif ? { ...n, isRead: true } : n
      }))
    }
  }, [tab])

  async function handleLogout() {
    await logout()
    router.push('/agent-login')
  }

  function copyPlannerUrl() {
    const subAgentParam = currentUser ? `?subAgent=${currentUser.uid}` : ''
    const url = `${window.location.origin}/tailored-travel/${agentSlug}${subAgentParam}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (authLoading || agentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    )
  }

  if (agentStatus === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-3xl shadow-lg p-10 max-w-md text-center">
          <Clock className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900">Application Under Review</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Your agent application is pending approval. We'll email you at{' '}
            <strong>{currentUser?.email}</strong> once it's approved.
          </p>
          <button onClick={handleLogout} className="mt-6 text-sm text-gray-500 hover:text-gray-700 hover:underline">Sign out</button>
        </div>
      </div>
    )
  }

  if (agentStatus === 'suspended' || agentStatus === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-3xl shadow-lg p-10 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900">Account {agentStatus === 'suspended' ? 'Suspended' : 'Rejected'}</h1>
          <p className="text-gray-500 mt-2 text-sm">
            {agentStatus === 'suspended'
              ? 'Your account has been suspended. Please contact support.'
              : agentData?.rejectionReason
              ? `Reason: ${agentData.rejectionReason}`
              : 'Your application was not approved. Please contact support.'}
          </p>
          <button onClick={handleLogout} className="mt-6 text-sm text-gray-500 hover:text-gray-700 hover:underline">Sign out</button>
        </div>
      </div>
    )
  }

  const QUOTATION_NOTIF_TYPES = ['new_quotation', 'quotation_message', 'price_update', 'quotation_status']
  const quotationNotifCount = notifications.filter(n => !n.isRead && QUOTATION_NOTIF_TYPES.includes(n.type)).length
  const bookingNotifCount = newBookingCount || notifications.filter(n => !n.isRead && n.type === 'new_booking').length
  const totalUnread = notifications.filter(n => !n.isRead).length

  const TABS: TabDef[] = [
    // { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
    { id: 'quotations', label: 'Quotations', icon: <MessageSquare className="w-4 h-4" />, badge: quotationNotifCount || undefined },
    { id: 'packages', label: 'Packages', icon: <Package className="w-4 h-4" /> },
    // { id: 'bookings', label: 'Bookings', icon: <Inbox className="w-4 h-4" />, badge: bookingNotifCount || undefined },
    // { id: 'analytics', label: 'Analytics', icon: <BarChart2 className="w-4 h-4" /> },
    // { id: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" /> },
    { id: 'team', label: 'Travel Agents', icon: <UserCog className="w-4 h-4" /> },
    { id: 'pricing', label: 'Pricing', icon: <TrendingUp className="w-4 h-4" /> },
    // { id: 'quotation_history', label: 'Quote History', icon: <BarChart2 className="w-4 h-4" /> },
    // { id: 'crm', label: 'CRM', icon: <Activity className="w-4 h-4" /> },
    // { id: 'embed', label: 'Embed', icon: <Code2 className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ]

  // Mobile shows: home, bookings, packages, customers, more
  const MOBILE_TABS = TABS.slice(0, 5)

  const TAB_LABELS: Record<Tab, string> = {
    home: 'Dashboard', packages: 'Packages', bookings: 'Bookings',
    analytics: 'Analytics', customers: 'Customers', team: 'Travel Agents',
    quotations: 'Quotations', quotation_history: 'Quote History', crm: 'CRM & Analytics', embed: 'Embed Planner', settings: 'Settings',
    pricing: 'Pricing',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 bg-white border-r border-gray-100 flex-col flex-shrink-0 hidden md:flex">
          {/* Brand */}
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              {agentData?.logoUrl ? (
                <img src={agentData.logoUrl} alt="" className="w-9 h-9 rounded-xl object-cover border border-gray-100 flex-shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                  {agentData?.companyName?.charAt(0) || 'A'}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-gray-900 text-sm leading-tight truncate">
                  {agentData?.companyName || 'DMC Dashboard'}
                </p>
                <p className="text-xs text-gray-400">DMC Partner</p>
              </div>
            </div>
          </div>

          {/* Planner URL */}
          <div className="mx-4 mt-3 mb-2 bg-primary/5 border border-primary/20 rounded-xl p-3">
            <p className="text-[10px] font-bold text-primary uppercase tracking-wide mb-1">Planner URL</p>
            <p className="text-xs text-gray-600 font-mono break-all leading-relaxed">/tailored-travel/{agentSlug}</p>
            <div className="flex gap-3 mt-2">
              <button onClick={copyPlannerUrl} className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80">
                {copied ? <><Check className="w-3 h-3" />Copied!</> : <><Copy className="w-3 h-3" />Copy</>}
              </button>
              <a href={`/tailored-travel/${agentSlug}${currentUser ? `?subAgent=${currentUser.uid}` : ''}`} target="_blank"
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80">
                <ExternalLink className="w-3 h-3" />Open
              </a>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors relative ${
                  tab === t.id
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {t.icon}
                {t.label}
                {t.badge ? (
                  <span className={`ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-white text-primary' : 'bg-primary text-white'}`}>
                    {t.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>

          {/* Bottom */}
          <div className="px-4 py-4 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              <p className="font-medium text-gray-700 truncate">{currentUser?.email}</p>
              <p className="capitalize mt-0.5">{agentData?.subscriptionPlan || 'Basic'} Plan</p>
            </div>
          </div>
        </aside>

        {/* Mobile bottom nav */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 flex md:hidden">
          {MOBILE_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors relative ${
                tab === t.id ? 'text-primary' : 'text-gray-500'
              }`}
            >
              {t.icon}
              {t.label}
              {t.badge ? (
                <span className="absolute top-1 right-1/4 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {/* Top bar */}
          <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
            <div>
              <h1 className="font-bold text-gray-900">{TAB_LABELS[tab]}</h1>
              <p className="text-xs text-gray-400">{agentData?.companyName} · {agentData?.contactName}</p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={`/tailored-travel/${agentSlug}${currentUser ? `?subAgent=${currentUser.uid}` : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 bg-primary/5 px-3 py-1.5 rounded-lg"
              >
                <ExternalLink className="w-3.5 h-3.5" />View Planner
              </a>

              {/* Notifications bell */}
              <div className="relative">
                <button
                  onClick={() => { setNotifOpen(o => !o); if (!notifOpen) fetchNotifications() }}
                  className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  <Bell className="w-4 h-4" />
                  {totalUnread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {totalUnread > 9 ? '9+' : totalUnread}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <NotificationsPanel
                    notifications={notifications}
                    loading={notifLoading}
                    onClose={() => setNotifOpen(false)}
                    onMarkAllRead={markAllNotificationsRead}
                    onRefresh={fetchNotifications}
                    onGoToTab={(t) => setTab(t as Tab)}
                  />
                )}
              </div>

              <button onClick={handleLogout} className="md:hidden text-gray-400 hover:text-gray-700">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tab content */}
          <div className="p-6 pb-24 md:pb-6">
            {currentUser && agentSlug && (
              <motion.div
                key={tab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                {tab === 'home' && (
                  <DashboardHome
                    agentId={currentUser.uid}
                    agentSlug={agentSlug}
                    companyName={agentData?.companyName || ''}
                    currency={agentData?.baseCurrency}
                    onTabChange={(t) => setTab(t as Tab)}
                  />
                )}
                {tab === 'packages' && <PackageManager agentId={currentUser.uid} companyName={agentData?.companyName} logoUrl={agentData?.logoUrl} contactName={agentData?.contactName} currency={agentData?.baseCurrency} openCreate={openPackageCreate} openEditId={openPackageEditId} />}
                {tab === 'bookings' && (
                  <BookingInbox agentId={currentUser.uid} currency={agentData?.baseCurrency} />
                )}
                {tab === 'analytics' && <Analytics agentId={currentUser.uid} agentSlug={agentSlug} currency={agentData?.baseCurrency} />}
                {tab === 'customers' && <CustomerRecords agentId={currentUser.uid} currency={agentData?.baseCurrency} />}
                {tab === 'team' && <TeamManager agentId={currentUser.uid} agentSlug={agentSlug} />}
                {tab === 'quotations' && (
                  <QuotationsManager
                    agentId={currentUser.uid}
                    agentSlug={agentSlug}
                    agentName={agentData?.companyName || agentData?.contactName || ''}
                    currentUserId={currentUser.uid}
                    openCustomizeId={openQuotationId}
                  />
                )}
                {tab === 'quotation_history' && (
                  <QuotationHistory agentId={currentUser.uid} currency={agentData?.baseCurrency} />
                )}
                {tab === 'crm' && <CRMAnalytics agentId={currentUser.uid} agentSlug={agentSlug} />}
                {tab === 'embed' && <EmbedCode agentSlug={agentSlug} />}
                {tab === 'settings' && <AgentSettings agentId={currentUser.uid} agentSlug={agentSlug} onSaved={fetchAgent} onLogout={handleLogout} />}
                {tab === 'pricing' && <PricingManager agentId={currentUser.uid} />}
              </motion.div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
