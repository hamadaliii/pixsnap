'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export const PS_LOGO = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M9 1.5L2 5.5v7l7 4 7-4v-7L9 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
    <circle cx="9" cy="9" r="2.5" fill="currentColor"/>
  </svg>
)

interface NavbarProps {
  variant?: 'default' | 'transparent'
  showDashboardLinks?: boolean
}

export function Navbar({ variant = 'default', showDashboardLinks = false }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const handler = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const isTransparent = variant === 'transparent' && !scrolled

  return (
    <nav
      className="sticky top-0 z-50 h-14 flex items-center justify-between px-5 transition-all"
      style={{
        background: isTransparent ? 'transparent' : 'rgba(248,249,252,0.92)',
        backdropFilter: isTransparent ? 'none' : 'blur(20px)',
        borderBottom: isTransparent ? 'none' : '1px solid rgba(234,237,244,0.8)',
        boxShadow: scrolled ? '0 1px 12px rgba(0,0,0,0.06)' : 'none',
      }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 no-underline" style={{ color: 'var(--text-1)', textDecoration: 'none' }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white" style={{ background: 'var(--grad)' }}>
          {PS_LOGO}
        </div>
        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>PixSnap</span>
      </Link>

      {/* Dashboard nav links */}
      {showDashboardLinks && (
        <div className="hidden md:flex items-center gap-1">
          {[
            { href: '/dashboard', label: 'Events' },
            { href: '/dashboard/create-event', label: 'Nytt event' },
          ].map(({ href, label }) => (
            <Link key={href} href={href} className="ps-btn-ghost ps-btn ps-btn-sm" style={{ color: pathname === href ? 'var(--brand)' : 'var(--text-2)' }}>
              {label}
            </Link>
          ))}
        </div>
      )}

      {/* Right side */}
      <div className="flex items-center gap-2">
        {user ? (
          <>
            {/* Logout button — always visible */}
            <button
              onClick={signOut}
              className="ps-btn ps-btn-ghost ps-btn-sm hidden sm:flex"
              style={{ color: 'var(--text-2)', fontSize: 13 }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 12H3a1 1 0 01-1-1V3a1 1 0 011-1h2M9.5 9.5L12 7m0 0L9.5 4.5M12 7H5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Logga ut
            </button>

            {/* Avatar menu (mobile + extra) */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ background: 'var(--grad)' }}
              >
                {user.email?.[0]?.toUpperCase() ?? 'U'}
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 top-10 rounded-xl shadow-xl overflow-hidden z-50"
                  style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', minWidth: 180, boxShadow: 'var(--glass-sh-lg)' }}
                  onBlur={() => setMenuOpen(false)}
                >
                  <div className="px-4 py-3 border-b" style={{ borderColor: '#EAEDF4' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>Inloggad som</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{user.email}</p>
                  </div>
                  <div className="p-1">
                    <Link href="/dashboard" className="ps-sidebar-link" style={{ fontSize: 13 }} onClick={() => setMenuOpen(false)}>
                      Dashboard
                    </Link>
                    <button onClick={signOut} className="ps-sidebar-link w-full" style={{ fontSize: 13, color: 'var(--danger)' }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M5 12H3a1 1 0 01-1-1V3a1 1 0 011-1h2M9.5 9.5L12 7m0 0L9.5 4.5M12 7H5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Logga ut
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <Link href="/auth/login" className="ps-btn ps-btn-ghost ps-btn-sm" style={{ fontSize: 13 }}>
              Logga in
            </Link>
            <Link href="/auth/register" className="ps-btn ps-btn-primary ps-btn-sm" style={{ textDecoration: 'none' }}>
              Kom igång
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
