'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const EVENT_TYPES = [
  {
    id: 'wedding',
    emoji: '💍',
    title: 'Bröllop',
    color: 'from-rose-50 to-pink-50',
    accent: 'text-rose-600',
    border: 'border-rose-100',
    desc: 'Dela bröllopsminnena direkt med alla gäster.',
    details: [
      'Gäster hittar sina foton på sekunder med selfie',
      'Inga appar — fungerar direkt i mobilen',
      'Fotografen slipper sortera och skicka bilder manuellt',
      'Köp digitala bilder direkt — fotografen tjänar mer',
      'Vattenstämpel skyddar bilderna tills betalning sker',
      'QR-affisch på bordet eller välkomstdisplayen',
    ],
  },
  {
    id: 'corporate',
    emoji: '🏢',
    title: 'Företagsevent',
    color: 'from-blue-50 to-indigo-50',
    accent: 'text-blue-600',
    border: 'border-blue-100',
    desc: 'Professionell bilddelning för konferenser och kick-offs.',
    details: [
      'Dela bilder med hundratals anställda direkt',
      'Ingen manuell sortering av massiva bildmappar',
      'GDPR-säkert — selfies raderas inom 24h',
      'Fotografens logga som vattenstämpel för branding',
      'Statistik: hur många skannade, hittade foton, intäkter',
      'Fungerar på alla enheter utan installation',
    ],
  },
  {
    id: 'festival',
    emoji: '🎪',
    title: 'Festival & Konsert',
    color: 'from-purple-50 to-violet-50',
    accent: 'text-purple-600',
    border: 'border-purple-100',
    desc: 'Hantera tusentals bilder från stora events smidigt.',
    details: [
      'Stöd för 1000+ bilder per event',
      '5 parallella uppladdningar — klart på minuter',
      'Gäster skannar QR vid entrén eller scenen',
      'Paketpris: köp alla bilder för ett fast pris',
      'Notifikationssystem: gäster meddelas när foton är klara',
      'Aktivera "Visa alla foton" för festivalstämning',
    ],
  },
  {
    id: 'graduation',
    emoji: '🎓',
    title: 'Examen & Studentfirande',
    color: 'from-yellow-50 to-amber-50',
    accent: 'text-amber-600',
    border: 'border-amber-100',
    desc: 'Bevara minnen från den stora dagen för studenten och familjen.',
    details: [
      'Studenter och familj hittar sina bilder direkt',
      'Dela QR-koden i klassgruppen — klart!',
      'Gratis nedladdning med vattenstämpel, betala för full kvalitet',
      'Fotografen kan sätta eget pris 5–50 kr/bild',
      'Sparad gallerilänk i emailet — kom tillbaka när som helst',
      'Fungerar perfekt för stora klasser och många fotografer',
    ],
  },
  {
    id: 'sports',
    emoji: '⚽',
    title: 'Sport & Marathon',
    color: 'from-green-50 to-emerald-50',
    accent: 'text-green-600',
    border: 'border-green-100',
    desc: 'Leverera tävlingsfoton till löpare och idrottare på sekunder.',
    details: [
      'Löpare skannar QR direkt vid målgången',
      'AI hittar exakt rätt person bland tusentals bilder',
      'Idealt för marathon, fotbollsturneringar, simtävlingar',
      'Anti-spoofing: bara originalselfies accepteras',
      'Blixtsnabb sökning — resultat på under 30 sekunder',
      'Fotografer kan ta bättre betalt med köpfunktionen',
    ],
  },
  {
    id: 'private',
    emoji: '🎉',
    title: 'Privata Fester',
    color: 'from-orange-50 to-red-50',
    accent: 'text-orange-600',
    border: 'border-orange-100',
    desc: 'Perfekt för kalas, dop, jubileum och alla privata fester.',
    details: [
      'Sätt PIN-kod för att hålla eventet privat',
      'Gäster registrerar email och får länk när foton är klara',
      'Arrangören väljer om bilderna ska vara gratis eller betalda',
      'Ingen teknisk kunskap krävs — klar på 2 minuter',
      'Skydda integritetskänsliga bilder med vattenstämpel',
      'QR-affisch i 3 designmallar att skriva ut',
    ],
  },
]

const FAQ = [
  { q: 'Behöver gästerna ladda ner en app?', a: 'Nej — gästerna skannar QR-koden med sin vanliga kamera och allt fungerar direkt i webbläsaren. Ingen installation krävs.' },
  { q: 'Hur säker är ansiktsigenkänningen?', a: 'Vi använder AWS Rekognition med 99% träffsäkerhet. Anti-spoofing-teknik blockerar skärmdumpar och foton av andra personer.' },
  { q: 'Vad händer med selfies?', a: 'Selfies raderas automatiskt inom 24 timmar. Vi lagrar aldrig biometrisk data permanent. Allt är GDPR-kompatibelt och lagrat inom EU.' },
  { q: 'Hur snabbt hittar gäster sina foton?', a: 'Genomsnittet är 30 sekunder från selfie till resultat. Oavsett om det finns 100 eller 2000 foton i eventet.' },
  { q: 'Kan jag sätta eget pris?', a: 'Ja — du väljer pris från 5–50 kr per foto. Du kan även aktivera paketpris och låta gäster köpa alla bilder för ett fast pris. Eller ge bort bilderna gratis.' },
  { q: 'Hur många foton kan jag ladda upp?', a: '1000+ foton per event. Systemet laddar upp 5 bilder parallellt och indexerar automatiskt. 1000 foton tar ungefär 3–5 minuter.' },
]

export default function LandingPage() {
  const [user, setUser] = useState<any>(null)
  const [mouseX, setMouseX] = useState(0)
  const [mouseY, setMouseY] = useState(0)
  const [scrollY, setScrollY] = useState(0)
  const [visible, setVisible] = useState(false)
  const [openEvent, setOpenEvent] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [sectionsVisible, setSectionsVisible] = useState<Record<string, boolean>>({})
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const supabase = createClient()

  useEffect(() => {
    setVisible(true)
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))

    function onMouseMove(e: MouseEvent) {
      setMouseX((e.clientX / window.innerWidth - 0.5) * 2)
      setMouseY((e.clientY / window.innerHeight - 0.5) * 2)
    }
    function onScroll() {
      setScrollY(window.scrollY)
      Object.entries(sectionRefs.current).forEach(([key, el]) => {
        if (el && !sectionsVisible[key]) {
          const rect = el.getBoundingClientRect()
          if (rect.top < window.innerHeight * 0.85) {
            setSectionsVisible(prev => ({ ...prev, [key]: true }))
          }
        }
      })
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('scroll', onScroll) }
  }, [sectionsVisible])

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-[56px] flex items-center justify-between px-6 bg-white/90 backdrop-blur-xl border-b border-neutral-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-neutral-900 rounded-[8px] flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <span className="font-bold text-sm text-neutral-900">PixSnap</span>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <Link href="/dashboard"
              className="text-sm bg-neutral-900 text-white px-4 py-2 rounded-xl hover:bg-neutral-700 transition-colors font-semibold">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/auth/login" className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors px-3 py-1.5">Logga in</Link>
              <Link href="/auth/register" className="text-sm bg-neutral-900 text-white px-4 py-2 rounded-xl hover:bg-neutral-700 transition-colors font-semibold">Kom igång</Link>
            </>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-[56px]">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-white via-neutral-50 to-white" />
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-100/40 rounded-full blur-[100px] transition-transform duration-300"
            style={{ transform: `translate(${mouseX * 15}px, ${mouseY * 10}px)` }} />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-pink-100/40 rounded-full blur-[100px] transition-transform duration-300"
            style={{ transform: `translate(${mouseX * -12}px, ${mouseY * -8}px)` }} />
        </div>
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '36px 36px' }} />

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 text-center lg:text-left">
            <div className={`inline-flex items-center gap-2 bg-white border border-neutral-200 rounded-full px-4 py-1.5 text-xs font-semibold text-neutral-600 mb-6 shadow-sm transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              AI ansiktsigenkänning · 99% träffsäkerhet
            </div>
            <h1 className={`text-5xl lg:text-[64px] font-extrabold tracking-[-0.03em] text-neutral-900 leading-[1.02] mb-6 transition-all duration-700 delay-100 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              Dina eventfoton,<br />
              <span className="relative inline-block">
                hittade
                <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 300 10" preserveAspectRatio="none">
                  <path d="M0 8 Q75 2 150 6 Q225 10 300 4" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.12"/>
                </svg>
              </span>
              {' '}på sekunder.
            </h1>
            <p className={`text-lg text-neutral-500 leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0 transition-all duration-700 delay-200 ${visible ? 'opacity-100' : 'opacity-0'}`}>
              Fotografer laddar upp bilder. Gäster skannar QR och hittar sina foton med en selfie. Inga appar, inga konton.
            </p>
            <div className={`flex flex-col sm:flex-row items-center gap-3 lg:justify-start justify-center transition-all duration-700 delay-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
              <Link href={user ? '/dashboard' : '/auth/register'}
                className="group inline-flex items-center gap-2 bg-neutral-900 text-white px-8 py-3.5 rounded-xl text-sm font-bold hover:bg-neutral-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                {user ? 'Gå till Dashboard' : 'Kom igång gratis'}
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              {!user && <p className="text-xs text-neutral-400">Inget kreditkort krävs</p>}
            </div>
            <div className={`flex items-center gap-8 mt-10 justify-center lg:justify-start transition-all duration-700 delay-400 ${visible ? 'opacity-100' : 'opacity-0'}`}>
              {[['10k+', 'foton delade'], ['99%', 'träffsäkerhet'], ['30s', 'snitt per sökning']].map(([num, label]) => (
                <div key={label}>
                  <p className="text-2xl font-bold text-neutral-900 leading-none">{num}</p>
                  <p className="text-xs text-neutral-400 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 3D Mockup */}
          <div className="flex-1 flex items-center justify-center">
            <div className="relative" style={{ transform: `perspective(1200px) rotateX(${mouseY * -6}deg) rotateY(${mouseX * 6}deg) translateY(${scrollY * -0.04}px)`, transformStyle: 'preserve-3d', transition: 'transform 0.15s ease-out' }}>
              <div className="absolute -inset-8 bg-gradient-to-br from-purple-100/60 via-pink-50/40 to-blue-100/60 rounded-[40px] blur-2xl" />
              <div className="relative w-[320px] bg-white rounded-[28px] shadow-[0_24px_60px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.04)] overflow-hidden float-slow">
                <div className="bg-neutral-50 border-b border-neutral-100 px-5 py-3.5 flex items-center justify-between">
                  <div><p className="text-xs font-bold text-neutral-900">Hittade 42 foton</p><p className="text-[10px] text-neutral-400 mt-0.5">Johans bröllop</p></div>
                  <div className="bg-neutral-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg">Köp · 120 kr</div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 p-3">
                  {['bg-[#EDE8E0]','bg-[#E0EDE7]','bg-[#E0E7ED]','bg-[#EDE4E0]','bg-[#EDE0E0]','bg-[#E0ECED]','bg-[#E6EDE0]','bg-[#EDE0EC]','bg-[#E8EDE0]'].map((color, i) => (
                    <div key={i} className={`aspect-square rounded-xl ${color} relative overflow-hidden`}>
                      {i < 4 && <div className="absolute top-1.5 left-1.5 w-4 h-4 bg-neutral-900 rounded-full flex items-center justify-center"><svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                      <div className="absolute inset-0 flex items-center justify-center opacity-[0.06]"><span className="text-[7px] font-bold text-neutral-900 rotate-[-30deg] whitespace-nowrap">PixSnap PixSnap</span></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -top-5 -right-8 bg-white rounded-2xl shadow-lg px-3.5 py-2.5 flex items-center gap-2.5 border border-neutral-100 float" style={{ animationDelay: '0.5s' }}>
                <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center"><svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg></div>
                <div><p className="text-xs font-bold text-neutral-900">AI matchning klar</p><p className="text-[10px] text-neutral-400">på 28 sekunder</p></div>
              </div>
              <div className="absolute -bottom-5 -left-8 bg-white rounded-2xl shadow-lg px-3.5 py-2.5 flex items-center gap-2.5 border border-neutral-100 float" style={{ animationDelay: '1s' }}>
                <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-base">🔒</div>
                <div><p className="text-xs font-bold text-neutral-900">GDPR-säkert</p><p className="text-[10px] text-neutral-400">Data inom EU</p></div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
          <div className="w-5 h-8 border-2 border-neutral-400 rounded-full flex items-start justify-center pt-1.5">
            <div className="w-1 h-2 bg-neutral-400 rounded-full animate-bounce" />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 px-6 bg-neutral-50 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="max-w-5xl mx-auto relative" ref={el => { sectionRefs.current['how'] = el }}>
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-[0.18em] text-neutral-400 uppercase mb-3">Så fungerar det</p>
            <h2 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Tre steg. Det är allt.</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { step: '01', icon: '📸', title: 'Fotografen laddar upp', desc: 'Dra och slapp 1000+ foton. AI indexerar alla ansikten automatiskt.' },
              { step: '02', icon: '📲', title: 'Gästen skannar QR', desc: 'Tar en selfie — AI hittar alla foton på 30 sekunder.' },
              { step: '03', icon: '💳', title: 'Ladda ner eller köp', desc: 'Gratis med vattenstämpel, eller betala för full kvalitet.' },
            ].map(({ step, icon, title, desc }, i) => (
              <div key={step}
                className={`bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm hover:shadow-lg hover:-translate-y-1.5 transition-all duration-500 ${sectionsVisible['how'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${i * 100}ms` }}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{icon}</span>
                  <span className="text-xs font-mono text-neutral-200 font-bold tracking-widest">{step}</span>
                </div>
                <h3 className="font-bold text-neutral-900 mb-2 text-sm">{title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PERFECT FOR EVERY EVENT */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto" ref={el => { sectionRefs.current['events'] = el }}>
          <div className="text-center mb-4">
            <p className="text-xs font-bold tracking-[0.18em] text-neutral-400 uppercase mb-3">Användningsområden</p>
            <h2 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Perfekt för varje event</h2>
            <p className="text-neutral-500 mt-3 text-sm">Klicka på ett event-typ för att se hur PixSnap passar just det tillfället</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
            {EVENT_TYPES.map(({ id, emoji, title, color, accent, border, desc, details }, i) => (
              <div key={id}
                className={`rounded-2xl border overflow-hidden cursor-pointer transition-all duration-500 ${border} ${sectionsVisible['events'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${openEvent === id ? 'shadow-xl' : 'hover:shadow-lg hover:-translate-y-1'}`}
                style={{ transitionDelay: `${i * 80}ms` }}
                onClick={() => setOpenEvent(openEvent === id ? null : id)}>

                {/* Card header */}
                <div className={`bg-gradient-to-br ${color} p-5`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-3xl block mb-2">{emoji}</span>
                      <h3 className={`font-bold text-neutral-900 text-base`}>{title}</h3>
                      <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{desc}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 ${border} flex items-center justify-center flex-shrink-0 ml-3 mt-1 transition-transform duration-300 ${openEvent === id ? 'rotate-180' : ''}`}>
                      <svg className="w-3 h-3 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Expandable content */}
                <div className={`overflow-hidden transition-all duration-400 ${openEvent === id ? 'max-h-96' : 'max-h-0'}`}>
                  <div className="bg-white px-5 py-4 space-y-2">
                    {details.map((detail, j) => (
                      <div key={j} className="flex items-start gap-2.5">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${accent.replace('text-', 'bg-')}`} />
                        <p className="text-xs text-neutral-600 leading-relaxed">{detail}</p>
                      </div>
                    ))}
                    <div className="pt-2">
                      <Link href={user ? '/dashboard' : '/auth/register'}
                        onClick={e => e.stopPropagation()}
                        className={`inline-flex items-center gap-1.5 text-xs font-bold ${accent} hover:opacity-70 transition-opacity`}>
                        Kom igång →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-24 px-6 bg-neutral-50">
        <div className="max-w-5xl mx-auto" ref={el => { sectionRefs.current['features'] = el }}>
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-[0.18em] text-neutral-400 uppercase mb-3">Features</p>
            <h2 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Allt du behöver</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              ['🔒', 'GDPR-säkert', 'Selfies raderas inom 24h. Data lagras i EU. Biometrisk data behandlas med stöd av GDPR Art. 9.2a.'],
              ['⚡', 'Supersnabb uppladdning', '5 bilder parallellt. 1000 foton indexerade på ~3 minuter. HEIC, JPG, PNG, WebP.'],
              ['🎨', 'QR-affischer', '3 professionella designmallar. Skriv ut A4 direkt — Minimal, Elegant eller Bold.'],
              ['💰', 'Flexibel prissättning', '5–50 kr/foto eller helt gratis. Paketpris. Vattenstämpel på/av. Du bestämmer.'],
              ['🔔', 'Notifikationssystem', 'Gäster registrerar sig. Får personlig gallerilänk direkt när foton publiceras.'],
              ['🛡', 'Anti-spoofing AI', 'Detekterar skärmdumpar och foton av andras bilder. Skyddar känsliga event.'],
            ].map(([icon, title, desc], i) => (
              <div key={title}
                className={`group bg-white rounded-2xl p-5 border border-neutral-100 hover:border-neutral-200 hover:shadow-md transition-all duration-300 ${sectionsVisible['features'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${i * 80}ms` }}>
                <span className="text-xl mb-3 block group-hover:scale-110 transition-transform duration-300 inline-block">{icon}</span>
                <p className="text-sm font-bold text-neutral-900 mb-1">{title}</p>
                <p className="text-xs text-neutral-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto" ref={el => { sectionRefs.current['faq'] = el }}>
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-[0.18em] text-neutral-400 uppercase mb-3">FAQ</p>
            <h2 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Vanliga frågor</h2>
          </div>
          <div className="space-y-3">
            {FAQ.map(({ q, a }, i) => (
              <div key={i}
                className={`bg-white border border-neutral-100 rounded-2xl overflow-hidden transition-all duration-500 hover:border-neutral-200 ${sectionsVisible['faq'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${i * 60}ms` }}>
                <button
                  className="w-full flex items-center justify-between px-6 py-4 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span className="text-sm font-bold text-neutral-900">{q}</span>
                  <div className={`w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0 ml-4 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`}>
                    <svg className="w-3 h-3 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${openFaq === i ? 'max-h-40' : 'max-h-0'}`}>
                  <p className="px-6 pb-5 text-sm text-neutral-500 leading-relaxed">{a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="py-16 px-6 bg-neutral-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(255,255,255,0.03),transparent)]" />
        <div className="max-w-3xl mx-auto text-center relative">
          <p className="text-3xl font-bold leading-relaxed mb-6 text-white/90">
            "Aldrig behövt sortera igenom 2000 bilder för att hitta familjefoton igen. Gästerna älskar det."
          </p>
          <div className="flex items-center justify-center gap-3">
            <div className="w-9 h-9 bg-neutral-700 rounded-full" />
            <div className="text-left">
              <p className="text-sm font-bold text-white">Ahmad Ali</p>
              <p className="text-xs text-neutral-500">Eventfotograf, Sverige</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-r from-purple-50 via-pink-50 to-blue-50 rounded-full blur-[80px] opacity-60" />
        </div>
        <div className="max-w-xl mx-auto text-center relative">
          <h2 className="text-4xl font-extrabold text-neutral-900 tracking-tight mb-4">Redo att köra?</h2>
          <p className="text-neutral-500 mb-8 text-lg">Konfigurera ditt första event på under 2 minuter.</p>
          <Link href={user ? '/dashboard' : '/auth/register'}
            className="group inline-flex items-center gap-2 bg-neutral-900 text-white px-12 py-4 rounded-xl text-base font-bold hover:bg-neutral-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
            {user ? 'Gå till Dashboard' : 'Skapa konto gratis'}
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-100 px-6 py-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-neutral-900 rounded-[6px] flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
            </div>
            <span className="text-xs font-bold text-neutral-900">PixSnap</span>
          </div>
          <Link href="/privacy" className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors">Integritetspolicy</Link>
          <p className="text-xs text-neutral-300">© 2026 PixSnap</p>
        </div>
      </footer>
    </div>
  )
}