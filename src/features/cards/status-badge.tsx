import { Badge } from '@/components/ui/data'
import { STATUS_MAP } from '@/lib/constants'
import { cn, formatDate } from '@/lib/utils'
import type { CardStatus } from '@/types'

const toneMap: Record<CardStatus, 'muted' | 'brand' | 'accent' | 'success' | 'default'> = {
  backlog: 'muted',
  in_progress: 'brand',
  review: 'brand',
  revision: 'accent',
  done: 'success',
}

export function StatusBadge({ status, className }: { status: CardStatus; className?: string }) {
  const meta = STATUS_MAP[status]
  return (
    <Badge tone={toneMap[status]} dot={meta.dot} className={className}>
      {meta.title}
    </Badge>
  )
}

export function DeadlineLabel({
  date,
  done,
  className,
}: {
  date?: string | null
  done?: boolean
  className?: string
}) {
  if (!date) {
    return <span className={cn('text-[11px] text-mist-500', className)}>Без дедлайна</span>
  }
  const overdue = !done && new Date(date).getTime() < Date.now()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-medium',
        overdue ? 'text-accent-300' : 'text-mist-400',
        className,
      )}
    >
      <span className="text-[10px] uppercase tracking-[0.1em] text-mist-500">Дедлайн</span>
      {formatDate(date)}
      {overdue ? <span className="text-[10px] font-semibold uppercase">просрочено</span> : null}
    </span>
  )
}

export function CommentsCount({ count }: { count: number }) {
  if (!count) return null
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-mist-400">
      <span className="text-[10px] uppercase tracking-[0.08em] text-mist-500">комм.</span>
      {count}
    </span>
  )
}
