import { useNavigate } from 'react-router-dom'
import { cn, timeAgo } from '@/lib/utils'
import { useAuth } from '@/features/auth/auth-context'
import type { AppNotification } from '@/types'
import { describeNotification } from './notification-utils'
import { useNotificationMutations } from './use-notifications'

export function NotificationItem({
  notification,
  onOpened,
  className,
}: {
  notification: AppNotification
  onOpened?: () => void
  className?: string
}) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { markRead } = useNotificationMutations()
  const role = profile?.role ?? 'student'
  const view = describeNotification(notification, role)
  const unread = !notification.readAt

  const open = () => {
    if (unread) markRead.mutate(notification.id)
    onOpened?.()
    navigate(view.href)
  }

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        'group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/[0.04]',
        unread && 'bg-brand-500/[0.045]',
        className,
      )}
    >
      <span
        className={cn(
          'mt-1 h-2 w-2 shrink-0 rounded-full',
          view.tone === 'accent'
            ? 'bg-accent-500'
            : view.tone === 'success'
              ? 'bg-emerald-400'
              : view.tone === 'brand'
                ? 'bg-brand-400'
                : 'bg-mist-500',
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span
            className={cn(
              'text-[12.5px] leading-snug',
              unread ? 'font-semibold text-white' : 'font-medium text-mist-200',
            )}
          >
            {view.title}
          </span>
          <span className="mt-0.5 shrink-0 text-[10.5px] text-mist-500">
            {timeAgo(notification.createdAt)}
          </span>
        </span>
        {view.description ? (
          <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-relaxed text-mist-400">
            {view.description}
          </span>
        ) : null}
      </span>
      {unread ? <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" /> : null}
    </button>
  )
}
