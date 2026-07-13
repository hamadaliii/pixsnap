'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export interface UpgradeContext {
  reason?: string          // human message about why they were blocked
  limitKey?: string        // e.g. 'active_events'
  plan?: string            // current plan id
  used?: number
  limit?: number
  recommended?: string     // recommended plan id
  eventId?: string         // if event-specific, offer an event pack
}

const PLAN_LABELS: Record<string, string> = { trial: 'Trial', starter: 'Starter', pro: 'Pro', event_pack: 'Event Pack' }
const PLAN_PRICE: Record<string, string> = { starter: '99 kr/mån', pro: '299 kr/mån' }

export default function UpgradeModal({ ctx, userId, email, onClose }: {
  ctx: UpgradeContext
  userId: string
  email?: string
  onClose: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function upgrade(planId: string) {
    setLoading(planId); setError('')
    try {
      const r = await fetch(`${API_URL}/api/billing/create-checkout-session`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, plan_id: planId, email: email ?? '' }),
      })
      if (r.status === 503) { setError('Stripe är inte konfigurerat än.'); setLoading(null); return }
      const d = await r.json()
      if (d.checkout_url) window.location.href = d.checkout_url
      else { setError(d.detail || 'Kunde inte starta checkout'); setLoading(null) }
    } catch { setError('Något gick fel'); setLoading(null) }
  }

  async function buyPack(packId: string) {
    setLoading(packId); setError('')
    try {
      const r = await fetch(`${API_URL}/api/billing/create-event-pack-checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, pack_id: packId, event_id: ctx.eventId ?? '', email: email ?? '' }),
      })
      if (r.status === 503) { setError('Stripe är inte konfigurerat än.'); setLoading(null); return }
      const d = await r.json()
      if (d.checkout_url) window.location.href = d.checkout_url
      else { setError(d.detail || 'Kunde inte starta checkout'); setLoading(null) }
    } catch { setError('Något gick fel'); setLoading(null) }
  }

  const recommended = ctx.recommended ?? 'starter'

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,18,30,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', borderRadius: 24, overflow: 'hidden', boxShadow: '0 24px 60px rgba(15,18,30,0.25)' }}>
        {/* Header */}
        <div style={{ background: 'var(--grad)', padding: '28px 28px 24px', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.18)', color: 'white', cursor: 'pointer', fontSize: 16 }}>×</button>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 2l2.5 6.5H20l-5.2 4 2 6.5L11 15l-5.8 4 2-6.5L2 8.5h6.5L11 2z" stroke="white" strokeWidth="1.4" strokeLinejoin="round"/></svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'white', marginBottom: 6 }}>Uppgradera för att fortsätta</h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
            {ctx.reason ?? 'Du har nått gränsen för din plan.'}
          </p>
        </div>

        {/* Usage bar */}
        {ctx.limit != null && (
          <div style={{ padding: '16px 28px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{PLAN_LABELS[ctx.plan ?? 'trial']} · {ctx.limitKey}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}>{ctx.used}/{ctx.limit}</span>
            </div>
            <div style={{ height: 6, borderRadius: 4, background: '#F2F4FA', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '100%', background: 'var(--danger)' }} />
            </div>
          </div>
        )}

        {/* Options */}
        <div style={{ padding: '20px 28px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {['starter', 'pro'].map(planId => {
            const isRec = planId === recommended
            return (
              <button key={planId} onClick={() => upgrade(planId)} disabled={!!loading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: 14, border: `1.5px solid ${isRec ? 'var(--brand)' : '#EAEDF4'}`, background: isRec ? 'rgba(91,99,241,0.05)' : 'var(--surface)', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{PLAN_LABELS[planId]}</span>
                    {isRec && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 9999, background: 'var(--brand)', color: 'white' }}>REKOMMENDERAD</span>}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{PLAN_PRICE[planId]}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>{loading === planId ? '…' : 'Välj →'}</span>
              </button>
            )
          })}

          {ctx.eventId && (
            <button onClick={() => buyPack('small')} disabled={!!loading}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: 14, border: '1.5px solid #EAEDF4', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
              <div style={{ textAlign: 'left' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>Event Pack</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-3)' }}>Engångsköp för detta event · 99 kr</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>{loading === 'small' ? '…' : 'Köp →'}</span>
            </button>
          )}

          {error && <p style={{ fontSize: 13, color: 'var(--danger)', textAlign: 'center', marginTop: 4 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button onClick={() => router.push('/pricing')} style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: '11px', borderRadius: 12, border: '1px solid #EAEDF4', background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Se alla planer</button>
            <button onClick={() => router.push('/dashboard/billing')} style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: '11px', borderRadius: 12, border: '1px solid #EAEDF4', background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Fakturering</button>
          </div>
        </div>
      </div>
    </div>
  )
}
