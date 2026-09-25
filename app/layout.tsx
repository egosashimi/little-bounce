import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://egosashimi.github.io/little-bounce/'),
  title: 'Little Head',
  description: 'A cozy cat ricochet game for your pocket.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'Little Head', statusBarStyle: 'default' },
  openGraph: { title: 'Little Head', description: 'A cozy cat ricochet game for your pocket.', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title: 'Little Head', description: 'A cozy cat ricochet game for your pocket.', images: ['/og.png'] },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#fff8ee' };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
