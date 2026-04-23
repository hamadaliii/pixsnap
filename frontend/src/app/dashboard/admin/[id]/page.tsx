'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useDropzone } from 'react-dropzone'
import { createClient } from '@/lib/supabase/client'
import { Navbar } from '@/components/layout/Navbar'
import { QRDisplay } from '@/components/ui/QRDisplay'
import { PhotoGrid } from '@/components/ui/PhotoGrid'
import { formatDate, getEventUrl } from '@/lib/utils'
import type { Event, Photo } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
const PARALLEL = 5

export default function AdminPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [event, setEvent] = useState<Event | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadTotal, setUploadTotal] = useState(0)
  const [uploadDone, setUploadDone] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'photos' | 'settings' | 'stats'>('photos')
  const [stats, setStats] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishDone, setPublishDone] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [userId, setUserId] = useState('')
  const [saveMsg, setSaveMsg] = useState('')

  // Settings
  const [pinCode, setPinCode] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [pricePerPhoto, setPricePerPhoto] = useState(10)
  const [packageEnabled, setPackageEnabled] = useState(false)
  const [packagePrice, setPackagePrice] = useState(49)
  const [watermarkText, setWatermarkText] = useState('PixSnap')
  const [watermarkEnabled, setWatermarkEnabled] = useState(true)
  const [paymentEnabled, setPaymentEnabled] = useState(true)
  const [browseAll, setBrowseAll] = useState(false)
  const [photographerName, setPhotographerName] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)
      const { data: ev } = await supabase.from('events').select('*').eq('id', id).eq('created_by', user.id).single()
      if (!ev) { router.push('/dashboard'); return }
      setEvent(ev)
      setPinCode(ev.pin_code ?? '')
      setExpiresAt(ev.expires_at ? ev.expires_at.slice(0, 10) : '')
      setIsActive(ev.is_active ?? true)
      setPricePerPhoto((ev.price_per_photo_ore ?? 1000) / 100)
      setPackageEnabled(ev.package_enabled ?? false)
      setPackagePrice((ev.package_price_ore ?? 4900) / 100)
      setWatermarkText(ev.watermark_text ?? 'PixSnap')
      setWatermarkEnabled(ev.watermark_enabled ?? true)
      setPaymentEnabled(ev.payment_enabled ?? true)
      setBrowseAll(ev.browse_all_enabled ?? false)
      setPhotographerName(ev.photographer_name ?? '')
      setPublishDone(!!ev.notification_sent)
      const { data: photosData } = await supabase.from('photos').select('*').eq('event_id', id).order('created_at', { ascending: false })
      setPhotos(photosData ?? [])
    }
    load()
  }, [id, router, supabase])

  useEffect(() => {
    if (tab === 'stats' && !stats && event) {
      fetch(`${API_URL}/stats/${event.id}`).then(r => r.json()).then(setStats).catch(console.error)
    }
  }, [tab, event, stats])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!event || acceptedFiles.length === 0) return
    setUploading(true); setError(null)
    setUploadTotal(acceptedFiles.length); setUploadDone(0); setUploadProgress(0)
    let done = 0
    const newPhotos: Photo[] = []
    async function uploadFile(file: File) {
      try {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        const fileName = `${event!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: storageError } = await supabase.storage.from('event-photos').upload(fileName, file)
        if (storageError) throw new Error(storageError.message)
        const { data: { publicUrl } } = supabase.storage.from('event-photos').getPublicUrl(fileName)
        const { data: photoRecord, error: dbError } = await supabase.from('photos')
          .insert({ event_id: event!.id, storage_path: fileName, public_url: publicUrl, processed: false })
          .select().single()
        if (dbError) throw new Error(dbError.message)
        fetch(`${API_URL}/embed`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo_id: photoRecord.id, photo_url: publicUrl, event_id: event!.id, watermark_text: watermarkEnabled ? watermarkText : '' }),
        }).catch(console.error)
        newPhotos.push(photoRecord)
      } catch (err) { console.error(`Fel: ${(err as Error).message}`) }
      finally { done++; setUploadDone(done); setUploadProgress(Math.round((done / acceptedFiles.length) * 100)) }
    }
    for (let i = 0; i < acceptedFiles.length; i += PARALLEL) {
      await Promise.all(acceptedFiles.slice(i, i + PARALLEL).map(uploadFile))
    }
    setPhotos(prev => [...newPhotos.reverse(), ...prev])
    setUploading(false)
  }, [event, supabase, watermarkText, watermarkEnabled])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic'] }, multiple: true,
  })

  async function handleDelete(photo: Photo) {
    if (!confirm('Radera detta foto permanent?')) return
    await supabase.storage.from('event-photos').remove([photo.storage_path])
    await supabase.from('photos').delete().eq('id', photo.id)
    setPhotos(prev => prev.filter(p => p.id !== photo.id))
  }

  async function handlePublish() {
    if (!event || !userId) return
    if (!confirm('Skicka notifikationer till alla registrerade gäster?')) return
    setPublishing(true)
    try {
      const res = await fetch(`${API_URL}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_id: event.id, user_id: userId }) })
      const data = await res.json()
      setPublishDone(true)
      alert(`✅ ${data.message}`)
    } catch { alert('Något gick fel') }
    finally { setPublishing(false) }
  }

  async function handleDeleteEvent() {
    if (!event || !userId) return
    if (!confirm(`Radera "${event.name}" permanent? ALL data raderas.`)) return
    setDeleting(true)
    await fetch(`${API_URL}/event/${event.id}?user_id=${userId}`, { method: 'DELETE' })
    router.push('/dashboard')
  }

  async function saveSettings() {
    if (!event) return
    setSavingSettings(true)
    await supabase.from('events').update({
      pin_code: pinCode || null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      is_active: isActive,
      price_per_photo_ore: Math.round(pricePerPhoto * 100),
      package_enabled: packageEnabled,
      package_price_ore: Math.round(packagePrice * 100),
      watermark_text: watermarkText || 'PixSnap',
      watermark_enabled: watermarkEnabled,
      payment_enabled: paymentEnabled,
      photographer_name: photographerName || null,
      browse_all_enabled: browseAll,
    }).eq('id', event.id)
    setSavingSettings(false)
    setSaveMsg('Sparat!')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  if (!event) return (
    <div className="min-h-screen bg-neutral-50"><Navbar />
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
      </div>
    </div>
  )

  const eventUrl = getEventUrl(event.slug)
  const processedCount = photos.filter(p => p.processed).length

  const Toggle = ({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) => (
    <label className="flex items-center justify-between cursor-pointer">
      <div>
        <p className="text-sm font-semibold text-neutral-900">{label}</p>
        {desc && <p className="text-xs text-neutral-500 mt-0.5">{desc}</p>}
      </div>
      <button onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ml-4 ${value ? 'bg-neutral-900' : 'bg-neutral-200'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
      </button>
    </label>
  )

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-5 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-neutral-400 mb-6">
          <Link href="/dashboard" className="hover:text-neutral-700 transition-colors">Events</Link>
          <span>/</span><span className="text-neutral-700 font-medium">{event.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-neutral-900">{event.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {isActive ? 'Aktivt' : 'Inaktivt'}
              </span>
              {event.pin_code && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">🔒 PIN</span>}
              {publishDone && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">✓ Publicerat</span>}
              {!paymentEnabled && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">🎁 Gratis</span>}
            </div>
            <p className="text-sm text-neutral-500 mt-1">
              {formatDate(event.date)} · {photos.length} foton · {processedCount} indexerade
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a href={eventUrl} target="_blank" rel="noopener noreferrer"
              className="text-sm text-neutral-600 border border-neutral-200 bg-white px-4 py-2 rounded-xl hover:border-neutral-400 transition-colors font-medium">
              Visa publik sida ↗
            </a>
            <button onClick={handlePublish} disabled={publishing || publishDone}
              className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5 ${publishDone ? 'bg-neutral-100 text-neutral-400' : 'bg-neutral-900 text-white hover:bg-neutral-700'}`}>
              {publishing && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {publishDone ? '✓ Publicerat' : '🔔 Publicera & notifiera'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 mb-6 bg-neutral-100 rounded-xl p-1 w-fit">
          {(['photos', 'settings', 'stats'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${tab === t ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
              {t === 'photos' ? '📸 Foton' : t === 'settings' ? '⚙️ Inställningar' : '📊 Statistik'}
            </button>
          ))}
        </div>

        {/* PHOTOS TAB */}
        {tab === 'photos' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-neutral-100 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-4">QR-kod</p>
                <QRDisplay url={eventUrl} slug={event.slug} />
                <Link href={`/dashboard/qr-poster/${event.id}`} className="block mt-3">
                  <button className="w-full bg-neutral-900 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-neutral-700 transition-colors">
                    🎨 Designa QR-affisch
                  </button>
                </Link>
              </div>

              <div className="bg-white rounded-2xl border border-neutral-100 p-5 space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Status</p>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-neutral-50 rounded-xl p-3">
                    <p className="text-lg font-bold text-neutral-900">{photos.length}</p>
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wide">Foton</p>
                  </div>
                  <div className="bg-neutral-50 rounded-xl p-3">
                    <p className="text-lg font-bold text-neutral-900">{processedCount}</p>
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wide">Indexerade</p>
                  </div>
                </div>
                {!paymentEnabled && (
                  <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
                    <p className="text-xs font-semibold text-purple-700">🎁 Gratis-läge aktiverat</p>
                    <p className="text-[10px] text-purple-500 mt-0.5">Gäster laddar ner gratis utan vattenstämpel</p>
                  </div>
                )}
                <div className="bg-neutral-50 border border-neutral-100 rounded-xl px-3 py-2.5 space-y-2">
                  <p className="text-xs font-bold text-neutral-600">Notifikationer</p>
                  {publishDone ? (
                    <p className="text-xs text-green-600">✓ Skickade</p>
                  ) : (
                    <button onClick={handlePublish} disabled={publishing}
                      className="w-full bg-neutral-900 text-white text-xs font-bold py-2 rounded-lg hover:bg-neutral-700 transition-colors flex items-center justify-center gap-1.5">
                      {publishing && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      🔔 Publicera & notifiera
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-5">
              <div {...getRootProps()} className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${isDragActive ? 'border-neutral-900 bg-neutral-50 scale-[1.01]' : 'border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50/50'}`}>
                <input {...getInputProps()} />
                {uploading ? (
                  <div className="space-y-3 max-w-xs mx-auto">
                    <div className="w-10 h-10 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin mx-auto" />
                    <p className="text-sm font-semibold text-neutral-700">Laddar upp {uploadDone}/{uploadTotal}</p>
                    <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-900 rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <p className="text-xs text-neutral-400">{uploadProgress}% · {PARALLEL} parallella</p>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-6 h-6 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-neutral-700 mb-1">{isDragActive ? 'Slapp fotona här!' : 'Ladda upp eventfoton'}</p>
                    <p className="text-xs text-neutral-400">Upp till 1000+ foton · JPG, PNG, WebP, HEIC</p>
                  </>
                )}
              </div>

              {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>}

              {photos.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Foton ({photos.length})</p>
                    <div className="flex items-center gap-3 text-xs text-neutral-400">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" />Indexerat</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />Bearbetar</span>
                    </div>
                  </div>
                  <PhotoGrid photos={photos} allowDelete onDelete={handleDelete} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {tab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-3xl">

            {/* Tillgång & status */}
            <div className="bg-white rounded-2xl border border-neutral-100 p-5 space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Åtkomst</p>
              <Toggle value={isActive} onChange={setIsActive} label="Aktivt event" desc="Gäster kan söka och hitta foton" />
              <div className="divider" />
              <Toggle value={browseAll} onChange={setBrowseAll} label="Visa alla foton" desc="Gäster kan bläddra bland alla bilder" />
              <div className="divider" />
              <div>
                <label className="label">PIN-skydd (valfritt)</label>
                <input type="number" value={pinCode} onChange={e => setPinCode(e.target.value)} placeholder="T.ex. 1234" maxLength={8} className="input" />
              </div>
              <div>
                <label className="label">Stängs automatiskt</label>
                <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="input" />
              </div>
            </div>

            {/* Betalning */}
            <div className="bg-white rounded-2xl border border-neutral-100 p-5 space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Betalning & pris</p>
              <Toggle value={paymentEnabled} onChange={setPaymentEnabled} label="Betalning aktiverat" desc={paymentEnabled ? 'Gäster betalar för full kvalitet' : '🎁 Gratis — alla foton tillgängliga direkt'} />
              {paymentEnabled && (
                <>
                  <div className="divider" />
                  <div>
                    <label className="label">Pris per foto: <strong className="text-neutral-900">{pricePerPhoto} kr</strong></label>
                    <input type="range" min={5} max={50} value={pricePerPhoto} onChange={e => setPricePerPhoto(Number(e.target.value))} className="w-full accent-neutral-900 mt-1" />
                    <div className="flex justify-between text-xs text-neutral-400 mt-0.5"><span>5 kr</span><span>50 kr</span></div>
                  </div>
                  <div className="divider" />
                  <Toggle value={packageEnabled} onChange={setPackageEnabled} label="Paketpris" desc="Köp alla foton för ett fast pris" />
                  {packageEnabled && (
                    <div>
                      <label className="label">Paketpris: <strong className="text-neutral-900">{packagePrice} kr</strong></label>
                      <input type="range" min={19} max={199} value={packagePrice} onChange={e => setPackagePrice(Number(e.target.value))} className="w-full accent-neutral-900 mt-1" />
                      <div className="flex justify-between text-xs text-neutral-400 mt-0.5"><span>19 kr</span><span>199 kr</span></div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Vattenstämpel */}
            <div className="bg-white rounded-2xl border border-neutral-100 p-5 space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Vattenstämpel</p>
              <Toggle value={watermarkEnabled} onChange={setWatermarkEnabled} label="Vattenstämpel aktiverad" desc={watermarkEnabled ? 'Visas på gratisnedladdningar' : 'Av — bilder visas utan vattenstämpel'} />
              {watermarkEnabled && (
                <>
                  <div>
                    <label className="label">Text</label>
                    <input type="text" value={watermarkText} onChange={e => setWatermarkText(e.target.value)} placeholder="PixSnap" className="input" />
                  </div>
                  {/* Live preview */}
                  <div className="relative aspect-video bg-neutral-100 rounded-xl overflow-hidden">
                    <div className="absolute inset-0">
                      {[0,1,2,3].map(row => [0,1,2].map(col => (
                        <span key={`${row}-${col}`} className="absolute text-neutral-800 opacity-[0.15] text-xs font-bold select-none"
                          style={{ top: `${20+row*30}%`, left: `${col*36}%`, transform: 'rotate(-30deg)', whiteSpace: 'nowrap' }}>
                          {watermarkText || 'PixSnap'}
                        </span>
                      )))}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 bg-neutral-200 rounded-lg" />
                    </div>
                    <div className="absolute bottom-2 right-2 text-[10px] text-neutral-400">Förhandsvisning</div>
                  </div>
                </>
              )}
            </div>

            {/* Fotograf */}
            <div className="bg-white rounded-2xl border border-neutral-100 p-5 space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Fotografens uppgifter</p>
              <div>
                <label className="label">Namn (visas för gäster)</label>
                <input type="text" value={photographerName} onChange={e => setPhotographerName(e.target.value)} placeholder="T.ex. Anna Andersson Foto" className="input" />
              </div>
              <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-3 space-y-1">
                <p className="text-xs font-bold text-neutral-700">Aktuell prisbild</p>
                <p className="text-xs text-neutral-500">{!paymentEnabled ? '🎁 Gratis — inga betalningar' : `${pricePerPhoto} kr/foto${packageEnabled ? ` · Paket ${packagePrice} kr` : ''}`}</p>
                <p className="text-xs text-neutral-500">{watermarkEnabled ? `Vattenstämpel: "${watermarkText}"` : 'Ingen vattenstämpel'}</p>
                <p className="text-xs text-neutral-500">{browseAll ? 'Alla kan se alla foton' : 'Gäster ser bara sina foton'}</p>
              </div>
            </div>

            {/* Save button */}
            <div className="lg:col-span-2">
              <button onClick={saveSettings} disabled={savingSettings}
                className="w-full bg-neutral-900 text-white text-sm font-bold py-3.5 rounded-xl hover:bg-neutral-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {savingSettings && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {saveMsg || (savingSettings ? 'Sparar…' : 'Spara alla inställningar')}
              </button>
            </div>

            {/* Danger zone */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-red-100 p-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-red-400">Farlig zon</p>
              <p className="text-sm text-neutral-500">Raderar eventet, alla foton och AWS-indexet permanent.</p>
              <button onClick={handleDeleteEvent} disabled={deleting}
                className="bg-red-50 text-red-600 border border-red-100 text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                {deleting && <span className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />}
                Radera event permanent
              </button>
            </div>
          </div>
        )}

        {/* STATS TAB */}
        {tab === 'stats' && (
          <div className="space-y-5 max-w-3xl">
            {!stats ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Skanningar', value: stats.total_scans, icon: '👁' },
                    { label: 'Matchningar', value: stats.total_matches, icon: '🎯' },
                    { label: 'Foton sålda', value: stats.total_photos_sold, icon: '📸' },
                    { label: 'Intäkter', value: `${stats.total_revenue_sek} kr`, icon: '💰' },
                    { label: 'Konvertering', value: `${stats.conversion_rate}%`, icon: '📈' },
                    { label: 'Väntelista', value: stats.waitlist_count ?? 0, icon: '📧' },
                  ].map(({ label, value, icon }) => (
                    <div key={label} className="bg-white rounded-2xl border border-neutral-100 p-4 text-center hover:shadow-sm transition-shadow">
                      <span className="text-xl block mb-1">{icon}</span>
                      <p className="text-xl font-bold text-neutral-900">{String(value)}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-2xl border border-neutral-100 p-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">Sammanfattning</p>
                  <p className="text-sm text-neutral-600 leading-relaxed">
                    {stats.total_scans === 0
                      ? 'Inga gäster har skannat QR-koden ännu. Dela QR-koden eller affischen!'
                      : `${stats.total_scans} gäster har skannat QR-koden. ${stats.total_matches} matchningar gjordes. Konverteringsgraden är ${stats.conversion_rate}%.`
                    }
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}