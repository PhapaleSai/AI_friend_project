import type { Metadata, Viewport } from 'next';
import './globals.css';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'Friend AI — Naina & Bunny',
  description: 'Your AI companions Naina & Bunny. Talk to them like real friends.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Friend AI',
  },
  icons: {
    icon: [
      { url: '/favicon.ico',   sizes: '32x32',   type: 'image/x-icon' },
      { url: '/icon.svg',      sizes: 'any',     type: 'image/svg+xml' },
      { url: '/icon-192.png',  sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png',  sizes: '512x512', type: 'image/png' },
    ],
    // iOS ignores SVG for the home-screen icon — it needs a PNG.
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  formatDetection: {
    // Stop iOS turning numbers/dates in chat into tappable phone/date links.
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#07070f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // `cover` lets the app paint under the notch/home indicator (we pad with
  // safe-area insets); `resizes-content` makes the on-screen keyboard shrink
  // the layout instead of covering the input bar.
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="starfield" aria-hidden="true" />
        <div className="grain" aria-hidden="true" />
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
