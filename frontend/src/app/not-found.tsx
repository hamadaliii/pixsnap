import Link from 'next/link'
import { PS_LOGO } from '@/components/layout/Navbar'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: 'white' }}>
          {PS_LOGO}
        </div>
        <div style={{ fontSize: 64, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 12 }}>
          404
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>Sidan hittades inte</h1>
        <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 28, lineHeight: 1.6 }}>
          Sidan du letar efter verkar inte finnas. Kanske har länken ändrats?
        </p>
        <Link href="/" className="ps-btn ps-btn-primary ps-btn-sm" style={{ textDecoration: 'none' }}>
          Tillbaka till startsidan
        </Link>
      </div>
    </div>
  )
}
