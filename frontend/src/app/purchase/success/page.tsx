'use client';
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// 3D success checkmark figure
const SuccessFigure = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
    <circle cx="60" cy="60" r="56" fill="url(#successBg)" opacity="0.15"/>
    <circle cx="60" cy="60" r="44" fill="url(#successBg)" opacity="0.2"/>
    <circle cx="60" cy="60" r="32" fill="url(#successBg)"/>
    <path d="M40 60l14 14 26-26" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Sparkle 1 */}
    <path d="M96 20l1.5 4.5 4.5 1.5-4.5 1.5L96 32l-1.5-4.5L90 26l4.5-1.5z" fill="url(#successBg)" opacity="0.7"/>
    {/* Sparkle 2 */}
    <path d="M18 80l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="url(#successBg)" opacity="0.5"/>
    <defs>
      <linearGradient id="successBg" x1="4" y1="4" x2="116" y2="116" gradientUnits="userSpaceOnUse">
        <stop stopColor="#22C55E"/>
        <stop offset="1" stopColor="#16a34a"/>
      </linearGradient>
    </defs>
  </svg>
)

// 3D download icon
const DownloadFigure = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M10 3v9M7 9l3 4 3-4M3 16h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export default function PurchaseSuccessPage() {
  const searchParams = useSearchParams()
  const purchaseId = searchParams.get('purchase_id') ?? ''
  const token = searchParams.get('token') ?? ''

  const [purchase, setPurchase] = useState<{ photo_ids: string[]; status: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [photoCount, setPhotoCount] = useState(0)

  useEffect(() => {
    if (!purchaseId) { setLoading(false); return }
    fetch(`${API_URL}/purchase/${purchaseId}`)
      .then(r => r.json())
      .then(data => { setPurchase(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [purchaseId])

  useEffect(() => {
    if (purchase?.photo_ids?.length) {
      let n = 0; const target = purchase.photo_ids.length
      const t = setInterval(() => { n++; setPhotoCount(n); if (n >= target) clearInterval(t) }, 80)
    }
  }, [purchase])

  if (loading) return (
    <>
      <div className="ps-bg"/>
      <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center'}}>
        <div className="ps-spin" style={{width:32, height:32, borderWidth:3}}/>
      </div>
    </>
  )

  return (
    <>
      <div className="ps-bg"/>
      <div className="ps-bg-orb ps-bg-orb-1"/>
      <div className="ps-bg-orb ps-bg-orb-2"/>

      {/* Confetti effect */}
      <div id="confetti-root" style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:999}}/>

      <div style={{minHeight:'100vh', display:'flex', flexDirection:'column', fontFamily:'Inter,sans-serif'}}>
        {/* Minimal header */}
        <div style={{height:64, display:'flex', alignItems:'center', justifyContent:'center', borderBottom:'1px solid rgba(0,0,0,0.05)'}}>
          <Link href="/" style={{display:'flex', alignItems:'center', gap:8, textDecoration:'none'}}>
            <div style={{width:28, height:28, background:'var(--grad)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center'}}>
              <svg viewBox="0 0 18 18" fill="none" style={{width:14, height:14}}><path d="M9 2L3 6v6l6 4 6-4V6L9 2z" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="9" cy="9" r="2.5" fill="#fff"/></svg>
            </div>
            <span style={{fontSize:16, fontWeight:700, color:'var(--text-1)'}}>PixSnap</span>
          </Link>
        </div>

        <main style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:24}}>
          <div style={{width:'100%', maxWidth:480}}>
            {/* Main card */}
            <div style={{background:'var(--glass-bg-strong)', backdropFilter:'var(--glass-blur-heavy)', border:'var(--glass-border)', borderRadius:32, boxShadow:'var(--glass-shadow-lg)', overflow:'hidden', textAlign:'center'}} className="anim-fade-up">
              {/* Green gradient header */}
              <div style={{background:'linear-gradient(135deg, #22C55E, #16a34a)', padding:'40px 32px 48px', position:'relative', overflow:'hidden'}}>
                <div style={{position:'absolute', top:-20, right:-20, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,0.08)'}}/>
                <div style={{position:'absolute', bottom:-10, left:10, width:60, height:60, borderRadius:'50%', background:'rgba(255,255,255,0.06)'}}/>
                <div style={{position:'relative', zIndex:1, display:'flex', justifyContent:'center', marginBottom:20}}>
                  <SuccessFigure/>
                </div>
                <h1 style={{fontSize:26, fontWeight:800, color:'#fff', letterSpacing:'-0.025em', margin:'0 0 8px', position:'relative', zIndex:1}}>
                  Betalning genomförd!
                </h1>
                <p style={{fontSize:15, color:'rgba(255,255,255,0.8)', margin:0, position:'relative', zIndex:1, lineHeight:1.5}}>
                  Du har nu tillgång till dina foton i full kvalitet
                </p>
              </div>

              {/* Overlap stat pill */}
              <div style={{display:'flex', justifyContent:'center', marginTop:-24, marginBottom:0, position:'relative', zIndex:2}}>
                <div style={{background:'white', borderRadius:20, padding:'12px 24px', boxShadow:'0 4px 20px rgba(0,0,0,0.1)', display:'flex', alignItems:'center', gap:20}}>
                  {purchase && (
                    <>
                      <div style={{textAlign:'center'}}>
                        <div style={{fontSize:28, fontWeight:900, color:'var(--text-1)', letterSpacing:'-0.04em', lineHeight:1}}>{photoCount}</div>
                        <div style={{fontSize:11, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:2}}>Foton köpta</div>
                      </div>
                      <div style={{width:1, height:36, background:'rgba(0,0,0,0.06)'}}/>
                    </>
                  )}
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:20, fontWeight:800, color:'#22C55E', lineHeight:1}}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{display:'block', margin:'0 auto'}}>
                        <path d="M5 13l4 4L19 7" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div style={{fontSize:11, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:2}}>Betald</div>
                  </div>
                  <div style={{width:1, height:36, background:'rgba(0,0,0,0.06)'}}/>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:11, fontWeight:700, color:'var(--brand)', lineHeight:1.3}}>Full<br/>kvalitet</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{padding:'32px', display:'flex', flexDirection:'column', gap:12}}>
                <a href={`${API_URL}/download/${purchaseId}`} download style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                  padding:'14px', background:'var(--grad)', color:'#fff',
                  fontSize:15, fontWeight:700, borderRadius:14, textDecoration:'none',
                  boxShadow:'0 4px 20px rgba(91,99,241,0.3)', transition:'transform 0.18s, box-shadow 0.18s',
                }}
                  onMouseEnter={e=>{(e.currentTarget as any).style.transform='translateY(-1px)';(e.currentTarget as any).style.boxShadow='0 6px 28px rgba(91,99,241,0.4)'}}
                  onMouseLeave={e=>{(e.currentTarget as any).style.transform='none';(e.currentTarget as any).style.boxShadow='0 4px 20px rgba(91,99,241,0.3)'}}>
                  <DownloadFigure/>
                  Ladda ner alla foton (zip)
                </a>

                {token && (
                  <Link href={`/session/${token}`} style={{
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    padding:'13px', background:'var(--glass-bg)', backdropFilter:'var(--glass-blur)',
                    border:'var(--glass-border)', color:'var(--text-1)',
                    fontSize:14, fontWeight:600, borderRadius:14, textDecoration:'none',
                    boxShadow:'var(--glass-shadow)',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 7H2M5 4l-3 3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Tillbaka till galleriet
                  </Link>
                )}
              </div>

              {/* Footer note */}
              <div style={{padding:'0 32px 24px', textAlign:'center'}}>
                <p style={{fontSize:12, color:'var(--text-3)', lineHeight:1.6}}>
                  Länken gäller i 30 dagar · Dina foton är i full upplösning utan vattenstämpel
                </p>
              </div>
            </div>

            {/* Bottom trust badges */}
            <div className="anim-fade-up d-2" style={{display:'flex', justifyContent:'center', gap:24, marginTop:24, flexWrap:'wrap'}}>
              {[
                {icon:<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2l1.5 3.5L12 6 9.5 8.5l.5 3.5L7 10.5 4 12l.5-3.5L2 6l3.5-.5z" stroke="#22C55E" strokeWidth="1.2" strokeLinejoin="round"/></svg>, text:'Full kvalitet'},
                {icon:<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="5" width="10" height="8" rx="2" stroke="#4F6EF7" strokeWidth="1.2"/><path d="M5 5V4a2 2 0 014 0v1" stroke="#4F6EF7" strokeWidth="1.2" strokeLinecap="round"/></svg>, text:'Säker betalning'},
                {icon:<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="#7C3AED" strokeWidth="1.2"/><path d="M7 4.5v3l2 1.5" stroke="#7C3AED" strokeWidth="1.2" strokeLinecap="round"/></svg>, text:'Livstids åtkomst'},
              ].map(b => (
                <div key={b.text} style={{display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-3)', fontWeight:500}}>
                  {b.icon}{b.text}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      <script dangerouslySetInnerHTML={{__html:`
        (function(){
          var colors=['#4F6EF7','#7C3AED','#22C55E','#F59E0B','#EC4899'];
          var c=document.getElementById('confetti-root');
          for(var i=0;i<50;i++){
            var p=document.createElement('div');
            var color=colors[Math.floor(Math.random()*colors.length)];
            var size=(6+Math.random()*10)+'px';
            p.style.cssText='position:absolute;top:-20px;left:'+Math.random()*100+'vw;width:'+size+';height:'+size+';border-radius:'+(Math.random()>.5?'50%':'2px')+';background:'+color+';animation:confettiFall '+(2+Math.random()*2)+'s linear '+(Math.random())+'s forwards';
            c.appendChild(p);
            setTimeout(function(el){return function(){el.remove()}}(p),4000);
          }
        })();
      `}}/>
    </>
  )
}
