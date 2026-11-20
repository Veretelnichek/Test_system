import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'relative flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-brand-400 to-brand-600 text-[15px] font-bold text-white shadow-[0_6px_18px_-8px_rgba(2,151,222,0.9)]',
        className,
      )}
      aria-hidden
    >
      V
    </span>
  )
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      {compact ? null : (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-white">Vector</span>
          <span className="mt-0.5 text-[9.5px] font-medium uppercase tracking-[0.18em] text-mist-500">
            Learning OS
          </span>
        </span>
      )}
    </span>
  )
}
