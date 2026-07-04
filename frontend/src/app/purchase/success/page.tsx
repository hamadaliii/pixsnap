'use client'
import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PS_LOGO } from '@/components/layout/Navbar'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function SuccessContent() {
  const searchParams = useSearchParams()
  const purchaseId = searchParams.get('purchase_id') ?? ''
  const token = searchParams.get('token') ?? ''

  const [loading, setLoading] = useState(true)
  const [photoCount, setPhotoCount] = useState(0)
  const [photoIds, setPhotoIds] = useState<string[]>([])

  useEffect(() => {
    if (!purchaseId) { setLoading(false); return }
    fetch(`${API_URL}/purchase/${purchaseId}`)
      .then(r => r.json())
      .then(data => {
        const ids = data.photo_ids ?? []
        setPhotoIds(ids)
        setPhotoCount(ids.length)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [purchaseId])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="ps-spin" style={{ width: 28, height: 28, borderWidth: 3 }} />
    </div>
  )

  return (
    <div style={{ width: '100%', maxWidth: 460 }}>
      <div className="ps-card glass-strong" style={{ borderRadius: 24, overflow: 'hidden' }}>
        {/* Green header */}
        <div style={{ background: 'linear-gradient(135deg,#22C55E,#16a34a)', padding: '36px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 12l6 6 10-10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'white', marginBottom: 6 }}>Betalning genomförd!</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>Du har nu tillgång till dina foton i full kvalitet</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 28px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, background: 'var(--surface-2)', borderRadius: 14, padding: '12px 24px' }}>
            {photoCount > 0 && (
              <>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.04em', lineHeight: 1 }}>{photoCount}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>Foton köpta</div>
                </div>
                <div style={{ width: 1, height: 36, background: '#EAEDF4' }} />
              </>
            )}
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 11l5 5 9-9" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Betald</div>
            </div>
            <div style={{ width: 1, height: 36, background: '#EAEDF4' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', lineHeight: 1.3 }}>Full<br/>kvalitet</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a href={`${API_URL}/download/${purchaseId}`} download
            className="ps-btn ps-btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 14, textDecoration: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v7M4 6.5l3 3 3-3M1 11h12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Ladda ner alla foton (zip)
          </a>
          {token && (
            <Link href={`/session/${token}`}
              className="ps-btn ps-btn-secondary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14, textDecoration: 'none' }}>
              Tillbaka till galleriet
            </Link>
          )}
        </div>

        <div style={{ padding: '0 28px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Länken gäller i 30 dagar · Full upplösning utan vattenstämpel</p>
        </div>
      </div>

      {/* Trust badges */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 20, flexWrap: 'wrap' }}>
        {[
          { icon: <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 6.5l3 3 6.5-6.5" stroke="var(--success)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>, label: 'Full kvalitet' },
          { icon: <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1.5" y="5" width="10" height="7" rx="2" stroke="var(--brand)" strokeWidth="1.3"/><path d="M4 5V3.5a2.5 2.5 0 015 0V5" stroke="var(--brand)" strokeWidth="1.3" strokeLinecap="round"/></svg>, label: 'Säker betalning' },
          { icon: <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="#8B5CF6" strokeWidth="1.3"/><path d="M6.5 4v3.5l2 1.5" stroke="#8B5CF6" strokeWidth="1.3" strokeLinecap="round"/></svg>, label: '30 dagars åtkomst' },
        ].map(b => (
          <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>
            {b.icon}{b.label}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PurchaseSuccessPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
      {/* Logo */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text-1)', marginBottom: 28 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>{PS_LOGO}</div>
        <span style={{ fontWeight: 700, fontSize: 14 }}>PixSnap</span>
      </Link>

      <Suspense fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="ps-spin" style={{ width: 28, height: 28, borderWidth: 3 }} />
        </div>
      }>
        <SuccessContent />
      </Suspense>
    </div>
  )
}