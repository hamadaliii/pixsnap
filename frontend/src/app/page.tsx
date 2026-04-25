'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform, useInView, useSpring, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PS_LOGO } from '@/components/layout/Navbar'

/* ── Motion variants ─────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 40, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
}
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
}
const cardItem = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
}

/* ── Scroll-reveal wrapper ───────────────── */
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.2 })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40, filter: 'blur(6px)' }}
      animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ── Magnetic button ─────────────────────── */
function MagneticBtn({ children, href, className = '', style = {} }: { children: React.ReactNode; href: string; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const x = useSpring(0, { stiffness: 400, damping: 25 })
  const y = useSpring(0, { stiffness: 400, damping: 25 })
  return (
    <motion.a
      ref={ref}
      href={href}
      style={{ x, y, ...style }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect()
        if (!rect) return
        x.set((e.clientX - rect.left - rect.width / 2) * 0.25)
        y.set((e.clientY - rect.top - rect.height / 2) * 0.25)
      }}
      onMouseLeave={() => { x.set(0); y.set(0) }}
      className={className}
    >
      {children}
    </motion.a>
  )
}

/* ── Lift card ───────────────────────────── */
function LiftCard({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div
      className={`ps-card ${className}`}
      style={style}
      whileHover={{ y: -10, scale: 1.015, boxShadow: '0 24px 60px rgba(91,99,241,0.16), 0 8px 24px rgba(0,0,0,0.08)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
    >
      {children}
    </motion.div>
  )
}

/* ── 3D Camera SVG ───────────────────────── */
const CameraFig = () => (
  <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
    <ellipse cx="36" cy="65" rx="24" ry="5" fill="rgba(91,99,241,0.13)"/>
    <rect x="8" y="22" width="56" height="34" rx="8" fill="url(#cb)"/>
    <rect x="12" y="18" width="20" height="8" rx="4" fill="url(#ct)"/>
    <circle cx="36" cy="39" r="12" fill="#12123A"/>
    <circle cx="36" cy="39" r="9" fill="url(#cl)"/>
    <circle cx="36" cy="39" r="5" fill="#06061F"/>
    <circle cx="33" cy="36" r="2.5" fill="rgba(255,255,255,0.45)"/>
    <rect x="54" y="25" width="8" height="5" rx="2" fill="url(#cf)"/>
    <defs>
      <linearGradient id="cb" x1="8" y1="22" x2="64" y2="56" gradientUnits="userSpaceOnUse"><stop stopColor="#374151"/><stop offset="1" stopColor="#1F2937"/></linearGradient>
      <linearGradient id="ct" x1="12" y1="18" x2="32" y2="26" gradientUnits="userSpaceOnUse"><stop stopColor="#4B5563"/><stop offset="1" stopColor="#374151"/></linearGradient>
      <radialGradient id="cl" cx="38%" cy="34%" r="60%"><stop stopColor="#5B63F1" stopOpacity=".9"/><stop offset="1" stopColor="#1a1a4e"/></radialGradient>
      <linearGradient id="cf" x1="54" y1="25" x2="62" y2="30" gradientUnits="userSpaceOnUse"><stop stopColor="#FDE68A"/><stop offset="1" stopColor="#F59E0B"/></linearGradient>
    </defs>
  </svg>
)

const QRFig = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    <rect x="3" y="3" width="24" height="24" rx="4" stroke="url(#qg)" strokeWidth="2.5"/>
    <rect x="7" y="7" width="16" height="16" rx="2" fill="url(#qg)" opacity=".25"/>
    <rect x="37" y="3" width="24" height="24" rx="4" stroke="url(#qg)" strokeWidth="2.5"/>
    <rect x="41" y="7" width="16" height="16" rx="2" fill="url(#qg)" opacity=".25"/>
    <rect x="3" y="37" width="24" height="24" rx="4" stroke="url(#qg)" strokeWidth="2.5"/>
    <rect x="7" y="41" width="16" height="16" rx="2" fill="url(#qg)" opacity=".25"/>
    <rect x="37" y="37" width="9" height="9" rx="1" fill="url(#qg)"/>
    <rect x="48" y="37" width="13" height="9" rx="1" fill="url(#qg)" opacity=".5"/>
    <rect x="37" y="48" width="9" height="13" rx="1" fill="url(#qg)" opacity=".5"/>
    <rect x="48" y="48" width="13" height="13" rx="1" fill="url(#qg)"/>
    <defs><linearGradient id="qg" x1="3" y1="3" x2="61" y2="61" gradientUnits="userSpaceOnUse"><stop stopColor="#5B63F1"/><stop offset="1" stopColor="#8B5CF6"/></linearGradient></defs>
  </svg>
)

const PersonFig = () => (
  <svg width="72" height="88" viewBox="0 0 72 88" fill="none">
    <ellipse cx="36" cy="84" rx="22" ry="4" fill="rgba(91,99,241,0.12)"/>
    <path d="M26 48 L18 76 L28 76 L33 56Z" fill="url(#pl)"/>
    <path d="M46 48 L54 76 L44 76 L39 56Z" fill="url(#pr)"/>
    <rect x="20" y="26" width="32" height="28" rx="7" fill="url(#pt)"/>
    <path d="M26 32 L10 56 L17 61 L32 38Z" fill="url(#pa)"/>
    <path d="M46 32 L62 52 L55 58 L40 38Z" fill="url(#pa)"/>
    <rect x="52" y="46" width="18" height="28" rx="3" fill="#1F2937"/>
    <rect x="54" y="48" width="14" height="24" rx="2" fill="#374151"/>
    <circle cx="61" cy="60" r="6" fill="#12123A"/>
    <circle cx="61" cy="60" r="4" fill="url(#pcam)"/>
    <ellipse cx="36" cy="18" rx="14" ry="16" fill="url(#ph)"/>
    <circle cx="30" cy="16" r="3" fill="#12123A"/><circle cx="42" cy="16" r="3" fill="#12123A"/>
    <circle cx="31.5" cy="14.5" r="1.5" fill="rgba(255,255,255,0.5)"/><circle cx="43.5" cy="14.5" r="1.5" fill="rgba(255,255,255,0.5)"/>
    <path d="M31 23 Q36 28 41 23" stroke="rgba(255,255,255,.55)" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    <path d="M22 16 Q22 4 36 2 Q50 4 50 16" fill="url(#phair)"/>
    <defs>
      <linearGradient id="pl" x1="18" y1="48" x2="33" y2="76" gradientUnits="userSpaceOnUse"><stop stopColor="#5B63F1"/><stop offset="1" stopColor="#4047D4"/></linearGradient>
      <linearGradient id="pr" x1="54" y1="48" x2="39" y2="76" gradientUnits="userSpaceOnUse"><stop stopColor="#5B63F1"/><stop offset="1" stopColor="#4047D4"/></linearGradient>
      <linearGradient id="pt" x1="20" y1="26" x2="52" y2="54" gradientUnits="userSpaceOnUse"><stop stopColor="#818CF8"/><stop offset="1" stopColor="#6366F1"/></linearGradient>
      <linearGradient id="pa" x1="10" y1="32" x2="40" y2="61" gradientUnits="userSpaceOnUse"><stop stopColor="#7C7FED"/><stop offset="1" stopColor="#5B5EC8"/></linearGradient>
      <radialGradient id="pcam" cx="38%" cy="33%" r="60%"><stop stopColor="#5B63F1"/><stop offset="1" stopColor="#1a1a4e"/></radialGradient>
      <radialGradient id="ph" cx="40%" cy="35%" r="65%"><stop stopColor="#FDDBB4"/><stop offset="1" stopColor="#F9A875"/></radialGradient>
      <linearGradient id="phair" x1="22" y1="2" x2="50" y2="16" gradientUnits="userSpaceOnUse"><stop stopColor="#92400E"/><stop offset="1" stopColor="#78350F"/></linearGradient>
    </defs>
  </svg>
)

/* ── FAQ data ────────────────────────────── */
const FAQ = [
  { q: 'Behöver gästerna ladda ner en app?', a: 'Nej. Gästerna skannar QR med sin vanliga kamera och allt fungerar direkt i webbläsaren. Ingen installation krävs.' },
  { q: 'Hur säker är ansiktsigenkänningen?', a: 'Vi använder AWS Rekognition med 99% träffsäkerhet. Anti-spoofing-teknik blockerar skärmdumpar och foton av skärmar.' },
  { q: 'Vad händer med selfies?', a: 'Selfies raderas automatiskt inom 24 timmar. Vi lagrar aldrig biometrisk data permanent. Allt är GDPR-kompatibelt och lagrat inom EU.' },
  { q: 'Kan jag sätta eget pris?', a: 'Ja — du väljer 5–50 kr per foto. Du kan också aktivera paketpris eller ge bort bilderna gratis.' },
  { q: 'Kan man öppna galleriet utan att skanna igen?', a: 'Ja! Gäster sparar gallerilänken via email. Vid nästa besök öppnas galleriet direkt — ingen ny selfie behövs.' },
]

export default function LandingPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [scrolled, setScrolled] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const heroRef = useRef(null)
  const { scrollY } = useScroll()
  const blobY = useTransform(scrollY, [0, 600], [0, -120])
  const mockupY = useTransform(scrollY, [0, 600], [0, -60])
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0.3])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div style={{ background: 'var(--bg)', overflowX: 'hidden', fontFamily: 'Inter,sans-serif' }}>

      {/* ── NAV ── */}
      <motion.nav
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 clamp(16px,4vw,40px)',
          background: scrolled ? 'rgba(248,249,252,0.95)' : 'rgba(248,249,252,0.5)',
          backdropFilter: scrolled ? 'blur(20px)' : 'blur(4px)',
          borderBottom: scrolled ? '1px solid rgba(234,237,244,0.8)' : 'none',
          transition: 'background .3s, border-color .3s',
        }}
      >
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: 'var(--text-1)' }}>
          <motion.div whileHover={{ scale: 1.08, rotate: 5 }} style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            {PS_LOGO}
          </motion.div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>PixSnap</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {[['#how', 'Hur det fungerar'], ['#features', 'Features'], ['#faq', 'FAQ']].map(([href, label], i) => (
            <motion.a key={href} href={href}
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }}
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', textDecoration: 'none', padding: '7px 10px', borderRadius: 8 }}
              whileHover={{ color: 'var(--text-1)', background: 'rgba(0,0,0,0.04)' }}
              className="nav-desktop"
            >
              {label}
            </motion.a>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {user ? (
            <MagneticBtn href="/dashboard" className="ps-btn ps-btn-primary ps-btn-sm" style={{ textDecoration: 'none', fontSize: 13 }}>
              Dashboard
            </MagneticBtn>
          ) : (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                <Link href="/auth/login" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', textDecoration: 'none', padding: '7px 12px', borderRadius: 8 }}>Logga in</Link>
              </motion.div>
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}>
                <MagneticBtn href="/auth/register" className="ps-btn ps-btn-primary ps-btn-sm" style={{ textDecoration: 'none', fontSize: 13 }}>
                  Kom igång
                </MagneticBtn>
              </motion.div>
            </>
          )}
        </div>
      </motion.nav>

      {/* ── HERO ── */}
      <section ref={heroRef} style={{ minHeight: '100svh', paddingTop: 56, display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Parallax blobs */}
        <motion.div style={{ position: 'absolute', width: 700, height: 700, top: -200, right: -100, borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,99,241,0.13) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none', y: blobY }} />
        <motion.div style={{ position: 'absolute', width: 500, height: 500, bottom: 0, left: -80, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.11) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', y: useTransform(scrollY, [0, 600], [0, 80]) }} />

        <motion.div style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(48px,8vw,80px) clamp(16px,4vw,40px)', width: '100%', opacity: heroOpacity }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(32px,5vw,64px)', alignItems: 'center' }}>

            {/* LEFT */}
            <motion.div style={{ flex: '1 1 360px', minWidth: 0 }} variants={stagger} initial="hidden" animate="show">
              <motion.div variants={fadeUp} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(91,99,241,0.08)', border: '1px solid rgba(91,99,241,0.15)', borderRadius: 9999, padding: '5px 14px', marginBottom: 24 }}>
                <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 2 }} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand)' }}>AI Ansiktsigenkänning · 99% träffsäkerhet</span>
              </motion.div>

              <h1 style={{ fontSize: 'clamp(38px,6vw,64px)', fontWeight: 900, color: 'var(--text-1)', lineHeight: 1.05, letterSpacing: '-0.035em', marginBottom: 22 }}>
                {['Dina eventfoton,', 'hittade på', 'sekunder.'].map((line, i) => (
                  <motion.span key={i}
                    initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 + i * 0.14 }}
                    style={{ display: 'block' }}
                  >
                    {i === 1
                      ? <span style={{ background: 'var(--grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{line}</span>
                      : line
                    }
                  </motion.span>
                ))}
              </h1>

              <motion.p variants={fadeUp} style={{ fontSize: 'clamp(15px,2vw,17px)', color: 'var(--text-2)', lineHeight: 1.7, maxWidth: 480, marginBottom: 32 }}>
                Fotografer laddar upp bilder. Gäster skannar QR och hittar sina foton med en selfie på 30 sekunder. Inga appar. Inga konton.
              </motion.p>

              <motion.div variants={fadeUp} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 36 }}>
                <MagneticBtn href={user ? '/dashboard' : '/auth/register'} className="ps-btn ps-btn-primary" style={{ textDecoration: 'none', fontSize: 15, padding: '13px 28px', borderRadius: 14, boxShadow: '0 4px 20px rgba(91,99,241,0.35)' }}>
                  {user ? 'Öppna dashboard' : 'Kom igång gratis'}
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M8.5 4.5l2.5 2.5-2.5 2.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </MagneticBtn>
                {!user && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Inget kreditkort krävs</span>}
              </motion.div>

              {/* Flow steps */}
              <motion.div variants={fadeUp} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {['Ladda upp foton', 'Skanna QR', 'Selfie', 'Foton på 30s'].map((step, i) => (
                  <span key={step} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--brand)', opacity: 0.7 }} />
                    {step}
                    {i < 3 && <span style={{ color: '#DDE0EE', marginLeft: 2 }}>—</span>}
                  </span>
                ))}
              </motion.div>
            </motion.div>

            {/* RIGHT MOCKUP */}
            <div style={{ flex: '1 1 300px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: 380 }}>
              <motion.div
                style={{ y: mockupY, transformStyle: 'preserve-3d', position: 'relative', width: '100%', maxWidth: 340 }}
                initial={{ opacity: 0, scale: 0.9, y: 40 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
              >
                {/* Glow */}
                <div style={{ position: 'absolute', inset: -50, background: 'radial-gradient(ellipse, rgba(91,99,241,0.16), transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

                {/* Main glass card */}
                <motion.div
                  style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.9)', borderRadius: 24, overflow: 'hidden', boxShadow: '0 12px 48px rgba(91,99,241,0.14)' }}
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <div style={{ background: 'linear-gradient(135deg,#EEF0FD,#F3EEFF)', padding: '14px 14px 0', borderBottom: '1px solid #EAEDF4' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-1)' }}>Johans bröllop — 42 foton</p>
                        <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>AI matchning · 28 sekunder</p>
                      </div>
                      <div style={{ background: 'var(--grad)', color: 'white', fontSize: 10, fontWeight: 700, padding: '5px 10px', borderRadius: 8 }}>Köp · 120 kr</div>
                    </div>
                  </div>
                  <div style={{ padding: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5 }}>
                      {['rgba(91,99,241,.14)','rgba(139,92,246,.14)','rgba(59,130,246,.12)','rgba(236,72,153,.11)','rgba(34,197,94,.11)','rgba(245,158,11,.11)','rgba(91,99,241,.09)','rgba(99,102,241,.14)','rgba(124,58,237,.11)'].map((bg, i) => (
                        <motion.div key={i}
                          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.6 + i * 0.07, type: 'spring', stiffness: 300 }}
                          style={{ aspectRatio: '1', borderRadius: 9, background: bg, position: 'relative' }}>
                          {i < 4 && (
                            <div style={{ position: 'absolute', top: 4, left: 4, width: 16, height: 16, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* Floating badge: match */}
                <motion.div
                  style={{ position: 'absolute', top: -18, right: -16, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.9)', borderRadius: 14, padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                  animate={{ y: [0, -8, 0] }} transition={{ duration: 6, delay: 1, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 6.5l3 3 5-5" stroke="var(--success)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <div><p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>AI matchning klar</p><p style={{ fontSize: 10, color: 'var(--text-3)' }}>på 28 sekunder</p></div>
                </motion.div>

                {/* Floating badge: GDPR */}
                <motion.div
                  style={{ position: 'absolute', bottom: -16, left: -16, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.9)', borderRadius: 14, padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                  animate={{ y: [0, 8, 0] }} transition={{ duration: 7, delay: 0.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(91,99,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="5" width="9" height="6.5" rx="1.5" stroke="var(--brand)" strokeWidth="1.2"/><path d="M3.5 5V3.5a2.5 2.5 0 015 0V5" stroke="var(--brand)" strokeWidth="1.2" strokeLinecap="round"/></svg>
                  </div>
                  <div><p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>GDPR-säkert</p><p style={{ fontSize: 10, color: 'var(--text-3)' }}>Data inom EU</p></div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── STATS BAR ── */}
      <Reveal>
        <div style={{ background: 'var(--surface)', borderTop: '1px solid #EAEDF4', borderBottom: '1px solid #EAEDF4', padding: '24px clamp(16px,4vw,40px)' }}>
          <motion.div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', justifyContent: 'center', gap: 0, flexWrap: 'wrap' }}
            variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
            {[['10k+', 'foton delade'], ['99%', 'AI träffsäkerhet'], ['30s', 'snitt per matchning'], ['500+', 'fotografer']].map(([n, l], i) => (
              <motion.div key={l} variants={cardItem} style={{ textAlign: 'center', padding: '12px 32px', borderRight: i < 3 ? '1px solid #EAEDF4' : 'none', flex: '1 1 120px' }}>
                <p style={{ fontSize: 'clamp(22px,3vw,28px)', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1 }}>{n}</p>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, fontWeight: 500 }}>{l}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Reveal>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ padding: 'clamp(60px,10vw,100px) clamp(16px,4vw,40px)', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: 56 } as any}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--brand)', marginBottom: 10 }}>Hur det fungerar</p>
            <h2 style={{ fontSize: 'clamp(26px,4vw,40px)', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.025em', marginBottom: 12 }}>Tre steg. Det är allt.</h2>
            <p style={{ fontSize: 16, color: 'var(--text-2)', maxWidth: 460, margin: '0 auto', lineHeight: 1.7 }}>Från uppladdning till gästernas händer på under 30 sekunder per gäst.</p>
          </Reveal>

          <motion.div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}
            variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
            {[
              { num: '01', fig: <CameraFig />, title: 'Ladda upp foton', desc: 'Dra och slapp 1000+ bilder. AI indexerar alla ansikten automatiskt. HEIC, JPG, PNG stöds.' },
              { num: '02', fig: <QRFig />, title: 'Dela QR-koden', desc: 'Generera en professionell QR-affisch. Sätt upp vid entrén eller dela digitalt med gästerna.' },
              { num: '03', fig: <PersonFig />, title: 'Gäster hittar sina foton', desc: 'Gästen skannar QR, tar en selfie och AI hittar alla foton på under 30 sekunder. Ingen app.' },
            ].map(({ num, fig, title, desc }, i) => (
              <motion.div key={num} variants={cardItem}
                whileHover={{ y: -12, scale: 1.015, boxShadow: '0 24px 60px rgba(91,99,241,0.16)' }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                style={{ background: 'var(--surface)', border: '1px solid #EAEDF4', borderRadius: 22, padding: 28, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', cursor: 'default' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18, position: 'relative' }}>
                  {fig}
                  <span style={{ position: 'absolute', top: -4, right: 16, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-3)' }}>{num}</span>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>{title}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65 }}>{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── GRADIENT STATS ── */}
      <Reveal>
        <section style={{ background: 'var(--grad)', padding: 'clamp(48px,8vw,80px) clamp(16px,4vw,40px)', position: 'relative', overflow: 'hidden' }}>
          <motion.div style={{ position: 'absolute', top: -100, right: -100, width: 350, height: 350, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }}
            animate={{ scale: [1, 1.1, 1], rotate: [0, 180, 360] }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} />
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 0 }}>
            {[
              { target: 10000, suffix: '+', label: 'Foton delade' },
              { target: 99, suffix: '%', label: 'AI träffsäkerhet' },
              { target: 30, suffix: 's', label: 'Snitt per matchning' },
            ].map(({ target, suffix, label }, i) => (
              <motion.div key={label}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.7 }}
                style={{ textAlign: 'center', padding: 'clamp(16px,3vw,24px) clamp(24px,5vw,52px)', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.15)' : 'none', flex: '1 1 150px' }}>
                <div style={{ fontSize: 'clamp(40px,6vw,56px)', fontWeight: 900, color: 'white', letterSpacing: '-0.04em', lineHeight: 1 }}>
                  {target}{suffix}
                </div>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 8, fontWeight: 500 }}>{label}</p>
              </motion.div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: 'clamp(60px,10vw,100px) clamp(16px,4vw,40px)', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: 52 } as any}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--brand)', marginBottom: 10 }}>Features</p>
            <h2 style={{ fontSize: 'clamp(26px,4vw,40px)', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.025em' }}>Allt du behöver</h2>
          </Reveal>
          <motion.div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}
            variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}>
            {[
              { icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="8" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M5.5 8V6a3.5 3.5 0 017 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="9" cy="12.5" r="1.5" fill="currentColor"/></svg>, title: 'GDPR-säkert', desc: 'Selfies raderas inom 24h. All data lagras inom EU.' },
              { icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2v8M9 2l-3 3M9 2l3 3M3 10v5a1 1 0 001 1h10a1 1 0 001-1v-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>, title: 'Snabb uppladdning', desc: '5 bilder parallellt. 1000 foton klara på ~3 minuter.' },
              { icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="4" width="14" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.4"/><circle cx="9" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.4"/></svg>, title: 'QR-affischer', desc: 'Designa och ladda ner trycksäkra A4-affischer.' },
              { icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2l1.8 5.5H16L11.5 11l1.8 5.5L9 13l-4.3 3.5 1.8-5.5L2 7.5h5.2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>, title: 'Flexibel prissättning', desc: 'Gratis, per foto, eller paketpris. Du bestämmer.' },
              { icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9a6 6 0 0012 0M9 3v6M6 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>, title: 'Email & Gallerilänk', desc: 'Gäster sparar länken — återvänder utan ny selfie.' },
              { icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M9 6v3.5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>, title: 'Anti-spoofing', desc: 'Blockerar skärmdumpar och foton av andras bilder.' },
            ].map(({ icon, title, desc }, i) => (
              <motion.div key={title} variants={cardItem}
                whileHover={{ y: -10, scale: 1.015, boxShadow: '0 20px 50px rgba(91,99,241,0.14)' }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                style={{ background: 'var(--bg)', border: '1px solid #EAEDF4', borderRadius: 20, padding: '20px 22px', cursor: 'default' }}>
                <motion.div whileHover={{ scale: 1.12, rotate: 5 }} style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)', marginBottom: 14 }}>
                  {icon}
                </motion.div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 6 }}>{title}</h4>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65 }}>{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── TESTIMONIAL ── */}
      <section style={{ padding: 'clamp(60px,8vw,80px) clamp(16px,4vw,40px)', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <Reveal>
            <motion.div
              style={{ background: 'var(--grad)', borderRadius: 24, padding: 'clamp(36px,6vw,52px) clamp(24px,5vw,48px)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}
              whileHover={{ scale: 1.01 }} transition={{ type: 'spring', stiffness: 200 }}
            >
              <motion.div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }}
                animate={{ rotate: 360 }} transition={{ duration: 15, repeat: Infinity, ease: 'linear' }} />
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 20 }}>
                {[...Array(5)].map((_, i) => (
                  <motion.svg key={i} width="18" height="18" viewBox="0 0 18 18" fill="none"
                    initial={{ opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                    transition={{ delay: 0.1 + i * 0.08, type: 'spring', stiffness: 400 }}>
                    <path d="M9 2l1.6 4.9H15l-4 3.1 1.5 4.9L9 12l-3.5 2.9 1.5-4.9-4-3.1H7.4z" fill="rgba(255,255,255,0.85)"/>
                  </motion.svg>
                ))}
              </div>
              <p style={{ fontSize: 'clamp(16px,2.5vw,20px)', fontWeight: 600, color: 'white', lineHeight: 1.65, marginBottom: 24, fontStyle: 'italic' }}>
                "Aldrig behövt sortera igenom 2000 bilder för att hitta familjefoton igen. Gästerna älskar det."
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Ahmad Ali</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Eventfotograf, Sverige</p>
                </div>
              </div>
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ padding: 'clamp(60px,8vw,80px) clamp(16px,4vw,40px)', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: 40 } as any}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--brand)', marginBottom: 10 }}>FAQ</p>
            <h2 style={{ fontSize: 'clamp(24px,3.5vw,36px)', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.025em' }}>Vanliga frågor</h2>
          </Reveal>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FAQ.map(({ q, a }, i) => (
              <Reveal key={i} delay={i * 0.06}>
                <motion.div
                  style={{ background: 'var(--bg)', border: '1px solid #EAEDF4', borderRadius: 14, overflow: 'hidden' }}
                  whileHover={{ borderColor: 'rgba(91,99,241,0.25)', boxShadow: '0 4px 16px rgba(91,99,241,0.07)' }}
                >
                  <button style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif', textAlign: 'left', gap: 12 }}
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', flex: 1 }}>{q}</span>
                    <motion.div animate={{ rotate: openFaq === i ? 180 : 0 }} transition={{ duration: 0.25 }}
                      style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5l3 3 3-3" stroke="var(--brand)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </motion.div>
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
                        <p style={{ fontSize: 13, color: 'var(--text-2)', padding: '0 18px 16px', lineHeight: 1.7 }}>{a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: 'clamp(60px,8vw,100px) clamp(16px,4vw,40px)', position: 'relative', overflow: 'hidden', background: 'var(--bg)' }}>
        <motion.div style={{ position: 'absolute', top: '50%', left: '50%', width: 700, height: 400, background: 'radial-gradient(ellipse, rgba(91,99,241,0.11), transparent 70%)', pointerEvents: 'none', x: '-50%', y: '-50%' }}
          animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} />
        <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <Reveal>
            <motion.h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em', marginBottom: 14 }}
              whileInView={{ backgroundPosition: '100% 50%' }}>
              Redo att köra?
            </motion.h2>
            <p style={{ fontSize: 16, color: 'var(--text-2)', marginBottom: 30, lineHeight: 1.7 }}>
              Konfigurera ditt första event på under 2 minuter. Gratis.
            </p>
            <MagneticBtn href={user ? '/dashboard' : '/auth/register'} className="ps-btn ps-btn-primary" style={{ textDecoration: 'none', fontSize: 15, padding: '14px 36px', borderRadius: 14, display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 6px 28px rgba(91,99,241,0.35)' }}>
              {user ? 'Öppna dashboard' : 'Skapa konto gratis'}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M8.5 4.5l2.5 2.5-2.5 2.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </MagneticBtn>
            {!user && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12 }}>Inget kreditkort krävs</p>}
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid #EAEDF4', padding: 'clamp(16px,3vw,24px) clamp(16px,4vw,32px)', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>{PS_LOGO}</div>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)' }}>PixSnap</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <Link href="/privacy" style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none' }}>Integritetspolicy</Link>
            <a href="mailto:support@pixsnap.se" style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none' }}>support@pixsnap.se</a>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>© 2026 PixSnap</p>
          </div>
        </div>
      </footer>

      <style>{`
        .nav-desktop { display: none; }
        @media(min-width:640px) { .nav-desktop { display: block !important; } }
      `}</style>
    </div>
  )
}
