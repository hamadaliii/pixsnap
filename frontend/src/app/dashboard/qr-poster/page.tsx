'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function QRPosterIndexPage() {
  const supabase = createClient()
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: evs } = await supabase.from('events').select('id,name,date,slug').eq('created_by', data.user.id).order('created_at', { ascending: false })
      setEvents(evs ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div style={{minHeight:'50vh', display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div className="ps-spinner"/>
    </div>
  )

  return (
    <div style={{fontFamily:'Outfit,sans-serif'}}>
      <div style={{marginBottom:32}}>
        <h1 style={{fontSize:24, fontWeight:800, color:'var(--text-h)', letterSpacing:'-0.025em', marginBottom:6}}>
          QR Poster Generator
        </h1>
        <p style={{fontSize:15, color:'var(--text-b)'}}>Välj ett event för att designa och ladda ner en tryckklar QR-affisch.</p>
      </div>

      {events.length === 0 ? (
        <div style={{background:'var(--glass-bg)', backdropFilter:'var(--glass-blur)', border:'var(--glass-border)', borderRadius:20, padding:'60px 20px', textAlign:'center', boxShadow:'var(--glass-shadow)'}}>
          <div style={{display:'flex', justifyContent:'center', marginBottom:20}}>
            <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
              <rect x="4" y="4" width="22" height="22" rx="4" stroke="url(#qrEmptyG)" strokeWidth="2"/>
              <rect x="8" y="8" width="14" height="14" rx="2" fill="url(#qrEmptyG)" opacity="0.2"/>
              <rect x="34" y="4" width="22" height="22" rx="4" stroke="url(#qrEmptyG)" strokeWidth="2"/>
              <rect x="38" y="8" width="14" height="14" rx="2" fill="url(#qrEmptyG)" opacity="0.2"/>
              <rect x="4" y="34" width="22" height="22" rx="4" stroke="url(#qrEmptyG)" strokeWidth="2"/>
              <rect x="8" y="38" width="14" height="14" rx="2" fill="url(#qrEmptyG)" opacity="0.2"/>
              <defs><linearGradient id="qrEmptyG" x1="4" y1="4" x2="56" y2="56" gradientUnits="userSpaceOnUse"><stop stopColor="#4F6EF7"/><stop offset="1" stopColor="#7C3AED"/></linearGradient></defs>
            </svg>
          </div>
          <div style={{fontSize:18, fontWeight:700, color:'var(--text-h)', marginBottom:8}}>Inga events ännu</div>
          <p style={{fontSize:14, color:'var(--text-b)', marginBottom:24}}>Skapa ett event först för att kunna generera en QR-affisch.</p>
          <Link href="/dashboard/create-event" style={{display:'inline-flex', alignItems:'center', gap:8, padding:'12px 24px', background:'var(--grad)', color:'#fff', borderRadius:12, textDecoration:'none', fontSize:14, fontWeight:700, boxShadow:'0 3px 14px rgba(91,99,241,0.3)'}}>
            Skapa ditt första event
          </Link>
        </div>
      ) : (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16}}>
          {events.map(ev => (
            <Link key={ev.id} href={`/dashboard/qr-poster/${ev.id}`} style={{
              background:'var(--glass-bg)', backdropFilter:'var(--glass-blur)', border:'var(--glass-border)',
              borderRadius:20, overflow:'hidden', textDecoration:'none', boxShadow:'var(--glass-shadow)',
              transition:'transform 0.22s, box-shadow 0.22s', display:'block',
            }}
              onMouseEnter={e=>{(e.currentTarget as any).style.transform='translateY(-3px)';(e.currentTarget as any).style.boxShadow='var(--glass-shadow-lg)'}}
              onMouseLeave={e=>{(e.currentTarget as any).style.transform='none';(e.currentTarget as any).style.boxShadow='var(--glass-shadow)'}}>
              {/* Mini poster preview */}
              <div style={{height:120, background:'linear-gradient(135deg,#4F6EF7,#7C3AED)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden'}}>
                <div style={{position:'absolute', top:-15, right:-15, width:60, height:60, borderRadius:'50%', background:'rgba(255,255,255,0.08)'}}/>
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <rect x="2" y="2" width="16" height="16" rx="3" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>
                  <rect x="22" y="2" width="16" height="16" rx="3" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>
                  <rect x="2" y="22" width="16" height="16" rx="3" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>
                  <rect x="22" y="22" width="6" height="6" fill="rgba(255,255,255,0.7)"/>
                  <rect x="30" y="22" width="8" height="6" fill="rgba(255,255,255,0.5)"/>
                  <rect x="22" y="30" width="6" height="8" fill="rgba(255,255,255,0.5)"/>
                  <rect x="30" y="30" width="8" height="8" fill="rgba(255,255,255,0.7)"/>
                </svg>
              </div>
              <div style={{padding:'16px 18px'}}>
                <div style={{fontSize:15, fontWeight:700, color:'var(--text-h)', marginBottom:4}}>{ev.name}</div>
                {ev.date && <div style={{fontSize:12, color:'var(--text-m)'}}>{new Date(ev.date).toLocaleDateString('sv-SE',{year:'numeric',month:'long',day:'numeric'})}</div>}
                <div style={{display:'flex', alignItems:'center', gap:6, marginTop:12, fontSize:13, fontWeight:600, color:'var(--brand)'}}>
                  Designa affisch
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
