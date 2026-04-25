'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PS_LOGO } from '@/components/layout/Navbar'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPass, setShowPass] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Fel e-post eller lösenord. Försök igen.'); setLoading(false) }
    else { router.push('/dashboard'); router.refresh() }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid #EAEDF4', background: 'var(--surface)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text-1)' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            {PS_LOGO}
          </div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>PixSnap</span>
        </Link>
        <Link href="/auth/register" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>
          Inget konto? <strong style={{ color: 'var(--brand)' }}>Registrera dig</strong>
        </Link>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'white' }}>
              {PS_LOGO}
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', marginBottom: 6 }}>
              Välkommen tillbaka
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Logga in på ditt PixSnap-konto</p>
          </div>

          {/* Form card */}
          <div className="ps-card glass-strong" style={{ padding: 28, borderRadius: 20 }}>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="ps-label">E-postadress</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="du@exempel.se" required className="ps-input"
                  autoComplete="email"
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label className="ps-label" style={{ margin: 0 }}>Lösenord</label>
                  <span style={{ fontSize: 12, color: 'var(--brand)', cursor: 'pointer' }}>Glömt lösenord?</span>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required className="ps-input"
                    style={{ paddingRight: 42 }}
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0, display: 'flex' }}>
                    {showPass
                      ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M6.5 6.7A3 3 0 0011 10M4.5 4.6A7 7 0 001 8c1.3 2.5 3.9 4 7 4 1.1 0 2.1-.2 3-.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M6.5 4.2C7 4.1 7.5 4 8 4c3.1 0 5.7 1.5 7 4a8 8 0 01-2 2.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8c1.3-2.5 3.9-4 7-4s5.7 1.5 7 4c-1.3 2.5-3.9 4-7 4s-5.7-1.5-7-4z" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3"/></svg>
                    }
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 10, padding: '10px 14px' }}>
                  <p style={{ fontSize: 13, color: 'var(--danger)', margin: 0 }}>{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading} className="ps-btn ps-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
                {loading && <span className="ps-spin ps-spin-sm ps-spin-white" />}
                {loading ? 'Loggar in…' : 'Logga in'}
              </button>
            </form>
          </div>

          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)', marginTop: 16 }}>
            Inget konto?{' '}
            <Link href="/auth/register" style={{ color: 'var(--brand)', fontWeight: 600, textDecoration: 'none' }}>
              Skapa ett gratis
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
