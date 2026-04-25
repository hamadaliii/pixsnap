'use client'
import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  onClose: () => void
  duration?: number
}

export function Toast({ message, type = 'success', onClose, duration = 3000 }: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onClose, 300) }, duration)
    return () => clearTimeout(t)
  }, [duration, onClose])

  const colors = {
    success: { bg: '#0D0E14', icon: 'var(--success)' },
    error:   { bg: '#1A0A0A', icon: 'var(--danger)' },
    info:    { bg: '#0A0E1A', icon: 'var(--brand)' },
  }[type]

  return (
    <div
      className="ps-toast"
      style={{
        background: colors.bg,
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(8px)',
        transition: 'opacity .3s, transform .3s',
      }}
    >
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${colors.icon}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {type === 'success' && <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l2.5 2.5 4.5-4.5" stroke={colors.icon} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        {type === 'error'   && <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 2l7 7M9 2L2 9" stroke={colors.icon} strokeWidth="1.6" strokeLinecap="round"/></svg>}
        {type === 'info'    && <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4.5" stroke={colors.icon} strokeWidth="1.3"/><path d="M5.5 5v3M5.5 3.5v.5" stroke={colors.icon} strokeWidth="1.4" strokeLinecap="round"/></svg>}
      </div>
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0, fontSize: 16, lineHeight: 1 }}>×</button>
    </div>
  )
}

// Hook for easy toast usage
export function useToast() {
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null)

  function show(message: string, type: 'success' | 'error' | 'info' = 'success') {
    setToast({ message, type })
  }

  function ToastRenderer() {
    if (!toast) return null
    return <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
  }

  return { show, ToastRenderer }
}
