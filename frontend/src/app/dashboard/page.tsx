'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate, generateSlug } from '@/lib/utils'

interface EventRow {
  id: string; name: string; date: string | null; slug: string
  created_at: string; is_active: boolean; published_at: string | null
}

function StatCard({ value, label, icon }: { value: string | number; label: string; icon: React.ReactNode }) {
  return (
    <div className="ps-card" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)' }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, fontWeight: 500 }}>{label}</div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [events, setEvents] = useState<EventRow[]>([])
  const [photoCount, setPhotoCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: evs } = await supabase
        .from('events').select('*').eq('created_by', user.id).order('created_at', { ascending: false })
      setEvents(evs ?? [])

      if (evs && evs.length > 0) {
        const ids = evs.map((e: EventRow) => e.id)
        const { count } = await supabase.from('photos').select('*', { count: 'exact', head: true }).in('event_id', ids)
        setPhotoCount(count ?? 0)
      }
      setLoading(false)
    }
    load()
  }, [router, supabase])

  async function createEvent() {
    if (!newName.trim()) return
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const slug = generateSlug(newName)
    const { data, error } = await supabase.from('events')
      .insert({ name: newName.trim(), slug, created_by: user.id, is_active: true })
      .select().single()
    if (!error && data) {
      setShowCreate(false); setNewName('')
      router.push(`/dashboard/admin/${data.id}`)
    }
    setCreating(false)
  }

  const activeCount = events.filter(e => e.is_active).length
  const publishedCount = events.filter(e => e.published_at).length

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.025em', marginBottom: 4 }}>
            Dina events
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Hantera dina eventgallerier och inställningar</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="ps-btn ps-btn-primary ps-btn-sm">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1.5v10M1.5 6.5h10" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Nytt event
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 28 }}>
        <StatCard value={events.length} label="Totalt antal events" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/></svg>} />
        <StatCard value={activeCount} label="Aktiva events" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5.5 8l2 2 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>} />
        <StatCard value={photoCount} label="Foton uppladdade" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3"/></svg>} />
        <StatCard value={publishedCount} label="Publicerade" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2l1.5 3.5L13 6 10.5 8.5l.5 3.5L8 10.5 5 12l.5-3.5L3 6l3.5-.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>} />
      </div>

      {/* Events list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ height: 68, background: '#F2F4FA', borderRadius: 16, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div style={{ border: '2px dashed #E4E7F2', borderRadius: 20, padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--brand)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginBottom: 6 }}>Inga events ännu</h3>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20, maxWidth: 300, margin: '0 auto 20px' }}>
            Skapa ditt första event för att börja leverera foton till dina gäster.
          </p>
          <button onClick={() => setShowCreate(true)} className="ps-btn ps-btn-primary ps-btn-sm">
            Skapa ditt första event
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {events.map(ev => (
            <Link
              key={ev.id}
              href={`/dashboard/admin/${ev.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div
                className="ps-card"
                style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, transition: 'all .2s', cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--glass-sh-lg)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; (e.currentTarget as HTMLDivElement).style.transform = 'none' }}
              >
                {/* Status dot */}
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: ev.is_active ? 'var(--success)' : '#DDE0EE', flexShrink: 0 }} />

                {/* Icon */}
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="1" y="3" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.3"/>
                    <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
                  </svg>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-1)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ev.name}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {ev.date ? formatDate(ev.date) : 'Inget datum'}
                    {ev.published_at ? ' · Publicerat' : ' · Ej publicerat'}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {ev.is_active ? (
                    <span className="badge badge-green">Aktivt</span>
                  ) : (
                    <span className="badge badge-gray">Inaktivt</span>
                  )}
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
                    <path d="M4.5 3L8.5 7l-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create event modal */}
      {showCreate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 500 }}
          onClick={() => setShowCreate(false)}
        >
          <div
            className="ps-card glass-strong"
            style={{ width: '100%', maxWidth: 400, padding: 28, animation: 'fadeUp .3s ease' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>Nytt event</h2>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Ge ditt event ett namn för att komma igång</p>

            <div style={{ marginBottom: 16 }}>
              <label className="ps-label">Eventnamn</label>
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createEvent()}
                placeholder="T.ex. Anna & Johans bröllop"
                className="ps-input"
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreate(false)} className="ps-btn ps-btn-ghost ps-btn-sm">Avbryt</button>
              <button onClick={createEvent} disabled={!newName.trim() || creating} className="ps-btn ps-btn-primary ps-btn-sm">
                {creating && <span className="ps-spin ps-spin-sm ps-spin-white" />}
                Skapa event
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
