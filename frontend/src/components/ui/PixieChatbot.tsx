'use client'
import { useEffect, useRef, useState } from 'react'

interface Message { role: 'user' | 'assistant'; content: string }

const SYSTEM_PROMPT = `Du är Pixie — PixSnaps smarta AI-assistent. Du är varm, snabb och hjälpsam. Du svarar alltid på svenska om inte användaren skriver på ett annat språk.

PixSnap är en AI-driven eventfotoplattform där:
- Fotografer laddar upp bilder
- Gäster skannar QR-kod och tar en selfie
- AI hittar alla foton på ~30 sekunder med 99% träffsäkerhet
- Foton visas gratis med vattenstämpel, betalning ger full kvalitet
- Ingen app krävs, inga konton för gäster

Vanliga frågor och svar:

Q: Hur fungerar det?
A: Du skapar ett event, laddar upp foton, delar QR-koden. Gäster skannar, tar en selfie och AI hittar alla deras bilder på sekunder!

Q: Behöver gäster ladda ner en app?
A: Nej! Allt fungerar direkt i webbläsaren. Gästen skannar QR med sin vanliga kamera – inget mer.

Q: Hur säkert är det?
A: Extremt säkert. Selfies raderas automatiskt inom 24 timmar. All data lagras inom EU och vi följer GDPR fullt ut.

Q: Hur snabbt hittar AI foton?
A: Genomsnittet är under 30 sekunder, oavsett om det finns 100 eller 2000 foton i eventet.

Q: Kan jag ta betalt för foton?
A: Ja! Du sätter själv priset 5-50 kr per foto, eller paketpris för alla bilder. Du kan också ge bort allt gratis.

Q: Vad händer med vattenstämpeln?
A: Gratisnedladdningar visas med vattenstämpel. Betalda foton är i full kvalitet utan vattenstämpel. Du kan stänga av vattenstämpeln helt i inställningarna.

Q: Hur många foton kan jag ladda upp?
A: 1000+ foton per event. Systemet hanterar massuppladdning med 5 bilder parallellt – 1000 foton tar ca 3-5 minuter.

Q: Stödjer ni HEIC-format?
A: Ja, vi stödjer JPG, PNG, WebP och HEIC.

Q: Vad kostar PixSnap?
A: Kontakta oss för prisinformation. Vi erbjuder flexibla paket för allt från enstaka events till professionella fotografer.

Q: Kan jag prova gratis?
A: Ja! Skapa ett konto och kom igång direkt – inget kreditkort krävs.

Q: Vad är PIN-skydd?
A: Du kan sätta en PIN-kod på ditt event så att bara inbjudna gäster kan söka foton.

Q: Hur fungerar notifikationer?
A: Gäster kan registrera sin email. När du publicerar foton skickas en personlig länk till deras galleri direkt.

Q: Kan gäster se alla foton?
A: Det bestämmer du! I inställningarna kan du aktivera "Visa alla foton" om du vill att gäster kan bläddra bland alla bilder.

Q: Vad är paketpris?
A: Ett fast pris för att ladda ner alla sina foton istället för att betala per bild. Du sätter priset själv.

Q: Hur länge sparas gallerilänken?
A: Gallerilänken sparas i 30 dagar i besökarens webbläsare, så de kan alltid komma tillbaka utan att scanna igen.

Q: Fungerar det på alla enheter?
A: Ja, PixSnap fungerar på alla smartphones, surfplattor och datorer utan installation.

Q: Kan jag ha flera events?
A: Ja, du kan skapa obegränsat antal events och hantera dem alla från din dashboard.

Q: Vad är QR-affischen?
A: Du kan designa och skriva ut en professionell QR-affisch i 3 stilar direkt från din dashboard.

Q: Hur kontaktar jag support?
A: Chatta med mig – Pixie! Jag finns här dygnet runt. Du kan också nå oss på support@pixsnap.se.

Svara alltid kort, vänligt och hjälpsamt. Om du inte vet svaret, säg det ärligt och erbjud att koppla till support.`

export function PixieChatbot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hej! Jag är Pixie 👋 Hur kan jag hjälpa dig idag?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(0)
  const [showTooltip, setShowTooltip] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) { setUnread(0); setShowTooltip(false); setTimeout(() => inputRef.current?.focus(), 100) }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const t = setTimeout(() => setShowTooltip(false), 5000)
    return () => clearTimeout(t)
  }, [])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 400,
          system: SYSTEM_PROMPT,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const d = await res.json()
      const reply = d.content?.[0]?.text ?? 'Tyvärr kunde jag inte svara just nu.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      if (!open) setUnread(u => u + 1)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Något gick fel – försök igen!' }])
    }
    setLoading(false)
  }

  return (
    <>
      {/* Tooltip */}
      {showTooltip && !open && (
        <div className="fixed bottom-[90px] right-6 bg-white border border-neutral-200 rounded-2xl px-4 py-2.5 shadow-lg z-50 text-sm font-medium text-neutral-800 whitespace-nowrap animate-bounce">
          Hej! Fråga mig vad som helst 👋
          <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-white border-r border-b border-neutral-200 rotate-45" />
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        {open ? (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-7 h-7 text-white" viewBox="0 0 32 32" fill="currentColor">
            <path d="M16 2C8.268 2 2 7.477 2 14.222c0 3.628 1.699 6.88 4.397 9.142L5 30l6.63-2.952A15.3 15.3 0 0016 27.444C23.732 27.444 30 21.967 30 15.222S23.732 2 16 2z"/>
          </svg>
        )}
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-24px)] bg-white rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.18)] border border-neutral-100 flex flex-col overflow-hidden"
          style={{ height: 520 }}>
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }} className="px-5 py-4 flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">✨</div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Pixie</p>
              <p className="text-[11px] text-white/70">PixSnap AI · Online</p>
            </div>
            <button onClick={() => setMessages([{ role:'assistant', content:'Hej! Jag är Pixie 👋 Hur kan jag hjälpa dig idag?' }])}
              className="ml-auto text-white/50 hover:text-white transition-colors text-xs">
              Rensa
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-xs mr-2 mt-0.5 flex-shrink-0">✨</div>
                )}
                <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-br-sm'
                    : 'bg-white text-neutral-800 shadow-sm border border-neutral-100 rounded-bl-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-xs mr-2 flex-shrink-0">✨</div>
                <div className="bg-white border border-neutral-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick questions */}
          {messages.length === 1 && (
            <div className="px-4 py-2 flex gap-2 overflow-x-auto border-t border-neutral-100 bg-white">
              {['Hur fungerar det?', 'Vad kostar det?', 'GDPR?'].map(q => (
                <button key={q} onClick={() => { setInput(q); setTimeout(() => send(), 0) }}
                  className="text-xs bg-neutral-100 text-neutral-700 px-3 py-1.5 rounded-full whitespace-nowrap hover:bg-neutral-200 transition-colors flex-shrink-0 font-medium">
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t border-neutral-100 bg-white flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Skriv ett meddelande…"
              className="flex-1 bg-neutral-100 rounded-xl px-4 py-2.5 text-sm outline-none placeholder:text-neutral-400 text-neutral-900"
            />
            <button onClick={send} disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <div className="text-center py-1.5 bg-white">
            <span className="text-[10px] text-neutral-300">Powered by PixSnap AI</span>
          </div>
        </div>
      )}
    </>
  )
}