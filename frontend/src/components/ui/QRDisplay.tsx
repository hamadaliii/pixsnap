'use client'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface QRDisplayProps {
  url: string
  slug: string
  size?: number
}

export function QRDisplay({ url, slug, size = 180 }: QRDisplayProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('')

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: size * 2,
      margin: 2,
      color: { dark: '#0D0E14', light: '#ffffff' },
    }).then(setQrDataUrl)
  }, [url, size])

  if (!qrDataUrl) {
    return <div style={{ width: size, height: size, borderRadius: 10, background: '#F2F4FA', animation: 'pulse 1.5s ease-in-out infinite' }} />
  }

  return (
    <div>
      <div style={{ background: 'white', padding: 12, borderRadius: 12, border: '1px solid #EAEDF4', display: 'inline-block', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <img src={qrDataUrl} alt={`QR kod för ${slug}`} style={{ width: size, height: size, display: 'block' }} />
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, fontFamily: 'monospace', wordBreak: 'break-all' }}>
        {url}
      </p>
      <a href={qrDataUrl} download={`qr-${slug}.png`}>
        <button className="ps-btn ps-btn-secondary ps-btn-sm" style={{ marginTop: 8, width: '100%' }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 2v7M3.5 6.5l3 3 3-3M1 11h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Ladda ner QR
        </button>
      </a>
    </div>
  )
}
