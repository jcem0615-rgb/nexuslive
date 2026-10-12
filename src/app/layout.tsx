import type { Metadata, Viewport } from 'next';
import './globals.css';
import { BottomNav } from '@/components/BottomNav';
import { ServiceWorker } from '@/components/ServiceWorker';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Nexus Live',
    template: '%s · Nexus Live',
  },
  description: 'Go live, send gifts, play mini-games and cash out your beans.',
  applicationName: 'Nexus Live',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/logo.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
    shortcut: ['/favicon.ico'],
  },
  appleWebApp: {
    capable: true,
    title: 'Nexus Live',
    statusBarStyle: 'black-translucent',
  },
  openGraph: {
    type: 'website',
    siteName: 'Nexus Live',
    title: 'Nexus Live',
    description: 'Go live, send gifts, play mini-games and cash out your beans.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Nexus Live' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nexus Live',
    description: 'Go live, send gifts, play mini-games and cash out your beans.',
    images: ['/og.png'],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#7036ff',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <BottomNav />
        <ServiceWorker />
      </body>
    </html>
  );
}
