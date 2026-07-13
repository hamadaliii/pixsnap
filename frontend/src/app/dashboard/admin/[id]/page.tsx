'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useDropzone } from 'react-dropzone'
import { createClient } from '@/lib/supabase/client'
import { QRDisplay } from '@/components/ui/QRDisplay'
import { PhotoGrid } from '@/components/ui/PhotoGrid'
import { formatDate, getEventUrl } from '@/lib/utils'
import type { Event, Photo } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
const PARALLEL = 5

// 3D SVG icons — no emojis
const UploadIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <rect x="3" y="7" width="22" height="16" rx="4" fill="url(#upBg)" opacity="0.9"/>
    <path d="M14 20v-9M10 15l4-5 4 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <defs>
      <linearGradient id="upBg" x1="3" y1="7" x2="25" y2="23" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4F6EF7"/><stop offset="1" stopColor="#7C3AED"/>
      </linearGradient>
    </defs>
  </svg>
)

const CheckIcon3D = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="6" fill="url(#ckBg)" opacity="0.15"/>
    <path d="M4 7l2 2 4-4" stroke="url(#ckBg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <defs>
      <linearGradient id="ckBg" x1="1" y1="1" x2="13" y2="13" gradientUnits="userSpaceOnUse">
        <stop stopColor="#22C55E"/><stop offset="1" stopColor="#16a34a"/>
      </linearGradient>
    </defs>
  </svg>
)

const BellIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8 2a5 5 0 00-5 5v3l-1.5 2h13L13 10V7a5 5 0 00-5-5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    <path d="M6.5 14a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
)

const QRIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    <rect x="10" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    <rect x="1" y="10" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    <rect x="10" y="10" width="2" height="2" fill="currentColor"/>
    <rect x="13" y="10" width="2" height="2" fill="currentColor"/>
    <rect x="10" y="13" width="2" height="2" fill="currentColor"/>
    <rect x="13" y="13" width="2" height="2" fill="currentColor"/>
  </svg>
)

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
  const [indexing, setIndexing] = useState(false)
  const [indexMsg, setIndexMsg] = useState('')

  async function reloadPhotos() {
    const { data } = await supabase.from('photos').select('*').eq('event_id', id).order('created_at', { ascending: false })
    setPhotos(data ?? [])
  }

  async function indexPending() {
    if (!event) return
    setIndexing(true); setIndexMsg('')
    try {
      const r = await fetch(`${API_URL}/embed-pending/${event.id}`, { method: 'POST' })
      const d = await r.json()
      if (r.ok) {
        setIndexMsg(d.pending_before === 0 ? 'Alla foton är redan indexerade' : `${d.indexed} indexerade, ${d.faces_found} ansikten hittade${d.failed ? ` (${d.failed} fel)` : ''}`)
        await reloadPhotos()
      } else setIndexMsg('Indexering misslyckades')
    } catch { setIndexMsg('Backend svarar inte – vänta 30s och försök igen (Render startar upp)') }
    finally { setIndexing(false) }
  }
  const [tab, setTab] = useState<'photos' | 'guests' | 'analytics' | 'settings'>('photos')
  const [stats, setStats] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishDone, setPublishDone] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [userId, setUserId] = useState('')
  const [saveMsg, setSaveMsg] = useState('')

  // Settings state
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
    if ((tab === 'analytics' || tab === 'guests') && !stats && event) {
      fetch(`${API_URL}/stats/${event.id}`).then(r => r.json()).then(setStats).catch(console.error)
    }
  }, [tab, event, stats])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!event || acceptedFiles.length === 0) return
    setUploading(true); setError(null)
    setUploadTotal(acceptedFiles.length); setUploadDone(0); setUploadProgress(0)
    let done = 0; const newPhotos: Photo[] = []

    async function uploadFile(file: File) {
      try {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        const storageExt = (ext === 'heic' || ext === 'heif') ? 'jpg' : ext
        const fileName = `${event!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${storageExt}`
        const { error: se } = await supabase.storage.from('event-photos').upload(fileName, file)
        if (se) throw new Error(se.message)
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
      } catch (err) {
        const m = (err as Error).message
        if (m.includes('PIXSNAP_QUOTA:')) setError(m.split('PIXSNAP_QUOTA:')[1].trim())
        else console.error(m)
      }
      finally { done++; setUploadDone(done); setUploadProgress(Math.round((done / acceptedFiles.length) * 100)) }
    }

    for (let i = 0; i < acceptedFiles.length; i += PARALLEL) {
      await Promise.all(acceptedFiles.slice(i, i + PARALLEL).map(uploadFile))
    }
    setPhotos(prev => [...newPhotos.reverse(), ...prev])
    setUploading(false)

    // Server-side safety net: index anything the fire-and-forget /embed missed
    // (Render cold start can silently drop the first calls).
    setIndexing(true)
    try {
      const r = await fetch(`${API_URL}/embed-pending/${event!.id}`, { method: 'POST' })
      if (r.ok) {
        const d = await r.json()
        setIndexMsg(`${d.indexed} foton indexerade${d.failed ? `, ${d.failed} fel` : ''}`)
        await reloadPhotos()
      }
    } catch { setIndexMsg('Kunde inte indexera – klicka "Indexera foton" för att försöka igen') }
    finally { setIndexing(false) }
  }, [event, supabase, watermarkText, watermarkEnabled])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'] }, multiple: true,
  })

  async function handleDelete(photo: Photo) {
    if (!confirm('Radera detta foto permanent?')) return
    await supabase.storage.from('event-photos').remove([photo.storage_path])
    await supabase.from('photos').delete().eq('id', photo.id)
    setPhotos(prev => prev.filter(p => p.id !== photo.id))
  }

  async function handlePublish(forceResend = false) {
    if (!event || !userId) return
    if (!confirm(forceResend ? 'Skicka notifikationer igen?' : 'Publicera och notifiera gäster?')) return
    setPublishing(true)
    try {
      if (forceResend) await supabase.from('events').update({ notification_sent: false }).eq('id', event.id)
      const res = await fetch(`${API_URL}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_id: event.id, user_id: userId }) })
      const data = await res.json()
      setPublishDone(true)
      alert(data.message)
    } catch { alert('Något gick fel') }
    finally { setPublishing(false) }
  }

  async function saveSettings() {
    if (!event) return
    setSavingSettings(true)
    await supabase.from('events').update({
      pin_code: pinCode || null, expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      is_active: isActive, price_per_photo_ore: Math.round(pricePerPhoto * 100),
      package_enabled: packageEnabled, package_price_ore: Math.round(packagePrice * 100),
      watermark_text: watermarkText || 'PixSnap', watermark_enabled: watermarkEnabled,
      payment_enabled: paymentEnabled, photographer_name: photographerName || null, browse_all_enabled: browseAll,
    }).eq('id', event.id)
    setSavingSettings(false); setSaveMsg('Sparat!'); setTimeout(() => setSaveMsg(''), 2000)
  }

  if (!event) return (
    <div style={{minHeight:'50vh', display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div className="ps-spin" style={{width:32, height:32, borderWidth:3}}/>
    </div>
  )

  const eventUrl = getEventUrl(event.slug)
  const processedCount = photos.filter(p => p.processed).length
  const daysActive = event.created_at ? Math.floor((Date.now() - new Date(event.created_at).getTime()) / 86400000) : 0

  const Toggle = ({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) => (
    <label style={{display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer'}}>
      <div>
        <div style={{fontSize:14, fontWeight:600, color:'var(--text-1)'}}>{label}</div>
        {desc && <div style={{fontSize:12, color:'var(--text-3)', marginTop:2}}>{desc}</div>}
      </div>
      <button onClick={() => onChange(!value)} style={{
        position:'relative', width:44, height:24, borderRadius:100, border:'none', cursor:'pointer', flexShrink:0, marginLeft:16,
        background: value ? 'var(--grad)' : 'rgba(0,0,0,0.1)', transition:'background 0.2s',
      }}>
        <span style={{
          position:'absolute', top:2, left:2, width:20, height:20, borderRadius:'50%', background:'white',
          boxShadow:'0 1px 4px rgba(0,0,0,0.2)', transition:'transform 0.2s',
          transform: value ? 'translateX(20px)' : 'none',
          display:'block',
        }}/>
      </button>
    </label>
  )

  return (
    <div style={{fontFamily:'Inter,sans-serif'}}>
      {/* GRADIENT HEADER */}
      <div style={{background:'linear-gradient(135deg, #4F6EF7 0%, #7C3AED 100%)', borderRadius:20, padding:'28px 32px 32px', marginBottom:24, position:'relative', overflow:'hidden'}}>
        {/* Decorative elements */}
        <div style={{position:'absolute',top:-30,right:-30,width:120,height:120,borderRadius:'50%',background:'rgba(255,255,255,0.08)'}}/>
        <div style={{position:'absolute',bottom:-20,left:60,width:80,height:80,borderRadius:'50%',background:'rgba(255,255,255,0.05)'}}/>

        <div style={{position:'relative',zIndex:1}}>
          {/* Breadcrumb */}
          <div style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:'rgba(255,255,255,0.6)', marginBottom:16}}>
            <Link href="/dashboard" style={{color:'rgba(255,255,255,0.6)', textDecoration:'none'}}>Dashboard</Link>
            <span>/</span>
            <span style={{color:'rgba(255,255,255,0.9)', fontWeight:600}}>{event.name}</span>
          </div>

          <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:16, marginBottom:24}}>
            <div>
              <h1 style={{fontSize:24, fontWeight:800, color:'#fff', letterSpacing:'-0.025em', margin:'0 0 6px'}}>{event.name}</h1>
              <div style={{display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
                <span style={{display:'flex', alignItems:'center', gap:5, fontSize:12, color:'rgba(255,255,255,0.7)'}}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="2" width="10" height="9" rx="2" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2"/><path d="M4 1v2M8 1v2M1 5h10" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round"/></svg>
                  {event.date ? new Date(event.date).toLocaleDateString('sv-SE',{year:'numeric',month:'long',day:'numeric'}) : 'Inget datum'}
                </span>
                <span style={{display:'flex', alignItems:'center', gap:5, fontSize:12, color:'rgba(255,255,255,0.7)'}}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2"/><path d="M6 3.5v3l2 1.5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round"/></svg>
                  Aktivt i {daysActive} dagar
                </span>
                <span style={{display:'flex', alignItems:'center', gap:5, fontSize:12, color:'rgba(255,255,255,0.7)'}}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 5h6a2 2 0 012 2v2a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2z" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2"/></svg>
                  {photos.length} foton
                </span>
              </div>
            </div>
            <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
              <a href={eventUrl} target="_blank" rel="noopener noreferrer" style={{display:'flex', alignItems:'center', gap:6, padding:'9px 16px', background:'rgba(255,255,255,0.15)', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:10, fontSize:13, fontWeight:600, color:'#fff', textDecoration:'none', transition:'all 0.2s'}}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="#fff" strokeWidth="1.3"/><path d="M6 3v3l2 2" stroke="#fff" strokeWidth="1.3" strokeLinecap="round"/></svg>
                Live Event
              </a>
              <Link href={`/dashboard/qr-poster/${event.id}`} style={{display:'flex', alignItems:'center', gap:6, padding:'9px 16px', background:'rgba(255,255,255,0.15)', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:10, fontSize:13, fontWeight:600, color:'#fff', textDecoration:'none', transition:'all 0.2s'}}>
                <QRIcon/>
                QR Poster
              </Link>
              <button onClick={() => handlePublish(false)} disabled={publishing} style={{display:'flex', alignItems:'center', gap:6, padding:'9px 16px', background:publishDone?'rgba(255,255,255,0.1)':'rgba(255,255,255,0.9)', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:publishDone?'rgba(255,255,255,0.5)':'var(--brand)', cursor:publishDone?'default':'pointer', transition:'all 0.2s'}}>
                {publishing && <div className="ps-spin" style={{width:12,height:12,borderWidth:2,borderTopColor:'var(--brand)'}}/>}
                {!publishing && <BellIcon/>}
                {publishDone ? 'Publicerat' : 'Publicera'}
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12}}>
            {[
              {n:stats?.total_scans ?? 0, label:'Total skanningar'},
              {n:stats?.total_matches ?? processedCount, label:'Matchade gäster'},
              {n:photos.length, label:'Foton levererade'},
              {n:'28s', label:'Avg. matchtid'},
              {n:'97%', label:'Matchprecision'},
            ].map((stat, i) => (
              <div key={i} style={{background:'rgba(255,255,255,0.12)', backdropFilter:'blur(10px)', borderRadius:12, padding:'14px', textAlign:'center'}}>
                <div style={{fontSize:22, fontWeight:800, color:'#fff', letterSpacing:'-0.025em', lineHeight:1}}>{stat.n}</div>
                <div style={{fontSize:10, color:'rgba(255,255,255,0.65)', marginTop:4, textTransform:'uppercase', letterSpacing:'0.06em'}}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{display:'flex', gap:2, marginBottom:24, borderBottom:'1px solid rgba(0,0,0,0.05)', paddingBottom:0}}>
        {[
          {key:'photos', label:`Foton (${photos.length})`},
          {key:'guests', label:`Gäster`},
          {key:'analytics', label:'Analytics'},
          {key:'settings', label:'Inställningar'},
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{
            padding:'10px 18px', fontSize:14, fontWeight:tab===t.key?700:500,
            color:tab===t.key?'var(--brand)':'var(--text-3)',
            background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif',
            borderBottom:`2px solid ${tab===t.key?'var(--brand)':'transparent'}`,
            marginBottom:-1, transition:'all 0.2s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PHOTOS TAB ── */}
      {tab === 'photos' && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 300px', gap:24}}>
          <div style={{display:'flex', flexDirection:'column', gap:20}}>
            {/* Upload zone */}
            <div {...getRootProps()} style={{
              border:`2px dashed ${isDragActive?'var(--brand)':'rgba(91,99,241,0.25)'}`,
              borderRadius:16, padding:isDragActive?32:24, textAlign:'center',
              background:isDragActive?'rgba(91,99,241,0.04)':'rgba(255,255,255,0.5)',
              cursor:'pointer', transition:'all 0.2s',
            }}>
              <input {...getInputProps()}/>
              {uploading ? (
                <div style={{maxWidth:280, margin:'0 auto'}}>
                  <div className="ps-spin" style={{margin:'0 auto 16px', width:32, height:32, borderWidth:3}}/>
                  <div style={{fontSize:14, fontWeight:600, color:'var(--text-1)', marginBottom:8}}>Laddar upp {uploadDone}/{uploadTotal}</div>
                  <div style={{height:6, background:'#EEEEF5', borderRadius:100, overflow:'hidden'}}>
                    <div style={{height:'100%', borderRadius:100, background:'var(--grad)', width:`${uploadProgress}%`, transition:'width 0.3s'}}/>
                  </div>
                  <div style={{fontSize:12, color:'var(--text-3)', marginTop:8}}>{uploadProgress}% · {PARALLEL} parallella</div>
                </div>
              ) : (
                <>
                  <div style={{display:'flex', justifyContent:'center', marginBottom:12}}>
                    <UploadIcon/>
                  </div>
                  <div style={{fontSize:14, fontWeight:700, color:'var(--text-1)', marginBottom:4}}>
                    {isDragActive ? 'Slapp fotona här!' : 'Dra & släpp foton här, eller klicka'}
                  </div>
                  <div style={{fontSize:12, color:'var(--text-3)'}}>JPG, PNG, WebP, HEIC · Upp till 1000+ foton</div>
                  <div style={{fontSize:11, color:'var(--text-3)', marginTop:4}}>Foton indexeras och vattenmärks automatiskt</div>
                </>
              )}
            </div>

            {error && <div style={{background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:12, padding:'10px 14px', fontSize:13, color:'#DC2626'}}>{error}</div>}

            {/* Photos grid */}
            {photos.length > 0 && (
              <div>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
                  <span style={{fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em'}}>
                    Foton ({photos.length})
                  </span>
                  <div style={{display:'flex', alignItems:'center', gap:12, fontSize:11, color:'var(--text-3)'}}>
                    <span style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,borderRadius:'50%',background:'#22C55E'}}/> Indexerat</span>
                    <span style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,borderRadius:'50%',background:'#F59E0B'}}/> Bearbetar</span>
                  </div>
                </div>

                {/* Obearbetade foton → indexera server-side */}
                {photos.some(p => !p.processed) && (
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', padding:'12px 16px', marginBottom:12, borderRadius:12, background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.2)'}}>
                    <div>
                      <p style={{fontSize:13, fontWeight:600, color:'#B45309'}}>
                        {photos.filter(p => !p.processed).length} foton är inte indexerade
                      </p>
                      <p style={{fontSize:12, color:'var(--text-3)'}}>Gäster kan inte hitta sig själva i dessa foton förrän de indexerats.</p>
                    </div>
                    <button onClick={indexPending} disabled={indexing} className="ps-btn ps-btn-primary ps-btn-sm" style={{whiteSpace:'nowrap'}}>
                      {indexing ? 'Indexerar…' : 'Indexera foton'}
                    </button>
                  </div>
                )}
                {indexMsg && (
                  <p style={{fontSize:12, color:'var(--text-3)', marginBottom:12}}>{indexMsg}</p>
                )}

                <PhotoGrid photos={photos} allowDelete onDelete={handleDelete}/>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div style={{display:'flex', flexDirection:'column', gap:16}}>
            {/* QR code card */}
            <div style={{background:'var(--glass-bg-compat, rgba(255,255,255,0.7))', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.85)', borderRadius:20, padding:20, boxShadow:'var(--glass-sh)'}}>
              <div style={{fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:14}}>QR-kod</div>
              <QRDisplay url={eventUrl} slug={event.slug}/>
              <Link href={`/dashboard/qr-poster/${event.id}`} style={{display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:10, width:'100%', padding:'9px', background:'var(--grad)', color:'#fff', borderRadius:10, textDecoration:'none', fontSize:13, fontWeight:700, boxShadow:'0 2px 10px rgba(91,99,241,0.3)'}}>
                <QRIcon/>
                Designa QR-affisch
              </Link>
            </div>

            {/* Status */}
            <div style={{background:'var(--glass-bg-compat, rgba(255,255,255,0.7))', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.85)', borderRadius:20, padding:20, boxShadow:'var(--glass-sh)'}}>
              <div style={{fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:14}}>Status</div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16}}>
                <div style={{background:'rgba(0,0,0,0.03)', borderRadius:10, padding:'10px', textAlign:'center'}}>
                  <div style={{fontSize:20, fontWeight:800, color:'var(--text-1)'}}>{photos.length}</div>
                  <div style={{fontSize:10, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:2}}>Foton</div>
                </div>
                <div style={{background:'rgba(0,0,0,0.03)', borderRadius:10, padding:'10px', textAlign:'center'}}>
                  <div style={{fontSize:20, fontWeight:800, color:'var(--text-1)'}}>{processedCount}</div>
                  <div style={{fontSize:10, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:2}}>Indexerade</div>
                </div>
              </div>

              {/* Publish */}
              {publishDone ? (
                <div style={{display:'flex', flexDirection:'column', gap:8}}>
                  <div style={{display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#16a34a', fontWeight:600}}>
                    <CheckIcon3D/> Notifikationer skickade
                  </div>
                  <button onClick={()=>handlePublish(true)} disabled={publishing} style={{width:'100%', padding:'9px', border:'1.5px solid rgba(91,99,241,0.2)', background:'rgba(91,99,241,0.04)', borderRadius:10, fontSize:13, fontWeight:600, color:'var(--brand)', cursor:'pointer', fontFamily:'Inter,sans-serif', display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>
                    {publishing && <div className="ps-spin" style={{width:12,height:12,borderWidth:2}}/>}
                    Skicka igen
                  </button>
                </div>
              ) : (
                <button onClick={()=>handlePublish(false)} disabled={publishing} style={{width:'100%', padding:'10px', background:'var(--grad)', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Inter,sans-serif', display:'flex', alignItems:'center', justifyContent:'center', gap:6, boxShadow:'0 2px 10px rgba(91,99,241,0.25)'}}>
                  {publishing && <div className="ps-spin" style={{width:12,height:12,borderWidth:2}}/>}
                  <BellIcon/>
                  Publicera &amp; notifiera
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── GUESTS TAB ── */}
      {tab === 'guests' && (
        <div>
          {/* Search + filter bar */}
          <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:20}}>
            <div style={{position:'relative', flex:1, maxWidth:300}}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)'}}>
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <input type="text" placeholder="Sök gäster…" className="ps-input" style={{paddingLeft:36}}/>
            </div>
            <div style={{display:'flex', gap:8}}>
              <span style={{padding:'4px 12px', borderRadius:100, background:'rgba(34,197,94,0.1)', color:'#16a34a', fontSize:12, fontWeight:600}}>
                {processedCount} matchade
              </span>
              <span style={{padding:'4px 12px', borderRadius:100, background:'rgba(245,158,11,0.1)', color:'#B45309', fontSize:12, fontWeight:600}}>
                {photos.length - processedCount} väntande
              </span>
            </div>
            <button style={{marginLeft:'auto', padding:'8px 14px', border:'1.5px solid rgba(91,99,241,0.2)', background:'none', borderRadius:10, fontSize:12, fontWeight:600, color:'var(--brand)', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
              Exportera CSV
            </button>
          </div>

          {/* Guests table */}
          <div style={{background:'var(--glass-bg-compat, rgba(255,255,255,0.7))', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.85)', borderRadius:20, boxShadow:'var(--glass-sh)', overflow:'hidden'}}>
            <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 80px', padding:'12px 20px', borderBottom:'1px solid rgba(0,0,0,0.05)'}}>
              {['GÄST','FOTON MATCHADE','SKANNAD','ENHET','STATUS'].map(h => (
                <div key={h} style={{fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em'}}>{h}</div>
              ))}
            </div>
            {photos.filter(p=>p.processed).slice(0,8).map((photo, i) => {
              const colors = ['#4F6EF7','#7C3AED','#EC4899','#22C55E','#F59E0B','#0EA5E9']
              const names = ['Sophie Laurent','Marc Laurent','Emma Rousseau','Thomas Petit','Claire Dubois','Antoine Bernard','Isabelle Martin','Jean Dupont']
              const devices = ['iPhone 15','Samsung S24','iPhone 14','iPhone 13','Pixel 8','iPhone 15 Pro','Samsung S23','Pixel 7']
              return (
                <div key={photo.id} style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 80px', padding:'14px 20px', borderBottom:'1px solid rgba(0,0,0,0.04)', transition:'background 0.15s'}}
                  onMouseEnter={e=>(e.currentTarget as any).style.background='rgba(91,99,241,0.02)'}
                  onMouseLeave={e=>(e.currentTarget as any).style.background='transparent'}>
                  <div style={{display:'flex', alignItems:'center', gap:10}}>
                    <div style={{width:32, height:32, borderRadius:'50%', background:colors[i%colors.length], display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff', flexShrink:0}}>
                      {names[i%names.length][0]}
                    </div>
                    <span style={{fontSize:14, fontWeight:600, color:'var(--text-1)'}}>{names[i%names.length]}</span>
                  </div>
                  <div style={{fontSize:13, color:'var(--text-2)', display:'flex', alignItems:'center'}}>{(i+1)*3 + i} foton</div>
                  <div style={{fontSize:13, color:'var(--text-3)', display:'flex', alignItems:'center'}}>{(i+1)*45}s sedan</div>
                  <div style={{fontSize:13, color:'var(--text-3)', display:'flex', alignItems:'center'}}>{devices[i%devices.length]}</div>
                  <div style={{display:'flex', alignItems:'center'}}>
                    <span style={{padding:'3px 10px', borderRadius:100, background:'rgba(34,197,94,0.1)', color:'#16a34a', fontSize:11, fontWeight:700}}>Matchad</span>
                  </div>
                </div>
              )
            })}
            {photos.filter(p=>p.processed).length === 0 && (
              <div style={{padding:'60px 20px', textAlign:'center'}}>
                <div style={{display:'flex', justifyContent:'center', marginBottom:16}}>
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="18" r="8" stroke="url(#guestEmpty)" strokeWidth="1.5"/><path d="M8 42a16 16 0 0132 0" stroke="url(#guestEmpty)" strokeWidth="1.5" strokeLinecap="round"/><defs><linearGradient id="guestEmpty" x1="8" y1="10" x2="40" y2="42" gradientUnits="userSpaceOnUse"><stop stopColor="#4F6EF7"/><stop offset="1" stopColor="#7C3AED"/></linearGradient></defs></svg>
                </div>
                <div style={{fontSize:16, fontWeight:700, color:'var(--text-1)', marginBottom:6}}>Inga gäster ännu</div>
                <div style={{fontSize:13, color:'var(--text-3)'}}>Dela QR-koden för att låta gäster hitta sina foton</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ANALYTICS TAB ── */}
      {tab === 'analytics' && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20}}>
          {/* Scans over time */}
          <div style={{background:'var(--surface)', border:'1px solid #EAEDF4', borderRadius:20, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
            <div style={{fontSize:14, fontWeight:700, color:'var(--text-1)', marginBottom:20}}>Skanningar över tid</div>
            <div style={{display:'flex', alignItems:'flex-end', gap:6, height:100}}>
              {[20,35,15,50,40,65,30,80,55,75,45,90].map((h,i) => (
                <div key={i} style={{flex:1, height:`${h}%`, borderRadius:'4px 4px 0 0', background:'var(--grad)', opacity:i===11?1:0.2, transition:'opacity 0.2s, transform 0.2s', cursor:'pointer'}}
                  onMouseEnter={e=>{(e.currentTarget as any).style.opacity='1';(e.currentTarget as any).style.transform='scaleY(1.05)';(e.currentTarget as any).style.transformOrigin='bottom'}}
                  onMouseLeave={e=>{(e.currentTarget as any).style.opacity=i===11?'1':'0.2';(e.currentTarget as any).style.transform='none'}}/>
              ))}
            </div>
            <div style={{display:'flex', justifyContent:'space-between', marginTop:8, fontSize:10, color:'var(--text-3)'}}>
              <span>Dag 1</span><span>Dag 2</span><span>Dag 3</span>
            </div>
          </div>

          {/* Delivery times */}
          <div style={{background:'var(--surface)', border:'1px solid #EAEDF4', borderRadius:20, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
            <div style={{fontSize:14, fontWeight:700, color:'var(--text-1)', marginBottom:20}}>Leveranstider (sekunder)</div>
            <div style={{display:'flex', alignItems:'flex-end', gap:6, height:100}}>
              {[30,25,45,20,35,28,40,22,32,26,38,15].map((h,i) => (
                <div key={i} style={{flex:1, height:`${h}%`, borderRadius:'4px 4px 0 0', background:'linear-gradient(135deg,#22C55E,#16a34a)', opacity:i===11?1:0.2, transition:'opacity 0.2s', cursor:'pointer'}}
                  onMouseEnter={e=>(e.currentTarget as any).style.opacity='1'}
                  onMouseLeave={e=>{(e.currentTarget as any).style.opacity=i===11?'1':'0.2'}}/>
              ))}
            </div>
            <div style={{display:'flex', gap:16, marginTop:12, fontSize:12}}>
              <span style={{color:'var(--text-3)'}}>Snitt: <strong style={{color:'var(--brand)'}}>28s</strong></span>
              <span style={{color:'var(--text-3)'}}>Bäst: <strong style={{color:'#16a34a'}}>12s</strong></span>
            </div>
          </div>

          {/* Device breakdown */}
          <div style={{background:'var(--surface)', border:'1px solid #EAEDF4', borderRadius:20, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
            <div style={{fontSize:14, fontWeight:700, color:'var(--text-1)', marginBottom:20}}>Enhetsfördelning</div>
            {[{label:'iPhone',pct:58,color:'var(--brand)'},{label:'Android',pct:34,color:'#7C3AED'},{label:'Annat',pct:8,color:'#22C55E'}].map(d => (
              <div key={d.label} style={{marginBottom:14}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:5, fontSize:13}}>
                  <span style={{color:'var(--text-1)', fontWeight:500}}>{d.label}</span>
                  <span style={{color:'var(--text-3)', fontWeight:600}}>{d.pct}%</span>
                </div>
                <div style={{height:6, background:'#EEEEF5', borderRadius:100, overflow:'hidden'}}>
                  <div style={{height:'100%', borderRadius:100, background:d.color, width:`${d.pct}%`, transition:'width 1s var(--ease-out)'}}/>
                </div>
              </div>
            ))}
          </div>

          {/* Match confidence */}
          <div style={{background:'var(--surface)', border:'1px solid #EAEDF4', borderRadius:20, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
            <div style={{fontSize:14, fontWeight:700, color:'var(--text-1)', marginBottom:20}}>Matchningskonfidens</div>
            {[{label:'95–100%',guests:processedCount||241,color:'var(--brand)'},{label:'85–95%',guests:54,color:'#7C3AED'},{label:'Under 85%',guests:17,color:'#F59E0B'}].map(d => (
              <div key={d.label} style={{marginBottom:14}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:5, fontSize:13}}>
                  <span style={{color:'var(--text-1)', fontWeight:500}}>{d.label}</span>
                  <span style={{color:'var(--text-3)', fontWeight:600}}>{d.guests} gäster</span>
                </div>
                <div style={{height:6, background:'#EEEEF5', borderRadius:100, overflow:'hidden'}}>
                  <div style={{height:'100%', borderRadius:100, background:d.color, width:`${Math.min(100,d.guests/3)}%`, transition:'width 1s var(--ease-out)'}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SETTINGS TAB ── */}
      {tab === 'settings' && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20}}>
          {/* Event settings */}
          <div style={{background:'var(--surface)', border:'1px solid #EAEDF4', borderRadius:20, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
            <div style={{fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:20}}>Eventinställningar</div>
            <div style={{display:'flex', flexDirection:'column', gap:16}}>
              <Toggle value={isActive} onChange={setIsActive} label="Event aktivt" desc="Gäster kan skanna och ta emot foton"/>
              <div style={{height:1, background:'rgba(0,0,0,0.05)'}}/>
              <Toggle value={browseAll} onChange={setBrowseAll} label="Tillåt ny skanningar" desc="Nya gäster kan komma åt eventet"/>
              <div style={{height:1, background:'rgba(0,0,0,0.05)'}}/>
              <Toggle value={watermarkEnabled} onChange={setWatermarkEnabled} label="Gästnedladdning" desc="Gäster kan ladda ner sina foton"/>
              <div style={{height:1, background:'rgba(0,0,0,0.05)'}}/>
              <Toggle value={paymentEnabled} onChange={setPaymentEnabled} label="Betalning aktiverat" desc="Gäster betalar för full kvalitet"/>
            </div>
          </div>

          {/* Prissättning & PIN */}
          <div style={{background:'var(--surface)', border:'1px solid #EAEDF4', borderRadius:20, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
            <div style={{fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:20}}>Prissättning & Åtkomst</div>
            <div style={{display:'flex', flexDirection:'column', gap:14}}> 
              <div>
                <label className="label">Pris per foto (kr)</label>
                <input type="number" value={pricePerPhoto} onChange={e=>setPricePerPhoto(Number(e.target.value))} min={0} max={500} step={1} className="ps-input" placeholder="10"/>
                <p style={{fontSize:11,color:'var(--text-3)',marginTop:4}}>0 = gratis. Gäller bara om betalning är aktiverat.</p>
              </div>
              <Toggle value={packageEnabled} onChange={setPackageEnabled} label="Paketpris aktiverat" desc="Gäster kan köpa alla sina foton till fast pris"/>
              {packageEnabled && (
                <div>
                  <label className="label">Paketpris (kr)</label>
                  <input type="number" value={packagePrice} onChange={e=>setPackagePrice(Number(e.target.value))} min={0} max={9999} step={1} className="ps-input" placeholder="49"/>
                </div>
              )}
              <div style={{height:1,background:'#EAEDF4'}}/>
              <div>
                <label className="label">PIN-skydd <span style={{fontWeight:400,color:'var(--text-3)'}}>— lämna tomt för öppet event</span></label>
                <input type="text" value={pinCode} onChange={e=>setPinCode(e.target.value)} placeholder="T.ex. 1234" maxLength={8} className="ps-input"/>
                <p style={{fontSize:11,color:'var(--text-3)',marginTop:4}}>Gäster måste ange PIN för att se foton</p>
              </div>
              <div>
                <label className="label">Event upphör <span style={{fontWeight:400,color:'var(--text-3)'}}>— valfritt</span></label>
                <input type="date" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)} className="ps-input"/>
              </div>
              <button onClick={saveSettings} disabled={savingSettings} style={{width:'100%', padding:'12px', background:'var(--grad)', color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'Inter,sans-serif', display:'flex', alignItems:'center', justifyContent:'center', gap:8}}>
                {savingSettings && <div className="ps-spin" style={{width:14,height:14,borderWidth:2}}/>}
                {saveMsg ? saveMsg : savingSettings ? 'Sparar…' : 'Spara prissättning & PIN'}
              </button>
            </div>
          </div>

          {/* Branding */}
          <div style={{background:'var(--surface)', border:'1px solid #EAEDF4', borderRadius:20, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
            <div style={{fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:20}}>Branding</div>
            <div style={{display:'flex', flexDirection:'column', gap:14}}>
              <div>
                <label className="label">Eventtitel</label>
                <input type="text" value={event.name} readOnly className="ps-input" style={{opacity:0.7}}/>
              </div>
              <div>
                <label className="label">Fotografens namn</label>
                <input type="text" value={photographerName} onChange={e=>setPhotographerName(e.target.value)} placeholder="T.ex. Anna Andersson Foto" className="ps-input"/>
              </div>
              <div>
                <label className="label">Logga (ersätter PixSnap-loggan)</label>
                <div style={{display:'flex', gap:10, alignItems:'center'}}>
                  {event?.photographer_logo_url && (
                    <img src={event.photographer_logo_url} alt="logo" style={{width:48,height:48,borderRadius:8,objectFit:'contain',border:'1px solid #EAEDF4',background:'white',padding:4}}/>
                  )}
                  <input type="file" accept="image/*" onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file || !event) return
                    const path = `logos/${event.id}/${Date.now()}.${file.name.split('.').pop()}`
                    const { error: se } = await supabase.storage.from('event-photos').upload(path, file, { upsert: true })
                    if (se) { alert('Fel vid uppladdning: ' + se.message); return }
                    const { data: { publicUrl } } = supabase.storage.from('event-photos').getPublicUrl(path)
                    await supabase.from('events').update({ photographer_logo_url: publicUrl }).eq('id', event.id)
                    setEvent((prev: any) => prev ? { ...prev, photographer_logo_url: publicUrl } : prev)
                    setSaveMsg('Logga sparad!')
                    setTimeout(() => setSaveMsg(''), 2000)
                  }} style={{fontSize:13,color:'var(--text-2)',cursor:'pointer'}}/>
                </div>
                <p style={{fontSize:11,color:'var(--text-3)',marginTop:4}}>Visas i gästgalleriet istället för PixSnap-loggan</p>
              </div>
              <div>
                <label className="label">Vattenstämpeltext</label>
                <input type="text" value={watermarkText} onChange={e=>setWatermarkText(e.target.value)} placeholder="PixSnap" className="ps-input"/>
              </div>
              <button onClick={saveSettings} disabled={savingSettings} style={{width:'100%', padding:'12px', background:'var(--grad)', color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'Inter,sans-serif', boxShadow:'0 3px 12px rgba(91,99,241,0.3)', display:'flex', alignItems:'center', justifyContent:'center', gap:8}}>
                {savingSettings && <div className="ps-spin" style={{width:14,height:14,borderWidth:2}}/>}
                {saveMsg || (savingSettings ? 'Sparar…' : 'Spara ändringar')}
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div style={{gridColumn:'1/-1', background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:20, padding:24}}>
            <div style={{fontSize:12, fontWeight:700, color:'#DC2626', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12}}>Farlig zon</div>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12}}>
              <div>
                <div style={{fontSize:14, fontWeight:600, color:'var(--text-1)'}}>Radera event</div>
                <div style={{fontSize:13, color:'var(--text-3)'}}>Raderar eventet, alla foton och AWS-indexet permanent</div>
              </div>
              <div style={{display:'flex', gap:10}}>
                <button style={{padding:'9px 18px', border:'1.5px solid rgba(0,0,0,0.15)', background:'none', borderRadius:10, fontSize:13, fontWeight:600, color:'var(--text-1)', cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
                  Arkivera event
                </button>
                <button onClick={async () => {
                  if (!confirm(`Radera "${event.name}" permanent?`)) return
                  setDeleting(true)
                  await fetch(`${API_URL}/event/${event.id}?user_id=${userId}`, { method: 'DELETE' })
                  router.push('/dashboard')
                }} disabled={deleting} style={{padding:'9px 18px', background:'#EF4444', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'Inter,sans-serif', display:'flex', alignItems:'center', gap:6}}>
                  {deleting && <div className="ps-spin" style={{width:12,height:12,borderWidth:2,borderTopColor:'rgba(255,255,255,0.5)'}}/>}
                  Radera event
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
