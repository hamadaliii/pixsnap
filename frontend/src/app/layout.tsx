// Lägg till Pixie i din src/app/layout.tsx
// Importera högst upp:
// import { PixieChatbot } from '@/components/ui/PixieChatbot'
// 
// Lägg sedan till precis före </body>:
// <PixieChatbot />
//
// Exempel på hur din layout.tsx ska se ut:

import type { Metadata } from 'next'
import './globals.css'
import { PixieChatbot } from '@/components/ui/PixieChatbot'

export const metadata: Metadata = {
  title: 'PixSnap — AI Eventfoto',
  description: 'Hitta dina eventfoton med en selfie. AI ansiktsigenkänning.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>
        {children}
        <PixieChatbot />
      </body>
    </html>
  )
}