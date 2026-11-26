import { useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import type { PlatformNotification } from '../types/finance';
import { formatDateTime } from '../utils/formatters';

interface NotificationsBellProps {
  notifications: PlatformNotification[];
  onMarkRead: (id: string) => void;
}

export function NotificationsBell({ notifications, onMarkRead }: NotificationsBellProps) {
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
        className="relative w-10 h-10 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-mono font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#071B38]">Notifications</p>
              <p className="text-[11px] text-slate-500">
                {unreadCount} unread · {notifications.length} total
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close notifications"
              className="w-7 h-7 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500">No notifications yet.</p>
            ) : (
              notifications.slice(0, 25).map((item) => (
                <div
                  key={item.id}
                  className={`px-4 py-3 text-xs space-y-1 ${
                    item.read ? 'bg-white' : 'bg-blue-50/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-900">{item.title}</span>
                    {!item.read && (
                      <button
                        type="button"
                        onClick={() => onMarkRead(item.id)}
                        className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-800 hover:underline"
                      >
                        <Check className="w-3 h-3" />
                        <span>Mark read</span>
                      </button>
                    )}
                  </div>
                  <p className="text-slate-600 leading-relaxed">{item.message}</p>
                  <p className="text-[10px] font-mono text-slate-400">
                    {item.category} · {formatDateTime(item.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
