'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? 'ahmadlarin14@gmail.com'
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export default function SuperAdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview'|'events'|'users'|'revenue'|'notifications'>('overview')
  const [events, setEvents] = useState<any[]>([])
  const [purchases, setPurchases] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [waitlist, setWaitlist] = useState<any[]>([])
  const [totalPhotos, setTotalPhotos] = useState(0)
  const [sending, setSending] = useState<string|null>(null)
  const [notifMsg, setNotifMsg] = useState('')
  const [toast, setToast] = useState('')

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.email !== ADMIN_EMAIL) { router.push('/'); return }

      const [{ data: evs }, { data: purch }, { data: sess }, { data: wl }, { count: pc }] = await Promise.all([
        supabase.from('events').select('*').order('created_at', { ascending: false }),
        supabase.from('purchases').select('*').eq('status', 'paid').order('created_at', { ascending: false }),
        supabase.from('guest_sessions').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('waitlist').select('*, events(name)').order('created_at', { ascending: false }),
        supabase.from('photos').select('*', { count: 'exact', head: true }),
      ])
      setEvents(evs ?? [])
      setPurchases(purch ?? [])
      setSessions(sess ?? [])
      setWaitlist(wl ?? [])
      setTotalPhotos(pc ?? 0)
      setLoading(false)
    }
    load()
  }, [supabase, router])

  const totalRevenue = purchases.reduce((s, p) => s + (p.amount_ore ?? 0), 0) / 100
  const totalPhotosSold = purchases.reduce((s, p) => s + (p.photo_ids?.length ?? 0), 0)

  async function toggleEvent(ev: any) {
    await supabase.from('events').update({ is_active: !ev.is_active }).eq('id', ev.id)
    setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, is_active: !e.is_active } : e))
    showToast(ev.is_active ? `"${ev.name}" inaktiverat` : `"${ev.name}" aktiverat`)
  }

  async function deleteEvent(ev: any) {
    if (!confirm(`Radera "${ev.name}" permanent?`)) return
    // Delete AWS collection + storage via backend
    await fetch(`${API_URL}/event/${ev.id}?user_id=${ev.created_by}`, { method: 'DELETE' })
    setEvents(prev => prev.filter(e => e.id !== ev.id))
    showToast(`"${ev.name}" raderat`)
  }

  async function sendNotification(eventId: string, eventName: string) {
    if (!notifMsg.trim()) { showToast('Skriv ett meddelande först'); return }
    setSending(eventId)
    try {
      // Get all waitlist emails for this event
      const { data: wlItems } = await supabase.from('waitlist').select('email').eq('event_id', eventId)
      const emails = (wlItems ?? []).map((w: any) => w.email).filter(Boolean)
      
      // Send via backend
      const res = await fetch(`${API_URL}/send-bulk-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, event_name: eventName, message: notifMsg, emails }),
      })
      const d = await res.json()
      showToast(`✅ Skickat till ${d.count ?? emails.length} mottagare`)
      setNotifMsg('')
    } catch { showToast('❌ Fel vid utskick') }
    finally { setSending(null) }
  }

  async function processAllPhotos(eventId: string) {
    const { data: photos } = await supabase.from('photos').select('id, public_url, event_id').eq('event_id', eventId)
    if (!photos?.length) { showToast('Inga foton att processa'); return }
    showToast(`Processerar ${photos.length} foton i bakgrunden…`)
    for (const p of photos) {
      fetch(`${API_URL}/embed`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_id: p.id, photo_url: p.public_url, event_id: p.event_id }),
      }).catch(() => {})
    }
  }

  const Card = ({ label, value, sub, color }: any) => (
    <div className={`bg-white rounded-2xl border p-5 ${color ?? 'border-neutral-100'}`}>
      <p className="text-3xl font-extrabold text-neutral-900 tracking-tight">{value}</p>
      <p className="text-xs font-bold text-neutral-500 mt-1 uppercase tracking-wide">{label}</p>
      {sub && <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>}
    </div>
  )

  if (loading) return <div className="min-h-screen bg-neutral-50 flex items-center justify-center"><div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" /></div>

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-neutral-900 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-extrabold text-neutral-900">PixSnap SuperAdmin</p>
            <p className="text-xs text-neutral-400">{ADMIN_EMAIL}</p>
          </div>
        </div>
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors">← Dashboard</Link>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-neutral-100 px-6">
        <div className="flex gap-0">
          {[['overview','📊 Översikt'],['events','📸 Events'],['users','👥 Gäster'],['revenue','💰 Intäkter'],['notifications','🔔 Utskick']].map(([t,l]) => (
            <button key={t} onClick={() => setTab(t as any)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${tab===t ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card label="Events" value={events.length} sub={`${events.filter(e=>e.is_active).length} aktiva`} />
              <Card label="Foton" value={totalPhotos} sub="uppladdade" />
              <Card label="Gästsessioner" value={sessions.length} sub="totalt" />
              <Card label="Intäkter" value={`${totalRevenue.toFixed(0)} kr`} sub={`${totalPhotosSold} foton sålda`} color="border-green-100" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-neutral-100 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-4">Senaste events</p>
                <div className="space-y-3">
                  {events.slice(0, 5).map(ev => (
                    <div key={ev.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${ev.is_active ? 'bg-green-400' : 'bg-neutral-300'}`} />
                        <p className="text-sm font-medium text-neutral-900">{ev.name}</p>
                      </div>
                      <p className="text-xs text-neutral-400">{new Date(ev.created_at).toLocaleDateString('sv-SE')}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-neutral-100 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-4">Senaste köp</p>
                <div className="space-y-3">
                  {purchases.slice(0, 5).map(p => (
                    <div key={p.id} className="flex items-center justify-between">
                      <p className="text-sm font-medium text-neutral-900">{p.photo_ids?.length ?? 0} foton</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">{(p.amount_ore/100).toFixed(0)} kr</span>
                        <p className="text-xs text-neutral-400">{new Date(p.created_at).toLocaleDateString('sv-SE')}</p>
                      </div>
                    </div>
                  ))}
                  {purchases.length === 0 && <p className="text-sm text-neutral-400">Inga köp ännu</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EVENTS */}
        {tab === 'events' && (
          <div className="space-y-3">
            {events.map(ev => (
              <div key={ev.id} className="bg-white rounded-2xl border border-neutral-100 p-5">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-neutral-900">{ev.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${ev.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {ev.is_active ? 'Aktivt' : 'Inaktivt'}
                      </span>
                      {!ev.payment_enabled && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">🎁 Gratis</span>}
                      {ev.pin_code && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">🔒 PIN</span>}
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">{ev.slug} · {new Date(ev.created_at).toLocaleDateString('sv-SE')}</p>
                    <p className="text-xs text-neutral-500 mt-1">Pris: {ev.payment_enabled ? `${(ev.price_per_photo_ore??1000)/100} kr/foto` : 'Gratis'} · Vattenstämpel: {ev.watermark_enabled ? (ev.watermark_text || 'PixSnap') : 'Av'}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <a href={`/event/${ev.slug}`} target="_blank" className="text-xs border border-neutral-200 rounded-xl px-3 py-2 hover:bg-neutral-50 transition-colors font-medium">↗ Publik sida</a>
                    <Link href={`/dashboard/admin/${ev.id}`} className="text-xs bg-neutral-100 text-neutral-700 border border-neutral-200 rounded-xl px-3 py-2 hover:bg-neutral-200 transition-colors font-medium">Admin</Link>
                    <button onClick={() => processAllPhotos(ev.id)} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-xl px-3 py-2 hover:bg-blue-100 transition-colors font-medium">⚙ Processa foton</button>
                    <button onClick={() => toggleEvent(ev)} className={`text-xs border rounded-xl px-3 py-2 transition-colors font-medium ${ev.is_active ? 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100' : 'bg-green-50 text-green-700 border-green-100 hover:bg-green-100'}`}>
                      {ev.is_active ? 'Inaktivera' : 'Aktivera'}
                    </button>
                    <button onClick={() => deleteEvent(ev)} className="text-xs bg-red-50 text-red-600 border border-red-100 rounded-xl px-3 py-2 hover:bg-red-100 transition-colors font-medium">🗑 Radera</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* USERS / SESSIONS */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card label="Gästsessioner" value={sessions.length} />
              <Card label="Med email" value={sessions.filter(s=>s.email).length} />
              <Card label="Väntelista" value={waitlist.length} />
            </div>
            <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-100">
                <p className="text-sm font-bold text-neutral-900">Senaste gästsessioner</p>
              </div>
              <div className="divide-y divide-neutral-50">
                {sessions.slice(0, 20).map(s => (
                  <div key={s.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{s.email || <span className="text-neutral-400">Anonym</span>}</p>
                      <p className="text-xs text-neutral-400">{s.photo_ids?.length ?? 0} foton · {new Date(s.created_at).toLocaleDateString('sv-SE')}</p>
                    </div>
                    <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-1 rounded-lg">{s.token?.slice(0,8)}…</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* REVENUE */}
        {tab === 'revenue' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card label="Total intäkt" value={`${totalRevenue.toFixed(0)} kr`} color="border-green-100" />
              <Card label="Foton sålda" value={totalPhotosSold} />
              <Card label="Transaktioner" value={purchases.length} />
            </div>
            <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-100">
                <p className="text-sm font-bold text-neutral-900">Alla köp</p>
              </div>
              <div className="divide-y divide-neutral-50">
                {purchases.map(p => (
                  <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{p.photo_ids?.length ?? 0} foton köpta</p>
                      <p className="text-xs text-neutral-400">{new Date(p.created_at).toLocaleDateString('sv-SE')} · {p.stripe_session_id?.slice(0,16)}…</p>
                    </div>
                    <span className="text-sm font-extrabold text-green-600">{(p.amount_ore/100).toFixed(0)} kr</span>
                  </div>
                ))}
                {purchases.length === 0 && <p className="px-5 py-8 text-sm text-neutral-400 text-center">Inga köp ännu</p>}
              </div>
            </div>
          </div>
        )}

        {/* NOTIFICATIONS */}
        {tab === 'notifications' && (
          <div className="space-y-4 max-w-2xl">
            <div className="bg-white rounded-2xl border border-neutral-100 p-5 space-y-4">
              <p className="text-sm font-bold text-neutral-900">Skicka massutskick</p>
              <textarea
                value={notifMsg}
                onChange={e => setNotifMsg(e.target.value)}
                placeholder="Skriv ditt meddelande till gästerna…"
                rows={4}
                className="input resize-none"
              />
              <div className="space-y-2">
                {events.map(ev => {
                  const evWaitlist = waitlist.filter((w: any) => w.event_id === ev.id)
                  return (
                    <div key={ev.id} className="flex items-center justify-between bg-neutral-50 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{ev.name}</p>
                        <p className="text-xs text-neutral-500">{evWaitlist.length} registrerade på väntelista</p>
                      </div>
                      <button
                        onClick={() => sendNotification(ev.id, ev.name)}
                        disabled={sending === ev.id || !notifMsg.trim()}
                        className="bg-neutral-900 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-neutral-700 transition-colors disabled:opacity-40 flex items-center gap-1.5">
                        {sending === ev.id && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        Skicka ({evWaitlist.length})
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-100">
                <p className="text-sm font-bold text-neutral-900">Väntelista ({waitlist.length})</p>
              </div>
              <div className="divide-y divide-neutral-50">
                {waitlist.slice(0, 30).map((w: any) => (
                  <div key={w.id} className="px-5 py-3 flex items-center justify-between">
                    <p className="text-sm text-neutral-900">{w.email}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-400">{(w.events as any)?.name}</span>
                      <span className="text-xs text-neutral-400">{new Date(w.created_at).toLocaleDateString('sv-SE')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-2xl z-50 animate-bounce">
          {toast}
        </div>
      )}
    </div>
  )
}