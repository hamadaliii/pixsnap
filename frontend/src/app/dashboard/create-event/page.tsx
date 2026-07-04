'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { generateSlug } from '@/lib/utils'

// 3D camera SVG miniature
const Camera3D = () => (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
    <ellipse cx="40" cy="70" rx="28" ry="6" fill="rgba(91,99,241,0.15)"/>
    <rect x="12" y="26" width="56" height="36" rx="8" fill="url(#camBody)"/>
    <rect x="16" y="22" width="20" height="8" rx="4" fill="url(#camTop)"/>
    <circle cx="40" cy="44" r="12" fill="#1E1B4B"/>
    <circle cx="40" cy="44" r="9" fill="url(#lens)"/>
    <circle cx="40" cy="44" r="5" fill="#0F0C29"/>
    <circle cx="37" cy="41" r="2" fill="rgba(255,255,255,0.4)"/>
    <rect x="56" y="28" width="8" height="5" rx="2" fill="url(#flash)"/>
    <rect x="18" y="29" width="12" height="8" rx="2" fill="rgba(255,255,255,0.1)"/>
    <defs>
      <linearGradient id="camBody" x1="12" y1="26" x2="68" y2="62" gradientUnits="userSpaceOnUse">
        <stop stopColor="#374151"/>
        <stop offset="1" stopColor="#1F2937"/>
      </linearGradient>
      <linearGradient id="camTop" x1="16" y1="22" x2="36" y2="30" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4B5563"/>
        <stop offset="1" stopColor="#374151"/>
      </linearGradient>
      <radialGradient id="lens" cx="40%" cy="35%" r="60%">
        <stop stopColor="#4F6EF7" stopOpacity="0.8"/>
        <stop offset="1" stopColor="#2D2A6E"/>
      </radialGradient>
      <linearGradient id="flash" x1="56" y1="28" x2="64" y2="33" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FDE68A"/>
        <stop offset="1" stopColor="#F59E0B"/>
      </linearGradient>
    </defs>
  </svg>
)

// 3D phone SVG
const Phone3D = () => (
  <svg width="60" height="80" viewBox="0 0 60 80" fill="none">
    <ellipse cx="30" cy="76" rx="18" ry="4" fill="rgba(91,99,241,0.12)"/>
    <rect x="6" y="4" width="48" height="68" rx="10" fill="url(#phoneBg)"/>
    <rect x="10" y="10" width="40" height="56" rx="6" fill="url(#phoneScreen)"/>
    <rect x="22" y="6" width="16" height="4" rx="2" fill="rgba(91,99,241,0.3)"/>
    <rect x="16" y="18" width="28" height="4" rx="2" fill="rgba(91,99,241,0.3)"/>
    <rect x="16" y="26" width="20" height="3" rx="1.5" fill="rgba(91,99,241,0.2)"/>
    <circle cx="30" cy="45" r="10" fill="rgba(34,197,94,0.15)"/>
    <circle cx="30" cy="45" r="7" fill="rgba(34,197,94,0.25)"/>
    <path d="M26 45l3 3 5-5" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="22" y="60" width="16" height="3" rx="1.5" fill="rgba(255,255,255,0.2)"/>
    <defs>
      <linearGradient id="phoneBg" x1="6" y1="4" x2="54" y2="72" gradientUnits="userSpaceOnUse">
        <stop stopColor="#E8EFFE"/>
        <stop offset="1" stopColor="#C7D0F8"/>
      </linearGradient>
      <linearGradient id="phoneScreen" x1="10" y1="10" x2="50" y2="66" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F7F8FF"/>
        <stop offset="1" stopColor="#EEF0FF"/>
      </linearGradient>
    </defs>
  </svg>
)

// 3D star/sparkle
const Sparkle3D = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" fill="url(#sparkleGrad)"/>
    <defs>
      <linearGradient id="sparkleGrad" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4F6EF7"/>
        <stop offset="1" stopColor="#7C3AED"/>
      </linearGradient>
    </defs>
  </svg>
)

const EVENT_TYPES = ['Bröllop', 'Företagsevent', 'Examen', 'Födelsedag', 'Festival', 'Löpning', 'Privat event', 'Annat']

export default function CreateEventPage() {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [eventType, setEventType] = useState('')
  const [date, setDate] = useState('')
  const [location, setLocation] = useState('')
  const [privacy, setPrivacy] = useState<'open' | 'pin'>('open')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const slug = generateSlug(name)
    const { data, error } = await supabase.from('events').insert({
      name, date: date || null, slug, created_by: user.id,
      description: eventType ? `Typ: ${eventType}${location ? ` · ${location}` : ''}` : (location || null),
    }).select().single()

    if (error) {
      const msg = error.message.includes('PIXSNAP_QUOTA:')
        ? error.message.split('PIXSNAP_QUOTA:')[1].trim()
        : error.message
      setError(msg); setLoading(false)
    }
    else router.push(`/dashboard/admin/${data.id}`)
  }

  const dateLabel = date ? new Date(date).toLocaleDateString('sv-SE', { year:'numeric', month:'long', day:'numeric' }) : null

  return (
    <>
      <div style={{
        minHeight:'100vh', display:'flex', flexDirection:'column', gap:0,
        fontFamily:'Inter,sans-serif',
      }}>
        {/* Top breadcrumb */}
        <div style={{padding:'16px 0 0 0', display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--text-3)', marginBottom:24}}>
          <Link href="/dashboard" style={{color:'var(--text-3)', textDecoration:'none'}}>← Dashboard</Link>
          <span>/</span>
          <span style={{color:'var(--text-1)', fontWeight:600}}>Skapa event</span>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 340px', gap:32, alignItems:'start'}}>
          {/* LEFT FORM */}
          <div>
            <div style={{marginBottom:32}}>
              <h1 style={{fontSize:28, fontWeight:800, color:'var(--text-1)', letterSpacing:'-0.025em', marginBottom:6}}>
                Skapa nytt event
              </h1>
              <p style={{fontSize:15, color:'var(--text-2)', lineHeight:1.6}}>
                Sätt upp ditt event på några minuter och börja leverera foton till dina gäster.
              </p>
            </div>

            <form onSubmit={handleCreate} style={{display:'flex', flexDirection:'column', gap:24}}>
              {/* Event Information */}
              <div style={{background:'var(--glass-bg)', backdropFilter:'var(--glass-blur)', border:'var(--glass-border)', borderRadius:20, padding:24, boxShadow:'var(--glass-shadow)'}}>
                <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:20}}>
                  <div style={{width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,rgba(91,99,241,0.12),rgba(124,58,237,0.08))', display:'flex', alignItems:'center', justifyContent:'center'}}>
                    <Camera3D />
                  </div>
                  <span style={{fontSize:13, fontWeight:700, color:'var(--text-1)', letterSpacing:'0.05em', textTransform:'uppercase'}}>
                    Eventinformation
                  </span>
                </div>

                <div style={{display:'flex', flexDirection:'column', gap:16}}>
                  <div>
                    <label className="label">Eventnamn *</label>
                    <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="t.ex. Laurent Wedding · Paris" className="ps-input" required/>
                  </div>

                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
                    <div>
                      <label className="label">Eventtyp</label>
                      <select value={eventType} onChange={e=>setEventType(e.target.value)} className="ps-input" style={{cursor:'pointer'}}>
                        <option value="">Välj typ</option>
                        {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Datum *</label>
                      <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="ps-input" required/>
                    </div>
                  </div>

                  <div>
                    <label className="label">Plats</label>
                    <input type="text" value={location} onChange={e=>setLocation(e.target.value)} placeholder="t.ex. Grand Ballroom, Paris" className="ps-input"/>
                  </div>
                </div>
              </div>

              {/* Privacy */}
              <div style={{background:'var(--glass-bg)', backdropFilter:'var(--glass-blur)', border:'var(--glass-border)', borderRadius:20, padding:24, boxShadow:'var(--glass-shadow)'}}>
                <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:20}}>
                  <div style={{width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center'}}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="8" r="4" stroke="url(#privG)" strokeWidth="1.5"/><path d="M3 18a7 7 0 0114 0" stroke="url(#privG)" strokeWidth="1.5" strokeLinecap="round"/><defs><linearGradient id="privG" x1="3" y1="3" x2="17" y2="18" gradientUnits="userSpaceOnUse"><stop stopColor="#4F6EF7"/><stop offset="1" stopColor="#7C3AED"/></linearGradient></defs></svg>
                  </div>
                  <span style={{fontSize:13, fontWeight:700, color:'var(--text-1)', letterSpacing:'0.05em', textTransform:'uppercase'}}>Sekretess</span>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                  {[
                    {val:'open', title:'Öppet', sub:'Alla med QR kan komma åt'},
                    {val:'pin', title:'PIN-skyddat', sub:'Gäster anger ett lösenord'},
                  ].map(opt => (
                    <button key={opt.val} type="button" onClick={()=>setPrivacy(opt.val as any)} style={{
                      padding:'16px', borderRadius:14, textAlign:'left', cursor:'pointer',
                      border:`2px solid ${privacy===opt.val ? 'var(--brand)' : 'rgba(220,225,250,0.9)'}`,
                      background: privacy===opt.val ? 'rgba(91,99,241,0.06)' : 'rgba(255,255,255,0.7)',
                      transition:'all 0.2s',
                    }}>
                      <div style={{fontSize:14, fontWeight:700, color:'var(--text-1)', marginBottom:4}}>{opt.title}</div>
                      <div style={{fontSize:12, color:'var(--text-3)'}}>{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {error && <div style={{background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:12, padding:'12px 16px', fontSize:13, color:'#DC2626'}}>{error}</div>}

              <div style={{display:'flex', gap:12}}>
                <button type="submit" disabled={loading || !name || !date} style={{
                  flex:1, padding:'14px', background:'var(--grad)', color:'#fff',
                  fontSize:15, fontWeight:700, border:'none', borderRadius:14, cursor:'pointer',
                  fontFamily:'Inter,sans-serif', boxShadow:'0 4px 20px rgba(91,99,241,0.3)',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  opacity:(!name || !date) ? 0.5 : 1, transition:'all 0.2s',
                }}>
                  {loading && <div className="ps-spin" style={{width:16, height:16, borderWidth:2}}/>}
                  {loading ? 'Skapar…' : 'Skapa event →'}
                </button>
                <Link href="/dashboard" style={{
                  padding:'14px 20px', border:'1.5px solid rgba(220,225,250,0.9)',
                  borderRadius:14, fontSize:14, fontWeight:600, color:'var(--text-2)',
                  textDecoration:'none', display:'flex', alignItems:'center',
                  background:'rgba(255,255,255,0.7)', transition:'all 0.2s',
                }}>
                  Avbryt
                </Link>
              </div>
            </form>
          </div>

          {/* RIGHT PREVIEW */}
          <div style={{position:'sticky', top:24}}>
            {/* Live QR preview card */}
            <div style={{background:'var(--glass-bg)', backdropFilter:'var(--glass-blur)', border:'var(--glass-border)', borderRadius:20, boxShadow:'var(--glass-shadow)', overflow:'hidden', marginBottom:16}}>
              <div style={{padding:'16px 20px', borderBottom:'1px solid rgba(0,0,0,0.05)', fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em'}}>
                Förhandsvisning
              </div>
              {/* Mini poster preview */}
              <div style={{background:'linear-gradient(135deg,#4F6EF7,#7C3AED)', padding:'24px', textAlign:'center', position:'relative', overflow:'hidden'}}>
                <div style={{position:'absolute',top:-20,right:-20,width:80,height:80,borderRadius:'50%',background:'rgba(255,255,255,0.08)'}}/>
                <div style={{display:'flex', justifyContent:'center', marginBottom:12}}>
                  <div style={{width:48, height:48, display:'flex', alignItems:'center', justifyContent:'center'}}>
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M16 3L3 10v12l13 7 13-7V10L16 3z" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="16" cy="16" r="4" fill="#fff"/></svg>
                  </div>
                </div>
                <div style={{fontSize:11, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.6)', marginBottom:6}}>PixSnap</div>
                <div style={{fontSize:16, fontWeight:800, color:'#fff', marginBottom:4, minHeight:24}}>
                  {name || 'Ditt eventnamn'}
                </div>
                {(dateLabel || location) && (
                  <div style={{fontSize:12, color:'rgba(255,255,255,0.65)'}}>
                    {dateLabel}{location ? ` · ${location}` : ''}
                  </div>
                )}
                {/* Mock QR */}
                <div style={{width:80, height:80, margin:'16px auto 0', background:'white', borderRadius:8, padding:8, display:'flex', alignItems:'center', justifyContent:'center'}}>
                  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                    <rect x="2" y="2" width="26" height="26" rx="4" stroke="#4F6EF7" strokeWidth="2"/>
                    <rect x="6" y="6" width="18" height="18" rx="2" fill="rgba(91,99,241,0.15)"/>
                    <rect x="36" y="2" width="26" height="26" rx="4" stroke="#7C3AED" strokeWidth="2"/>
                    <rect x="40" y="6" width="18" height="18" rx="2" fill="rgba(124,58,237,0.15)"/>
                    <rect x="2" y="36" width="26" height="26" rx="4" stroke="#4F6EF7" strokeWidth="2"/>
                    <rect x="6" y="40" width="18" height="18" rx="2" fill="rgba(91,99,241,0.15)"/>
                    <rect x="36" y="36" width="6" height="6" fill="#4F6EF7"/>
                    <rect x="44" y="36" width="6" height="6" fill="#7C3AED"/>
                    <rect x="52" y="36" width="10" height="6" fill="#4F6EF7"/>
                    <rect x="36" y="44" width="6" height="6" fill="#7C3AED"/>
                    <rect x="44" y="44" width="6" height="6" fill="#4F6EF7"/>
                    <rect x="52" y="44" width="10" height="6" fill="#7C3AED"/>
                    <rect x="36" y="52" width="26" height="10" fill="rgba(91,99,241,0.2)"/>
                  </svg>
                </div>
                <div style={{fontSize:11, color:'rgba(255,255,255,0.5)', marginTop:10}}>QR genereras automatiskt</div>
              </div>
              <div style={{padding:'12px 20px'}}>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                  {[
                    {label:'Status', value:'Utkast', color:'var(--warning)'},
                    {label:'Foton', value:'0 uppladdade', color:'var(--text-3)'},
                    {label:'Sekretess', value:privacy==='open'?'Öppet':'PIN-skyddat', color:'var(--text-3)'},
                    {label:'QR-länk', value:'Skapas vid publicering', color:'var(--text-3)'},
                  ].map(s => (
                    <div key={s.label} style={{padding:'8px 10px', background:'rgba(0,0,0,0.03)', borderRadius:8}}>
                      <div style={{fontSize:10, color:'var(--text-3)', marginBottom:2, textTransform:'uppercase', letterSpacing:'0.06em'}}>{s.label}</div>
                      <div style={{fontSize:12, fontWeight:600, color:s.color}}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tips */}
            <div style={{background:'rgba(91,99,241,0.05)', border:'1px solid rgba(91,99,241,0.1)', borderRadius:16, padding:20}}>
              <div style={{fontSize:12, fontWeight:700, color:'var(--brand)', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.08em'}}>
                Tips för bästa resultat
              </div>
              {[
                'Ladda upp foton i hög upplösning',
                'Aktivera vattenstämpel för gratisnedladdningar',
                'Dela QR-koden via affisch eller digitalt',
              ].map((tip, i) => (
                <div key={i} style={{display:'flex', alignItems:'flex-start', gap:8, marginBottom:8, fontSize:13, color:'var(--text-2)', lineHeight:1.5}}>
                  <div style={{width:18, height:18, borderRadius:'50%', background:'var(--grad)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1}}>
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2 3-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  {tip}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
