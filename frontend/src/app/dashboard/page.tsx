'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Navbar } from '@/components/layout/Navbar'
import { formatDate } from '@/lib/utils'

interface Event {
  id: string; name: string; date: string | null; slug: string
  created_at: string; is_active: boolean; published_at: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [onboardingOpen, setOnboardingOpen] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data } = await supabase.from('events').select('*').eq('created_by', user.id).order('created_at', { ascending: false })
      setEvents(data ?? [])
      setLoading(false)
    }
    load()
  }, [router, supabase])

  async function createEvent() {
    if (!newName.trim()) return
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).slice(2, 6)
    const { data, error } = await supabase.from('events').insert({ name: newName, slug, created_by: user.id, is_active: true }).select().single()
    if (!error && data) {
      setEvents(prev => [data, ...prev])
      setShowCreate(false)
      setNewName('')
      router.push(`/dashboard/admin/${data.id}`)
    }
    setCreating(false)
  }

  const steps = [
    { label: 'Skapa ett event', done: events.length > 0 },
    { label: 'Ladda upp foton med ansikten', done: false },
    { label: 'Förhandsgranska gästupplevelsen', done: false },
    { label: 'Testa ansiktssökning', done: false },
  ]
  const progress = Math.round((steps.filter(s => s.done).length / steps.length) * 100)

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-5 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Events</h1>
            <p className="text-sm text-neutral-500 mt-0.5">{events.length} event{events.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-neutral-900 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-neutral-700 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nytt event
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => <div key={i} className="h-16 bg-neutral-200 rounded-2xl animate-pulse" />)}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-neutral-200 rounded-2xl">
            <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
            </div>
            <p className="text-neutral-500 text-sm mb-4">Inga events än</p>
            <button onClick={() => setShowCreate(true)}
              className="bg-neutral-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-neutral-700 transition-colors">
              Skapa ditt första event
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map(ev => (
              <Link key={ev.id} href={`/dashboard/admin/${ev.id}`}
                className="group flex items-center justify-between bg-white border border-neutral-100 rounded-2xl px-5 py-4 hover:border-neutral-300 hover:shadow-sm transition-all">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ev.is_active ? 'bg-green-400' : 'bg-neutral-300'}`} />
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{ev.name}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {ev.date ? formatDate(ev.date) : 'Inget datum'}
                      {ev.published_at && ' · Publicerat'}
                    </p>
                  </div>
                </div>
                <svg className="w-4 h-4 text-neutral-300 group-hover:text-neutral-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-neutral-900 mb-4">Nytt event</h2>
            <input autoFocus type="text" value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createEvent()}
              placeholder="T.ex. Johans bröllop" className="input mb-4" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)}
                className="text-sm text-neutral-500 px-4 py-2 rounded-xl hover:bg-neutral-100 transition-colors">Avbryt</button>
              <button onClick={createEvent} disabled={!newName.trim() || creating}
                className="bg-neutral-900 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-neutral-700 disabled:opacity-40 transition-colors flex items-center gap-1.5">
                {creating && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Skapa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding widget */}
      {onboardingOpen && (
        <div className="fixed bottom-4 left-4 w-[270px] bg-white border border-neutral-200 rounded-2xl shadow-xl z-40 overflow-hidden">
          <button onClick={() => setOnboardingOpen(false)}
            className="absolute top-3 right-3 text-neutral-400 hover:text-neutral-600 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 bg-neutral-900 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-neutral-900">Kom igång</p>
                <p className="text-[10px] text-neutral-400">{progress}% klart</p>
              </div>
            </div>
            <div className="h-1 bg-neutral-100 rounded-full overflow-hidden">
              <div className="h-full bg-neutral-900 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="px-3 pb-4 space-y-0.5">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-neutral-50 transition-colors cursor-pointer">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${step.done ? 'bg-neutral-900 border-neutral-900' : 'border-neutral-200'}`}>
                  {step.done && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className={`text-xs ${step.done ? 'text-neutral-400 line-through' : 'text-neutral-700'}`}>{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}