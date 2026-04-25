'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PS_LOGO } from '@/components/layout/Navbar'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL ?? 'http://localhost:8000'
type Mode = 'loading' | 'consent' | 'pin' | 'camera' | 'preview' | 'searching' | 'waitlist'

function savedSession(eventId: string) {
  try {
    const d = JSON.parse(localStorage.getItem(`ps_${eventId}`) ?? 'null')
    if (!d) return null
    if (Date.now() - d.ts > 30 * 86400000) { localStorage.removeItem(`ps_${eventId}`); return null }
    return d
  } catch { return null }
}

export default function EventPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [event, setEvent] = useState<any>(null)
  const [notFound, setNotFound] = useState(false)
  const [expired, setExpired] = useState(false)
  const [mode, setMode] = useState<Mode>('loading')
  const [selfie, setSelfie] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(false)
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistDone, setWaitlistDone] = useState(false)
  const [procStep, setProcStep] = useState(0)
  const [procSecs, setProcSecs] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error: e } = await supabase.from('events').select('*').eq('slug', id).single()
      if (e || !data) { setNotFound(true); return }
      if (!data.is_active) { setExpired(true); return }
      if (data.expires_at && new Date(data.expires_at) < new Date()) { setExpired(true); return }
      setEvent(data)
      const saved = savedSession(data.id)
      if (saved?.matches?.length > 0) {
        router.replace(`/results/${data.id}?matches=${saved.matches.join(',')}&token=${saved.token ?? ''}`)
        return
      }
      setMode('consent')
    }
    load()
  }, [id, supabase, router])

  async function startCamera() {
    setMode('camera'); setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } } })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
    } catch {
      setError('Kunde inte starta kameran. Kontrollera kamerabehörigheter.'); setMode('consent')
    }
  }

  function stopCamera() { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null }

  function capture() {
    const video = videoRef.current; const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) return
      setSelfie(new File([blob], 'selfie.jpg', { type: 'image/jpeg' }))
      setPreviewUrl(URL.createObjectURL(blob))
      stopCamera(); setMode('preview')
    }, 'image/jpeg', 0.92)
  }

  async function verifyPin() {
    const res = await fetch(`${API_URL}/event/${event.id}/verify-pin?pin=${pin}`)
    const d = await res.json()
    if (d.valid) { setPinError(false); startCamera() } else setPinError(true)
  }

  async function handleSearch() {
    if (!selfie || !event) return
    setMode('searching'); setError(null); setProcStep(0); setProcSecs(0)
    const steps = [600, 1800, 3500]
    steps.forEach((delay, i) => setTimeout(() => setProcStep(i + 1), delay))
    timerRef.current = setInterval(() => setProcSecs(s => s + 1), 1000)
    try {
      const fileName = `selfies/${event.id}/${Date.now()}.jpg`
      const { error: se } = await supabase.storage.from('selfies').upload(fileName, selfie, { upsert: true })
      if (se) throw new Error(se.message)
      const { data: { publicUrl } } = supabase.storage.from('selfies').getPublicUrl(fileName)
      const res = await fetch(`${API_URL}/find`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: event.id, selfie_url: publicUrl, pin_code: pin }),
      })
      const d = await res.json()
      clearInterval(timerRef.current!)
      if (!d.success) { setError(d.message || 'Sökning misslyckades'); setMode('preview'); return }
      if (!d.photos_ready) { setMode('waitlist'); return }
      if (!d.matches?.length) { setError('Inga foton hittades. Prova med bättre ljussättning.'); setMode('preview'); return }
      try { localStorage.setItem(`ps_${event.id}`, JSON.stringify({ matches: d.matches, token: d.session_token ?? '', ts: Date.now() })) } catch {}
      router.push(`/results/${event.id}?matches=${d.matches.join(',')}&token=${d.session_token ?? ''}`)
    } catch (err) {
      clearInterval(timerRef.current!)
      setError((err as Error).message || 'Sökning misslyckades.')
      setMode('preview')
    }
  }

  useEffect(() => () => { stopCamera(); clearInterval(timerRef.current!) }, [])

  if (notFound || expired) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center', maxWidth: 340 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="var(--danger)" strokeWidth="1.5"/><path d="M10 6v5M10 13.5v.5" stroke="var(--danger)" strokeWidth="1.7" strokeLinecap="round"/></svg>
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>
          {notFound ? 'Event hittades inte' : 'Event avslutat'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6 }}>
          {notFound ? 'Denna QR-kod är ogiltig.' : 'Fotografen har stängt eventet.'}
        </p>
      </div>
    </div>
  )

  if (mode === 'loading') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="ps-spin" style={{ width: 28, height: 28, borderWidth: 3 }} />
    </div>
  )

  const PROC_STEPS = [
    { label: 'Laddar upp selfie', sub: 'Krypterad anslutning' },
    { label: 'AI analyserar ansikte', sub: 'AWS Rekognition' },
    { label: 'Söker bland foton', sub: 'Parallell matchning' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text-1)', marginBottom: 24 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>{PS_LOGO}</div>
        <span style={{ fontWeight: 700, fontSize: 13 }}>PixSnap</span>
      </Link>

      <div style={{ width: '100%', maxWidth: 400, background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 24, boxShadow: '0 4px 32px rgba(0,0,0,0.08)', overflow: 'hidden' }}>

        {mode === 'consent' && (
          <>
            <div style={{ background: 'var(--grad)', padding: '26px 26px 22px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ width: 52, height: 52, borderRadius: 15, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'white', animation: 'float 5s ease-in-out infinite' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="14" rx="3.5" stroke="white" strokeWidth="1.5"/><circle cx="12" cy="13" r="3.5" stroke="white" strokeWidth="1.5"/><path d="M7 6V5a2 2 0 012-2h6a2 2 0 012 2v1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: 'white', marginBottom: 3 }}>{event?.name}</h1>
              {event?.date && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                {new Date(event.date).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>}
            </div>

            <div style={{ padding: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4, textAlign: 'center' }}>Hitta dina foton</h2>
              <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', marginBottom: 20, lineHeight: 1.6 }}>
                Ta en selfie och AI hittar alla foton på dig på sekunder.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {[
                  { t: 'Inget konto krävs', s: 'Bara en snabb selfie', c: 'var(--brand)' },
                  { t: 'Selfien raderas inom 24h', s: 'GDPR-kompatibelt, EU-lagring', c: 'var(--success)' },
                  { t: 'Ta selfie direkt — inte foto av skärm', s: 'Fungerar bättre med direkt kamera', c: 'var(--warning)' },
                ].map(item => (
                  <div key={item.t} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.c, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{item.t}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{item.s}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Link href="/privacy" style={{ display: 'block', textAlign: 'center', fontSize: 11, color: 'var(--text-3)', textDecoration: 'none', marginBottom: 16 }}>Integritetspolicy</Link>

              <button onClick={() => event?.pin_code ? setMode('pin') : startCamera()} className="ps-btn ps-btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 14 }}>
                Jag förstår — ta selfie
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M3 6.5h7M7.5 4l2.5 2.5-2.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </>
        )}

        {mode === 'pin' && (
          <div style={{ padding: 30, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: 'var(--brand)' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3.5" y="9" width="13" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M6.5 9V7a3.5 3.5 0 017 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="10" cy="13.5" r="1.5" fill="currentColor"/></svg>
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>PIN-skyddat event</h2>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 18 }}>Ange PIN-koden för att komma åt eventet</p>
            <input type="number" value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN" className="ps-input" style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, letterSpacing: '0.2em', marginBottom: 10 }} onKeyDown={e => e.key === 'Enter' && verifyPin()} />
            {pinError && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>Fel PIN-kod</p>}
            <button onClick={verifyPin} disabled={!pin} className="ps-btn ps-btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>Fortsätt</button>
          </div>
        )}

        {mode === 'camera' && (
          <div style={{ padding: 16 }}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: 14, overflow: 'hidden', background: '#000' }}>
              <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} playsInline muted />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 180, height: 220, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.6)', boxShadow: '0 0 0 9999px rgba(0,0,0,0.38)' }} />
                <div style={{ position: 'absolute', width: 180, height: 2, background: 'linear-gradient(90deg, transparent, var(--brand), transparent)', animation: 'scanLine 2s ease-in-out infinite' }} />
              </div>
              <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Centrera ansiktet i ringen</div>
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={() => { stopCamera(); setMode('consent') }} className="ps-btn ps-btn-secondary ps-btn-sm" style={{ padding: '11px 16px' }}>Avbryt</button>
              <button onClick={capture} className="ps-btn ps-btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '11px' }}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="2.5" width="13" height="10" rx="2.5" stroke="white" strokeWidth="1.3"/><circle cx="7.5" cy="7.5" r="2.5" stroke="white" strokeWidth="1.3"/></svg>
                Ta selfie
              </button>
            </div>
          </div>
        )}

        {mode === 'preview' && previewUrl && (
          <div style={{ padding: 26, textAlign: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 14 }}>
              <div style={{ width: 100, height: 100, borderRadius: '50%', overflow: 'hidden', border: '2.5px solid var(--brand-light)', margin: '0 auto' }}>
                <img src={previewUrl} alt="selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ position: 'absolute', bottom: 2, right: 2, width: 24, height: 24, borderRadius: '50%', background: 'var(--success)', border: '2.5px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginBottom: 3 }}>Selfie klar!</h2>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>Ser det bra ut?</p>
            <button onClick={() => { setSelfie(null); setPreviewUrl(null); startCamera() }} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text-3)', cursor: 'pointer', textDecoration: 'underline', marginBottom: 16, display: 'block', margin: '0 auto 16px' }}>Ta om</button>
            {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 10, padding: '9px 13px', fontSize: 13, color: 'var(--danger)', marginBottom: 14, textAlign: 'left' }}>{error}</div>}
            <button onClick={handleSearch} className="ps-btn ps-btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="white" strokeWidth="1.4"/><path d="M10 10l3 3" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
              Hitta mina foton
            </button>
          </div>
        )}

        {mode === 'searching' && (
          <div style={{ padding: '36px 26px', textAlign: 'center' }}>
            <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 24px' }}>
              <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: '1.5px solid var(--brand)', opacity: 0.2, animation: 'pulseRing 1.8s ease-out infinite' }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="12" cy="12" r="8" stroke="white" strokeWidth="1.8"/><path d="M18 18l6 6" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
              </div>
            </div>
            <div style={{ fontSize: 38, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.04em', lineHeight: 1 }}>
              {procSecs}<span style={{ fontSize: 16, color: 'var(--text-3)', fontWeight: 500 }}>s</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 24 }}>AI söker igenom foton…</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
              {PROC_STEPS.map((step, i) => {
                const s = procStep > i ? 'done' : procStep === i ? 'active' : 'pending'
                return (
                  <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: s === 'done' ? 'rgba(34,197,94,0.07)' : s === 'active' ? 'var(--brand-light)' : 'var(--surface-2)', opacity: s === 'pending' ? 0.45 : 1, transition: 'all .3s' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: s === 'done' ? 'rgba(34,197,94,0.15)' : 'transparent' }}>
                      {s === 'done' && <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l2.5 2.5 4.5-4.5" stroke="var(--success)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      {s === 'active' && <div className="ps-spin ps-spin-sm" />}
                      {s === 'pending' && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-3)' }} />}
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)' }}>{step.label}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-3)' }}>{step.sub}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {mode === 'waitlist' && (
          <div style={{ padding: 28, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: 'var(--brand)' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4"/><path d="M10 5.5v5.5M10 13.5v.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginBottom: 5 }}>Foton är inte klara än</h2>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.6 }}>Lämna din e-post — vi skickar länken när foton är klara.</p>
            {!waitlistDone ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input type="email" value={waitlistEmail} onChange={e => setWaitlistEmail(e.target.value)} placeholder="din@email.se" className="ps-input" />
                <button onClick={async () => {
                  if (!event || !waitlistEmail) return
                  await fetch(`${API_URL}/waitlist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_id: event.id, email: waitlistEmail }) })
                  setWaitlistDone(true)
                }} disabled={!waitlistEmail} className="ps-btn ps-btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
                  Meddela mig
                </button>
              </div>
            ) : (
              <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: 12, padding: 18 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>Registrerad! Vi hör av oss.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <p style={{ marginTop: 18, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
        Selfien raderas inom 24h ·{' '}
        <Link href="/privacy" style={{ color: 'var(--brand)', textDecoration: 'none' }}>Integritetspolicy</Link>
      </p>
    </div>
  )
}
