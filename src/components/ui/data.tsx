import * as React from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn, initials } from '@/lib/utils'

type BadgeTone = 'default' | 'brand' | 'accent' | 'success' | 'muted' | 'outline'

const badgeTones: Record<BadgeTone, string> = {
  default: 'bg-white/[0.07] text-mist-200 border-white/[0.08]',
  brand: 'bg-brand-500/[0.14] text-brand-200 border-brand-500/25',
  accent: 'bg-accent-500/[0.14] text-accent-300 border-accent-500/25',
  success: 'bg-emerald-500/[0.12] text-emerald-300 border-emerald-500/25',
  muted: 'bg-white/[0.04] text-mist-400 border-white/[0.06]',
  outline: 'bg-transparent text-mist-300 border-white/[0.14]',
}

export function Badge({
  children,
  tone = 'default',
  className,
  dot,
}: {
  children: React.ReactNode
  tone?: BadgeTone
  className?: string
  dot?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11.5px] font-medium leading-5',
        badgeTones[tone],
        className,
      )}
    >
      {dot ? <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} /> : null}
      <span className="truncate">{children}</span>
    </span>
  )
}

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string
  src?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const [first, last] = name.split(' ')
  const sizes = {
    xs: 'h-6 w-6 text-[9.5px]',
    sm: 'h-7 w-7 text-[10.5px]',
    md: 'h-9 w-9 text-[12px]',
    lg: 'h-11 w-11 text-[14px]',
    xl: 'h-16 w-16 text-xl',
  }
  const palette = [
    'from-brand-500/30 to-brand-700/40 text-brand-100',
    'from-violet-500/30 to-violet-700/40 text-violet-100',
    'from-emerald-500/30 to-emerald-700/40 text-emerald-100',
    'from-accent-500/30 to-accent-700/40 text-accent-100',
    'from-amber-500/30 to-amber-700/40 text-amber-100',
  ]
  const hash = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br font-semibold',
        palette[hash % palette.length],
        sizes[size],
        className,
      )}
    >
      {src ? <AvatarPrimitive.Image src={src} alt={name} className="h-full w-full object-cover" /> : null}
      <AvatarPrimitive.Fallback className="flex h-full w-full items-center justify-center">
        {initials(first, last)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}

export function Progress({
  value,
  tone = 'brand',
  className,
  size = 'md',
  label,
}: {
  value: number
  tone?: 'brand' | 'accent' | 'success' | 'muted'
  className?: string
  size?: 'sm' | 'md' | 'lg'
  label?: string
}) {
  const tones = {
    brand: 'bg-brand-500',
    accent: 'bg-accent-500',
    success: 'bg-emerald-400',
    muted: 'bg-mist-500',
  }
  const heights = { sm: 'h-1', md: 'h-1.5', lg: 'h-2.5' }
  return (
    <div
      className={cn('w-full overflow-hidden rounded-full bg-white/[0.07]', heights[size], className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Прогресс'}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-out', tones[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-white/[0.06]', className)} />
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.015] text-center',
        compact ? 'px-5 py-8' : 'px-6 py-14',
        className,
      )}
    >
      {icon ? (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-mist-300">
          {icon}
        </div>
      ) : null}
      <p className="text-[14px] font-semibold text-white">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-mist-400">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function Panel({
  children,
  className,
  as: Tag = 'section',
}: {
  children: React.ReactNode
  className?: string
  as?: 'section' | 'div' | 'article'
}) {
  return <Tag className={cn('panel', className)}>{children}</Tag>
}

export function PanelHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? <span className="mt-0.5 text-mist-400">{icon}</span> : null}
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-white">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-mist-400">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-white/[0.06]', className)} />
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <span className="kbd">{children}</span>
}
