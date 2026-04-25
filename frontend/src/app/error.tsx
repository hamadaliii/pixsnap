'use client'
import { useEffect } from 'react'
import { PS_LOGO } from '@/components/layout/Navbar'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 2L2 19h18L11 2z" stroke="var(--danger)" strokeWidth="1.6" strokeLinejoin="round"/>
            <path d="M11 9v4M11 15.5v.5" stroke="var(--danger)" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>Något gick fel</h1>
        <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 24 }}>{error.message || 'Ett oväntat fel uppstod'}</p>
        <button onClick={reset} className="ps-btn ps-btn-primary ps-btn-sm">Försök igen</button>
      </div>
    </div>
  )
}
