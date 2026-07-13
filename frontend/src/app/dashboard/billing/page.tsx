'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const PLAN_LABELS: Record<string, string> = { trial: 'Trial', starter: 'Starter', pro: 'Pro', event_pack: 'Event Pack' }

function fmtBytes(b?: number): string {
  if (!b) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; const i = Math.floor(Math.log(b) / Math.log(1024))
  return `${(b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${u[i]}`
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit?: number }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0
  const color = pct >= 100 ? 'var(--danger)' : pct >= 70 ? 'var(--warning)' : 'var(--success)'
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid #F2F4FA' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: pct >= 70 ? color : 'var(--text-2)' }}>{used}{limit != null ? ` / ${limit}` : ''}</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: '#F2F4FA', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width .3s' }} />
      </div>
    </div>
  )
}

export default function BillingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [billing, setBilling] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id); setEmail(user.email ?? '')
      try {
        const r = await fetch(`${API_URL}/api/billing/current/${user.id}`)
        if (r.ok) setBilling(await r.json())
      } catch { /* backend cold start */ }
      const { data: pl } = await supabase.from('payment_logs').select('*').eq('photographer_id', user.id).order('created_at', { ascending: false }).limit(20)
      setPayments(pl ?? [])
      setLoading(false)
    }
    load()
  }, [router, supabase])

  async function upgrade(planId: string) {
    setBusy(planId); setMsg('')
    try {
      const r = await fetch(`${API_URL}/api/billing/create-checkout-session`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, plan_id: planId, email }),
      })
      if (r.status === 503) { setMsg('Stripe är inte konfigurerat än.'); setBusy(null); return }
      const d = await r.json()
      if (d.checkout_url) window.location.href = d.checkout_url
      else { setMsg(d.detail || 'Kunde inte starta checkout'); setBusy(null) }
    } catch { setMsg('Något gick fel'); setBusy(null) }
  }

  async function buyPack(packId: string) {
    setBusy(packId); setMsg('')
    try {
      const r = await fetch(`${API_URL}/api/billing/create-event-pack-checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, pack_id: packId, email }),
      })
      if (r.status === 503) { setMsg('Stripe är inte konfigurerat än.'); setBusy(null); return }
      const d = await r.json()
      if (d.checkout_url) window.location.href = d.checkout_url
      else { setMsg(d.detail || 'Kunde inte starta checkout'); setBusy(null) }
    } catch { setMsg('Något gick fel'); setBusy(null) }
  }

  async function openPortal() {
    setBusy('portal')
    try {
      const r = await fetch(`${API_URL}/api/billing/create-customer-portal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      const d = await r.json()
      if (d.portal_url) window.location.href = d.portal_url
      else { setMsg(d.detail || 'Ingen prenumeration att hantera'); setBusy(null) }
    } catch { setMsg('Något gick fel'); setBusy(null) }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="ps-spin" style={{ width: 28, height: 28, borderWidth: 3 }} />
    </div>
  )

  const plan = billing?.plan_id ?? 'trial'
  const usage = billing?.usage ?? {}
  const stripeOk = billing?.stripe_configured

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'Inter,sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(20px,4vw,36px) clamp(16px,4vw,24px)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Dashboard</Link>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', marginTop: 6 }}>Fakturering</h1>
          </div>
          <Link href="/pricing" style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)', textDecoration: 'none' }}>Se alla planer →</Link>
        </div>

        {!stripeOk && (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#B45309', marginBottom: 20 }}>
            Stripe är inte konfigurerat än — uppgraderingsknappar är inaktiva tills Stripe-nycklar läggs in i backend.
          </div>
        )}

        {/* Current plan */}
        <div style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 18, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Din plan</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <span style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-1)' }}>{PLAN_LABELS[plan]}</span>
                {billing?.status === 'past_due' && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 9999, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>Betalning misslyckad</span>}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Scan credits kvar: <strong style={{ color: 'var(--text-1)' }}>{billing?.scan_credits ?? 0}</strong></p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {plan === 'trial' && <button onClick={() => upgrade('starter')} disabled={!!busy || !stripeOk} className="ps-btn ps-btn-primary ps-btn-sm">{busy === 'starter' ? '…' : 'Uppgradera till Starter'}</button>}
              {plan !== 'pro' && <button onClick={() => upgrade('pro')} disabled={!!busy || !stripeOk} style={{ fontSize: 13, fontWeight: 600, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--brand)', color: 'var(--brand)', background: 'rgba(91,99,241,0.05)', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>{busy === 'pro' ? '…' : 'Uppgradera till Pro'}</button>}
              {billing?.status === 'active' && plan !== 'trial' && <button onClick={openPortal} disabled={!!busy} style={{ fontSize: 13, fontWeight: 600, padding: '9px 14px', borderRadius: 10, border: '1px solid #EAEDF4', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Hantera</button>}
            </div>
          </div>
          {msg && <p style={{ fontSize: 13, color: 'var(--danger)', marginTop: 12 }}>{msg}</p>}
        </div>

        {/* Usage */}
        <div style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 18, padding: '20px 24px', marginBottom: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>Användning denna månad</p>
          <UsageBar label="Aktiva events" used={usage.active_events?.used ?? 0} limit={usage.active_events?.limit} />
          <UsageBar label="Sökningar" used={usage.scans?.used ?? 0} limit={usage.scans?.limit} />
          <UsageBar label="AI-matchningar" used={usage.ai_matches?.used ?? 0} limit={usage.ai_matches?.limit} />
          <UsageBar label="Email" used={usage.emails?.used ?? 0} limit={usage.emails?.limit} />
          <UsageBar label="Nedladdningar" used={usage.downloads?.used ?? 0} limit={usage.downloads?.limit} />
          <div style={{ paddingTop: 12, fontSize: 12, color: 'var(--text-3)' }}>Storage-gräns: {fmtBytes(billing?.storage_limit_bytes)}</div>
        </div>

        {/* Active packs */}
        {(billing?.active_packs ?? []).length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 18, padding: '20px 24px', marginBottom: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 10 }}>Aktiva Event Packs</p>
            {billing.active_packs.map((p: any) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13 }}>
                <span style={{ color: 'var(--text-1)' }}>{p.event_packs?.name ?? p.event_pack_id}</span>
                <span style={{ color: 'var(--text-3)' }}>gäller till {new Date(p.expires_at).toLocaleDateString('sv-SE')}</span>
              </div>
            ))}
          </div>
        )}

        {/* Buy event pack */}
        <div style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 18, padding: '20px 24px', marginBottom: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>Behöver mer för ett enskilt event?</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            {[['small', 'Small', '99 kr', '150 foton'], ['medium', 'Medium', '249 kr', '500 foton'], ['large', 'Large', '449 kr', '1000 foton']].map(([id, name, price, desc]) => (
              <button key={id} onClick={() => buyPack(id)} disabled={!!busy || !stripeOk}
                style={{ padding: '14px', borderRadius: 12, border: '1px solid #EAEDF4', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'Inter,sans-serif', textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{name}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand)', margin: '2px 0' }}>{busy === id ? '…' : price}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Payment history */}
        <div style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 18, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #EAEDF4' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Betalningshistorik</p>
          </div>
          {payments.length === 0 && <p style={{ padding: '24px', textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>Inga betalningar än</p>}
          {payments.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid #F2F4FA' }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', textTransform: 'capitalize' }}>{p.type?.replace('_', ' ')}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-3)' }}>{new Date(p.created_at).toLocaleDateString('sv-SE')}</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: p.status === 'paid' ? '#16a34a' : 'var(--text-3)' }}>{p.amount ? (p.amount / 100).toFixed(0) + ' kr' : '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
