'use client'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  as?: 'button' | 'div'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, children, className, disabled, ...props }, ref) => {
    const sizeClass = { sm: 'ps-btn-sm', md: '', lg: 'ps-btn-lg' }[size]
    const variantClass = {
      primary: 'ps-btn-primary',
      secondary: 'ps-btn-secondary',
      ghost: 'ps-btn-ghost',
      danger: 'ps-btn-danger',
    }[variant]

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn('ps-btn', variantClass, sizeClass, className)}
        {...props}
      >
        {loading && <span className="ps-spin ps-spin-sm" style={{ borderTopColor: variant === 'primary' ? 'white' : undefined }} />}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
