import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://little-bounce-pocket-game.creamy-harp-0162.chatgpt.site'),
  title: 'Little Bounce',
  description: 'A cozy ball bouncing game for your pocket.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'Little Bounce', statusBarStyle: 'default' },
  openGraph: { title: 'Little Bounce', description: 'A cozy pocket game of bouncing balls and numbered blocks.', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title: 'Little Bounce', description: 'A cozy pocket game of bouncing balls and numbered blocks.', images: ['/og.png'] },
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
