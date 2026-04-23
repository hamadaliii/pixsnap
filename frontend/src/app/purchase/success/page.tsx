'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export default function PurchaseSuccessPage() {
  const searchParams = useSearchParams()
  const purchaseId = searchParams.get('purchase_id') ?? ''
  const token = searchParams.get('token') ?? ''

  const [purchase, setPurchase] = useState<{ photo_ids: string[]; status: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!purchaseId) { setLoading(false); return }
    async function load() {
      try {
        const res = await fetch(`${API_URL}/purchase/${purchaseId}`)
        const data = await res.json()
        setPurchase(data)
      } catch {}
      setLoading(false)
    }
    load()
  }, [purchaseId])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 flex flex-col">
      <div className="h-12 border-b border-neutral-100 dark:border-neutral-900 flex items-center justify-center">
        <span className="text-xs font-semibold tracking-tight text-neutral-400">PixSnap</span>
      </div>
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-5">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50 mb-2">
            Betalning klar!
          </h1>
          {purchase && (
            <p className="text-sm text-neutral-500 mb-6">
              Du har köpt {purchase.photo_ids?.length ?? 0} foto{(purchase.photo_ids?.length ?? 0) > 1 ? 'n' : ''} i full kvalitet.
            </p>
          )}
          <div className="space-y-3">
            <a href={`${API_URL}/download/${purchaseId}`} download>
              <Button className="w-full" size="lg">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Ladda ner alla foton (zip)
              </Button>
            </a>
            {token && (
              <Link href={`/session/${token}`}>
                <Button variant="secondary" className="w-full">Tillbaka till galleriet</Button>
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}