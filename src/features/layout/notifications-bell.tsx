import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlay'
import { Button } from '@/components/ui/button'
import { EmptyState, Skeleton } from '@/components/ui/data'
import { NotificationItem } from '@/features/notifications/notification-item'
import {
  useNotificationMutations,
  useNotifications,
  useUnreadCount,
} from '@/features/notifications/use-notifications'

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const { data, isLoading } = useNotifications()
  const unread = useUnreadCount()
  const { markAllRead } = useNotificationMutations()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.09] bg-white/[0.03] px-3 text-[12px] font-medium text-mist-300 transition-colors hover:bg-white/[0.06] hover:text-white"
          aria-label={unread ? `Уведомления, ${unread} непрочитанных` : 'Уведомления'}
        >
          Уведомления
          {unread > 0 ? (
            <span className="flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-accent-500 px-1 text-[9.5px] font-bold leading-none text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] max-w-[380px] p-0">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-3.5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-white">Уведомления</span>
            {unread > 0 ? (
              <span className="rounded-md bg-accent-500/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-accent-300">
                {unread}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            disabled={unread === 0 || markAllRead.isPending}
            className="text-[11.5px] font-medium text-mist-400 transition-colors hover:text-mist-100 disabled:opacity-40"
          >
            Прочитать
          </button>
        </div>

        <div className="max-h-[360px] overflow-y-auto p-1.5">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2.5 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : data && data.length > 0 ? (
            data.slice(0, 6).map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onOpened={() => setOpen(false)}
              />
            ))
          ) : (
            <EmptyState
              compact
              title="Пока тихо"
              description="Здесь появятся события по заданиям и проверкам."
            />
          )}
        </div>

        <div className="border-t border-white/[0.07] p-2">
          <Link to="/app/notifications" onClick={() => setOpen(false)}>
            <Button variant="ghost" size="sm" className="w-full">
              Все уведомления
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
