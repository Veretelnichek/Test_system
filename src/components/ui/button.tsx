import * as React from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'outline' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-white shadow-[0_8px_20px_-10px_rgba(2,151,222,0.9)] hover:bg-brand-400 active:bg-brand-600',
  accent:
    'bg-accent-500 text-white shadow-[0_8px_20px_-10px_rgba(252,115,77,0.9)] hover:bg-accent-400 active:bg-accent-600',
  secondary:
    'border border-white/10 bg-white/[0.06] text-mist-100 hover:border-white/[0.16] hover:bg-white/[0.1]',
  ghost: 'text-mist-300 hover:bg-white/[0.06] hover:text-white',
  outline: 'border border-white/[0.14] bg-transparent text-mist-100 hover:bg-white/[0.05]',
  danger:
    'border border-accent-500/30 bg-accent-500/[0.12] text-accent-300 hover:bg-accent-500/20',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-[12.5px]',
  md: 'h-10 gap-2 rounded-xl px-4 text-[13.5px]',
  lg: 'h-11 gap-2 rounded-xl px-5 text-sm',
  icon: 'h-9 w-9 rounded-xl',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 disabled:pointer-events-none disabled:opacity-45',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
