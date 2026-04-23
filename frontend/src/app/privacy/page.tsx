import Link from 'next/link'

export const metadata = { title: 'Integritetspolicy — PixSnap' }

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="h-[56px] border-b border-neutral-100 flex items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 bg-neutral-900 rounded-[7px] flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>
          </div>
          <span className="font-bold text-sm text-neutral-900">PixSnap</span>
        </Link>
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors">← Tillbaka</Link>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Integritetspolicy</h1>
          <p className="text-sm text-neutral-400">Senast uppdaterad: {new Date().toLocaleDateString('sv-SE')}</p>
        </div>

        <div className="space-y-10 text-neutral-700">
          {[
            {
              title: 'Vad vi samlar in',
              content: (
                <ul className="space-y-2 text-sm">
                  {[
                    ['Din selfie', 'används uteslutande för ansiktsigenkänning för att hitta dina foton'],
                    ['Din e-postadress', 'om du väljer att spara en länk till ditt galleri'],
                    ['IP-adress', 'loggas i samband med ditt samtycke'],
                    ['Timestamp för samtycke', 'för att dokumentera ditt godkännande'],
                  ].map(([bold, rest]) => (
                    <li key={bold} className="flex gap-2">
                      <span className="text-neutral-300">—</span>
                      <span><strong className="text-neutral-900">{bold}</strong> — {rest}</span>
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              title: 'Hur vi använder datan',
              content: (
                <ul className="space-y-2 text-sm">
                  {[
                    'Din selfie analyseras med AWS Rekognition för att matcha dig mot eventfoton',
                    'Vi säljer aldrig din data till tredje part',
                    'Vi använder inte din data för marknadsföring utan ditt uttryckliga samtycke',
                  ].map(item => (
                    <li key={item} className="flex gap-2"><span className="text-neutral-300">—</span><span>{item}</span></li>
                  ))}
                </ul>
              ),
            },
            {
              title: 'Lagring och radering',
              content: (
                <ul className="space-y-2 text-sm">
                  {[
                    ['Selfies', 'raderas automatiskt inom 24 timmar'],
                    ['Galleri-länken', 'gäller i 30 dagar, sedan raderas sessiondata'],
                    ['Samtyckes-loggar', 'sparas i 12 månader av juridiska skäl'],
                  ].map(([bold, rest]) => (
                    <li key={bold} className="flex gap-2">
                      <span className="text-neutral-300">—</span>
                      <span><strong className="text-neutral-900">{bold}</strong> {rest}</span>
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              title: 'Var datan lagras',
              content: (
                <div className="text-sm space-y-1">
                  <p>All data lagras inom EU:</p>
                  <ul className="space-y-1 mt-2">
                    <li className="flex gap-2"><span className="text-neutral-300">—</span><span>Databas och filer: Supabase (Frankfurt, Tyskland)</span></li>
                    <li className="flex gap-2"><span className="text-neutral-300">—</span><span>Ansiktsigenkänning: AWS Rekognition (eu-west-1, Irland)</span></li>
                  </ul>
                </div>
              ),
            },
            {
              title: 'Biometrisk data',
              content: <p className="text-sm leading-relaxed">Ansiktsigenkänning är biometrisk data enligt GDPR. Vi behandlar denna data med stöd av ditt uttryckliga samtycke (Art. 9.2a GDPR). Du kan återkalla ditt samtycke när som helst genom att begära radering av dina data.</p>,
            },
            {
              title: 'Dina rättigheter',
              content: (
                <ul className="space-y-2 text-sm">
                  {[
                    ['Rätt till radering', 'du kan radera dina data direkt från galleriet'],
                    ['Rätt till tillgång', 'kontakta oss för att se vilken data vi har om dig'],
                    ['Rätt till portabilitet', 'du kan ladda ner dina foton när som helst'],
                    ['Rätt att klaga', 'du kan lämna klagomål till Integritetsskyddsmyndigheten (IMY)'],
                  ].map(([bold, rest]) => (
                    <li key={bold} className="flex gap-2">
                      <span className="text-neutral-300">—</span>
                      <span><strong className="text-neutral-900">{bold}</strong> — {rest}</span>
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              title: 'Kontakt',
              content: <p className="text-sm">Frågor om integritet? Kontakta oss på <strong className="text-neutral-900">privacy@pixsnap.se</strong></p>,
            },
          ].map(({ title, content }) => (
            <div key={title}>
              <h2 className="text-base font-semibold text-neutral-900 mb-3">{title}</h2>
              {content}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}