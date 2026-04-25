'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ADMIN_EMAIL = 'ahmadlarin14@gmail.com'

export default function SuperAdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<any[]>([])
  const [photos, setPhotos] = useState(0)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.email !== ADMIN_EMAIL) { router.push('/'); return }
      const { data: evs } = await supabase.from('events').select('*').order('created_at', { ascending: false }).limit(50)
      setEvents(evs ?? [])
      const { count } = await supabase.from('photos').select('*', { count: 'exact', head: true })
      setPhotos(count ?? 0)
      setLoading(false)
    }
    load()
  }, [router, supabase])

  if (loading) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}><div className="ps-spin"/></div>

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',padding:24}}>
      <div style={{maxWidth:900,margin:'0 auto'}}>
        <h1 style={{fontSize:22,fontWeight:800,color:'var(--text-1)',marginBottom:24}}>SuperAdmin</h1>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:28}}>
          {[['Events',events.length],['Foton',photos],['Status','Online']].map(([l,v]) => (
            <div key={String(l)} className="ps-card" style={{padding:'18px 22px'}}>
              <p style={{fontSize:11,color:'var(--text-3)',marginBottom:4}}>{l}</p>
              <p style={{fontSize:24,fontWeight:800,color:'var(--text-1)'}}>{String(v)}</p>
            </div>
          ))}
        </div>
        <div className="ps-card" style={{padding:20}}>
          <h2 style={{fontSize:15,fontWeight:700,color:'var(--text-1)',marginBottom:14}}>Alla events</h2>
          {events.map(ev => (
            <div key={ev.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid #EAEDF4'}}>
              <div>
                <p style={{fontWeight:600,fontSize:13,color:'var(--text-1)'}}>{ev.name}</p>
                <p style={{fontSize:11,color:'var(--text-3)'}}>{new Date(ev.created_at).toLocaleDateString('sv-SE')} · {ev.slug}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
