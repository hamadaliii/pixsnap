'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { getEventUrl } from '@/lib/utils'
import type { Event } from '@/types'

type Template = 'minimal' | 'elegant' | 'bold'

export default function QRPosterPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [event, setEvent] = useState<Event | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [template, setTemplate] = useState<Template>('elegant')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: ev } = await supabase.from('events').select('*').eq('id', id).eq('created_by', user.id).single()
      if (!ev) { router.push('/dashboard'); return }
      setEvent(ev)
      const url = getEventUrl(ev.slug)
      const qr = await QRCode.toDataURL(url, { width: 300, margin: 1, color: { dark: '#111111', light: '#ffffff' } })
      setQrDataUrl(qr)
    }
    load()
  }, [id, router, supabase])

  if (!event || !qrDataUrl) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
    </div>
  )

  const dateStr = event.date
    ? new Date(event.date).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* Controls */}
      <div className="no-print bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/admin/${id}`} className="text-sm text-neutral-500 hover:text-neutral-800">← Tillbaka</Link>
          <div className="flex gap-2">
            {(['minimal', 'elegant', 'bold'] as Template[]).map(t => (
              <button key={t} onClick={() => setTemplate(t)}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                  template === t ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}>
                {t === 'minimal' ? '◻ Minimal' : t === 'elegant' ? '◈ Elegant' : '◼ Bold'}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={() => window.print()}>🖨 Skriv ut / Spara PDF</Button>
      </div>

      {/* A4 poster */}
      <div className="flex justify-center py-8 px-4">
        <div className="bg-white shadow-2xl print-area" style={{ width: '210mm', minHeight: '297mm' }}>

          {template === 'minimal' && (
            <div style={{ padding: '40mm 20mm', textAlign: 'center', minHeight: '297mm', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '28px' }}>
              <p style={{ fontSize: '10px', letterSpacing: '5px', textTransform: 'uppercase', color: '#aaa', margin: 0 }}>PixSnap</p>
              <h1 style={{ fontSize: '44px', fontWeight: '700', color: '#111', margin: 0, lineHeight: 1.1 }}>{event.name}</h1>
              {dateStr && <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>{dateStr}</p>}
              <div style={{ width: '48px', height: '2px', background: '#111', margin: '4px 0' }} />
              <p style={{ fontSize: '19px', color: '#444', margin: 0, maxWidth: '380px', lineHeight: 1.6 }}>
                Skanna koden och hitta alla foton på dig från eventet
              </p>
              <div style={{ background: '#fff', padding: '16px', border: '1px solid #e5e5e5', borderRadius: '12px' }}>
                <img src={qrDataUrl} alt="QR" style={{ width: '200px', height: '200px', display: 'block' }} />
              </div>
              <p style={{ fontSize: '12px', color: '#bbb', margin: 0 }}>Inga appar behövs · Tar bara 30 sekunder · pixsnap.se</p>
            </div>
          )}

          {template === 'elegant' && (
            <div style={{ minHeight: '297mm', display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: '#111', padding: '52px 44px 44px', textAlign: 'center' }}>
                <p style={{ fontSize: '10px', letterSpacing: '5px', textTransform: 'uppercase', color: '#666', margin: '0 0 20px' }}>PixSnap · Eventfoto</p>
                <h1 style={{ fontSize: '40px', fontWeight: '700', color: '#fff', margin: '0 0 10px', lineHeight: 1.1 }}>{event.name}</h1>
                {dateStr && <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>{dateStr}</p>}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 40px', textAlign: 'center', gap: '28px' }}>
                <p style={{ fontSize: '22px', color: '#111', fontWeight: '600', margin: 0, maxWidth: '360px', lineHeight: 1.4 }}>
                  Alla dina eventfoton — direkt i din hand
                </p>
                <p style={{ fontSize: '15px', color: '#777', margin: 0, maxWidth: '340px', lineHeight: 1.7 }}>
                  Skanna QR-koden, ta en selfie och se alla foton fotografen tagit på dig. Inga appar, inga konton behövs.
                </p>
                <div style={{ position: 'relative', padding: '20px' }}>
                  <div style={{ position: 'absolute', inset: 0, border: '1.5px solid #ddd', borderRadius: '20px' }} />
                  <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                    <img src={qrDataUrl} alt="QR" style={{ width: '220px', height: '220px', display: 'block' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '28px' }}>
                  {['📸 Hitta dina foton', '⚡ 30 sekunder', '🔒 Säkert & privat'].map(item => (
                    <p key={item} style={{ fontSize: '12px', color: '#888', margin: 0 }}>{item}</p>
                  ))}
                </div>
              </div>
              <div style={{ background: '#fafafa', borderTop: '1px solid #eee', padding: '18px 40px', textAlign: 'center' }}>
                <p style={{ fontSize: '11px', color: '#bbb', margin: 0 }}>pixsnap.se · Selfier raderas automatiskt inom 24 timmar</p>
              </div>
            </div>
          )}

          {template === 'bold' && (
            <div style={{ minHeight: '297mm', display: 'flex', flexDirection: 'column', background: '#fff' }}>
              <div style={{ height: '6px', background: '#111' }} />
              <div style={{ flex: 1, padding: '44px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: '10px', letterSpacing: '5px', textTransform: 'uppercase', color: '#ccc', margin: '0 0 16px' }}>PixSnap</p>
                  <h1 style={{ fontSize: '56px', fontWeight: '800', color: '#111', margin: 0, lineHeight: 1, letterSpacing: '-2px' }}>{event.name}</h1>
                  {dateStr && <p style={{ fontSize: '16px', color: '#999', margin: '12px 0 0' }}>{dateStr}</p>}
                </div>
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <p style={{ fontSize: '34px', fontWeight: '800', color: '#111', margin: '0 0 8px', lineHeight: 1.1, letterSpacing: '-1px' }}>
                    Finns du på<br />eventets bilder?
                  </p>
                  <p style={{ fontSize: '16px', color: '#888', margin: '0 0 36px' }}>
                    Skanna · Ta en selfie · Se alla dina foton
                  </p>
                  <div style={{ display: 'inline-block', background: '#111', padding: '20px', borderRadius: '18px' }}>
                    <img src={qrDataUrl} alt="QR" style={{ width: '230px', height: '230px', display: 'block', filter: 'invert(1)' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <p style={{ fontSize: '12px', color: '#ccc', margin: 0 }}>Powered by</p>
                    <p style={{ fontSize: '20px', fontWeight: '800', color: '#111', margin: '2px 0 0' }}>PixSnap</p>
                  </div>
                  <p style={{ fontSize: '12px', color: '#ccc', margin: 0, textAlign: 'right' }}>pixsnap.se<br />Inga appar behövs</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          .print-area { box-shadow: none !important; margin: 0 !important; }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </div>
  )
}