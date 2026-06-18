'use client'

import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { AlertTriangle, RefreshCw, CheckCircle2, ChevronDown, ChevronUp, Loader2, ServerCrash, Inbox } from 'lucide-react'

interface ApiErrorLog {
  id: string
  route: string
  method: string
  message: string
  stack: string | null
  context: Record<string, unknown> | null
  resolvedAt: Timestamp | null
  timestamp: Timestamp
}

const METHOD_COLOR: Record<string, string> = {
  GET:    'bg-blue-100 text-blue-700',
  POST:   'bg-green-100 text-green-700',
  PUT:    'bg-amber-100 text-amber-700',
  PATCH:  'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
}

export default function ApiErrorLogs() {
  const [logs, setLogs] = useState<ApiErrorLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showResolved, setShowResolved] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const q = query(
        collection(db, 'api_error_logs'),
        orderBy('timestamp', 'desc'),
        limit(100)
      )
      const snap = await getDocs(q)
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ApiErrorLog)))
    } catch (e) {
      console.error('Failed to fetch API error logs', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  async function markResolved(id: string) {
    await updateDoc(doc(db, 'api_error_logs', id), { resolvedAt: new Date() })
    setLogs(prev => prev.map(l => l.id === id ? { ...l, resolvedAt: Timestamp.now() } : l))
  }

  const visible = logs.filter(l => showResolved ? true : !l.resolvedAt)
  const unresolvedCount = logs.filter(l => !l.resolvedAt).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ServerCrash className="w-5 h-5 text-red-500" />
            API Error Logs
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {unresolvedCount} unresolved error{unresolvedCount !== 1 ? 's' : ''} — last 100 entries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResolved(v => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              showResolved
                ? 'bg-gray-100 text-gray-700 border-gray-200'
                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {showResolved ? 'Hide resolved' : 'Show resolved'}
          </button>
          <button
            onClick={fetchLogs}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 font-medium transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Empty state */}
      {visible.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
          <Inbox className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-500 text-sm">
            {showResolved ? 'No error logs yet' : 'No unresolved errors'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Errors from your API routes will appear here automatically.</p>
        </div>
      )}

      {/* Log list */}
      <div className="space-y-2">
        {visible.map(log => {
          const isExpanded = expandedId === log.id
          const isResolved = !!log.resolvedAt
          const time = log.timestamp?.toDate?.()

          return (
            <div
              key={log.id}
              className={`bg-white border rounded-xl overflow-hidden transition-all ${
                isResolved ? 'border-gray-100 opacity-60' : 'border-red-100'
              }`}
            >
              {/* Row header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 select-none"
                onClick={() => setExpandedId(isExpanded ? null : log.id)}
              >
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${METHOD_COLOR[log.method] ?? 'bg-gray-100 text-gray-600'}`}>
                  {log.method}
                </span>

                <code className="text-xs font-mono text-gray-700 flex-1 truncate">{log.route}</code>

                <span className="text-xs text-gray-400 shrink-0 hidden sm:block">
                  {time ? time.toLocaleString() : '—'}
                </span>

                {isResolved ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                )}

                {isExpanded
                  ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                }
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50">
                  {/* Error message */}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Error Message</p>
                    <p className="text-sm text-red-700 font-medium">{log.message}</p>
                  </div>

                  {/* Stack trace */}
                  {log.stack && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Stack Trace</p>
                      <pre className="text-[11px] font-mono text-gray-600 bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                        {log.stack}
                      </pre>
                    </div>
                  )}

                  {/* Context */}
                  {log.context && Object.keys(log.context).length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Context</p>
                      <pre className="text-[11px] font-mono text-gray-600 bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto">
                        {JSON.stringify(log.context, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Time on mobile */}
                  <p className="text-xs text-gray-400 sm:hidden">
                    {time ? time.toLocaleString() : '—'}
                  </p>

                  {/* Mark resolved */}
                  {!isResolved && (
                    <button
                      onClick={() => markResolved(log.id)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 font-medium transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark as resolved
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
