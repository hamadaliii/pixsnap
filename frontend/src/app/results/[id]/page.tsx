'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface Photo { id: string; public_url: string; watermark_url: string | null }
interface EventSettings {
  slug: string; name: string
  price_per_photo_ore: number; package_enabled: boolean; package_price_ore: number
  payment_enabled: boolean; watermark_enabled: boolean; browse_all_enabled: boolean
}

function getFavorites(eventId: string): string[] {
  try { return JSON.parse(localStorage.getItem(`ps_fav_${eventId}`) ?? '[]') } catch { return [] }
}
function saveFavorites(eventId: string, ids: string[]) {
  try { localStorage.setItem(`ps_fav_${eventId}`, JSON.stringify(ids)) } catch {}
}

export default function ResultsPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const token = searchParams.get('token') ?? ''

  const [photos, setPhotos] = useState<Photo[]>([])
  const [allPhotos, setAllPhotos] = useState<Photo[]>([])
  const [settings, setSettings] = useState<EventSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [lightbox, setLightbox] = useState<Photo | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [filterFavs, setFilterFavs] = useState(false)
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [packageLoading, setPackageLoading] = useState(false)
  const [confettiDone, setConfettiDone] = useState(false)

  // Tackkort state
  const [showThanksCard, setShowThanksCard] = useState(false)
  const [thanksName, setThanksName] = useState('')
  const [thanksMsg, setThanksMsg] = useState('')
  const [thanksLoading, setThanksLoading] = useState(false)
  const [thanksCardUrl, setThanksCardUrl] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const matchIds = searchParams.get('matches')
        const { data: event } = await supabase.from('events')
          .select('slug,name,price_per_photo_ore,package_enabled,package_price_ore,payment_enabled,watermark_enabled,browse_all_enabled')
          .eq('id', eventId).single()
        if (event) setSettings(event)

        if (matchIds) {
          const ids = matchIds.split(',').filter(Boolean)
          if (ids.length > 0) {
            const { data } = await supabase.from('photos').select('*').in('id', ids)
            setPhotos(data ?? [])
          }
        }
        if (event?.browse_all_enabled) {
          const { data: all } = await supabase.from('photos').select('id,public_url,watermark_url').eq('event_id', eventId).limit(500)
          setAllPhotos(all ?? [])
        }

        // Load saved favorites
        const savedFavs = getFavorites(eventId)
        setFavorites(new Set(savedFavs))
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [eventId, searchParams, supabase])

  useEffect(() => {
    if (confettiDone || photos.length === 0) return
    setConfettiDone(true)
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;width:100vw;height:100vh'
    canvas.width = window.innerWidth; canvas.height = window.innerHeight
    document.body.appendChild(canvas)
    const ctx = canvas.getContext('2d')!
    const colors = ['#111','#555','#888','#ccc','#ddd','#f0f0f0']
    const p = Array.from({ length: 70 }, () => ({
      x: Math.random() * canvas.width, y: -20,
      vx: (Math.random()-0.5)*5, vy: Math.random()*3+2,
      color: colors[Math.floor(Math.random()*colors.length)],
      size: Math.random()*8+3, rot: Math.random()*Math.PI*2, rv: (Math.random()-0.5)*0.15
    }))
    let frame = 0
    function draw() {
      ctx.clearRect(0,0,canvas.width,canvas.height)
      p.forEach(q => { q.x+=q.vx; q.y+=q.vy; q.vy+=0.07; q.rot+=q.rv; ctx.save(); ctx.translate(q.x,q.y); ctx.rotate(q.rot); ctx.fillStyle=q.color; ctx.globalAlpha=Math.max(0,1-frame/90); ctx.fillRect(-q.size/2,-q.size/4,q.size,q.size/2); ctx.restore() })
      frame++
      if(frame<90) requestAnimationFrame(draw)
      else if(document.body.contains(canvas)) document.body.removeChild(canvas)
    }
    draw()
  }, [photos, confettiDone])

  function toggleFavorite(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setFavorites(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      saveFavorites(eventId, Array.from(n))
      return n
    })
  }

  function toggleSelect(id: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function generateThanksCard() {
    if (!thanksName.trim()) return
    setThanksLoading(true)
    const favPhoto = photos.find(p => favorites.has(p.id)) ?? photos[0]
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: `Skriv ett personligt och varmt tackkort på svenska från en eventgäst som heter "${thanksName}" till fotografen för eventet "${settings?.name ?? 'eventet'}". Kortet ska vara 2-3 meningar, varmt, personligt och tacksamt. Inkludera inte rubriker, bara själva texten.`
          }]
        })
      })
      const d = await res.json()
      setThanksMsg(d.content?.[0]?.text ?? '')
    } catch { setThanksMsg(`Tack så mycket för de fantastiska fotona från ${settings?.name}! Du fångade dagen på ett otroligt sätt. Vi kommer att minnas dessa bilder för alltid.`) }
    setThanksLoading(false)
  }

  async function handleCheckout(usePackage = false) {
    if (!usePackage && selected.size === 0) return
    usePackage ? setPackageLoading(true) : setCheckoutLoading(true)
    try {
      const res = await fetch(`${API_URL}/create-checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_ids: usePackage ? photos.map(p=>p.id) : Array.from(selected), session_token: token, package: usePackage }),
      })
      const d = await res.json()
      if (d.checkout_url) window.location.href = d.checkout_url
    } catch {}
    finally { usePackage ? setPackageLoading(false) : setCheckoutLoading(false) }
  }

  const paymentEnabled = settings?.payment_enabled ?? true
  const watermarkEnabled = settings?.watermark_enabled ?? true
  const pricePerPhoto = settings ? settings.price_per_photo_ore / 100 : 10
  const packagePrice = settings ? settings.package_price_ore / 100 : 49
  const packageEnabled = settings?.package_enabled ?? false
  const browseAllEnabled = settings?.browse_all_enabled ?? false

  function getPhotoUrl(photo: Photo) {
    if (!paymentEnabled || !watermarkEnabled) return photo.public_url
    return photo.watermark_url ?? photo.public_url
  }

  const displayPhotos = filterFavs
    ? (showAll ? allPhotos : photos).filter(p => favorites.has(p.id))
    : (showAll ? allPhotos : photos)

  const lightboxIdx = lightbox ? displayPhotos.findIndex(p => p.id === lightbox.id) : -1

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-5 h-5 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-neutral-500">Laddar dina foton…</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Topbar */}
      <div className="h-[52px] border-b border-neutral-100 flex items-center justify-between px-5 sticky top-0 bg-white/95 backdrop-blur z-40">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 bg-neutral-900 rounded-lg flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-neutral-900">PixSnap</span>
        </Link>
        <div className="flex items-center gap-2">
          {favorites.size > 0 && (
            <button onClick={() => setShowThanksCard(true)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-100 px-3 py-1.5 rounded-xl hover:bg-rose-100 transition-colors">
              💌 Tackkort
            </button>
          )}
          {settings?.slug && (
            <Link href={`/event/${settings.slug}`} className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors border border-neutral-200 px-3 py-1.5 rounded-xl">
              Ny sökning
            </Link>
          )}
        </div>
      </div>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        {photos.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">😕</p>
            <h1 className="text-xl font-bold text-neutral-900 mb-2">Inga foton hittades</h1>
            <p className="text-sm text-neutral-500 mb-6">Prova med en tydligare selfie.</p>
            {settings?.slug && <Link href={`/event/${settings.slug}`} className="inline-flex bg-neutral-900 text-white text-sm font-bold px-6 py-3 rounded-xl hover:bg-neutral-700 transition-colors">Försök igen</Link>}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-green-50 border border-green-100 rounded-full px-4 py-1.5 text-xs font-bold text-green-700 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Hittade {photos.length} foto{photos.length !== 1 ? 'n' : ''} av dig
              </div>
              {!paymentEnabled && (
                <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-full px-3 py-1 text-xs font-medium text-blue-700">
                  🎁 Gratis — ladda ner i full kvalitet
                </div>
              )}
            </div>

            {/* Filter bar */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {browseAllEnabled && (
                <>
                  <button onClick={() => setShowAll(false)} className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${!showAll ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}>
                    Mina ({photos.length})
                  </button>
                  <button onClick={() => setShowAll(true)} className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${showAll ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}>
                    Alla ({allPhotos.length})
                  </button>
                </>
              )}
              {favorites.size > 0 && (
                <button onClick={() => setFilterFavs(!filterFavs)} className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ${filterFavs ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                  ❤️ Favoriter ({favorites.size})
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                {paymentEnabled && <button onClick={() => setSelected(new Set(photos.map(p=>p.id)))} className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors">Välj alla</button>}
              </div>
            </div>

            {/* Package banner */}
            {paymentEnabled && packageEnabled && photos.length > 0 && (
              <div className="bg-neutral-900 text-white rounded-2xl p-4 mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">Alla {photos.length} foton</p>
                  <p className="text-xs text-white/50 mt-0.5">Spara {Math.max(0, photos.length * pricePerPhoto - packagePrice)} kr</p>
                </div>
                <button onClick={() => handleCheckout(true)} disabled={packageLoading}
                  className="bg-white text-neutral-900 text-sm font-bold px-4 py-2 rounded-xl hover:bg-neutral-100 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                  {packageLoading && <span className="w-3.5 h-3.5 border-2 border-neutral-400 border-t-neutral-900 rounded-full animate-spin" />}
                  {packagePrice} kr
                </button>
              </div>
            )}

            {/* Buy bar */}
            {paymentEnabled && selected.size > 0 && (
              <div className="sticky top-[52px] z-30 bg-white/95 backdrop-blur border-b border-neutral-100 py-3 mb-4 flex items-center justify-between gap-3">
                <button onClick={() => setSelected(new Set())} className="text-xs text-neutral-500 hover:text-neutral-800">Avmarkera ({selected.size})</button>
                <button onClick={() => handleCheckout(false)} disabled={checkoutLoading}
                  className="bg-neutral-900 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-neutral-700 disabled:opacity-50 flex items-center gap-1.5">
                  {checkoutLoading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Köp {selected.size} st · {(selected.size * pricePerPhoto).toFixed(0)} kr
                </button>
              </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-8">
              {displayPhotos.map((photo, idx) => {
                const isSelected = selected.has(photo.id)
                const isFav = favorites.has(photo.id)
                return (
                  <div key={photo.id}
                    className="relative aspect-square rounded-xl overflow-hidden bg-neutral-100 cursor-pointer group"
                    onClick={() => setLightbox(photo)}>
                    <Image src={getPhotoUrl(photo)} alt={`Foto ${idx+1}`} fill
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      sizes="(max-width:640px) 50vw, 33vw" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

                    {/* Favorite button */}
                    <button onClick={e => toggleFavorite(photo.id, e)}
                      className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all ${isFav ? 'bg-rose-500 scale-100' : 'bg-black/30 opacity-0 group-hover:opacity-100 scale-90'}`}>
                      <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>

                    {/* Select button (only if payment enabled) */}
                    {paymentEnabled && (
                      <button onClick={e => toggleSelect(photo.id, e)}
                        className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-neutral-900 border-neutral-900 scale-100' : 'bg-black/20 border-white/60 opacity-0 group-hover:opacity-100 scale-90'}`}>
                        {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </button>
                    )}
                    <span className="absolute bottom-1.5 left-1.5 text-[9px] text-white/50 font-mono">{idx+1}</span>
                  </div>
                )
              })}
            </div>

            {/* Download */}
            {!paymentEnabled ? (
              <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-4 mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-neutral-900">Ladda ner alla</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Full kvalitet · Gratis</p>
                </div>
                <a href={`${API_URL}/download-free?ids=${photos.map(p=>p.id).join(',')}`} download className="bg-neutral-900 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-neutral-700 transition-colors">↓ Zip</a>
              </div>
            ) : watermarkEnabled ? (
              <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-4 mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-neutral-900">Ladda ner gratis</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Med vattenstämpel</p>
                </div>
                <a href={`${API_URL}/download-free?ids=${photos.map(p=>p.id).join(',')}`} download className="text-xs text-neutral-600 border border-neutral-200 rounded-xl px-3 py-1.5 hover:bg-white hover:border-neutral-300 transition-all">↓ Zip</a>
              </div>
            ) : null}

            {/* Email */}
            {!emailSent ? (
              <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-4">
                <p className="text-sm font-bold text-neutral-900 mb-0.5">Spara gallerilänken</p>
                <p className="text-xs text-neutral-500 mb-3">Skicka länken till din inbox</p>
                <div className="flex gap-2">
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="din@email.se" className="input flex-1 text-sm" />
                  <button onClick={async () => {
                    setEmailLoading(true)
                    try { await fetch(`${API_URL}/send-email`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ session_token: token, email }) }); setEmailSent(true) } catch {}
                    setEmailLoading(false)
                  }} disabled={!email || emailLoading} className="bg-neutral-900 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-neutral-700 disabled:opacity-40 flex items-center gap-1.5 flex-shrink-0">
                    {emailLoading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    Skicka
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
                <p className="text-sm font-bold text-green-700">Email skickat! ✓</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/92 flex items-center justify-center z-50 p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightbox(null)} className="absolute -top-10 right-0 text-white/50 hover:text-white text-sm">Stäng ✕</button>
            <Image src={getPhotoUrl(lightbox)} alt="Foto" width={900} height={900} className="w-full rounded-2xl object-contain max-h-[78vh]" />
            <div className="flex items-center justify-between mt-4">
              <button onClick={() => lightboxIdx > 0 && setLightbox(displayPhotos[lightboxIdx-1])} disabled={lightboxIdx<=0}
                className="text-white/50 hover:text-white disabled:opacity-20 px-4 py-2 text-sm">← Föregående</button>
              <div className="flex items-center gap-2">
                <button onClick={e => toggleFavorite(lightbox.id, e as any)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${favorites.has(lightbox.id) ? 'bg-rose-500' : 'bg-white/10 hover:bg-white/20'}`}>
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill={favorites.has(lightbox.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
                {paymentEnabled && (
                  <button onClick={() => toggleSelect(lightbox.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold ${selected.has(lightbox.id) ? 'bg-white text-neutral-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                    {selected.has(lightbox.id) ? '✓ Markerad' : 'Markera för köp'}
                  </button>
                )}
              </div>
              <button onClick={() => lightboxIdx < displayPhotos.length-1 && setLightbox(displayPhotos[lightboxIdx+1])} disabled={lightboxIdx>=displayPhotos.length-1}
                className="text-white/50 hover:text-white disabled:opacity-20 px-4 py-2 text-sm">Nästa →</button>
            </div>
            <p className="text-center text-white/30 text-xs mt-2">{lightboxIdx+1} / {displayPhotos.length}</p>
          </div>
        </div>
      )}

      {/* Tackkort modal */}
      {showThanksCard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowThanksCard(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <span className="text-4xl">💌</span>
              <h2 className="text-xl font-bold text-neutral-900 mt-2">Generera tackkort</h2>
              <p className="text-sm text-neutral-500 mt-1">AI skriver ett personligt tackkort till fotografen</p>
            </div>

            {!thanksMsg ? (
              <div className="space-y-4">
                <div>
                  <label className="label">Ditt namn</label>
                  <input type="text" value={thanksName} onChange={e => setThanksName(e.target.value)} placeholder="T.ex. Anna" className="input" />
                </div>
                <button onClick={generateThanksCard} disabled={!thanksName.trim() || thanksLoading}
                  className="w-full bg-rose-500 text-white text-sm font-bold py-3.5 rounded-2xl hover:bg-rose-600 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                  {thanksLoading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {thanksLoading ? 'AI skriver…' : '✨ Generera tackkort'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Kortet */}
                <div className="bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-100 rounded-2xl p-5 relative overflow-hidden">
                  <div className="absolute top-3 right-3 text-2xl opacity-30">💕</div>
                  {favorites.size > 0 && (
                    <div className="w-20 h-20 rounded-xl overflow-hidden mb-4 mx-auto border-2 border-white shadow-md">
                      <Image src={getPhotoUrl(photos.find(p=>favorites.has(p.id))!)} alt="Favoritfoto" width={80} height={80} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <p className="text-sm text-neutral-700 leading-relaxed text-center italic">"{thanksMsg}"</p>
                  <p className="text-xs text-neutral-500 text-center mt-3">— {thanksName}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { navigator.clipboard.writeText(thanksMsg) }} className="flex-1 text-xs border border-neutral-200 py-2.5 rounded-xl hover:bg-neutral-50 font-medium">📋 Kopiera</button>
                  <button onClick={() => { setThanksMsg(''); setThanksName('') }} className="flex-1 text-xs border border-neutral-200 py-2.5 rounded-xl hover:bg-neutral-50 font-medium">🔄 Ny version</button>
                  <button onClick={() => setShowThanksCard(false)} className="flex-1 bg-neutral-900 text-white text-xs py-2.5 rounded-xl hover:bg-neutral-700 font-medium">✓ Klar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}