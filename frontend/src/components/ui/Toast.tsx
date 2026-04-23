'use client'
import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

let addToastFn: ((msg: string, type?: ToastType) => void) | null = null

export function toast(message: string, type: ToastType = 'success') {
  addToastFn?.(message, type)
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    addToastFn = (message, type = 'success') => {
      const id = Date.now()
      setToasts(prev => [...prev, { id, message, type }])
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
    }
    return () => { addToastFn = null }
  }, [])

  const icons = {
    success: (
      <svg className="w-4 h-4 text-[#30D158]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-4 h-4 text-[#FF3B30]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="w-4 h-4 text-[#0A84FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01" />
      </svg>
    ),
  }

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className="scale-in flex items-center gap-3 bg-[#1C1C1C] border border-[rgba(255,255,255,0.12)] rounded-xl px-4 py-3 shadow-2xl min-w-[240px] max-w-[320px] pointer-events-auto">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
            t.type === 'success' ? 'bg-[rgba(48,209,88,0.15)]' :
            t.type === 'error' ? 'bg-[rgba(255,59,48,0.15)]' : 'bg-[rgba(10,132,255,0.15)]'
          }`}>
            {icons[t.type]}
          </div>
          <p className="text-sm text-white font-medium">{t.message}</p>
        </div>
      ))}
    </div>
  )
}