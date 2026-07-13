'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const STATIC_PLANS = [
  { id: 'trial', name: 'Trial', price: '0 kr', period: 'gratis', featured: false,
    points: ['1 aktivt event', '50 foton/event', '25 scan credits/mån', 'Vattenstämpel obligatorisk', 'QR-affisch'] },
  { id: 'starter', name: 'Starter', price: '99 kr', period: '/mån', featured: true,
    points: ['3 aktiva events', '300 foton/event', '300 scan credits/mån', 'Egen logga & vattenstämpel', 'Paketpriser för gäster', 'Email-notiser', 'Basic proofing'] },
  { id: 'pro', name: 'Pro', price: '299 kr', period: '/mån', featured: false,
    points: ['10 aktiva events', '1000 foton/event', '2000 scan credits/mån', 'Ta bort PixSnap-branding', 'Avancerad analytics', 'Client proofing + export', 'Sponsor slideshow', 'CRM'] },
  { id: 'enterprise', name: 'Enterprise', price: 'Kontakt', period: '', featured: false,
    points: ['Anpassade gränser', 'Multi-organisation', 'Custom domän', 'GDPR / DPA-verktyg', 'SLA & support', 'Föräldrasamtycke'] },
]

export default function PricingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [coupon, setCoupon] = useState('')
  const [couponMsg, setCouponMsg] = useState('')
  const [msg, setMsg] = useState('')
  const [stripeOk, setStripeOk] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) { setUserId(user.id); setEmail(user.email ?? '') }
      try {
        const r = await fetch(`${API_URL}/api/billing/plans`)
        if (r.ok) { const d = await r.json(); setStripeOk(d.stripe_configured) }
      } catch { /* ignore */ }
    }
    load()
  }, [supabase])

  async function choosePlan(planId: string) {
    if (planId === 'trial') { router.push(userId ? '/dashboard' : '/auth/register'); return }
    if (planId === 'enterprise') { window.location.href = 'mailto:sales@pixsnap.se?subject=Enterprise'; return }
    if (!userId) { router.push('/auth/register'); return }
    setBusy(planId); setMsg('')
    try {
      const r = await fetch(`${API_URL}/api/billing/create-checkout-session`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, plan_id: planId, email, coupon }),
      })
      if (r.status === 503) { setMsg('Stripe är inte konfigurerat än.'); setBusy(null); return }
      const d = await r.json()
      if (d.checkout_url) window.location.href = d.checkout_url
      else { setMsg(d.detail || 'Kunde inte starta checkout'); setBusy(null) }
    } catch { setMsg('Något gick fel'); setBusy(null) }
  }

  async function checkCoupon() {
    if (!coupon) return
    setCouponMsg('')
    try {
      const r = await fetch(`${API_URL}/api/billing/validate-coupon`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: coupon }),
      })
      const d = await r.json()
      setCouponMsg(d.valid ? `Giltig kod: ${d.discount_percent ? d.discount_percent + '% rabatt' : (d.discount_amount / 100) + ' kr rabatt'}` : (d.message || 'Ogiltig kod'))
    } catch { setCouponMsg('Kunde inte validera') }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'Inter,sans-serif' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(28px,5vw,56px) clamp(16px,4vw,24px)' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Link href="/" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← PixSnap</Link>
          <h1 style={{ fontSize: 'clamp(28px,5vw,40px)', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em', marginTop: 12 }}>Enkel prissättning</h1>
          <p style={{ fontSize: 16, color: 'var(--text-3)', marginTop: 10, maxWidth: 500, margin: '10px auto 0' }}>Betala för det du behöver. Uppgradera när du växer. Event Packs för enskilda stora events.</p>
        </div>

        {!stripeOk && (
          <div style={{ maxWidth: 600, margin: '0 auto 28px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#B45309', textAlign: 'center' }}>
            Stripe är inte konfigurerat än — köp aktiveras när Stripe-nycklar lagts in.
          </div>
        )}

        {/* Plans */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16, marginBottom: 40 }}>
          {STATIC_PLANS.map(p => (
            <div key={p.id} style={{ background: 'var(--surface)', border: `1.5px solid ${p.featured ? 'var(--brand)' : '#EAEDF4'}`, borderRadius: 20, padding: 24, position: 'relative', display: 'flex', flexDirection: 'column' }}>
              {p.featured && <span style={{ position: 'absolute', top: -11, left: 24, fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 9999, background: 'var(--grad)', color: 'white' }}>POPULÄRAST</span>}
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>{p.name}</h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, margin: '8px 0 16px' }}>
                <span style={{ fontSize: 30, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>{p.price}</span>
                <span style={{ fontSize: 14, color: 'var(--text-3)' }}>{p.period}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
                {p.points.map(pt => (
                  <li key={pt} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><path d="M3 8l3 3 6-6.5" stroke="var(--success)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {pt}
                  </li>
                ))}
              </ul>
              <button onClick={() => choosePlan(p.id)} disabled={busy === p.id || (!stripeOk && p.id !== 'trial' && p.id !== 'enterprise')}
                style={{ marginTop: 20, width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'Inter,sans-serif',
                  background: p.featured ? 'var(--grad)' : (p.id === 'trial' ? 'var(--surface-2)' : 'rgba(91,99,241,0.08)'),
                  color: p.featured ? 'white' : (p.id === 'trial' ? 'var(--text-1)' : 'var(--brand)') }}>
                {busy === p.id ? '…' : p.id === 'trial' ? 'Kom igång gratis' : p.id === 'enterprise' ? 'Kontakta oss' : 'Välj ' + p.name}
              </button>
            </div>
          ))}
        </div>

        {/* Coupon */}
        <div style={{ maxWidth: 400, margin: '0 auto 40px', textAlign: 'center' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={coupon} onChange={e => setCoupon(e.target.value.toUpperCase())} placeholder="Rabattkod" style={{ flex: 1, padding: '11px 14px', borderRadius: 12, border: '1px solid #EAEDF4', fontSize: 14, fontFamily: 'Inter,sans-serif' }} />
            <button onClick={checkCoupon} style={{ padding: '11px 18px', borderRadius: 12, border: '1px solid #EAEDF4', background: 'var(--surface)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Kolla</button>
          </div>
          {couponMsg && <p style={{ fontSize: 13, color: couponMsg.includes('Giltig') ? '#16a34a' : 'var(--danger)', marginTop: 8 }}>{couponMsg}</p>}
        </div>

        {msg && <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--danger)', marginBottom: 20 }}>{msg}</p>}

        {/* Event packs */}
        <div style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 20, padding: 28, marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', marginBottom: 6 }}>Event Packs</h2>
          <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 20 }}>Engångsköp för ett stort event utan att byta plan.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {[['Small', '99 kr', '150 foton · 150 scan credits · 30 dagar'], ['Medium', '249 kr', '500 foton · 500 scan credits · 60 dagar'], ['Large', '449 kr', '1000 foton · 1500 scan credits · 90 dagar']].map(([n, pr, d]) => (
              <div key={n} style={{ padding: 16, borderRadius: 14, background: 'var(--surface-2)' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{n}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--brand)', margin: '4px 0' }}>{pr}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{d}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 16 }}>Köp Event Packs från din <Link href="/dashboard/billing" style={{ color: 'var(--brand)' }}>faktureringssida</Link>.</p>
        </div>

        {/* FAQ */}
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', marginBottom: 16, textAlign: 'center' }}>Vanliga frågor</h2>
          {[
            ['Vad är scan credits?', 'En scan credit dras när en gäst gör en riktig AI-matchning. Om samma gäst laddar om sidan dras ingen ny credit.'],
            ['Vad händer när jag når min gräns?', 'Du får en tydlig uppmaning att uppgradera eller köpa ett Event Pack. Inget slutar fungera utan förvarning.'],
            ['Kan jag byta plan när som helst?', 'Ja. Uppgradera direkt, eller hantera din prenumeration via Stripe Customer Portal.'],
            ['Vad menas med egress-uppskattning?', 'Det är den ungefärliga datamängd dina gäster laddar ner. PixSnap optimerar med små WebP-thumbnails för att hålla det lågt.'],
          ].map(([q, a]) => (
            <div key={q} style={{ padding: '16px 0', borderBottom: '1px solid #EAEDF4' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>{q}</p>
              <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6 }}>{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
