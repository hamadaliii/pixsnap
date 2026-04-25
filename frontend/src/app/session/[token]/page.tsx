'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PS_LOGO } from '@/components/layout/Navbar'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export default function SessionPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'redirecting' | 'empty' | 'error'>('loading')
  const [eventName, setEventName] = useState('')
  const [photoCount, setPhotoCount] = useState(0)

  useEffect(() => {
    if (!token) { setStatus('error'); return }

    fetch(`${API_URL}/session/${token}`)
      .then(r => r.json())
      .then(data => {
        if (!data?.session) { setStatus('error'); return }

        const session = data.session
        const photos: any[] = data.photos ?? []
        const eventId: string = session.event_id ?? ''
        const photoIds: string[] = session.photo_ids ?? []

        // Save to localStorage so future visits skip re-scan
        if (eventId && photoIds.length > 0) {
          try {
            localStorage.setItem(`ps_${eventId}`, JSON.stringify({
              matches: photoIds,
              token,
              ts: Date.now(),
            }))
          } catch {}
        }

        setEventName(data.event?.name ?? '')
        setPhotoCount(photoIds.length)

        if (photoIds.length === 0) {
          setStatus('empty'); return
        }

        setStatus('redirecting')
        // Redirect directly to results — no re-scan required
        router.replace(`/results/${eventId}?matches=${photoIds.join(',')}&token=${token}`)
      })
      .catch(() => setStatus('error'))
  }, [token, router])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text-1)', marginBottom: 32 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>{PS_LOGO}</div>
        <span style={{ fontWeight: 700, fontSize: 14 }}>PixSnap</span>
      </Link>

      <div style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 20, padding: '40px 32px', textAlign: 'center', maxWidth: 360, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>

        {(status === 'loading' || status === 'redirecting') && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div className="ps-spin" style={{ width: 32, height: 32, borderWidth: 3 }} />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', marginBottom: 6 }}>
              {status === 'redirecting' ? 'Öppnar ditt galleri…' : 'Laddar…'}
            </h2>
            {status === 'redirecting' && photoCount > 0 && (
              <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 8 }}>
                {photoCount} foto{photoCount !== 1 ? 'n' : ''} hittade
                {eventName ? ` från ${eventName}` : ''}
              </p>
            )}
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Du skickas dit automatiskt</p>
          </>
        )}

        {status === 'empty' && (
          <>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--brand)' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.5"/><circle cx="11" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/></svg>
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>Inga foton än</h2>
            <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 20 }}>
              Fotografen har inte publicerat foton ännu. Prova att öppna länken igen lite senare.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="var(--danger)" strokeWidth="1.5"/><path d="M10 6v5M10 13.5v.5" stroke="var(--danger)" strokeWidth="1.7" strokeLinecap="round"/></svg>
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>Länken fungerar inte</h2>
            <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 20 }}>
              Länken kan ha gått ut eller vara ogiltig. Prova att skanna QR-koden vid eventet igen.
            </p>
            <Link href="/" className="ps-btn ps-btn-primary ps-btn-sm" style={{ textDecoration: 'none' }}>
              Gå till startsidan
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
