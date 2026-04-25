import type { Metadata } from 'next'
import './globals.css'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'PixSnap — AI Eventfoto',
  description: 'Hitta dina eventfoton med en selfie på 30 sekunder.',
  openGraph: { title: 'PixSnap — AI Eventfoto', description: 'AI ansiktsigenkänning för eventfoton.' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>
        {children}
        <Script id="tawkto" strategy="afterInteractive">{`
          var Tawk_API=Tawk_API||{},Tawk_LoadStart=new Date();
          (function(){var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
          s1.async=true;s1.src='https://embed.tawk.to/69ea75ffc0c82a1c38d66a5f/1jmttps0a';
          s1.charset='UTF-8';s1.setAttribute('crossorigin','*');
          s0.parentNode.insertBefore(s1,s0);})();
        `}</Script>
      </body>
    </html>
  )
}
