'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import QRCode from 'qrcode'
import { Button } from './Button'

interface QRDisplayProps {
  url: string
  slug: string
}

export function QRDisplay({ url, slug }: QRDisplayProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('')

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: {
        dark: '#111111',
        light: '#ffffff',
      },
    }).then(setQrDataUrl)
  }, [url])

  if (!qrDataUrl) {
    return (
      <div className="w-[200px] h-[200px] bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
    )
  }

  return (
    <div className="space-y-4">
      {/* QR image in white box so it's scannable in dark mode */}
      <div className="bg-white p-4 rounded-xl inline-block">
        <Image
          src={qrDataUrl}
          alt={`QR code for ${slug}`}
          width={200}
          height={200}
          className="w-[200px] h-[200px]"
        />
      </div>

      {/* URL label */}
      <p className="text-xs text-neutral-400 dark:text-neutral-600 break-all font-mono">
        {url}
      </p>

      {/* Download button */}
      <a href={qrDataUrl} download={`qr-${slug}.png`}>
        <Button variant="secondary" size="sm" className="w-full">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download QR
        </Button>
      </a>
    </div>
  )
}
