import Link from 'next/link'
import { PS_LOGO } from '@/components/layout/Navbar'

const sections = [
  { title: 'Vad vi samlar in', body: 'Vi samlar in e-postadresser från fotografer som registrerar konton. Från gäster samlar vi in selfies tillfälligt för ansiktsigenkänning — dessa raderas automatiskt inom 24 timmar. Vi lagrar inte permanenta biometriska profiler.' },
  { title: 'Hur vi använder data', body: 'Selfies används enbart för att matcha gäster mot eventfoton via AWS Rekognition. E-postadresser används för kontohantering och notifikationer om foton. Vi säljer aldrig data till tredje part.' },
  { title: 'Lagring och säkerhet', body: 'All data lagras inom EU (Supabase Frankfurt, AWS eu-west-1). Vi använder HTTPS för all datatransport. Eventfoton lagras i Supabase Storage med krypterade URL:er.' },
  { title: 'Dina rättigheter (GDPR)', body: 'Du har rätt att begära tillgång till, rättelse av eller radering av dina personuppgifter. Kontakta oss på support@pixsnap.se. Selfies raderas automatiskt inom 24 timmar utan att du behöver begära det.' },
  { title: 'Cookies', body: 'Vi använder sessionscookies för inloggning. Vi använder inga marknadsförings- eller spårningscookies.' },
  { title: 'Kontakt', body: 'För integritetsfrågor, kontakta: support@pixsnap.se' },
]

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid #EAEDF4', background: 'var(--surface)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text-1)' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            {PS_LOGO}
          </div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>PixSnap</span>
        </Link>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.025em', marginBottom: 8 }}>
          Integritetspolicy
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 36 }}>
          Senast uppdaterad: April 2026 · GDPR-kompatibel
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {sections.map(({ title, body }) => (
            <div key={title} className="ps-card" style={{ padding: '22px 24px' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>{title}</h2>
              <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>{body}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 36, paddingTop: 24, borderTop: '1px solid #EAEDF4' }}>
          <Link href="/" style={{ fontSize: 13, color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>
            ← Tillbaka till startsidan
          </Link>
        </div>
      </div>
    </div>
  )
}
