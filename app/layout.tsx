import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Evil Genius Survey Manager',
  description: 'Evil Genius Games survey management system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}

