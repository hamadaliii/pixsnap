'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
type Mode = 'loading' | 'consent' | 'pin' | 'choose' | 'camera' | 'preview' | 'waitlist'

function getSaved(eventId: string) {
  try {
    const raw = localStorage.getItem(`ps_${eventId}`)
    if (!raw) return null
    const d = JSON.parse(raw)
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
  const [preview, setPreview] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(false)
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistDone, setWaitlistDone] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('events').select('*').eq('slug', id).single()
      if (error || !data) { setNotFound(true); return }
      if (!data.is_active) { setExpired(true); return }
      if (data.expires_at && new Date(data.expires_at) < new Date()) { setExpired(true); return }
      setEvent(data)

      // Auto-redirect if session exists — no consent needed
      const saved = getSaved(data.id)
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
    } catch { setError('Kunde inte starta kameran.'); setMode('choose') }
  }
  function stopCamera() { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null }
  function capturePhoto() {
    const video = videoRef.current; const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) return
      setSelfie(new File([blob], 'selfie.jpg', { type: 'image/jpeg' }))
      setPreview(URL.createObjectURL(blob))
      setMode('preview'); stopCamera()
    }, 'image/jpeg', 0.9)
  }
  async function verifyPin() {
    const res = await fetch(`${API_URL}/event/${event.id}/verify-pin?pin=${pin}`)
    const d = await res.json()
    if (d.valid) { setMode('choose'); setPinError(false) } else setPinError(true)
  }
  async function handleSearch() {
    if (!selfie || !event) return
    setSearching(true); setError(null)
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
      if (!d.success) { setError(d.message || 'Sökning misslyckades'); setSearching(false); return }
      if (!d.photos_ready) { setMode('waitlist'); setSearching(false); return }
      if (!d.matches?.length) { setError('Inga foton hittades. Prova igen.'); setSearching(false); return }
      // Save session
      try { localStorage.setItem(`ps_${event.id}`, JSON.stringify({ matches: d.matches, token: d.session_token ?? '', ts: Date.now() })) } catch {}
      router.push(`/results/${event.id}?matches=${d.matches.join(',')}&token=${d.session_token ?? ''}`)
    } catch (e) { setError((e as Error).message); setSearching(false) }
  }
  useEffect(() => () => stopCamera(), [])

  if (notFound) return <Splash title="Event hittades inte" sub="Denna QR-kod är ogiltig." />
  if (expired) return <Splash title="Event avslutat" sub="Fotografen har stängt eventet." />
  if (mode === 'loading') return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="h-[52px] border-b border-neutral-100 flex items-center justify-center">
        <span className="text-sm font-bold text-neutral-900">PixSnap</span>
      </div>
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-10 max-w-sm mx-auto w-full">
        {mode !== 'camera' && (
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-neutral-900">{event?.name}</h1>
            {event?.date && <p className="text-sm text-neutral-500 mt-1">{new Date(event.date).toLocaleDateString('sv-SE', { year:'numeric', month:'long', day:'numeric' })}</p>}
          </div>
        )}

        {mode === 'consent' && (
          <div className="w-full space-y-4">
            <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 space-y-3">
              <p className="text-sm font-bold text-neutral-900">Innan du fortsätter</p>
              {[['✓','Din selfie används bara för att hitta dina foton','text-green-600'],['✓','Selfien raderas automatiskt inom 24 timmar','text-green-600'],['✓','Data lagras säkert inom EU','text-green-600'],['⚠','Ta en selfie av dig själv — ej foton av skärmar','text-amber-600']].map(([i,t,c])=>(
                <div key={t as string} className="flex gap-2.5"><span className={`text-xs font-bold flex-shrink-0 mt-0.5 ${c}`}>{i}</span><p className="text-xs text-neutral-600">{t as string}</p></div>
              ))}
              <Link href="/privacy" className="text-xs text-neutral-400 underline">Integritetspolicy</Link>
            </div>
            <button onClick={() => event?.pin_code ? setMode('pin') : setMode('choose')} className="w-full bg-neutral-900 text-white text-sm font-bold py-3.5 rounded-xl hover:bg-neutral-700 transition-colors">Jag förstår — fortsätt</button>
          </div>
        )}

        {mode === 'pin' && (
          <div className="w-full space-y-4">
            <p className="text-sm font-bold text-neutral-900 text-center">PIN-skyddat event</p>
            <input type="number" value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN-kod" className="input text-center text-xl font-mono tracking-widest" />
            {pinError && <p className="text-xs text-red-500 text-center">Fel PIN — försök igen</p>}
            <button onClick={verifyPin} disabled={!pin} className="w-full bg-neutral-900 text-white text-sm font-bold py-3.5 rounded-xl disabled:opacity-40">Fortsätt</button>
          </div>
        )}

        {mode === 'choose' && (
          <div className="w-full space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-700"><strong>Viktigt:</strong> Ta en selfie direkt med din kamera.</p>
            </div>
            <button onClick={startCamera} className="w-full bg-white border border-neutral-200 rounded-2xl p-5 flex items-center gap-4 hover:border-neutral-400 hover:shadow-md transition-all text-left group">
              <div className="w-11 h-11 bg-neutral-900 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div><p className="text-sm font-bold text-neutral-900">Ta selfie</p><p className="text-xs text-neutral-500 mt-0.5">Använd din kamera</p></div>
            </button>
            {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3"><p className="text-xs text-red-600">{error}</p></div>}
          </div>
        )}

        {mode === 'camera' && (
          <div className="w-full space-y-4">
            <div className="relative rounded-2xl overflow-hidden bg-black" style={{ aspectRatio:'3/4' }}>
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-44 h-56 rounded-full border-2 border-white/40" />
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex gap-2">
              <button onClick={() => { stopCamera(); setMode('choose') }} className="bg-neutral-100 text-neutral-900 text-sm font-semibold px-4 py-3 rounded-xl">Avbryt</button>
              <button onClick={capturePhoto} className="flex-1 bg-neutral-900 text-white text-sm font-bold py-3 rounded-xl">Ta foto</button>
            </div>
          </div>
        )}

        {mode === 'preview' && preview && (
          <div className="w-full space-y-5">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-neutral-200 shadow-lg">
                  <img src={preview} alt="selfie" className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                </div>
              </div>
            </div>
            <button onClick={() => { setSelfie(null); setPreview(null); setMode('choose') }} className="block mx-auto text-xs text-neutral-400 underline">Byt foto</button>
            {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3"><p className="text-xs text-red-600">{error}</p></div>}
            <button onClick={handleSearch} disabled={searching} className="w-full bg-neutral-900 text-white text-sm font-bold py-3.5 rounded-xl disabled:opacity-70 flex items-center justify-center gap-2">
              {searching && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {searching ? 'Söker…' : 'Hitta mina foton'}
            </button>
          </div>
        )}

        {mode === 'waitlist' && (
          <div className="w-full space-y-5 text-center">
            <div className="text-3xl">⏳</div>
            <p className="text-base font-bold text-neutral-900">Foton är inte klara än</p>
            <p className="text-sm text-neutral-500">Lämna din email så skickar vi länken direkt.</p>
            {!waitlistDone ? (
              <div className="space-y-3">
                <input type="email" value={waitlistEmail} onChange={e => setWaitlistEmail(e.target.value)} placeholder="din@email.se" className="input" />
                <button onClick={async () => {
                  if (!event || !waitlistEmail) return
                  await fetch(`${API_URL}/waitlist`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ event_id: event.id, email: waitlistEmail }) })
                  setWaitlistDone(true)
                }} className="w-full bg-neutral-900 text-white text-sm font-bold py-3.5 rounded-xl">Meddela mig</button>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                <p className="text-sm font-bold text-green-700">Registrerad! Vi hör av oss. 🎉</p>
              </div>
            )}
          </div>
        )}
        <p className="mt-8 text-xs text-neutral-400 text-center">Selfien raderas inom 24h · <Link href="/privacy" className="underline">Integritetspolicy</Link></p>
      </main>
    </div>
  )
}

function Splash({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="text-center">
        <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <h1 className="text-lg font-bold text-neutral-900 mb-1">{title}</h1>
        <p className="text-sm text-neutral-500">{sub}</p>
      </div>
    </div>
  )
}