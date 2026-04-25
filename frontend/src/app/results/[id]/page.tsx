'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PS_LOGO } from '@/components/layout/Navbar'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL ?? 'http://localhost:8000'

interface Photo { id: string; public_url: string; watermark_url: string | null }
interface Ev { slug: string; name: string; price_per_photo_ore: number; package_enabled: boolean; package_price_ore: number; payment_enabled: boolean; watermark_enabled: boolean; browse_all_enabled: boolean }

function getFavs(eid: string): string[] { try { return JSON.parse(localStorage.getItem(`ps_fav_${eid}`) ?? '[]') } catch { return [] } }
function saveFavs(eid: string, ids: string[]) { try { localStorage.setItem(`ps_fav_${eid}`, JSON.stringify(ids)) } catch {} }

function isMobile() { return typeof navigator !== 'undefined' && /iPhone|iPad|Android/i.test(navigator.userAgent) }

/** Best URL to display: watermark_url is always JPEG (never HEIC) */
function dispUrl(photo: Photo, payEnabled: boolean, wmEnabled: boolean) {
  if (!payEnabled || !wmEnabled) return photo.public_url
  return photo.watermark_url ?? photo.public_url
}

function launchConfetti() {
  const colors = ['#5B63F1','#8B5CF6','#EC4899','#22C55E','#F59E0B']
  for (let i = 0; i < 55; i++) {
    const p = document.createElement('div')
    const c = colors[Math.floor(Math.random() * colors.length)]
    const s = 5 + Math.random() * 9
    p.style.cssText = `position:fixed;top:-20px;left:${Math.random()*100}vw;width:${s}px;height:${s}px;border-radius:${Math.random()>.5?'50%':'2px'};background:${c};pointer-events:none;z-index:9999;animation:confettiFall ${2+Math.random()*2}s linear ${Math.random()*.6}s forwards`
    document.body.appendChild(p)
    setTimeout(() => p.remove(), 4000)
  }
}

export default function ResultsPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const token = searchParams.get('token') ?? ''

  const [photos, setPhotos] = useState<Photo[]>([])
  const [allPhotos, setAllPhotos] = useState<Photo[]>([])
  const [ev, setEv] = useState<Ev | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [favs, setFavs] = useState<Set<string>>(new Set())
  const [lightbox, setLightbox] = useState<{ photo: Photo; idx: number } | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [filterFavs, setFilterFavs] = useState(false)
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [pkgLoading, setPkgLoading] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [toast, setToast] = useState('')
  const [showThanks, setShowThanks] = useState(false)
  const [thanksName, setThanksName] = useState('')
  const [thanksMsg, setThanksMsg] = useState('')
  const [thanksLoading, setThanksLoading] = useState(false)
  const [photoCounter, setPhotoCounter] = useState(0)
  const [confettiDone, setConfettiDone] = useState(false)

  useEffect(() => { setMobile(isMobile()) }, [])

  useEffect(() => {
    async function load() {
      try {
        const matchIds = searchParams.get('matches')
        const { data: event } = await supabase.from('events')
          .select('slug,name,price_per_photo_ore,package_enabled,package_price_ore,payment_enabled,watermark_enabled,browse_all_enabled')
          .eq('id', eventId).single()
        if (event) setEv(event)
        if (matchIds) {
          const ids = matchIds.split(',').filter(Boolean)
          if (ids.length) {
            const { data } = await supabase.from('photos').select('id,public_url,watermark_url').in('id', ids)
            setPhotos(data ?? [])
          }
        }
        if (event?.browse_all_enabled) {
          const { data: all } = await supabase.from('photos').select('id,public_url,watermark_url').eq('event_id', eventId).limit(500)
          setAllPhotos(all ?? [])
        }
        setFavs(new Set(getFavs(eventId)))
      } catch {}
      setLoading(false)
    }
    load()
  }, [eventId, searchParams, supabase])

  useEffect(() => {
    if (photos.length > 0 && !confettiDone) {
      setConfettiDone(true)
      launchConfetti()
      let n = 0
      const t = setInterval(() => { n++; setPhotoCounter(n); if (n >= photos.length) clearInterval(t) }, 70)
    }
  }, [photos.length, confettiDone])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2800) }

  function toggleFav(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setFavs(prev => {
      const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id)
      saveFavs(eventId, Array.from(n)); return n
    })
  }

  function toggleSel(id: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function generateThanks() {
    if (!thanksName.trim()) return
    setThanksLoading(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 200,
          messages: [{ role: 'user', content: `Skriv ett kort, varmt tackkort på svenska från "${thanksName}" till fotografen för eventet "${ev?.name ?? 'eventet'}". 2-3 meningar. Bara texten.` }]
        })
      })
      const d = await res.json()
      setThanksMsg(d.content?.[0]?.text ?? '')
    } catch { setThanksMsg(`Tack för de fantastiska fotona från ${ev?.name}! Du fångade dagen perfekt.`) }
    setThanksLoading(false)
  }

  async function checkout(usePackage = false) {
    if (!usePackage && selected.size === 0) return
    usePackage ? setPkgLoading(true) : setCheckoutLoading(true)
    try {
      const res = await fetch(`${API_URL}/create-checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_ids: usePackage ? photos.map(p => p.id) : Array.from(selected), session_token: token, package: usePackage }),
      })
      const d = await res.json()
      if (d.checkout_url) window.location.href = d.checkout_url
    } catch {}
    finally { usePackage ? setPkgLoading(false) : setCheckoutLoading(false) }
  }

  const payEnabled = ev?.payment_enabled ?? true
  const wmEnabled = ev?.watermark_enabled ?? true
  const pricePerPhoto = ev ? ev.price_per_photo_ore / 100 : 10
  const pkgPrice = ev ? ev.package_price_ore / 100 : 49
  const pkgEnabled = ev?.package_enabled ?? false
  const browseAll = ev?.browse_all_enabled ?? false

  const displayPhotos = filterFavs
    ? (showAll ? allPhotos : photos).filter(p => favs.has(p.id))
    : (showAll ? allPhotos : photos)

  const freeLabel = !payEnabled ? { title: 'Ladda ner alla', sub: 'Full kvalitet · Gratis' }
    : wmEnabled ? { title: 'Ladda ner gratis', sub: 'Med vattenstämpel' }
    : { title: 'Ladda ner alla', sub: 'Gratis' }

  const freeHref = !payEnabled
    ? `${API_URL}/download-free-original?ids=${photos.map(p => p.id).join(',')}`
    : `${API_URL}/download-free?ids=${photos.map(p => p.id).join(',')}`

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="ps-spin" style={{ width: 28, height: 28, borderWidth: 3 }} />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* ── HEADER ── */}
      <div style={{ background: 'var(--grad)', padding: '40px 20px 80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none', marginBottom: 20, color: 'rgba(255,255,255,0.8)' }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>{PS_LOGO}</div>
          <span style={{ fontSize: 12, fontWeight: 600 }}>PixSnap</span>
        </Link>

        {photos.length > 0 ? (
          <>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', animation: 'bounceIn .6s ease .3s both' }}>
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M4 13l6 6 12-12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'white', marginBottom: 5, letterSpacing: '-0.02em' }}>Dina foton är redo!</h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 18 }}>
              Vi hittade foton av dig från {ev?.name}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
              {[
                { n: photoCounter, l: 'Foton hittade' },
                { n: '~30s', l: 'Leveranstid' },
                { n: '97%', l: 'Matchning' },
              ].map((s, i) => (
                <div key={s.l} style={{ textAlign: 'center', padding: '0 20px', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.2)' : 'none' }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: 'white', letterSpacing: '-0.03em', lineHeight: 1 }}>{s.n}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 3 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="white" strokeWidth="1.8"/><path d="M17 17l4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round"/><path d="M8 11h6M11 8v6" stroke="white" strokeWidth="1.6" strokeLinecap="round"/></svg>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'white', marginBottom: 6 }}>Inga foton hittades</h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>Prova med bättre ljussättning</p>
          </>
        )}
      </div>

      {/* ── CONTENT (overlaps header) ── */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px', transform: 'translateY(-60px)' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 24, boxShadow: '0 4px 32px rgba(0,0,0,0.1)', overflow: 'hidden' }}>

          {photos.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              {ev?.slug && (
                <Link href={`/event/${ev.slug}`} className="ps-btn ps-btn-primary ps-btn-sm" style={{ textDecoration: 'none' }}>
                  Försök igen
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid #EAEDF4', flexWrap: 'wrap' }}>
                {favs.size > 0 && (
                  <button onClick={() => setShowThanks(true)} className="ps-btn ps-btn-secondary ps-btn-sm" style={{ flex: 1, justifyContent: 'center', minWidth: 110 }}>
                    Tackkort
                  </button>
                )}
                {ev?.slug && (
                  <Link href={`/event/${ev.slug}`} className="ps-btn ps-btn-secondary ps-btn-sm" style={{ textDecoration: 'none', flex: 1, justifyContent: 'center', minWidth: 110 }}>
                    Ny sökning
                  </Link>
                )}
              </div>

              {/* Filter bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 16px', borderBottom: '1px solid #EAEDF4', flexWrap: 'wrap' }}>
                {browseAll && (
                  <>
                    <button onClick={() => setShowAll(false)} className={`ps-btn ps-btn-sm ${!showAll ? 'ps-btn-primary' : 'ps-btn-ghost'}`} style={{ fontSize: 12 }}>
                      Mina ({photos.length})
                    </button>
                    <button onClick={() => setShowAll(true)} className={`ps-btn ps-btn-sm ${showAll ? 'ps-btn-primary' : 'ps-btn-ghost'}`} style={{ fontSize: 12 }}>
                      Alla ({allPhotos.length})
                    </button>
                  </>
                )}
                {favs.size > 0 && (
                  <button onClick={() => setFilterFavs(!filterFavs)} className={`ps-btn ps-btn-sm ${filterFavs ? 'ps-btn-danger' : 'ps-btn-ghost'}`} style={{ fontSize: 12 }}>
                    Favoriter ({favs.size})
                  </button>
                )}
                {payEnabled && (
                  <button onClick={() => setSelected(new Set(photos.map(p => p.id)))} style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Välj alla
                  </button>
                )}
              </div>

              {/* Package banner */}
              {payEnabled && pkgEnabled && photos.length > 1 && (
                <div style={{ margin: '12px 14px', background: 'var(--text-1)', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Alla {photos.length} foton</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>
                      Spara {Math.max(0, Math.round(photos.length * pricePerPhoto - pkgPrice))} kr vs styckpris
                    </p>
                  </div>
                  <button onClick={() => checkout(true)} disabled={pkgLoading} className="ps-btn ps-btn-sm" style={{ background: 'white', color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {pkgLoading && <div className="ps-spin ps-spin-sm" />}
                    {pkgPrice} kr
                  </button>
                </div>
              )}

              {/* Buy bar */}
              {payEnabled && selected.size > 0 && (
                <div style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(248,249,252,0.95)', backdropFilter: 'blur(16px)', padding: '10px 16px', borderBottom: '1px solid #EAEDF4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <button onClick={() => setSelected(new Set())} style={{ fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Avmarkera ({selected.size})
                  </button>
                  <button onClick={() => checkout(false)} disabled={checkoutLoading} className="ps-btn ps-btn-primary ps-btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {checkoutLoading && <div className="ps-spin ps-spin-sm ps-spin-white" />}
                    Köp {selected.size} st · {(selected.size * pricePerPhoto).toFixed(0)} kr
                  </button>
                </div>
              )}

              {/* Photo grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                {displayPhotos.map((photo, idx) => {
                  const isSel = selected.has(photo.id)
                  const isFav = favs.has(photo.id)
                  return (
                    <div key={photo.id} style={{ aspectRatio: '1', overflow: 'hidden', cursor: 'pointer', position: 'relative', background: '#F2F4FA' }}
                      onClick={() => setLightbox({ photo, idx })}>
                      <img
                        src={dispUrl(photo, payEnabled, wmEnabled)}
                        alt={`Foto ${idx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .25s', display: 'block' }}
                        onError={e => { (e.currentTarget as HTMLImageElement).src = photo.public_url }}
                        onMouseEnter={e => (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.04)'}
                        onMouseLeave={e => (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)'}
                      />
                      {/* Fav button */}
                      <button onClick={e => toggleFav(photo.id, e)} style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isFav ? 'var(--danger)' : 'rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer', transition: 'all .18s' }}>
                        <svg viewBox="0 0 14 14" fill={isFav ? 'white' : 'none'} stroke="white" strokeWidth={1.8} style={{ width: 11, height: 11 }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 4.5a2.5 2.5 0 015 0M12 4.5a2.5 2.5 0 00-4.5-1.5L7 3.5l-.5-.5A2.5 2.5 0 002 5c0 1 .5 2 1.5 3L7 11.5l3.5-3.5c1-1 1.5-2 1.5-3z" />
                        </svg>
                      </button>
                      {/* Select button */}
                      {payEnabled && (
                        <button onClick={e => toggleSel(photo.id, e)} style={{ position: 'absolute', top: 6, left: 6, width: 22, height: 22, borderRadius: '50%', border: `2px solid ${isSel ? 'transparent' : 'rgba(255,255,255,0.7)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSel ? 'var(--brand)' : 'rgba(0,0,0,0.25)', cursor: 'pointer', transition: 'all .18s' }}>
                          {isSel && <svg viewBox="0 0 10 10" fill="none" style={{ width: 8, height: 8 }}><path d="M2 5l2.5 2.5 3.5-3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Download section */}
              {(!payEnabled || wmEnabled) && (
                <div style={{ padding: '14px 16px', borderTop: '1px solid #EAEDF4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{freeLabel.title}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{freeLabel.sub}</p>
                  </div>
                  {mobile ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'flex-end', maxWidth: 170 }}>
                      {photos.slice(0, 5).map((p, i) => (
                        <a key={p.id} href={dispUrl(p, payEnabled, wmEnabled)} download={`pixsnap_${i + 1}.jpg`} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 10, background: 'var(--grad)', color: 'white', padding: '4px 8px', borderRadius: 7, fontWeight: 700, textDecoration: 'none' }}>
                          #{i + 1}
                        </a>
                      ))}
                      {photos.length > 5 && <span style={{ fontSize: 10, color: 'var(--text-3)', alignSelf: 'center' }}>+{photos.length - 5}</span>}
                    </div>
                  ) : (
                    <a href={freeHref} download className="ps-btn ps-btn-secondary ps-btn-sm" style={{ textDecoration: 'none' }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v6M3.5 6l2.5 2.5L8.5 6M1 10h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Zip
                    </a>
                  )}
                </div>
              )}

              {/* Email */}
              <div style={{ padding: '14px 16px', borderTop: '1px solid #EAEDF4' }}>
                {!emailSent ? (
                  <>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 3 }}>Spara gallerilänken</p>
                    <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>Skicka länken till din inbox</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="din@email.se" className="ps-input" style={{ flex: 1, fontSize: 13 }} />
                      <button onClick={async () => {
                        setEmailLoading(true)
                        try { await fetch(`${API_URL}/send-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_token: token, email }) }); setEmailSent(true); showToast('Email skickat!') } catch {}
                        setEmailLoading(false)
                      }} disabled={!email || emailLoading} className="ps-btn ps-btn-primary ps-btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                        {emailLoading && <div className="ps-spin ps-spin-sm ps-spin-white" />}
                        Skicka
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#16a34a' }}>
                    Email skickat!
                  </div>
                )}
              </div>

              <div style={{ padding: '12px 16px', borderTop: '1px solid #EAEDF4', textAlign: 'center', fontSize: 11, color: 'var(--text-3)' }}>
                Foton tillgängliga i 30 dagar ·{' '}
                <Link href="/privacy" style={{ color: 'var(--brand)', textDecoration: 'none' }}>Integritetspolicy</Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── LIGHTBOX ── */}
      {lightbox && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setLightbox(null)}>
          <div style={{ maxWidth: '88vw', maxHeight: '88vh', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: -38, right: 0, background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13, fontFamily: 'Inter,sans-serif' }}>
              Stäng ✕
            </button>
            <img
              src={dispUrl(lightbox.photo, payEnabled, wmEnabled)}
              alt="Foto"
              style={{ maxWidth: '88vw', maxHeight: '80vh', borderRadius: 14, objectFit: 'contain', display: 'block' }}
              onError={e => { (e.currentTarget as HTMLImageElement).src = lightbox.photo.public_url }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <button onClick={() => {
                const i = Math.max(0, lightbox.idx - 1)
                setLightbox({ photo: displayPhotos[i], idx: i })
              }} disabled={lightbox.idx === 0} style={{ background: 'none', border: 'none', color: lightbox.idx === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.65)', cursor: 'pointer', fontFamily: 'Inter,sans-serif', fontSize: 13 }}>
                ← Föregående
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={e => toggleFav(lightbox.photo.id, e as any)} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer', background: favs.has(lightbox.photo.id) ? 'var(--danger)' : 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 14 14" fill={favs.has(lightbox.photo.id) ? 'white' : 'none'} stroke="white" strokeWidth={1.8} style={{ width: 12, height: 12 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 4.5a2.5 2.5 0 015 0M12 4.5a2.5 2.5 0 00-4.5-1.5L7 3.5l-.5-.5A2.5 2.5 0 002 5c0 1 .5 2 1.5 3L7 11.5l3.5-3.5c1-1 1.5-2 1.5-3z" />
                  </svg>
                </button>
                <a href={dispUrl(lightbox.photo, payEnabled, wmEnabled)} download={`pixsnap_${lightbox.idx + 1}.jpg`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.12)', color: 'white', fontWeight: 600, fontSize: 12, textDecoration: 'none' }}>
                  Ladda ner
                </a>
                {payEnabled && (
                  <button onClick={() => toggleSel(lightbox.photo.id)} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: selected.has(lightbox.photo.id) ? 'white' : 'rgba(255,255,255,0.12)', color: selected.has(lightbox.photo.id) ? 'var(--text-1)' : 'white', fontSize: 12, fontWeight: 600, fontFamily: 'Inter,sans-serif' }}>
                    {selected.has(lightbox.photo.id) ? 'Markerad' : 'Markera'}
                  </button>
                )}
              </div>
              <button onClick={() => {
                const i = Math.min(displayPhotos.length - 1, lightbox.idx + 1)
                setLightbox({ photo: displayPhotos[i], idx: i })
              }} disabled={lightbox.idx >= displayPhotos.length - 1} style={{ background: 'none', border: 'none', color: lightbox.idx >= displayPhotos.length - 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.65)', cursor: 'pointer', fontFamily: 'Inter,sans-serif', fontSize: 13 }}>
                Nästa →
              </button>
            </div>
            <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>{lightbox.idx + 1} / {displayPhotos.length}</p>
          </div>
        </div>
      )}

      {/* ── THANKS MODAL ── */}
      {showThanks && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowThanks(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 22, padding: 26, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, var(--danger), #EC4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 7.5a3.5 3.5 0 017 0M15.5 7.5a3.5 3.5 0 00-6.5-1.8L9 5.5l-.5-.8A3.5 3.5 0 002 7.5c0 1.5.7 3 2 4.5L9 16l5-4c1.3-1.5 2-3 2-4.5z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', marginBottom: 3 }}>AI Tackkort</h2>
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Generera ett personligt tackkort till fotografen</p>
            </div>
            {!thanksMsg ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="ps-label">Ditt namn</label>
                  <input type="text" value={thanksName} onChange={e => setThanksName(e.target.value)} placeholder="T.ex. Anna" className="ps-input" />
                </div>
                <button onClick={generateThanks} disabled={!thanksName.trim() || thanksLoading} className="ps-btn ps-btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', background: 'linear-gradient(135deg, var(--danger), #EC4899)' }}>
                  {thanksLoading && <div className="ps-spin ps-spin-sm ps-spin-white" />}
                  {thanksLoading ? 'AI skriver…' : 'Generera tackkort'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: 'linear-gradient(135deg, #FFF0F8, #FDF4FF)', border: '1px solid rgba(236,72,153,0.15)', borderRadius: 14, padding: 18 }}>
                  <p style={{ fontSize: 14, color: 'var(--text-1)', lineHeight: 1.7, textAlign: 'center', fontStyle: 'italic' }}>"{thanksMsg}"</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', marginTop: 8 }}>— {thanksName}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { navigator.clipboard.writeText(thanksMsg); showToast('Kopierat!') }} className="ps-btn ps-btn-secondary ps-btn-sm" style={{ flex: 1 }}>Kopiera</button>
                  <button onClick={() => { setThanksMsg(''); setThanksName('') }} className="ps-btn ps-btn-secondary ps-btn-sm" style={{ flex: 1 }}>Ny version</button>
                  <button onClick={() => setShowThanks(false)} className="ps-btn ps-btn-primary ps-btn-sm" style={{ flex: 1 }}>Klar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div className="ps-toast">
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 3.5-3.5" stroke="var(--success)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          {toast}
        </div>
      )}
    </div>
  )
}
