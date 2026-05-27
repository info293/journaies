'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2, XCircle, Clock, Ban, RefreshCw, Search,
  Building2, Mail, Phone, Calendar, ChevronDown, ChevronUp,
  Loader2, AlertTriangle, MessageSquare, Percent, Filter,
  Eye, Check, X, RotateCcw, FileText, ExternalLink, Users
} from 'lucide-react'
import type { Agent, AgentStatus } from '@/lib/types/agent'

type FilterStatus = 'all' | AgentStatus

const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending:   { label: 'Pending',   color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',  icon: <Clock className="w-3.5 h-3.5" /> },
  active:    { label: 'Active',    color: 'text-green-700',  bg: 'bg-green-50 border-green-200',  icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  suspended: { label: 'Suspended', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: <Ban className="w-3.5 h-3.5" /> },
  rejected:  { label: 'Rejected',  color: 'text-red-700',    bg: 'bg-red-50 border-red-200',      icon: <XCircle className="w-3.5 h-3.5" /> },
}

interface DmcWithBookings extends Agent {
  liveBookings?: number
}

interface ConfirmModal {
  action: 'approve' | 'reject' | 'suspend' | 'reactivate'
  agentId: string
  agentName: string
}

export default function DmcApprovalManager() {
  const [agents, setAgents] = useState<DmcWithBookings[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('pending')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionNotes, setActionNotes] = useState('')
  const [commissionOverride, setCommissionOverride] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const fetchAgents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/agents')
      const data = await res.json()
      if (data.success) setAgents(data.agents)
    } catch (e) {
      console.error('Failed to fetch agents:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAgents() }, [fetchAgents])

  const filtered = agents.filter(a => {
    const matchStatus = filter === 'all' || a.status === filter
    const matchSearch = !search ||
      a.companyName?.toLowerCase().includes(search.toLowerCase()) ||
      a.contactName?.toLowerCase().includes(search.toLowerCase()) ||
      a.email?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const counts: Record<FilterStatus, number> = {
    all: agents.length,
    pending: agents.filter(a => a.status === 'pending').length,
    active: agents.filter(a => a.status === 'active').length,
    suspended: agents.filter(a => a.status === 'suspended').length,
    rejected: agents.filter(a => a.status === 'rejected').length,
  }

  async function handleAction() {
    if (!confirmModal) return
    setActionLoading(true)
    setActionError('')

    const body: Record<string, any> = {
      action: confirmModal.action,
      approvedBy: 'admin',
    }
    if (confirmModal.action === 'reject') body.rejectionReason = rejectionReason
    if (actionNotes) body.adminNotes = actionNotes
    if (commissionOverride) body.commissionRate = Number(commissionOverride)

    try {
      const res = await fetch(`/api/admin/agents/${confirmModal.agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Action failed')

      const actionLabel = {
        approve: 'approved',
        reject: 'rejected',
        suspend: 'suspended',
        reactivate: 'reactivated',
      }[confirmModal.action]

      setSuccessMsg(`DMC ${actionLabel} successfully.`)
      setTimeout(() => setSuccessMsg(''), 3500)
      setConfirmModal(null)
      setRejectionReason('')
      setActionNotes('')
      setCommissionOverride('')
      await fetchAgents()
    } catch (e: any) {
      setActionError(e.message || 'Something went wrong')
    } finally {
      setActionLoading(false)
    }
  }

  async function quickUpdateNotes(agentId: string, adminNotes: string) {
    await fetch(`/api/admin/agents/${agentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminNotes }),
    })
  }

  function formatDate(ts: any) {
    if (!ts) return '—'
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const FILTERS: { key: FilterStatus; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'active', label: 'Active' },
    { key: 'suspended', label: 'Suspended' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
  ]

  return (
    <div className="space-y-5">
      {/* Header + refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">DMC Applications</h2>
          <p className="text-sm text-gray-500 mt-0.5">Review, approve, or reject DMC partner applications</p>
        </div>
        <button
          onClick={fetchAgents}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-xl transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Success toast */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2.5 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm font-medium"
          >
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter tabs + search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                filter === f.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
              {counts[f.key] > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  filter === f.key ? 'bg-violet-100 text-violet-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {counts[f.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by company, name or email…"
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No DMCs found</p>
          <p className="text-sm mt-1">
            {filter === 'pending' ? 'No pending applications right now.' : 'Nothing matches your filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(agent => {
            const st = STATUS_CONFIG[agent.status] || STATUS_CONFIG.pending
            const isExpanded = expandedId === agent.id
            return (
              <motion.div
                key={agent.id}
                layout
                className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
              >
                {/* Card header */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: company info */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center font-bold text-violet-600 text-sm flex-shrink-0">
                        {agent.companyName?.charAt(0)?.toUpperCase() || 'A'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-gray-900 text-sm">{agent.companyName}</h3>
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${st.bg} ${st.color}`}>
                            {st.icon} {st.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">{agent.contactName}</p>
                        <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-400">
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{agent.email}</span>
                          {agent.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{agent.phone}</span>}
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Applied {formatDate(agent.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: quick action buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {agent.status === 'pending' && (
                        <>
                          <button
                            onClick={() => {
                              setConfirmModal({ action: 'approve', agentId: agent.id, agentName: agent.companyName })
                              setCommissionOverride(String(agent.commissionRate || 10))
                            }}
                            className="flex items-center gap-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-xl transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />Approve
                          </button>
                          <button
                            onClick={() => setConfirmModal({ action: 'reject', agentId: agent.id, agentName: agent.companyName })}
                            className="flex items-center gap-1.5 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-xl transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />Reject
                          </button>
                        </>
                      )}
                      {agent.status === 'active' && (
                        <button
                          onClick={() => setConfirmModal({ action: 'suspend', agentId: agent.id, agentName: agent.companyName })}
                          className="flex items-center gap-1.5 text-xs font-semibold bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-xl transition-colors"
                        >
                          <Ban className="w-3.5 h-3.5" />Suspend
                        </button>
                      )}
                      {(agent.status === 'suspended' || agent.status === 'rejected') && (
                        <button
                          onClick={() => setConfirmModal({ action: 'reactivate', agentId: agent.id, agentName: agent.companyName })}
                          className="flex items-center gap-1.5 text-xs font-semibold bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 px-3 py-1.5 rounded-xl transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />Reactivate
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : agent.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-50">
                    <div className="text-xs">
                      <p className="text-gray-400">Agency type</p>
                      <p className="font-semibold text-gray-700 capitalize mt-0.5">{agent.agencyType?.replace('_', ' ') || '—'}</p>
                    </div>
                    <div className="text-xs">
                      <p className="text-gray-400">GST Number</p>
                      <p className="font-semibold text-gray-700 mt-0.5">{agent.gstNumber || '—'}</p>
                    </div>
                    <div className="text-xs">
                      <p className="text-gray-400">Commission</p>
                      <p className="font-semibold text-gray-700 mt-0.5">{agent.commissionRate ?? 10}%</p>
                    </div>
                    <div className="text-xs">
                      <p className="text-gray-400">Plan</p>
                      <p className="font-semibold text-gray-700 capitalize mt-0.5">{agent.subscriptionPlan || 'basic'}</p>
                    </div>
                    {agent.status === 'active' && (
                      <>
                        <div className="text-xs">
                          <p className="text-gray-400">Packages</p>
                          <p className="font-semibold text-gray-700 mt-0.5">{agent.totalPackages || 0}</p>
                        </div>
                        <div className="text-xs">
                          <p className="text-gray-400">Bookings</p>
                          <p className="font-semibold text-gray-700 mt-0.5">{agent.liveBookings || agent.totalBookings || 0}</p>
                        </div>
                        <div className="text-xs">
                          <p className="text-gray-400">Slug</p>
                          <a
                            href={`/tailored-travel/${agent.agentSlug}`}
                            target="_blank"
                            className="font-semibold text-violet-600 hover:underline mt-0.5 flex items-center gap-0.5"
                          >
                            /{agent.agentSlug} <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </>
                    )}
                    {agent.status === 'active' && agent.approvedAt && (
                      <div className="text-xs">
                        <p className="text-gray-400">Approved on</p>
                        <p className="font-semibold text-gray-700 mt-0.5">{formatDate(agent.approvedAt)}</p>
                      </div>
                    )}
                    {agent.status === 'rejected' && agent.rejectionReason && (
                      <div className="text-xs max-w-xs">
                        <p className="text-red-500 font-semibold">Rejection reason</p>
                        <p className="text-gray-600 mt-0.5">{agent.rejectionReason}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-gray-100 overflow-hidden"
                    >
                      <div className="p-5 bg-gray-50/50 space-y-4">
                        {/* Admin notes */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                            <MessageSquare className="w-3 h-3 inline mr-1" />Admin Notes (internal only)
                          </label>
                          <AdminNotesEditor
                            agentId={agent.id}
                            initialNotes={agent.adminNotes || ''}
                            onSave={quickUpdateNotes}
                          />
                        </div>

                        {/* Commission editor (active agents) */}
                        {agent.status === 'active' && (
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                              <Percent className="w-3 h-3 inline mr-1" />Commission Rate (%)
                            </label>
                            <CommissionEditor agentId={agent.id} current={agent.commissionRate} onUpdate={fetchAgents} />
                          </div>
                        )}

                        {/* Agent UID (for debugging) */}
                        <div className="text-xs text-gray-400">
                          <span className="font-medium text-gray-500">UID:</span> {agent.id}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Confirm modal */}
      <AnimatePresence>
        {confirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) setConfirmModal(null) }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
            >
              {/* Modal header */}
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  confirmModal.action === 'approve' ? 'bg-green-100' :
                  confirmModal.action === 'reject' ? 'bg-red-100' :
                  confirmModal.action === 'suspend' ? 'bg-orange-100' : 'bg-violet-100'
                }`}>
                  {confirmModal.action === 'approve' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                  {confirmModal.action === 'reject' && <XCircle className="w-5 h-5 text-red-600" />}
                  {confirmModal.action === 'suspend' && <Ban className="w-5 h-5 text-orange-600" />}
                  {confirmModal.action === 'reactivate' && <RotateCcw className="w-5 h-5 text-violet-600" />}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 capitalize">
                    {confirmModal.action === 'reactivate' ? 'Reactivate' : confirmModal.action} DMC
                  </h3>
                  <p className="text-sm text-gray-500">{confirmModal.agentName}</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Commission rate — only for approve */}
                {confirmModal.action === 'approve' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Commission Rate (%)
                    </label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={commissionOverride}
                        onChange={e => setCommissionOverride(e.target.value)}
                        placeholder="10"
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                      />
                    </div>
                  </div>
                )}

                {/* Rejection reason */}
                {confirmModal.action === 'reject' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Rejection Reason <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      rows={3}
                      placeholder="Reason for rejecting this DMC application…"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 resize-none"
                    />
                  </div>
                )}

                {/* Admin notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Internal Notes <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={actionNotes}
                    onChange={e => setActionNotes(e.target.value)}
                    rows={2}
                    placeholder="Add internal notes for your reference…"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 resize-none"
                  />
                </div>

                {actionError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 text-sm px-3 py-2.5 rounded-xl">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {actionError}
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setConfirmModal(null); setActionError(''); setRejectionReason(''); setActionNotes(''); setCommissionOverride('') }}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAction}
                  disabled={actionLoading || (confirmModal.action === 'reject' && !rejectionReason.trim())}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
                    confirmModal.action === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                    confirmModal.action === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                    confirmModal.action === 'suspend' ? 'bg-orange-500 hover:bg-orange-600' :
                    'bg-violet-600 hover:bg-violet-700'
                  }`}
                >
                  {actionLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Processing…</>
                  ) : (
                    <>
                      {confirmModal.action === 'approve' && <><CheckCircle2 className="w-4 h-4" />Approve DMC</>}
                      {confirmModal.action === 'reject' && <><XCircle className="w-4 h-4" />Reject DMC</>}
                      {confirmModal.action === 'suspend' && <><Ban className="w-4 h-4" />Suspend DMC</>}
                      {confirmModal.action === 'reactivate' && <><RotateCcw className="w-4 h-4" />Reactivate DMC</>}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Inline admin notes editor ───────────────────────────────────────────────
function AdminNotesEditor({
  agentId, initialNotes, onSave
}: {
  agentId: string
  initialNotes: string
  onSave: (id: string, notes: string) => Promise<void>
}) {
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    await onSave(agentId, notes)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-2">
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={2}
        placeholder="Internal notes (not visible to DMC)…"
        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 resize-none"
      />
      <button
        onClick={save}
        disabled={saving || notes === initialNotes}
        className="text-xs font-semibold text-violet-600 hover:text-violet-800 disabled:opacity-40 transition-colors flex items-center gap-1"
      >
        {saving ? <><Loader2 className="w-3 h-3 animate-spin" />Saving…</> : saved ? <><Check className="w-3 h-3" />Saved!</> : 'Save notes'}
      </button>
    </div>
  )
}

// ─── Inline commission editor ────────────────────────────────────────────────
function CommissionEditor({
  agentId, current, onUpdate
}: {
  agentId: string
  current: number
  onUpdate: () => void
}) {
  const [rate, setRate] = useState(String(current ?? 10))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    await fetch(`/api/admin/agents/${agentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commissionRate: Number(rate) }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => { setSaved(false); onUpdate() }, 1500)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-28">
        <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="number"
          min={0}
          max={50}
          value={rate}
          onChange={e => setRate(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
        />
      </div>
      <button
        onClick={save}
        disabled={saving || rate === String(current)}
        className="text-xs font-semibold text-violet-600 hover:text-violet-800 disabled:opacity-40 transition-colors flex items-center gap-1"
      >
        {saving ? <><Loader2 className="w-3 h-3 animate-spin" />Saving…</> : saved ? <><Check className="w-3 h-3" />Saved!</> : 'Update'}
      </button>
    </div>
  )
}
