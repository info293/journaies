'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  UserCog, Plus, X, Eye, EyeOff,
  Trash2, Phone, Mail, Calendar, Loader2, AlertCircle, CheckCircle,
  Copy, Check, Link as LinkIcon, Clock, UserCheck, UserX, Search, RefreshCw
} from 'lucide-react'
import ConfirmModal from './ConfirmModal'

interface TravelAgent {
  id: string
  name: string
  email: string
  phone?: string
  organization?: string
  status: string      // 'pending' | 'active' | 'suspended'
  isActive: boolean
  selfRegistered?: boolean
  totalBookings: number
  totalRevenue: number
  createdAt?: { seconds: number }
}

interface Props {
  agentId: string
  agentSlug: string
}

export default function TeamManager({ agentId, agentSlug }: Props) {
  const [agents, setAgents] = useState<TravelAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [teamSearch, setTeamSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const registrationUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join/${agentSlug}`
    : `https://www.travelzada.com/join/${agentSlug}`

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent/subagents?agentId=${agentId}`)
      const data = await res.json()
      if (data.success) setAgents(data.subAgents)
    } catch (err) {
      console.error('[TeamManager] fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [agentId])

  // Initial load + poll every 10 s so new self-registrations appear automatically
  useEffect(() => {
    fetchAgents()
    const interval = setInterval(fetchAgents, 10_000)
    return () => clearInterval(interval)
  }, [fetchAgents])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(''); setFormSuccess('')
    if (!form.name || !form.email || !form.password) { setFormError('Name, email and password are required.'); return }
    if (form.password.length < 8) { setFormError('Password must be at least 8 characters.'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/agent/subagents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, ...form }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create')
      setFormSuccess(`Travel agent "${form.name}" added successfully.`)
      setForm({ name: '', email: '', password: '', phone: '' })
      setTimeout(() => { setShowForm(false); setFormSuccess('') }, 2500)
    } catch (err: any) {
      setFormError(err.message)
    } finally { setCreating(false) }
  }

  async function approveAgent(id: string) {
    setActionLoading(id)
    await fetch(`/api/agent/subagents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true, status: 'active', approve: true }),
    })
    setActionLoading(null)
  }

  async function rejectAgent(id: string) {
    setActionLoading(id)
    await fetch(`/api/agent/subagents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false, status: 'suspended' }),
    })
    setActionLoading(null)
  }

  async function toggleActive(agent: TravelAgent) {
    setActionLoading(agent.id)
    const newActive = !agent.isActive
    await fetch(`/api/agent/subagents/${agent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: newActive, status: newActive ? 'active' : 'suspended' }),
    })
    setActionLoading(null)
  }

  async function handleDelete(id: string) {
    setActionLoading(id)
    await fetch(`/api/agent/subagents/${id}`, { method: 'DELETE' })
    setDeleteConfirm(null)
    setActionLoading(null)
  }

  function copyRegLink() {
    navigator.clipboard.writeText(registrationUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  function formatDate(ts?: { seconds: number }) {
    if (!ts) return '—'
    return new Date(ts.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const pendingCount = agents.filter(a => a.status === 'pending').length
  const filtered = agents.filter(a => {
    const matchStatus = filterStatus === 'all'
      || (filterStatus === 'active' && a.isActive)
      || (filterStatus === 'inactive' && !a.isActive)
    const q = teamSearch.toLowerCase()
    const matchSearch = !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || (a.phone || '').includes(q)
    return matchStatus && matchSearch
  })

  async function handleRefresh() {
    setRefreshing(true)
    await fetchAgents()
    setRefreshing(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div></div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh list"
            className="p-2 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-primary hover:border-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={copyRegLink}
            className="flex items-center gap-1.5 text-xs font-semibold border border-gray-200 bg-white text-gray-600 px-3 py-2 rounded-xl hover:border-primary hover:text-primary transition-colors"
          >
            {copiedLink ? <><Check className="w-3.5 h-3.5 text-green-600" />Copied!</> : <><Copy className="w-3.5 h-3.5" />Registration Link</>}
          </button>
          <button
            onClick={() => { setShowForm(true); setFormError(''); setFormSuccess('') }}
            className="flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />Add Agent
          </button>
        </div>
      </div>

      {/* Registration link info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-900 mb-1 flex items-center gap-1.5">
          <LinkIcon className="w-4 h-4" />Agent Self-Registration Link
        </p>
        <p className="text-xs text-blue-700 font-mono break-all">{registrationUrl}</p>
        <p className="text-xs text-blue-600 mt-1.5">
          Share this link with travel agents. They register themselves — you approve them here.
        </p>
      </div>

      {/* Pending approvals banner */}
      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">{pendingCount} pending approval{pendingCount !== 1 ? 's' : ''}</p>
            <p className="text-xs text-amber-700">New travel agents are waiting for your approval.</p>
          </div>
          <button onClick={() => setFilterStatus('inactive')} className="text-xs font-bold text-amber-800 hover:underline">
            Review →
          </button>
        </div>
      )}

      {/* Create form modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-gray-900">Add Travel Agent</h3>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full Name *</label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Priya Sharma"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="priya@agency.com"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password *</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={form.password}
                      onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min. 8 characters"
                      className="w-full px-3.5 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Share this password securely.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone (optional)</label>
                  <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                </div>
                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />{formError}
                  </div>
                )}
                {formSuccess && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />{formSuccess}
                  </div>
                )}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={creating}
                    className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
                    {creating ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : 'Create Account'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={teamSearch} onChange={e => setTeamSearch(e.target.value)}
            placeholder="Search by name, email…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {([
            { key: 'all', label: 'All', count: agents.length },
            { key: 'active', label: 'Active', count: agents.filter(a => a.isActive).length },
            { key: 'inactive', label: 'Inactive', count: agents.filter(a => !a.isActive).length },
          ] as const).map(({ key, label, count }) => (
            <button key={key} onClick={() => setFilterStatus(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                filterStatus === key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {label} ({count})
            </button>
          ))}
        </div>
        {(teamSearch || filterStatus !== 'all') && (
          <span className="text-xs text-gray-400">{filtered.length} of {agents.length} agents</span>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <UserCog className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-900 mb-1">No travel agents {filterStatus !== 'all' ? `(${filterStatus})` : 'yet'}</p>
          <p className="text-sm text-gray-500">Add agents directly or share the registration link.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Agent</th>
                <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Organization</th>
                <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Contact</th>
                <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Added</th>
                <th className="text-center px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(agent => (
                <tr key={agent.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{agent.name}</p>
                        {agent.selfRegistered && (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Self-registered</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    {agent.organization
                      ? <p className="text-sm text-gray-700 font-medium">{agent.organization}</p>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500"><Mail className="w-3 h-3" />{agent.email}</div>
                      {agent.phone && <div className="flex items-center gap-1.5 text-xs text-gray-400"><Phone className="w-3 h-3" />{agent.phone}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Calendar className="w-3 h-3" />{formatDate(agent.createdAt)}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      agent.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {agent.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Pending: approve/reject */}
                      {agent.status === 'pending' && (
                        <>
                          <button onClick={() => approveAgent(agent.id)} disabled={actionLoading === agent.id}
                            title="Approve"
                            className="flex items-center gap-1 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 px-2.5 py-1.5 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors">
                            {actionLoading === agent.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                            Approve
                          </button>
                          <button onClick={() => rejectAgent(agent.id)} disabled={actionLoading === agent.id}
                            title="Reject"
                            className="flex items-center gap-1 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 px-2.5 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors">
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      {/* Active/Inactive: toggle */}
                      {agent.status !== 'pending' && (
                        actionLoading === agent.id
                          ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          : <button onClick={() => toggleActive(agent)} disabled={actionLoading === agent.id}
                              title={agent.isActive ? 'Set Inactive' : 'Set Active'}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${agent.isActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${agent.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                      )}

                      {/* Delete */}
                      <button onClick={() => setDeleteConfirm(agent.id)}
                        className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteConfirm && (
        <ConfirmModal
          title="Delete travel agent?"
          message="This action cannot be undone. The agent will lose access to your planner."
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}
