import { useState, useEffect, useRef } from 'react'
import { API_URL } from '../config/api'
import { authHeaders } from '../utils/api'


function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

const TYPE_DOT_COLOR = {
  new_message: 'bg-rose-500',
  escalation: 'bg-red-600',
  client_activity: 'bg-sage-400',
  sage_uncertain: 'bg-amber-400',
  checklist_item_added: 'bg-green-500',
  vendor_update: 'bg-blue-400',
  planning_reminder: 'bg-purple-400',
}

export default function NotificationBell({ recipientType, weddingId, extraItems = [] }) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const fetchNotifications = async () => {
    try {
      const url = recipientType === 'admin'
        ? `${API_URL}/api/notifications/admin`
        : `${API_URL}/api/notifications/client/${weddingId}`
      const res = await fetch(url, { headers: await authHeaders() })
      if (!res.ok) return
      const { notifications: data, unreadCount: count } = await res.json()
      setNotifications(data || [])
      setUnreadCount(count || 0)
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    }
  }

  useEffect(() => {
    if (recipientType === 'client' && !weddingId) return
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [recipientType, weddingId])

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const markAllRead = async () => {
    try {
      await fetch(`${API_URL}/api/notifications/read`, {
        method: 'PUT',
        headers: await authHeaders(),
        body: JSON.stringify(
          recipientType === 'admin'
            ? { recipientType: 'admin' }
            : { recipientType: 'client', weddingId }
        ),
      })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }

  const markOneRead = async (id) => {
    try {
      await fetch(`${API_URL}/api/notifications/read`, {
        method: 'PUT',
        headers: await authHeaders(),
        body: JSON.stringify({ notificationId: id }),
      })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Failed to mark read:', err)
    }
  }

  // Total badge count includes any extra items passed in (e.g. admin unread messages, sage questions)
  const totalBadge = unreadCount + extraItems.reduce((sum, item) => sum + (item.count || 0), 0)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-1.5 text-sage-500 hover:text-sage-700 transition"
        title="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {totalBadge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {totalBadge > 9 ? '9+' : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-cream-200 z-50 overflow-hidden">
          <div className="p-3 border-b border-cream-100 flex items-center justify-between">
            <span className="font-medium text-sage-700 text-sm">Notifications</span>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-sage-400 hover:text-sage-600 transition"
                >
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-sage-400 hover:text-sage-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-cream-100">
            {/* Extra items (e.g. admin: unread messages, sage questions) */}
            {extraItems.map((item, i) => item.count > 0 && (
              <button
                key={i}
                onClick={() => { item.onClick?.(); setOpen(false) }}
                className="w-full text-left px-4 py-3 hover:bg-cream-50 transition"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.dotColor || 'bg-sage-400'}`} />
                  <p className="text-sm font-medium text-sage-800">{item.label}</p>
                </div>
                {item.sublabel && (
                  <p className="text-xs text-sage-400 mt-0.5 ml-4">{item.sublabel}</p>
                )}
              </button>
            ))}

            {/* DB notifications */}
            {notifications.length === 0 && extraItems.every(i => !i.count) ? (
              <p className="text-sm text-sage-400 text-center py-6">All caught up!</p>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => markOneRead(n.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-cream-50 transition ${n.is_read ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${n.is_read ? 'bg-cream-300' : (TYPE_DOT_COLOR[n.type] || 'bg-sage-400')}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-sage-800 leading-tight">{n.title}</p>
                      {n.body && (
                        <p className="text-xs text-sage-500 mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-xs text-sage-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
