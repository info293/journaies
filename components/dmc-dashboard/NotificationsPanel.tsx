'use client'

import { useEffect, useRef } from 'react'
import {
  Bell, MessageSquare, BookOpen, X, CheckCheck, RefreshCw, Clock, FileText, IndianRupee
} from 'lucide-react'

interface Notification {
  id: string
  type: 'quotation_message' | 'quotation_status' | 'new_booking' | 'new_quotation' | 'price_update'
  subAgentName: string
  referenceTitle: string
  customerName: string
  preview: string
  isRead: boolean
  createdAt?: { seconds: number }
}

interface Props {
  notifications: Notification[]
  loading: boolean
  onClose: () => void
  onMarkAllRead: () => void
  onRefresh: () => void
  onGoToTab: (tab: string) => void
}

function timeAgo(ts?: { seconds: number }) {
  if (!ts?.seconds) return ''
  const diff = Math.floor((Date.now() / 1000) - ts.seconds)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string; tab: string }> = {
  new_quotation: {
    icon: FileText,
    color: 'bg-amber-100 text-amber-600',
    label: 'New Quotation',
    tab: 'quotations',
  },
  price_update: {
    icon: IndianRupee,
    color: 'bg-emerald-100 text-emerald-700',
    label: 'Price Proposed',
    tab: 'quotations',
  },
  quotation_message: {
    icon: MessageSquare,
    color: 'bg-blue-100 text-blue-600',
    label: 'Message',
    tab: 'quotations',
  },
  quotation_status: {
    icon: RefreshCw,
    color: 'bg-purple-100 text-purple-600',
    label: 'Status Update',
    tab: 'quotations',
  },
  new_booking: {
    icon: BookOpen,
    color: 'bg-emerald-100 text-emerald-600',
    label: 'New Booking',
    tab: 'bookings',
  },
}

export default function NotificationsPanel({ notifications, loading, onClose, onMarkAllRead, onRefresh, onGoToTab }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const unread = notifications.filter(n => !n.isRead)

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-700" />
          <span className="font-bold text-gray-900 text-sm">Notifications</span>
          {unread.length > 0 && (
            <span className="text-xs font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
              {unread.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unread.length > 0 && (
            <button
              onClick={onMarkAllRead}
              className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
            >
              <CheckCheck className="w-3.5 h-3.5" />Mark all read
            </button>
          )}
          <button onClick={onRefresh} className="text-gray-400 hover:text-gray-600 p-1">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-h-[480px] overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400 font-medium">No notifications yet</p>
            <p className="text-xs text-gray-300 mt-1">Activity from your travel agents will appear here.</p>
          </div>
        ) : (
          <div>
            {notifications.map(n => {
              const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.quotation_message
              const Icon = cfg.icon
              return (
                <button
                  key={n.id}
                  onClick={() => { onGoToTab(cfg.tab); onClose() }}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-3 ${!n.isRead ? 'bg-blue-50/40' : ''}`}
                >
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <span className="flex items-center gap-0.5 text-[10px] text-gray-400 flex-shrink-0">
                        <Clock className="w-2.5 h-2.5" />
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-gray-900 truncate">
                      {n.subAgentName} · {n.customerName}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{n.referenceTitle}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{n.preview}</p>
                  </div>

                  {/* Unread dot */}
                  {!n.isRead && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-2.5 border-t border-gray-100 text-center">
          <p className="text-[11px] text-gray-400">Showing last {notifications.length} notification{notifications.length !== 1 ? 's' : ''}</p>
        </div>
      )}
    </div>
  )
}
