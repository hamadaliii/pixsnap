'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
      options: { emailRedirectTo: `${window.location.origin}/auth/callback`, data: { terms_accepted_at: new Date().toISOString() } },
    })
    if (error) { setError(error.message); setLoading(false) }
    else { setSuccess(true); setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <nav className="h-[56px] border-b border-neutral-100 flex items-center px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-neutral-900 rounded-[8px] flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <span className="font-bold text-sm text-neutral-900">PixSnap</span>
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        {success ? (
          <div className="w-full max-w-[360px] text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-neutral-900 mb-2">Kolla din email</h2>
            <p className="text-sm text-neutral-500 mb-6">Vi skickade en bekräftelselänk till <strong>{email}</strong></p>
            <Link href="/auth/login" className="text-sm text-neutral-900 font-medium hover:underline">Gå till inloggning</Link>
          </div>
        ) : (
          <div className="w-full max-w-[360px]">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-neutral-900 mb-2">Skapa konto</h1>
              <p className="text-sm text-neutral-500">För fotografer och eventarrangörer</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1.5">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="du@exempel.se" required
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 focus:bg-white transition-colors placeholder:text-neutral-300" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1.5">Lösenord</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Minst 8 tecken" required minLength={8}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 focus:bg-white transition-colors placeholder:text-neutral-300" />
              </div>

              <label className="flex items-start gap-3 cursor-pointer mt-2">
                <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-neutral-300 accent-neutral-900 flex-shrink-0" />
                <span className="text-xs text-neutral-500 leading-relaxed">
                  Jag godkänner PixSnaps{' '}
                  <Link href="/privacy" className="text-neutral-900 font-medium hover:underline">integritetspolicy</Link>
                  {' '}och bekräftar att jag har rätt att ladda upp de foton jag använder i tjänsten.
                </span>
              </label>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading || !terms}
                className="w-full bg-neutral-900 text-white text-sm font-semibold py-3 rounded-xl hover:bg-neutral-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2">
                {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {loading ? 'Skapar konto…' : 'Skapa konto'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-neutral-400">
              Har du redan konto?{' '}
              <Link href="/auth/login" className="text-neutral-900 font-medium hover:underline">Logga in</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}