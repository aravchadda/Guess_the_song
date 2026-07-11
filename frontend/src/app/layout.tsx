import type { Metadata } from 'next'
import { Inter, Press_Start_2P } from 'next/font/google'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import OrientationLock from '@/components/OrientationLock'
import Providers from './providers'

const inter = Inter({ subsets: ['latin'] })
const pressStart2P = Press_Start_2P({ 
  weight: '400',
  subsets: ['latin'],
  variable: '--font-press-start-2p',
})

export const metadata: Metadata = {
  title: 'Guess The Song',
  description: 'A fun music guessing game with progressive audio reveals',
  icons: {
    icon: '/replays-logo.png',
    shortcut: '/replays-logo.png',
    apple: '/replays-logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${pressStart2P.variable}`}>
        <Providers>
          <OrientationLock>
            <Header />
            {children}
            <Footer />
          </OrientationLock>
        </Providers>
      </body>
    </html>
  )
}
