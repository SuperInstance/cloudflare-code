/**
 * Root Layout
 *
 * Main app layout with PWA support and mobile optimization.
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { swManager } from '@/lib/pwa/registerSW';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ClaudeFlare Mobile',
  description: 'Distributed AI coding platform on the go',
  themeColor: '#0ea5e9',
  manifest: '/manifest.json',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ClaudeFlare',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icons/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={inter.className}>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Register service worker
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
