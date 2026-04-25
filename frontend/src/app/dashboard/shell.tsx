'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PS_LOGO } from '@/components/layout/Navbar'

const SIDEBAR_W = 220

const NAV = [
  {
    section: 'Main',
    items: [
      { href: '/dashboard', exact: true, label: 'Events', icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="8.5" y="1" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="8.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/></svg> },
      { href: '/dashboard/create-event', exact: false, label: 'Nytt event', icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 2v11M2 7.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
    ],
  },
  {
    section: 'Verktyg',
    items: [
      { href: '/dashboard/qr-poster', exact: false, label: 'QR-affischer', icon: <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="9" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M9 9h2v2H9zM12 9h2M9 12v2M12 12h2v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> },
    ],
  },
]

export default function DashboardShell({ children, userEmail }: { children: React.ReactNode; userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(true) // default true to avoid flash

  useEffect(() => {
    function check() { setIsDesktop(window.innerWidth >= 768) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => { setDrawerOpen(false) }, [pathname])

  async function signOut() {
    await supabase.auth.signOut(); router.push('/'); router.refresh()
  }

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  const pageTitle = pathname === '/dashboard' ? 'Events'
    : pathname.startsWith('/dashboard/create-event') ? 'Nytt event'
    : pathname.startsWith('/dashboard/admin') ? 'Event Admin'
    : pathname.startsWith('/dashboard/qr-poster') ? 'QR-affischer'
    : 'Dashboard'

  function SidebarInner() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Logo */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #EAEDF4', flexShrink: 0 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: 'var(--text-1)' }}
            onClick={() => setDrawerOpen(false)}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
              {PS_LOGO}
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>PixSnap</span>
          </Link>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, padding: '8px 8px', overflowY: 'auto' }}>
          {NAV.map(({ section, items }) => (
            <div key={section}>
              <p className="ps-sidebar-section">{section}</p>
              {items.map(({ href, exact, label, icon }) => (
                <Link key={href} href={href} className={`ps-sidebar-link ${isActive(href, exact) ? 'active' : ''}`}
                  onClick={() => setDrawerOpen(false)}>
                  <span style={{ opacity: 0.75, display: 'flex' }}>{icon}</span>
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        {/* User + logout */}
        <div style={{ padding: '8px 8px 16px', borderTop: '1px solid #EAEDF4', flexShrink: 0 }}>
          <div style={{ padding: '6px 12px 10px' }}>
            <p style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Inloggad som</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</p>
          </div>
          <button onClick={signOut} className="ps-sidebar-link" style={{ color: 'var(--danger)', width: '100%' }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M5.5 13H3a1.5 1.5 0 01-1.5-1.5v-9A1.5 1.5 0 013 1h2.5M10.5 10.5L13.5 7.5m0 0L10.5 4.5M13.5 7.5H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Logga ut
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* DESKTOP: Fixed sidebar that pushes content via marginLeft on main */}
      {isDesktop && (
        <aside style={{ width: SIDEBAR_W, flexShrink: 0, position: 'fixed', top: 0, left: 0, bottom: 0, background: 'var(--surface)', borderRight: '1px solid #EAEDF4', zIndex: 100 }}>
          <SidebarInner />
        </aside>
      )}

      {/* MOBILE: Drawer that overlays — never pushes content */}
      {!isDesktop && drawerOpen && (
        <>
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)', zIndex: 200, animation: 'fadeInBg .2s ease' }}
          />
          <aside style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: SIDEBAR_W, background: 'var(--surface)', borderRight: '1px solid #EAEDF4', zIndex: 201, boxShadow: '4px 0 24px rgba(0,0,0,0.14)', animation: 'slideFromLeft .25s ease' }}>
            {/* Close X */}
            <button onClick={() => setDrawerOpen(false)} style={{ position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: '50%', background: 'var(--surface-2)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', zIndex: 1 }}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            </button>
            <SidebarInner />
          </aside>
        </>
      )}

      {/* MAIN — on desktop, offset by sidebar width */}
      <div style={{ flex: 1, marginLeft: isDesktop ? SIDEBAR_W : 0, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: '100vh' }}>

        {/* Topbar */}
        <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: 'var(--surface)', borderBottom: '1px solid #EAEDF4', position: 'sticky', top: 0, zIndex: 50, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {!isDesktop && (
              <button onClick={() => setDrawerOpen(true)} style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--surface-2)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              </button>
            )}
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pageTitle}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button onClick={signOut} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--text-3)', fontFamily: 'Inter,sans-serif' }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M5 12H3a1 1 0 01-1-1V2a1 1 0 011-1h2M8.5 8.5L11 6m0 0L8.5 3.5M11 6H5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {isDesktop && 'Logga ut'}
            </button>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>
              {userEmail[0]?.toUpperCase() ?? 'U'}
            </div>
          </div>
        </div>

        {/* Page content */}
        <main style={{ flex: 1, padding: isDesktop ? '28px 32px' : '16px 16px', maxWidth: 1200, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          {children}
        </main>
      </div>

      <style>{`
        @keyframes fadeInBg { from{opacity:0} to{opacity:1} }
        @keyframes slideFromLeft { from{transform:translateX(-100%)} to{transform:translateX(0)} }
      `}</style>
    </div>
  )
}
