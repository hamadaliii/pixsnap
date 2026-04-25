'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'
import { getEventUrl } from '@/lib/utils'
import type { Event } from '@/types'

type Template = 'gradient' | 'white' | 'dark' | 'blush'
const ACCENT_COLORS = ['#4F6EF7','#7C3AED','#EC4899','#F59E0B','#22C55E','#0EA5E9']

// 3D QR icon miniature
const QRMini = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <rect x="2" y="2" width="16" height="16" rx="3" stroke="url(#qrG)" strokeWidth="2"/>
    <rect x="5" y="5" width="10" height="10" rx="1" fill="url(#qrG)" opacity="0.3"/>
    <rect x="22" y="2" width="16" height="16" rx="3" stroke="url(#qrG)" strokeWidth="2"/>
    <rect x="25" y="5" width="10" height="10" rx="1" fill="url(#qrG)" opacity="0.3"/>
    <rect x="2" y="22" width="16" height="16" rx="3" stroke="url(#qrG)" strokeWidth="2"/>
    <rect x="5" y="25" width="10" height="10" rx="1" fill="url(#qrG)" opacity="0.3"/>
    <rect x="22" y="22" width="5" height="5" fill="url(#qrG)"/>
    <rect x="29" y="22" width="5" height="5" fill="url(#qrG)"/>
    <rect x="35" y="22" width="3" height="5" fill="url(#qrG)"/>
    <rect x="22" y="29" width="5" height="5" fill="url(#qrG)"/>
    <rect x="29" y="29" width="5" height="5" fill="url(#qrG)"/>
    <rect x="35" y="29" width="3" height="9" fill="url(#qrG)"/>
    <defs>
      <linearGradient id="qrG" x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4F6EF7"/>
        <stop offset="1" stopColor="#7C3AED"/>
      </linearGradient>
    </defs>
  </svg>
)

// Steps figure SVG
const StepsFigure = () => (
  <svg width="180" height="40" viewBox="0 0 180 40" fill="none">
    {[
      {x:0, label:'1', text:'Skanna QR'},
      {x:60, label:'2', text:'Ta selfie'},
      {x:120, label:'3', text:'Se foton'},
    ].map(step => (
      <g key={step.x}>
        <circle cx={step.x+16} cy={16} r={12} fill="url(#stepG)"/>
        <text x={step.x+16} y={21} textAnchor="middle" fill="white" fontSize="10" fontWeight="700" fontFamily="Outfit,sans-serif">{step.label}</text>
        <text x={step.x+16} y={36} textAnchor="middle" fill="#666" fontSize="9" fontFamily="Outfit,sans-serif">{step.text}</text>
        {step.x < 120 && <line x1={step.x+30} y1={16} x2={step.x+58} y2={16} stroke="url(#stepG)" strokeWidth="1.5" strokeDasharray="3 2"/>}
      </g>
    ))}
    <defs>
      <linearGradient id="stepG" x1="0" y1="0" x2="180" y2="0" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4F6EF7"/>
        <stop offset="1" stopColor="#7C3AED"/>
      </linearGradient>
    </defs>
  </svg>
)

function PosterPreview({ template, eventName, dateStr, qrDataUrl, accentColor }: {
  template: Template, eventName: string, dateStr: string, qrDataUrl: string, accentColor: string
}) {
  const isGradient = template === 'gradient'
  const isDark = template === 'dark'
  const isBlush = template === 'blush'
  const isWhite = template === 'white'

  const bg = isGradient ? `linear-gradient(135deg, ${accentColor} 0%, #7C3AED 100%)` :
             isDark ? '#0D0E1A' :
             isBlush ? '#FFF0F8' :
             '#FFFFFF'
  const headingColor = (isGradient || isDark) ? '#fff' : '#0D0E1A'
  const subColor = (isGradient || isDark) ? 'rgba(255,255,255,0.7)' : '#5A5F7A'
  const qrBg = (isGradient || isDark) ? 'rgba(255,255,255,0.95)' : isBlush ? '#fff' : '#F7F8FF'
  const footerColor = (isGradient || isDark) ? 'rgba(255,255,255,0.4)' : '#8B90A8'

  return (
    <div style={{background:bg, borderRadius:16, overflow:'hidden', position:'relative', minHeight:480, display:'flex', flexDirection:'column', padding:'32px 28px', textAlign:'center', justifyContent:'space-between'}}>
      {/* Decorative circles */}
      {(isGradient || isDark) && <>
        <div style={{position:'absolute',top:-30,right:-30,width:120,height:120,borderRadius:'50%',background:'rgba(255,255,255,0.06)'}}/>
        <div style={{position:'absolute',bottom:40,left:-20,width:80,height:80,borderRadius:'50%',background:'rgba(255,255,255,0.04)'}}/>
      </>}

      <div style={{position:'relative',zIndex:1}}>
        {/* Logo */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:20}}>
          <div style={{width:28,height:28,borderRadius:7,background:isGradient||isDark?'rgba(255,255,255,0.2)':accentColor,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg viewBox="0 0 18 18" fill="none" style={{width:14,height:14}}><path d="M9 2L3 6v6l6 4 6-4V6L9 2z" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="9" cy="9" r="2.5" fill="#fff"/></svg>
          </div>
          <span style={{fontSize:14,fontWeight:700,color:headingColor}}>PixSnap</span>
        </div>

        {/* Event name */}
        <h1 style={{fontSize:22,fontWeight:800,color:headingColor,margin:'0 0 6px',lineHeight:1.2,letterSpacing:'-0.02em'}}>
          {eventName || 'Ditt eventnamn'}
        </h1>
        {dateStr && <p style={{fontSize:12,color:subColor,margin:'0 0 20px'}}>{dateStr}</p>}

        {/* QR code */}
        <div style={{background:qrBg,borderRadius:12,padding:12,display:'inline-block',boxShadow:'0 4px 20px rgba(0,0,0,0.1)',marginBottom:16}}>
          {qrDataUrl
            ? <img src={qrDataUrl} alt="QR" style={{width:140,height:140,display:'block'}}/>
            : <div style={{width:140,height:140,background:'rgba(91,99,241,0.08)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}><QRMini size={80}/></div>
          }
        </div>

        <p style={{fontSize:12,color:subColor,margin:'0 0 4px',fontWeight:600}}>Skanna med din kamera</p>
      </div>

      {/* Steps */}
      <div style={{position:'relative',zIndex:1}}>
        <div style={{display:'flex',justifyContent:'center'}}>
          <StepsFigure/>
        </div>
        <p style={{fontSize:10,color:footerColor,marginTop:12}}>Dina foton är klara på ~30 sekunder · Powered by PixSnap · pixsnap.se</p>
      </div>
    </div>
  )
}

export default function QRPosterPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [event, setEvent] = useState<Event | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [template, setTemplate] = useState<Template>('gradient')
  const [accentColor, setAccentColor] = useState('#4F6EF7')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: ev } = await supabase.from('events').select('*').eq('id', id).eq('created_by', user.id).single()
      if (!ev) { router.push('/dashboard'); return }
      setEvent(ev)
      const url = getEventUrl(ev.slug)
      const qr = await QRCode.toDataURL(url, { width: 300, margin: 1, color: { dark: '#111111', light: '#ffffff' } })
      setQrDataUrl(qr)
    }
    load()
  }, [id, router, supabase])

  if (!event) return (
    <div style={{minHeight:'60vh', display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div className="ps-spin"/>
    </div>
  )

  const dateStr = event.date
    ? new Date(event.date).toLocaleDateString('sv-SE', { year:'numeric', month:'long', day:'numeric' })
    : ''

  const TEMPLATES: { key: Template; label: string; preview: string }[] = [
    { key:'gradient', label:'Premium Gradient', preview:`linear-gradient(135deg, ${accentColor}, #7C3AED)` },
    { key:'white', label:'Clean White', preview:'#FFFFFF' },
    { key:'dark', label:'Midnight Dark', preview:'#0D0E1A' },
    { key:'blush', label:'Soft Blush', preview:'#FFF0F8' },
  ]

  return (
    <div style={{fontFamily:'Inter,sans-serif'}}>
      {/* Top bar */}
      <div className="no-print" style={{display:'flex', alignItems:'center', gap:16, marginBottom:32, flexWrap:'wrap'}}>
        <Link href={`/dashboard/admin/${id}`} style={{display:'flex', alignItems:'center', gap:6, fontSize:14, color:'var(--text-2)', textDecoration:'none', fontWeight:500, transition:'color 0.2s'}}
          onMouseEnter={e=>(e.currentTarget as any).style.color='var(--brand)'}
          onMouseLeave={e=>(e.currentTarget as any).style.color='var(--text-2)'}>
          ← Tillbaka till event
        </Link>
        <div style={{fontSize:20, fontWeight:800, color:'var(--text-1)', letterSpacing:'-0.025em', flex:1}}>
          QR Poster Generator
        </div>
        <button onClick={()=>window.print()} style={{display:'flex', alignItems:'center', gap:8, padding:'10px 20px', background:'var(--grad)', color:'#fff', border:'none', borderRadius:11, fontFamily:'Inter,sans-serif', fontSize:14, fontWeight:700, cursor:'pointer', boxShadow:'0 3px 16px rgba(91,99,241,0.32)'}}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 6V2h6v4M3 6h8a1 1 0 011 1v4H2V7a1 1 0 011-1zM4 11h6" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Skriv ut / PDF
        </button>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'340px 1fr', gap:32, alignItems:'start'}}>
        {/* LEFT controls */}
        <div className="no-print" style={{display:'flex', flexDirection:'column', gap:20}}>
          {/* Templates */}
          <div style={{background:'var(--glass-bg)', backdropFilter:'var(--glass-blur)', border:'var(--glass-border)', borderRadius:20, padding:20, boxShadow:'var(--glass-shadow)'}}>
            <div style={{fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:14}}>Mall</div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
              {TEMPLATES.map(t => (
                <button key={t.key} onClick={()=>setTemplate(t.key)} style={{
                  padding:0, border:`2px solid ${template===t.key?'var(--brand)':'rgba(220,225,250,0.9)'}`,
                  borderRadius:12, cursor:'pointer', overflow:'hidden', background:'none', transition:'all 0.2s',
                }}>
                  <div style={{height:64, background:t.preview, borderRadius:10}}/>
                  <div style={{padding:'6px 8px', fontSize:11, fontWeight:600, color:'var(--text-1)', textAlign:'left', background:'white'}}>{t.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Accent color */}
          <div style={{background:'var(--glass-bg)', backdropFilter:'var(--glass-blur)', border:'var(--glass-border)', borderRadius:20, padding:20, boxShadow:'var(--glass-shadow)'}}>
            <div style={{fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:14}}>Accentfärg</div>
            <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
              {ACCENT_COLORS.map(c => (
                <button key={c} onClick={()=>setAccentColor(c)} style={{
                  width:32, height:32, borderRadius:'50%', background:c, border:'none', cursor:'pointer',
                  boxShadow: accentColor===c ? `0 0 0 3px white, 0 0 0 5px ${c}` : 'none',
                  transition:'box-shadow 0.2s',
                }}/>
              ))}
            </div>
          </div>

          {/* Download buttons */}
          <div style={{display:'flex', flexDirection:'column', gap:10}}>
            <button onClick={()=>window.print()} style={{width:'100%', padding:'13px', background:'var(--grad)', color:'#fff', border:'none', borderRadius:12, fontFamily:'Inter,sans-serif', fontSize:14, fontWeight:700, cursor:'pointer', boxShadow:'0 3px 16px rgba(91,99,241,0.32)', display:'flex', alignItems:'center', justifyContent:'center', gap:8}}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v7M4 6.5l3 3 3-3M1 12h12" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Ladda ner PDF
            </button>
            <button onClick={async () => {
              const canvas = document.querySelector('.print-area canvas') as HTMLCanvasElement
              if (canvas) {
                const a = document.createElement('a'); a.href = canvas.toDataURL(); a.download = `pixsnap-qr-${event.slug}.png`; a.click()
              } else window.print()
            }} style={{width:'100%', padding:'12px', background:'var(--glass-bg)', backdropFilter:'var(--glass-blur)', border:'var(--glass-border)', color:'var(--text-1)', borderRadius:12, fontFamily:'Inter,sans-serif', fontSize:14, fontWeight:600, cursor:'pointer', boxShadow:'var(--glass-shadow)', display:'flex', alignItems:'center', justifyContent:'center', gap:8}}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v7M4 6.5l3 3 3-3M1 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Ladda ner PNG
            </button>
          </div>
        </div>

        {/* RIGHT preview */}
        <div>
          <div style={{fontSize:11, color:'var(--text-3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:16}} className="no-print">
            Live preview — A4-format
          </div>
          <div className="print-area" style={{maxWidth:480, margin:'0 auto'}}>
            <PosterPreview template={template} eventName={event.name} dateStr={dateStr} qrDataUrl={qrDataUrl} accentColor={accentColor}/>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          .print-area { box-shadow: none !important; max-width: 100% !important; }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </div>
  )
}
