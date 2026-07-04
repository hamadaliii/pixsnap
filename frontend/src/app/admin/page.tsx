'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? 'ahmadlarin14@gmail.com'
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

type Tab = 'overview' | 'events' | 'photos' | 'ai' | 'egress' | 'plans' | 'email' | 'payments' | 'security' | 'settings'

function fmtBytes(b: number): string {
  if (!b) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(b) / Math.log(1024))
  return `${(b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export default function SuperAdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [toast, setToast] = useState('')

  // Data
  const [events, setEvents] = useState<any[]>([])
  const [photos, setPhotos] = useState<any[]>([])
  const [purchases, setPurchases] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [waitlist, setWaitlist] = useState<any[]>([])
  const [scanAttempts, setScanAttempts] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [totalPhotoCount, setTotalPhotoCount] = useState(0)

  // Backend usage/budget
  const [usage, setUsage] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [photographers, setPhotographers] = useState<any[]>([])
  const [emailStatus, setEmailStatus] = useState<any>(null)
  const [testEmail, setTestEmail] = useState('')

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(''), 3000) }

  const loadAll = useCallback(async () => {
    const [
      { data: evs },
      { data: ph },
      { count: phCount },
      { data: purch },
      { data: sess },
      { data: wl },
      { data: attempts },
      { data: audit },
    ] = await Promise.all([
      supabase.from('events').select('*').order('created_at', { ascending: false }),
      supabase.from('photos').select('id,event_id,thumb_url,preview_url,processed,face_count,hash,thumb_size_bytes,preview_size_bytes,original_size_bytes,width,height').order('created_at', { ascending: false }).limit(200),
      supabase.from('photos').select('*', { count: 'exact', head: true }),
      supabase.from('purchases').select('*').order('created_at', { ascending: false }),
      supabase.from('guest_sessions').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('waitlist').select('*, events(name)').order('created_at', { ascending: false }).limit(200),
      supabase.from('scan_attempts').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(100),
    ])
    setEvents(evs ?? [])
    setPhotos(ph ?? [])
    setTotalPhotoCount(phCount ?? 0)
    setPurchases((purch ?? []).filter((p: any) => p.status === 'paid'))
    setSessions(sess ?? [])
    setWaitlist(wl ?? [])
    setScanAttempts(attempts ?? [])
    setAuditLogs(audit ?? [])

    // Backend usage + settings (Phase 1 endpoints)
    try {
      const r = await fetch(`${API_URL}/admin/usage`)
      if (r.ok) {
        const d = await r.json()
        setUsage(d)
        setSettings(d.budget ?? null)
      }
    } catch { /* backend cold start — ignore */ }
    // Phase 2: plans + email status
    try {
      const [pr, er] = await Promise.all([
        fetch(`${API_URL}/admin/plans`),
        fetch(`${API_URL}/admin/email/status`),
      ])
      if (pr.ok) setPhotographers((await pr.json()).photographers ?? [])
      if (er.ok) setEmailStatus(await er.json())
    } catch { /* ignore */ }
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.email !== ADMIN_EMAIL) { router.push('/'); return }
      await loadAll()
      setLoading(false)
    }
    init()
  }, [router, supabase, loadAll])

  // ── Derived totals ──
  const totalRevenue = purchases.reduce((s, p) => s + (p.amount_ore ?? 0), 0) / 100
  const totalPhotosSold = purchases.reduce((s, p) => s + (p.photo_ids?.length ?? 0), 0)
  const activeEvents = events.filter(e => e.is_active).length
  const indexedPhotos = photos.filter(p => p.processed).length
  const estimatedStorage = photos.reduce((s, p) => s + (p.original_size_bytes ?? 0) + (p.preview_size_bytes ?? 0) + (p.thumb_size_bytes ?? 0), 0)

  const perEventEgress: Record<string, any> = usage?.per_event ?? {}
  const budgetEgress = usage?.budget?.egress_bytes ?? 0
  const aiSearchCount = usage?.budget?.ai_search ?? 0
  const emailCount = usage?.budget?.emails ?? 0

  // ── Actions ──
  async function toggleEvent(ev: any) {
    await supabase.from('events').update({ is_active: !ev.is_active }).eq('id', ev.id)
    setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, is_active: !e.is_active } : e))
    showToast(ev.is_active ? `"${ev.name}" inaktiverat` : `"${ev.name}" aktiverat`)
  }

  async function deleteEvent(ev: any) {
    if (!confirm(`Radera "${ev.name}" permanent? ALL data (foton, AWS-index, sessioner) raderas.`)) return
    await fetch(`${API_URL}/event/${ev.id}?user_id=${ev.created_by}`, { method: 'DELETE' })
    setEvents(prev => prev.filter(e => e.id !== ev.id))
    showToast(`"${ev.name}" raderat`)
  }

  async function reprocessEvent(eventId: string) {
    const evPhotos = photos.filter(p => p.event_id === eventId)
    const { data: full } = await supabase.from('photos').select('id,public_url,event_id').eq('event_id', eventId)
    if (!full?.length) { showToast('Inga foton'); return }
    showToast(`Processar ${full.length} foton i bakgrunden...`)
    for (const p of full) {
      fetch(`${API_URL}/embed`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_id: p.id, photo_url: p.public_url, event_id: p.event_id, watermark_text: 'PixSnap' }),
      }).catch(() => {})
    }
  }

  async function saveSetting(key: string, value: any) {
    setSavingSettings(true)
    try {
      const r = await fetch(`${API_URL}/admin/settings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value, admin_email: ADMIN_EMAIL }),
      })
      if (r.ok) {
        setSettings((prev: any) => ({ ...prev, [key]: value }))
        showToast('Inställning sparad')
        await loadAll()
      } else showToast('Kunde inte spara')
    } catch { showToast('Backend svarar inte') }
    finally { setSavingSettings(false) }
  }

  async function setPlan(userId: string, planId: string) {
    await fetch(`${API_URL}/admin/plan`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, plan_id: planId, admin_email: ADMIN_EMAIL }),
    })
    showToast('Plan uppdaterad'); await loadAll()
  }
  async function toggleSuspend(userId: string, current: string) {
    await fetch(`${API_URL}/admin/plan`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, status: current === 'suspended' ? 'active' : 'suspended', admin_email: ADMIN_EMAIL }),
    })
    showToast(current === 'suspended' ? 'Konto aktiverat' : 'Konto pausat'); await loadAll()
  }
  async function runCleanup() {
    if (!confirm('Kör cleanup? Raderar selfies äldre än 24h, gamla cache-resultat och inaktiverar utgångna events.')) return
    showToast('Kör cleanup...')
    const r = await fetch(`${API_URL}/admin/cleanup`, { method: 'POST' })
    const d = await r.json()
    showToast(`Klart: ${d.selfies_deleted ?? 0} selfies, ${d.matches_expired ?? 0} cache, ${d.events_expired ?? 0} events`)
  }
  async function sendTestEmail() {
    if (!testEmail) { showToast('Ange en email'); return }
    const r = await fetch(`${API_URL}/admin/email/test`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: testEmail }),
    })
    const d = await r.json()
    showToast(d.ok ? 'Testmail skickat!' : (d.message || 'Kunde inte skicka'))
    await loadAll()
  }
  async function flushEmailQueue() {
    const r = await fetch(`${API_URL}/admin/email/process`, { method: 'POST' })
    const d = await r.json()
    showToast(`Kö: ${d.sent ?? 0} skickade, ${d.failed ?? 0} misslyckade`)
    await loadAll()
  }

  const TABS: [Tab, string][] = [
    ['overview', 'Översikt'],
    ['events', 'Events'],
    ['photos', 'Foton'],
    ['ai', 'AI / Rekognition'],
    ['egress', 'Egress & Storage'],
    ['plans', 'Planer'],
    ['email', 'Email'],
    ['payments', 'Intäkter'],
    ['security', 'Säkerhet'],
    ['settings', 'Inställningar'],
  ]

  const Card = ({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) => (
    <div style={{ background: 'var(--surface)', border: `1px solid ${accent ?? '#EAEDF4'}`, borderRadius: 16, padding: '16px 18px' }}>
      <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{sub}</div>}
    </div>
  )

  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button onClick={onClick} disabled={savingSettings} style={{ width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: on ? 'var(--brand)' : '#DDE0EE', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="ps-spin" style={{ width: 28, height: 28, borderWidth: 3 }} />
    </div>
  )

  const egressPct = settings?.egress_hard_hit ? 100 : Math.min(100, (budgetEgress / (4_800_000_000)) * 100)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'Inter,sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid #EAEDF4', padding: '0 clamp(16px,4vw,28px)', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2L2 5v4c0 3 2.5 5.5 6 6.5C14 14.5 16 12 16 9V5L8 2z" stroke="white" strokeWidth="1.4" strokeLinejoin="round"/><path d="M5.5 8.5l2 2 3-3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)' }}>PixSnap SuperAdmin</p>
            <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{ADMIN_EMAIL}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {settings?.maintenance_mode && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 9999, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>Underhållsläge</span>}
          <button onClick={() => loadAll()} style={{ fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>Uppdatera</button>
          <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>Dashboard</Link>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid #EAEDF4', padding: '0 clamp(16px,4vw,28px)', display: 'flex', gap: 2, overflowX: 'auto' }}>
        {TABS.map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '12px 14px', fontSize: 13, fontWeight: tab === t ? 700 : 500, color: tab === t ? 'var(--brand)' : 'var(--text-3)', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? 'var(--brand)' : 'transparent'}`, cursor: 'pointer', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap', marginBottom: -1 }}>
            {l}
          </button>
        ))}
      </div>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(20px,4vw,32px) clamp(16px,4vw,28px)' }}>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {!usage && (
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#B45309' }}>
                Backend svarar inte (Render kan vara i viloläge). Kostnadsdata visas när backend vaknar — ladda om om en stund.
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
              <Card label="Events" value={events.length} sub={`${activeEvents} aktiva`} />
              <Card label="Foton" value={totalPhotoCount} sub={`${indexedPhotos} indexerade`} />
              <Card label="Gästsessioner" value={sessions.length} />
              <Card label="Intäkter" value={`${totalRevenue.toFixed(0)} kr`} sub={`${totalPhotosSold} sålda`} accent="rgba(34,197,94,0.25)" />
              <Card label="Egress (mån)" value={fmtBytes(budgetEgress)} sub={`av ${fmtBytes(4_800_000_000)}`} accent={egressPct > 80 ? 'rgba(239,68,68,0.3)' : '#EAEDF4'} />
              <Card label="AI-sökningar" value={aiSearchCount} sub="denna månad" />
            </div>

            {/* Egress budget bar */}
            {usage && (
              <div style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 16, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>Egress-budget denna månad</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: egressPct > 80 ? 'var(--danger)' : 'var(--success)' }}>{egressPct.toFixed(0)}%</p>
                </div>
                <div style={{ height: 10, borderRadius: 6, background: '#F2F4FA', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${egressPct}%`, background: egressPct > 80 ? 'var(--danger)' : egressPct > 50 ? '#F59E0B' : 'var(--success)', transition: 'width .3s' }} />
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                  {[['Sökningar', settings?.scans_enabled], ['Nedladdningar', settings?.downloads_enabled], ['Previews', settings?.previews_enabled ?? true]].map(([l, on]) => (
                    <span key={String(l)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-2)' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: on ? 'var(--success)' : 'var(--danger)' }} />
                      {l}: {on ? 'på' : 'AV'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── EVENTS ── */}
        {tab === 'events' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {events.map(ev => {
              const eg = perEventEgress[ev.id]
              const evPhotoCount = photos.filter(p => p.event_id === ev.id).length
              return (
                <div key={ev.id} style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 16, padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{ev.name}</h3>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: ev.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: ev.is_active ? '#16a34a' : 'var(--danger)' }}>{ev.is_active ? 'Aktivt' : 'Inaktivt'}</span>
                        {ev.published_at && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: 'rgba(91,99,241,0.1)', color: 'var(--brand)' }}>Publicerat</span>}
                        {ev.pin_code && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: 'rgba(245,158,11,0.1)', color: '#B45309' }}>PIN</span>}
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{ev.slug} · {new Date(ev.created_at).toLocaleDateString('sv-SE')} · {evPhotoCount} foton{eg ? ` · egress ${fmtBytes(eg.egress)}` : ''}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <a href={`/event/${ev.slug}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 8, border: '1px solid #EAEDF4', color: 'var(--text-2)', textDecoration: 'none' }}>Publik</a>
                      <Link href={`/dashboard/admin/${ev.id}`} style={{ fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 8, border: '1px solid #EAEDF4', color: 'var(--text-2)', textDecoration: 'none' }}>Admin</Link>
                      <button onClick={() => reprocessEvent(ev.id)} style={{ fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.2)', color: '#2563EB', background: 'rgba(59,130,246,0.06)', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Reprocessa</button>
                      <button onClick={() => toggleEvent(ev)} style={{ fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 8, border: `1px solid ${ev.is_active ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)'}`, color: ev.is_active ? '#B45309' : '#16a34a', background: ev.is_active ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>{ev.is_active ? 'Pausa' : 'Aktivera'}</button>
                      <button onClick={() => deleteEvent(ev)} style={{ fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger)', background: 'rgba(239,68,68,0.06)', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Radera</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── PHOTOS ── */}
        {tab === 'photos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <Card label="Totalt foton" value={totalPhotoCount} />
              <Card label="Indexerade" value={indexedPhotos} sub="med AWS face-id" />
              <Card label="Med thumbnail" value={photos.filter(p => p.thumb_url).length} />
              <Card label="Est. storage" value={fmtBytes(estimatedStorage)} />
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #EAEDF4' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>Senaste foton ({photos.length})</p>
              </div>
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {photos.slice(0, 60).map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid #F2F4FA', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      {p.thumb_url
                        ? <img src={p.thumb_url} alt="" loading="lazy" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                        : <div style={{ width: 32, height: 32, borderRadius: 6, background: '#F2F4FA', flexShrink: 0 }} />}
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 12, color: 'var(--text-1)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.id.slice(0, 8)}…</p>
                        <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{p.width && p.height ? `${p.width}×${p.height}` : '—'} · {p.face_count ?? 0} ansikten</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      {p.thumb_size_bytes ? <span style={{ fontSize: 11, color: 'var(--text-3)' }}>thumb {fmtBytes(p.thumb_size_bytes)}</span> : null}
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.processed ? 'var(--success)' : '#F59E0B' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── AI / REKOGNITION ── */}
        {tab === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <Card label="SearchFaces (mån)" value={aiSearchCount} sub={`limit ${settings?.ai_hit ? 'NÅDD' : '4000'}`} accent={settings?.ai_hit ? 'rgba(239,68,68,0.3)' : '#EAEDF4'} />
              <Card label="IndexFaces (mån)" value={usage?.budget?.ai_index ?? '—'} />
              <Card label="Indexerade foton" value={indexedPhotos} />
              <Card label="Cache-träffar" value={sessions.length - aiSearchCount > 0 ? sessions.length - aiSearchCount : 0} sub="sparade AWS-anrop" accent="rgba(34,197,94,0.2)" />
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 16, padding: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 6 }}>Så sparar cachen pengar</p>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                Varje selfie-sökning hashas. Om samma selfie söker igen inom 24h återanvänds resultatet utan att AWS anropas. En refresh på resultatsidan ger 0 nya AWS-anrop. Dubbletter vid uppladdning hoppar också över indexering.
              </p>
              <button onClick={() => saveSetting('scans_enabled', !settings?.scans_enabled)} style={{ marginTop: 14, fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', background: settings?.scans_enabled ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', color: settings?.scans_enabled ? 'var(--danger)' : '#16a34a', fontFamily: 'Inter,sans-serif' }}>
                {settings?.scans_enabled ? 'Pausa all AI-sökning' : 'Återaktivera AI-sökning'}
              </button>
            </div>
          </div>
        )}

        {/* ── EGRESS & STORAGE ── */}
        {tab === 'egress' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <Card label="Egress denna månad" value={fmtBytes(budgetEgress)} sub={`${egressPct.toFixed(0)}% av gräns`} accent={egressPct > 80 ? 'rgba(239,68,68,0.3)' : '#EAEDF4'} />
              <Card label="Est. storage" value={fmtBytes(estimatedStorage)} />
              <Card label="Foton totalt" value={totalPhotoCount} />
            </div>

            {/* Kill switches */}
            <div style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 16, padding: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: 14 }}>Kill switches</p>
              {[
                ['scans_enabled', 'Gästsökningar', 'Stäng av all selfie-matchning'],
                ['downloads_enabled', 'Nedladdningar', 'Stoppa gratis ZIP-nedladdningar'],
                ['previews_enabled', 'Previews', 'Stäng av lightbox-previews'],
                ['uploads_enabled', 'Uppladdningar', 'Blockera nya fotouppladdningar'],
              ].map(([key, title, desc]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F2F4FA' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{title}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{desc}</p>
                  </div>
                  <Toggle on={settings?.[key] ?? true} onClick={() => saveSetting(key, !(settings?.[key] ?? true))} />
                </div>
              ))}
            </div>

            {/* Per-event egress */}
            <div style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #EAEDF4' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>Egress per event (denna månad)</p>
              </div>
              {Object.keys(perEventEgress).length === 0 && <p style={{ padding: '24px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>Ingen egress-data ännu</p>}
              {Object.entries(perEventEgress).sort((a, b) => (b[1].egress) - (a[1].egress)).map(([eid, data]) => {
                const ev = events.find(e => e.id === eid)
                return (
                  <div key={eid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid #F2F4FA' }}>
                    <p style={{ fontSize: 13, color: 'var(--text-1)' }}>{ev?.name ?? eid.slice(0, 8)}</p>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>{fmtBytes(data.egress)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── PAYMENTS ── */}
        {tab === 'payments' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <Card label="Total intäkt" value={`${totalRevenue.toFixed(0)} kr`} accent="rgba(34,197,94,0.2)" />
              <Card label="Foton sålda" value={totalPhotosSold} />
              <Card label="Transaktioner" value={purchases.length} />
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #EAEDF4' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>Alla köp</p>
              </div>
              {purchases.length === 0 && <p style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>Inga köp ännu</p>}
              {purchases.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px', borderBottom: '1px solid #F2F4FA' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{p.photo_ids?.length ?? 0} foton</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>{p.stripe_session_id?.slice(0, 20) ?? p.id.slice(0, 12)}… · {new Date(p.created_at).toLocaleDateString('sv-SE')}</p>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#16a34a' }}>{(p.amount_ore / 100).toFixed(0)} kr</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SECURITY ── */}
        {tab === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <Card label="Sökförsök (100 sen.)" value={scanAttempts.length} />
              <Card label="Misslyckade" value={scanAttempts.filter(a => !a.success).length} accent="rgba(239,68,68,0.2)" />
              <Card label="Admin-loggar" value={auditLogs.length} />
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #EAEDF4' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>Senaste sökförsök</p>
              </div>
              {scanAttempts.length === 0 && <p style={{ padding: '24px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>Inga försök loggade</p>}
              {scanAttempts.slice(0, 30).map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 20px', borderBottom: '1px solid #F2F4FA' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: a.success ? 'var(--success)' : 'var(--danger)' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-1)' }}>{a.kind}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>{a.ip_hash?.slice(0, 10)}…</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{new Date(a.created_at).toLocaleString('sv-SE')}</span>
                </div>
              ))}
            </div>
            {auditLogs.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #EAEDF4' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>Admin-actions</p>
                </div>
                {auditLogs.slice(0, 20).map(l => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 20px', borderBottom: '1px solid #F2F4FA' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-1)' }}>{l.action} <span style={{ color: 'var(--text-3)' }}>{l.target_type}</span></span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{new Date(l.created_at).toLocaleString('sv-SE')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PLANER ── */}
        {tab === 'plans' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {photographers.length === 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 16, padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>
                Inga fotografer med plan ännu. Planer skapas automatiskt (trial) när en fotograf skapar sitt första event.
              </div>
            )}
            {photographers.map(ph => (
              <div key={ph.user_id} style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 16, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'monospace' }}>{ph.user_id.slice(0, 12)}…</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: 'rgba(91,99,241,0.1)', color: 'var(--brand)', textTransform: 'uppercase' }}>{ph.plan_id}</span>
                      {ph.status === 'suspended' && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>Pausad</span>}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      Sökningar {ph.usage?.scans ?? 0}/{ph.limits?.max_scans_per_month} · Email {ph.usage?.emails ?? 0}/{ph.limits?.max_emails_per_month} · Downloads {ph.usage?.downloads ?? 0}/{ph.limits?.max_downloads_per_month}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <select value={ph.plan_id} onChange={e => setPlan(ph.user_id, e.target.value)} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid #EAEDF4', background: 'var(--surface)', cursor: 'pointer' }}>
                      <option value="trial">Trial</option>
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                      <option value="event_pack">Event Pack</option>
                    </select>
                    <button onClick={() => toggleSuspend(ph.user_id, ph.status)} style={{ fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 8, border: `1px solid ${ph.status === 'suspended' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, color: ph.status === 'suspended' ? '#16a34a' : 'var(--danger)', background: ph.status === 'suspended' ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                      {ph.status === 'suspended' ? 'Aktivera' : 'Pausa'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── EMAIL ── */}
        {tab === 'email' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 680 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 16, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>Email-status</p>
                <span style={{ fontSize: 12, fontWeight: 700, color: emailStatus?.configured ? 'var(--success)' : 'var(--danger)' }}>
                  {emailStatus?.configured ? 'Konfigurerad' : 'Not configured'}
                </span>
              </div>
              {!emailStatus?.configured && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#DC2626', marginBottom: 14 }}>
                  SMTP_USER / SMTP_PASSWORD saknas i backend. Mail skickas inte.
                </div>
              )}
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <div><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)' }}>{emailStatus?.pending ?? 0}</div><div style={{ fontSize: 11, color: 'var(--text-3)' }}>i kö</div></div>
                <div><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--danger)' }}>{emailStatus?.failed ?? 0}</div><div style={{ fontSize: 11, color: 'var(--text-3)' }}>misslyckade</div></div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="testmail@exempel.se" style={{ flex: 1, minWidth: 180, padding: '9px 12px', borderRadius: 10, border: '1px solid #EAEDF4', fontSize: 13, fontFamily: 'Inter,sans-serif' }} />
                <button onClick={sendTestEmail} className="ps-btn ps-btn-primary ps-btn-sm">Skicka testmail</button>
                <button onClick={flushEmailQueue} style={{ fontSize: 13, fontWeight: 600, padding: '9px 14px', borderRadius: 10, border: '1px solid #EAEDF4', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Töm kö</button>
              </div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #EAEDF4' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>Email-logg</p>
              </div>
              {(emailStatus?.logs ?? []).length === 0 && <p style={{ padding: '24px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>Inga mail loggade</p>}
              {(emailStatus?.logs ?? []).map((l: any) => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 20px', borderBottom: '1px solid #F2F4FA' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: l.status === 'sent' ? 'var(--success)' : 'var(--danger)', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.to_email}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{l.template ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 16, padding: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: 14 }}>Globala inställningar</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F2F4FA' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Underhållsläge</p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Stänger av hela gästflödet</p>
                </div>
                <Toggle on={settings?.maintenance_mode ?? false} onClick={() => saveSetting('maintenance_mode', !(settings?.maintenance_mode ?? false))} />
              </div>
              {[
                ['scans_enabled', 'Sökningar globalt'],
                ['downloads_enabled', 'Nedladdningar globalt'],
                ['uploads_enabled', 'Uppladdningar globalt'],
              ].map(([key, title]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F2F4FA' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{title}</p>
                  <Toggle on={settings?.[key] ?? true} onClick={() => saveSetting(key, !(settings?.[key] ?? true))} />
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 16, padding: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: 12 }}>System</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Backend</span><span style={{ color: usage ? 'var(--success)' : 'var(--danger)' }}>{usage ? 'Online' : 'Svarar ej'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>SuperAdmin-email</span><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{ADMIN_EMAIL}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Egress hard limit</span><span>{fmtBytes(4_800_000_000)}</span></div>
              </div>
              <button onClick={runCleanup} style={{ marginTop: 16, width: '100%', fontSize: 13, fontWeight: 600, padding: '11px', borderRadius: 10, border: '1px solid rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.06)', color: '#B45309', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                Kör cleanup nu (selfies 24h · cache · utgångna events)
              </button>
            </div>
          </div>
        )}
      </main>

      {toast && (
        <div className="ps-toast" style={{ left: '50%', transform: 'translateX(-50%)', right: 'auto', textAlign: 'center' }}>{toast}</div>
      )}
    </div>
  )
}
