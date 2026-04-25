'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PS_LOGO } from '@/components/layout/Navbar'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [terms, setTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!terms) { setError('Du måste godkänna villkoren för att fortsätta.'); return }
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setLoading(false) }
    else { setSuccess(true); setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid #EAEDF4', background: 'var(--surface)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text-1)' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            {PS_LOGO}
          </div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>PixSnap</span>
        </Link>
        <Link href="/auth/login" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>
          Har du konto? <strong style={{ color: 'var(--brand)' }}>Logga in</strong>
        </Link>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {success ? (
          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 11l5 5 9-9" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', marginBottom: 8 }}>Kolla din e-post!</h2>
            <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.6 }}>
              Vi skickade en bekräftelselänk till <strong style={{ color: 'var(--text-1)' }}>{email}</strong>.
              Klicka på länken för att aktivera ditt konto.
            </p>
            <Link href="/auth/login" className="ps-btn ps-btn-primary ps-btn-sm" style={{ textDecoration: 'none' }}>
              Gå till inloggning
            </Link>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: 380 }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'white' }}>
                {PS_LOGO}
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', marginBottom: 6 }}>
                Skapa konto
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>För fotografer och eventarrangörer</p>
            </div>

            <div className="ps-card glass-strong" style={{ padding: 28, borderRadius: 20 }}>
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="ps-label">E-postadress</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="du@exempel.se" required className="ps-input" autoComplete="email" />
                </div>
                <div>
                  <label className="ps-label">Lösenord</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Minst 8 tecken" required minLength={8} className="ps-input"
                    autoComplete="new-password" />
                </div>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)}
                    style={{ marginTop: 2, width: 15, height: 15, accentColor: 'var(--brand)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                    Jag godkänner PixSnaps{' '}
                    <Link href="/privacy" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>
                      integritetspolicy
                    </Link>
                    {' '}och bekräftar att jag har rätt att ladda upp foton jag använder.
                  </span>
                </label>

                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 10, padding: '10px 14px' }}>
                    <p style={{ fontSize: 13, color: 'var(--danger)', margin: 0 }}>{error}</p>
                  </div>
                )}

                <button type="submit" disabled={loading || !terms} className="ps-btn ps-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
                  {loading && <span className="ps-spin ps-spin-sm ps-spin-white" />}
                  {loading ? 'Skapar konto…' : 'Skapa konto gratis'}
                </button>
              </form>
            </div>

            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)', marginTop: 16 }}>
              Har du redan konto?{' '}
              <Link href="/auth/login" style={{ color: 'var(--brand)', fontWeight: 600, textDecoration: 'none' }}>
                Logga in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
