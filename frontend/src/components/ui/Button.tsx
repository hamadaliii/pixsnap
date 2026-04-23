'use client'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', loading, children, className, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 select-none disabled:opacity-40 disabled:cursor-not-allowed rounded-[10px] relative overflow-hidden'

    const variants = {
      primary: 'bg-white text-[#0B0B0B] hover:bg-white/90 active:scale-[0.98]',
      accent: 'bg-[#FF2D55] text-white hover:bg-[#FF1A45] active:scale-[0.98] shadow-[0_0_20px_rgba(255,45,85,0.3)]',
      secondary: 'bg-[#1C1C1C] text-white border border-[rgba(255,255,255,0.1)] hover:bg-[#242424] hover:border-[rgba(255,255,255,0.18)] active:scale-[0.98]',
      ghost: 'text-[#888] hover:text-white hover:bg-[rgba(255,255,255,0.06)] active:scale-[0.98]',
      danger: 'bg-[rgba(255,59,48,0.12)] text-[#FF3B30] border border-[rgba(255,59,48,0.2)] hover:bg-[rgba(255,59,48,0.2)] active:scale-[0.98]',
    }

    const sizes = {
      sm: 'text-xs px-3 py-1.5 h-8',
      md: 'text-sm px-4 py-2 h-9',
      lg: 'text-sm px-6 py-3 h-11',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-70" />
            {children}
          </>
        ) : children}
      </button>
    )
  }
)
Button.displayName = 'Button'