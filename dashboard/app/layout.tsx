import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Navigation } from '@/components/Navigation'
import { AnimatedFavicon } from '@/components/AnimatedFavicon'
import PersistentChat from '@/components/PersistentChat'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Moverz Analytics',
  description: 'Dashboard analytics pour le réseau Moverz (11 sites)',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="min-h-screen bg-gray-50">
        <AnimatedFavicon />
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          {children}
        </main>
        <PersistentChat />
      </body>
    </html>
  )
}

