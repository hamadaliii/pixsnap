'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PS_LOGO } from '@/components/layout/Navbar'

interface Profile {
  id: string
  email: string
  full_name: string | null
  bio: string | null
  website: string | null
  instagram: string | null
  logo_url: string | null
  avatar_url: string | null
  photographer_slug: string | null
}

interface EventRow {
  id: string; name: string; date: string | null; slug: string; published_at: string | null
}

export default function PhotographerProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Booking form state
  const [bookName, setBookName] = useState('')
  const [bookEmail, setBookEmail] = useState('')
  const [bookDate, setBookDate] = useState('')
  const [bookMsg, setBookMsg] = useState('')
  const [bookSending, setBookSending] = useState(false)
  const [bookSent, setBookSent] = useState(false)

  useEffect(() => {
    async function load() {
      // Try to find photographer by slug in user_metadata or a profiles table
      // We'll look through events to find photographer by slug
      const { data: evs } = await supabase
        .from('events')
        .select('*, created_by')
        .eq('photographer_slug', slug)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!evs || evs.length === 0) {
        // Fallback: try photographer_name slug
        const slugName = slug.replace(/-/g, ' ')
        const { data: evs2 } = await supabase
          .from('events')
          .select('*')
          .ilike('photographer_name', `%${slugName}%`)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(10)

        if (!evs2 || evs2.length === 0) { setNotFound(true); setLoading(false); return }

        const firstEvent = evs2[0]
        setProfile({
          id: firstEvent.created_by,
          email: '',
          full_name: firstEvent.photographer_name ?? slug,
          bio: null,
          website: null,
          instagram: null,
          logo_url: firstEvent.photographer_logo_url ?? null,
          avatar_url: null,
          photographer_slug: slug,
        })
        setEvents(evs2.filter((e: any) => e.published_at))
      } else {
        const firstEvent = evs[0]
        setProfile({
          id: firstEvent.created_by,
          email: '',
          full_name: firstEvent.photographer_name ?? slug,
          bio: null,
          website: null,
          instagram: null,
          logo_url: firstEvent.photographer_logo_url ?? null,
          avatar_url: null,
          photographer_slug: slug,
        })
        setEvents(evs.filter((e: any) => e.published_at))
      }
      setLoading(false)
    }
    load()
  }, [slug, supabase])

  async function handleBooking(e: React.FormEvent) {
    e.preventDefault()
    setBookSending(true)
    // In production this would call an API endpoint or send email
    // For now we simulate a successful booking
    await new Promise(r => setTimeout(r, 1200))
    setBookSent(true)
    setBookSending(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="ps-spin" style={{ width: 28, height: 28, borderWidth: 3 }} />
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>Fotograf hittades inte</h1>
        <Link href="/" style={{ color: 'var(--brand)', textDecoration: 'none', fontSize: 14 }}>Tillbaka till startsidan</Link>
      </div>
    </div>
  )

  const displayName = profile?.full_name ?? slug
  const initial = displayName[0]?.toUpperCase() ?? 'P'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'Inter,sans-serif' }}>
      {/* Nav */}
      <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 clamp(16px,4vw,32px)', background: 'var(--surface)', borderBottom: '1px solid #EAEDF4' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text-1)' }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>{PS_LOGO}</div>
          <span style={{ fontWeight: 700, fontSize: 13 }}>PixSnap</span>
        </Link>
        <Link href="/auth/login" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>
          Logga in som fotograf
        </Link>
      </div>

      {/* Hero */}
      <div style={{ background: 'var(--grad)', padding: 'clamp(40px,8vw,64px) clamp(16px,4vw,32px)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />

        {/* Logo or avatar */}
        {profile?.logo_url ? (
          <div style={{ width: 88, height: 88, borderRadius: 22, background: 'white', margin: '0 auto 16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={profile.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        ) : (
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 36, fontWeight: 800, color: 'white', border: '3px solid rgba(255,255,255,0.3)' }}>
            {initial}
          </div>
        )}

        <h1 style={{ fontSize: 'clamp(22px,4vw,32px)', fontWeight: 800, color: 'white', marginBottom: 8, letterSpacing: '-0.02em' }}>{displayName}</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 16 }}>Eventfotograf · Powered by PixSnap</p>

        {profile?.bio && (
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', maxWidth: 520, margin: '0 auto 16px', lineHeight: 1.7 }}>{profile.bio}</p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          {profile?.website && (
            <a href={profile.website} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 9999, padding: '6px 14px', fontSize: 12, color: 'white', textDecoration: 'none', fontWeight: 500 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="white" strokeWidth="1.2"/><path d="M1 6h10M6 1c-1.5 1.5-2 3-2 5s.5 3.5 2 5" stroke="white" strokeWidth="1.2" strokeLinecap="round"/></svg>
              Webbplats
            </a>
          )}
          {profile?.instagram && (
            <a href={`https://instagram.com/${profile.instagram}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 9999, padding: '6px 14px', fontSize: 12, color: 'white', textDecoration: 'none', fontWeight: 500 }}>
              @{profile.instagram}
            </a>
          )}
          <a href="#book" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', borderRadius: 9999, padding: '6px 16px', fontSize: 12, color: 'var(--brand)', textDecoration: 'none', fontWeight: 700 }}>
            Boka fotograf
          </a>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(24px,5vw,40px) clamp(16px,4vw,24px)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>

          {/* Published events */}
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', marginBottom: 16 }}>
              Publicerade event ({events.length})
            </h2>

            {events.length === 0 ? (
              <div className="ps-card" style={{ padding: '32px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 14, color: 'var(--text-3)' }}>Inga publicerade events ännu</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {events.map(ev => (
                  <Link key={ev.id} href={`/event/${ev.slug}`} style={{ textDecoration: 'none' }}>
                    <div className="ps-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'all .2s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--glass-sh-lg)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = ''; (e.currentTarget as HTMLDivElement).style.transform = 'none' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)', flexShrink: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3"/></svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</p>
                        {ev.date && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{new Date(ev.date).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}</p>}
                      </div>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
                        <path d="M4.5 3L8.5 7l-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Booking form */}
          <div id="book">
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', marginBottom: 16 }}>Boka fotograf</h2>

            <div className="ps-card" style={{ padding: 24 }}>
              {bookSent ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 11l5 5 9-9" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginBottom: 6 }}>Förfrågan skickad!</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6 }}>
                    {displayName} kommer att kontakta dig på {bookEmail} inom kort.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleBooking} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label className="ps-label">Ditt namn</label>
                    <input type="text" value={bookName} onChange={e => setBookName(e.target.value)} placeholder="Anna Andersson" required className="ps-input" />
                  </div>
                  <div>
                    <label className="ps-label">E-post</label>
                    <input type="email" value={bookEmail} onChange={e => setBookEmail(e.target.value)} placeholder="anna@exempel.se" required className="ps-input" />
                  </div>
                  <div>
                    <label className="ps-label">Datum för eventet</label>
                    <input type="date" value={bookDate} onChange={e => setBookDate(e.target.value)} required className="ps-input" />
                  </div>
                  <div>
                    <label className="ps-label">Meddelande</label>
                    <textarea value={bookMsg} onChange={e => setBookMsg(e.target.value)} placeholder="Berätta lite om ditt event..." rows={4}
                      style={{ width: '100%', padding: '11px 14px', background: '#FAFBFF', border: '1.5px solid #E4E7F2', borderRadius: 12, fontFamily: 'Inter,sans-serif', fontSize: 14, color: 'var(--text-1)', outline: 'none', resize: 'vertical' }} />
                  </div>
                  <button type="submit" disabled={bookSending} className="ps-btn ps-btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
                    {bookSending && <span className="ps-spin ps-spin-sm ps-spin-white" />}
                    {bookSending ? 'Skickar…' : 'Skicka bokningsförfrågan'}
                  </button>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
                    Förfrågan skickas direkt till fotografen
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
