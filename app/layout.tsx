import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Survey App',
  description: 'Typeform-like survey application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
      </head>
      <body>{children}</body>
    </html>
  )
}

