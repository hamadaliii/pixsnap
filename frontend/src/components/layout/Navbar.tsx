'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function Navbar({ credits }: { credits?: number }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [showMenu, setShowMenu] = useState(false)
  const isDashboard = pathname?.startsWith('/dashboard')

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <nav className="h-[52px] border-b border-neutral-100 flex items-center justify-between px-5 bg-white sticky top-0 z-50">
      <Link href="/" className="flex items-center gap-2.5">
        <div className="w-7 h-7 bg-neutral-900 rounded-[8px] flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <span className="font-bold text-sm text-neutral-900">PixSnap</span>
      </Link>

      {isDashboard && (
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center hover:bg-neutral-200 transition-colors">
            <svg className="w-4 h-4 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
          {showMenu && (
            <div className="absolute right-0 top-10 bg-white border border-neutral-100 rounded-xl shadow-lg p-1 min-w-[140px] z-50">
              <Link href="/dashboard" className="block px-3 py-2 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded-lg transition-colors" onClick={() => setShowMenu(false)}>
                Dashboard
              </Link>
              <div className="h-px bg-neutral-100 my-1" />
              <button onClick={handleSignOut} className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                Logga ut
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}